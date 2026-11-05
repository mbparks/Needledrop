import test from 'node:test';
import assert from 'node:assert/strict';
let listener,denied=false,scans=0;
const calls=[];
globalThis.chrome={
 runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,getContexts:async()=>[{}],sendMessage:async m=>{calls.push(m);return m.type==='status'?{ok:true,state:{busy:false}}:{ok:true};},onMessage:{addListener:fn=>listener=fn}},
 action:{onClicked:{addListener(){}}},downloads:{onChanged:{addListener(){}}},
 tabs:{get:async()=>({id:4,title:'Media player',url:'https://media.example/watch'})},
 scripting:{executeScript:async()=>{scans++;return [{result:{items:[],protectedMedia:true,embedded:0}}];}},
 tabCapture:{getMediaStreamId:async({targetTabId})=>{assert.equal(targetTabId,4);if(denied)throw new Error('Capture denied by Chrome');return 'browser-stream-token';}}
};
await import('../background.js');
const send=(m,sender={id:'test',url:'chrome-extension://test/studio.html'})=>new Promise(resolve=>listener({target:'background',...m},sender,resolve));
test('protected-media diagnostics do not gate the browser capture API',async()=>{
 const scan=await send({type:'scan',tabId:4});assert.equal(scan.protectedMedia,true);
 const before=scans;const r=await send({type:'record',tabId:4,options:{}});
 assert.equal(r.ok,true);assert.equal(scans,before);assert.equal(calls.find(x=>x.type==='record').streamId,'browser-stream-token');
});
test('browser capture denial is preserved without a fallback that changes protections',async()=>{
 denied=true;const before=calls.filter(x=>x.type==='record').length;const r=await send({type:'record',tabId:4});
 assert.equal(r.ok,false);assert.match(r.error,/Capture denied/);assert.equal(calls.filter(x=>x.type==='record').length,before);
});
test('webpage callers cannot invoke capture',async()=>{
 const r=await send({type:'record',tabId:4},{id:'test',url:'https://media.example/watch'});assert.equal(r.ok,false);assert.equal(r.error,'Untrusted caller.');
});
