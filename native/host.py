#!/usr/bin/env python3
"""NEEDLEDROP native messaging host. Only YouTube URLs and fixed operations.

Uses a per-user installation, no network listener, no shell execution, and no
browser-cookie extraction. yt-dlp and FFmpeg remain independently updatable.
"""
import json
import os
from pathlib import Path
import re
import signal
import struct
import subprocess
import sys
import threading
import time
from urllib.parse import urlsplit, parse_qs
import uuid

VERSION = '1.1.0-rc.1'
MAX_MESSAGE = 65536
BUSY = {'starting', 'downloading', 'converting', 'canceling'}


def normalize_url(value, mode='auto'):
    if not isinstance(value, str) or len(value) > 4096:
        raise ValueError('Paste a YouTube video or playlist URL.')
    u = urlsplit(value.strip())
    hosts = {'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'}
    if u.scheme not in ('http', 'https') or u.hostname not in hosts or u.username or u.password or u.port:
        raise ValueError('Only YouTube and YouTube Music links are accepted.')
    if mode not in ('auto', 'video', 'playlist'):
        raise ValueError('Invalid download mode.')
    query = parse_qs(u.query)
    video = query.get('v', [''])[0]
    playlist = query.get('list', [''])[0]
    parts = u.path.split('/')
    if u.hostname.endswith('youtu.be'):
        video = parts[1] if len(parts) > 1 else ''
    elif len(parts) > 2 and parts[1] in ('shorts', 'live', 'embed'):
        video = parts[2]
    if video and not re.fullmatch(r'[A-Za-z0-9_-]{11}', video):
        raise ValueError('Invalid YouTube video ID.')
    if playlist and not re.fullmatch(r'[A-Za-z0-9_-]{10,150}', playlist):
        raise ValueError('Invalid playlist ID.')
    kind = 'playlist' if mode == 'playlist' or (mode == 'auto' and not video and playlist) else 'video'
    if kind == 'video' and not video:
        raise ValueError('This link has no video. Choose Full playlist.')
    if kind == 'playlist' and not playlist:
        raise ValueError('This link has no playlist.')
    return (f'https://www.youtube.com/playlist?list={playlist}' if kind == 'playlist'
            else f'https://www.youtube.com/watch?v={video}'), kind


def command(config, url, mode, quality, limit, folder):
    url, kind = normalize_url(url, mode)
    if type(quality) is not int or quality not in (128, 192, 256, 320):
        raise ValueError('Choose a supported MP3 bitrate.')
    if type(limit) is not int or not 1 <= limit <= 500:
        raise ValueError('Playlist limit must be between 1 and 500.')
    template = ('%(playlist_index)03d - ' if kind == 'playlist' else '') + '%(title).160B [%(id)s].%(ext)s'
    args = [config['yt_dlp'], '--ignore-config', '--no-plugin-dirs', '--no-simulate',
            '--no-colors', '--newline', '--progress', '--progress-delta', '1',
            '--no-abort-on-error', '--no-overwrites', '--windows-filenames',
            '--socket-timeout', '30', '--retries', '3', '--fragment-retries', '3',
            '--concurrent-fragments', '1', '--sleep-interval', '1',
            '--match-filters', '!is_live', '--format', 'bestaudio/best',
            '--extract-audio', '--audio-format', 'mp3', '--audio-quality', f'{quality}K',
            '--embed-metadata', '--ffmpeg-location', str(Path(config['ffmpeg']).parent),
            '--js-runtimes', 'deno:' + config['deno'],
            '--postprocessor-args', 'ExtractAudio+ffmpeg_o:-ar 44100 -ac 2 -id3v2_version 3',
            '--postprocessor-args', 'Metadata+ffmpeg_o:-id3v2_version 3',
            '--print', 'before_dl:ND_ITEM:%(title)j',
            '--print', 'after_move:ND_FILE:%(filepath)j',
            '--progress-template', 'download:ND_PROGRESS:%(progress._percent_str)s',
            '--progress-template', 'postprocess:ND_CONVERT:%(progress.status)s',
            '--paths', str(folder), '--output', template]
    args += ['--yes-playlist', '--playlist-end', str(limit)] if kind == 'playlist' else ['--no-playlist']
    return args + ['--', url]


def read_exact(stream, count):
    data = bytearray()
    while len(data) < count:
        chunk = stream.read(count - len(data))
        if not chunk:
            if data:
                raise ValueError('Truncated native message.')
            return None
        data.extend(chunk)
    return bytes(data)


def read_message(stream):
    header = read_exact(stream, 4)
    if header is None:
        return None
    length = struct.unpack('=I', header)[0]
    if length < 2 or length > MAX_MESSAGE:
        raise ValueError('Invalid native message length.')
    data = read_exact(stream, length)
    if data is None:
        raise ValueError('Missing native message.')
    msg = json.loads(data.decode('utf-8'))
    if not isinstance(msg, dict):
        raise ValueError('Native message must be an object.')
    return msg


class Host:
    def __init__(self, config, emit, process_factory=subprocess.Popen):
        self.config = config
        self.emit = emit
        self.process_factory = process_factory
        self.lock = threading.RLock()
        self.stop = threading.Event()
        self.proc = None
        self.thread = None
        self.root = Path(config['output_dir']).expanduser().resolve()
        self.state = {'phase': 'idle', 'busy': False, 'message': 'Ready. Paste a YouTube link.',
                      'files': [], 'errors': [], 'outputDir': str(self.root), 'helperVersion': VERSION}

    def snapshot(self):
        with self.lock:
            return json.loads(json.dumps(self.state))

    def update(self, **changes):
        with self.lock:
            self.state.update(changes)
            self.state['busy'] = self.state['phase'] in BUSY
            result = self.snapshot()
        self.emit({'type': 'event', 'state': result})

    def check_tools(self):
        for name in ('yt_dlp', 'ffmpeg', 'deno'):
            path = self.config.get(name, '')
            if not path or not Path(path).is_file() or not os.access(path, os.X_OK):
                raise ValueError(f'{name.replace("_", "-")} is missing. Run Install-Mac.command again.')
        probe = Path(self.config['ffmpeg']).parent / 'ffprobe'
        if not probe.is_file():
            raise ValueError('ffprobe is missing. Reinstall FFmpeg using the setup script.')

    def handle(self, msg):
        action = msg.get('action')
        if action == 'ping':
            self.check_tools()
            return {'state': self.snapshot()}
        if action == 'start':
            self.check_tools()
            with self.lock:
                if self.state['busy']:
                    raise ValueError('A download is already running.')
                folder = self.root / (time.strftime('%Y-%m-%d_%H-%M-%S') + '_' + uuid.uuid4().hex[:6])
                args = command(self.config, msg.get('url'), msg.get('mode', 'auto'),
                               msg.get('quality', 192), msg.get('limit', 100), folder)
                folder.mkdir(parents=True, exist_ok=False)
                self.stop.clear()
                self.state = {'phase': 'starting', 'busy': True, 'message': 'Reading the YouTube link…',
                              'files': [], 'errors': [], 'outputDir': str(folder), 'helperVersion': VERSION,
                              'currentTitle': '', 'progress': None, 'limit': msg.get('limit', 100)}
                self.thread = threading.Thread(target=self.run, args=(args, folder), daemon=True)
                self.thread.start()
            return {'state': self.snapshot()}
        if action == 'cancel':
            with self.lock:
                if self.state['busy']:
                    self.stop.set()
                    self.update(phase='canceling', message='Canceling. Completed MP3s will be kept.')
                    if self.proc:
                        threading.Thread(target=self.terminate, args=(self.proc,), daemon=True).start()
            return {'state': self.snapshot()}
        if action == 'open_folder':
            folder = Path(self.snapshot()['outputDir']).resolve()
            if not folder.is_relative_to(self.root):
                raise ValueError('Invalid output folder.')
            folder.mkdir(parents=True, exist_ok=True)
            if sys.platform != 'darwin':
                raise ValueError('Open-folder integration is available on macOS. Use the displayed path.')
            subprocess.Popen(['/usr/bin/open', str(folder)], stdin=subprocess.DEVNULL,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {'state': self.snapshot()}
        raise ValueError('Unknown helper operation.')

    def terminate(self, process=None):
        with self.lock:
            p = process or self.proc
        if not p or p.poll() is not None:
            return
        try:
            os.killpg(p.pid, signal.SIGTERM)
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def run(self, args, folder):
        files, errors = [], []
        watchdog = None
        final = None
        p = None
        try:
            env = os.environ.copy()
            # Chrome launches with a minimal PATH. Use only installed dependency folders.
            env['PATH'] = os.pathsep.join(dict.fromkeys([str(Path(self.config[k]).parent) for k in ('yt_dlp', 'ffmpeg', 'deno')] + ['/usr/bin', '/bin', '/usr/sbin', '/sbin']))
            env['PYTHONUNBUFFERED'] = '1'
            p = self.process_factory(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace',
                                     bufsize=1, start_new_session=True, env=env)
            with self.lock:
                self.proc = p
            if self.stop.is_set():
                self.terminate()
            watchdog = threading.Timer(7200, self.timeout, args=(p,))
            watchdog.daemon = True
            watchdog.start()
            self.update(phase='downloading', message='Downloading audio…')
            for raw in p.stdout:
                line = raw.strip()
                if line.startswith('ND_ITEM:'):
                    title = json.loads(line[len('ND_ITEM:'):])
                    self.update(phase='downloading', currentTitle=str(title)[:300], progress=0,
                                message=f'Downloading track {len(files) + 1}…')
                elif line.startswith('ND_PROGRESS:'):
                    match = re.search(r'(\d+(?:\.\d+)?)%', line)
                    if match:
                        self.update(progress=min(1, float(match.group(1)) / 100))
                elif line.startswith('ND_CONVERT:'):
                    self.update(phase='converting', message='Converting and tagging the MP3…', progress=None)
                elif line.startswith('ND_FILE:'):
                    path = Path(json.loads(line[len('ND_FILE:'):])).resolve()
                    if path.is_relative_to(folder) and path.suffix.lower() == '.mp3' and path.is_file():
                        entry = {'name': path.name, 'bytes': path.stat().st_size}
                        if entry not in files:
                            files.append(entry)
                        self.update(files=list(files), message=f'{len(files)} MP3 file(s) saved.')
                elif line.startswith('ERROR:'):
                    error = line[:600]
                    if error not in errors and len(errors) < 40:
                        errors.append(error)
                    self.update(errors=list(errors))
            code = p.wait()
            if self.stop.is_set():
                phase, message = 'canceled', f'Canceled. {len(files)} completed MP3 file(s) kept.'
            elif files:
                phase = 'partial' if code or errors else 'done'
                message = f'{len(files)} MP3 file(s) saved.' + (' Some items could not be downloaded; see details.' if phase == 'partial' else '')
            else:
                phase, message = 'error', 'No MP3 was downloaded. Check the details; the item may be unavailable, restricted, live, or require sign-in.'
            final = dict(phase=phase, message=message, files=files, errors=errors, progress=None)
        except Exception as error:
            if p:
                self.terminate(p)
            final = dict(phase='error', message=str(error)[:500], files=files, errors=errors, progress=None)
        finally:
            if watchdog:
                watchdog.cancel()
            if p and p.stdout:
                p.stdout.close()
            with self.lock:
                self.proc = None
                if final:
                    self.state.update(final)
                    self.state['busy'] = False
                    result = self.snapshot()
                    try:
                        (folder / 'NEEDLEDROP-job.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
                    except OSError:
                        pass
                    self.emit({'type':'event', 'state':result})

    def timeout(self, process):
        with self.lock:
            if self.proc is not process:
                return
            self.stop.set()
            self.update(phase='canceling', message='Stopping after the two-hour job limit. Completed files are kept.')
        self.terminate(process)

    def close(self):
        self.stop.set()
        self.terminate()
        if self.thread:
            self.thread.join(timeout=6)


def main():
    config = json.loads(Path(__file__).with_name('host-config.json').read_text(encoding='utf-8'))
    expected = 'chrome-extension://' + config['extension_id']
    if len(sys.argv) < 2 or sys.argv[1].rstrip('/') != expected:
        return 1
    lock = threading.Lock()
    def emit(message):
        data = json.dumps(message, ensure_ascii=False).encode('utf-8')
        if len(data) > 900000:
            raise ValueError('Helper response too large.')
        with lock:
            sys.stdout.buffer.write(struct.pack('=I', len(data)))
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
    host = Host(config, emit)
    try:
        while True:
            msg = read_message(sys.stdin.buffer)
            if msg is None:
                break
            request_id = msg.get('requestId')
            if not isinstance(request_id, str) or len(request_id) > 100:
                raise ValueError('Invalid request ID.')
            try:
                result = host.handle(msg)
                emit({'type': 'response', 'requestId': request_id, 'ok': True, **result})
            except Exception as error:
                emit({'type': 'response', 'requestId': request_id, 'ok': False, 'error': str(error)[:600]})
    except (BrokenPipeError, EOFError, ValueError):
        pass
    finally:
        host.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
