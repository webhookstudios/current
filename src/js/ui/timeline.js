// Timeline: tracks, clips, trimming, moving, snapping, transitions and drops from the library.
import { h, icon, clamp, fmtTime, EPS, IS_MAC } from '../util.js';
import {
  store, select, selectedClips, selectTransition, trackClips, clipEnd, clipById, trackById, mediaById, checkpoint, changed, edit, snapTime,
  clearRange, maxDuration, projectDuration, deleteTrack, ensureTrack, VISUAL, prevAdjacent, nextAdjacent, undo, redo,
} from '../state.js';
import { app, insertItem, applyLookToClip, setTransition, splitAtPlayhead, splitTargets, deleteSelected, duplicateSelected, freezeFrame, canFreeze, detachAudio, copySelected, paste, importPaths } from '../actions.js';
import { dnd } from './dnd.js';
import { stripFrameAt, peaks, thumbs } from '../engine/media.js';
import { playPath } from '../engine/media.js';
import { transitionById } from '../templates/transitions.js';
import { showMenu, toast } from './widgets.js';
import { openVoiceover } from './voiceover.js';
import { openScreenRecord } from './screenrec.js';
import { openCaptions, openCaptionEditor, captionClips } from './captions.js';
import { clipItems, inspect } from './clipmenu.js';
import { tabsFor } from './inspector.js';

const TRACK_H = { video: 62, audio: 50 };
const RULER_H = 30;
const NEW_H = 22;

let root, scroll, content, ruler, rulerCv, headsInner, playheadEl, tracksEl, zoomRange, snapBtn, undoBtn, redoBtn;
const selTools = []; // [button, usable()] for buttons that only work with the right clip selected or under the playhead
let capBtn;
function updateTools() {
  for (const [b, ok] of selTools) { const off = !ok(); if (b.disabled !== off) b.disabled = off; }
  const tip = captionClips().length ? 'Edit captions' : 'Captions: make them from the speech';
  if (capBtn && capBtn.dataset.tip !== tip) capBtn.dataset.tip = tip;
}
let layout = []; // [{ track, y, h }]
const ui = { drag: null, ghost: null, cutHint: null, snapLine: null };

export function initTimeline(el) {
  root = el;
  // Every button shows what it does on hover; a greyed-out one also says what to do first (data-tip-off).
  const tb = (name, tip, fn, cls = '') => h(`button.ibtn${cls}`, { 'data-tip': tip, onclick: fn }, icon(name, 18));
  // Buttons that need a clip stay greyed out until one they work on is selected (or, for Split and
  // Freeze frame, is under the playhead).
  const when = (b, usable, need) => { b.dataset.tipOff = need; selTools.push([b, usable]); return b; };
  const one = () => { const s = selectedClips(); return s.length === 1 ? s[0] : null; };
  const has = (t) => () => { const c = one(); return !!c && tabsFor(c).some(([id]) => id === t); };
  const picked = () => store.selection.size > 0;
  undoBtn = tb('undo', 'Undo (Ctrl+Z)', undo); undoBtn.dataset.tipOff = 'Nothing to undo yet';
  redoBtn = tb('redo', 'Redo (Ctrl+Shift+Z)', redo); redoBtn.dataset.tipOff = 'Nothing to redo';
  snapBtn = tb('magnet', 'Snapping (N): clips line up with each other and the playhead', () => { store.snap = !store.snap; snapBtn.classList.toggle('on', store.snap); }, '.on');
  zoomRange = h('input', { type: 'range', min: 0, max: 100, step: 'any', value: zoomToSlider(store.zoom), 'data-tip': 'Zoom the timeline', oninput: () => setZoom(sliderToZoom(+zoomRange.value)) });
  paintZoom();
  capBtn = tb('cc', 'Captions: make them from the speech', () => (captionClips().length ? openCaptionEditor() : openCaptions()));
  const toolbar = h('div.tl-toolbar',
    undoBtn, redoBtn, h('div.sep'),
    when(tb('split', 'Split at the playhead (Ctrl+B)', splitAtPlayhead), () => splitTargets().length > 0, 'Move the playhead over a clip first'),
    when(tb('trash', 'Delete the selected clips (Del)', () => deleteSelected(false)), () => picked() || !!store.selectedTransition, 'Select a clip first'),
    when(tb('copy', 'Duplicate the selected clips (Ctrl+D)', duplicateSelected), picked, 'Select a clip first'),
    h('div.sep'),
    when(tb('freeze', 'Freeze frame: hold the picture at the playhead for 2 seconds', freezeFrame), canFreeze, 'Move the playhead over a video clip first'),
    when(tb('detach', 'Detach audio onto its own track', detachAudio), () => selectedClips().some((c) => c.type === 'video' && !c.muted), 'Select a video clip with sound first'),
    h('div.sep'),
    when(tb('crop', 'Crop: cut away the edges of the picture', () => inspect('crop')), has('crop'), 'Select a video or photo first'),
    when(tb('speed', 'Speed: make the clip faster or slower', () => inspect('speed')), has('speed'), 'Select a video or sound clip first'),
    when(tb('color', 'Color: brightness, contrast and tint', () => inspect('color')), has('color'), 'Select a video, photo or sticker first'),
    when(tb('volume', 'Audio: volume, fades and sound', () => inspect('audio')), has('audio'), 'Select a clip with sound first'),
    h('div.sep'),
    tb('mic', 'Record a voiceover at the playhead (R)', openVoiceover),
    tb('screen', 'Record your screen, with a webcam bubble (Shift+R)', openScreenRecord),
    capBtn,
    h('div.sep'), snapBtn,
    h('div.sp'),
    h('span.hint', { id: 'tl-dur' }),
    h('div.sep'),
    tb('zoomOut', 'Zoom out (-)', () => setZoom(store.zoom / 1.4)),
    zoomRange,
    tb('zoomIn', 'Zoom in (+)', () => setZoom(store.zoom * 1.4)),
    tb('fit', 'Fit the whole video in view (Shift+Z)', zoomFit));
  headsInner = h('div.tl-heads-inner');
  const heads = h('div.tl-heads', h('div.tl-ruler-pad', h('button.ibtn.sm', { 'data-tip': 'Add video track', onclick: () => edit(() => ensureTrack('video', 'top')) }, icon('plus', 15)), h('span.hint', 'Tracks')), headsInner);
  rulerCv = h('canvas');
  ruler = h('div.tl-ruler', rulerCv);
  tracksEl = h('div');
  playheadEl = h('div.playhead', h('i'));
  content = h('div.tl-content', ruler, tracksEl, playheadEl);
  scroll = h('div.tl-scroll', content);
  root.append(toolbar, h('div.tl-main', heads, scroll));

  scroll.addEventListener('scroll', () => { headsInner.style.transform = `translateY(${-scroll.scrollTop}px)`; drawRuler(); });
  scroll.addEventListener('wheel', onWheel, { passive: false });
  ruler.addEventListener('pointerdown', onRulerDown);
  playheadEl.querySelector('i').addEventListener('pointerdown', onRulerDown);
  tracksEl.addEventListener('pointerdown', onTracksDown);
  tracksEl.addEventListener('contextmenu', onContext);
  tracksEl.addEventListener('dblclick', (e) => { if (e.target.closest('.clip')) store.emit('inspect', null); });
  content.addEventListener('dragover', onDragOver);
  content.addEventListener('dragleave', (e) => { if (!content.contains(e.relatedTarget)) clearDropUi(); });
  content.addEventListener('drop', onDrop);
  new ResizeObserver(() => { render(); }).observe(scroll);

  store.on('change', () => render());
  store.on('selection', () => { paintSelection(); updateTools(); });
  store.on('time', () => { placePlayhead(true); updateTools(); });
  store.on('strip', () => repaintStrips());
  store.on('waveform', () => repaintStrips());
  store.on('media', () => render());
  store.on('dndend', clearDropUi);
  render();
}

// ---------- zoom ----------
// The slider is logarithmic on both sides of the default zoom (80 px/s), which sits in the middle.
const ZMIN = 4, ZMID = 80, ZMAX = 400;
const sliderToZoom = (v) => (v <= 50 ? ZMIN * Math.pow(ZMID / ZMIN, v / 50) : ZMID * Math.pow(ZMAX / ZMID, (v - 50) / 50));
const zoomToSlider = (z) => (z <= ZMID ? 50 * Math.log(z / ZMIN) / Math.log(ZMID / ZMIN) : 50 + 50 * Math.log(z / ZMID) / Math.log(ZMAX / ZMID));
// The blue part of the track ends at the thumb.
const paintZoom = () => zoomRange.style.setProperty('--fill', `${zoomRange.value}%`);
export function setZoom(z, anchorX) {
  const old = store.zoom;
  z = clamp(z, 4, 400);
  const ax = anchorX ?? (timeToX(store.time) - scroll.scrollLeft);
  const tAt = (scroll.scrollLeft + ax) / old;
  store.zoom = z;
  zoomRange.value = zoomToSlider(z);
  paintZoom();
  render();
  scroll.scrollLeft = tAt * z - ax;
}
export function zoomFit() {
  // An empty project has nothing to fit: start at the default zoom, the middle of the slider.
  if (!store.project.clips.length) { setZoom(ZMID, 0); scroll.scrollLeft = 0; return; }
  const d = Math.max(5, projectDuration());
  setZoom((scroll.clientWidth - 40) / d, 0);
  scroll.scrollLeft = 0;
}
function onWheel(e) {
  if (e.ctrlKey || (IS_MAC && e.metaKey)) { // pinch on a trackpad arrives as Ctrl+wheel; ⌘+scroll also zooms on a Mac
    e.preventDefault();
    const r = scroll.getBoundingClientRect();
    setZoom(store.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left);
  }
}

const timeToX = (t) => t * store.zoom;
const xToTime = (x) => Math.max(0, x / store.zoom);
const contentX = (e) => e.clientX - scroll.getBoundingClientRect().left + scroll.scrollLeft;
const contentY = (e) => e.clientY - scroll.getBoundingClientRect().top + scroll.scrollTop;

// ---------- rendering ----------
export function render() {
  if (!store.project || !scroll) return;
  const p = store.project;
  const dur = projectDuration();
  const width = Math.max(scroll.clientWidth, timeToX(dur + 30));
  content.style.width = width + 'px';
  undoBtn.disabled = !store.undoStack.length;
  redoBtn.disabled = !store.redoStack.length;
  updateTools();
  document.getElementById('tl-dur').textContent = `Duration ${fmtTime(dur, p.fps)}`;

  layout = [];
  let y = 0;
  const heads = [];
  const lanes = [];
  const newTop = h('div.tl-new-track', { 'data-new': 'top' }, 'Drop here to add a video track');
  lanes.push(newTop);
  heads.push(h('div', { style: { height: NEW_H + 'px', borderBottom: '1px dashed var(--line)' } }));
  y += NEW_H;
  for (const t of p.tracks) {
    const th = TRACK_H[t.kind];
    layout.push({ track: t, y, h: th });
    y += th;
    heads.push(trackHead(t, th));
    const lane = h(`div.tl-track${t.kind === 'audio' ? '.audio' : ''}`, { 'data-track': t.id, style: { height: th + 'px' } });
    if (t.locked) lane.classList.add('locked');
    for (const c of trackClips(t.id)) lane.append(clipEl(c, th));
    for (const c of trackClips(t.id)) for (const m of transitionMarkers(c)) lane.append(m);
    lanes.push(lane);
  }
  lanes.push(h('div.tl-new-track', { 'data-new': 'bottom' }, 'Drop audio here to add a track'));
  heads.push(h('div', { style: { height: NEW_H + 'px' } }));
  tracksEl.replaceChildren(...lanes);
  headsInner.replaceChildren(...heads);
  content.style.height = RULER_H + y + NEW_H + 40 + 'px';
  drawRuler();
  placePlayhead();
  paintSelection();
  repaintStrips();
}

function trackHead(t, th) {
  const isV = t.kind === 'video';
  const btn = (name, tip, on, fn) => h('button.ibtn', { class: `ibtn${on ? ' on' : ''}`, 'data-tip': tip, onclick: () => edit(fn) }, icon(name, 15));
  const head = h(`div.tl-head${isV ? '' : '.audio'}`, { style: { height: th + 'px' } },
    h('div.nm', icon(isV ? (t.main ? 'film' : 'layers') : 'audio', 14), t.name),
    isV ? btn(t.hidden ? 'eyeOff' : 'eye', t.hidden ? 'Show track' : 'Hide track', t.hidden, () => { t.hidden = !t.hidden; }) : null,
    btn(t.muted ? 'mute' : 'volume', t.muted ? 'Unmute track' : 'Mute track', t.muted, () => { t.muted = !t.muted; }),
    btn(t.locked ? 'lock' : 'unlock', t.locked ? 'Unlock track' : 'Lock track', t.locked, () => { t.locked = !t.locked; }));
  head.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { label: 'Add video track', icon: 'plus', run: () => edit(() => ensureTrack('video', 'top')) },
      { label: 'Add audio track', icon: 'plus', run: () => edit(() => ensureTrack('audio')) },
      { label: 'Rename track', icon: 'text', run: () => { const n = prompt('Track name', t.name); if (n) edit(() => { t.name = n; }); } },
      '-',
      { label: 'Delete track', icon: 'trash', disabled: t.main, run: () => edit(() => deleteTrack(t.id)) },
    ]);
  });
  return head;
}

function clipEl(c, th) {
  const m = c.mediaId ? mediaById(c.mediaId) : null;
  const el = h(`div.clip.t-${c.type}`, { 'data-clip': c.id, style: { left: timeToX(c.start) + 'px', width: Math.max(4, timeToX(c.duration)) + 'px' } });
  if (m?.missing) el.classList.add('missing');
  if (c.muted && (c.type === 'audio')) el.classList.add('muted');
  const tags = [];
  if (c.speed && Math.abs(c.speed - 1) > 0.001 && c.speed > 0.001) tags.push(h('span.tag', `${+c.speed.toFixed(2)}×`));
  if (c.type === 'video' && c.muted) tags.push(h('span.tag', icon('mute', 11)));
  if (c.chroma?.on) tags.push(h('span.tag', 'Key'));
  el.append(h('div.lbl', c.name, tags));
  if (c.type === 'video' || c.type === 'image' || c.type === 'audio' || ((c.type === 'title' || c.type === 'element' || c.type === 'background'))) {
    el.append(h('canvas.strip'));
  }
  const fx = [];
  if (c.filter) fx.push('F');
  if (c.effects?.length) fx.push(`FX${c.effects.length > 1 ? c.effects.length : ''}`);
  if (c.audioFx && (c.audioFx.preset !== 'none' || c.audioFx.denoise)) fx.push('♪FX');
  if (c.anim && (c.anim.in || c.anim.out || c.anim.loop)) fx.push('Anim');
  if (fx.length) el.append(h('div.fxdot', fx.map((f) => h('i', f))));
  // fades
  if (c.fadeIn > 0) el.append(h('div.fade', { style: { left: 0, width: timeToX(c.fadeIn) + 'px', background: 'linear-gradient(to top right, #0008 50%, transparent 50%)' } }));
  if (c.fadeOut > 0) el.append(h('div.fade', { style: { right: 0, width: timeToX(c.fadeOut) + 'px', background: 'linear-gradient(to top left, #0008 50%, transparent 50%)' } }));
  el.append(h('div.trim.l', { 'data-trim': 'l' }), h('div.trim.r', { 'data-trim': 'r' }));
  return el;
}

function transitionMarkers(c) {
  const out = [];
  const mk = (side, x, w) => {
    const sel = store.selectedTransition && store.selectedTransition.clipId === c.id && store.selectedTransition.side === side;
    const el = h('div.trans', { class: `trans${sel ? ' selected' : ''}`, 'data-trans': c.id, 'data-side': side, title: transitionById((side === 'in' ? c.tIn : c.tOut).id).name, style: { left: x + 'px', width: Math.max(16, w) + 'px' } }, icon('transition', 14));
    out.push(el);
  };
  if (c.tIn) {
    const prev = prevAdjacent(c);
    const d = Math.min(c.tIn.duration, c.duration);
    if (prev) mk('in', timeToX(c.start - d / 2), timeToX(d));
    else mk('in', timeToX(c.start), timeToX(d));
  }
  if (c.tOut && !nextAdjacent(c)?.tIn) {
    const d = Math.min(c.tOut.duration, c.duration);
    mk('out', timeToX(clipEnd(c) - d), timeToX(d));
  }
  return out;
}

function repaintStrips() {
  if (!tracksEl) return;
  for (const el of tracksEl.querySelectorAll('.clip')) {
    const c = clipById(el.dataset.clip);
    const cv = el.querySelector('canvas.strip');
    if (!c || !cv) continue;
    drawStrip(cv, c, el);
  }
}

function drawStrip(cv, c, el) {
  const w = Math.min(16000, Math.max(4, Math.round(timeToX(c.duration))));
  const hh = el.clientHeight || 54;
  const sl = scroll.scrollLeft, vis = scroll.clientWidth;
  if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; cv.style.width = w + 'px'; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, hh);
  const m = c.mediaId ? mediaById(c.mediaId) : null;
  const speed = c.speed || 1;
  const left = timeToX(c.start);
  const x0 = Math.max(0, sl - left - 200), x1 = Math.min(w, sl - left + vis + 200);
  const showWave = c.type === 'audio' || (c.type === 'video' && m?.hasAudio && !c.muted);
  const waveH = c.type === 'audio' ? hh - 16 : 16;
  const imgH = c.type === 'audio' ? 0 : hh - (showWave ? waveH : 0);
  if (c.type === 'video' && m) {
    const tw = Math.max(20, imgH * (m.width / m.height || 16 / 9));
    ctx.globalAlpha = 0.95;
    for (let x = Math.floor(x0 / tw) * tw; x < x1; x += tw) {
      const t = (c.in || 0) + (x / store.zoom) * speed;
      const f = stripFrameAt(m.id, t);
      if (f) ctx.drawImage(f, x, 0, tw, imgH);
    }
    ctx.globalAlpha = 1;
  } else if (c.type === 'image') {
    const img = thumbs.get(c.mediaId);
    if (img) {
      let im = cv.__img;
      if (!im || im.src !== img) { im = new Image(); im.src = img; cv.__img = im; im.onload = () => drawStrip(cv, c, el); }
      if (im.complete) { const tw = Math.max(20, imgH * (im.width / im.height)); for (let x = Math.floor(x0 / tw) * tw; x < x1; x += tw) ctx.drawImage(im, x, 0, tw, imgH); }
    }
  }
  if (showWave && m) {
    const pk = peaks.get(c.audioFx?.denoisePath || playPath(m)) || peaks.get(playPath(m));
    if (pk) {
      const top = hh - waveH, mid = top + waveH / 2;
      ctx.fillStyle = c.type === 'audio' ? 'rgba(255,255,255,0.75)' : 'rgba(31,209,185,0.85)';
      if (c.type !== 'audio') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, top, w, waveH); ctx.fillStyle = 'rgba(31,209,185,0.9)'; }
      const vol = Math.min(2, c.volume ?? 1);
      for (let x = Math.floor(x0); x < x1; x += 2) {
        const t = (c.in || 0) + (x / store.zoom) * speed;
        const i = Math.floor(t * 50);
        const v = Math.min(1, (pk[i] || 0) * vol);
        const hgt = Math.max(1, v * waveH * 0.95);
        ctx.fillRect(x, mid - hgt / 2, 1.5, hgt);
      }
    }
  }
}

function drawRuler() {
  if (!rulerCv) return;
  const w = scroll.clientWidth, dpr = devicePixelRatio || 1;
  rulerCv.width = w * dpr; rulerCv.height = RULER_H * dpr;
  rulerCv.style.width = w + 'px'; rulerCv.style.height = RULER_H + 'px';
  rulerCv.style.left = scroll.scrollLeft + 'px';
  const ctx = rulerCv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, RULER_H);
  const z = store.zoom;
  const steps = [1 / 30, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const major = steps.find((s) => s * z >= 90) || 600;
  const minor = major / (major >= 1 ? 5 : 2);
  const t0 = scroll.scrollLeft / z, t1 = t0 + w / z;
  ctx.strokeStyle = '#3a3e48'; ctx.fillStyle = '#8b909c'; ctx.font = '10.5px Inter, sans-serif'; ctx.textBaseline = 'top';
  ctx.beginPath();
  for (let t = Math.floor(t0 / minor) * minor; t <= t1; t += minor) {
    const x = Math.round((t - t0) * z) + 0.5;
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    ctx.moveTo(x, RULER_H); ctx.lineTo(x, RULER_H - (isMajor ? 12 : 6));
    if (isMajor) ctx.fillText(fmtRuler(t, major), x + 4, 4);
  }
  ctx.stroke();
}
const fmtRuler = (t, major) => {
  t = Math.round(t * 1000) / 1000;
  const m = Math.floor(t / 60), s = t - m * 60;
  // under a second apart: seconds with decimals (00:01.5), never minutes:seconds:frames, which reads as h:mm:ss
  if (major < 1 && Math.abs(s - Math.round(s)) > 1e-4) { const d = major >= 0.5 ? 1 : 2; return `${String(m).padStart(2, '0')}:${s.toFixed(d).padStart(3 + d, '0')}`; }
  return `${String(m).padStart(2, '0')}:${String(Math.round(s)).padStart(2, '0')}`;
};

function placePlayhead(follow) {
  const x = timeToX(store.time);
  playheadEl.style.left = x + 'px';
  playheadEl.style.height = content.style.height;
  // A voiceover can run past the end of the project: grow the timeline ahead of the playhead.
  const need = x + 30 * store.zoom;
  if (parseFloat(content.style.width) < need) { content.style.width = need + 'px'; drawRuler(); }
  if (follow && store.playing) {
    if (x > scroll.scrollLeft + scroll.clientWidth - 60) scroll.scrollLeft = x - 120;
    else if (x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - 60);
  }
}

function paintSelection() {
  for (const el of tracksEl.querySelectorAll('.clip')) el.classList.toggle('selected', store.selection.has(el.dataset.clip));
  for (const el of tracksEl.querySelectorAll('.trans')) {
    const st = store.selectedTransition;
    el.classList.toggle('selected', !!st && st.clipId === el.dataset.trans && st.side === el.dataset.side);
  }
}

// ---------- pointer interactions ----------
function trackAtY(y) {
  const yy = y - RULER_H;
  return layout.find((l) => yy >= l.y + NEW_H * 0 && yy < l.y + l.h) || null;
}
function layoutY(y) { return y - RULER_H; }

function onRulerDown(e) {
  e.preventDefault();
  const move = (ev) => app.player.seek(xToTime(contentX(ev)));
  move(e);
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
}

function onTracksDown(e) {
  if (e.button !== 0) return;
  const transEl = e.target.closest('.trans');
  if (transEl) { selectTransition(transEl.dataset.trans, transEl.dataset.side); store.emit('inspect', 'transition'); return; }
  const clipNode = e.target.closest('.clip');
  if (!clipNode) return startMarquee(e);
  const c = clipById(clipNode.dataset.clip);
  if (!c) return;
  const tr = trackById(c.trackId);
  const additive = e.shiftKey || e.ctrlKey || e.metaKey;
  if (additive) select(c.id, true);
  else if (!store.selection.has(c.id)) select(c.id);
  if (tr?.locked) return;
  const trim = e.target.dataset.trim;
  const x0 = contentX(e), y0 = contentY(e);
  const sel = [...store.selection].map(clipById).filter(Boolean);
  const orig = new Map(sel.map((o) => [o.id, { start: o.start, duration: o.duration, in: o.in, trackId: o.trackId }]));
  let started = false;
  const exclude = new Set(sel.map((o) => o.id));
  const move = (ev) => {
    const dx = contentX(ev) - x0;
    if (!started) { if (Math.abs(dx) < 3 && Math.abs(contentY(ev) - y0) < 3) return; started = true; checkpoint(); }
    let dt = dx / store.zoom;
    let snapAt = null;
    if (trim === 'l') {
      const o = orig.get(c.id);
      let ns = snapTime(o.start + dt, store.zoom, exclude);
      snapAt = ns !== o.start + dt ? ns : null;
      const minStart = c.type === 'video' || c.type === 'audio' ? o.start - (o.in || 0) / (c.speed || 1) : -Infinity;
      ns = clamp(ns, Math.max(0, minStart), o.start + o.duration - 0.1);
      const by = ns - o.start;
      c.start = ns; c.duration = o.duration - by;
      if ('in' in c) c.in = (o.in || 0) + by * (c.speed || 1);
    } else if (trim === 'r') {
      const o = orig.get(c.id);
      let ne = snapTime(o.start + o.duration + dt, store.zoom, exclude);
      snapAt = ne !== o.start + o.duration + dt ? ne : null;
      c.duration = clamp(ne - o.start, 0.1, maxDuration(c));
    } else {
      // move: snap the dragged clip's start or end
      const o = orig.get(c.id);
      let ns = o.start + dt;
      const s1 = snapTime(ns, store.zoom, exclude);
      const s2 = snapTime(ns + o.duration, store.zoom, exclude) - o.duration;
      if (s1 !== ns) { snapAt = s1; ns = s1; } else if (s2 !== ns) { snapAt = s2 + o.duration; ns = s2; }
      dt = ns - o.start;
      const minStart = Math.min(...sel.map((s) => orig.get(s.id).start));
      if (minStart + dt < 0) dt = -minStart;
      // vertical: change track when all selected share a kind
      const lt = trackAtY(contentY(ev));
      const kinds = new Set(sel.map((s) => (s.type === 'audio' ? 'audio' : 'video')));
      let trackShift = 0;
      if (lt && kinds.size === 1 && lt.track.kind === [...kinds][0] && !lt.track.locked) {
        const sameKind = store.project.tracks.filter((t) => t.kind === lt.track.kind);
        trackShift = sameKind.indexOf(lt.track) - sameKind.indexOf(trackById(o.trackId));
        for (const s of sel) { const i = sameKind.indexOf(trackById(orig.get(s.id).trackId)); if (i + trackShift < 0 || i + trackShift >= sameKind.length) trackShift = 0; }
        for (const s of sel) { const i = sameKind.indexOf(trackById(orig.get(s.id).trackId)); s.trackId = sameKind[i + trackShift].id; }
      }
      for (const s of sel) s.start = orig.get(s.id).start + dt;
    }
    showSnap(snapAt);
    changed('drag');
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    showSnap(null);
    if (!started) { if (!additive && !trim) { select(c.id); app.player.seek(store.time); } return; }
    // resolve overlaps (overwrite whatever the dropped clips land on)
    for (const s of sel) { clearRange(s.trackId, s.start, clipEnd(s), s.id); }
    for (const s of sel) for (const o of sel) if (o !== s && o.trackId === s.trackId) { /* selected clips keep their relative layout */ }
    changed();
    app.player.seek(store.time);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
}

function showSnap(t) {
  if (t == null) { ui.snapLine?.remove(); ui.snapLine = null; return; }
  if (!ui.snapLine) { ui.snapLine = h('div.snapline'); content.append(ui.snapLine); }
  ui.snapLine.style.left = timeToX(t) + 'px';
}

function startMarquee(e) {
  const x0 = contentX(e), y0 = contentY(e);
  const add = e.shiftKey || e.ctrlKey || (IS_MAC && e.metaKey); // Ctrl-click is a right-click on a Mac
  let box = null;
  const move = (ev) => {
    const x1 = contentX(ev), y1 = contentY(ev);
    if (!box && Math.hypot(x1 - x0, y1 - y0) < 4) return;
    if (!box) { box = h('div.marquee'); content.append(box); }
    const l = Math.min(x0, x1), t = Math.min(y0, y1), w = Math.abs(x1 - x0), hh = Math.abs(y1 - y0);
    Object.assign(box.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: hh + 'px' });
    const ids = [];
    for (const L of layout) {
      const ty = L.y + RULER_H;
      if (ty + L.h < t || ty > t + hh) continue;
      for (const c of trackClips(L.track.id)) if (timeToX(clipEnd(c)) > l && timeToX(c.start) < l + w) ids.push(c.id);
    }
    select(ids, false);
  };
  const up = (ev) => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    if (box) { box.remove(); return; }
    if (!add) select([]);
    app.player.seek(xToTime(contentX(ev)));
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
}

function onContext(e) {
  e.preventDefault();
  const node = e.target.closest('.clip');
  if (!node) {
    showMenu(e.clientX, e.clientY, [
      { label: 'Paste', icon: 'copy', kbd: 'Ctrl+V', disabled: !store.clipboard, run: paste },
      { label: 'Add video track', icon: 'plus', run: () => edit(() => ensureTrack('video', 'top')) },
      { label: 'Add audio track', icon: 'plus', run: () => edit(() => ensureTrack('audio')) },
    ]);
    return;
  }
  const c = clipById(node.dataset.clip);
  if (!store.selection.has(c.id)) select(c.id);
  const isAv = c.type === 'video' || c.type === 'audio';
  showMenu(e.clientX, e.clientY, [
    { label: 'Split at playhead', icon: 'split', kbd: 'Ctrl+B', run: splitAtPlayhead },
    { label: 'Duplicate', icon: 'copy', kbd: 'Ctrl+D', run: duplicateSelected },
    { label: 'Copy', icon: 'copy', kbd: 'Ctrl+C', run: copySelected },
    '-',
    ...(isAv ? [{ label: c.muted ? 'Unmute' : 'Mute', icon: c.muted ? 'volume' : 'mute', run: () => edit(() => { c.muted = !c.muted; }) }] : []),
    ...clipItems(c, { hide: true }),
    '-',
    { label: 'Delete', icon: 'trash', kbd: 'Del', run: () => deleteSelected(false) },
    { label: 'Ripple delete', icon: 'trash', kbd: 'Shift+Del', run: () => deleteSelected(true) },
  ]);
}


// ---------- drag & drop from library / files ----------
function clearDropUi() {
  ui.ghost?.remove(); ui.ghost = null;
  ui.cutHint?.remove(); ui.cutHint = null;
  tracksEl?.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
  tracksEl?.querySelectorAll('.clip.selected-drop').forEach((n) => n.classList.remove('selected-drop'));
}

function dropTarget(e) {
  const pl = dnd.payload;
  const x = contentX(e), y = contentY(e);
  const t = xToTime(x);
  const newEl = e.target.closest('.tl-new-track');
  const L = trackAtY(y);
  const clipNode = e.target.closest('.clip');
  if (!pl) return { files: true, t, track: L?.track, newTrack: newEl?.dataset.new };
  if (pl.kind === 'transition') {
    if (!L || L.track.kind !== 'video') return null;
    // nearest edge within 40px
    let best = null, bd = 40 / store.zoom;
    for (const c of trackClips(L.track.id)) {
      if (!VISUAL.has(c.type)) continue;
      const ds = Math.abs(c.start - t); if (ds < bd) { bd = ds; best = { clip: c, side: 'in', at: c.start }; }
      const de = Math.abs(clipEnd(c) - t); if (de < bd && !nextAdjacent(c)) { bd = de; best = { clip: c, side: 'out', at: clipEnd(c) }; }
    }
    if (!best && clipNode) { const c = clipById(clipNode.dataset.clip); if (c && VISUAL.has(c.type)) best = { clip: c, side: t - c.start < clipEnd(c) - t ? 'in' : 'out', at: t - c.start < clipEnd(c) - t ? c.start : clipEnd(c) }; }
    return best ? { trans: best, track: L.track } : null;
  }
  if ((pl.kind === 'effect' || pl.kind === 'filter') && clipNode) {
    const c = clipById(clipNode.dataset.clip);
    if (c && VISUAL.has(c.type) && c.type !== 'adjust') return { onClip: c };
  }
  const kind = pl.kind === 'pack' ? 'video' : pl.kind === 'audio-lib' || (pl.kind === 'media' && mediaById(pl.id)?.type === 'audio') ? 'audio' : 'video';
  if (newEl) return { newTrack: newEl.dataset.new === 'top' && kind === 'video' ? 'top' : kind === 'audio' ? 'bottom' : 'top', kind, t: snapTime(t, store.zoom) };
  if (!L || L.track.kind !== kind || L.track.locked) return null;
  return { track: L.track, t: snapTime(t, store.zoom), kind };
}

function onDragOver(e) {
  const files = e.dataTransfer.types.includes('Files');
  if (!dnd.payload && !files) return;
  const d = dropTarget(e);
  clearDropUi();
  if (!d) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  if (d.trans) {
    const lane = tracksEl.querySelector(`[data-track="${d.track.id}"]`);
    ui.cutHint = h('div.cut-hint', { style: { left: timeToX(d.trans.at) + 'px' } });
    lane.append(ui.cutHint);
    return;
  }
  if (d.onClip) { tracksEl.querySelector(`[data-clip="${d.onClip.id}"]`)?.classList.add('selected'); ui.cutHint = { remove: () => paintSelection() }; return; }
  if (d.newTrack) { tracksEl.querySelector(`[data-new="${d.newTrack === 'top' ? 'top' : 'bottom'}"]`)?.classList.add('drop'); return; }
  if (d.track) {
    const lane = tracksEl.querySelector(`[data-track="${d.track.id}"]`);
    lane.classList.add('drop');
    if (dnd.payload) {
      ui.ghost = h('div.drop-ghost', { style: { left: timeToX(d.t) + 'px', width: timeToX(dnd.duration) + 'px' } });
      lane.append(ui.ghost);
    }
  }
}

async function onDrop(e) {
  e.preventDefault();
  const d = dropTarget(e);
  clearDropUi();
  const pl = dnd.payload;
  dnd.payload = null;
  if (!d) return;
  try {
    if (!pl) {
      const paths = [...e.dataTransfer.files].map((f) => window.native.pathForFile(f)).filter(Boolean);
      const media = await importPaths(paths);
      let t = d.t;
      for (const m of media) {
        await insertItem({ kind: 'media', id: m.id }, { trackId: m.type === 'audio' ? null : d.track?.kind === 'video' ? d.track.id : null, time: t, newTrack: d.newTrack });
        t += m.type === 'image' ? 5 : m.duration;
      }
      return;
    }
    if (d.trans) {
      edit(() => setTransition(d.trans.clip, d.trans.side, pl.id));
      selectTransition(d.trans.clip.id, d.trans.side);
      app.player.seek(store.time);
      return;
    }
    if (d.onClip) { applyLookToClip(d.onClip.id, pl); app.player.seek(store.time); return; }
    await insertItem(pl, { trackId: d.track?.id, time: d.t, newTrack: d.newTrack });
    app.player.seek(store.time);
  } catch (err) { toast(err.message, 'err'); }
}

export function scrollToTime(t) {
  const x = timeToX(t);
  if (x < scroll.scrollLeft || x > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = x - scroll.clientWidth / 3;
}

export { layoutY };
