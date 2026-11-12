// Record a voiceover: pick and test a microphone, count down, then record from the playhead while
// the project plays. A small floating panel, which can be dragged anywhere so the preview stays in
// view, shows the time, the level and the Stop button. The take is saved as a WAV file in
// ~/Videos/Current voiceovers and placed on a free audio track where the recording started.
import { h, icon, clamp, fmtTime } from '../util.js';
import { store, edit, makeClip, addClip, freeTrack, select } from '../state.js';
import { app, importPaths } from '../actions.js';
import { modal, slider, toggle, toast } from './widgets.js';

const PREFS_KEY = 'current.voiceover';
function loadPrefs() {
  const base = { countdown: 3, muteProject: true, deviceId: null, panel: null };
  try { return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return base; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* not important */ } }

let active = false; // the dialog, the countdown or a recording is on screen

// The microphone. Opened in the dialog (for the level meter) and kept open for the recording,
// so recording starts without a gap. Voice processing is off: the raw sound is recorded, and the
// Audio tab's noise removal and voice presets can clean it up afterwards.
class Mic {
  async open(deviceId) {
    this.close();
    const audio = { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    return this.stream.getAudioTracks()[0];
  }

  // Peak of the last ~20 ms, as 0..1 on a −60…0 dB scale.
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let pk = 0;
    for (let i = 0; i < this.buf.length; i++) pk = Math.max(pk, Math.abs(this.buf[i]));
    return clamp((20 * Math.log10(pk + 1e-6) + 60) / 60);
  }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = this.ctx = this.src = this.analyser = null;
  }
}

function micError(e) {
  switch (e?.name) {
    case 'NotAllowedError': case 'SecurityError':
      return 'Current is not allowed to use the microphone. Check that microphone access is turned on in your system settings.';
    case 'NotReadableError': case 'AbortError':
      return 'That microphone is busy or stopped responding. Close other apps that use it, or pick another one.';
    case 'NotFoundError': case 'OverconstrainedError':
      return 'That microphone is not connected any more. Pick another one.';
    default:
      return `The microphone could not be opened: ${e?.message || e}`;
  }
}

// ---------- step 1: choose and check the microphone ----------
export async function openVoiceover() {
  if (active || !store.project) return;
  if (store.playing) app.player.pause();
  active = true;
  const prefs = loadPrefs();
  const fps = store.project.fps || 30;
  const start = store.time;
  const mic = new Mic();
  let countdown = clamp(Math.round(prefs.countdown ?? 3), 0, 10);
  let muteProject = prefs.muteProject !== false;
  let starting = false, raf = 0, opening = 0, ready = false;

  const pick = h('select.grow', { onchange: () => useDevice(pick.value) });
  const bar = h('i');
  const status = h('div.hint.vo-note', 'Say something. The bar should move when you talk.');
  const body = h('div.vo',
    h('div.row', h('label', 'Microphone'), pick),
    h('div.row', h('label', 'Level'), h('div.vo-meter.big', bar)),
    status,
    slider({ label: 'Countdown', min: 0, max: 10, step: 1, value: countdown, unit: 'seconds', onInput: (v) => { countdown = Math.round(v); } }),
    h('div.hint.vo-note', 'Time to get ready after you press Start. Set it to 0 to start right away.'),
    toggle({ label: 'Mute the project while recording', value: muteProject, onChange: (v) => { muteProject = v; } }),
    h('div.hint.vo-sub', 'Keeps sound from your speakers out of the recording. Turn it off if you wear headphones and want to hear the video.'),
    h('div.vo-where', icon('info', 15), h('span', `Recording starts at ${fmtTime(start, fps)}, where the playhead is, and goes on a free audio track. The video plays while you talk.`)));

  const cleanup = () => {
    cancelAnimationFrame(raf);
    navigator.mediaDevices.removeEventListener('devicechange', onDevices);
    if (!starting) { mic.close(); active = false; }
  };
  const dlg = modal({
    title: 'Record a voiceover',
    body,
    onClose: cleanup,
    actions: [
      { label: 'Cancel', run: (close) => close() },
      {
        label: 'Start recording',
        primary: true,
        run: (close) => {
          if (!ready) return;
          starting = true;
          Object.assign(prefs, { countdown, muteProject, deviceId: pick.value });
          savePrefs(prefs);
          close();
          record(mic, { start, countdown, muteProject, prefs });
        },
      },
    ],
  });
  const startBtn = dlg.el.querySelector('.modal-f .btn.primary');
  startBtn.prepend(icon('mic', 15));

  const setReady = (ok, msg) => {
    ready = ok;
    startBtn.disabled = !ok;
    status.textContent = msg || 'Say something. The bar should move when you talk.';
    status.classList.toggle('err', !!msg && !ok);
  };

  async function listDevices(selected) {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    pick.replaceChildren(...devs.map((d, i) => h('option', { value: d.deviceId }, d.label || `Microphone ${i + 1}`)));
    if (devs.some((d) => d.deviceId === selected)) pick.value = selected;
    pick.disabled = !devs.length;
    return devs;
  }

  async function useDevice(id, fallback = false) {
    const my = ++opening;
    setReady(false, 'Opening the microphone…');
    try {
      const track = await mic.open(id);
      if (my !== opening) return;
      await listDevices(id || track.getSettings().deviceId);
      setReady(true);
    } catch (e) {
      if (my !== opening) return;
      mic.close();
      // A remembered microphone that is gone: fall back to the system default once.
      if (fallback && ['NotFoundError', 'OverconstrainedError'].includes(e?.name)) return useDevice(null);
      const devs = await listDevices(id).catch(() => []);
      setReady(false, devs.length ? micError(e) : 'No microphone found. Plug one in and it will show up here.');
    }
  }

  async function onDevices() {
    if (!dlg.back.isConnected) return;
    const devs = await listDevices(pick.value);
    if (!mic.stream && devs.length) useDevice(pick.value || null);
  }
  navigator.mediaDevices.addEventListener('devicechange', onDevices);

  const meter = () => { bar.style.width = `${mic.level() * 100}%`; raf = requestAnimationFrame(meter); };
  meter();
  setReady(false, 'Opening the microphone…');
  await useDevice(prefs.deviceId || null, !!prefs.deviceId);
}

// ---------- step 2: count down, record, stop ----------
async function record(mic, { start, countdown, muteProject, prefs }) {
  const ctx = mic.ctx;
  let node;
  try {
    await ctx.audioWorklet.addModule(new URL('../engine/recorder-worklet.js', import.meta.url).href);
    node = new AudioWorkletNode(ctx, 'current-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    const sink = ctx.createGain();
    sink.gain.value = 0; // keeps the capture node running without playing the mic back
    mic.src.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);
    if (ctx.state === 'suspended') await ctx.resume();
  } catch (e) {
    mic.close();
    active = false;
    toast(`Could not start recording: ${e.message}`, 'err', 6000);
    return;
  }
  const chunks = [];
  let gotAll;
  const allIn = new Promise((r) => { gotAll = r; });
  node.port.onmessage = (e) => { if (e.data.done) gotAll(); else chunks.push(e.data); };

  // UI: a click shield (nothing else can be edited meanwhile, but everything stays visible),
  // the countdown over the preview, and the floating panel.
  const frameEl = document.querySelector('.stage .frame');
  const shield = h('div.rec-shield');
  const count = h('div.rec-count');
  const dot = h('span.dot');
  const label = h('span.lbl');
  const timeEl = h('span.time');
  const mbar = h('i');
  const action = h('button.btn.small');
  const grip = h('div.grip', { title: 'Drag to move' }, icon('grip', 16));
  const panel = h('div.rec-panel', grip, dot, label, timeEl, h('div.vo-meter', mbar), action);
  document.body.append(shield, count, panel);

  const placeCount = () => {
    const r = (frameEl || document.querySelector('.stage')).getBoundingClientRect();
    Object.assign(count.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  const placePanel = (x, y) => {
    const w = panel.offsetWidth, hh = panel.offsetHeight;
    panel.style.left = clamp(x, 8, innerWidth - w - 8) + 'px';
    panel.style.top = clamp(y, 8, innerHeight - hh - 8) + 'px';
  };
  const defaultSpot = () => {
    const r = document.querySelector('.stage').getBoundingClientRect();
    return [r.left + (r.width - panel.offsetWidth) / 2, r.bottom - panel.offsetHeight - 18];
  };
  const onResize = () => { placeCount(); placePanel(panel.offsetLeft, panel.offsetTop); };
  window.addEventListener('resize', onResize);

  // Drag the panel by any part of it except its button.
  panel.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const ox = e.clientX - panel.offsetLeft, oy = e.clientY - panel.offsetTop;
    panel.classList.add('dragging');
    const move = (ev) => placePanel(ev.clientX - ox, ev.clientY - oy);
    const up = () => {
      panel.classList.remove('dragging');
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      prefs.panel = { x: panel.offsetLeft, y: panel.offsetTop };
      savePrefs(prefs);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });

  let phase = 'count', timer = 0, raf = 0, startFrame = 0, t0 = 0;
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    if (phase === 'count' && e.key === 'Escape') cancel();
    else if (phase === 'rec' && [' ', 'Enter', 'Escape'].includes(e.key)) stop();
  };
  window.addEventListener('keydown', onKey, true);
  mic.stream.getAudioTracks()[0].addEventListener('ended', () => {
    if (phase === 'rec') { toast('The microphone was disconnected, so recording stopped.', 'err', 6000); stop(); }
    else if (phase === 'count') { toast('The microphone was disconnected.', 'err', 6000); cancel(); }
  });

  const fmtRec = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  const meterLoop = () => {
    mbar.style.width = `${mic.level() * 100}%`;
    if (phase === 'rec') timeEl.textContent = fmtRec((performance.now() - t0) / 1000);
    raf = requestAnimationFrame(meterLoop);
  };

  function setPhase(p) {
    phase = p;
    panel.classList.toggle('live', p === 'rec');
    if (p === 'count') {
      label.textContent = 'Starting in';
      action.className = 'btn small';
      action.replaceChildren('Cancel');
      action.onclick = cancel;
    } else {
      label.textContent = 'Recording';
      timeEl.textContent = fmtRec(0);
      action.className = 'btn small stop';
      action.replaceChildren(icon('stop', 13), 'Stop recording');
      action.onclick = stop;
    }
  }

  function teardown() {
    phase = 'off';
    clearInterval(timer);
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    shield.remove(); count.remove(); panel.remove();
    frameEl?.classList.remove('recording');
    try { node.disconnect(); } catch { /* already gone */ }
    mic.close();
    active = false;
  }

  function cancel() {
    if (phase !== 'count') return;
    teardown();
    toast('Recording cancelled. Nothing was added.');
  }

  function begin() {
    count.remove();
    setPhase('rec');
    frameEl?.classList.add('recording');
    if (muteProject) app.player.muteAll(true);
    app.player.seek(start);
    startFrame = Math.round(ctx.currentTime * ctx.sampleRate);
    t0 = performance.now();
    app.player.play({ openEnded: true });
  }

  async function stop() {
    if (phase !== 'rec') return;
    phase = 'saving';
    const sr = ctx.sampleRate;
    const stopFrame = Math.round(ctx.currentTime * sr);
    app.player.pause();
    app.player.muteAll(false);
    node.port.postMessage('stop');
    await Promise.race([allIn, new Promise((r) => setTimeout(r, 1500))]);
    teardown();
    const samples = assemble(chunks, startFrame, stopFrame);
    const dur = samples.length / sr;
    if (dur < 0.3) {
      app.player.seek(start);
      toast('That recording was too short, so nothing was added.', 'err');
      return;
    }
    try {
      const path = await window.native.saveVoiceover(toWav(samples, sr));
      await addVoiceover(path, start, dur);
    } catch (e) {
      toast(`Could not save the voiceover: ${e.message}`, 'err', 6000);
    }
  }

  setPhase('count');
  placeCount();
  const spot = prefs.panel ? [prefs.panel.x, prefs.panel.y] : defaultSpot();
  placePanel(...spot);
  meterLoop();
  if (countdown > 0) {
    let left = countdown;
    const show = () => { timeEl.textContent = String(left); count.replaceChildren(h('b', String(left))); };
    show();
    timer = setInterval(() => {
      left--;
      if (left > 0) show();
      else { clearInterval(timer); begin(); }
    }, 1000);
  } else begin();
}

// Samples from frame `from` up to `to`, from the capture blocks; any gap stays silent.
export function assemble(chunks, from, to) {
  const out = new Float32Array(Math.max(0, to - from));
  for (const { frame, data } of chunks) {
    const a = Math.max(frame, from), b = Math.min(frame + data.length, to);
    if (b > a) out.set(data.subarray(a - frame, b - frame), a - from);
  }
  return out;
}

// 16-bit mono PCM WAV.
export function toWav(samples, sr) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

// ---------- step 3: put the take on the timeline ----------
async function addVoiceover(path, start, dur) {
  const [m] = await importPaths([path]);
  if (!m) return;
  const n = 1 + Math.max(0, ...store.project.media.map((x) => +(/^Voiceover (\d+)$/.exec(x.name)?.[1] || 0)));
  m.name = `Voiceover ${n}`;
  m.voiceover = true;
  store.emit('media');
  edit(() => {
    const c = makeClip('audio', { mediaId: m.id, name: m.name, start, duration: Math.min(dur, m.duration || dur) });
    c.trackId = freeTrack('audio', start, start + c.duration).id;
    addClip(c, { overwrite: false });
    select(c.id);
  });
  app.player.seek(start + dur);
  toast(`${m.name} is on the timeline. Press Ctrl+Z to take it off.`, '', 5000);
}
