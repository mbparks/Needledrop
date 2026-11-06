import {MAX_BYTES,busy,filename,httpURL,hostPattern,settings,size,clock} from './common.js';
import {put,get,remove,assetList} from './db.js';
import {initYouTube} from './youtube-ui.js';
const $=s=>document.querySelector(s);
let source=null,items=[],state={phase:'idle'},shelfSignature='',previews=[],scanBusy=false,starting=false,lastPhase='',lastSourceId=null;
async function send(type,data={}) {const r=await chrome.runtime.sendMessage({target:'background',type,...data});if(!r?.ok)throw new Error(r?.error||'The extension did not respond.');return r;}
function notify(message) {$('#notice').textContent=message;$('#notice').hidden=!message;}
function safe(fn) {return async(...a)=>{try{notify('');await fn(...a);}catch(e){notify(e.message);}};}
function opts() {return settings(Object.fromEntries(['bitrate','title','artist','album','start','end'].map(k=>[k,$('#'+k).value])));}
function sourceView() {
  $('#source-title').textContent=source?.title||'Choose a source page';
  $('#source-url').textContent=source?.url||'Open a website and click the NEEDLEDROP extension icon.';
  $('#visit').disabled=!source;$('#scan').disabled=!source||scanBusy;
  if(!['recording','paused'].includes(state.phase))$('#record-source').textContent=source?.title||'Select a page to start a take.';
}
async function getSource() {
  const next=(await send('source')).source;
  if(next?.id!==source?.id||next?.url!==source?.url){source=next;items=[];renderMedia();sourceView();if(source&&lastSourceId!==source.id&&$('.advanced').open){lastSourceId=source.id;await doScan();}}
}
async function doScan() {
  if(!source||scanBusy)return;
  scanBusy=true;sourceView();$('#scan').textContent='Scanning…';
  try {
    const r=await send('scan',{tabId:source.id});items=r.items;
    $('#scan-note').textContent=r.protectedMedia?'This page uses protected-media APIs. You can try Record tab; Chrome or the service may restrict capture.':r.embedded?'Embedded players are present. Cross-origin frames may be inaccessible; try Record tab for audible playback.':'Scan complete. If a player loaded more media, play it and scan again.';
    renderMedia();
  }catch(e){notify('Could not scan this page. Return to it and click the NEEDLEDROP toolbar icon again. Chrome internal pages and the Web Store cannot be scanned.');}
  finally{scanBusy=false;$('#scan').textContent='Scan page';sourceView();}
}
function renderMedia() {
  const needle=$('#filter').value.toLowerCase(),type=$('#type-filter').value;
  const matches=items.filter(i=>(type==='all'||i.type===type)&&`${i.title} ${i.url}`.toLowerCase().includes(needle));
  $('#count').textContent=`${items.length} SOURCE${items.length===1?'':'S'}`;
  const list=$('#media-list');list.replaceChildren();
  if(!matches.length){const d=document.createElement('div');d.className='empty';const b=document.createElement('b');b.textContent=items.length?'No matching tracks.':source?'No direct media found yet.':'Let’s find your next track.';const p=document.createElement('p');p.textContent=source?'Try playing the media and scanning again, or use Record tab.':'Choose a page with the toolbar icon, then scan it here.';d.append(b,p);list.append(d);return;}
  for(const i of matches){
    const row=document.createElement('div');row.className='media';const tag=document.createElement('span');tag.className='media-type';tag.textContent=i.type.toUpperCase();
    const text=document.createElement('div');text.className='media-text';const name=document.createElement('strong');name.textContent=i.title;const path=document.createElement('small');path.textContent=i.url;path.title=i.url;text.append(name,path);
    const button=document.createElement('button');button.textContent=i.type==='mp3'?'↓ Save MP3':i.type==='stream'?'Record tab':'Make MP3';button.disabled=i.type!=='mp3'&&(busy(state)||starting);
    button.addEventListener('click',safe(async()=>{if(i.type==='mp3'){await send('download',{url:i.url,name:i.title});notify('Download handed to Chrome. Check Chrome’s Downloads for completion.');}else if(i.type==='stream')await record();else await convertURL(i.url,i.title);}));
    row.append(tag,text,button);list.append(row);
  }
}
async function start(type,payload) {
  if(busy(state)||starting)throw new Error('Finish or cancel the current job first.');
  starting=true;renderState();
  try {await send(type,payload);await poll();}finally{starting=false;renderState();}
}
async function convertURL(url,name='') {
  const options=opts(),clean=httpURL(url),origin=hostPattern(clean);
  // Request in the click handler, before unrelated awaits, to retain user activation.
  const allowed=await chrome.permissions.request({origins:[origin]});
  if(!allowed)throw new Error('Host access was declined. Download a file yourself and drop it here, or use Record tab.');
  await chrome.storage.local.set({preferences:options});
  let fallback='Needledrop';try{fallback=decodeURIComponent(new URL(clean).pathname.split('/').pop())||fallback;}catch{}
  await start('convert',{url:clean,name:name||fallback,options});
}
async function localFile(file) {
  if(!file)return;if(busy(state)||starting)throw new Error('Finish or cancel the current job first.');
  if(file.size>MAX_BYTES)throw new Error('Choose a file no larger than 200 MB.');
  if(!file.size)throw new Error('This file is empty.');
  const options=opts(),id=crypto.randomUUID();
  await put('inputs',{id,blob:file});
  try{await start('convert',{inputId:id,name:file.name,options});}catch(e){await remove('inputs',id);throw e;}
}
async function record() {
  if(!source)throw new Error('Open a media page and click the NEEDLEDROP toolbar icon first.');
  await start('record',{tabId:source.id,options:opts()});
}
function renderState() {
  const b=busy(state)||starting,rec=['recording','paused'].includes(state.phase);
  $('#status').textContent=state.message||'Ready when you are.';
  $('#progress').hidden=!b||rec;
  if(typeof state.progress==='number')$('#progress').value=state.progress;else $('#progress').removeAttribute('value');
  $('#cancel').hidden=!b;$('#cancel').textContent=rec?'Discard take':'Cancel job';
  $('#record').disabled=!source||b;$('#pause').disabled=!rec;$('#stop').disabled=!rec;
  $('#pause').textContent=state.phase==='paused'?'Resume':'Pause';
  $('#phase').textContent=state.phase==='recording'?'● RECORDING':state.phase==='paused'?'PAUSED':state.phase==='stopping'?'FINISHING':'STANDING BY';
  $('#timer').textContent=clock(state.elapsed);$('#level').value=rec?state.level||0:0;
  $('#capture-warning').textContent=state.captureWarning||'';$('#capture-warning').hidden=!rec||!state.captureWarning;
  if(rec)$('#record-source').textContent=state.sourceTitle||source?.title;
  $('#convert-url').disabled=b;$('#file').disabled=b;
  for(const button of document.querySelectorAll('.media button'))if(button.textContent!=='↓ Save MP3')button.disabled=b;
  if(state.phase!==lastPhase){lastPhase=state.phase;void renderShelf();}
}
async function renderShelf(force=false) {
  const assets=await assetList(),signature=assets.map(a=>a.id).join(',');if(signature===shelfSignature&&!force)return;shelfSignature=signature;
  previews.forEach(URL.revokeObjectURL);previews=[];const shelf=$('#shelf');shelf.replaceChildren();
  if(!assets.length){const p=document.createElement('p');p.className='helper';p.textContent='Finished MP3s will appear here, ready to preview and save.';shelf.append(p);return;}
  for(const a of assets){const row=document.createElement('div');row.className='asset';const text=document.createElement('div');text.className='asset-text';const title=document.createElement('strong');title.textContent=a.filename;const sub=document.createElement('small');sub.textContent=`${size(a.bytes)} · ${a.kind==='mp3'?`${a.bitrate} kbps MP3`:'Recording backup · conversion can be retried'} · ${new Date(a.created).toLocaleString()}`;text.append(title,sub);
    if(a.warning){const warning=document.createElement('p');warning.className='capture-warning';warning.textContent=a.warning;text.append(warning);}
    const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.setAttribute('aria-label',`Preview ${a.filename}`);text.append(audio);
    const blob=(await get('assets',a.id))?.blob;if(blob){audio.src=URL.createObjectURL(blob);previews.push(audio.src);}
    const buttons=document.createElement('div');buttons.className='asset-buttons';const save=document.createElement('button');save.textContent=a.kind==='mp3'?'↓ Save MP3':'↓ Save backup';save.onclick=safe(async()=>{await send('save',{id:a.id});notify('Download handed to Chrome. Check Chrome’s Downloads for completion.');});buttons.append(save);
    if(a.kind!=='mp3'){const retry=document.createElement('button');retry.textContent='Retry MP3';retry.onclick=safe(()=>start('convert',{assetId:a.id,name:a.filename,options:opts()}));buttons.append(retry);}
    const del=document.createElement('button');del.textContent='Remove';del.className='quiet';del.onclick=safe(async()=>{if(confirm(`Remove ${a.filename} from this shelf? Files already downloaded are unaffected.`)){await remove('assets',a.id);await renderShelf(true);}});buttons.append(del);row.append(text,buttons);shelf.append(row);
  }
}
let polling=false;
async function poll(){if(polling)return;polling=true;try{state=(await send('status')).state;renderState();await getSource();}finally{polling=false;}}
$('#scan').onclick=safe(doScan);$('#filter').oninput=renderMedia;$('#type-filter').onchange=renderMedia;
$('.advanced').ontoggle=safe(async()=>{if($('.advanced').open&&source&&!items.length)await doScan();});
$('#visit').onclick=safe(async()=>{const t=await chrome.tabs.update(source.id,{active:true});await chrome.windows.update(t.windowId,{focused:true});});
$('#record').onclick=safe(record);$('#pause').onclick=safe(()=>send(state.phase==='paused'?'resume':'pause'));$('#stop').onclick=safe(()=>send('stop'));
$('#cancel').onclick=safe(async()=>{if(['recording','paused'].includes(state.phase)&&!confirm('Discard this recording? Use Stop & make MP3 to keep it.'))return;await send('cancel');await poll();});
$('#convert-url').onclick=safe(()=>convertURL($('#url').value));
$('#file').onchange=safe(async e=>{await localFile(e.target.files[0]);e.target.value='';});
const drop=$('#dropzone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('over');};drop.ondragleave=()=>drop.classList.remove('over');drop.ondrop=safe(async e=>{e.preventDefault();drop.classList.remove('over');await localFile(e.dataTransfer.files[0]);});
$('#refresh-shelf').onclick=safe(()=>renderShelf(true));
$('#permissions').onclick=safe(async()=>{const {origins=[]}=await chrome.permissions.getAll();const http=origins.filter(o=>/^https?:/.test(o));if(http.length)await chrome.permissions.remove({origins:http});notify('Granted media hosts have been forgotten. Future URL conversions will ask again.');});
async function init(){const {preferences}=await chrome.storage.local.get('preferences');if(preferences)for(const k of ['bitrate','artist','album'])if(preferences[k])$('#'+k).value=preferences[k];await renderShelf(true);await poll();setInterval(()=>poll().catch(e=>notify(e.message)),1000);}
init().catch(e=>notify(e.message));
initYouTube(send);
