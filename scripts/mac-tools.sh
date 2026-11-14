#!/bin/bash
# Fetches the standalone ffmpeg used by Current on macOS into vendor/mac/ (not tracked by git).
# The build must include libx264, libvpx (VP9), libopus, libmp3lame and AAC; it is GPL, as is Current.
# Intel and Apple Silicon builds come from separate downloads; set FFMPEG_URL to override.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/mac"
URL="${FFMPEG_URL:-https://evermeet.cx/ffmpeg/ffmpeg-9.0.2.zip}"
mkdir -p "$DEST"
curl -fsSL -o "$DEST/ffmpeg.zip" "$URL"
unzip -oq "$DEST/ffmpeg.zip" -d "$DEST" && rm "$DEST/ffmpeg.zip"
chmod +x "$DEST/ffmpeg"
for e in libx264 libvpx-vp9 libopus libmp3lame; do
  "$DEST/ffmpeg" -hide_banner -encoders 2>/dev/null | grep -q "$e" || { echo "ffmpeg is missing $e" >&2; exit 1; }
done
echo "ffmpeg ready: $("$DEST/ffmpeg" -version | head -1)"
