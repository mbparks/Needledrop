// This self-contained function executes only after an explicit scan.
export function scanPage() {
  const found=new Map(); let protectedMedia=false, embedded=0;
  const mediaExt=/\.(mp3|mp4|m4a|webm|ogg|oga|wav|flac|aac|mov|m4v|mkv|m3u8|mpd)(?:$|[?#])/i;
  function add(raw,label,mime='',kind='') {
    if (!raw || found.size>=300) return;
    try {
      const u=new URL(raw,document.baseURI);
      if (!['http:','https:','blob:'].includes(u.protocol)) return;
      u.hash=''; const ext=u.href.match(mediaExt)?.[1]?.toLowerCase();
      const stream=['m3u8','mpd'].includes(ext)||/mpegurl|dash\+xml/.test(mime)||u.protocol==='blob:';
      const type=stream?'stream':ext==='mp3'||/audio\/(mpeg|mp3)/.test(mime)?'mp3':kind||(/video/.test(mime)||['mp4','webm','mov','m4v','mkv'].includes(ext)?'video':'audio');
      let name=label?.trim();
      if (!name) {try {name=decodeURIComponent(u.pathname.split('/').pop());}catch{} }
      if (!found.has(u.href)) found.set(u.href,{url:u.href,title:(name||document.title||'Untitled media').slice(0,200),type,mime,frame:location.origin});
    } catch {}
  }
  function walk(root) {
    for (const el of root.querySelectorAll('audio,video')) {
      protectedMedia ||= Boolean(el.mediaKeys);
      const label=el.getAttribute('title')||el.getAttribute('aria-label')||'';
      add(el.currentSrc||el.src,label,el.getAttribute('type')||'',el.localName);
      for (const s of el.querySelectorAll('source')) add(s.src,label,s.type,el.localName);
    }
    for (const a of root.querySelectorAll('a[href]')) if (mediaExt.test(a.href)||/^audio\/|^video\//.test(a.type)) add(a.href,a.textContent,a.type);
    for (const m of root.querySelectorAll('meta[property^="og:audio"],meta[property^="og:video"]')) if (!/:type$|:width$|:height$/.test(m.getAttribute('property'))) add(m.content,document.title,'',m.getAttribute('property').includes('video')?'video':'audio');
    for (const frame of root.querySelectorAll('iframe')) {try {if(new URL(frame.src,location.href).origin!==location.origin) embedded++;}catch{}}
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
  }
  walk(document);
  for (const r of performance.getEntriesByType('resource')) if (mediaExt.test(r.name)) add(r.name,'');
  return {items:[...found.values()],protectedMedia,embedded};
}
