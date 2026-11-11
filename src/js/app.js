// Current: application bootstrap, top bar, menus, start screen, shortcuts and project files.
import { h, icon, clamp, fmtDur } from './util.js';
import { store, newProject, undo, redo, ASPECTS, changed, select } from './state.js';
import { Compositor } from './engine/renderer.js';
import { Player } from './engine/player.js';
import { warm } from './engine/media.js';
import { initLibrary, doImport, setTab, renderGrid } from './ui/library.js';
import { initPreview, busy } from './ui/preview.js';
import { initTimeline, zoomFit, setZoom, render as renderTimeline } from './ui/timeline.js';
import { initInspector } from './ui/inspector.js';
import { openExport } from './ui/export.js';
import { PROJECT_TEMPLATES } from './templates/projects.js';
import { packById } from './templates/packs.js';
import { drawPreview, makeThumbCanvas } from './ui/previews.js';
import { showMenu, closeMenu, modal, toast } from './ui/widgets.js';
import {
  app, buildFromTemplate, splitAtPlayhead, deleteSelected, duplicateSelected, copySelected, cutSelected, paste, selectAll, freezeFrame, detachAudio, nudgeSelection,
} from './actions.js';

const FONT_FAMILIES = ['Montserrat', 'Poppins', 'Inter', 'Oswald', 'Bebas Neue', 'Anton', 'Archivo Black', 'Playfair Display', 'Abril Fatface', 'Lobster', 'Pacifico', 'Dancing Script', 'Great Vibes', 'Caveat', 'Permanent Marker', 'Bangers', 'Righteous', 'Orbitron', 'Monoton', 'Press Start 2P', 'Rubik Mono One', 'Space Grotesk'];

let nameInput, dirtyDot;

async function boot() {
  await Promise.all(FONT_FAMILIES.flatMap((f) => ['400', '700', '800', '900'].map((w) => document.fonts.load(`${w} 40px "${f}"`).catch(() => {}))));
  await document.fonts.load('40px "Noto Color Emoji"').catch(() => {});
  store.project = newProject();
  const canvas = document.createElement('canvas');
  let comp;
  try { comp = new Compositor(canvas); } catch (e) {
    document.body.innerHTML = `<div style="padding:40px;font:15px sans-serif;color:#eee">Current needs WebGL 2, which is not available: ${e.message}</div>`;
    return;
  }
  const player = new Player(comp);
  app.player = player;
  app.compositor = comp;
  app.busy = (msg) => busy(msg);
  window.__currentDirty = () => store.dirty;

  buildTopbar();
  initLibrary(document.getElementById('library'));
  initPreview(document.getElementById('preview'), canvas);
  initInspector(document.getElementById('inspector'));
  initTimeline(document.getElementById('timeline'));
  initSplitters();
  initShortcuts();
  store.on('change', updateTitle);
  store.on('media', updateTitle);
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  player.seek(0);
  if (!(await window.native.gstCheck())) toast('GStreamer encoders were not found, so export will not work. Install gstreamer1.0-plugins-ugly and gstreamer1.0-libav.', 'err', 12000);
  showStart();
}

// ---------- top bar ----------
function buildTopbar() {
  const bar = document.getElementById('topbar');
  const menu = (label, items) => {
    const b = h('button.menu-btn', label);
    b.addEventListener('click', () => {
      const r = b.getBoundingClientRect();
      const m = showMenu(r.left, r.bottom + 4, items());
      b.classList.add('open');
      return m;
    });
    return b;
  };
  nameInput = h('input', { type: 'text', value: store.project.name, title: 'Project name' });
  nameInput.addEventListener('change', () => { store.project.name = nameInput.value.trim() || 'My Video'; store.dirty = true; updateTitle(); });
  dirtyDot = h('span.dirty.hidden', { title: 'Unsaved changes' });
  bar.append(
    h('div.brand', h('img', { src: 'img/logo.svg', alt: '' }), 'Current'),
    menu('File', () => [
      { label: 'New project', icon: 'plus', kbd: 'Ctrl+N', run: newProjectFlow },
      { label: 'Open project…', icon: 'folder', kbd: 'Ctrl+O', run: () => openProject() },
      { label: 'Save', icon: 'save', kbd: 'Ctrl+S', run: () => saveProject(false) },
      { label: 'Save as…', icon: 'save', kbd: 'Ctrl+Shift+S', run: () => saveProject(true) },
      '-',
      { label: 'Import media…', icon: 'upload', kbd: 'Ctrl+I', run: doImport },
      { label: 'Export…', icon: 'download', kbd: 'Ctrl+E', run: openExport },
      '-',
      { label: 'Start screen', icon: 'film', run: showStart },
    ]),
    menu('Edit', () => [
      { label: 'Undo', icon: 'undo', kbd: 'Ctrl+Z', disabled: !store.undoStack.length, run: undo },
      { label: 'Redo', icon: 'redo', kbd: 'Ctrl+Shift+Z', disabled: !store.redoStack.length, run: redo },
      '-',
      { label: 'Cut', kbd: 'Ctrl+X', run: cutSelected },
      { label: 'Copy', icon: 'copy', kbd: 'Ctrl+C', run: copySelected },
      { label: 'Paste', kbd: 'Ctrl+V', run: paste },
      { label: 'Duplicate', kbd: 'Ctrl+D', run: duplicateSelected },
      { label: 'Delete', icon: 'trash', kbd: 'Del', run: () => deleteSelected(false) },
      { label: 'Ripple delete', kbd: 'Shift+Del', run: () => deleteSelected(true) },
      '-',
      { label: 'Split at playhead', icon: 'split', kbd: 'Ctrl+B', run: splitAtPlayhead },
      { label: 'Freeze frame', icon: 'freeze', run: freezeFrame },
      { label: 'Detach audio', icon: 'detach', run: detachAudio },
      { label: 'Select all', kbd: 'Ctrl+A', run: selectAll },
    ]),
    menu('View', () => [
      { label: 'Zoom in', icon: 'zoomIn', kbd: '+', run: () => setZoom(store.zoom * 1.4) },
      { label: 'Zoom out', icon: 'zoomOut', kbd: '−', run: () => setZoom(store.zoom / 1.4) },
      { label: 'Fit timeline', icon: 'fit', kbd: 'Shift+Z', run: zoomFit },
      '-',
      ...[['media', 'Media'], ['audio', 'Audio'], ['title', 'Titles'], ['transition', 'Transitions'], ['effect', 'Effects'], ['filter', 'Filters'], ['element', 'Stickers']].map(([id, n], i) => ({ label: n, kbd: `Alt+${i + 1}`, run: () => setTab(id) })),
    ]),
    menu('Help', () => [
      { label: 'Keyboard shortcuts', icon: 'keyboard', kbd: '?', run: showShortcuts },
      { label: 'About Current', icon: 'info', run: showAbout },
    ]),
    h('div.proj-name', dirtyDot, nameInput),
    h('div.top-right',
      h('button.btn', { onclick: () => saveProject(false) }, icon('save', 15), 'Save'),
      h('button.btn.primary', { onclick: openExport }, icon('download', 15), 'Export')),
  );
}

function updateTitle() {
  nameInput.value = store.project.name;
  dirtyDot.classList.toggle('hidden', !store.dirty);
  window.native.setTitle(`${store.dirty ? '• ' : ''}${store.project.name} – Current`);
}

// ---------- projects ----------
function serialise() {
  return JSON.stringify({ app: 'splice', ...store.project }, null, 1);
}

async function saveProject(as) {
  let path = store.path;
  if (!path || as) path = await window.native.saveProjectDialog(store.project.name);
  if (!path) return false;
  try {
    await window.native.writeText(path, serialise());
    store.path = path;
    store.dirty = false;
    await window.native.recentAdd({ path, name: store.project.name, thumb: frameThumb(), duration: store.project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0), aspect: `${store.project.width}x${store.project.height}` });
    updateTitle();
    toast('Project saved');
    return true;
  } catch (e) { toast(`Could not save: ${e.message}`, 'err'); return false; }
}

function frameThumb() {
  try {
    const c = document.createElement('canvas');
    const src = app.compositor.canvas;
    c.width = 320; c.height = Math.round(320 * src.height / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch { return null; }
}

async function confirmDiscard() {
  if (!store.dirty || !store.project.clips.length) return true;
  const r = await window.native.message({ type: 'question', buttons: ['Save', 'Discard', 'Cancel'], defaultId: 0, cancelId: 2, message: 'Save changes to this project first?' });
  if (r === 0) return saveProject(false);
  return r === 1;
}

function loadProject(proj, path) {
  app.player.pause();
  for (const id of [...app.player.els.keys()]) app.player.dropEntry(id);
  store.project = proj;
  store.path = path;
  store.undoStack = []; store.redoStack = [];
  store.selection.clear();
  store.selectedTransition = null;
  store.time = 0;
  store.dirty = false;
  for (const m of proj.media) warm(m);
  changed('load');
  store.dirty = false;
  store.emit('selection');
  store.emit('media');
  updateTitle();
  renderGrid();
  requestAnimationFrame(() => { zoomFit(); app.player.seek(0); });
}

async function openProject(path) {
  if (!(await confirmDiscard())) return;
  path ||= await window.native.openProjectDialog();
  if (!path) return;
  try {
    const proj = JSON.parse(await window.native.readText(path));
    if (!proj.tracks || !proj.clips) throw new Error('This is not a Current project.');
    delete proj.app;
    const missing = [];
    for (const m of proj.media) { m.missing = !(await window.native.exists(m.path)); if (m.missing) missing.push(m.name); }
    loadProject(proj, path);
    closeStart();
    await window.native.recentAdd({ path, name: proj.name, thumb: null, aspect: `${proj.width}x${proj.height}` });
    if (missing.length) toast(`${missing.length} media file${missing.length > 1 ? 's are' : ' is'} missing: ${missing.slice(0, 3).join(', ')}`, 'err', 8000);
  } catch (e) { toast(`Could not open project: ${e.message}`, 'err', 6000); }
}

async function newProjectFlow() {
  if (!(await confirmDiscard())) return;
  showStart();
}

// ---------- start screen ----------
let startEl = null;
async function showStart() {
  closeStart();
  let aspect = '16:9';
  const asp = h('div.aspects', Object.keys(ASPECTS).map((k) => {
    const [w, hh] = ASPECTS[k];
    const s = 26 / Math.max(w, hh);
    return h('div.aspect', { class: `aspect${k === aspect ? ' on' : ''}`, 'data-a': k, onclick: () => { aspect = k; asp.querySelectorAll('.aspect').forEach((a) => a.classList.toggle('on', a.dataset.a === k)); } },
      h('i', { style: { width: w * s + 'px', height: hh * s + 'px' } }), k, h('small', { style: { color: 'var(--fg3)', fontSize: '10px' } }, { '16:9': 'YouTube', '9:16': 'Shorts · Reels', '1:1': 'Square', '4:5': 'Instagram', '4:3': 'Classic', '21:9': 'Cinema' }[k]));
  }));
  const recent = await window.native.recentList();
  const recentGrid = h('div.recent', recent.length ? recent.map((r) => h('div.recent-card', { onclick: () => openProject(r.path) },
    h('div.rt', { style: { backgroundImage: r.thumb ? `url(${r.thumb})` : 'none' } }),
    h('div.ri', h('b', r.name || r.path.split('/').pop()), h('small', `${r.aspect?.replace('x', '×') || ''}${r.duration ? ' · ' + fmtDur(r.duration) : ''} · ${new Date(r.opened).toLocaleDateString()}`)),
    h('button.ibtn.sm.rm', { title: 'Remove from list', onclick: async (e) => { e.stopPropagation(); await window.native.recentRemove(r.path); showStart(); } }, icon('x', 14)))) : [h('div.hint', 'Projects you save will show up here.')]);
    startEl = h('div.start',
    h('div.start-side',
      h('div.start-logo', h('img', { src: 'img/logo.svg', alt: '' }), 'Current'),
      h('div.start-tag', 'A video editor with built-in titles, transitions, effects, filters, stickers, intros, outros and music.'),
      h('div.hint', 'Aspect ratio'),
      asp,
      h('button.btn.primary.big', { onclick: () => { const ok = !store.dirty || !store.project.clips.length; if (!ok && !confirm('Discard the current project?')) return; loadProject(newProject({ aspect }), null); closeStart(); } }, icon('plus', 18), 'New Project'),
      h('button.btn.big', { onclick: () => openProject() }, icon('folder', 18), 'Open Project'),
      store.project.clips.length ? h('button.btn.ghost', { onclick: closeStart }, 'Back to current project') : null,
    ),
    h('div.start-main',
      h('h2', 'Recent projects'),
      recentGrid,
      h('h2', { style: { marginTop: '36px' } }, 'Start from a template'),
      h('div.hint', { style: { margin: '-10px 0 16px' } }, 'Optional. Each one lays out an intro, scenes for your clips, captions, an outro and music. Drop your own clips on the “Your clip” blocks to replace them.'),
      templateGrid(() => aspect),
    ),
  );
  document.body.append(startEl);
}
function templateGrid() {
  return h('div.tpl-grid', PROJECT_TEMPLATES.map((tpl) => {
    const cv = makeThumbCanvas();
    const pk = packById(tpl.preview);
    const [aw, ah] = ASPECTS[tpl.aspect];
    drawPreview(cv, 'pack', tpl.preview, Math.min(2.4, pk.dur * 0.5), pk.dur, tpl.introTexts);
    let raf = 0;
    const card = h('div.tpl-card', { onclick: () => startFromTemplate(tpl) },
      h('div.tpl-thumb', cv, h('span.badge', tpl.aspect)),
      h('div.ri', h('b', tpl.name), h('small', tpl.desc)));
    card.addEventListener('mouseenter', () => { const t0 = performance.now(); const loop = () => { drawPreview(cv, 'pack', tpl.preview, ((performance.now() - t0) / 1000) % pk.dur, pk.dur, tpl.introTexts); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); });
    card.addEventListener('mouseleave', () => { cancelAnimationFrame(raf); drawPreview(cv, 'pack', tpl.preview, Math.min(2.4, pk.dur * 0.5), pk.dur, tpl.introTexts); });
    return card;
  }));
}

async function startFromTemplate(tpl) {
  if (store.dirty && store.project.clips.length && !confirm('Discard the current project?')) return;
  loadProject(newProject({ aspect: tpl.aspect, name: tpl.name }), null);
  closeStart();
  const stop = busy(`Building ${tpl.name}…`);
  try { await buildFromTemplate(tpl); } finally { stop(); }
  store.dirty = false;
  updateTitle();
  requestAnimationFrame(() => zoomFit());
  toast('Template ready. Drop your clips on the “Your clip” blocks to replace them.', '', 6000);
}

function closeStart() { startEl?.remove(); startEl = null; }

// ---------- panels ----------
function initSplitters() {
  const root = document.documentElement;
  const ws = document.getElementById('workspace');
  document.querySelectorAll('.splitter').forEach((sp) => {
    sp.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sp.classList.add('drag');
      const r = ws.getBoundingClientRect();
      const move = (ev) => {
        if (sp.dataset.split === 'lib') root.style.setProperty('--lib-w', clamp(ev.clientX - r.left, 300, r.width * 0.5) + 'px');
        else root.style.setProperty('--insp-w', clamp(r.right - ev.clientX, 260, r.width * 0.4) + 'px');
      };
      const up = () => { sp.classList.remove('drag'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  });
  const hs = document.getElementById('hsplit');
  hs.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hs.classList.add('drag');
    const move = (ev) => root.style.setProperty('--top-h', clamp(ev.clientY - 44, 260, innerHeight - 220) + 'px');
    const up = () => { hs.classList.remove('drag'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); renderTimeline(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
}

// ---------- keyboard ----------
const SHORTCUTS = [
  ['Space', 'Play / pause'], ['← / →', 'Previous / next frame (Shift: 1 second)'], ['Home / End', 'Go to start / end'], ['J / K / L', 'Back 5 s / pause / forward 5 s'],
  ['Ctrl+B', 'Split at playhead'], ['Delete', 'Delete selection'], ['Shift+Delete', 'Ripple delete'], ['Ctrl+D', 'Duplicate'],
  ['Ctrl+C / X / V', 'Copy / cut / paste'], ['Ctrl+A', 'Select all'], ['Ctrl+Z', 'Undo'], ['Ctrl+Shift+Z / Ctrl+Y', 'Redo'],
  ['+ / −', 'Zoom timeline'], ['Shift+Z', 'Fit timeline'], ['N', 'Toggle snapping'], [', / .', 'Nudge selected clips by a frame'],
  ['Ctrl+S', 'Save'], ['Ctrl+O', 'Open'], ['Ctrl+I', 'Import media'], ['Ctrl+E', 'Export'], ['Alt+1…7', 'Library tabs'],
];
function showShortcuts() {
  modal({ title: 'Keyboard shortcuts', body: h('div.kbd-list', SHORTCUTS.flatMap(([k, d]) => [h('span', k.split(' / ').map((x, i) => [i ? ' / ' : '', h('kbd', x)])), h('span', d)])) });
}
async function showAbout() {
  const info = await window.native.info();
  modal({ title: 'About Current', body: h('div', { style: { width: '420px', lineHeight: 1.6 } }, h('div.start-logo', h('img', { src: 'img/logo.svg' }), 'Current'), h('p', `Version ${info.version}. A template-rich video editor by webhookstudios, formerly called Splice. Part of the Sedge family of apps.`), h('p.hint', 'Rendering uses WebGL; export uses GStreamer (x264, VP9, AAC, Opus, LAME). Bundled fonts are under the SIL Open Font License.')) });
}

function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    const typing = (tag === 'INPUT' && !['range', 'checkbox', 'color'].includes(e.target.type)) || tag === 'TEXTAREA' || tag === 'SELECT';
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (document.querySelector('.modal-back') && !ctrl) return;
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
    if (ctrl && k.toLowerCase() === 'o') { e.preventDefault(); openProject(); return; }
    if (ctrl && k.toLowerCase() === 'n') { e.preventDefault(); newProjectFlow(); return; }
    if (ctrl && k.toLowerCase() === 'i') { e.preventDefault(); doImport(); return; }
    if (ctrl && k.toLowerCase() === 'e') { e.preventDefault(); openExport(); return; }
    if (typing) return;
    const p = app.player;
    const fps = store.project.fps || 30;
    if (startEl) return;
    if (e.altKey && /^[1-7]$/.test(k)) { setTab(['media', 'audio', 'title', 'transition', 'effect', 'filter', 'element'][+k - 1]); e.preventDefault(); return; }
    switch (true) {
      case k === ' ': e.preventDefault(); p.toggle(); break;
      case k === 'ArrowLeft': e.preventDefault(); p.seek(store.time - (e.shiftKey ? 1 : 1 / fps)); break;
      case k === 'ArrowRight': e.preventDefault(); p.seek(store.time + (e.shiftKey ? 1 : 1 / fps)); break;
      case k === 'Home': p.seek(0); break;
      case k === 'End': p.seek(store.project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)); break;
      case k === 'j' || k === 'J': p.seek(store.time - 5); break;
      case k === 'k' || k === 'K': p.pause(); break;
      case k === 'l' || k === 'L': p.seek(store.time + 5); break;
      case ctrl && k.toLowerCase() === 'z' && !e.shiftKey: e.preventDefault(); undo(); break;
      case ctrl && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey)): e.preventDefault(); redo(); break;
      case ctrl && k.toLowerCase() === 'b': e.preventDefault(); splitAtPlayhead(); break;
      case ctrl && k.toLowerCase() === 'd': e.preventDefault(); duplicateSelected(); break;
      case ctrl && k.toLowerCase() === 'c': copySelected(); break;
      case ctrl && k.toLowerCase() === 'x': cutSelected(); break;
      case ctrl && k.toLowerCase() === 'v': paste(); break;
      case ctrl && k.toLowerCase() === 'a': e.preventDefault(); selectAll(); break;
      case k === 'Delete' || k === 'Backspace': deleteSelected(e.shiftKey); break;
      case k === '+' || k === '=': setZoom(store.zoom * 1.4); break;
      case k === '-' || k === '_': setZoom(store.zoom / 1.4); break;
      case k === 'Z' && e.shiftKey: zoomFit(); break;
      case k === 'n' || k === 'N': store.snap = !store.snap; document.querySelector('[data-tip^="Snapping"]')?.classList.toggle('on', store.snap); toast(`Snapping ${store.snap ? 'on' : 'off'}`); break;
      case k === ',': nudgeSelection(-1 / fps); break;
      case k === '.': nudgeSelection(1 / fps); break;
      case k === '?': showShortcuts(); break;
      case k === 'Escape': closeMenu(); select([]); break;
      default: return;
    }
  });
}

boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;bottom:0;left:0;color:#f88;background:#000;padding:10px;z-index:9999">${e.stack}</pre>`); });
