# 1.1.0-rc.1 — November 5, 2026

- Make pasted YouTube video, YouTube Music and playlist links the primary workflow.
- Add a per-user Mac native messaging helper powered by yt-dlp and FFmpeg, with Deno for current YouTube extraction support.
- Save individual MP3s directly into dated folders in Downloads/NEEDLEDROP, with quality selection, playlist ordering and a configurable cap.
- Show track progress, completed files, partial failures and output location; support cancellation and opening the result folder.
- Include one-time installer, updater, extension-ID copy control and connection diagnostics.
- Retain page scanning, local conversion, recording and the tape shelf under More tools.
- Add URL, native bridge, protocol, subprocess, installer and UI tests. Real local yt-dlp/FFmpeg conversion verified; live YouTube and Mac Chrome acceptance remain outstanding.

# NEEDLEDROP changes

## 1.0.0-rc.2

- Removed the blanket recording rejection triggered by MediaKeys on any player in the page. Protected-media detection is informational; the normal Chrome tab capture API decides what audio can be supplied.
- Added a no-signal warning after 10 seconds and a persistent preview warning for takes with no detected audio.
- Added actionable browser-capture errors and a 20-second startup timeout with cleanup of a stream that arrives late.
- Moved manifest.json and runtime files to the top-level NEEDLEDROP folder for simpler fresh installation.
- Included update instructions that preserve an existing local tape shelf.
- All 17 automated tests pass. Live Chrome capture, including protected playback, remains unverified in this environment.

No encryption handling, key extraction or access-control bypass was added.
