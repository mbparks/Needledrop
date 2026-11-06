#!/bin/bash
set -euo pipefail
printf '\nNEEDLEDROP — update YouTube downloader\nClose Chrome before updating.\n\n'
brew_cmd="$(command -v brew || true)"
if [ -z "$brew_cmd" ] && [ -x /opt/homebrew/bin/brew ]; then brew_cmd=/opt/homebrew/bin/brew; fi
if [ -z "$brew_cmd" ] && [ -x /usr/local/bin/brew ]; then brew_cmd=/usr/local/bin/brew; fi
if [ -z "$brew_cmd" ]; then printf 'Homebrew is missing. Run Install-Mac.command first.\n'; exit 1; fi
"$brew_cmd" update
"$brew_cmd" upgrade yt-dlp ffmpeg deno python
brew_prefix="$("$brew_cmd" --prefix)"
config="$HOME/Library/Application Support/NEEDLEDROP/host-config.json"
if [ -f "$config" ]; then
  extension_id="$("$brew_prefix/bin/python3" -c 'import json,sys;print(json.load(open(sys.argv[1]))["extension_id"])' "$config")"
  "$brew_prefix/bin/python3" "$(dirname -- "$0")/native/install.py" "$extension_id" --prefix "$brew_prefix"
fi
printf '\nUpdated. Reopen Chrome and check the connection in NEEDLEDROP.\n'
read -r -p 'Press Return to close. ' answer
