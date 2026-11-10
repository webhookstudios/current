// Right panel: properties of the selected clip, transition, or the project.
import { h, icon, fmtDur, clamp } from '../util.js';
import { store, selectedClips, clipById, checkpoint, changed, edit, mediaById, clampClip, ASPECTS, defaultColor, defaultTransform, prevAdjacent } from '../state.js';
import { app, setSpeed, detachAudio } from '../actions.js';
import { titleById } from '../templates/titles.js';
import { elementById, backgroundById } from '../templates/elements.js';
import { EFFECTS, FILTERS, effectById, filterById } from '../templates/effects.js';
import { TRANSITIONS, transitionById } from '../templates/transitions.js';
import { ANIM_IN, ANIM_OUT, ANIM_LOOP } from '../templates/anims.js';
import { AUDIO_PRESETS, denoiseSource, decodeFile, normalizeGain } from '../engine/audio.js';
import { BLEND_MODES } from '../engine/renderer.js';
import { loadPeaks, playPath } from '../engine/media.js';
import { setCropMode, startColorPick, cancelColorPick, isPicking } from './preview.js';
import { slider, select, toggle, colorRow, section, toast } from './widgets.js';

const FONTS = ['Montserrat', 'Poppins', 'Inter', 'Oswald', 'Bebas Neue', 'Anton', 'Archivo Black', 'Playfair Display', 'Abril Fatface', 'Lobster', 'Pacifico', 'Dancing Script', 'Great Vibes', 'Caveat', 'Permanent Marker', 'Bangers', 'Righteous', 'Orbitron', 'Monoton', 'Press Start 2P', 'Rubik Mono One', 'Space Grotesk', 'Noto Sans', 'DejaVu Serif', 'Liberation Mono'];
const COLORS = { video: 'var(--video)', image: 'var(--image)', title: 'var(--title)', element: 'var(--element)', background: 'var(--background)', adjust: 'var(--adjust)', audio: 'var(--audio)' };

let root, tabsEl, bodyEl, headEl;
let tab = null;
let currentKey = '';

export function initInspector(el) {
  root = el;
  headEl = h('div');
  tabsEl = h('div.insp-tabs');
  bodyEl = h('div.insp-body');
  root.append(headEl, tabsEl, bodyEl);
  store.on('selection', () => render(true));
  store.on('change', (k) => { if (k !== 'drag') render(false); });
  store.on('inspect', (t) => { if (t) tab = t; render(true); });
  render(true);
}

// live-edit helpers: one undo step per drag
const live = (fn) => ({ onStart: () => checkpoint(), onInput: (v) => { fn(v); changed('drag'); app.player.requestRender(); }, onChange: () => changed() });

function tabsFor(c) {
  if (!c) return [];
  switch (c.type) {
    case 'video': return [['video', 'Video'], ['crop', 'Crop'], ['chroma', 'Green Screen'], ['color', 'Color'], ['effects', 'Effects'], ['anim', 'Animation'], ['speed', 'Speed'], ['audio', 'Audio']];
    case 'image': return [['video', 'Image'], ['crop', 'Crop'], ['chroma', 'Green Screen'], ['color', 'Color'], ['effects', 'Effects'], ['anim', 'Animation']];
    case 'title': return [['text', 'Text'], ['video', 'Transform'], ['effects', 'Effects'], ['anim', 'Animation']];
    case 'element': case 'background': return [['style', 'Style'], ['video', 'Transform'], ['color', 'Color'], ['effects', 'Effects'], ['anim', 'Animation']];
    case 'adjust': return [['adjust', 'Adjustment'], ['color', 'Color']];
    case 'audio': return [['audio', 'Audio'], ['speed', 'Speed']];
    default: return [];
  }
}

function render(full) {
  const sel = selectedClips();
  const tr = store.selectedTransition;
  const key = tr ? `t:${tr.clipId}:${tr.side}` : sel.map((c) => c.id).join(',');
  if (!full && key === currentKey && document.activeElement && root.contains(document.activeElement)) return; // don't fight typing
  currentKey = key;
  const scrollTop = bodyEl.scrollTop;
  if (tr) { setCropMode(null); cancelColorPick(); return renderTransition(clipById(tr.clipId), tr.side); }
  if (sel.length !== 1) { setCropMode(null); cancelColorPick(); return renderProject(sel.length); }
  const c = sel[0];
  const tabs = tabsFor(c);
  if (tab === 'transition' || !tabs.some(([id]) => id === tab)) {
    const alias = { speed: 'speed', audio: 'audio', chroma: 'chroma', color: 'color', video: 'video', crop: 'crop' }[tab];
    tab = tabs.find(([id]) => id === alias)?.[0] || tabs[0][0];
  }
  headEl.replaceChildren(h('div.insp-title', h('span.chip', { style: { background: COLORS[c.type] } }), c.name, h('span.sub', fmtDur(c.duration))));
  tabsEl.replaceChildren(...tabs.map(([id, label]) => h('button.insp-tab', { class: `insp-tab${id === tab ? ' active' : ''}`, onclick: () => { tab = id; render(true); } }, label)));
  setCropMode(tab === 'crop' ? c.id : null);
  if (tab !== 'chroma' && full) cancelColorPick();
  const panel = { video: videoTab, crop: cropTab, chroma: chromaTab, color: colorTab, effects: effectsTab, anim: animTab, speed: speedTab, audio: audioTab, text: textTab, style: styleTab, adjust: adjustTab }[tab];
  bodyEl.replaceChildren(...[].concat(panel(c)));
  if (!full) bodyEl.scrollTop = scrollTop;
}

// ---------- project ----------
function renderProject(n) {
  const p = store.project;
  headEl.replaceChildren(h('div.insp-title', icon('film', 16), n > 1 ? `${n} clips selected` : 'Project'));
  tabsEl.replaceChildren();
  const aspect = Object.entries(ASPECTS).find(([, [w, hh]]) => w === p.width && hh === p.height)?.[0] || 'custom';
  bodyEl.replaceChildren(
    section('Project settings',
      select({ label: 'Aspect ratio', value: aspect, options: [...Object.keys(ASPECTS).map((k) => [k, { '16:9': '16:9 Widescreen', '9:16': '9:16 Vertical (Shorts, Reels)', '1:1': '1:1 Square', '4:5': '4:5 Portrait', '4:3': '4:3 Standard', '21:9': '21:9 Cinema' }[k]]), ...(aspect === 'custom' ? [['custom', 'Custom']] : [])], onChange: (v) => edit(() => { [p.width, p.height] = ASPECTS[v]; }) }),
      select({ label: 'Resolution', value: String(p.height <= p.width ? p.height : p.width), options: [['720', '720p'], ['1080', '1080p'], ['1440', '1440p'], ['2160', '4K']], onChange: (v) => edit(() => { const s = +v / Math.min(p.width, p.height); p.width = Math.round(p.width * s / 2) * 2; p.height = Math.round(p.height * s / 2) * 2; }) }),
      select({ label: 'Frame rate', value: String(p.fps), options: [['24', '24 fps'], ['25', '25 fps'], ['30', '30 fps'], ['50', '50 fps'], ['60', '60 fps']], onChange: (v) => edit(() => { p.fps = +v; }) }),
      colorRow({ label: 'Background', value: p.background, onStart: checkpoint, onInput: (v) => { p.background = v; changed('drag'); app.player.requestRender(); }, onChange: () => changed() }),
      h('div.hint', `${p.width} × ${p.height} · ${p.media.length} media files · ${p.clips.length} clips`)),
    section('Getting started', h('div.hint', { html: 'Drag media, titles, transitions, effects and stickers from the left onto the timeline.<br><br>Put a clip on a track <b>above</b> another to layer it: use <b>Green Screen</b> to key out a background, or right-click it and choose <b>Picture in picture</b>.<br><br>Drop a transition between two clips on the same track. Double-click a clip to edit it here.' })),
  );
}

// ---------- transitions ----------
function renderTransition(c, side) {
  if (!c) return renderProject(0);
  const tr = side === 'in' ? c.tIn : c.tOut;
  if (!tr) return renderProject(0);
  headEl.replaceChildren(h('div.insp-title', icon('transition', 16), transitionById(tr.id).name, h('span.sub', side === 'in' && prevAdjacent(c) ? 'Between clips' : side === 'in' ? 'Clip start' : 'Clip end')));
  tabsEl.replaceChildren();
  bodyEl.replaceChildren(
    section('Transition',
      slider({ label: 'Duration', min: 0.1, max: Math.min(5, c.duration), step: 0.05, value: tr.duration, unit: 's', ...live((v) => { tr.duration = v; }) }),
      select({ label: 'Type', value: tr.id, options: TRANSITIONS.map((t) => [t.id, `${t.cat} · ${t.name}`]), onChange: (v) => edit(() => { tr.id = v; }) }),
      h('div.row', h('button.btn.danger.small', { onclick: () => edit(() => { if (side === 'in') c.tIn = null; else c.tOut = null; store.selectedTransition = null; }) }, icon('trash', 14), 'Remove transition'))),
    section('Apply to all', h('div.hint', 'Use this transition at every cut on the same track.'), h('div.row', h('button.btn.small', {
      onclick: () => edit(() => { for (const o of store.project.clips) if (o.trackId === c.trackId && prevAdjacent(o)) o.tIn = { ...tr }; toast('Applied to every cut on this track'); }),
    }, 'Apply to all cuts'))),
  );
}

// ---------- video / transform ----------
function videoTab(c) {
  const tf = c.transform;
  const out = [
    section('Transform', h('div.sec-actions', h('button.ibtn.sm', { title: 'Reset', onclick: () => edit(() => { c.transform = defaultTransform(); }) }, icon('reset', 14))),
      slider({ label: 'Scale', min: 1, max: 400, value: Math.round(tf.scale * 100), unit: '%', reset: 100, ...live((v) => { tf.scale = v / 100; }) }),
      slider({ label: 'Position X', min: -100, max: 100, step: 0.5, value: tf.x * 100, reset: 0, ...live((v) => { tf.x = v / 100; }) }),
      slider({ label: 'Position Y', min: -100, max: 100, step: 0.5, value: tf.y * 100, reset: 0, ...live((v) => { tf.y = v / 100; }) }),
      slider({ label: 'Rotate', min: -180, max: 180, value: tf.rotation, unit: '°', reset: 0, ...live((v) => { tf.rotation = v; }) }),
      h('div.row', h('label', 'Flip'), h('div.chips',
        h('button.chip-btn', { class: `chip-btn${tf.flipH ? ' on' : ''}`, onclick: () => edit(() => { tf.flipH = !tf.flipH; }) }, 'Horizontal'),
        h('button.chip-btn', { class: `chip-btn${tf.flipV ? ' on' : ''}`, onclick: () => edit(() => { tf.flipV = !tf.flipV; }) }, 'Vertical'))),
      h('div.row', h('label', 'Quick place'), h('div.chips', [['Full', 1, 0, 0], ['PiP ↗', 0.35, 0.3, -0.28], ['PiP ↘', 0.35, 0.3, 0.28], ['PiP ↙', 0.35, -0.3, 0.28], ['PiP ↖', 0.35, -0.3, -0.28], ['Left half', 0.5, -0.25, 0], ['Right half', 0.5, 0.25, 0]].map(([n, s, x, y]) =>
        h('button.chip-btn', { onclick: () => edit(() => Object.assign(tf, { scale: s, x, y })) }, n))))),
    section('Compositing',
      slider({ label: 'Opacity', min: 0, max: 100, value: Math.round(tf.opacity * 100), unit: '%', reset: 100, ...live((v) => { tf.opacity = v / 100; }) }),
      select({ label: 'Blend mode', value: c.blend || 'normal', options: BLEND_MODES.map((b) => [b, b[0].toUpperCase() + b.slice(1)]), onChange: (v) => edit(() => { c.blend = v; }) })),
  ];
  return out;
}

// ---------- crop ----------
function cropTab(c) {
  const cr = c.crop || (c.crop = { l: 0, t: 0, r: 0, b: 0 });
  const p = store.project;
  const m = mediaById(c.mediaId);
  const sw = m?.width || p.width, sh = m?.height || p.height;
  // Centred crop to an aspect ratio (w:h), as large as the picture allows.
  const toAspect = (aw, ah) => edit(() => {
    const target = aw / ah, src = sw / sh;
    let fw = 1, fh = 1;
    if (target > src) fh = src / target; else fw = target / src;
    Object.assign(c.crop, { l: (1 - fw) / 2, r: (1 - fw) / 2, t: (1 - fh) / 2, b: (1 - fh) / 2 });
  });
  // Scale so the cropped area fills (or fits) the frame, centred.
  const place = (fill) => edit(() => {
    const cw = sw * (1 - cr.l - cr.r), ch = sh * (1 - cr.t - cr.b);
    const fit = Math.min(p.width / sw, p.height / sh);
    const s = (fill ? Math.max : Math.min)(p.width / (cw * fit), p.height / (ch * fit));
    const tf = c.transform;
    tf.scale = s; tf.rotation = 0;
    const ux = ((cr.l + 1 - cr.r) / 2 - 0.5) * (tf.flipH ? -1 : 1), vy = ((cr.t + 1 - cr.b) / 2 - 0.5) * (tf.flipV ? -1 : 1);
    tf.x = -(ux * sw * fit * s) / p.width;
    tf.y = -(vy * sh * fit * s) / p.height;
  });
  return [
    section('Crop', h('div.sec-actions', h('button.ibtn.sm', { title: 'Reset crop', onclick: () => edit(() => { c.crop = { l: 0, t: 0, r: 0, b: 0 }; }) }, icon('reset', 14))),
      h('div.hint', { style: { marginBottom: '8px' } }, 'Drag the white handles in the preview, or drag inside the box to move the crop. Everything outside it is removed.'),
      ...[['l', 'Left'], ['r', 'Right'], ['t', 'Top'], ['b', 'Bottom']].map(([k, n]) => slider({ label: n, min: 0, max: 95, step: 0.5, value: Math.round(cr[k] * 1000) / 10, unit: '%', reset: 0, ...live((v) => { cr[k] = Math.min(v / 100, 0.95 - cr[{ l: 'r', r: 'l', t: 'b', b: 't' }[k]]); }) }))),
    section('Aspect ratio', h('div.chips', [['16:9', 16, 9], ['9:16', 9, 16], ['1:1', 1, 1], ['4:3', 4, 3], ['4:5', 4, 5], ['21:9', 21, 9], ['Project', p.width, p.height]].map(([n, aw, ah]) =>
      h('button.chip-btn', { onclick: () => toAspect(aw, ah) }, n)))),
    section('After cropping', h('div.chips',
      h('button.chip-btn', { onclick: () => place(true) }, 'Fill frame'),
      h('button.chip-btn', { onclick: () => place(false) }, 'Fit in frame'),
      h('button.chip-btn', { onclick: () => edit(() => Object.assign(c.transform, { scale: 1, x: 0, y: 0, rotation: 0 })) }, 'Original position')),
      h('div.hint', { style: { marginTop: '8px' } }, 'For a green screen that does not reach the edges, crop off the uncovered parts here, then key it in the Green Screen tab.')),
  ];
}

function chromaTab(c) {
  const ck = c.chroma;
  const pick = (col) => edit(() => { ck.on = true; ck.color = col; });
  return [
    section('Chroma key',
      toggle({ label: 'Remove background colour', value: ck.on, onChange: (v) => edit(() => { ck.on = v; }) }),
      h('div.row', h('label', 'Key colour'), h('div.chips',
        h('button.chip-btn', { class: `chip-btn${ck.color === '#00ff00' ? ' on' : ''}`, onclick: () => pick('#00ff00') }, 'Green screen'),
        h('button.chip-btn', { class: `chip-btn${ck.color === '#0047ff' ? ' on' : ''}`, onclick: () => pick('#0047ff') }, 'Blue screen'))),
      colorRow({ label: 'Custom', value: ck.color, onStart: checkpoint, onInput: (v) => { ck.color = v; ck.on = true; changed('drag'); app.player.requestRender(); }, onChange: () => changed() }),
      h('div.row', h('label', ''), h('button.btn.small', { onclick: (e) => samplePick(c, e.currentTarget) }, icon('color', 14), h('span', 'Pick from preview'))),
      slider({ label: 'Tolerance', min: 0, max: 100, value: Math.round(ck.similarity * 100), reset: 15, ...live((v) => { ck.similarity = v / 100; }) }),
      slider({ label: 'Edge softness', min: 0, max: 100, value: Math.round(ck.smooth * 100), reset: 8, ...live((v) => { ck.smooth = v / 100; }) }),
      slider({ label: 'Spill removal', min: 0, max: 100, value: Math.round(ck.spill * 100), reset: 50, ...live((v) => { ck.spill = v / 100; }) })),
    section('How to use', h('div.hint', { html: 'Put your green-screen clip on a track <b>above</b> the background clip, then turn on the key. Raise <b>Tolerance</b> until the background disappears; use <b>Edge softness</b> for hair and <b>Spill removal</b> for green fringes. Crop away anything outside the screen in the Video tab.' })),
  ];
}

// Pick the key colour by clicking anywhere in the preview (one click, then back to normal).
function samplePick(c, btn) {
  if (isPicking()) { cancelColorPick(); return; }
  btn.classList.add('primary');
  btn.lastChild.textContent = 'Picking… Esc cancels';
  const off = store.on('picker', () => { off(); btn.classList.remove('primary'); btn.lastChild.textContent = 'Pick from preview'; });
  startColorPick((hex) => edit(() => { c.chroma.color = hex; c.chroma.on = true; }), c);
}

// ---------- color ----------
function colorTab(c) {
  const col = c.color || (c.color = defaultColor());
  const S = (k, label) => slider({ label, min: -100, max: 100, value: col[k] || 0, reset: 0, ...live((v) => { col[k] = v; }) });
  const filterRow = c.filter ? [h('div.fx-item', h('div.top', icon('filter', 14), filterById(c.filter.id)?.name, h('button.ibtn.sm', { onclick: () => edit(() => { c.filter = null; }) }, icon('x', 14))),
    slider({ label: 'Amount', min: 0, max: 100, value: Math.round((c.filter.amount ?? 1) * 100), unit: '%', ...live((v) => { c.filter.amount = v / 100; }) }))] : [h('div.hint', 'No filter. Pick one below, or drag one from the Filters tab onto the clip.')];
  return [
    section('Filter', ...filterRow, h('div.row', h('select.grow', { onchange: (e) => edit(() => { c.filter = e.target.value ? { id: e.target.value, amount: 1 } : null; }) },
      h('option', { value: '' }, '— Choose filter —'), FILTERS.map((f) => h('option', { value: f.id, selected: c.filter?.id === f.id }, `${f.cat} · ${f.name}`))))),
    section('Light', h('div.sec-actions', h('button.ibtn.sm', { title: 'Reset all', onclick: () => edit(() => { c.color = defaultColor(); }) }, icon('reset', 14))),
      S('exposure', 'Exposure'), S('brightness', 'Brightness'), S('contrast', 'Contrast'), S('highlights', 'Highlights'), S('shadows', 'Shadows')),
    section('Colour', S('saturation', 'Saturation'), S('temperature', 'Temperature'), S('tint', 'Tint'), S('hue', 'Hue')),
    section('Detail', slider({ label: 'Vignette', min: 0, max: 100, value: col.vignette || 0, reset: 0, ...live((v) => { col.vignette = v; }) }),
      slider({ label: 'Sharpen', min: 0, max: 100, value: col.sharpen || 0, reset: 0, ...live((v) => { col.sharpen = v; }) })),
    section('Auto', h('div.row', h('button.btn.small', { onclick: () => edit(() => Object.assign(col, { contrast: 12, saturation: 15, vignette: 15, sharpen: 15 })) }, icon('wand', 14), 'Auto enhance'))),
  ];
}

// ---------- effects ----------
function effectsTab(c) {
  const list = (c.effects || []).map((fx, i) => {
    const E = effectById(fx.id);
    return h('div.fx-item',
      h('div.top', icon('effect', 14), E?.name || fx.id, h('button.ibtn.sm', { title: 'Remove', onclick: () => edit(() => c.effects.splice(i, 1)) }, icon('x', 14))),
      slider({ label: 'Strength', min: 0, max: 100, value: Math.round((fx.amount ?? E?.def ?? 0.7) * 100), unit: '%', ...live((v) => { fx.amount = v / 100; }) }));
  });
  return [
    section('Applied effects', ...(list.length ? list : [h('div.hint', 'No effects yet. Drag one from the Effects tab onto this clip, or add one here.')])),
    section('Add effect', h('div.row', h('select.grow', { onchange: (e) => { if (e.target.value) edit(() => c.effects.push({ id: e.target.value, amount: effectById(e.target.value).def })); } },
      h('option', { value: '' }, '— Add an effect —'), EFFECTS.map((f) => h('option', { value: f.id }, `${f.cat} · ${f.name}`))))),
  ];
}

// ---------- animation ----------
function animTab(c) {
  const a = c.anim || (c.anim = { in: null, out: null, loop: null, inDur: 0.6, outDur: 0.6 });
  const grid = (list, key) => h('div.mini-grid', [{ id: null, name: 'None' }, ...list].map((x) => h('div.mini', { class: `mini${a[key] === x.id ? ' on' : ''}`, onclick: () => edit(() => { a[key] = x.id; }) }, x.name)));
  return [
    section('In', grid(ANIM_IN, 'in'), a.in ? slider({ label: 'Duration', min: 0.1, max: 3, step: 0.05, value: a.inDur, unit: 's', ...live((v) => { a.inDur = v; }) }) : null),
    section('Out', grid(ANIM_OUT, 'out'), a.out ? slider({ label: 'Duration', min: 0.1, max: 3, step: 0.05, value: a.outDur, unit: 's', ...live((v) => { a.outDur = v; }) }) : null),
    section('Motion (whole clip)', grid(ANIM_LOOP, 'loop')),
  ];
}

// ---------- speed ----------
function speedTab(c) {
  return [
    section('Speed',
      h('div.chips', [0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8].map((s) => h('button.chip-btn', { class: `chip-btn${Math.abs((c.speed || 1) - s) < 0.001 ? ' on' : ''}`, onclick: () => edit(() => setSpeed(c, s)) }, `${s}×`))),
      slider({ label: 'Custom', min: 0.1, max: 8, step: 0.05, value: c.speed || 1, unit: '×', reset: 1, ...live((v) => setSpeed(c, v)) }),
      h('div.hint', `Duration at this speed: ${fmtDur(c.duration)}. Pitch is kept natural in preview and export.`)),
  ];
}

// ---------- audio ----------
function audioTab(c) {
  const m = mediaById(c.mediaId);
  const fx = c.audioFx || (c.audioFx = { preset: 'none', mix: 1, low: 0, mid: 0, high: 0, lowCut: false, compress: false, denoise: 0, denoisePath: null });
  const noAudio = c.type === 'video' && m?.hasAudio === false;
  if (noAudio) return [section('Audio', h('div.hint', 'This video has no sound track.'))];
  const prog = h('div.progress.hidden', h('i'));
  const runDenoise = async (level) => {
    if (!level) { edit(() => { fx.denoise = 0; fx.denoisePath = null; }); return; }
    prog.classList.remove('hidden');
    try {
      const path = await denoiseSource(playPath(m), level, (p) => { prog.firstChild.style.width = `${Math.round(p * 100)}%`; });
      edit(() => { fx.denoise = level; fx.denoisePath = path; });
      loadPeaks(path).then(() => store.emit('waveform'));
      toast('Background noise removed');
    } catch (e) { toast(e.message, 'err'); } finally { prog.classList.add('hidden'); }
  };
  const normalize = async () => {
    const buf = await decodeFile(fx.denoisePath || playPath(m));
    if (!buf) { toast('Could not read this audio.', 'err'); return; }
    const g = normalizeGain(buf, c.in || 0, (c.in || 0) + c.duration * (c.speed || 1));
    edit(() => { c.volume = clamp(Math.round(g * 100) / 100, 0, 4); });
    toast(`Volume set to ${Math.round(g * 100)}% (peak −1 dB)`);
  };
  return [
    section('Volume',
      toggle({ label: 'Mute this clip', value: c.muted, onChange: (v) => edit(() => { c.muted = v; }) }),
      slider({ label: 'Volume', min: 0, max: 400, value: Math.round((c.volume ?? 1) * 100), unit: '%', reset: 100, ...live((v) => { c.volume = v / 100; }) }),
      slider({ label: 'Fade in', min: 0, max: Math.min(10, c.duration), step: 0.1, value: c.fadeIn || 0, unit: 's', reset: 0, ...live((v) => { c.fadeIn = v; }) }),
      slider({ label: 'Fade out', min: 0, max: Math.min(10, c.duration), step: 0.1, value: c.fadeOut || 0, unit: 's', reset: 0, ...live((v) => { c.fadeOut = v; }) }),
      h('div.row', h('button.btn.small', { onclick: normalize }, icon('volume', 14), 'Normalize loudness'), c.type === 'video' ? h('button.btn.small', { onclick: detachAudio }, icon('detach', 14), 'Detach audio') : null)),
    section('Noise removal',
      h('div.hint', 'Removes steady background noise: hum, hiss, fans, air conditioning, wind rumble and room tone.'),
      h('div.chips', [[0, 'Off'], [1, 'Light'], [2, 'Medium'], [3, 'Strong']].map(([lv, n]) => h('button.chip-btn', { class: `chip-btn${(fx.denoise || 0) === lv ? ' on' : ''}`, onclick: () => runDenoise(lv) }, n))),
      prog),
    section('Voice & effects',
      h('div.mini-grid', AUDIO_PRESETS.map((pr) => h('div.mini', { class: `mini${fx.preset === pr.id ? ' on' : ''}`, onclick: () => edit(() => { fx.preset = pr.id; }) }, pr.name))),
      fx.preset !== 'none' ? slider({ label: 'Effect mix', min: 0, max: 100, value: Math.round((fx.mix ?? 1) * 100), unit: '%', ...live((v) => { fx.mix = v / 100; }) }) : null),
    section('Equalizer', h('div.sec-actions', h('button.ibtn.sm', { title: 'Reset', onclick: () => edit(() => Object.assign(fx, { low: 0, mid: 0, high: 0 })) }, icon('reset', 14))),
      slider({ label: 'Bass', min: -15, max: 15, step: 0.5, value: fx.low, unit: 'dB', reset: 0, ...live((v) => { fx.low = v; }) }),
      slider({ label: 'Mid', min: -15, max: 15, step: 0.5, value: fx.mid, unit: 'dB', reset: 0, ...live((v) => { fx.mid = v; }) }),
      slider({ label: 'Treble', min: -15, max: 15, step: 0.5, value: fx.high, unit: 'dB', reset: 0, ...live((v) => { fx.high = v; }) }),
      toggle({ label: 'Low cut (remove rumble below 85 Hz)', value: fx.lowCut, onChange: (v) => edit(() => { fx.lowCut = v; }) }),
      toggle({ label: 'Compressor (even out loud and quiet parts)', value: fx.compress, onChange: (v) => edit(() => { fx.compress = v; }) })),
  ];
}

// ---------- text ----------
function textTab(c) {
  const tpl = titleById(c.template);
  const p = c.params;
  p.texts ||= [...(tpl?.texts || [])];
  p.colors ||= [...(tpl?.colors || [])];
  const areas = p.texts.map((t, i) => {
    const ta = h('textarea', { rows: Math.min(6, Math.max(2, t.split('\n').length + 1)), value: t });
    let started = false;
    ta.addEventListener('focus', () => { started = false; });
    ta.addEventListener('input', () => { if (!started) { checkpoint(); started = true; } p.texts[i] = ta.value; changed('drag'); app.player.requestRender(); });
    ta.addEventListener('blur', () => { if (started) changed(); });
    return h('div', { style: { marginBottom: '8px' } }, h('div.hint', { style: { marginBottom: '4px' } }, i === 0 ? 'Main text' : `Text ${i + 1}`), ta);
  });
  return [
    section('Text', ...areas, h('div.hint', 'Press Enter for a new line.')),
    section('Layout',
      h('div.hint', 'Each piece of this title (every line of text, bar and underline) has a dashed box in the preview. Drag a box to move just that piece; Shift-drag or drag the outer box to move the whole title.'),
      h('div.row', h('button.btn.small', { disabled: !p.offsets || !Object.keys(p.offsets).length, onclick: () => edit(() => { p.offsets = {}; }) }, icon('reset', 14), 'Reset piece positions'))),
    section('Style',
      h('div.row', h('label', 'Font'), h('select.grow', { onchange: (e) => edit(() => { p.font = e.target.value || null; }) }, h('option', { value: '' }, `Template (${tpl?.font || 'default'})`), FONTS.map((f) => h('option', { value: f, selected: p.font === f, style: { fontFamily: f } }, f)))),
      slider({ label: 'Size', min: 20, max: 300, value: Math.round((p.size || 1) * 100), unit: '%', reset: 100, ...live((v) => { p.size = v / 100; }) }),
      ...p.colors.map((col, i) => colorRow({ label: i === 0 ? 'Main colour' : i === 1 ? 'Accent' : `Colour ${i + 1}`, value: col, onStart: checkpoint, onInput: (v) => { p.colors[i] = v; changed('drag'); app.player.requestRender(); }, onChange: () => changed() })),
      h('div.row', h('label', 'Presets'), h('div.chips', [['#ffffff', '#ff4d6d'], ['#111111', '#ffd60a'], ['#ffffff', '#1fd1b9'], ['#fff6e5', '#c9a227'], ['#ffffff', '#3a86ff']].map((pair) =>
        h('button.chip-btn', { style: { background: `linear-gradient(90deg, ${pair[0]} 50%, ${pair[1]} 50%)`, width: '34px', height: '22px', padding: 0 }, onclick: () => edit(() => { p.colors = pair.concat(p.colors.slice(2)); }) }))))),
    section('Duration', slider({ label: 'Length', min: 0.5, max: 60, step: 0.1, value: c.duration, unit: 's', ...live((v) => { c.duration = v; clampClip(c); }) })),
  ];
}

function styleTab(c) {
  const tpl = c.type === 'element' ? elementById(c.template) : backgroundById(c.template);
  const p = c.params;
  p.colors ||= [...(tpl?.colors || [])];
  const rows = p.colors.map((col, i) => colorRow({ label: i === 0 ? 'Colour' : `Colour ${i + 1}`, value: col, onStart: checkpoint, onInput: (v) => { p.colors[i] = v; changed('drag'); app.player.requestRender(); }, onChange: () => changed() }));
  const extra = [];
  if (tpl?.emoji) {
    const inp = h('input.grow', { type: 'text', value: p.emoji || tpl.emoji, style: { fontSize: '18px' } });
    inp.addEventListener('change', () => edit(() => { p.emoji = inp.value; }));
    extra.push(h('div.row', h('label', 'Emoji'), inp));
  }
  // stickers with their own editable text or numbers
  const FIELDS = {
    'el-frame-polaroid': [['caption', 'Caption', 'good times ♥']],
    'el-tooltip': [['label', 'Label', 'Click here']],
    'el-number-badge': [['label', 'Number', '1']],
    'el-question': [['label', 'Symbol', '?']],
    'el-badge-burst': [['label', 'Label', 'NEW!']],
    'el-logo-badge': [['initials', 'Initials', 'AB']],
    'el-stars-rating': [['rating', 'Stars (0–5)', '5', 'number']],
    'el-like-count': [['count', 'Count to', '9999', 'number']],
  };
  for (const [key, label, def, type] of FIELDS[c.template] || []) {
    const inp = h('input.grow', { type: type === 'number' ? 'number' : 'text', value: p[key] ?? def });
    inp.addEventListener('change', () => edit(() => { p[key] = type === 'number' ? Number(inp.value) : inp.value; }));
    extra.push(h('div.row', h('label', label), inp));
  }
  if (c.template === 'el-endcards') {
    [0, 1].forEach((i) => {
      const inp = h('input.grow', { type: 'text', value: p.labels?.[i] ?? ['Watch next', 'Best of'][i] });
      inp.addEventListener('change', () => edit(() => { p.labels = [...(p.labels || ['Watch next', 'Best of'])]; p.labels[i] = inp.value; }));
      extra.push(h('div.row', h('label', `Box ${i + 1}`), inp));
    });
  }
  return [
    section('Style', ...extra, ...rows, slider({ label: 'Size', min: 20, max: 300, value: Math.round((p.size || 1) * 100), unit: '%', reset: 100, ...live((v) => { p.size = v / 100; }) })),
    section('Duration', slider({ label: 'Length', min: 0.5, max: 120, step: 0.1, value: c.duration, unit: 's', ...live((v) => { c.duration = v; }) })),
  ];
}

function adjustTab(c) {
  return [
    section('Adjustment layer', h('div.hint', 'Everything on the tracks below this clip gets these looks while it plays.')),
    ...effectsTab(c),
    section('Filter', h('div.row', h('select.grow', { onchange: (e) => edit(() => { c.filter = e.target.value ? { id: e.target.value, amount: c.filter?.amount ?? 1 } : null; }) },
      h('option', { value: '' }, '— None —'), FILTERS.map((f) => h('option', { value: f.id, selected: c.filter?.id === f.id }, `${f.cat} · ${f.name}`)))),
    c.filter ? slider({ label: 'Amount', min: 0, max: 100, value: Math.round((c.filter.amount ?? 1) * 100), unit: '%', ...live((v) => { c.filter.amount = v / 100; }) }) : null),
  ];
}
