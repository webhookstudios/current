// Preview panel: rendered output, transport controls, and on-canvas move/scale/rotate handles.
import { h, icon, fmtTime, clamp, IS_MAC } from '../util.js';
import { segmentedFor } from './widgets.js';
import { store, selectedClips, projectDuration, checkpoint, changed, mediaById } from '../state.js';
import { app } from '../actions.js';
import { images } from '../engine/media.js';
import { drawTemplateTo } from '../engine/renderer.js';

let stage, frame, canvas, overlay, playBtn, tcCur, tcDur, meterL, scrubFill, busyEl, qualitySel;

export function initPreview(el, compositorCanvas) {
  canvas = compositorCanvas;
  canvas.className = 'out';
  overlay = h('div.overlay');
  frame = h('div.frame', canvas, overlay);
  busyEl = h('div.busy.hidden', h('div.spinner'), h('span'));
  const scrub = h('div.scrub', scrubFill = h('i'));
  scrub.addEventListener('pointerdown', (e) => {
    const go = (ev) => { const r = scrub.getBoundingClientRect(); app.player.seek(clamp((ev.clientX - r.left) / r.width) * Math.max(0.01, projectDuration())); };
    go(e);
    const up = () => { removeEventListener('pointermove', go); removeEventListener('pointerup', up); };
    addEventListener('pointermove', go); addEventListener('pointerup', up);
  });
  stage = h('div.stage', frame, busyEl, scrub);
  playBtn = h('button.ibtn.play', { 'data-tip': 'Play / Pause (Space)', class: 'ibtn play tip-up', onclick: () => app.player.toggle() }, icon('play', 18));
  tcCur = h('b'); tcDur = h('span');
  meterL = h('i');
  qualitySel = h('select', { title: 'Preview quality', onchange: () => { app.player.scale = +qualitySel.value; app.player.requestRender(); } },
    [['1', 'Full'], ['0.5', '1/2'], ['0.25', '1/4']].map(([v, t]) => h('option', { value: v, selected: v === '0.5' }, t)));
  const fps = () => store.project.fps || 30;
  const bar = h('div.transport',
    h('div.timecode', tcCur, h('span', ' / '), tcDur),
    h('div.sp'),
    h('button.ibtn.tip-up', { 'data-tip': 'Previous frame (←)', onclick: () => app.player.seek(store.time - 1 / fps()) }, icon('prev', 16)),
    playBtn,
    h('button.ibtn.tip-up', { 'data-tip': 'Next frame (→)', onclick: () => app.player.seek(store.time + 1 / fps()) }, icon('next', 16)),
    h('button.ibtn.tip-up', { 'data-tip': 'Stop', onclick: () => { app.player.pause(); app.player.seek(0); } }, icon('stop', 16)),
    h('div.sp'),
    h('div.meter', { title: 'Audio level' }, meterL),
    IS_MAC ? segmentedFor(qualitySel, 'Preview quality') : qualitySel,
    h('button.ibtn.tip-up', { 'data-tip': 'Snapshot (save frame as PNG)', onclick: snapshot }, icon('camera', 17)),
    h('button.ibtn.tip-up', { 'data-tip': 'Full screen', onclick: () => stage.requestFullscreen?.() }, icon('fullscreen', 17)));
  el.append(stage, bar);
  new ResizeObserver(fit).observe(stage);
  store.on('play', (p) => { playBtn.replaceChildren(icon(p ? 'pause' : 'play', 18)); drawHandles(); });
  store.on('time', () => { updateTime(); if (!store.playing) drawHandles(); });
  store.on('change', () => { fit(); updateTime(); app.player.requestRender(); drawHandles(); });
  store.on('selection', () => { cancelColorPick(); partSel = null; drawHandles(); });
  levelLoop();
}

export function busy(msg) {
  if (!busyEl) return () => {};
  if (!msg) { busyEl.classList.add('hidden'); return () => {}; }
  busyEl.lastChild.textContent = msg;
  busyEl.classList.remove('hidden');
  return () => busyEl.classList.add('hidden');
}

function fit() {
  if (!store.project) return;
  const { width, height } = store.project;
  const sw = stage.clientWidth - 24, sh = stage.clientHeight - 24;
  const s = Math.min(sw / width, sh / height);
  frame.style.width = Math.round(width * s) + 'px';
  frame.style.height = Math.round(height * s) + 'px';
  drawHandles();
}

function updateTime() {
  const fps = store.project.fps || 30;
  const d = projectDuration();
  tcCur.textContent = fmtTime(store.time, fps);
  tcDur.textContent = fmtTime(d, fps);
  scrubFill.style.width = `${d ? clamp(store.time / d) * 100 : 0}%`;
}

function levelLoop() {
  const an = () => app.player?.analyser;
  let buf;
  const tick = () => {
    const a = an();
    if (a) {
      buf ||= new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(buf);
      let pk = 0; for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i]));
      const db = 20 * Math.log10(pk + 1e-6);
      meterL.style.height = `${clamp((db + 48) / 48) * 100}%`;
    }
    setTimeout(() => requestAnimationFrame(tick), 50);
  };
  tick();
}

async function snapshot() {
  const p = store.project;
  const prev = app.player.scale;
  app.player.scale = 1;
  app.player.renderNow(store.time);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  app.player.scale = prev;
  app.player.requestRender();
  const buf = await blob.arrayBuffer();
  const path = await window.native.cacheWrite(`snapshot-${Date.now()}.png`, buf);
  const { importPaths } = await import('../actions.js');
  const [m] = await importPaths([path]);
  if (m) m.name = `Snapshot ${fmtTime(store.time, p.fps).slice(3)}.png`;
  store.emit('media');
  const { toast } = await import('./widgets.js');
  toast('Snapshot added to Project Media');
}

// ---------- transform & crop handles ----------
// Each visual clip is a "layer" (the fitted source, or the whole frame for titles and stickers)
// centred at C and rotated by the clip's rotation. The selection box hugs the visible content
// inside that layer: the cropped area for media, the drawn pixels for titles and stickers.
function sourceSize(c) {
  const p = store.project;
  if (c.type === 'video' || c.type === 'image') {
    const m = mediaById(c.mediaId);
    const img = images.get(c.mediaId);
    const w = m?.width || img?.naturalWidth || p.width, hh = m?.height || img?.naturalHeight || p.height;
    return [w, hh];
  }
  return [p.width, p.height];
}

const boundsCache = new Map();
let probeCv = null;
// Union of drawn pixels over the clip's middle section, as fractions of the frame.
function templateBounds(c) {
  if (c.type === 'background') return [0, 0, 1, 1];
  const p = store.project;
  const key = JSON.stringify([c.template, c.params, c.duration, p.width, p.height]);
  if (boundsCache.has(key)) return boundsCache.get(key);
  const W = 320, H = Math.max(2, Math.round((320 * p.height) / p.width));
  probeCv ||= document.createElement('canvas');
  probeCv.width = W; probeCv.height = H;
  const ctx = probeCv.getContext('2d', { willReadFrequently: true });
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const f of [0.3, 0.45, 0.6, 0.75]) {
    drawTemplateTo(ctx, { ...c, start: 0 }, W, H, c.duration * f);
    const d = ctx.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  const pad = 4;
  const b = x1 < 0 ? [0, 0, 1, 1] : [Math.max(0, x0 - pad) / W, Math.max(0, y0 - pad) / H, Math.min(W, x1 + pad + 1) / W, Math.min(H, y1 + pad + 1) / H];
  if (boundsCache.size > 200) boundsCache.clear();
  boundsCache.set(key, b);
  return b;
}

function geom(c) {
  const p = store.project;
  const fw = frame.clientWidth, fh = frame.clientHeight, k = fw / p.width;
  const [sw, sh] = sourceSize(c);
  const fit = Math.min(p.width / sw, p.height / sh);
  const tf = c.transform;
  const Lw = sw * fit * k * tf.scale, Lh = sh * fit * k * tf.scale;
  let u0, v0, u1, v1;
  if (c.type === 'video' || c.type === 'image') { const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 }; [u0, v0, u1, v1] = [cr.l, cr.t, 1 - cr.r, 1 - cr.b]; }
  else [u0, v0, u1, v1] = templateBounds(c);
  if (tf.flipH) [u0, u1] = [1 - u1, 1 - u0];
  if (tf.flipV) [v0, v1] = [1 - v1, 1 - v0];
  const th = (tf.rotation * Math.PI) / 180;
  return { fw, fh, Lw, Lh, Cx: fw / 2 + tf.x * fw, Cy: fh / 2 + tf.y * fh, th, u0, v0, u1, v1 };
}
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// content centre in frame pixels
function contentCentre(g) {
  const [dx, dy] = rot(((g.u0 + g.u1) / 2 - 0.5) * g.Lw, ((g.v0 + g.v1) / 2 - 0.5) * g.Lh, g.th);
  return [g.Cx + dx, g.Cy + dy];
}

let cropClipId = null;
export function setCropMode(id) { if (cropClipId !== id) { cropClipId = id; drawHandles(); } }

function drawHandles() {
  overlay.replaceChildren();
  if (picker) return drawPicker();
  if (store.playing || !store.project) return;
  const sel = selectedClips();
  if (sel.length !== 1) return;
  const c = sel[0];
  if (!c.transform || c.start > store.time || c.start + c.duration <= store.time) return;
  const g = geom(c);
  const cropping = cropClipId === c.id && (c.type === 'video' || c.type === 'image');
  const layer = h('div.layerbox' + (cropping ? '.cropping' : ''), {
    style: { left: g.Cx - g.Lw / 2 + 'px', top: g.Cy - g.Lh / 2 + 'px', width: g.Lw + 'px', height: g.Lh + 'px', transform: `rotate(${c.transform.rotation}deg)` },
  });
  const box = h('div.bbox' + (cropping ? '.crop' : ''), {
    style: { left: g.u0 * 100 + '%', top: g.v0 * 100 + '%', width: (g.u1 - g.u0) * 100 + '%', height: (g.v1 - g.v0) * 100 + '%' },
  });
  if (cropping) {
    for (const [cx, cy, edges] of [[0, 0, 'lt'], [0.5, 0, 't'], [1, 0, 'rt'], [1, 0.5, 'r'], [1, 1, 'rb'], [0.5, 1, 'b'], [0, 1, 'lb'], [0, 0.5, 'l']]) {
      const hd = h('div.h', { style: { left: cx * 100 + '%', top: cy * 100 + '%', cursor: edges.length === 2 ? (edges === 'lt' || edges === 'rb' ? 'nwse-resize' : 'nesw-resize') : (cx === 0.5 ? 'ns-resize' : 'ew-resize') } });
      hd.addEventListener('pointerdown', (e) => dragCrop(e, c, edges));
      box.append(hd);
    }
    box.addEventListener('pointerdown', (e) => { if (e.target === box) dragCropMove(e, c); });
    box.append(h('div.crop-grid'));
  } else {
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const hd = h('div.h', { style: { left: cx * 100 + '%', top: cy * 100 + '%', cursor: cx === cy ? 'nwse-resize' : 'nesw-resize' } });
      hd.addEventListener('pointerdown', (e) => dragScale(e, c));
      box.append(hd);
    }
    const rh = h('div.rot');
    rh.addEventListener('pointerdown', (e) => dragRotate(e, c));
    box.append(rh);
    box.addEventListener('pointerdown', (e) => { if (e.target === box) dragMove(e, c); });
  }
  layer.append(box);
  if (c.type === 'title' && !cropping) for (const part of titleParts(c)) layer.append(partHandle(c, g, part));
  overlay.append(layer);
}

// ---------- moving the pieces of a title ----------
// Each text block, bar or line inside a title gets its own dashed handle. Dragging it moves only that
// piece (stored as params.offsets[key]); Shift-drag or dragging the outer box moves the whole title.
let partSel = null; // { clipId, key }
function titleParts(c) {
  const p = store.project;
  const W = 640, H = Math.max(2, Math.round((640 * p.height) / p.width));
  probeCv ||= document.createElement('canvas');
  probeCv.width = W; probeCv.height = H;
  const rec = [];
  drawTemplateTo(probeCv.getContext('2d', { willReadFrequently: true }), c, W, H, Math.min(Math.max(store.time, c.start), c.start + c.duration - 0.01), rec);
  return rec.filter((r) => r.w > 3 && r.h > 3).map((r) => ({ ...r, x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H }));
}
function partHandle(c, g, part) {
  const sel = partSel && partSel.clipId === c.id && partSel.key === part.key;
  let { x, w } = part;
  if (c.transform.flipH) x = 1 - x - w;
  let { y, h: ph } = part;
  if (c.transform.flipV) y = 1 - y - ph;
  const el = h('div.part' + (sel ? '.sel' : '') + `.t-${part.type}`, {
    title: 'Drag to move this piece · Shift-drag moves the whole title',
    style: { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: ph * 100 + '%' },
  });
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey) return dragMove(e, c);
    partSel = { clipId: c.id, key: part.key };
    const params = c.params;
    const x0 = e.clientX, y0 = e.clientY;
    const o = { ...(params.offsets?.[part.key] || { x: 0, y: 0 }) };
    drag((ev) => {
      const [du, dv] = layerDelta(g, c, ev.clientX - x0, ev.clientY - y0);
      params.offsets = { ...(params.offsets || {}), [part.key]: { x: o.x + du, y: o.y + dv } };
    });
  });
  return el;
}

function drag(onMove) {
  checkpoint();
  const move = (ev) => { onMove(ev); changed('drag'); };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); changed(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

function dragMove(e, c) {
  e.preventDefault();
  const fw = frame.clientWidth, fh = frame.clientHeight;
  const x0 = e.clientX, y0 = e.clientY, ox = c.transform.x, oy = c.transform.y;
  drag((ev) => {
    let nx = ox + (ev.clientX - x0) / fw, ny = oy + (ev.clientY - y0) / fh;
    if (Math.abs(nx) < 0.01) nx = 0; // centre snap
    if (Math.abs(ny) < 0.01) ny = 0;
    c.transform.x = nx; c.transform.y = ny;
  });
}

// Scale about the content centre (not the layer centre), so a sticker in a corner stays put.
function dragScale(e, c) {
  e.preventDefault(); e.stopPropagation();
  const r = frame.getBoundingClientRect();
  const g = geom(c);
  const [icx, icy] = contentCentre(g);
  const d0 = Math.hypot(e.clientX - r.left - icx, e.clientY - r.top - icy), s0 = c.transform.scale;
  const ox = ((g.u0 + g.u1) / 2 - 0.5) * g.Lw / s0, oy = ((g.v0 + g.v1) / 2 - 0.5) * g.Lh / s0;
  drag((ev) => {
    const s = clamp(s0 * Math.hypot(ev.clientX - r.left - icx, ev.clientY - r.top - icy) / Math.max(1, d0), 0.02, 10);
    const [dx, dy] = rot(ox * s, oy * s, g.th);
    c.transform.scale = s;
    c.transform.x = (icx - dx - g.fw / 2) / g.fw;
    c.transform.y = (icy - dy - g.fh / 2) / g.fh;
  });
}

function dragRotate(e, c) {
  e.preventDefault(); e.stopPropagation();
  const r = frame.getBoundingClientRect();
  const g = geom(c);
  const [icx, icy] = contentCentre(g);
  const ox = ((g.u0 + g.u1) / 2 - 0.5) * g.Lw, oy = ((g.v0 + g.v1) / 2 - 0.5) * g.Lh;
  drag((ev) => {
    let a = (Math.atan2(ev.clientY - r.top - icy, ev.clientX - r.left - icx) * 180) / Math.PI + 90;
    if (a > 180) a -= 360;
    if (ev.shiftKey) a = Math.round(a / 15) * 15;
    else for (const sn of [-180, -90, 0, 90, 180]) if (Math.abs(a - sn) < 3) a = sn;
    a = Math.round(a * 10) / 10;
    const [dx, dy] = rot(ox, oy, (a * Math.PI) / 180);
    c.transform.rotation = a;
    c.transform.x = (icx - dx - g.fw / 2) / g.fw;
    c.transform.y = (icy - dy - g.fh / 2) / g.fh;
  });
}

// Pointer movement converted to fractions of the (rotated, possibly flipped) layer.
function layerDelta(g, c, dxs, dys) {
  let [du, dv] = rot(dxs, dys, -g.th);
  du /= g.Lw; dv /= g.Lh;
  if (c.transform.flipH) du = -du;
  if (c.transform.flipV) dv = -dv;
  return [du, dv];
}

function dragCrop(e, c, edges) {
  e.preventDefault(); e.stopPropagation();
  const g = geom(c);
  const x0 = e.clientX, y0 = e.clientY;
  const o = { ...c.crop };
  const fl = c.transform.flipH, fv = c.transform.flipV;
  // screen-side edges map to crop sides through flips
  const side = { l: fl ? 'r' : 'l', r: fl ? 'l' : 'r', t: fv ? 'b' : 't', b: fv ? 't' : 'b' };
  const MIN = 0.05;
  drag((ev) => {
    const [du, dv] = layerDelta(g, c, ev.clientX - x0, ev.clientY - y0);
    const cr = c.crop;
    const sdu = fl ? -du : du, sdv = fv ? -dv : dv; // back to screen-oriented fractions
    // inward movement of a screen edge always shrinks the matching source side
    if (edges.includes('l')) cr[side.l] = clamp(o[side.l] + sdu, 0, 1 - o[side.r] - MIN);
    if (edges.includes('r')) cr[side.r] = clamp(o[side.r] - sdu, 0, 1 - o[side.l] - MIN);
    if (edges.includes('t')) cr[side.t] = clamp(o[side.t] + sdv, 0, 1 - o[side.b] - MIN);
    if (edges.includes('b')) cr[side.b] = clamp(o[side.b] - sdv, 0, 1 - o[side.t] - MIN);
  });
}

// Drag inside the crop box to slide the crop window across the picture.
function dragCropMove(e, c) {
  e.preventDefault();
  const g = geom(c);
  const x0 = e.clientX, y0 = e.clientY;
  const o = { ...c.crop };
  drag((ev) => {
    const [du, dv] = layerDelta(g, c, ev.clientX - x0, ev.clientY - y0);
    const mu = clamp(du, -o.l, o.r), mv = clamp(dv, -o.t, o.b);
    Object.assign(c.crop, { l: o.l + mu, r: o.r - mu, t: o.t + mv, b: o.b - mv });
  });
}

// ---------- colour picker ----------
// Samples any pixel of the preview. While active it is the only thing the preview responds to;
// one click picks and ends it, Esc or right-click cancels, and it ends if the selection changes.
let picker = null; // { onPick, pixels, w, h }
export const isPicking = () => !!picker;
export function startColorPick(onPick, hideKeyOf) {
  cancelColorPick();
  const c = hideKeyOf;
  const was = c?.chroma?.on;
  if (c?.chroma) c.chroma.on = false; // sample the original colours, not the keyed result
  app.player.renderNow(store.time);
  const gl = app.compositor.gl;
  const w = canvas.width, hh = canvas.height;
  const pixels = new Uint8Array(w * hh * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  if (c?.chroma) c.chroma.on = was;
  picker = { onPick, pixels, w, h: hh };
  document.addEventListener('keydown', pickerKey, true);
  drawHandles();
}
export function cancelColorPick() {
  if (!picker) return;
  picker = null;
  document.removeEventListener('keydown', pickerKey, true);
  drawHandles();
  app.player.requestRender();
  store.emit('picker', false);
}
function pickerKey(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cancelColorPick(); } }
function sampleAt(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * picker.w), y = Math.floor(((e.clientY - r.top) / r.height) * picker.h);
  if (x < 0 || y < 0 || x >= picker.w || y >= picker.h) return null;
  const i = ((picker.h - 1 - y) * picker.w + x) * 4; // GL rows are bottom-up
  return '#' + [0, 1, 2].map((k) => picker.pixels[i + k].toString(16).padStart(2, '0')).join('');
}
function drawPicker() {
  const swatch = h('div.pick-swatch');
  const banner = h('div.pick-banner', icon('color', 15), 'Click any colour in the preview', h('span', 'Esc to cancel'));
  const layer = h('div.picker', { oncontextmenu: (e) => { e.preventDefault(); cancelColorPick(); } }, swatch, banner);
  layer.addEventListener('pointermove', (e) => {
    const hex = sampleAt(e);
    if (!hex) { swatch.style.display = 'none'; return; }
    const r = layer.getBoundingClientRect();
    Object.assign(swatch.style, { display: 'flex', left: e.clientX - r.left + 16 + 'px', top: e.clientY - r.top + 16 + 'px', background: hex });
    swatch.textContent = hex;
    swatch.style.color = parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11 > 140 ? '#000' : '#fff';
  });
  layer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const hex = sampleAt(e);
    const cb = picker.onPick;
    cancelColorPick();
    if (hex) cb(hex);
  });
  overlay.append(layer);
}

// ---------- zoom to area: drag a box over the preview ----------
// The box keeps the project's shape so the zoomed picture fills the frame. Calls onDone({ x, y, w, h })
// in fractions of the frame, or nothing if Esc is pressed.
let areaPick = null;
export function startAreaPick(onDone, initial) {
  cancelAreaPick();
  const { width: PWd, height: PHt } = store.project;
  const aspect = PWd / PHt;
  const layer = h('div.area-pick', h('div.pick-banner', icon('zoomIn', 15), 'Drag a box around the area to zoom into', h('span', 'Esc to cancel')));
  const box = h('div.area-box');
  layer.append(box);
  frame.append(layer);
  const r0 = () => frame.getBoundingClientRect();
  const show = (b) => Object.assign(box.style, { display: 'block', left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' });
  if (initial) show(initial);
  const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelAreaPick(); } };
  document.addEventListener('keydown', key, true);
  layer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const r = r0();
    const sx = (e.clientX - r.left) / r.width, sy = (e.clientY - r.top) / r.height;
    let b = null;
    const move = (ev) => {
      let w = Math.abs((ev.clientX - r.left) / r.width - sx), hh = Math.abs((ev.clientY - r.top) / r.height - sy);
      // keep the project's shape: in pixels w*PW / (h*PH) = aspect, i.e. w = h in frame fractions
      const m = Math.max(w, hh);
      w = hh = clamp(m, 0.08, 1);
      const x = clamp((ev.clientX - r.left) / r.width >= sx ? sx : sx - w, 0, 1 - w);
      const y = clamp((ev.clientY - r.top) / r.height >= sy ? sy : sy - hh, 0, 1 - hh);
      b = { x, y, w, h: hh };
      show(b);
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      if (b && b.w > 0.08) { const done = areaPick.onDone; cancelAreaPick(); done(b); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  areaPick = { layer, key, onDone, aspect };
}
export function cancelAreaPick() {
  if (!areaPick) return;
  areaPick.layer.remove();
  document.removeEventListener('keydown', areaPick.key, true);
  areaPick = null;
}
