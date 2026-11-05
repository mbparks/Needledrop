import {FFmpeg} from './vendor/ffmpeg/index.js';
import {MAX_BYTES,MAX_SECONDS,busy,filename,httpURL,settings,mp3Args,captureWarning,captureError} from './common.js';
import {get,put,remove} from './db.js';
let state={phase:'idle',message:'Ready when you are.'}, job=null, encoder=null, recorder=null, stream=null, monitor=null, tick=null;
let chunks=[],recordBytes=0,elapsed=0,lastTick=0,aborter=null,levelNode=null;
const urls=new Set();
function update(patch) {state={...state,...patch};}
function assertIdle() {if(job)throw new Error('Finish or cancel the current job first.');}
function active(token) {if(job!==token)throw new Error('Canceled.');}
function fail(e,token) {if(job!==token)return; update({phase:'error',message:e?.message||(typeof e==='string'?e.slice(0,300):'Unable to process this media.')}); job=null; void release();}
async function release() {
  clearInterval(tick); tick=null;
  const oldStream=stream,oldMonitor=monitor;stream=null;monitor=null;levelNode=null;
  if(oldStream)oldStream.getTracks().forEach(t=>t.stop());
  if(oldMonitor)await oldMonitor.close().catch(()=>{});
}
async function fetchBytes(url,token) {
  aborter=new AbortController();
  const timeout=setTimeout(()=>aborter?.abort(),60000);
  try {
    // Only the requested host is granted. A redirect must be supplied as a new direct URL.
    const res=await fetch(httpURL(url),{credentials:'include',redirect:'error',signal:aborter.signal});
    if(!res.ok)throw new Error(`The media host returned HTTP ${res.status}. Try recording the tab instead.`);
    const type=res.headers.get('content-type')||'';
    if(/text\/|application\/(json|.*mpegurl|dash\+xml)/i.test(type)) throw new Error('This link is a page or streaming playlist, not a media file. Use Record tab.');
    const length=Number(res.headers.get('content-length'));
    if(length>MAX_BYTES)throw new Error('This file exceeds the 200 MB conversion limit. Record the tab or use a smaller file.');
    const reader=res.body.getReader(),parts=[]; let total=0;
    for(;;){const {done,value}=await reader.read(); if(done)break; active(token); total+=value.length;
      if(total>MAX_BYTES){await reader.cancel();throw new Error('This file exceeds the 200 MB conversion limit.');}
      parts.push(value); update({message:`Fetching media · ${(total/1048576).toFixed(1)} MB`,progress:length?Math.min(.99,total/length):null});
    }
    if(!total)throw new Error('The media file is empty.');
    const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;
  } catch(e) {
    if(e.name==='AbortError')throw new Error('The download timed out or was canceled. Try recording the tab.');
    if(e instanceof TypeError)throw new Error('The host blocked the download or redirected it. Use its final media URL, download a local file, or record the tab.');
    throw e;
  } finally {clearTimeout(timeout);aborter=null;}
}
async function transcode(bytes,name,options,token,warning='') {
  active(token); if(bytes.byteLength>MAX_BYTES)throw new Error('This file exceeds the 200 MB conversion limit.');
  update({phase:'loading',message:'Warming up the local MP3 encoder…',progress:null});
  const ff=encoder=new FFmpeg(); let logs=[];
  ff.on('log',e=>{logs.push(e.message);if(logs.length>30)logs.shift();});
  ff.on('progress',p=>{if(job===token&&state.phase==='converting')update({progress:Math.max(0,Math.min(.99,p.progress)),message:'Making your MP3…'});});
  try {
    let loadTimer;
    try {await Promise.race([
      ff.load({coreURL:chrome.runtime.getURL('vendor/core/ffmpeg-core.js'),wasmURL:chrome.runtime.getURL('vendor/core/ffmpeg-core.wasm')}),
      new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(new Error('The local encoder could not start. Reload the extension and try again.')),30000);})
    ]);}finally{clearTimeout(loadTimer);}
    active(token); await ff.writeFile('source',bytes); active(token);
    update({phase:'converting',message:'Making your MP3…',progress:0});
    const code=await ff.exec(mp3Args('source','output.mp3',options),300000);
    active(token);
    if(code!==0) {
      if(logs.some(l=>/matches no streams|does not contain any stream/i.test(l)))throw new Error('No audio track was found in this file.');
      throw new Error('Conversion failed: the media may be incomplete, unsupported, protected, or too demanding. Try recording its playback.');
    }
    const bytesOut=await ff.readFile('output.mp3');active(token);
    if(bytesOut.length<1000)throw new Error('No usable audio was produced. Check the trim range and source.');
    const id=crypto.randomUUID();
    await put('assets',{id,filename:filename(options.title||name),kind:'mp3',blob:new Blob([bytesOut],{type:'audio/mpeg'}),bytes:bytesOut.byteLength,created:Date.now(),bitrate:options.bitrate,warning});
    active(token); update({phase:'done',message:warning?`MP3 created. ${warning}`:'MP3 ready. Save it from Your tape shelf.',captureWarning:'',progress:1,outputId:id}); job=null;
  } finally {ff.terminate();if(encoder===ff)encoder=null;}
}
async function convert(m,token) {
  try {
    let bytes;
    if(m.url){update({phase:'fetching',message:'Fetching the media file…'});bytes=await fetchBytes(m.url,token);}
    else {const asset=await get(m.assetId?'assets':'inputs',m.assetId||m.inputId);if(!asset)throw new Error('The local file is no longer available. Choose it again.');bytes=new Uint8Array(await asset.blob.arrayBuffer());}
    active(token);await transcode(bytes,m.name||'Needledrop',settings(m.options),token);
  }catch(e){fail(e,token);}finally{if(m.inputId)await remove('inputs',m.inputId);}
}
async function startRecord(m,token) {
  try {
    const options=settings({...m.options,start:0,end:null});
    let acquireTimer;
    const acquisition=navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:m.streamId}},video:false}).then(acquired=>{
      if(job!==token){acquired.getTracks().forEach(t=>t.stop());return null;}
      return acquired;
    });
    let acquired;
    try {acquired=await Promise.race([acquisition,new Promise((_,reject)=>{acquireTimer=setTimeout(()=>reject(new Error('Chrome did not start capture within 20 seconds. Return to the source page, invoke the toolbar icon again, and retry.')),20000);})]);}
    catch(e){throw captureError(e);}finally{clearTimeout(acquireTimer);}
    if(!acquired)return;
    if(job!==token){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;monitor=new AudioContext();
    const src=monitor.createMediaStreamSource(stream);levelNode=monitor.createAnalyser();levelNode.fftSize=256;
    src.connect(levelNode);src.connect(monitor.destination);await monitor.resume();active(token);
    chunks=[];recordBytes=0;elapsed=0;
    let heardAudio=false,lastSignal=0;
    const mime=['audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw new Error('This Chrome build cannot record WebM audio.');
    recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:192000});
    const current=recorder;
    current.ondataavailable=e=>{if(e.data.size&&job===token){chunks.push(e.data);recordBytes+=e.data.size;if(recordBytes>=MAX_BYTES&&current.state!=='inactive')stopRecording('Stopped at the 200 MB recording limit.');}};
    current.onerror=e=>{if(current.state!=='inactive')current.stop();fail(new Error(e.error?.message||'Recording failed.'),token);};
    current.onstop=async()=> {
      if(job!==token)return;await release();if(job!==token)return;
      try {
        const blob=new Blob(chunks,{type:mime});chunks=[];
        if(blob.size<1000)throw new Error('The recording was empty. Start playback before recording.');
        if(blob.size>MAX_BYTES)throw new Error('The recording exceeded the 200 MB conversion limit.');
        const rawId=crypto.randomUUID();
        await put('assets',{id:rawId,filename:filename(m.name||'Tab recording','webm'),kind:'recording',blob,bytes:blob.size,created:Date.now()});
        const warning=!heardAudio&&elapsed>=2?'No audio signal was detected during this take. Preview it before saving.':'';
        await transcode(new Uint8Array(await blob.arrayBuffer()),m.name||'Tab recording',options,token,warning);
        await remove('assets',rawId);
      }catch(e){fail(e,token);}finally{if(recorder===current)recorder=null;}
    };
    for(const t of stream.getTracks())t.addEventListener('ended',()=>{if(job===token&&current.state!=='inactive')stopRecording('Tab capture ended. Finishing your MP3…');});
    current.start(1000);lastTick=performance.now();
    update({phase:'recording',message:'Recording the selected tab. Keep its media playing.',elapsed:0,tabId:m.tabId,sourceTitle:m.name,level:0});
    tick=setInterval(()=> {
      const now=performance.now();if(current.state==='recording')elapsed+=(now-lastTick)/1000;lastTick=now;
      let level=0;if(levelNode){const a=new Float32Array(256);levelNode.getFloatTimeDomainData(a);level=Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length);}
      if(current.state==='recording'&&level>0.0001){heardAudio=true;lastSignal=elapsed;}
      update({elapsed,level:Math.min(1,level*3),heardAudio,captureWarning:captureWarning(elapsed,lastSignal,heardAudio,state.phase)});
      if(elapsed>=MAX_SECONDS)stopRecording('Stopped at the 60 minute recording limit.');
    },250);
  }catch(e){fail(e,token);}
}
function stopRecording(message='Finishing the recording…') {
  if(!recorder||recorder.state==='inactive')throw new Error('There is no active recording.');
  update({phase:'stopping',message});recorder.stop();clearInterval(tick);
}
async function handle(m) {
  if(m.type==='status')return {state:{...state,busy:busy(state)}};
  if(m.type==='convert'||m.type==='record') {
    assertIdle();const options=settings(m.options);const token=crypto.randomUUID();job=token;
    state={phase:'starting',message:'Starting…',progress:null};
    if(m.type==='convert')void convert({...m,options},token);else void startRecord({...m,options},token);
    return {};
  }
  if(m.type==='pause'){if(recorder?.state!=='recording')throw new Error('No recording to pause.');recorder.pause();update({phase:'paused',message:'Recording paused.'});return {};}
  if(m.type==='resume'){if(recorder?.state!=='paused')throw new Error('No recording to resume.');recorder.resume();lastTick=performance.now();update({phase:'recording',message:'Recording the selected tab.'});return {};}
  if(m.type==='stop'){stopRecording();return {};}
  if(m.type==='cancel') {
    job=null;aborter?.abort();encoder?.terminate();encoder=null;
    if(recorder&&recorder.state!=='inactive')recorder.stop();recorder=null;chunks=[];
    await release();state={phase:'idle',message:'Canceled. Ready for another take.'};return {};
  }
  if(m.type==='asset-url') {const a=await get('assets',m.id);if(!a)throw new Error('That file has been removed.');const url=URL.createObjectURL(a.blob);urls.add(url);return {url,filename:a.filename};}
  if(m.type==='revoke'){if(urls.has(m.url)){URL.revokeObjectURL(m.url);urls.delete(m.url);}return {};}
  throw new Error('Unknown audio operation.');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=> {
  if(m.target!=='offscreen')return;
  if(sender.id!==chrome.runtime.id)return;
  handle(m).then(r=>reply({ok:true,...r})).catch(e=>reply({ok:false,error:e.message}));return true;
});
