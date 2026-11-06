import test from 'node:test';
import assert from 'node:assert/strict';
let onMessage,onDisconnect,connections=0,sent=[];
globalThis.chrome={runtime:{connectNative:name=>{assert.equal(name,'com.greenshoegarage.needledrop');connections++;return {onMessage:{addListener:fn=>onMessage=fn},onDisconnect:{addListener:fn=>onDisconnect=fn},postMessage:m=>{sent.push(m);}};}}};
const {nativeRequest,nativeStatus}=await import('../native-client.js');
test('native requests correlate responses, share one port, and recover after disconnect',async()=>{
 const a=nativeRequest('ping'),b=nativeRequest('start',{url:'https://youtube.com/watch?v=gSS2IgnnBo8'});
 assert.equal(connections,1);
 onMessage({type:'response',requestId:sent[1].requestId,ok:true,state:{busy:true,phase:'downloading'}});assert.equal((await b).ok,true);
 onMessage({type:'response',requestId:sent[0].requestId,ok:true});await a;
 assert.equal(nativeStatus().busy,true);
 onMessage({type:'event',state:{phase:'done',busy:false,files:[{name:'track.mp3'}]}});assert.equal(nativeStatus().files.length,1);
 const waiting=nativeRequest('ping');const rejected=assert.rejects(waiting,/not connected/);chrome.runtime.lastError={message:'host exited'};onDisconnect();await rejected;delete chrome.runtime.lastError;
 assert.equal(nativeStatus().connected,false);
 const reconnect=nativeRequest('ping');assert.equal(connections,2);onMessage({type:'response',requestId:sent.at(-1).requestId,ok:true,state:{phase:'idle'}});await reconnect;assert.equal(nativeStatus().connected,true);
});
