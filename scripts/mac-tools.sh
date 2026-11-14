#!/bin/bash
# Fetches the standalone ffmpeg used by Current on macOS into vendor/mac/ (not tracked by git), as one
# universal binary: an Intel build and an Apple Silicon build joined with lipo. Each must include
# libx264, libvpx (VP9), libopus, libmp3lame and AAC. These builds are GPL; Current is GPL-2.0-or-later.
# Override the downloads with FFMPEG_X64_URL and FFMPEG_ARM64_URL (zip files holding a single ffmpeg).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/mac"
X64_URL="${FFMPEG_X64_URL:-https://evermeet.cx/ffmpeg/ffmpeg-9.0.2.zip}"
ARM_URL="${FFMPEG_ARM64_URL:-https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"

fetch() { # url arch
  mkdir -p "$TMP/$2"
  curl -fsSL -o "$TMP/$2.zip" "$1"
  unzip -oq "$TMP/$2.zip" -d "$TMP/$2"
  local bin; bin="$(find "$TMP/$2" -type f -name ffmpeg | head -1)"
  [ -n "$bin" ] || { echo "no ffmpeg in $1" >&2; exit 1; }
  lipo -archs "$bin" | grep -qw "$2" || { echo "$1 is not a $2 build" >&2; exit 1; }
  lipo "$bin" -thin "$2" -output "$TMP/ffmpeg-$2" 2>/dev/null || cp "$bin" "$TMP/ffmpeg-$2"
}
fetch "$X64_URL" x86_64
fetch "$ARM_URL" arm64
lipo -create "$TMP/ffmpeg-x86_64" "$TMP/ffmpeg-arm64" -output "$DEST/ffmpeg"
chmod +x "$DEST/ffmpeg"

# Check the half this Mac can run.
for e in libx264 libvpx-vp9 libopus libmp3lame; do
  "$DEST/ffmpeg" -hide_banner -encoders 2>/dev/null | grep -q "$e" || { echo "ffmpeg is missing $e" >&2; exit 1; }
done
# The licence travels with the app (Contents/Resources/licenses), with links to the exact builds and source.
"$DEST/ffmpeg" -hide_banner -L > "$DEST/ffmpeg-LICENSE.txt" 2>&1
VER="$("$DEST/ffmpeg" -version | head -1 | awk '{print $3}' | sed 's/-.*//')"
printf 'ffmpeg %s: source https://ffmpeg.org/releases/ffmpeg-%s.tar.xz\nIntel build: %s\nApple Silicon build: %s\n' "$VER" "$VER" "$X64_URL" "$ARM_URL" > "$DEST/ffmpeg-SOURCE.txt"
echo "ffmpeg ready: $(lipo -archs "$DEST/ffmpeg") — $("$DEST/ffmpeg" -version | head -1)"
