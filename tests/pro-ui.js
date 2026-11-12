// The professional intros in the editor: they are listed first, every shape is its own piece,
// and dragging one piece moves only that piece.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const ptr = (el, type, x, y, extra = {}) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...extra }));
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const L = await import(base + 'ui/library.js');
  const S = st.store;
  L.setTab('pack'); await wait(400);
  const names = [...document.querySelectorAll('#library .card .nm, #library .card b, #library .card .name')].map((e) => e.textContent.trim()).filter(Boolean);
  log('first library cards:', names.slice(0, 6).join(' | '));
  check(names[0] === 'Block Reveal' && names.length >= 10 && names[9] === 'Shutter', `the ten professional intros are listed first (${names.slice(0, 10).join(', ')})`);
  await shot('pro-1-library');
  await A.insertPack((await import(base + 'templates/packs.js')).packById('intro-pro-block'), null, true);
  const t = S.project.clips.find((c) => c.template === 'pro-block');
  check(!!t, 'Block Reveal intro added');
  check(S.project.clips.some((c) => c.type === 'background') && S.project.clips.some((c) => c.type === 'audio'), 'pack brings its background and sound');
  st.select(t.id); S.emit('inspect', 'text'); A.app.player.seek(2.5); await wait(600);
  const parts = [...document.querySelectorAll('.part')];
  check(parts.length >= 6, `${parts.length} movable pieces (caption mark, caption, 2 revealed lines, rule, squares)`);
  await shot('pro-2-pieces');
  // drag the last piece (the big circle) and check only it moved
  const last = parts.at(-1), r = last.getBoundingClientRect();
  ptr(last, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2);
  ptr(window, 'pointermove', r.left + r.width / 2 - 60, r.top + r.height / 2 - 30);
  ptr(window, 'pointerup', r.left + r.width / 2 - 60, r.top + r.height / 2 - 30);
  await wait(300);
  const offs = t.params.offsets || {};
  const moved = Object.entries(offs).filter(([, o]) => Math.abs(o.x) > 0.001 || Math.abs(o.y) > 0.001);
  check(moved.length === 1, `dragging one accent moves only it (${moved.map(([k]) => k).join(', ')})`);
  await shot('pro-3-moved');
  // every professional title also shows in the Titles tab under Professional
  L.setTab('title'); await wait(300);
  const cat = [...document.querySelectorAll('#library .lib-cat')].find((e) => e.textContent.trim().startsWith('Professional'));
  if (cat) { cat.click(); await wait(300); await shot('pro-4-titles'); }
  log('title groups:', [...document.querySelectorAll('#library .lib-cat')].map((e) => e.textContent.trim()).join(' | '));
  check(!!cat, 'Titles tab has a Professional group');
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
