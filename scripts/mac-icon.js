// Renders build/icon-mac.svg (the Mac version of the Current logo, already on macOS's 824/1024 icon grid)
// to build/icon.icns and build/icon-1024.png. Run on a Mac: npx electron scripts/mac-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(root, 'build', 'icon-mac.svg'), 'utf8');
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, transparent: true, frame: false, webPreferences: { offscreen: true } });
  const html = `<body style="margin:0;background:transparent"><img style="position:absolute;left:0;top:0;width:1024px;height:1024px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`;
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
  await new Promise((r) => setTimeout(r, 800));
  const png = (await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })).toPNG();
  const out = path.join(root, 'build'), set = path.join(out, 'icon.iconset');
  fs.rmSync(set, { recursive: true, force: true }); fs.mkdirSync(set, { recursive: true });
  const big = path.join(out, 'icon-1024.png'); fs.writeFileSync(big, png);
  for (const s of [16, 32, 64, 128, 256, 512, 1024]) {
    const sz = (n, name) => execFileSync('sips', ['-z', String(n), String(n), big, '--out', path.join(set, name)], { stdio: 'ignore' });
    if (s <= 512) sz(s, `icon_${s}x${s}.png`);
    if (s >= 32) sz(s, `icon_${s / 2}x${s / 2}@2x.png`);
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(out, 'icon.icns')]);
  fs.rmSync(set, { recursive: true, force: true });
  app.quit();
});
