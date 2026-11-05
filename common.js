export const MAX_BYTES = 200 * 1024 * 1024;
export const MAX_SECONDS = 3600;
export function captureWarning(elapsed, lastSignal, hasSignal, phase) {
  if (phase !== 'recording' || elapsed < 10 || elapsed - lastSignal < 10) return '';
  return hasSignal
    ? 'No audio signal for 10 seconds. Check that playback is still running.'
    : 'No audio signal detected. Start playback and check mute controls. Chrome or this service may restrict capture.';
}
export function captureError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return new Error('Chrome did not allow tab capture. Return to the source page, click NEEDLEDROP’s toolbar icon, and try again. Browser or service restrictions may still prevent recording.');
  if (error?.name === 'NotReadableError' || error?.name === 'AbortError') return new Error('Chrome could not provide this tab’s audio. Stop other capture sessions and retry. This playback may not be capturable.');
  return error;
}
export const busy = s => ['starting','fetching','loading','converting','recording','paused','stopping'].includes(s?.phase);
export function filename(value, ext='mp3') {
  let s = String(value || 'Needledrop').normalize('NFC').replace(/\.[a-z0-9]{2,5}$/i, '');
  s = s.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-').replace(/^[.\s]+|[.\s]+$/g, '').slice(0,110);
  if (!s) s = 'Needledrop';
  while (new TextEncoder().encode(s).length > 180) s = [...s].slice(0,-1).join('');
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = '_' + s;
  return `${s}.${ext}`;
}
export function httpURL(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('Use a direct HTTP or HTTPS media link. For blob sources, record the tab.');
  u.hash = '';
  return u.href;
}
export function hostPattern(value) { const u = new URL(httpURL(value)); return `${u.protocol}//${u.hostname}/*`; }
export function settings(value={}) {
  const bitrate = Number(value.bitrate || 192);
  if (![128,192,256,320].includes(bitrate)) throw new Error('Choose 128, 192, 256, or 320 kbps.');
  const start = Number(value.start || 0), end = value.end === '' || value.end == null ? null : Number(value.end);
  if (!Number.isFinite(start) || start < 0 || (end !== null && (!Number.isFinite(end) || end <= start))) throw new Error('End time must be greater than start time. Use seconds.');
  return {bitrate, start, end, title:String(value.title || '').slice(0,200), artist:String(value.artist || '').slice(0,200), album:String(value.album || '').slice(0,200)};
}
export function mp3Args(input, output, opts) {
  const o = settings(opts);
  const args = ['-hide_banner','-protocol_whitelist','file,pipe','-i',input];
  if (o.start) args.push('-ss',String(o.start));
  if (o.end !== null) args.push('-t',String(o.end - o.start));
  args.push('-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1','-c:a','libmp3lame','-b:a',`${o.bitrate}k`,'-ar','44100','-ac','2','-id3v2_version','3');
  for (const k of ['title','artist','album']) if (o[k]) args.push('-metadata',`${k}=${o[k]}`);
  args.push('-y',output);
  return args;
}
export const size = b => b >= 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.ceil(b/1024)} KB`;
export const clock = seconds => { const s=Math.floor(seconds||0); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
