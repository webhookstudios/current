// Left panel: Media, Audio, Titles, Transitions, Effects, Filters, Stickers.
import { h, icon, fmtDur, fileUrl } from '../util.js';
import { store, ASPECTS } from '../state.js';
import { TITLES, TITLE_CATS } from '../templates/titles.js';
import { TRANSITIONS, TRANSITION_CATS } from '../templates/transitions.js';
import { EFFECTS, EFFECT_CATS, FILTERS, FILTER_CATS } from '../templates/effects.js';
import { ELEMENTS, ELEMENT_CATS, BACKGROUNDS, BACKGROUND_CATS } from '../templates/elements.js';
import { AUDIO_LIBRARY, AUDIO_CATS, libraryAudioPath } from '../templates/audiolib.js';
import { thumbs } from '../engine/media.js';
import { PACKS, PACK_CATS } from '../templates/packs.js';
import { insertItem, importPaths, app } from '../actions.js';
import { drawPreview, makeThumbCanvas } from './previews.js';
import { dnd } from './dnd.js';
import { showMenu, toast } from './widgets.js';

const TABS = [
  { id: 'media', label: 'Media', icon: 'media' },
  { id: 'audio', label: 'Audio', icon: 'audio' },
  { id: 'pack', label: 'Intro/Outro', icon: 'film' },
  { id: 'title', label: 'Titles', icon: 'title' },
  { id: 'transition', label: 'Transitions', icon: 'transition' },
  { id: 'effect', label: 'Effects', icon: 'effect' },
  { id: 'filter', label: 'Filters', icon: 'filter' },
  { id: 'element', label: 'Stickers', icon: 'sticker' },
];

const state = { tab: 'media', cat: {}, q: '' };
let root, grid, catsEl, searchEl, observer;

export function initLibrary(el) {
  root = el;
  const tabs = h('div.lib-tabs', TABS.map((t) => h('button.lib-tab', { 'data-tab': t.id, onclick: () => setTab(t.id) }, icon(t.icon, 20), t.label)));
  catsEl = h('div.lib-cats');
  searchEl = h('input', { type: 'text', placeholder: 'Search', oninput: () => { state.q = searchEl.value.trim().toLowerCase(); renderGrid(); } });
  const importBtn = h('button.btn.small', { onclick: doImport, title: 'Import media files' }, icon('upload', 15), 'Import');
  grid = h('div.grid');
  const main = h('div.lib-main', h('div.lib-head', h('div.search', icon('search', 15), searchEl), importBtn), grid);
  root.append(tabs, h('div.lib-body', catsEl, main));
  // file drops from the desktop
  grid.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); grid.classList.add('drop-glow'); } });
  grid.addEventListener('dragleave', () => grid.classList.remove('drop-glow'));
  grid.addEventListener('drop', async (e) => {
    grid.classList.remove('drop-glow');
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const paths = [...e.dataTransfer.files].map((f) => window.native.pathForFile(f)).filter(Boolean);
    setTab('media');
    await importPaths(paths);
  });
  observer = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.__paint?.(); observer.unobserve(en.target); } }), { root: grid, rootMargin: '200px' });
  store.on('media', () => { if (state.tab === 'media') renderGrid(); });
  store.on('brand', () => { if (state.tab !== 'media' && state.tab !== 'audio') renderGrid(); });
  store.on('change', (k) => { if (state.tab === 'media' && k === 'history') renderGrid(); });
  setTab('media');
}

export async function doImport() {
  const paths = await window.native.importMedia();
  if (paths.length) { setTab('media'); state.cat.media = 'Project Media'; await importPaths(paths); renderCats(); renderGrid(); }
}

export function setTab(id) {
  stopPreview();
  state.tab = id;
  root.querySelectorAll('.lib-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  renderCats();
  renderGrid();
}

function catsFor(tab) {
  switch (tab) {
    case 'media': return ['Project Media', ...BACKGROUND_CATS];
    case 'audio': return ['Project Audio', ...AUDIO_CATS];
    case 'pack': return PACK_CATS;
    case 'title': return ['All', ...TITLE_CATS];
    case 'transition': return ['All', ...TRANSITION_CATS];
    case 'effect': return ['All', ...EFFECT_CATS];
    case 'filter': return ['All', ...FILTER_CATS];
    case 'element': return ['All', ...ELEMENT_CATS];
    default: return [];
  }
}

function itemsFor(tab, cat) {
  const all = (list, kind) => list.filter((x) => cat === 'All' || x.cat === cat).map((x) => ({ ...x, kind }));
  switch (tab) {
    case 'media':
      if (cat === 'Project Media') return store.project.media.filter((m) => m.type !== 'audio').map((m) => ({ kind: 'media', id: m.id, name: m.name, m }));
      return BACKGROUNDS.filter((b) => b.cat === cat).map((b) => ({ ...b, kind: 'background' }));
    case 'audio':
      if (cat === 'Project Audio') return store.project.media.filter((m) => m.type === 'audio' && !m.library).map((m) => ({ kind: 'media', id: m.id, name: m.name, m }));
      return AUDIO_LIBRARY.filter((a) => a.cat === cat).map((a) => ({ ...a, kind: 'audio-lib' }));
    case 'pack': return PACKS.filter((x) => x.cat === cat).map((x) => ({ ...x, kind: 'pack' }));
    case 'title': return all(TITLES, 'title');
    case 'transition': return all(TRANSITIONS, 'transition');
    case 'effect': return all(EFFECTS, 'effect');
    case 'filter': return all(FILTERS, 'filter');
    case 'element': return all(ELEMENTS, 'element');
    default: return [];
  }
}

function renderCats() {
  const cats = catsFor(state.tab);
  if (!cats.includes(state.cat[state.tab])) state.cat[state.tab] = cats[0];
  catsEl.replaceChildren(...cats.map((c) => h('div.lib-cat', { class: `lib-cat${c === state.cat[state.tab] ? ' active' : ''}`, onclick: () => { state.cat[state.tab] = c; renderCats(); renderGrid(); } }, c, h('span', countFor(c)))));
}
const countFor = (c) => { const n = itemsFor(state.tab, c).length; return n || ''; };

function usedIds() {
  const s = new Set();
  for (const c of store.project.clips) { if (c.mediaId) s.add(c.mediaId); if (c.template) s.add(c.template); }
  return s;
}

export function renderGrid() {
  if (!grid) return;
  const cat = state.cat[state.tab];
  let items = state.q
    ? catsFor(state.tab).slice(1).concat(state.tab === 'media' || state.tab === 'audio' ? [catsFor(state.tab)[0]] : []).flatMap((c) => itemsFor(state.tab, c))
    : itemsFor(state.tab, cat);
  if (state.q) items = items.filter((i, idx, arr) => i.name.toLowerCase().includes(state.q) && arr.findIndex((x) => x.id === i.id) === idx);
  const used = usedIds();
  const kids = [];
  if ((state.tab === 'media' && cat === 'Project Media') || (state.tab === 'audio' && cat === 'Project Audio')) {
    if (!state.q) kids.push(h('div.import-tile', { onclick: doImport }, icon('upload', 22), 'Import media', h('span.hint', 'or drop files here')));
  }
  for (const it of items) kids.push(card(it, used));
  if (!items.length && state.tab === 'media' && cat === 'Project Media' && !state.q) kids.push(h('div.empty-note', 'Import videos, photos and music, or drag files in from your file manager.'));
  if (!items.length && state.q) kids.push(h('div.empty-note', 'Nothing matches that search.'));
  grid.replaceChildren(...kids);
}

function card(it, used) {
  const pl = { kind: it.kind, id: it.id };
  const isAudio = it.kind === 'audio-lib' || (it.kind === 'media' && it.m.type === 'audio');
  let thumb;
  if (it.kind === 'media' && !isAudio) {
    thumb = h('div.thumb', { style: { backgroundImage: thumbs.get(it.id) ? `url(${thumbs.get(it.id)})` : '' } },
      it.m.type === 'video' ? h('span.badge', fmtDur(it.m.duration)) : h('span.badge', 'Photo'));
    if (it.m.type === 'video' && !it.m.missing) {
      // hover: silent looping preview; button: play with sound
      const btn = h('button.audio-play', { title: 'Preview with sound', onclick: (e) => { e.stopPropagation(); togglePreview(it, btn, thumb); } }, icon('play', 18));
      thumb.append(btn);
      if (preview.id === it.id) { setBtn(btn, true); preview.btn = btn; }
      thumb.addEventListener('mouseenter', () => { if (preview.id !== it.id) hoverVideo(it, thumb); });
      thumb.addEventListener('mouseleave', () => { if (preview.id !== it.id) thumb.querySelector('video.hover')?.remove(); });
    }
  } else if (isAudio) {
    const dur = it.kind === 'audio-lib' ? it.dur : it.m.duration;
    const btn = h('button.audio-play', { title: 'Preview', onclick: (e) => { e.stopPropagation(); togglePreview(it, btn); } }, icon('play', 18));
    if (preview.id === it.id) { btn.classList.add('playing'); btn.replaceChildren(icon('pause', 18)); preview.btn = btn; }
    thumb = h('div.thumb', icon(it.cat === 'Music' || it.kind === 'media' ? 'audio' : 'sparkle', 26), btn, h('span.badge', fmtDur(dur)));
  } else {
    const cv = makeThumbCanvas();
    thumb = h('div.thumb', cv);
    const midT = it.kind === 'pack' ? Math.min(2.4, it.dur * 0.5) : it.kind === 'transition' ? 1.0 : it.kind === 'title' ? Math.min(2.2, (it.dur || 5) * 0.5) : it.kind === 'element' ? 1.5 : 1.5;
    thumb.__paint = () => drawPreview(cv, it.kind, it.id, midT, it.dur);
    observer.observe(thumb);
    let raf = 0, t0 = 0;
    thumb.addEventListener('mouseenter', () => {
      t0 = performance.now();
      const loop = () => { const t = (performance.now() - t0) / 1000; drawPreview(cv, it.kind, it.id, it.kind === 'transition' ? t : t % (it.dur || 5), it.dur); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
    thumb.addEventListener('mouseleave', () => { cancelAnimationFrame(raf); drawPreview(cv, it.kind, it.id, midT, it.dur); });
  }
  const addBtn = h('button.add', { title: 'Add to timeline', onclick: (e) => { e.stopPropagation(); insertItem(pl).catch((err) => toast(err.message, 'err')); } }, icon('plus', 15));
  const el = h('div.card', { class: `card${isAudio ? ' audio' : ''}${it.m?.missing ? ' missing' : ''}`, draggable: true, title: it.m?.missing ? `${it.name} (missing)` : it.name },
    thumb, addBtn, used.has(it.id) ? h('span.used', icon('check', 11)) : null, h('div.name', it.name));
  el.addEventListener('dragstart', (e) => {
    dnd.payload = pl;
    dnd.duration = it.kind === 'media' ? (it.m.type === 'image' ? 5 : it.m.duration) : it.kind === 'audio-lib' ? it.dur : it.kind === 'transition' ? 1 : it.dur || 5;
    e.dataTransfer.setData('text/plain', it.name);
    e.dataTransfer.effectAllowed = 'copy';
  });
  el.addEventListener('dragend', () => { dnd.payload = null; store.emit('dndend'); });
  if (isAudio) el.addEventListener('dblclick', () => el.querySelector('.audio-play')?.click());
  if (it.kind === 'media') {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY, [
        { label: 'Add to timeline', icon: 'plus', run: () => insertItem(pl) },
        { label: 'Show in folder', icon: 'folder', run: () => window.native.showItem(it.m.path) },
        '-',
        { label: 'Remove from project', icon: 'trash', run: () => removeMedia(it.id) },
      ]);
    });
  }
  return el;
}

function removeMedia(id) {
  const n = store.project.clips.filter((c) => c.mediaId === id).length;
  if (n) { toast(`Used by ${n} clip${n > 1 ? 's' : ''} on the timeline. Delete those first.`, 'err'); return; }
  store.project.media = store.project.media.filter((m) => m.id !== id);
  store.dirty = true;
  store.emit('media');
}

export { ASPECTS };

// ---------- audio preview (play / pause on audio cards) ----------
const preview = { id: null, el: null, btn: null };
function setBtn(btn, playing) { if (!btn) return; btn.classList.toggle('playing', playing); btn.replaceChildren(icon(playing ? 'pause' : 'play', 18)); }
function hoverVideo(it, thumb) {
  let v = thumb.querySelector('video.hover');
  if (!v) {
    v = h('video.hover', { muted: true, loop: true, playsInline: true, preload: 'auto' });
    v.muted = true;
    v.src = fileUrl(it.m.proxy || it.m.path);
    v.currentTime = Math.min(1, it.m.duration * 0.1);
    thumb.prepend(v);
  }
  v.play().catch(() => {});
  return v;
}
export function stopPreview() {
  if (preview.el) {
    preview.el.pause();
    if (preview.el.tagName === 'VIDEO') preview.el.remove();
    else { preview.el.removeAttribute('src'); preview.el.load(); }
  }
  setBtn(preview.btn, false);
  Object.assign(preview, { id: null, el: null, btn: null });
}
async function togglePreview(it, btn, thumb) {
  if (preview.id === it.id) { stopPreview(); return; }
  stopPreview();
  if (store.playing) app.player.pause();
  preview.id = it.id; preview.btn = btn;
  setBtn(btn, true);
  if (thumb) {
    const v = hoverVideo(it, thumb);
    v.muted = false; v.loop = false;
    preview.el = v;
    v.onended = () => { if (preview.el === v) stopPreview(); };
    v.play().catch(() => { stopPreview(); toast('Could not play this video.', 'err'); });
    return;
  }
  try {
    const path = it.kind === 'audio-lib' ? await libraryAudioPath(it) : (it.m.proxy || it.m.path);
    if (preview.id !== it.id) return; // another card was started meanwhile
    const a = new Audio(fileUrl(path));
    preview.el = a;
    a.onended = () => { if (preview.el === a) stopPreview(); };
    await a.play();
  } catch (e) { stopPreview(); toast('Could not play this sound.', 'err'); }
}
