// Record the screen with an optional webcam bubble and microphone. The desktop's own share dialog
// picks the screen or window (on a Mac: the system picker, or Current's own on macOS 14 and older). The recording lands at the playhead: the screen on a video track,
// the webcam above it as a round bubble in the bottom-right corner, and the microphone on an audio
// track below (recorded straight to WAV, like voiceovers, so its timing is exact).
import { h, icon, clamp, IS_MAC } from '../util.js';
import { store, edit, mainTrack, trackClips, videoTracks, ensureTrack, select, trackById, makeClip, addClip } from '../state.js';
import { app, importPaths } from '../actions.js';
import { modal, slider, toggle, toast } from './widgets.js';
import { assemble, toWav } from './voiceover.js';
import { freeTrack } from '../state.js';
import { allowMedia, screenAllowed } from './macmedia.js';

const PREFS = 'current.screenrec';
// cam and mic: unset = the first device, '' = none
const loadPrefs = () => { const d = { countdown: 3, hide: true, panel: null }; try { return { ...d, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return d; } };
const savePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* fine */ } };
let busy = false;

// Tests swap in a canvas stream for the desktop share dialog.
const getScreen = () => (window.__currentTestScreen ? window.__currentTestScreen() : navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }));

export async function openScreenRecord() {
  if (busy || !store.project) return;
  if (store.playing) app.player.pause();
  busy = true;
  const prefs = loadPrefs();
  let countdown = clamp(Math.round(prefs.countdown), 0, 10), hide = prefs.hide !== false;
  const camSel = h('select.grow', { onchange: () => openCam() });
  const micSel = h('select.grow', { onchange: () => openMic() });
  const camView = h('video.sr-cam', { muted: true, autoplay: true, playsInline: true });
  const bar = h('i');
  let camStream = null, micStream = null, micCtx = null, micSrc = null, an = null, raf = 0, starting = false;

  const stopCam = () => { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; camView.srcObject = null; };
  const stopMic = () => { micStream?.getTracks().forEach((t) => t.stop()); micCtx?.close().catch(() => {}); micStream = micCtx = micSrc = an = null; };
  async function openCam() {
    stopCam();
    camView.classList.toggle('off', !camSel.value);
    if (!camSel.value) return;
    if (!(await allowMedia('camera'))) { camSel.value = ''; camView.classList.add('off'); return; }
    try { camStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: camSel.value }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }); camView.srcObject = camStream; }
    catch (e) { toast(`That camera could not be opened: ${e.message}`, 'err'); camSel.value = ''; camView.classList.add('off'); }
  }
  async function openMic() {
    stopMic();
    if (!micSel.value) return;
    if (!(await allowMedia('microphone'))) { micSel.value = ''; return; }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micSel.value }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micCtx = new AudioContext(); an = micCtx.createAnalyser(); an.fftSize = 1024;
      micSrc = micCtx.createMediaStreamSource(micStream);
      micSrc.connect(an);
    } catch (e) { toast(`That microphone could not be opened: ${e.message}`, 'err'); micSel.value = ''; }
  }
  const buf = new Float32Array(1024);
  const meter = () => {
    let pk = 0;
    if (an) { an.getFloatTimeDomainData(buf); for (const v of buf) pk = Math.max(pk, Math.abs(v)); }
    bar.style.width = `${clamp((20 * Math.log10(pk + 1e-6) + 60) / 60) * 100}%`;
    raf = requestAnimationFrame(meter);
  };

  // device lists (labels need permission, so ask once for each kind; on a Mac the system asks first)
  await allowMedia('microphone', { quiet: true }); await allowMedia('camera', { quiet: true });
  try { (await navigator.mediaDevices.getUserMedia({ audio: true, video: true }))?.getTracks().forEach((t) => t.stop()); } catch { /* listed without names */ }
  const devs = await navigator.mediaDevices.enumerateDevices();
  const fill = (sel, kind, saved, noun) => {
    const list = devs.filter((d) => d.kind === kind);
    sel.replaceChildren(h('option', { value: '' }, `No ${noun}`), ...list.map((d, i) => h('option', { value: d.deviceId }, d.label || `${noun[0].toUpperCase() + noun.slice(1)} ${i + 1}`)));
    sel.value = saved === '' ? '' : list.some((d) => d.deviceId === saved) ? saved : (list[0]?.deviceId || '');
  };
  fill(camSel, 'videoinput', prefs.cam, 'webcam');
  fill(micSel, 'audioinput', prefs.mic, 'microphone');

  const body = h('div.sr',
    h('div.vo-where', icon('screen', 15), h('span', 'When you press Start, your system asks which screen or window to record.')),
    h('div.row', h('label', 'Webcam'), camSel),
    h('div.sr-camrow', camView, h('div.hint', 'Shown as a round bubble in the bottom-right corner, over the recording. You can move or resize it afterwards.')),
    h('div.row', h('label', 'Microphone'), micSel),
    h('div.row', h('label', 'Level'), h('div.vo-meter.big', bar)),
    slider({ label: 'Countdown', min: 0, max: 10, step: 1, value: countdown, unit: 'seconds', onInput: (v) => { countdown = Math.round(v); } }),
    toggle({ label: 'Hide Current while recording', value: hide, onChange: (v) => { hide = v; } }),
    h('div.hint.vo-sub', 'To stop, come back to Current and press Stop recording, or use the stop button your desktop shows in the top bar while a screen is shared.'));
  const close = () => { cancelAnimationFrame(raf); if (!starting) { stopCam(); stopMic(); busy = false; } };
  const dlg = modal({
    title: 'Record screen', body, width: '560px', onClose: close,
    actions: [
      { label: 'Cancel', run: (c) => c() },
      { label: 'Start recording', primary: true, run: async (c) => {
        Object.assign(prefs, { countdown, hide, cam: camSel.value, mic: micSel.value });
        savePrefs(prefs);
        let screen;
        if (!window.__currentTestScreen && !(await screenAllowed())) return;
        try { screen = await getScreen(); } catch (e) { toast('No screen was chosen, so nothing was recorded.', 'err'); return; }
        starting = true;
        c();
        record({ screen, cam: camStream, mic: micStream, micCtx, micSrc, an, countdown, hide, prefs });
      } },
    ],
  });
  dlg.el.querySelector('.modal-f .btn.primary').prepend(icon('screen', 15));
  meter();
  await Promise.all([openCam(), openMic()]);
}

async function record({ screen, cam, mic, micCtx, micSrc, an, countdown, hide, prefs }) {
  const start = store.time;
  // the microphone: captured from now on, cut to the moment recording starts
  let capture = null;
  if (mic && micCtx && micSrc) {
    try {
      await micCtx.audioWorklet.addModule(new URL('../engine/recorder-worklet.js', import.meta.url).href);
      const node = new AudioWorkletNode(micCtx, 'current-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      const sink = micCtx.createGain(); sink.gain.value = 0;
      micSrc.connect(node); node.connect(sink); sink.connect(micCtx.destination);
      if (micCtx.state === 'suspended') await micCtx.resume();
      capture = { node, chunks: [], startFrame: 0 };
      capture.done = new Promise((res) => { node.port.onmessage = (e) => { if (e.data.done) res(); else capture.chunks.push(e.data); }; });
    } catch (e) { toast(`The microphone could not be recorded: ${e.message}`, 'err'); }
  }
  const shield = h('div.rec-shield');
  const dot = h('span.dot'), label = h('span.lbl'), timeEl = h('span.time'), mbar = h('i'), action = h('button.btn.small');
  const panel = h('div.rec-panel', h('div.grip', { title: 'Drag to move' }, icon('grip', 16)), dot, label, timeEl, h('div.vo-meter', mbar), action);
  document.body.append(shield, panel);
  const place = (x, y) => { panel.style.left = clamp(x, 8, innerWidth - panel.offsetWidth - 8) + 'px'; panel.style.top = clamp(y, 8, innerHeight - panel.offsetHeight - 8) + 'px'; };
  const r = document.querySelector('.stage').getBoundingClientRect();
  place(...(prefs.panel ? [prefs.panel.x, prefs.panel.y] : [r.left + (r.width - panel.offsetWidth) / 2, r.bottom - panel.offsetHeight - 18]));
  panel.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const ox = e.clientX - panel.offsetLeft, oy = e.clientY - panel.offsetTop;
    const move = (ev) => place(ev.clientX - ox, ev.clientY - oy);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); prefs.panel = { x: panel.offsetLeft, y: panel.offsetTop }; savePrefs(prefs); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });

  let phase = 'count', timer = 0, raf = 0, t0 = 0, recs = [];
  const buf = new Float32Array(1024);
  const tick = () => {
    let pk = 0;
    if (an) { an.getFloatTimeDomainData(buf); for (const v of buf) pk = Math.max(pk, Math.abs(v)); }
    mbar.style.width = `${clamp((20 * Math.log10(pk + 1e-6) + 60) / 60) * 100}%`;
    if (phase === 'rec') { const s = (performance.now() - t0) / 1000; timeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; }
    raf = requestAnimationFrame(tick);
  };
  const onKey = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return;
    if (phase === 'count' && e.key === 'Escape') cancel();
    else if (phase === 'rec' && [' ', 'Enter', 'Escape'].includes(e.key)) stop();
  };
  window.addEventListener('keydown', onKey, true);
  // the desktop's own "stop sharing" ends the screen track
  screen.getVideoTracks()[0]?.addEventListener('ended', () => { if (phase === 'rec') stop(); else if (phase === 'count') cancel(); });

  const release = () => {
    clearInterval(timer); cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    shield.remove(); panel.remove();
    for (const s of [screen, cam, mic]) s?.getTracks().forEach((t) => t.stop());
    micCtx?.close().catch(() => {});
    busy = false;
  };
  const cancel = () => { if (phase !== 'count') return; phase = 'off'; release(); toast('Recording cancelled. Nothing was added.'); };

  function begin() {
    phase = 'rec';
    panel.classList.add('live');
    label.textContent = 'Recording';
    action.className = 'btn small stop'; action.replaceChildren(icon('stop', 13), 'Stop recording'); action.onclick = stop;
    // macOS records H.264 with the Mac's hardware encoder: software VP8 cannot keep up there and drops
    // the end of the recording. Linux keeps VP8 in WebM.
    const type = (v) => [...(IS_MAC ? ['video/mp4;codecs=avc1'] : []), `video/webm;codecs=${v}`, 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    recs = [{ kind: 'screen', rec: new MediaRecorder(new MediaStream(screen.getVideoTracks()), { mimeType: type('vp8'), videoBitsPerSecond: 8e6 }) }];
    if (cam) recs.push({ kind: 'cam', rec: new MediaRecorder(cam, { mimeType: type('vp8'), videoBitsPerSecond: 3e6 }) });
    for (const r of recs) { r.chunks = []; r.rec.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); }; r.done = new Promise((res) => { r.rec.onstop = res; }); }
    t0 = performance.now();
    if (capture) capture.startFrame = Math.round(micCtx.currentTime * micCtx.sampleRate);
    for (const r of recs) r.rec.start(1000);
    if (hide) window.native.minimize();
  }

  async function stop() {
    if (phase !== 'rec') return;
    phase = 'saving';
    const dur = (performance.now() - t0) / 1000;
    for (const r of recs) if (r.rec.state !== 'inactive') r.rec.stop();
    let voice = null;
    if (capture) {
      const sr = micCtx.sampleRate, stopFrame = Math.round(micCtx.currentTime * sr);
      capture.node.port.postMessage('stop');
      await Promise.race([capture.done, new Promise((r) => setTimeout(r, 1500))]);
      voice = { samples: assemble(capture.chunks, capture.startFrame, stopFrame), sr };
    }
    await Promise.all(recs.map((r) => r.done));
    release();
    if (hide) window.native.restoreWindow();
    if (dur < 0.5) { toast('That recording was too short, so nothing was added.', 'err'); return; }
    const stopBusy = app.busy?.('Saving the recording…');
    try {
      const d = new Date(), pad = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
      const paths = {};
      for (const r of recs) {
        const blob = new Blob(r.chunks, { type: IS_MAC ? r.rec.mimeType : 'video/webm' });
        paths[r.kind] = await window.native.saveRecording(await blob.arrayBuffer(), `${r.kind === 'cam' ? 'Webcam' : 'Screen recording'} ${stamp}`, r.rec.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm');
      }
      if (voice?.samples.length > voice.sr * 0.3) paths.voice = await window.native.saveRecording(toWav(voice.samples, voice.sr), `Screen recording sound ${stamp}`, 'wav');
      await placeRecording(paths, start);
    } catch (e) {
      toast(`Could not save the recording: ${e.message}`, 'err', 7000);
    } finally { stopBusy?.(); app.busy?.(null); }
  }

  action.className = 'btn small'; action.replaceChildren('Cancel'); action.onclick = cancel;
  label.textContent = 'Starting in';
  tick();
  if (countdown > 0) {
    let left = countdown;
    timeEl.textContent = String(left);
    timer = setInterval(() => { left--; if (left > 0) timeEl.textContent = String(left); else { clearInterval(timer); begin(); } }, 1000);
  } else begin();
}

const overlaps = (tr, a, b) => trackClips(tr.id).some((o) => o.start < b - 1e-3 && o.start + o.duration > a + 1e-3);

async function placeRecording(paths, start) {
  const [sm] = await importPaths([paths.screen]);
  if (!sm) return;
  sm.name = 'Screen recording';
  const vm = paths.voice ? (await importPaths([paths.voice]))[0] : null;
  if (vm) { vm.name = 'Screen recording sound'; vm.recording = true; }
  const cm = paths.cam ? (await importPaths([paths.cam]))[0] : null;
  if (cm) cm.name = 'Webcam';
  store.emit('media');
  const ids = [];
  edit(() => {
    const dur = sm.duration;
    const sc = makeClip('video', { mediaId: sm.id, name: 'Screen recording', start, duration: dur });
    sc.muted = true; // the file has no sound; the narration is its own clip below
    const vt = videoTracks();
    let track = !overlaps(mainTrack(), start, start + dur) ? mainTrack() : vt.slice().reverse().find((tr) => !tr.locked && !overlaps(tr, start, start + dur));
    if (!track) track = ensureTrack('video', 'top');
    sc.trackId = track.id;
    addClip(sc, { overwrite: false });
    ids.push(sc.id);
    if (cm) {
      const cc = makeClip('video', { mediaId: cm.id, name: 'Webcam', start, duration: Math.min(cm.duration, dur) });
      cc.muted = true;
      const ar = cm.width / cm.height;
      const side = ar > 1 ? (1 - 1 / ar) / 2 : 0, tb = ar < 1 ? (1 - ar) / 2 : 0;
      cc.crop = { l: side, r: side, t: tb, b: tb };
      cc.shape = 'circle';
      cc.border = { width: 6, color: '#ffffff' };
      const p = store.project;
      const scale = 0.26, d = Math.min(cm.width, cm.height) * Math.min(p.width / cm.width, p.height / cm.height) * scale;
      Object.assign(cc.transform, { scale, x: 0.5 - (d / 2 + 0.03 * p.height) / p.width, y: 0.5 - (d / 2 + 0.03 * p.height) / p.height });
      const vts = videoTracks();
      const above = vts[vts.indexOf(trackById(sc.trackId)) - 1];
      cc.trackId = (above && !above.locked && !overlaps(above, start, start + cc.duration) ? above : ensureTrack('video', 'top')).id;
      addClip(cc, { overwrite: false });
      ids.push(cc.id);
    }
    if (vm) {
      const ac = makeClip('audio', { mediaId: vm.id, name: 'Screen recording sound', start, duration: vm.duration });
      ac.trackId = freeTrack('audio', start, start + ac.duration).id;
      addClip(ac, { overwrite: false });
      ids.push(ac.id);
    }
    select(ids);
  });
  app.player.seek(start);
  toast(cm ? 'Screen recording added, with your webcam as a bubble in the corner.' : 'Screen recording added at the playhead.', '', 5000);
}
