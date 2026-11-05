import {scanPage} from './scanner.js';
import {filename,httpURL,hostPattern} from './common.js';
let creating;
async function hasOffscreen() { return (await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length>0; }
async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  if (!creating) creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA','BLOBS','WORKERS'],justification:'Record tab audio and convert media to MP3 locally.'}).finally(()=>creating=null);
  await creating;
}
async function offscreen(type,data={}) {
  await ensureOffscreen();
  const r=await chrome.runtime.sendMessage({target:'offscreen',type,...data});
  if (!r?.ok) throw new Error(r?.error||'The audio engine did not respond. Reload the extension.');
  return r;
}
chrome.action.onClicked.addListener(async tab=> {
  if (!tab?.id) return;
  if (tab.url?.startsWith(chrome.runtime.getURL(''))) return;
  await chrome.storage.session.set({source:{id:tab.id,title:tab.title||'Selected page',url:tab.url||''}});
  const existing=(await chrome.tabs.query({})).find(t=>t.url===chrome.runtime.getURL('studio.html'));
  if (existing) { await chrome.tabs.update(existing.id,{active:true}); await chrome.windows.update(existing.windowId,{focused:true}); }
  else await chrome.tabs.create({url:'studio.html'});
});
async function scan(tabId) {
  if (!Number.isInteger(tabId)) throw new Error('Open a media page, then click the NEEDLEDROP toolbar icon.');
  const results=await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:scanPage});
  const items=new Map(); let protectedMedia=false,embedded=0;
  for (const {result} of results) if (result) {
    result.items.forEach(i=> {if(!items.has(i.url))items.set(i.url,i);});
    protectedMedia ||= result.protectedMedia; embedded+=result.embedded;
  }
  return {items:[...items.values()],protectedMedia,embedded};
}
async function handle(m) {
  if (m.type==='source') return {source:(await chrome.storage.session.get('source')).source||null};
  if (m.type==='scan') return scan(m.tabId);
  if (m.type==='status') return await hasOffscreen()?offscreen('status'):{state:{phase:'idle',message:'Ready when you are.'}};
  if (m.type==='record') {
    const s=await chrome.tabs.get(m.tabId);
    if (!/^https?:/.test(s.url||'')) throw new Error('Choose a normal website tab to record.');
    const status=await offscreen('status');
    if (status.state.busy) throw new Error('Finish or cancel the current job first.');
    // A MediaKeys object elsewhere on the page does not determine whether
    // Chrome will provide audible tab capture. Let the normal browser API decide.
    const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:m.tabId});
    return offscreen('record',{streamId,tabId:m.tabId,name:s.title,options:m.options});
  }
  if (['convert','pause','resume','stop','cancel'].includes(m.type)) {
    if (m.type==='convert' && m.url) {
      m.url=httpURL(m.url);
      if (!await chrome.permissions.contains({origins:[hostPattern(m.url)]})) throw new Error('Allow access to the media host before converting.');
    }
    return offscreen(m.type,{url:m.url,inputId:m.inputId,assetId:m.assetId,name:m.name,options:m.options});
  }
  if (m.type==='download') {
    const url=httpURL(m.url);
    const id=await chrome.downloads.download({url,filename:filename(m.name),saveAs:true,conflictAction:'uniquify'});
    return {downloadId:id};
  }
  if (m.type==='save') {
    const a=await offscreen('asset-url',{id:m.id});
    try {
      const id=await chrome.downloads.download({url:a.url,filename:a.filename,saveAs:true,conflictAction:'uniquify'});
      const {blobDownloads={}}=await chrome.storage.session.get('blobDownloads'); blobDownloads[id]=a.url;
      await chrome.storage.session.set({blobDownloads}); return {downloadId:id};
    } catch(e) {await offscreen('revoke',{url:a.url}); throw e;}
  }
  throw new Error('Unknown operation.');
}
chrome.downloads.onChanged.addListener(async d=> {
  if(!['complete','interrupted'].includes(d.state?.current))return;
  const {blobDownloads={}}=await chrome.storage.session.get('blobDownloads');
  if(blobDownloads[d.id]) { const url=blobDownloads[d.id]; delete blobDownloads[d.id]; await chrome.storage.session.set({blobDownloads}); if(await hasOffscreen()) await offscreen('revoke',{url}); }
});
chrome.runtime.onMessage.addListener((m,sender,reply)=> {
  if(m.target!=='background') return;
  // Pages and injected scripts cannot issue privileged operations.
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('studio.html')) {reply({ok:false,error:'Untrusted caller.'});return;}
  handle(m).then(r=>reply({...r,ok:true})).catch(e=>reply({ok:false,error:e.message})); return true;
});
