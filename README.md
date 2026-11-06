# NEEDLEDROP · Green Shoe Garage

**1.1.0-rc.1 — paste a YouTube video or playlist link and save MP3s.**

The main screen accepts YouTube, YouTube Music, youtu.be, Shorts, and playlist links. A small local Mac helper uses yt-dlp and FFmpeg to download and convert audio, then saves the MP3s directly to `~/Downloads/NEEDLEDROP`. No NEEDLEDROP account or conversion server.

## Install or update the extension

1. Unzip into a permanent folder. Keep its contents together.
2. Open `chrome://extensions` in desktop Google Chrome 116+.
3. Turn on **Developer mode**, choose **Load unpacked**, and select **NEEDLEDROP**, the folder directly containing `manifest.json`.
4. Pin the extension through Chrome’s puzzle-piece menu, then click its toolbar icon.

If Chrome reports a missing manifest, select the folder that actually contains `manifest.json`, not the ZIP or its parent. There is no inner `extension` directory in this package.

**Updating:** finish active jobs, copy the new package’s contents into the folder Chrome already loads, replacing matching files, then click **Reload** and reopen NEEDLEDROP. Keep the same installed extension to preserve its ID and tape shelf. An older RC1 installation may load `~/Desktop/NEEDLEDROP/extension`; copy the new contents into that existing folder. Accept the native messaging permission if Chrome asks.

## One-time YouTube setup on a Mac

The YouTube workflow requires the included native helper; loading the extension alone does not install it.

1. In NEEDLEDROP, expand **One-time Mac setup**, then **Copy ID**.
2. Double-click **Install-Mac.command** in the extracted folder. Paste the copied ID at the prompt.
3. The installer uses [Homebrew](https://brew.sh) to install Python, yt-dlp, FFmpeg and Deno. If Homebrew is missing, install it from its official site first, then rerun this installer. Initial dependency installation can take several minutes.
4. Return to NEEDLEDROP and click **Check connection**. The screen should say **HELPER CONNECTED**.

If macOS will not open the script, open Terminal, type `bash` followed by a space, drag `Install-Mac.command` into that window, and press Return. The script remains visible and inspectable; no administrator password is needed for NEEDLEDROP’s own helper registration. Homebrew’s initial installation may have its own requirements.

This helper installer supports **macOS + Google Chrome**. Page scanning, local conversion and recording remain available in desktop Chrome on other systems, but this release does not include Windows/Linux native-host installers.

## Paste and download

1. Paste a link, for example `https://music.youtube.com/watch?v=gSS2IgnnBo8`.
2. Leave **Detect from link** selected, choose quality if desired, and click **Get MP3**.
3. Watch progress and use **Open folder** when finished. Copy the MP3s to your player using its normal file-transfer or sync method.

| Link or setting | Result |
| --- | --- |
| Video or YouTube Music track | One MP3 |
| Playlist URL | Separate, numbered MP3s in playlist order |
| Video URL that also contains `list=` | One video by default; choose **Full playlist** to download the playlist |
| Playlist limit | First 100 entries by default; adjustable from 1 to 500 |
| Quality | 128, 192, 256 or 320 kbps; default 192 kbps |
| MP3 format | 44.1 kHz stereo, ID3v2.3 metadata from the source when available |
| Cancel | Stops the job and keeps completed MP3s |
| Unavailable playlist entry | Reports an error and continues where yt-dlp can continue |

Each job gets a dated subfolder inside `~/Downloads/NEEDLEDROP`, plus a `NEEDLEDROP-job.json` receipt. Tracks include their video ID in the filename. Higher bitrates do not improve the original source quality. The native downloader’s settings are separate from the optional trim/title controls in More tools.

One YouTube job runs at a time. Keep Chrome running. Closing only the workbench is designed to let the job continue through the service worker’s native port, but real Mac browser acceptance of that behavior remains outstanding. Quitting Chrome, reloading the extension or disconnecting the helper ends the active job; completed files remain on disk. There is a two-hour job timeout. A playlist cap counts entries inspected, so unavailable entries can yield fewer MP3s than the cap. Radio/mix playlists can change; the cap prevents an unbounded download.

## Maintenance and troubleshooting

- **Helper not connected:** run Install-Mac.command with the current extension ID, then Check connection. Reinstalling the extension or moving its unpacked directory may change its ID.
- **Downloads start failing after a YouTube change:** close Chrome, run **Update-Mac.command**, reopen Chrome and check the connection. It updates the local tools and refreshes helper registration.
- **Sign-in, region or unavailable errors:** inspect Download details. This version does not import browser cookies or support an account login. Public links can also be subject to YouTube availability or network restrictions.
- **Protected media:** this is not a DRM decrypter. Paid/licensed streams and other restricted items are not guaranteed to work. Use material you own or have permission to save.
- **Dependency missing:** rerun the installer. It checks yt-dlp, FFmpeg/ffprobe and Deno paths.
- **Managed Chrome:** enterprise policy may block unpacked extensions or native messaging; installation requires a profile where those features are permitted.
- **No file found:** open the job folder. Native YouTube downloads go directly to disk; they do not appear in the extension’s separate local tape shelf.

To remove the helper, quit Chrome and remove `~/Library/Application Support/NEEDLEDROP` and `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.greenshoegarage.needledrop.json`. This does not delete downloaded MP3s or shared Homebrew tools.

## More tools

Expand **More tools: page scanning, local files & tab recording** for the original workbench:

- Scan a page for direct MP3, audio and video links. Direct MP3s save unchanged through Chrome.
- Drop a local video/audio file, or paste a direct media-file URL, to convert it with bundled FFmpeg WebAssembly.
- Record the selected tab in real time, with pause/resume, a level meter and a silence warning.
- Preview and save finished local conversions/recordings from **Your tape shelf**.

Local file conversion is limited to 200 MiB and a five-minute processing timeout. Recording is limited to 60 minutes and 200 MiB of compressed input. It captures the selected tab, not your microphone. Streaming/blob sources found by page scanning use recording; the native YouTube downloader handles supported YouTube links separately.

Protected-media detection is advisory for ordinary Chrome tab capture. Chrome or the service may refuse capture or provide silence; the extension cannot guarantee audible output. Preview recordings before keeping them. Browser shutdown can lose unfinished recordings, and uninstalling deletes the extension-local tape shelf. Download keepers first.

## Verification

This is a **release candidate**. Automated JS and Python checks passed. The real yt-dlp/FFmpeg pipeline was run against a generated local MP4 fixture; ffprobe verified a 192 kbps MP3, 44.1 kHz stereo, and ID3v2.3 tags. The bundled browser encoder also passed real MP4/WebM conversion checks.

**Not yet verified:** live macOS Chrome installation, native messaging in Chrome, and a successful download of the supplied YouTube URL. The test environment blocked unpacked extensions, and the attempted YouTube request failed certificate validation. Local and simulated checks are not presented as live website acceptance. See TEST-REPORT.md.

## Development

Extension source and manifest are at the package root; native helper source is in `native/`.

```sh
npm ci
npm test
npm run build
```

Development checks use Node.js 22+, Python 3.11+, and FFmpeg/ffprobe. Tests use synthetic tones; the Python helper tests use a controlled subprocess, with separate real yt-dlp conversion verification. The extension is prebuilt; normal use requires no npm or build step.

Original code: GPL-2.0-or-later. See THIRD-PARTY-NOTICES.md and licenses/. yt-dlp, FFmpeg, Deno and Python are installed independently through Homebrew and retain their own licenses.

Make. Hack. Learn. Share. Love. Repeat.
