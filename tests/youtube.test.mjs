import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {youtubeURL} from '../youtube.js';
import {initYouTube} from '../youtube-ui.js';
const video='gSS2IgnnBo8',list='PLabcdefghijk123456789';
test('YouTube Music, share, shorts and playlist links normalize without tracking parameters',()=>{
 for(const u of [`https://music.youtube.com/watch?v=${video}&si=tracking`,`https://youtu.be/${video}?t=50`,`https://www.youtube.com/shorts/${video}`])assert.equal(youtubeURL(u).url,`https://www.youtube.com/watch?v=${video}`);
 assert.equal(youtubeURL(`https://youtube.com/playlist?list=${list}`).kind,'playlist');
 assert.equal(youtubeURL(`https://youtube.com/watch?v=${video}&list=${list}`).kind,'video');
 assert.equal(youtubeURL(`https://youtube.com/watch?v=${video}&list=${list}`,'playlist').url,`https://www.youtube.com/playlist?list=${list}`);
});
test('YouTube URL input rejects unrelated hosts, credentials, invalid IDs and absent playlist',()=>{
 for(const u of ['file:///etc/passwd','https://youtube.com.evil.test/watch?v='+video,'https://user:pass@youtube.com/watch?v='+video,'https://youtube.com/watch?v=bad','https://youtube.com/','https://youtube.com:8443/watch?v='+video])assert.throws(()=>youtubeURL(u));
 assert.throws(()=>youtubeURL('https://youtu.be/'+video,'playlist'));
});
test('paste workflow submits canonical URLs, playlist options and renders output names as text',async()=>{
 const dom=new JSDOM(fs.readFileSync(new URL('../studio.html',import.meta.url),'utf8'));
 globalThis.document=dom.window.document;globalThis.chrome={runtime:{id:'a'.repeat(32)}};
 const interval=globalThis.setInterval;globalThis.setInterval=()=>1;
 let status={phase:'idle',busy:false,connected:true,message:'Ready'},sent=[];
 const send=async(type,data={})=>{sent.push({type,...data});if(type==='native-start')status={...status,phase:'downloading',busy:true,files:[{name:'<img src=x>.mp3',bytes:2000}]};if(type==='native-cancel')status={...status,phase:'canceled',busy:false};return {ok:true,state:status};};
 initYouTube(send);await new Promise(r=>setTimeout(r,0));
 document.querySelector('#youtube-url').value=`https://music.youtube.com/watch?v=${video}&list=${list}`;
 document.querySelector('#youtube-mode').value='playlist';
 await document.querySelector('#youtube-form').onsubmit({preventDefault(){}});
 assert.deepEqual(sent.find(x=>x.type==='native-start'),{type:'native-start',url:`https://www.youtube.com/playlist?list=${list}`,mode:'playlist',quality:192,limit:100});
 assert.equal(document.querySelector('#youtube-start').disabled,true);
 assert.equal(document.querySelector('#youtube-files img'),null);
 assert.match(document.querySelector('#youtube-files').textContent,/<img src=x>/);
 await document.querySelector('#youtube-cancel').onclick();assert.equal(document.querySelector('#youtube-start').disabled,false);
 const before=sent.length;document.querySelector('#youtube-url').value='https://evil.example/';await document.querySelector('#youtube-form').onsubmit({preventDefault(){}});assert.equal(sent.length,before);
 globalThis.setInterval=interval;dom.window.close();
});
test('missing helper opens setup and keeps a retry available',async()=>{
 const dom=new JSDOM(fs.readFileSync(new URL('../studio.html',import.meta.url),'utf8'));
 globalThis.document=dom.window.document;globalThis.chrome={runtime:{id:'a'.repeat(32)}};
 const interval=globalThis.setInterval;globalThis.setInterval=()=>1;
 initYouTube(async type=>{if(type==='native-check')throw new Error('Helper not installed');return {state:{connected:false,busy:false}};});
 await new Promise(r=>setTimeout(r,5));
 assert.equal(document.querySelector('#youtube-setup').open,true);assert.equal(document.querySelector('#youtube-start').disabled,false);assert.match(document.querySelector('#youtube-status').textContent,/not installed/);
 globalThis.setInterval=interval;dom.window.close();
});
