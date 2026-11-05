# NEEDLEDROP 1.0.0-rc.2 validation

Date: November 5, 2026.

RC2 result: all 17 automated tests passed. Live protected-site capture is
not claimed or verified. The browser's own capture decision is preserved.

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
