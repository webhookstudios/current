// Current: Electron main process.
// Owns windows, native dialogs, project files, media proxies and the GStreamer export pipeline.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');

app.setName('Current');
// Current was called Splice. Its settings, cache and recent projects are copied over the first
// time it starts; the old folder stays as it was, as a backup.
try {
  const oldUser = path.join(app.getPath('appData'), 'Splice');
  if (!fs.existsSync(app.getPath('userData')) && fs.existsSync(oldUser))
    fs.cpSync(oldUser, app.getPath('userData'), { recursive: true });
} catch (e) { /* starting fresh is fine */ }
// Wayland/X11 auto-detection, and a stable WM class so the dock icon matches the .desktop file.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const USER = () => app.getPath('userData');
const CACHE = () => path.join(USER(), 'cache');
const RECENT = () => path.join(USER(), 'recent.json');

let win = null;
let exportJob = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#15161a',
    title: 'Current',
    icon: path.join(__dirname, 'data', 'io.github.webhookstudios.Current.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Local media is drawn into WebGL textures; file:// pages count each file as its own origin,
      // so cross-file security is relaxed. The app never loads remote content.
      webSecurity: false,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  let forceClose = false;
  win.on('close', async (e) => {
    if (forceClose) return;
    e.preventDefault();
    let dirty = false;
    try { dirty = await win.webContents.executeJavaScript('window.__currentDirty ? window.__currentDirty() : false'); } catch { /* page gone */ }
    if (dirty) {
      const r = await dialog.showMessageBox(win, {
        type: 'question', buttons: ['Discard changes', 'Cancel'], defaultId: 1, cancelId: 1,
        message: 'Close without saving?', detail: 'Your project has unsaved changes.',
      });
      if (r.response !== 0) return;
    }
    forceClose = true;
    cancelExport();
    win.close();
  });
  if (process.argv.includes('--devtools')) win.webContents.openDevTools({ mode: 'detach' });
  // Development aids: --log mirrors the page console to stdout; --selftest=<file.js> runs a test module in the page.
  const selftest = process.argv.find((a) => a.startsWith('--selftest='))?.slice(11);
  if (selftest || process.argv.includes('--log')) {
    win.webContents.on('console-message', (e, level, message, line, source) => {
      const msg = typeof e?.message === 'string' ? e.message : message;
      const src = e?.sourceId ?? source, ln = e?.lineNumber ?? line;
      console.log(`[page] ${msg}${(e?.level ?? level) === 'error' || level === 3 ? `  (${String(src).split('/').pop()}:${ln})` : ''}`);
    });
  }
  if (selftest) {
    ipcMain.handle('selftest:capture', async (_e, file) => { const img = await win.webContents.capturePage(); fs.writeFileSync(file, img.toPNG()); return true; });
    ipcMain.once('selftest:done', (_e, code) => { setTimeout(() => app.exit(code || 0), 200); });
    win.webContents.once('did-finish-load', () => setTimeout(() => win.webContents.executeJavaScript(`import(${JSON.stringify('file://' + path.resolve(selftest))}).catch(e => { console.error('SELFTEST LOAD', e.stack); window.native.selftestDone(1); })`), 1500));
  }
}

app.whenReady().then(() => {
  fs.mkdirSync(CACHE(), { recursive: true });
  createWindow();
});
app.on('window-all-closed', () => app.quit());

// ---------- files & dialogs ----------
const MEDIA_EXT = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mts', 'm2ts', 'ts', 'flv', 'wmv', 'mpg', 'mpeg', '3gp', 'ogv',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif',
  'mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus', 'wma'];

ipcMain.handle('dialog:importMedia', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import media', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Media', extensions: MEDIA_EXT }, { name: 'All files', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('dialog:openProject', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Open project', properties: ['openFile'],
    filters: [{ name: 'Current project', extensions: ['splice'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:saveProject', async (_e, suggested) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Save project', defaultPath: path.join(app.getPath('videos'), (suggested || 'My Video') + '.splice'),
    filters: [{ name: 'Current project', extensions: ['splice'] }],
  });
  if (r.canceled) return null;
  return r.filePath.endsWith('.splice') ? r.filePath : r.filePath + '.splice';
});

ipcMain.handle('dialog:exportPath', async (_e, suggested, ext) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Export video', defaultPath: path.join(app.getPath('videos'), `${suggested || 'My Video'}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (r.canceled) return null;
  return r.filePath.toLowerCase().endsWith('.' + ext) ? r.filePath : `${r.filePath}.${ext}`;
});

ipcMain.handle('dialog:message', async (_e, opts) => (await dialog.showMessageBox(win, opts)).response);

ipcMain.handle('fs:readText', async (_e, p) => fs.promises.readFile(p, 'utf8'));
ipcMain.handle('fs:writeText', async (_e, p, text) => {
  const tmp = p + '.tmp';
  await fs.promises.writeFile(tmp, text, 'utf8');
  await fs.promises.rename(tmp, p);
  return true;
});
ipcMain.handle('fs:readBinary', async (_e, p) => {
  const b = await fs.promises.readFile(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
});
ipcMain.handle('fs:exists', async (_e, p) => fs.existsSync(p));
ipcMain.handle('fs:stat', async (_e, p) => { try { const s = await fs.promises.stat(p); return { size: s.size, mtime: s.mtimeMs }; } catch { return null; } });
ipcMain.handle('fs:cacheWrite', async (_e, name, data) => {
  const p = path.join(CACHE(), path.basename(name));
  await fs.promises.writeFile(p, Buffer.from(data));
  return p;
});
ipcMain.handle('fs:cachePath', async (_e, name) => path.join(CACHE(), path.basename(name)));
ipcMain.handle('shell:showItem', async (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('shell:openExternal', async (_e, url) => { if (/^https?:/.test(url)) await shell.openExternal(url); });
ipcMain.handle('app:info', async () => ({ version: app.getVersion(), videos: app.getPath('videos'), home: os.homedir(), cpus: os.cpus().length }));
ipcMain.handle('win:setTitle', async (_e, t) => { if (win) win.setTitle(t); });

// ---------- recent projects ----------
function readRecent() { try { return JSON.parse(fs.readFileSync(RECENT(), 'utf8')); } catch { return []; } }
ipcMain.handle('recent:list', async () => readRecent().filter((r) => fs.existsSync(r.path)));
ipcMain.handle('recent:add', async (_e, entry) => {
  const list = readRecent().filter((r) => r.path !== entry.path);
  list.unshift({ ...entry, opened: Date.now() });
  fs.writeFileSync(RECENT(), JSON.stringify(list.slice(0, 24)));
  return true;
});
ipcMain.handle('recent:remove', async (_e, p) => {
  fs.writeFileSync(RECENT(), JSON.stringify(readRecent().filter((r) => r.path !== p)));
  return true;
});

// ---------- media proxies ----------
// Files Chromium cannot decode (AVI, MTS, odd codecs) are transcoded once to an H.264/AAC MP4 in the cache.
const gstQuote = (p) => `"${String(p).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const proxyJobs = new Map();

ipcMain.handle('media:proxy', async (e, src) => {
  const st = fs.statSync(src);
  const key = Buffer.from(`${src}|${st.size}|${st.mtimeMs}`).toString('base64url').slice(-48);
  const out = path.join(CACHE(), `proxy-${key}.mp4`);
  if (fs.existsSync(out)) return out;
  if (proxyJobs.has(out)) return proxyJobs.get(out);
  const job = new Promise((resolve, reject) => {
    const tmp = out + '.part';
    const run = (withAudio) => {
      const args = ['-q', '-e',
        `filesrc location=${gstQuote(src)} ! decodebin name=d`,
        `d. ! queue ! videoconvert ! video/x-raw,format=I420 ! x264enc speed-preset=veryfast pass=qual quantizer=20 key-int-max=30 ! queue ! mp4mux name=m faststart=true ! filesink location=${gstQuote(tmp)}`];
      if (withAudio) args.push('d. ! queue ! audioconvert ! audioresample ! audio/x-raw,rate=48000 ! avenc_aac bitrate=192000 ! queue ! m.');
      const p = spawn('gst-launch-1.0', args.join(' ').split(/ (?=(?:[^"]*"[^"]*")*[^"]*$)/), { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('close', (code) => {
        if (code === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 1000) { fs.renameSync(tmp, out); resolve(out); }
        else if (withAudio) run(false); // the file may have no audio stream
        else reject(new Error(err.trim().split('\n').pop() || 'Could not convert this file.'));
      });
    };
    run(true);
  });
  proxyJobs.set(out, job);
  try { return await job; } finally { proxyJobs.delete(out); }
});

// ---------- export ----------
// Frames arrive from the renderer as raw RGBA and are fed to gst-launch over stdin.
function buildExportArgs(o) {
  const loc = gstQuote(o.path);
  const raw = `fdsrc fd=0 blocksize=${o.width * o.height * 4} ! queue max-size-buffers=8 ! rawvideoparse width=${o.width} height=${o.height} format=rgba framerate=${o.fps}/1 ! videoconvert ! videoflip method=vertical-flip`;
  const q = { high: 17, medium: 21, low: 26 }[o.quality] ?? 21;
  const audio = o.audioPath ? `filesrc location=${gstQuote(o.audioPath)} ! wavparse ! audioconvert ! audioresample ! audio/x-raw,rate=48000,channels=2` : null;
  const parts = [];
  if (o.format === 'mp3') {
    parts.push(`${audio} ! lamemp3enc target=bitrate bitrate=256 cbr=true ! filesink location=${loc}`);
  } else if (o.format === 'webm') {
    const cpu = { high: 2, medium: 4, low: 6 }[o.quality] ?? 4;
    const br = Math.round(o.width * o.height * o.fps * ({ high: 0.12, medium: 0.07, low: 0.04 }[o.quality] ?? 0.07) / 1000);
    parts.push(`${raw} ! video/x-raw,format=I420 ! vp9enc deadline=1 cpu-used=${cpu} row-mt=true threads=${Math.max(2, os.cpus().length - 1)} target-bitrate=${br * 1000} end-usage=vbr keyframe-max-dist=${o.fps * 4} ! queue ! webmmux name=m ! filesink location=${loc}`);
    if (audio) parts.push(`${audio} ! opusenc bitrate=160000 ! queue ! m.`);
  } else if (o.format === 'mov' || o.format === 'mp4') {
    const mux = o.format === 'mov' ? 'qtmux' : 'mp4mux';
    const preset = { high: 'slow', medium: 'medium', low: 'veryfast' }[o.quality] ?? 'medium';
    parts.push(`${raw} ! video/x-raw,format=I420 ! x264enc speed-preset=${preset} pass=qual quantizer=${q} key-int-max=${o.fps * 2} threads=0 ! video/x-h264,profile=high ! queue ! ${mux} name=m faststart=true ! filesink location=${loc}`);
    if (audio) parts.push(`${audio} ! avenc_aac bitrate=256000 ! queue ! m.`);
  }
  return ['-q', '-e', ...parts.join(' ').split(/ (?=(?:[^"]*"[^"]*")*[^"]*$)/)];
}

function cancelExport() {
  if (!exportJob) return;
  try { exportJob.proc.stdin.destroy(); } catch { /* closed */ }
  try { exportJob.proc.kill('SIGKILL'); } catch { /* gone */ }
  const p = exportJob.opts.path;
  exportJob = null;
  setTimeout(() => { try { fs.unlinkSync(p); } catch { /* none */ } }, 300);
}

ipcMain.handle('export:start', async (_e, opts) => {
  cancelExport();
  if (opts.audioWav) {
    opts.audioPath = path.join(CACHE(), `export-audio-${Date.now()}.wav`);
    await fs.promises.writeFile(opts.audioPath, Buffer.from(opts.audioWav));
    delete opts.audioWav;
  }
  const args = buildExportArgs(opts);
  if (process.argv.includes('--log') || process.argv.some((a) => a.startsWith('--selftest'))) console.log('[export] gst-launch-1.0', JSON.stringify(args));
  const proc = spawn('gst-launch-1.0', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  const job = { proc, opts, err: '', done: null };
  job.done = new Promise((resolve) => {
    proc.on('close', (code) => resolve({ code, err: job.err }));
    proc.on('error', (err) => resolve({ code: -1, err: String(err) }));
  });
  proc.stderr.on('data', (d) => { job.err += d; });
  proc.stdin.on('error', () => { /* pipeline died; reported on finish */ });
  exportJob = job;
  return true;
});

ipcMain.handle('export:frame', async (_e, data) => {
  const job = exportJob;
  if (!job) throw new Error('Export was cancelled.');
  const buf = Buffer.from(data);
  if (job.proc.exitCode !== null) throw new Error(job.err.trim() || 'The encoder stopped.');
  if (!job.proc.stdin.write(buf)) await new Promise((r) => job.proc.stdin.once('drain', r));
  return true;
});

ipcMain.handle('export:finish', async () => {
  const job = exportJob;
  if (!job) throw new Error('Export was cancelled.');
  job.proc.stdin.end();
  const r = await job.done;
  exportJob = null;
  if (job.opts.audioPath) fs.promises.unlink(job.opts.audioPath).catch(() => {});
  if (r.code !== 0) throw new Error(r.err.trim().split('\n').slice(-3).join('\n') || `Encoder exited with code ${r.code}`);
  const st = fs.statSync(job.opts.path);
  return { path: job.opts.path, size: st.size };
});

ipcMain.handle('export:cancel', async () => { cancelExport(); return true; });

ipcMain.handle('gst:check', async () => new Promise((resolve) => {
  execFile('gst-inspect-1.0', ['x264enc'], (err) => resolve(!err));
}));
