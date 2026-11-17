// Current: Electron main process.
// Owns windows, native dialogs, project files, media proxies and the GStreamer export pipeline.
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, desktopCapturer, session } = require('electron');
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
// PipeWire screen capture goes through the desktop's own share dialog (xdg-desktop-portal).
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations,WebRTCPipeWireCapturer');
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
    ipcMain.handle('selftest:mouse', (_e, x, y) => { win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) }); return true; });
    ipcMain.once('selftest:done', (_e, code) => { setTimeout(() => app.exit(code || 0), 200); });
    ipcMain.handle('selftest:writeText', async (_e, file, text) => { fs.writeFileSync(path.resolve(file), text); return true; });
    // Run the connector bridge the way Claude's apps do: a child process speaking MCP on stdin/stdout.
    // Sends the messages, waits for an answer to every one that has an id, and returns the answers.
    ipcMain.handle('selftest:bridge', async (_e, messages, env = {}) => new Promise((resolve) => {
      const p = spawn(process.execPath, [BRIDGE], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
      const want = new Set(messages.filter((m) => m.id !== undefined).map((m) => m.id));
      const answers = [], notes = [];
      let buf = '', err = '';
      const finish = () => { clearTimeout(limit); try { p.stdin.end(); p.kill(); } catch { /* gone */ } resolve({ answers, notes, stderr: err }); };
      const limit = setTimeout(finish, 120000);
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', (d) => {
        buf += d;
        for (let i; (i = buf.indexOf('\n')) >= 0;) {
          const m = JSON.parse(buf.slice(0, i));
          buf = buf.slice(i + 1);
          if (m.id !== undefined && m.id !== null) { answers.push(m); want.delete(m.id); } else notes.push(m);
          if (!want.size) finish();
        }
      });
      p.stderr.on('data', (d) => { err += d; });
      for (const m of messages) p.stdin.write(JSON.stringify(m) + '\n');
    }));
    win.webContents.once('did-finish-load', () => setTimeout(() => win.webContents.executeJavaScript(`import(${JSON.stringify('file://' + path.resolve(selftest))}).then(() => 0, e => { console.error('SELFTEST LOAD', e.stack); window.native.selftestDone(1); })`), 1500));
  }
}

app.whenReady().then(() => {
  fs.mkdirSync(CACHE(), { recursive: true });
  // Screen recording: the desktop asks the user which screen or window to share.
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] })
      .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
      .catch(() => callback({}));
  });
  createWindow();
  win.webContents.on('did-start-loading', () => { assist.ready = false; });
  if (assistSettings().connector) startConnector();
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
ipcMain.handle('app:info', async () => ({ version: app.getVersion(), videos: app.getPath('videos'), home: os.homedir(), cpus: os.cpus().length }));
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
  const desc = `filesrc location=${gstQuote(raw)} ! matroskademux name=d matroskamux name=m ! filesink location=${gstQuote(out)} d.video_0 ! video/x-vp8 ! queue ! m.`;
  const ok = await new Promise((resolve) => {
    const p = spawn('gst-launch-1.0', ['-q', '-e', ...desc.split(/ (?=(?:[^"]*"[^"]*")*[^"]*$)/)], { stdio: 'ignore' });
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

// ---------- assistant connector ----------
// Claude's apps start mcp/bridge.js, which reaches Current over a local socket in the user-data folder
// (readable and writable by this user only). Each line in is { id, method: 'catalog' | 'call' | 'hello',
// name, input }; the editor page answers. Off until the person switches it on in Tools › Assistant.
const net = require('net');
const BRIDGE = path.join(__dirname, 'mcp', 'bridge.js');
// Tests point CURRENT_ASSISTANT_SOCKET at their own folder, which then also holds the setting and the key.
const ASSIST_DIR = () => (process.env.CURRENT_ASSISTANT_SOCKET ? path.dirname(SOCKET()) : USER());
const ASSIST_FILE = () => (process.env.CURRENT_ASSISTANT_SOCKET ? path.join(ASSIST_DIR(), 'assistant-settings.json') : path.join(USER(), 'assistant.json'));
const SOCKET = () => (process.env.CURRENT_ASSISTANT_SOCKET ? path.resolve(process.env.CURRENT_ASSISTANT_SOCKET) : path.join(USER(), 'assistant.sock'));
const assist = { server: null, pending: new Map(), seq: 0, ready: false, lastUsed: 0 };
const failMsg = (text) => ({ ok: false, content: [{ type: 'text', text }] });

function assistSettings() {
  try { return { connector: false, ...JSON.parse(fs.readFileSync(ASSIST_FILE(), 'utf8')) }; } catch { return { connector: false }; }
}

// extra.panel: the call comes from the panel inside Current (its own undo step), not the connector.
function askPage(method, name, input, extra = {}) {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed() || !assist.ready) return resolve(failMsg('Current is still starting. Try again in a moment.'));
    const id = ++assist.seq;
    const limit = setTimeout(() => { assist.pending.delete(id); resolve(failMsg('Current took too long to answer.')); }, 15 * 60 * 1000);
    assist.pending.set(id, (out) => { clearTimeout(limit); resolve(out); });
    win.webContents.send('assistant:call', { id, method, name, input, ...extra });
  });
}
ipcMain.on('assistant:result', (_e, id, out) => { const done = assist.pending.get(id); assist.pending.delete(id); done?.(out); });
ipcMain.on('assistant:ready', () => { assist.ready = true; });

function startConnector() {
  if (assist.server) return;
  const sock = SOCKET();
  try { fs.unlinkSync(sock); } catch { /* none left over */ }
  const srv = net.createServer((c) => {
    c.setEncoding('utf8');
    let buf = '';
    c.on('data', (d) => {
      buf += d;
      for (let i; (i = buf.indexOf('\n')) >= 0;) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.method === 'call') assist.lastUsed = Date.now();
        (async () => {
          const result = msg.method === 'hello' ? { app: 'Current', version: app.getVersion() }
            : msg.method === 'catalog' || msg.method === 'call' ? await askPage(msg.method, msg.name, msg.input)
              : failMsg(`Unknown request ${msg.method}.`);
          if (!c.destroyed) c.write(JSON.stringify({ id: msg.id, result }) + '\n');
        })();
      }
    });
    c.on('error', () => { /* the bridge went away */ });
  });
  srv.on('error', (e) => console.error('[assistant]', e.message));
  srv.listen(sock, () => { try { fs.chmodSync(sock, 0o600); } catch { /* best effort */ } });
  assist.server = srv;
}
function stopConnector() {
  if (!assist.server) return;
  assist.server.close();
  assist.server = null;
  try { fs.unlinkSync(SOCKET()); } catch { /* gone */ }
}
app.on('will-quit', stopConnector);

// How other apps start the bridge with Current's own runtime, so they need no Node of their own.
const bridgeConfig = () => ({ command: process.execPath, args: [BRIDGE], env: { ELECTRON_RUN_AS_NODE: '1' } });
const shq = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

ipcMain.handle('assistant:get', async () => ({
  ...assistSettings(),
  running: !!assist.server,
  lastUsed: assist.lastUsed,
  claudeCode: `claude mcp add current --scope user -e ELECTRON_RUN_AS_NODE=1 -- ${shq(process.execPath)} ${shq(BRIDGE)}`,
  mcpConfig: JSON.stringify({ mcpServers: { current: bridgeConfig() } }, null, 2),
}));
ipcMain.handle('assistant:set', async (_e, change) => {
  const s = { ...assistSettings(), ...change };
  fs.writeFileSync(ASSIST_FILE(), JSON.stringify(s));
  if (s.connector) startConnector(); else stopConnector();
  return s;
});

// A bundle for Claude's desktop app (a zip with a manifest; the app runs the bridge with its own Node).
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipStored(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const nm = Buffer.from(name), crc = crc32(data);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(0, 8);
    loc.writeUInt16LE(0, 10); loc.writeUInt16LE(0x21, 12); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(data.length, 18);
    loc.writeUInt32LE(data.length, 22); loc.writeUInt16LE(nm.length, 26); loc.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(0x0314, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nm.length, 28); cen.writeUInt32LE((0o100644 << 16) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    parts.push(loc, nm, data);
    central.push(cen, nm);
    offset += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
// The panel inside Current: the person's own API key and the Claude loop (assistant.js).
require('./assistant.js')({ getWin: () => win, askPage, dir: ASSIST_DIR, selftest: process.argv.some((a) => a.startsWith('--selftest')) });

ipcMain.handle('assistant:saveBundle', async (_e, catalog) => {
  let out = process.env.CURRENT_BUNDLE_PATH && path.resolve(process.env.CURRENT_BUNDLE_PATH);
  if (!out) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Save the connector for Claude’s desktop app', defaultPath: path.join(app.getPath('downloads'), 'Current.mcpb'),
      filters: [{ name: 'Claude desktop extension', extensions: ['mcpb'] }],
    });
    if (r.canceled) return null;
    out = r.filePath.endsWith('.mcpb') ? r.filePath : `${r.filePath}.mcpb`;
  }
  const manifest = {
    manifest_version: '0.3',
    name: 'current',
    display_name: 'Current',
    version: app.getVersion(),
    description: 'Lets Claude edit the project open in Current: build a first cut from your media, trim, add titles, music and captions.',
    long_description: 'Works while Current is open and **Let Claude edit in Current** is on (Tools › Assistant). Claude sees the project outline (clip and file names, times, texts and captions), transcripts of what is said, and the still frames it asks to see; these go to Anthropic under your Claude plan’s terms and its privacy policy, and webhookstudios never sees them. Your video and sound files stay on your computer. Everything Claude changes can be undone in Current. Claude is a trademark of Anthropic, PBC; Current is an independent app, not made or endorsed by Anthropic.',
    author: { name: 'webhookstudios', url: 'https://github.com/webhookstudios' },
    homepage: 'https://github.com/webhookstudios/current',
    repository: { type: 'git', url: 'https://github.com/webhookstudios/current.git' },
    license: 'GPL-2.0-or-later',
    icon: 'icon.png',
    server: { type: 'node', entry_point: 'server/bridge.js', mcp_config: { command: 'node', args: ['${__dirname}/server/bridge.js'], env: {} } },
    tools: catalog.tools.map((t) => ({ name: t.name, description: t.description })),
    prompts: catalog.prompts.map((p) => ({ name: p.name, description: p.description, arguments: p.arguments.map((a) => a.name), text: p.template.replace(/\{\{(\w+)(?:\|[^}]*)?\}\}/g, '${arguments.$1}') })),
    compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=18.0.0' } },
  };
  fs.writeFileSync(out, zipStored([
    ['manifest.json', JSON.stringify(manifest, null, 2)],
    ['server/bridge.js', fs.readFileSync(BRIDGE)],
    ['server/catalog.json', JSON.stringify(catalog)],
    ['icon.png', fs.readFileSync(path.join(__dirname, 'data', 'io.github.webhookstudios.Current.png'))],
  ]));
  return out;
});
