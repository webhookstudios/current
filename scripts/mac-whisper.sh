#!/bin/bash
# Builds whisper-cli (whisper.cpp, MIT licence) for Current on macOS into vendor/mac/ (not tracked by git).
# One universal binary for Apple Silicon and Intel (built per architecture, then joined), statically linked,
# with the Metal shaders built in,
# so the app needs nothing else installed. Needs the Xcode Command Line Tools; CMake is installed into
# .tools/ with pip if it is not on PATH. Set WHISPER_VERSION to build another release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${WHISPER_VERSION:-v1.9.5}"
WORK="$ROOT/.tools/whisper-build"
DEST="$ROOT/vendor/mac"
mkdir -p "$WORK" "$DEST"

if ! command -v cmake >/dev/null; then
  [ -x "$ROOT/.tools/cmake-venv/bin/cmake" ] || { python3 -m venv "$ROOT/.tools/cmake-venv" && "$ROOT/.tools/cmake-venv/bin/pip" install -q cmake; }
  export PATH="$ROOT/.tools/cmake-venv/bin:$PATH"
fi

SRC="$WORK/whisper.cpp-$VER"
if [ ! -d "$SRC" ]; then
  curl -fsSL -o "$WORK/src.tar.gz" "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/$VER.tar.gz"
  mkdir -p "$SRC" && tar xzf "$WORK/src.tar.gz" -C "$SRC" --strip-components 1 && rm "$WORK/src.tar.gz"
fi

# One build per architecture, so each keeps its fast CPU code (NEON on Apple Silicon; AVX2/FMA on Intel,
# which every Mac that runs macOS 12 has), then joined with lipo. BLAS is off: Accelerate's newer
# routines need macOS 13.3, and Metal does the heavy work anyway.
build() { # arch, extra cmake flags...
  local arch="$1"; shift
  cmake -S "$SRC" -B "$SRC/build-$arch" -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES="$arch" -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
    -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_BLAS=OFF -DGGML_OPENMP=OFF \
    -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON \
    -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF "$@" >/dev/null
  cmake --build "$SRC/build-$arch" --config Release -j "$(sysctl -n hw.ncpu)" --target whisper-cli >/dev/null
}
build arm64 -DCMAKE_SYSTEM_PROCESSOR=arm64
build x86_64 -DCMAKE_SYSTEM_PROCESSOR=x86_64 -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON
lipo -create "$SRC/build-arm64/bin/whisper-cli" "$SRC/build-x86_64/bin/whisper-cli" -output "$DEST/whisper-cli"
cp "$SRC/LICENSE" "$DEST/whisper.cpp-LICENSE.txt"
echo "whisper.cpp $VER: https://github.com/ggml-org/whisper.cpp/tree/$VER" > "$DEST/whisper.cpp-SOURCE.txt"
lipo -archs "$DEST/whisper-cli"
"$DEST/whisper-cli" --help 2>&1 | grep -q -- '-dtw' || { echo "whisper-cli has no -dtw option" >&2; exit 1; }
echo "whisper-cli ready: $DEST/whisper-cli ($VER)"
