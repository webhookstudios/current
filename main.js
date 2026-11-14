// Current: Electron main process.
// Owns windows, native dialogs, project files, media proxies and the export encoder (GStreamer on Linux, bundled ffmpeg on macOS).
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, desktopCapturer, session, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const encoder = require('./encoder');

app.setName('Current');
// Current was called Splice. Its settings, cache and recent projects are copied over the first
// time it starts; the old folder stays as it was, as a backup.
try {
  const oldUser = path.join(app.getPath('appData'), 'Splice');
  if (!fs.existsSync(app.getPath('userData')) && fs.existsSync(oldUser))
    fs.cpSync(oldUser, app.getPath('userData'), { recursive: true });
} catch (e) { /* starting fresh is fine */ }
// Wayland/X11 auto-detection, and a stable WM class so the dock icon matches the .desktop file.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  // PipeWire screen capture goes through the desktop's own share dialog (xdg-desktop-portal).
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations,WebRTCPipeWireCapturer');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const USER = () => app.getPath('userData');
const CACHE = () => path.join(USER(), 'cache');
const RECENT = () => path.join(USER(), 'recent.json');

let win = null;
let exportJob = null;
const IS_MAC = process.platform === 'darwin';
const SELFTEST = process.argv.find((a) => a.startsWith('--selftest='))?.slice(11);

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
    // macOS: the window buttons sit inside Current's own top bar, and the sidebars show the desktop
    // through frosted glass (the page leaves those areas see-through; see html.mac in app.css).
    ...(IS_MAC ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 }, vibrancy: 'sidebar', visualEffectState: 'followWindow', backgroundColor: '#00000000' } : {}),
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
  // Linux draws its own menus in the page. On macOS the page sends its menus here (menu:setApp) and
  // they go in the system menu bar; until then a basic bar keeps ⌘C, ⌘V and ⌘Q working.
  if (IS_MAC) {
    setAppMenu(null);
    // In full screen the window buttons are hidden, so the top bar drops the space it keeps for them.
    const fs = (on) => win.webContents.executeJavaScript(`document.documentElement.classList.toggle('fullscreen', ${on})`).catch(() => {});
    win.on('enter-full-screen', () => fs(true));
    win.on('leave-full-screen', () => fs(false));
  } else Menu.setApplicationMenu(null);
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
    ipcMain.handle('selftest:mouse', (_e, x, y) => { win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) }); return true; });
    ipcMain.once('selftest:done', (_e, code) => { setTimeout(() => app.exit(code || 0), 200); });
    win.webContents.once('did-finish-load', () => setTimeout(() => win.webContents.executeJavaScript(`import(${JSON.stringify('file://' + path.resolve(selftest))}).then(() => 0, e => { console.error('SELFTEST LOAD', e.stack); window.native.selftestDone(1); })`), 1500));
  }
}

app.whenReady().then(() => {
  if (IS_MAC) nativeTheme.themeSource = 'dark'; // the editor is dark, so its glass, menus and dialogs are too
  fs.mkdirSync(CACHE(), { recursive: true });
  // Screen recording: the desktop asks the user which screen or window to share.
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] })
      .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
      .catch(() => callback({}));
  });
  if (process.platform === 'darwin' && app.dock) { try { app.dock.setIcon(path.join(__dirname, 'build', 'icon-1024.png')); } catch { /* packaged apps use the .icns */ } }
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

ipcMain.handle('dialog:chooseImage', async (_e, title) => {
  const r = await dialog.showOpenDialog(win, {
    title: title || 'Choose an image', properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'svg', 'jpg', 'jpeg', 'webp'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

// Brand kits are kept for the whole app, next to the recent-projects list.
const BRAND = () => path.join(USER(), 'brand-kits.json');
ipcMain.handle('brand:load', async () => { try { return JSON.parse(fs.readFileSync(BRAND(), 'utf8')); } catch { return null; } });
ipcMain.handle('brand:save', async (_e, data) => {
  const tmp = BRAND() + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 1));
  await fs.promises.rename(tmp, BRAND());
  return true;
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
// Voiceovers are kept in ~/Videos/Current voiceovers, not the cache, so projects keep working.
ipcMain.handle('voiceover:save', async (_e, data) => {
  const dir = path.resolve(process.env.CURRENT_VOICEOVER_DIR || path.join(app.getPath('videos'), 'Current voiceovers'));
  await fs.promises.mkdir(dir, { recursive: true });
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  let p = path.join(dir, `Voiceover ${stamp}.wav`);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `Voiceover ${stamp} (${i}).wav`);
  await fs.promises.writeFile(p, Buffer.from(data));
  return p;
});
ipcMain.handle('shell:showItem', async (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('shell:openExternal', async (_e, url) => { if (/^https?:/.test(url)) await shell.openExternal(url); });
ipcMain.handle('app:info', async () => ({ platform: process.platform, selftest: !!SELFTEST, version: app.getVersion(), videos: app.getPath('videos'), home: os.homedir(), cpus: os.cpus().length }));
ipcMain.handle('win:setTitle', async (_e, t) => { if (win) win.setTitle(t); });
ipcMain.handle('win:minimize', async () => { win?.minimize(); });
ipcMain.handle('win:restore', async () => { if (win) { win.restore(); win.focus(); } });

// Screen and webcam recordings go to ~/Videos/Current recordings. MediaRecorder's WebM video has no
// duration or seek index, so it is rewrapped (not re-encoded); microphone sound arrives as WAV.
ipcMain.handle('recording:save', async (_e, data, name, ext = 'webm') => {
  const dir = path.resolve(process.env.CURRENT_RECORDING_DIR || path.join(app.getPath('videos'), 'Current recordings'));
  await fs.promises.mkdir(dir, { recursive: true });
  let out = path.join(dir, `${name}.${ext}`);
  for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, `${name} (${i}).${ext}`);
  if (ext !== 'webm') { await fs.promises.writeFile(out, Buffer.from(data)); return out; }
  // Video only (sound is saved separately as WAV): rewrap so the file has a duration and seek index.
  const raw = path.join(CACHE(), `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webm`);
  await fs.promises.writeFile(raw, Buffer.from(data));
  const ok = await new Promise((resolve) => {
    const p = spawn(encoder.cmd(), encoder.remuxArgs(raw, out), { stdio: 'ignore' });
    const limit = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } }, 30000 + data.byteLength / 2e4);
    p.on('close', (code) => { clearTimeout(limit); resolve(code === 0 && fs.existsSync(out) && fs.statSync(out).size > 1000); });
    p.on('error', () => { clearTimeout(limit); resolve(false); });
  });
  if (!ok) await fs.promises.copyFile(raw, out); // still playable, just without a seek index
  fs.promises.unlink(raw).catch(() => {});
  return out;
});

// ---------- automatic captions (whisper.cpp from Ubuntu's archive; models downloaded once) ----------
const WHISPER = () => process.env.CURRENT_WHISPER_CLI || '/usr/bin/whisper-cli';
const MODELS = {
  standard: { file: 'ggml-base-q5_1.bin', size: 59707625, sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898', dtw: 'base' },
  accurate: { file: 'ggml-small-q5_1.bin', size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb', dtw: 'small' },
};
const MODEL_DIR = () => path.join(USER(), 'models');
const modelPath = (id) => path.join(MODEL_DIR(), MODELS[id].file);
const sendProgress = (msg) => win?.webContents.send('captions:progress', msg);

ipcMain.handle('captions:status', async () => ({
  engine: !!process.env.CURRENT_FAKE_WHISPER || fs.existsSync(WHISPER()),
  models: Object.fromEntries(Object.keys(MODELS).map((id) => [id, { have: !!process.env.CURRENT_FAKE_WHISPER || fs.existsSync(modelPath(id)), size: MODELS[id].size }])),
}));

ipcMain.handle('captions:download', async (_e, id) => {
  const m = MODELS[id];
  if (!m) throw new Error('Unknown model');
  await fs.promises.mkdir(MODEL_DIR(), { recursive: true });
  const part = modelPath(id) + '.part';
  const res = await fetch(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${m.file}`);
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status}).`);
  const hash = require('crypto').createHash('sha256');
  const out = fs.createWriteStream(part);
  let got = 0, last = 0;
  for await (const chunk of res.body) {
    out.write(chunk); hash.update(chunk); got += chunk.length;
    if (got - last > 1 << 20) { last = got; sendProgress({ phase: 'download', p: got / m.size }); }
  }
  await new Promise((r) => out.end(r));
  if (hash.digest('hex') !== m.sha256) { fs.promises.unlink(part).catch(() => {}); throw new Error('The downloaded model did not match its checksum, so it was not used. Try again.'); }
  await fs.promises.rename(part, modelPath(id));
  return true;
});

let whisperJob = null;
ipcMain.handle('captions:transcribe', async (_e, wavPath, id, lang) => {
  if (process.env.CURRENT_FAKE_WHISPER) { // tests: a ready-made transcript
    sendProgress({ phase: 'transcribe', p: 0.5 });
    return parseWhisper(JSON.parse(fs.readFileSync(process.env.CURRENT_FAKE_WHISPER, 'utf8')));
  }
  const base = path.join(CACHE(), `captions-${Date.now()}`);
  // -dtw aligns each word to the sound (whisper's own word times drift by seconds); it needs flash attention off
  const args = ['-m', modelPath(id), '-f', wavPath, '-l', lang || 'auto', '-ml', '1', '-sow', '-ojf', '-nfa', '-dtw', MODELS[id].dtw, '-of', base, '-pp', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1)))];
  const code = await new Promise((resolve, reject) => {
    const p = spawn(WHISPER(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    whisperJob = p;
    let err = '';
    p.stderr.on('data', (d) => {
      err += d;
      const m = /progress =\s*(\d+)%/.exec(String(d));
      if (m) sendProgress({ phase: 'transcribe', p: +m[1] / 100 });
    });
    p.on('close', (c) => { whisperJob = null; c === 0 ? resolve(c) : reject(new Error(err.trim().split('\n').slice(-2).join('\n') || `whisper-cli stopped (${c})`)); });
    p.on('error', (e) => { whisperJob = null; reject(e); });
  });
  const json = JSON.parse(await fs.promises.readFile(base + '.json', 'utf8'));
  fs.promises.unlink(base + '.json').catch(() => {});
  return code === 0 ? parseWhisper(json) : [];
});
ipcMain.handle('captions:cancel', async () => { try { whisperJob?.kill('SIGKILL'); } catch { /* gone */ } });

// whisper-cli -ml 1 -sow gives one segment per word. Where the aligned time (t_dtw, in 10 ms steps) of the
// word's first token is there, it is the word's start; the page then reads each word's end from the sound.
function parseWhisper(json) {
  const words = (json.transcription || [])
    .map((s) => {
      const tok = (s.tokens || []).find((t) => t.text.trim() && !/^\[_/.test(t.text) && t.t_dtw >= 0);
      return { text: String(s.text || '').trim(), t0: tok ? tok.t_dtw / 100 : (s.offsets?.from ?? 0) / 1000, t1: (s.offsets?.to ?? 0) / 1000 };
    })
    .filter((w) => w.text && !/^[[(].*[\])]$/.test(w.text)); // drop [BLANK_AUDIO], (music) and similar
  for (let i = 1; i < words.length; i++) words[i].t0 = Math.max(words[i].t0, words[i - 1].t0);
  words.forEach((w, i) => { w.t1 = Math.max(w.t0 + 0.1, Math.min(w.t1, words[i + 1]?.t0 ?? Infinity)); });
  return words;
}

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
      const p = spawn(encoder.cmd(), encoder.proxyArgs(src, tmp, withAudio), { stdio: ['ignore', 'ignore', 'pipe'] });
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
// Frames arrive from the renderer as raw RGBA and are fed to the encoder over stdin (see encoder.js).

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
  const args = encoder.exportArgs(opts);
  if (process.argv.includes('--log') || process.argv.some((a) => a.startsWith('--selftest'))) console.log('[export]', encoder.cmd(), JSON.stringify(args));
  const proc = spawn(encoder.cmd(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
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

ipcMain.handle('gst:check', async () => encoder.check());

// ---------- macOS menus ----------
// The page describes its menus as plain data: { label, items: [{ id, label, kbd, enabled, edit } | { sep: true }] }.
// Shortcuts are only shown, not registered, because the page already handles those keys; the Edit menu's
// text commands are registered so they also work in text boxes (the page decides: text box or clips).
const accel = (kbd) => {
  if (!kbd) return undefined;
  const k = String(kbd).split(' / ')[0].replace('Ctrl+', 'CmdOrCtrl+').replace(/\bDel(ete)?$/, 'Backspace').replace(/−$/, '-').replace(/\+\+$/, '+Plus');
  return k === '+' ? 'Plus' : k === '?' ? 'Shift+/' : k;
};
const EDIT_ROLES = { undo: 'CmdOrCtrl+Z', redo: 'Shift+CmdOrCtrl+Z', cut: 'CmdOrCtrl+X', copy: 'CmdOrCtrl+C', paste: 'CmdOrCtrl+V', selectAll: 'CmdOrCtrl+A' };
function menuItems(items, onPick) {
  return items.map((it) => {
    if (it.sep) return { type: 'separator' };
    if (it.edit) return { label: it.label, accelerator: EDIT_ROLES[it.edit], click: () => win?.webContents.send('menu:edit', it.edit, it.id) };
    return { label: it.label, enabled: it.enabled !== false, accelerator: accel(it.kbd), registerAccelerator: false, click: () => onPick(it.id) };
  });
}
function setAppMenu(menus) {
  const pick = (id) => win?.webContents.send('menu:run', id);
  const page = menus || [{ label: 'Edit', items: Object.keys(EDIT_ROLES).map((op) => ({ label: op === 'selectAll' ? 'Select All' : op[0].toUpperCase() + op.slice(1), edit: op })) }];
  const help = page.find((m) => m.label === 'Help');
  const about = help?.items.find((i) => /^About/.test(i.label || ''));
  const tpl = [
    { label: app.name, submenu: [
      about ? { label: about.label, click: () => pick(about.id) } : { role: 'about' },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    ...page.filter((m) => m !== help).map((m) => ({ label: m.label, submenu: menuItems(m.items, pick) })),
    { role: 'windowMenu' },
  ];
  if (help) tpl.push({ role: 'help', submenu: menuItems(help.items.filter((i) => i !== about), pick) });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}
ipcMain.handle('menu:setApp', async (_e, menus) => { if (IS_MAC) setAppMenu(menus); });
// Right-click menus: resolves with the chosen item's id, or null when the menu closes without a choice.
ipcMain.handle('menu:popup', async (_e, items) => new Promise((resolve) => {
  const m = Menu.buildFromTemplate(menuItems(items, (id) => resolve(id)));
  m.popup({ window: win, callback: () => setTimeout(() => resolve(null), 100) });
}));
// Text commands for the focused text box.
ipcMain.handle('edit:text', async (_e, op) => { if (['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'].includes(op)) win?.webContents[op](); });
