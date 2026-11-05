let opened;
function db() {
  return opened ||= new Promise((resolve,reject) => {
    const r=indexedDB.open('needledrop',1);
    r.onupgradeneeded=()=> {r.result.createObjectStore('assets',{keyPath:'id'}); r.result.createObjectStore('inputs',{keyPath:'id'});};
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function run(store, mode, operation) {
  const d=await db();
  return new Promise((resolve,reject)=> {
    const t=d.transaction(store,mode); const r=operation(t.objectStore(store));
    t.oncomplete=()=>resolve(r.result); t.onerror=()=>reject(t.error); t.onabort=()=>reject(t.error||new Error('Storage operation canceled.'));
  });
}
export const put=(store,value)=>run(store,'readwrite',s=>s.put(value));
export const get=(store,id)=>run(store,'readonly',s=>s.get(id));
export const remove=(store,id)=>run(store,'readwrite',s=>s.delete(id));
export const all=store=>run(store,'readonly',s=>s.getAll());
export async function assetList() { return (await all('assets')).map(({blob,...rest})=>rest).sort((a,b)=>b.created-a.created); }
