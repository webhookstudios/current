#!/bin/bash
# Builds the universal Current .dmg into dist/. electron-builder works in a temporary folder: codesign
# refuses files with Finder metadata, which folders synced with iCloud (such as Desktop) add to every file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in ffmpeg whisper-cli; do
  [ -x "$ROOT/vendor/mac/$f" ] || { echo "vendor/mac/$f is missing: run scripts/mac-tools.sh and scripts/mac-whisper.sh first" >&2; exit 1; }
done
OUT="$(mktemp -d)/dist"
(cd "$ROOT" && npx electron-builder --mac dmg --universal -c.directories.output="$OUT")
mkdir -p "$ROOT/dist"
cp "$OUT"/*.dmg "$ROOT/dist/"
rm -rf "$(dirname "$OUT")"
ls -lh "$ROOT"/dist/*.dmg
