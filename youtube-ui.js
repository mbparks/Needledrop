import {youtubeURL} from './youtube.js';
import {size} from './common.js';

export function initYouTube(send) {
  const $=s=>document.querySelector(s);
  let state={connected:false,busy:false},starting=false,polling=false,signature='';
  const message=$('#youtube-status');
  const showError=e=>{message.textContent=e.message;message.dataset.error='true';};
  function render(next) {
    state=next||state;
    signature=JSON.stringify(state);
    $('#youtube-connection').textContent=state.connected?'HELPER CONNECTED':'ONE-TIME MAC SETUP';
    if(!starting){message.textContent=state.message||'Paste a YouTube link to begin.';message.dataset.error=String(state.phase==='error');}
    $('#youtube-current').textContent=state.currentTitle||'';
    $('#youtube-start').disabled=starting||state.busy;
    $('#youtube-start').textContent=starting?'Connecting…':state.busy?'Working…':'↓ Get MP3';
    for(const id of ['youtube-url','youtube-mode','youtube-quality','youtube-limit'])$('#'+id).disabled=starting||state.busy;
    $('#youtube-cancel').hidden=!state.busy;
    $('#youtube-cancel').disabled=state.phase==='canceling';
    $('#youtube-folder').disabled=!state.connected;
    $('#youtube-output').textContent=state.outputDir||'~/Downloads/NEEDLEDROP';
    const progress=$('#youtube-progress');progress.hidden=!state.busy;
    if(typeof state.progress==='number')progress.value=state.progress;else progress.removeAttribute('value');
    const list=$('#youtube-files');list.replaceChildren();
    for(const file of state.files||[]){const li=document.createElement('li');li.textContent=`${file.name} · ${size(file.bytes)}`;list.append(li);}
    $('#youtube-errors').hidden=!(state.errors?.length||state.detail);
    $('#youtube-error-text').textContent=(state.errors||[]).concat(state.detail||[]).join('\n');
  }
  async function poll(){if(polling||starting)return;polling=true;try{render((await send('native-status')).state);}catch{}finally{polling=false;}}
  async function check() {
    try {const result=await send('native-check');render({...result.state,connected:true});$('#youtube-setup').open=false;}
    catch(e){await poll();$('#youtube-setup').open=true;showError(e);}
  }
  $('#extension-id').value=chrome.runtime.id;
  $('#copy-extension-id').onclick=async()=>{
    const field=$('#extension-id');field.focus();field.select();
    try{await navigator.clipboard.writeText(field.value);$('#copy-extension-id').textContent='Copied';}
    catch{$('#copy-extension-id').textContent='Selected — press ⌘C';}
  };
  $('#youtube-check').onclick=check;
  $('#youtube-example').onclick=()=>{$('#youtube-url').value='https://music.youtube.com/watch?v=gSS2IgnnBo8';$('#youtube-url').focus();};
  $('#youtube-form').onsubmit=async e=>{
    e.preventDefault();if(starting||state.busy)return;
    let selection;
    try{
      selection=youtubeURL($('#youtube-url').value,$('#youtube-mode').value);
      const limit=Number($('#youtube-limit').value);
      if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Choose a playlist limit between 1 and 500.');
      const quality=Number($('#youtube-quality').value);
      starting=true;render(state);message.textContent='Connecting to the Mac helper…';message.dataset.error='false';
      await send('native-check');
      const result=await send('native-start',{url:selection.url,mode:selection.kind,quality,limit});
      starting=false;render({...result.state,connected:true});$('#youtube-setup').open=false;
    }catch(error){starting=false;render(state);if(!state.connected)$('#youtube-setup').open=true;showError(error);}
  };
  $('#youtube-cancel').onclick=async()=>{try{render({...((await send('native-cancel')).state),connected:true});}catch(e){showError(e);}};
  $('#youtube-folder').onclick=async()=>{try{await send('native-folder');}catch(e){showError(e);}};
  // Keep error messages visible until the helper actually changes state.
  setInterval(async()=>{if(polling||starting)return;polling=true;try{const next=(await send('native-status')).state;const key=JSON.stringify(next);if(key!==signature){signature=key;render(next);}}catch{}finally{polling=false;}},1000);
  render(state);void check();
}
