import io
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'native'))
import host
import install

VIDEO = 'https://music.youtube.com/watch?v=gSS2IgnnBo8'

class NativeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='needledrop test ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'tools/bin'
        self.bin.mkdir(parents=True)
        for name in ['yt-dlp','ffmpeg','ffprobe','deno']:
            p = self.bin/name
            p.write_text('#!/bin/sh\nexit 0\n');p.chmod(0o755)
        self.cfg = {k:str(self.bin/n) for k,n in [('yt_dlp','yt-dlp'),('ffmpeg','ffmpeg'),('deno','deno')]}
        self.cfg['output_dir'] = str(self.root/'Downloads')
        self.events=[]
        self.h=host.Host(self.cfg,self.events.append)
        self.addCleanup(self.h.close)

    def fake_downloader(self, ending='success'):
        source='''import sys,json,time
from pathlib import Path
folder=Path(sys.argv[sys.argv.index('--paths')+1])
file=folder/'Track [gSS2IgnnBo8].mp3'
print('ND_ITEM:'+json.dumps('Track <unsafe>'),flush=True)
print('ND_PROGRESS:50.0%',flush=True)
print('ND_CONVERT:started',flush=True)
file.write_bytes(b'ID3' + b'\\0'*100)
print('ND_FILE:'+json.dumps(str(file)),flush=True)
'''
        source += {'success':'','partial':'print("ERROR: Second item unavailable",flush=True)\nsys.exit(1)\n','wait':'time.sleep(30)\n','malformed':'print("ND_FILE:not json",flush=True)\ntime.sleep(30)\n'}[ending]
        p=self.bin/'yt-dlp';p.write_text('#!'+sys.executable+'\n'+source);p.chmod(0o755)

    def start(self):
        return self.h.handle({'action':'start','url':VIDEO,'mode':'auto','quality':192,'limit':100})

    def wait_files(self):
        deadline=time.monotonic()+3
        while not self.h.snapshot()['files'] and time.monotonic()<deadline:time.sleep(.01)
        self.assertTrue(self.h.snapshot()['files'])

    def test_url_validation_and_playlist_selection(self):
        self.assertEqual(host.normalize_url(VIDEO)[0],'https://www.youtube.com/watch?v=gSS2IgnnBo8')
        self.assertEqual(host.normalize_url(VIDEO+'&list=PL123456789012','playlist')[1],'playlist')
        self.assertEqual(host.normalize_url(VIDEO+'&list=PL123456789012')[1],'video')
        for value in ['file:///etc/passwd','https://youtube.com.evil.test/watch?v=gSS2IgnnBo8','https://u:p@youtube.com/watch?v=gSS2IgnnBo8','https://youtube.com/watch?v=oops','--exec rm']:
            with self.assertRaises(ValueError):host.normalize_url(value)

    def test_protocol_fragmented_stream_and_bad_lengths(self):
        data=json.dumps({'action':'ping','requestId':'é'}).encode()
        class Slow(io.BytesIO):
            def read(self,n):return super().read(min(n,2))
        self.assertEqual(host.read_message(Slow(struct.pack('=I',len(data))+data))['requestId'],'é')
        for data in [b'\x01',struct.pack('=I',70000),struct.pack('=I',5)+b'{}',struct.pack('=I',2)+b'[]']:
            with self.assertRaises(ValueError):host.read_message(io.BytesIO(data))

    def test_command_enforces_options_and_keeps_url_a_single_argument(self):
        args=host.command(self.cfg,VIDEO,'auto',192,100,self.root)
        self.assertEqual(args[-2: ],['--','https://www.youtube.com/watch?v=gSS2IgnnBo8'])
        self.assertIn('--no-playlist',args);self.assertIn('--ignore-config',args)
        self.assertIn('ExtractAudio+ffmpeg_o:-ar 44100 -ac 2 -id3v2_version 3',args)
        for quality,limit in [(True,100),(999,100),(192,0),(192,501)]:
            with self.assertRaises(ValueError):host.command(self.cfg,VIDEO,'auto',quality,limit,self.root)

    def test_success_reports_files_and_job_receipt(self):
        self.fake_downloader();self.start();self.h.thread.join(5)
        state=self.h.snapshot();self.assertEqual(state['phase'],'done');self.assertEqual(len(state['files']),1)
        self.assertTrue((Path(state['outputDir'])/'NEEDLEDROP-job.json').is_file())
        self.assertTrue(any(e['state']['phase']=='converting' for e in self.events))
        self.assertIsNone(self.h.proc)

    def test_partial_playlist_keeps_successful_files_and_error(self):
        self.fake_downloader('partial');self.start();self.h.thread.join(5)
        state=self.h.snapshot();self.assertEqual(state['phase'],'partial');self.assertEqual(len(state['files']),1);self.assertTrue(state['errors'])

    def test_cancel_terminates_process_and_allows_next_job(self):
        self.fake_downloader('wait');self.start();self.wait_files()
        with self.assertRaises(ValueError):self.start()
        process=self.h.proc;self.h.handle({'action':'cancel'});self.h.thread.join(6)
        self.assertIsNotNone(process.poll());self.assertEqual(self.h.snapshot()['phase'],'canceled');self.assertEqual(len(self.h.snapshot()['files']),1)
        self.fake_downloader();self.start();self.h.thread.join(5);self.assertEqual(self.h.snapshot()['phase'],'done')

    def test_parser_failure_cleans_child_process(self):
        self.fake_downloader('malformed');self.start();self.h.thread.join(6)
        self.assertFalse(self.h.thread.is_alive());self.assertEqual(self.h.snapshot()['phase'],'error');self.assertIsNone(self.h.proc)

    def test_installer_quotes_spaces_and_limits_allowed_origin(self):
        dest=install.install('a'*32,self.bin.parent,self.root/'User Name')
        manifest=json.loads((self.root/'User Name/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.greenshoegarage.needledrop.json').read_text())
        self.assertEqual(manifest['allowed_origins'],['chrome-extension://'+'a'*32+'/'])
        self.assertEqual(manifest['path'],str(dest/'launch-host'))
        subprocess.run(['sh','-n',str(dest/'launch-host')],check=True)
        # Exercise the actual framed protocol via the generated launcher.
        body=json.dumps({'action':'ping','requestId':'one'}).encode()
        result=subprocess.run([str(dest/'launch-host'),manifest['allowed_origins'][0]],input=struct.pack('=I',len(body))+body,capture_output=True,timeout=4)
        self.assertEqual(result.returncode,0,result.stderr)
        response=host.read_message(io.BytesIO(result.stdout));self.assertTrue(response['ok']);self.assertEqual(response['requestId'],'one')
        denied=subprocess.run([str(dest/'launch-host'),'chrome-extension://'+'b'*32+'/'],capture_output=True,timeout=4)
        self.assertEqual(denied.returncode,1);self.assertEqual(denied.stdout,b'')
        with self.assertRaises(ValueError):install.install('../bad',self.bin.parent,self.root)

if __name__=='__main__':unittest.main()
