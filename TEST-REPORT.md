# NEEDLEDROP 1.1.0-rc.1 validation

Date: November 5, 2026.

## Current results

- **22 JavaScript checks passed** (17 existing checks plus 5 YouTube/native checks).
- **8 Python checks passed** against the native helper and installer.
- Real yt-dlp argument parsing accepted the generated video command and postprocessor settings.
- Real yt-dlp + system FFmpeg converted the generated `tests/tone.mp4` fixture through the native host command and output parser. For this local test only, the source was replaced by a fixture file URL and the file-URL test option was enabled. Production helper input accepts YouTube hosts only.
- Independent ffprobe inspection: MP3 codec, two channels, 44,100 Hz, 192,000 bits/sec, title metadata. File bytes confirmed ID3 version 2.3.
- Existing bundled WebAssembly conversion checks passed using MP4/AAC and WebM/Opus fixtures.

## New coverage

1. Normalize YouTube Music, watch, share and Shorts links; strip tracking parameters; distinguish a single video from an explicit playlist.
2. Reject unrelated hosts, credential-bearing URLs, invalid IDs, unsupported bitrate and out-of-range playlist limits.
3. Submit the exact canonical URL/mode/quality/limit from the UI, prevent a second job while busy, expose cancellation and render hostile output titles as text.
4. Display missing-helper setup with a retry path.
5. Match native responses by request ID, reuse the port, retain state events and reconnect after disconnect.
6. Read length-prefixed JSON through fragmented reads; reject oversized, truncated and non-object messages.
7. Run controlled real child processes to verify success, partial failures, progress, job receipts, concurrent-job rejection and retained completed files after cancellation.
8. Kill and reap the child when parsing fails; allow a subsequent job after cancellation.
9. Generate a launcher and Chrome native-host manifest in paths with spaces; verify the single allowed extension origin. Run the generated launcher and exchange a real framed ping message, and reject a different caller origin.

The controlled downloader used for lifecycle tests writes small placeholder files; these tests establish lifecycle behavior, not media validity. The separate real yt-dlp/FFmpeg and WebAssembly checks establish media conversion validity.

## Remaining acceptance checks

The supplied live URL `https://music.youtube.com/watch?v=gSS2IgnnBo8` was attempted with yt-dlp. The connection failed TLS certificate validation in this environment. Certificate verification was not disabled. No claim is made that this particular video was downloaded.

This environment also blocks unpacked Chrome extensions by policy. Live macOS installation, Chrome-to-helper native messaging, workbench-closure continuity and YouTube playlist downloading therefore remain unverified.

On the target Mac:

1. Load the folder directly containing manifest.json; confirm Chrome reports no extension errors.
2. Open NEEDLEDROP, copy its extension ID and run Install-Mac.command; Check connection must report HELPER CONNECTED.
3. Paste the supplied video URL, click Get MP3, open the result folder and play the MP3.
4. Try a public playlist with a limit of 2. Confirm separate numbered MP3s in source order and useful details for unavailable entries.
5. Start another playlist, cancel after one completed track, and verify that the completed file remains.
6. Close and reopen only the workbench while a job is active, keeping Chrome running; confirm state and progress continue.
7. Restart Chrome, check the helper connection, then start another download. Previous files remain on disk; current-job UI history is session-only.

No broad claim of support for every YouTube item, DRM media or login-required content is made.

## Previous workbench coverage

## Automated checks

The test suite exercises the shipped application code and bundled WebAssembly encoder. Audio fixtures are three-second generated tones in MP4/AAC and WebM/Opus containers.

1. Sanitize filenames for portable downloads without directory traversal.
2. Accept only HTTP(S) network sources and reject embedded credentials, script URLs and file/blob URLs for direct conversion.
3. Validate bitrate and trimming limits.
4. Build audio-only MP3 conversion commands with explicit codec, sample rate and metadata.
5. Discover and deduplicate sources across DOM elements, open shadow roots and resource history; classify streams and video.
6. Flag encrypted-media elements and cap results from untrusted pages.
7. Persist audio blobs, expose shelf metadata and remove only the requested item.
8. Run the bundled encoder on MP4 and WebM. Independently verify the outputs with ffprobe: MP3 audio, two channels, 44,100 samples/second, 192,000 bits/second, 1.5-second trim within MP3 framing tolerance, and title metadata.
9. Run the real offscreen controller and bundled FFmpeg worker with a Node.js Web Worker adapter; verify file conversion, concurrent-job rejection and recording conversion.
10. Test recording pause, resume, stop and resource cleanup with a synthetic MediaRecorder/MediaStream. This is not a test of Chrome’s tabCapture permission path.
11. Cancel a take and immediately start another; verify the old recording callback cannot stop the new take or add a discarded file.
12. Reject malformed media and recover to an actionable error state.
13. Render hostile media titles as text, not HTML, and check that the download action uses the exact selected source.
14. Confirm a page flagged by protected-media diagnostics can still invoke the standard browser capture API.
15. Confirm Chrome's capture rejection is propagated and untrusted webpage callers remain unable to invoke recording.
16. Check the no-signal warning for initial silence, a later quiet period, pause and resumed signal.
17. Confirm a take with no measured signal retains an explicit preview warning alongside its resulting MP3.

The implementation also passes JavaScript syntax checks and package/manifest file validation.

## Environment limitation

An attempted installation in the available Chromium browser was rejected by its policy: **Extension installation is blocked by policy.** A standalone automated browser launch was also unavailable in the execution environment. These restrictions were not changed or bypassed.

Consequently, real Chrome installation, live tab capture, optional-host permission prompts, native download dialogs, and background survival across workbench closure still require the following acceptance procedure. Synthetic API tests are not represented as browser acceptance.

## Manual browser acceptance

1. Load the root `NEEDLEDROP/` folder through `chrome://extensions`. Confirm no extension errors are reported.
2. Open an ordinary media page, invoke NEEDLEDROP and scan. Verify a direct MP3 can be saved and played.
3. Drop the supplied `tests/tone.mp4` into the workbench. Save the resulting MP3 and listen for a steady tone.
4. Play a permitted web video, invoke the toolbar icon and choose Record tab. Confirm playback remains audible and the level meter moves.
5. Pause/resume the take. Close the workbench while keeping Chrome and the source tab open. Reopen via the toolbar icon and stop the take. Save and play the MP3.
6. Cancel a new take; confirm no file was added. Try converting the malformed test text or a video without audio; confirm an intelligible error appears.
7. Grant a media host for a direct-link conversion. Use Forget granted media hosts and verify the next conversion asks again.
8. Restart Chrome after a successful conversion. Reopen NEEDLEDROP and confirm completed shelf tracks remain.
9. On a permitted playback page using protected-media APIs, try Record tab. Check whether Chrome allows capture and whether the meter responds. If no sound is supplied, verify the warning after 10 seconds; do not interpret a completed MP3 file as proof of captured audio.

No broad third-party website compatibility claim has been made.
