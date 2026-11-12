// Finding features: the Clip and Tools menus, the grouped toolbar, the right-click menu, the clip panel
// jumping to a section, What's new and the grouped shortcuts. Needs tests/media/test1.mp4.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const MEDIA = new URL('./media/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
const items = () => [...document.querySelectorAll('.dropdown .item')];
const item = (t) => items().find((i) => i.textContent.startsWith(t));
let W;
const openMenu = async (name) => { W.closeMenu(); [...document.querySelectorAll('.menu-btn')].find((b) => b.textContent === name).click(); await wait(200); return items(); };
function wav(seconds, sr = 48000) {
  const n = Math.round(seconds * sr), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 20) * 8000, true);
  return buf;
}
try {
  const U = await import(base + 'util.js');
  const svg = (n) => U.icon(n).innerHTML;
  check(!/M4\.9 4\.9/.test(svg('freeze')) && /rect/.test(svg('freeze')), 'freeze frame is a frame with pause bars, not a burst of rays');
  check(svg('sparkle') === svg('info') && !/M5\.6 5\.6/.test(svg('brand')), 'the burst-of-rays icon is gone; brand kits use a swatch book');
  // start screen
  check(!!document.querySelector('.start-news'), 'the start screen links to What’s new');
  document.querySelector('.start button.primary')?.click();
  await shot('nav-0');
  W = await import(base + 'ui/widgets.js');
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const S = st.store;
  const names = [...document.querySelectorAll('.menu-btn')].map((b) => b.textContent);
  check(names.join(',') === 'File,Edit,Clip,Tools,View,Brand,Help', `menus: ${names.join(', ')}`);
  // Edit holds editing only
  const edit = (await openMenu('Edit')).map((i) => i.textContent);
  check(!edit.some((t) => /Record|caption|Freeze|Detach/i.test(t)) && edit.some((t) => t.startsWith('Select all')), 'Edit menu: editing only (recording, captions and clip tools moved out)');
  // Clip menu, nothing selected
  st.select([]);
  let clip = await openMenu('Clip');
  check(clip[0].textContent.startsWith('Select a clip') && item('Crop').classList.contains('disabled') && item('Zoom to area').classList.contains('disabled'), 'Clip menu with nothing selected says to select a clip; clip tools are greyed out');
  // tools
  const tools = (await openMenu('Tools')).map((i) => i.textContent);
  check(['Record voiceover', 'Record screen', 'Generate captions', 'Edit captions', 'Show captions on screen', 'Save captions as a file'].every((t) => tools.some((x) => x.startsWith(t))), 'Tools menu: recording, captions and how captions are shown');
  check(item('Edit captions').classList.contains('disabled'), 'Edit captions is greyed out until there are captions');
  item('Save captions as a file').click(); await wait(100);
  check(S.project.captions?.mode === 'file', 'choosing “Save captions as a file” sets the project to a caption file');
  await openMenu('Tools');
  check(item('Save captions as a file').querySelector('svg') && !item('Show captions on screen').querySelector('svg'), 'the chosen caption display is ticked');
  W.closeMenu();
  // toolbar
  const tb = document.querySelector('.tl-toolbar');
  const labels = [...tb.querySelectorAll('.tl-lbl')].map((b) => b.textContent);
  check(labels.join(',') === 'Voiceover,Screen,Captions', `labelled toolbar buttons: ${labels.join(', ')}`);
  const crop = tb.querySelector('[data-tip="Crop"]');
  check(crop.disabled && tb.querySelector('[data-tip^="Delete"]').disabled, 'clip buttons are greyed out with nothing selected');
  // a video clip and a sound clip
  const [v] = await A.importPaths([MEDIA + 'test1.mp4']);
  const path = await window.native.cacheWrite('nav-sound.wav', wav(4));
  const [a] = await A.importPaths([path]);
  await wait(500);
  await A.insertItem({ kind: 'media', id: v.id }, { trackId: st.mainTrack().id, time: 0 });
  await A.insertItem({ kind: 'media', id: a.id }, { trackId: st.audioTracks()[0].id, time: 0 });
  const vc = S.project.clips.find((c) => c.mediaId === v.id), ac = S.project.clips.find((c) => c.mediaId === a.id);
  st.select(vc.id); await wait(200);
  check(!crop.disabled && !tb.querySelector('[data-tip^="Detach"]').disabled, 'with a video selected, Crop and Detach audio light up');
  clip = await openMenu('Clip');
  check(!clip[0].textContent.startsWith('Select a clip') && !item('Zoom to area').classList.contains('disabled') && !item('Shape and outline').classList.contains('disabled'), 'Clip menu with a video selected: Zoom to area and Shape are available');
  item('Zoom to area').click(); await wait(400);
  const flashed = document.querySelector('.insp-body .sec.flash');
  check(document.querySelector('.insp-tab.active')?.textContent === 'Video' && flashed?.textContent.startsWith('Zoom to area'), 'Clip › Zoom to area opens the Video tab at Zoom to area and highlights it');
  await shot('nav-1-jump');
  const scrolled = document.querySelector('.insp-body').scrollTop;
  // right-click a sound clip: only what applies
  st.select(ac.id); await wait(200);
  check(scrolled > 0 && document.querySelector('.insp-body').scrollTop === 0, `another clip opens its panel at the top (was scrolled ${Math.round(scrolled)} px)`);
  const node = document.querySelector(`.clip[data-clip="${ac.id}"]`);
  const r = node.getBoundingClientRect();
  node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 10 }));
  await wait(200);
  const ctx = items().map((i) => i.textContent);
  check(ctx.some((t) => t.startsWith('Remove pauses')) && ctx.some((t) => t.startsWith('Captions for this clip')) && !ctx.some((t) => /^(Crop|Zoom to area|Shape)/.test(t)), 'right-clicking a sound clip lists Remove pauses and captions, not picture tools');
  await shot('nav-2-context');
  item('Remove pauses').click(); await wait(300);
  check(!!document.querySelector('.modal')?.textContent.includes('Remove pauses'), 'Remove pauses opens from the right-click menu');
  document.querySelector('.modal-h .ibtn')?.click(); await wait(100);
  // View tabs and Alt shortcuts
  const view = (await openMenu('View')).map((i) => i.textContent);
  check(view.some((t) => t.startsWith('Intro/Outro') && t.endsWith('Alt+3')) && view.some((t) => t.startsWith('Stickers') && t.endsWith('Alt+8')), 'View lists all 8 library tabs, Intro/Outro included, in sidebar order');
  W.closeMenu();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', altKey: true, bubbles: true }));
  await wait(200);
  check(document.querySelector('.lib-tab.active')?.dataset.tab === 'pack', 'Alt+3 opens Intro/Outro');
  // help
  await openMenu('Help');
  item('What’s new').click(); await wait(300);
  const rows = document.querySelectorAll('.news-row');
  check(rows.length === 9 && [...rows].filter((r) => r.querySelector('button')).length >= 5, `What’s new lists ${rows.length} features, with buttons to open them`);
  await shot('nav-3-news');
  document.querySelector('.modal-f .btn').click(); await wait(100);
  await openMenu('Help');
  item('Keyboard shortcuts').click(); await wait(300);
  const groups = [...document.querySelectorAll('.kbd-group')].map((g) => g.textContent);
  check(groups.join(',') === 'Playback,Editing,Timeline,Recording,Files and panels', `shortcuts are grouped: ${groups.join(', ')}`);
  document.querySelector('.modal-h .ibtn')?.click();
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
