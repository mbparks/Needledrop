import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mp3Args} from '../common.js';
globalThis.self=globalThis;globalThis.location={href:'file:///ffmpeg-core.js'};globalThis.require=createRequire(import.meta.url);globalThis.__dirname=new URL('../vendor/core',import.meta.url).pathname;
const {default:createCore}=await import('../vendor/core/ffmpeg-core.js');
test('bundled WASM extracts MP4 and WebM to real compatible MP3',async()=>{
 const core=await createCore({wasmBinary:fs.readFileSync(new URL('../vendor/core/ffmpeg-core.wasm',import.meta.url)),mainScriptUrlOrBlob:'file:///ffmpeg-core.js#'+btoa(JSON.stringify({wasmURL:'file:///unused.wasm'}))});
 for(const ext of ['mp4','webm']) {
  core.FS.writeFile('source',fs.readFileSync(new URL('./tone.'+ext,import.meta.url)));
  core.exec(...mp3Args('source','output.mp3',{bitrate:192,start:.5,end:2,title:'Needledrop test',artist:'Green Shoe Garage'}));assert.equal(core.ret,0);
  const output=core.FS.readFile('output.mp3');assert.ok(output.length>10000);
  const path=new URL('./result-'+ext+'.mp3',import.meta.url).pathname;fs.writeFileSync(path,output);
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path]));
  assert.equal(info.streams.length,1);assert.equal(info.streams[0].codec_name,'mp3');assert.equal(info.streams[0].sample_rate,'44100');assert.equal(info.streams[0].channels,2);assert.equal(info.streams[0].bit_rate,'192000');assert.ok(Math.abs(Number(info.format.duration)-1.5)<.1);assert.equal(info.format.tags.title,'Needledrop test');
  core.FS.unlink('source');core.FS.unlink('output.mp3');core.reset();
 }
});
