#!/bin/sh
# Installs Splice for the current user, without root, with an apps-menu entry.
# Needs `npm install` run once in this folder (it downloads Electron).
set -e

APP_ID=io.github.webhookstudios.Splice
ROOT="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/splice"

[ -x "$ROOT/node_modules/electron/dist/electron" ] || (cd "$ROOT" && npm install)
mkdir -p "$DEST" "$DATA/applications" "$DATA/icons/hicolor/scalable/apps" "$DATA/mime/packages"
rm -rf "$DEST/runtime" "$DEST/app"
cp -a "$ROOT/node_modules/electron/dist" "$DEST/runtime"
rm -f "$DEST/runtime/resources/default_app.asar"
mkdir -p "$DEST/runtime/resources/app/data"
cp "$ROOT/package.json" "$ROOT/main.js" "$ROOT/preload.js" "$DEST/runtime/resources/app/"
cp -r "$ROOT/src" "$DEST/runtime/resources/app/src"
cp "$ROOT/data/$APP_ID.png" "$DEST/runtime/resources/app/data/"
cp "$ROOT/data/$APP_ID.svg" "$DATA/icons/hicolor/scalable/apps/"
cp "$ROOT/data/splice-mime.xml" "$DATA/mime/packages/splice.xml"
sed -e "s|@EXEC@|\"$DEST/runtime/electron\"|" -e "s|@ICON@|$DATA/icons/hicolor/scalable/apps/$APP_ID.svg|" \
    "$ROOT/data/$APP_ID.desktop.in" > "$DATA/applications/$APP_ID.desktop"
update-desktop-database "$DATA/applications" 2>/dev/null || true
update-mime-database "$DATA/mime" 2>/dev/null || true

echo "Splice is installed. Open it from the apps menu."
