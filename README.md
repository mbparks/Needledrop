# NEEDLEDROP · Green Shoe Garage

**Version 1.0.0-rc.2 — a Chrome extension for making a pocket-sized music collection.**

Find media on a page, save original MPEG Audio Layer III (MP3) files, extract audio from video, or record the sound playing in a selected tab. The converter and all processing run on your computer.

## Install on your Mac or PC

1. Unzip this package into a permanent folder. Keep the whole folder together.
2. In desktop Google Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** in the upper-right corner.
4. Click **Load unpacked**, then select the unzipped **NEEDLEDROP** folder itself. `manifest.json` is now directly inside it.
5. Open the puzzle-piece Extensions menu and pin **NEEDLEDROP**.
6. Visit a media page and click the NEEDLEDROP record icon. Its workbench opens in another tab.

Requires desktop Chrome 116 or newer. No Node.js, build step, account, paid service or web server is needed to use the supplied extension. Managed browsers may block unpacked extensions; use a browser/profile where your administrator permits extension development.

### Update an existing installation

To retain your tape shelf, copy the **contents** of the new NEEDLEDROP folder into the folder Chrome already loads, replacing matching files. For an installation made from the first package, that is typically `~/Desktop/NEEDLEDROP/extension`. Then click the extension's **Reload** button at `chrome://extensions` and reopen its workbench. Finish and save any active take before reloading. Do not remove the installed extension just to update it; removal deletes its local shelf.

For a fresh installation, the new package needs only its top-level NEEDLEDROP folder. It no longer has an inner extension folder.

## Use it

| Task | Steps |
| --- | --- |
| Find page media | Click the icon on the source page. Play the media once, then click **Scan page**. |
| Download an existing MP3 | Click **Save MP3** beside a result. The original file is downloaded without re-encoding. |
| Extract audio from video | Click **Make MP3** beside a file result, or drop a local video into **Bring your own**. |
| Convert a direct media link | Paste the media file’s Uniform Resource Locator (URL), then choose **Make MP3**. Allow the requested media host if prompted. |
| Record a player or stream | Start playback, click **Record tab**, then **Stop & make MP3** when finished. Pause/resume is available. |
| Get the finished file | Preview the track on **Your tape shelf**, then click **Save MP3**. Check Chrome’s Downloads for completion. |
| Switch source pages | Click the extension icon while on the new source page. An ongoing take continues recording its original tab. |
| Forget permissions | Expand **How it works & what to expect**, then click **Forget granted media hosts**. |

For a typical older player: use the default **192 kbps** (kilobits per second), save the MP3, connect the player over Universal Serial Bus (USB), and copy the file to its Music folder. Some players, including older iPods, require their own synchronization software.

## What is included

- Page scanning: audio/video elements, source tags, direct links, Open Graph media metadata, open shadow roots and recognizable media URLs in the page’s resource history. Results are deduplicated.
- Scan accessible frames on the selected page. Cross-origin frames can remain inaccessible.
- Original MP3 downloads with Chrome’s Save As dialog.
- Local FFmpeg WebAssembly conversion of common video/audio containers, including tested MP4/AAC and WebM/Opus inputs.
- The first audio track is used; video is discarded.
- Constant bitrate MP3 at 128, 192, 256 or 320 kbps; 44.1 kilohertz (kHz), stereo, ID3 version 2.3 tags.
- Optional title, artist and album; trim file conversions using start/end seconds.
- Tab recording with an elapsed timer, level meter, pause, resume, stop and discard.
- Protected-media detection is advisory: it no longer prevents an attempt using Chrome’s standard audio capture. There is no decryption or protection bypass.
- A warning appears after 10 seconds without an audio signal. A silent take is flagged for preview; silence can mean paused/muted playback, a quiet passage, or capture restrictions. The warning is not a DRM diagnosis.
- Background processing: closing the workbench does not intentionally stop a job. Keep Chrome running and the source tab open while recording.
- Persistent local shelf, preview player, explicit download and per-item removal.
- If a finished tab recording fails to convert, its WebM backup remains on the shelf for saving or retrying.

## Limits and honest expectations

“Any video source” cannot be guaranteed by a Chrome extension. Digital Rights Management (DRM), browser restrictions, private players and server access rules can prevent downloading or capture. NEEDLEDROP does not remove protection, decrypt streams or bypass logins/paywalls. Use material you own or have permission to save.

- **Direct file conversions:** at most 200 mebibytes (MiB), shown as 200 MB in the interface. Large inputs can still exceed browser memory. Conversion has a five-minute processing timeout.
- **Recording:** at most 60 minutes per take and 200 MiB of compressed input. It runs in real time and records all audible sounds from the selected tab, including ads or notifications from that tab. It does not record your microphone or other tabs.
- **Streams:** HTTP Live Streaming (HLS), Dynamic Adaptive Streaming over HTTP (DASH), and Media Source Extensions (MSE) blob sources use tab recording; this release does not assemble streaming segments.
- **Network conversion:** host permission is requested for the chosen source host. Redirects are refused; supply the final media URL or use recording/local files. Credentials already available to the browser may be used by the host, but no authentication is bypassed.
- **Browser pages:** Chrome settings, the Web Store and other restricted pages cannot be scanned or recorded.
- **Local files:** use the drop zone. Scanning `file://` pages is not supported.
- **Durability:** completed files survive normal restarts in extension storage. Active recordings are held in memory until stopped. Browser shutdown, crash or extension reload can lose an unfinished take. Download keepers before uninstalling or clearing extension storage.
- **One conversion or recording at a time.** Original MP3 downloads are independent.
- Trimming and re-encoding do not improve the quality of the source.

## Verification status

This is a release candidate. The bundled converter was executed and its MP3 output independently inspected. Automated checks cover discovery, validation, storage, interface wiring, the actual encoder worker, recording state transitions with synthetic media, cancellation and error recovery.

**Live installation and tab-capture acceptance remain unverified:** the available Chromium test environment blocks unpacked extension installation by policy. No claim of live browser recording acceptance is made. See `TEST-REPORT.md` for exact coverage and a short installation acceptance procedure.

## Source and development

The editable extension source and `manifest.json` are at the package root; tests are in `tests/`.

```sh
npm ci
npm test
npm run build
```

Node.js 22+ is recommended for development. Encoder tests also use local `ffprobe` from FFmpeg to independently check output. Test fixtures are generated tones, not commercial media. `npm run build` refreshes pinned bundled encoder files; it makes no application network requests at runtime.

Original NEEDLEDROP code is provided under the GNU General Public License (GPL), version 2 or later. Third-party components retain their own notices and licenses. See `THIRD-PARTY-NOTICES.md` and `licenses/`.

Make. Hack. Learn. Share. Love. Repeat.
