# NEEDLEDROP privacy

NEEDLEDROP has no backend, analytics, telemetry, advertising or account system. No audio or video is uploaded for conversion. Its encoder is bundled locally.

The extension reads media references only when opened for a page or when Scan page is selected. It can request the specific media host needed for a conversion. That host receives ordinary network requests, and normal browser credentials may accompany the request. Direct downloads go through Chrome’s download manager.

Tab capture begins only after Record tab is selected. It captures the selected tab’s audio, not the microphone. Chrome provides its own capture indicator. The workbench displays recording state, duration and controls.

Completed files remain in this extension’s IndexedDB storage until removed. Source-tab selection is held in session storage. Quality, artist and album preferences can be held in local extension storage. Chrome’s Downloads records downloads normally. Uninstalling removes extension-local data, but not downloaded files.

Permissions: activeTab and scripting read the selected page on invocation; tabCapture captures its audio; offscreen supports background recording/conversion; downloads saves chosen files; storage keeps source selection and preferences. Optional host permissions allow fetching media only from hosts you grant. No permanent blanket website access is requested on installation.
