// Colour picking, title-piece dragging and the audio play icon.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const M = decodeURIComponent(new URL('./media/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const ptr = (el, type, x, y, extra = {}) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...extra }));
let bad = 0;
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const S = st.store;
  const [photo, green] = await A.importPaths([M + 'photo.png', M + 'green.mp4']);
  await A.insertItem({ kind: 'media', id: photo.id }, { trackId: st.mainTrack().id, time: 0 });
  await A.insertItem({ kind: 'media', id: green.id }, { trackId: st.videoTracks()[1].id, time: 0 });
  const g = S.project.clips.find((c) => c.mediaId === green.id);
  A.app.player.seek(1); await wait(600);
  st.select(g.id); S.emit('inspect', 'chroma'); await wait(300);
  // 1. pick: the video sits on top; the click must sample, not start a move
  const btn = [...document.querySelectorAll('.insp-body button')].find((b) => b.textContent.includes('Pick from preview'));
  btn.click(); await wait(200);
  const pickLayer = document.querySelector('.picker');
  log('picker shown', !!pickLayer, 'button says', btn.textContent);
  if (!pickLayer) bad++;
  await shot('4-picking');
  const r = document.querySelector('canvas.out').getBoundingClientRect();
  const x = r.left + r.width * 0.06, y = r.top + r.height * 0.5; // green background area
  const tf0 = JSON.stringify(g.transform);
  ptr(pickLayer, 'pointermove', x, y); ptr(pickLayer, 'pointerdown', x, y); ptr(window, 'pointerup', x, y);
  await wait(200);
  log('picked colour', g.chroma.color, 'key on', g.chroma.on, 'moved?', JSON.stringify(g.transform) !== tf0);
  const gg = parseInt(g.chroma.color.slice(3, 5), 16);
  if (gg < 150 || !g.chroma.on || JSON.stringify(g.transform) !== tf0) bad++;
  // 2. after the pick, picking is over: no picker, and clicks move the clip again
  if (document.querySelector('.picker')) { bad++; log('picker still active after pick'); }
  const bbox = document.querySelector('.bbox');
  const b = bbox.getBoundingClientRect();
  ptr(bbox, 'pointerdown', b.left + b.width / 2, b.top + b.height / 2); ptr(window, 'pointermove', b.left + b.width / 2 + 40, b.top + b.height / 2); ptr(window, 'pointerup', 0, 0);
  log('after pick, drag moves clip', g.transform.x.toFixed(3));
  if (Math.abs(g.transform.x) < 0.01) bad++;
  // 3. Esc cancels, and switching tabs cancels
  btn.isConnected ? btn.click() : [...document.querySelectorAll('.insp-body button')].find((x) => x.textContent.includes('Pick from preview')).click();
  await wait(100);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(100);
  if (document.querySelector('.picker')) { bad++; log('Esc did not cancel'); }
  [...document.querySelectorAll('.insp-body button')].find((x) => x.textContent.includes('Pick from preview')).click();
  await wait(100);
  [...document.querySelectorAll('.insp-tab')].find((t) => t.textContent === 'Video').click();
  await wait(100);
  if (document.querySelector('.picker')) { bad++; log('tab switch did not cancel'); }
  else log('Esc and tab switch both cancel picking');
  // 4. title pieces move independently
  await A.insertItem({ kind: 'title', id: 'open-split' }, { trackId: st.videoTracks()[0].id, time: 0 });
  const t = S.project.clips.at(-1);
  st.select(t.id); S.emit('inspect', 'text'); A.app.player.seek(2.5); await wait(500);
  const parts = [...document.querySelectorAll('.part')];
  log('title pieces', parts.length);
  if (parts.length !== 3) bad++;
  const top = parts.find((p) => p.classList.contains('t-text'));
  const pr = top.getBoundingClientRect();
  ptr(top, 'pointerdown', pr.left + 5, pr.top + 5); ptr(window, 'pointermove', pr.left + 5 - 120, pr.top + 5 - 30); ptr(window, 'pointerup', 0, 0);
  await wait(300);
  log('offsets', JSON.stringify(t.params.offsets), 'whole clip x', t.transform.x);
  if (!t.params.offsets?.p1 || t.transform.x !== 0) bad++;
  await shot('4-pieces');
  // 5. audio play icon is visible (icon colour differs from button colour)
  document.querySelector('.lib-tab[data-tab="audio"]').click(); await wait(200);
  [...document.querySelectorAll('.lib-cat')].find((c) => c.textContent.startsWith('Music')).click(); await wait(200);
  const ap = document.querySelector('.audio-play');
  const ic = getComputedStyle(ap.querySelector('svg')).color, bgc = getComputedStyle(ap).backgroundColor;
  log('audio button icon', ic, 'on', bgc);
  if (ic === bgc) bad++;
  ap.click(); await wait(1500);
  log('audio button now shows', ap.querySelector('path').getAttribute('d').startsWith('M7 4h') ? 'pause' : 'play');
  ap.click();
  log(bad ? `FAILED ${bad}` : 'ALL OK');
} catch (e) { bad++; log('FATAL', e.stack); }
window.native.selftestDone(bad);
