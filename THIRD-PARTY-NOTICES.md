# Third-party components

The extension ships pinned, unmodified encoder runtime files. It does not load executable code from a content delivery network.

| Component | Version | License | Upstream source |
| --- | --- | --- | --- |
| @ffmpeg/ffmpeg browser wrapper | 0.12.15 | MIT | https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/ffmpeg |
| @ffmpeg/core single-thread WebAssembly runtime | 0.12.10 | GPL-2.0-or-later | https://github.com/ffmpegwasm/ffmpeg.wasm |
| FFmpeg inside the core | n5.1.4 upstream build configuration | GPL-2.0-or-later in this enabled-GPL build | https://github.com/FFmpeg/FFmpeg/tree/n5.1.4 |

The core includes LAME for MP3 encoding and other audio/video dependencies. The upstream build recipe and dependency source references are reproduced in `licenses/ffmpeg-build-Dockerfile.txt`; upstream build scripts are at https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/build. The recipe is an upstream reference, not a claim that this project rebuilt the distributed core byte-for-byte. The runtime binaries are copied from the exact npm packages locked in package-lock.json.

License texts are in `licenses/`. Original NEEDLEDROP code is licensed under GPL version 2 or later; this does not replace third-party copyright notices or licenses. The wrapper's MIT copyright notice is preserved in `licenses/ffmpeg-wasm-MIT.txt`.

Development-only dependencies (not loaded by the extension): jsdom 26.1.0 (MIT) and fake-indexeddb 6.0.1 (Apache-2.0), plus their dependencies installed through npm. Their own packages carry their notices. Test fixtures are synthetic tones generated for this project.

Technical references:
- https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
- https://developer.chrome.com/docs/extensions/reference/api/offscreen
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- https://ffmpegwasm.netlify.app/docs/getting-started/usage/
