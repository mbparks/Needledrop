#!/usr/bin/env python3
"""Install this host for one extension ID in the current user's Chrome profile."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import sys


def install(extension_id, prefix, home=None):
    if not re.fullmatch('[a-p]{32}', extension_id):
        raise ValueError('Copy the 32-letter extension ID shown in NEEDLEDROP setup.')
    home = Path(home) if home else Path.home()
    root = home / 'Library/Application Support/NEEDLEDROP'
    manifest_dir = home / 'Library/Application Support/Google/Chrome/NativeMessagingHosts'
    prefix = Path(prefix)
    tools = {key: str(prefix / 'bin' / name) for key, name in [('yt_dlp','yt-dlp'),('ffmpeg','ffmpeg'),('deno','deno')]}
    for path in [*tools.values(), str(prefix / 'bin/ffprobe')]:
        if not Path(path).is_file():
            raise ValueError('A required dependency is missing: ' + path)
    root.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(__file__).with_name('host.py'), root / 'host.py')
    config = {**tools, 'extension_id': extension_id, 'output_dir': str(home / 'Downloads/NEEDLEDROP')}
    (root / 'host-config.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    launcher = root / 'launch-host'
    # Prefer Homebrew's stable link so patch-version upgrades do not break Chrome.
    interpreter = prefix / 'bin/python3'
    if not interpreter.is_file():
        interpreter = Path(sys.executable)
    launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(str(interpreter)) + ' ' + shlex.quote(str(root/'host.py')) + ' "$@"\n', encoding='utf-8')
    launcher.chmod(0o755)
    manifest = {'name':'com.greenshoegarage.needledrop','description':'NEEDLEDROP YouTube MP3 helper',
                'path':str(launcher),'type':'stdio','allowed_origins':['chrome-extension://'+extension_id+'/']}
    (manifest_dir / 'com.greenshoegarage.needledrop.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    return root


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('extension_id')
    parser.add_argument('--prefix', required=True)
    args = parser.parse_args()
    if sys.platform != 'darwin':
        parser.error('This installer is for macOS with Google Chrome.')
    try:
        root = install(args.extension_id, args.prefix)
        print('Installed. In NEEDLEDROP, click Check connection. MP3s go to ~/Downloads/NEEDLEDROP.')
    except Exception as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)
