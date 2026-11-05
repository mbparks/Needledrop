import test from 'node:test';
import assert from 'node:assert/strict';
import {filename,settings,httpURL,hostPattern,mp3Args} from '../common.js';
test('portable filenames cannot escape download directory',()=>{assert.ok(!/[\/\\]/.test(filename('../../evil.mp4')));assert.equal(filename('CON'),'_CON.mp3');assert.equal(filename('A:B/C?.webm'),'A-B-C-.mp3');});
test('media URLs only allow HTTP(S), without embedded credentials',()=>{for(const u of ['file:///etc/passwd','javascript:alert(1)','blob:https://example.com/123','https://user:pass@example.com/a'])assert.throws(()=>httpURL(u));assert.equal(httpURL('https://example.com/a.mp4#x'),'https://example.com/a.mp4');assert.equal(hostPattern('https://cdn.example.com:8443/file'),'https://cdn.example.com/*');});
test('trim and quality validation',()=>{assert.throws(()=>settings({bitrate:42}));assert.throws(()=>settings({start:10,end:9}));assert.throws(()=>settings({start:-1}));assert.equal(settings().bitrate,192);assert.equal(settings({start:1.5,end:3}).end,3);});
test('conversion drops video and creates compatible MP3 with exact trim',()=>{const a=mp3Args('source','out.mp3',{start:2,end:5,title:'Test'});assert.deepEqual(a.slice(a.indexOf('-ss'),a.indexOf('-ss')+4),['-ss','2','-t','3']);assert.ok(a.includes('libmp3lame'));assert.ok(a.includes('44100'));assert.ok(a.includes('title=Test'));assert.ok(a.includes('-vn'));});

test('capture warnings distinguish initial silence, later silence, pause and normal signal',async()=>{
 const {captureWarning,captureError}=await import('../common.js');
 assert.equal(captureWarning(9,0,false,'recording'),'');
 assert.match(captureWarning(10,0,false,'recording'),/No audio signal detected/);
 assert.equal(captureWarning(30,29,true,'recording'),'');
 assert.match(captureWarning(30,20,true,'recording'),/No audio signal for 10 seconds/);
 assert.equal(captureWarning(60,0,false,'paused'),'');
 assert.match(captureError({name:'NotAllowedError'}).message,/Chrome did not allow/);
});
