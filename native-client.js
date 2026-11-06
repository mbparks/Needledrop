const HOST='com.greenshoegarage.needledrop';
let port=null,cache={connected:false,phase:'setup',busy:false,message:'Check the helper connection, or complete the one-time Mac setup.'};
const pending=new Map();
function connect() {
  if(port)return;
  const current=chrome.runtime.connectNative(HOST);port=current;
  current.onMessage.addListener(m=>{
    if(m.type==='event'&&m.state)cache={...m.state,connected:true};
    if(m.type==='response') {
      if(m.state)cache={...m.state,connected:true};
      const entry=pending.get(m.requestId);if(!entry)return;clearTimeout(entry.timer);pending.delete(m.requestId);
      if(m.ok)entry.resolve(m);else entry.reject(new Error(m.error||'The local helper could not complete the request.'));
    }
  });
  current.onDisconnect.addListener(()=>{
    const reason=chrome.runtime.lastError?.message||'Helper disconnected.';
    if(port!==current)return;port=null;
    cache={...cache,connected:false,busy:false,phase:cache.busy?'error':'setup',message:cache.busy?'The helper disconnected. Completed MP3s remain in Downloads/NEEDLEDROP. Reconnect before retrying.':'The Mac helper is not connected. Complete setup, then click Check connection.',detail:reason};
    for(const e of pending.values()){clearTimeout(e.timer);e.reject(new Error(cache.message));}pending.clear();
  });
}
export function nativeStatus(){return cache;}
export function nativeRequest(action,data={}) {
  return new Promise((resolve,reject)=>{
    try {
      connect();const requestId=crypto.randomUUID();
      const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('The helper did not reply. Run the setup again and check the connection.'));},15000);
      pending.set(requestId,{resolve,reject,timer});
      try{port.postMessage({action,requestId,...data});}catch(e){clearTimeout(timer);pending.delete(requestId);reject(e);}
    }catch(e){reject(e);}
  });
}
