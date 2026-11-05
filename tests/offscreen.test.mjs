import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import 'fake-indexeddb/auto';
import {get,put,assetList} from '../db.js';
class BrowserWorker {
 constructor(url) {
  const shim=`const {parentPort}=require('node:worker_threads');const origFetch=globalThis.fetch;globalThis.fetch=async(u,opts)=>String(u).startsWith('file:')?new Response(require('fs').readFileSync(new URL(String(u))),{headers:{'Content-Type':'application/wasm'}}):origFetch(u,opts);globalThis.self=globalThis;globalThis.location={href:${JSON.stringify(String(url))}};globalThis.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);const messages=[];let ready=false;parentPort.on('message',data=>{if(ready)self.onmessage({data});else messages.push(data)});import(${JSON.stringify(String(url))}).then(()=>{ready=true;for(const data of messages)self.onmessage({data})});`;
  this.w=new NodeWorker(shim,{eval:true});this.w.on('message',data=>{if(data.type==='ERROR')console.error('worker error:',data.data);this.onmessage?.({data});});this.w.on('error',e=>this.onerror?.(e));
 }
 postMessage(data,transfer){this.w.postMessage(data,transfer);}
 terminate(){void this.w.terminate();}
}
globalThis.Worker=BrowserWorker;
let listener,stops=0,closed=0,sampleAmplitude=0.1;
const listeners=[];
globalThis.chrome={runtime:{id:'test',getURL:p=>new URL('../'+p,import.meta.url).href,onMessage:{addListener:fn=>listener=fn}}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stops++,addEventListener:(kind,fn)=>listeners.push(fn)}]})}}});
globalThis.AudioContext=class {constructor(){this.destination={};}createMediaStreamSource(){return {connect(){}};}createAnalyser(){return {getFloatTimeDomainData(a){a.fill(sampleAmplitude);}};}async resume(){}async close(){closed++;}};
const raw=fs.readFileSync(new URL('./tone.webm',import.meta.url));
globalThis.MediaRecorder=class {
 static isTypeSupported(){return true;}constructor(){this.state='inactive';}start(){this.state='recording';}pause(){this.state='paused';}resume(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([raw])});setTimeout(()=>this.onstop?.(),0);}
};
await import('../offscreen.js');
function send(type,data={}){return new Promise(resolve=>listener({target:'offscreen',type,...data},{id:'test'},resolve));}
async function until(predicate){for(let i=0;i<500;i++){const s=(await send('status')).state;if(predicate(s))return s;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out');}
test('actual offscreen + bundled worker produces MP3; recording pause/resume/stop releases resources',async()=>{
 await put('inputs',{id:'input',blob:new Blob([fs.readFileSync(new URL('./tone.mp4',import.meta.url))])});
 assert.equal((await send('convert',{inputId:'input',name:'Video',options:{}})).ok,true);
 assert.equal((await send('convert',{inputId:'input',options:{}})).ok,false);
 const s=await until(s=>['done','error'].includes(s.phase));assert.equal(s.phase,'done',s.message);assert.equal((await get('assets',s.outputId)).kind,'mp3');
 assert.equal((await send('record',{streamId:'synthetic',tabId:4,name:'Synthetic record',options:{}})).ok,true);
 await until(s=>s.phase==='recording');
 assert.equal((await send('pause')).ok,true);assert.equal((await send('status')).state.phase,'paused');
 assert.equal((await send('resume')).ok,true);assert.equal((await send('stop')).ok,true);
 const recording=await until(s=>['done','error'].includes(s.phase));assert.equal(recording.phase,'done',recording.message);assert.ok(stops>0&&closed>0);assert.equal((await assetList()).filter(x=>x.kind==='recording').length,0);
});
test('canceling a take discards it and cannot stop a subsequent take',async()=>{
 const before=(await assetList()).length;
 await send('record',{streamId:'synthetic',name:'Cancel me',options:{}});await until(s=>s.phase==='recording');await send('cancel');
 await send('record',{streamId:'synthetic',name:'Next take',options:{}});await until(s=>s.phase==='recording');await new Promise(r=>setTimeout(r,30));
 assert.equal((await send('status')).state.phase,'recording');await send('cancel');await new Promise(r=>setTimeout(r,20));assert.equal((await assetList()).length,before);assert.equal((await send('status')).state.phase,'idle');
});
test('bad and audio-free inputs recover to an actionable error',async()=>{
 await put('inputs',{id:'bad',blob:new Blob(['not audio'])});await send('convert',{inputId:'bad',name:'Bad',options:{}});
 const result=await until(s=>['done','error'].includes(s.phase));assert.equal(result.phase,'error');assert.match(result.message,/Conversion failed/);
});


test('a take without a detected signal retains a warning on its MP3',async()=>{
 sampleAmplitude=0;
 await send('record',{streamId:'synthetic',name:'Silent meter',options:{}});await until(s=>s.phase==='recording');
 await new Promise(r=>setTimeout(r,2250));await send('stop');
 const result=await until(s=>['done','error'].includes(s.phase));assert.equal(result.phase,'done',result.message);
 const asset=await get('assets',result.outputId);assert.match(asset.warning,/No audio signal was detected/);assert.match(result.message,/Preview it before saving/);sampleAmplitude=0.1;
});
