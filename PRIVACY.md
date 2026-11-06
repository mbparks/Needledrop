# NEEDLEDROP privacy

No NEEDLEDROP backend, account, analytics, advertising or remote conversion is used.

**YouTube downloads:** after you click Get MP3, the local helper runs yt-dlp and FFmpeg. yt-dlp connects to YouTube and its media servers; those services receive ordinary download requests and your network address. No browser cookies or passwords are read or copied. The helper ignores external yt-dlp configuration and plugin directories. Homebrew contacts its package sources when you run the installer or updater; those tools have their own policies.

The helper uses Chrome native messaging, with no web server or listening network port. Registration permits only the extension ID you provide. The extension accepts privileged requests only from its own workbench. The helper accepts fixed operations and validated YouTube URLs, and executes the downloader as an argument list without a shell.

Completed MP3s and a job receipt containing filenames, errors and output location are saved under ~/Downloads/NEEDLEDROP. The receipt may include source identifiers in error text. Helper configuration contains tool locations, output folder and extension ID under ~/Library/Application Support/NEEDLEDROP. Uninstalling the extension does not remove these files.

**More tools:** page scanning reads media references on request. Direct media conversion asks permission for its source host; normal browser credentials may accompany that request. Local files and tab recordings are converted using bundled WebAssembly in Chrome. No media is uploaded for conversion. Direct downloads use Chrome’s Downloads.

Tab capture starts only when selected, captures the selected tab’s audio rather than the microphone, and uses Chrome’s capture indicator. Completed browser conversions remain in extension IndexedDB until removed; source selection uses session storage and preferences use extension-local storage. Uninstalling deletes that local shelf but not files already downloaded.

Permissions: activeTab and scripting access the selected page; tabCapture and offscreen support recording/conversion; downloads saves selected files; storage holds state/preferences; nativeMessaging connects to the installed Mac helper. Optional host permissions allow direct conversion only from granted hosts. No blanket website permission is requested at installation.
