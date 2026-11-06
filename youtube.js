const HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be']);
export function youtubeURL(value,mode='auto') {
  let u;try{u=new URL(String(value).trim());}catch{throw new Error('Paste a full YouTube video or playlist link.');}
  if(!['https:','http:'].includes(u.protocol)||!HOSTS.has(u.hostname)||u.username||u.password||u.port)throw new Error('Use a youtube.com, music.youtube.com, or youtu.be link.');
  if(!['auto','video','playlist'].includes(mode))throw new Error('Choose a video or playlist.');
  let video=u.searchParams.get('v');const playlist=u.searchParams.get('list');
  if(u.hostname.endsWith('youtu.be'))video=u.pathname.split('/')[1];
  else if(/^\/(shorts|live|embed)\//.test(u.pathname))video=u.pathname.split('/')[2];
  if(video&&!/^[A-Za-z0-9_-]{11}$/.test(video))throw new Error('The video ID in this link is invalid.');
  if(playlist&&!/^[A-Za-z0-9_-]{10,150}$/.test(playlist))throw new Error('The playlist ID in this link is invalid.');
  const kind=mode==='playlist'||(mode==='auto'&&!video&&playlist)?'playlist':'video';
  if(kind==='playlist'&&!playlist)throw new Error('This link does not contain a playlist.');
  if(kind==='video'&&!video)throw new Error('This link does not contain a video. Choose Full playlist.');
  return {kind,url:kind==='playlist'?`https://www.youtube.com/playlist?list=${playlist}`:`https://www.youtube.com/watch?v=${video}`,hasPlaylist:Boolean(playlist)};
}
