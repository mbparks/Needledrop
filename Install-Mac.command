#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
printf '\nNEEDLEDROP — one-time YouTube helper setup\n\n'
printf 'This installs Python, yt-dlp, FFmpeg and Deno using Homebrew,\n'
printf 'then connects the helper to your NEEDLEDROP extension only.\n'
printf 'MP3 files will be saved in ~/Downloads/NEEDLEDROP.\n\n'
if [ "$(uname -s)" != "Darwin" ]; then
  printf 'This installer is for macOS.\n'; exit 1
fi
brew_cmd="$(command -v brew || true)"
if [ -z "$brew_cmd" ] && [ -x /opt/homebrew/bin/brew ]; then brew_cmd=/opt/homebrew/bin/brew; fi
if [ -z "$brew_cmd" ] && [ -x /usr/local/bin/brew ]; then brew_cmd=/usr/local/bin/brew; fi
if [ -z "$brew_cmd" ]; then
  printf 'Install Homebrew from https://brew.sh, then run this setup again.\n'
  read -r -p 'Press Return to close. ' answer
  exit 1
fi
extension_id="${1:-}"
if [ -z "$extension_id" ]; then
  printf 'In NEEDLEDROP, open One-time Mac setup and click Copy extension ID.\n'
  read -r -p 'Paste the extension ID here, then press Return: ' extension_id
fi
if ! [[ "$extension_id" =~ ^[a-p]{32}$ ]]; then printf 'That is not a valid extension ID.\n'; exit 1; fi
"$brew_cmd" install python yt-dlp ffmpeg deno
brew_prefix="$("$brew_cmd" --prefix)"
"$brew_prefix/bin/python3" native/install.py "$extension_id" --prefix "$brew_prefix"
printf '\nSetup complete. You can close this window.\n'
read -r -p 'Press Return to close. ' answer
