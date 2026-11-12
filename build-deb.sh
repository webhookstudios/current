#!/bin/sh
# Builds dist/current_<version>_amd64.deb. Needs dpkg-deb and `npm install` run once (for Electron).
#
#   /usr/lib/current/            Electron runtime, binary renamed to `current`
#   /usr/lib/current/resources/app/   the editor (main.js, preload.js, src/)
#   /usr/bin/current             launcher symlink
#   /usr/share/applications, icons, mime   apps-menu entry, icon, .splice file type
#   /etc/apparmor.d/current      user-namespace permission for the Chromium sandbox
set -e

APP_ID=io.github.webhookstudios.Current
ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
ELECTRON="$ROOT/node_modules/electron/dist"
[ -x "$ELECTRON/electron" ] || { echo "Run 'npm install' first (Electron is missing)." >&2; exit 1; }
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

LIB="$STAGE/usr/lib/current"
APP="$LIB/resources/app"
install -d "$LIB" "$APP" "$STAGE/DEBIAN" "$STAGE/usr/bin" "$STAGE/usr/share/applications" \
    "$STAGE/usr/share/icons/hicolor/scalable/apps" "$STAGE/usr/share/icons/hicolor/256x256/apps" \
    "$STAGE/usr/share/mime/packages" "$STAGE/usr/share/doc/current" "$STAGE/etc/apparmor.d"

cp -a "$ELECTRON/." "$LIB/"
rm -f "$LIB/resources/default_app.asar"
mv "$LIB/electron" "$LIB/current"
chmod 4755 "$LIB/chrome-sandbox"

cp "$ROOT/package.json" "$ROOT/main.js" "$ROOT/preload.js" "$APP/"
cp -r "$ROOT/src" "$APP/src"
install -d "$APP/data"
cp "$ROOT/data/$APP_ID.png" "$APP/data/"
node -e "const f='$APP/package.json';const p=require(f);delete p.devDependencies;delete p.scripts;require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

ln -s ../lib/current/current "$STAGE/usr/bin/current"
install -m 644 "$ROOT/data/$APP_ID.svg" "$STAGE/usr/share/icons/hicolor/scalable/apps/"
install -m 644 "$ROOT/data/$APP_ID.png" "$STAGE/usr/share/icons/hicolor/256x256/apps/"
install -m 644 "$ROOT/data/current-mime.xml" "$STAGE/usr/share/mime/packages/current.xml"
install -m 644 "$ROOT/data/apparmor-current" "$STAGE/etc/apparmor.d/current"
sed -e 's|@EXEC@|current|' -e "s|@ICON@|$APP_ID|" "$ROOT/data/$APP_ID.desktop.in" > "$STAGE/usr/share/applications/$APP_ID.desktop"
chmod 644 "$STAGE/usr/share/applications/$APP_ID.desktop"

cat > "$STAGE/usr/share/doc/current/copyright" <<EOT
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Current
Source: https://github.com/webhookstudios/current

Files: *
Copyright: $(date +%Y) webhookstudios
License: GPL-2+
 On Debian systems, the full text of the GNU General Public License
 version 2 can be found in /usr/share/common-licenses/GPL-2.

Files: usr/lib/current/resources/app/src/fonts/*
License: OFL-1.1
 Fonts from Google Fonts via Fontsource, under the SIL Open Font License 1.1.

Files: usr/lib/current/resources/app/src/css/sedge/fonts/*
Copyright: 2023 The Young Serif Project Authors; 2015 The Public Sans Project Authors
License: OFL-1.1
 The full license texts are in the same folder.

Files: usr/lib/current/*
License: MIT and others
 Electron and Chromium; see usr/lib/current/LICENSE and LICENSES.chromium.html.
EOT
chmod 644 "$STAGE/usr/share/doc/current/copyright"

cat > "$STAGE/DEBIAN/postinst" <<'EOT'
#!/bin/sh
set -e
if [ "$1" = configure ]; then
    if command -v apparmor_parser >/dev/null 2>&1 && [ -d /sys/kernel/security/apparmor ]; then
        apparmor_parser -r -T -W /etc/apparmor.d/current 2>/dev/null || true
    fi
    update-mime-database /usr/share/mime >/dev/null 2>&1 || true
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi
EOT
cat > "$STAGE/DEBIAN/postrm" <<'EOT'
#!/bin/sh
set -e
if [ "$1" = remove ] || [ "$1" = purge ]; then
    update-mime-database /usr/share/mime >/dev/null 2>&1 || true
fi
EOT
chmod 755 "$STAGE/DEBIAN/postinst" "$STAGE/DEBIAN/postrm"
echo "/etc/apparmor.d/current" > "$STAGE/DEBIAN/conffiles"

# Replaces/Breaks take over from this app's old package name, splice.
cat > "$STAGE/DEBIAN/control" <<EOT
Package: current
Version: $VERSION
Architecture: amd64
Maintainer: webhookstudios <354619278+webhookstudios@users.noreply.github.com>
Installed-Size: $(du -sk "$STAGE/usr" | cut -f1)
Depends: gstreamer1.0-tools, gstreamer1.0-plugins-base, gstreamer1.0-plugins-good, gstreamer1.0-plugins-ugly, gstreamer1.0-libav, libgtk-3-0t64 | libgtk-3-0, libnss3, libasound2t64 | libasound2, libgbm1
Recommends: whisper.cpp, xdg-desktop-portal-gnome
Replaces: splice (<< 2~)
Breaks: splice (<< 2~)
Section: video
Priority: optional
Homepage: https://github.com/webhookstudios/current
Description: Template-rich video editor
 Current is a video editor with a library of built-in templates: animated
 titles and lower thirds, transitions, video effects, colour filters,
 stickers, backgrounds, sound effects and music. It layers clips on
 multiple tracks with chroma key (green and blue screen), picture in
 picture and blend modes, and cleans up audio with noise removal, voice
 presets, equalizer, fades and normalisation. Export uses GStreamer
 (MP4, MOV, WebM, MP3).
EOT

find "$STAGE" -type d -exec chmod 755 {} +

mkdir -p "$ROOT/dist"
dpkg-deb --root-owner-group -Zxz --build "$STAGE" "$ROOT/dist/current_${VERSION}_amd64.deb"
