// Zoom to area and clip shapes, checked on pixels: a 4-colour test image (red, green / blue, yellow).
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const ptr = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const S = st.store;
  const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
  const g = cv.getContext('2d');
  [['#ff0000', 0, 0], ['#00ff00', 960, 0], ['#0000ff', 0, 540], ['#ffff00', 960, 540]].forEach(([c, x, y]) => { g.fillStyle = c; g.fillRect(x, y, 960, 540); });
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const path = await window.native.cacheWrite('test-quadrants.png', await blob.arrayBuffer());
  const [m] = await A.importPaths([path]);
  await A.insertItem({ kind: 'media', id: m.id }, { trackId: st.mainTrack().id, time: 0 });
  const c = S.project.clips[0];
  const comp = A.app.compositor;
  const px = (t, fx, fy) => { // colour at a point of the rendered frame (fractions)
    A.app.player.renderNow(t);
    const out = comp.readPixels();
    const x = Math.floor(fx * (comp.W - 1)), y = Math.floor((1 - fy) * (comp.H - 1));
    const i = (y * comp.W + x) * 4;
    return [out[i], out[i + 1], out[i + 2]];
  };
  const near = (a, b, tol = 40) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  // zoom into the yellow quarter from 1 s for 3 s
  st.edit(() => { c.zooms = [{ at: 1, dur: 3, x: 0.5, y: 0.5, w: 0.5, h: 0.5 }]; });
  check(near(px(0.5, 0.25, 0.25), [255, 0, 0]), 'before the zoom: the whole picture (red top-left)');
  check(near(px(2.5, 0.1, 0.1), [255, 255, 0]) && near(px(2.5, 0.9, 0.9), [255, 255, 0]), 'during the zoom: yellow fills the frame');
  const mid = px(1.3, 0.3, 0.3);
  log('half way in, a point at 30% / 30%:', mid.join(','));
  check(!near(mid, [255, 0, 0]) || !near(px(1.3, 0.1, 0.1), [255, 0, 0]), 'easing: half way in, the picture has moved');
  check(near(px(4.5, 0.25, 0.25), [255, 0, 0]), 'after the zoom: back to the whole picture');
  // shapes
  st.edit(() => { c.zooms = []; c.shape = 'circle'; });
  check(near(px(0.5, 0.02, 0.05), [0, 0, 0], 10) && near(px(0.5, 0.5 - 0.15, 0.5 - 0.15), [255, 0, 0]), 'circle: corners cut away, the middle kept');
  st.edit(() => { c.shape = 'rounded'; });
  check(near(px(0.5, 0.002, 0.004), [0, 0, 0], 10) && near(px(0.5, 0.02, 0.25), [255, 0, 0], 60), 'rounded: only the very corners cut away');
  st.edit(() => { c.shape = 'circle'; c.border = { width: 16, color: '#ffffff' }; });
  check(near(px(0.5, 0.5, 0.0085), [255, 255, 255], 60), 'outline drawn at the edge of the circle');
  st.edit(() => { c.shape = null; c.border = null; });
  // the Video tab: add a zoom by dragging a box on the preview
  A.app.player.seek(1); st.select(c.id); S.emit('inspect', 'video'); await wait(300);
  const txt = document.querySelector('.insp-body').textContent;
  check(txt.includes('Shape') && txt.includes('Zoom to area'), 'Video tab has Shape and Zoom to area');
  [...document.querySelectorAll('.insp-body button')].find((b) => b.textContent.includes('Add zoom at playhead')).click();
  await wait(200);
  const layer = document.querySelector('.area-pick');
  check(!!layer, 'the preview asks for a box');
  const r = document.querySelector('canvas.out').getBoundingClientRect();
  ptr(layer, 'pointerdown', r.left + r.width * 0.55, r.top + r.height * 0.55);
  ptr(window, 'pointermove', r.left + r.width * 0.75, r.top + r.height * 0.7);
  await shot('zoom-1-pick');
  ptr(window, 'pointerup', 0, 0);
  await wait(300);
  const z = st.clipById(c.id).zooms?.[0];
  check(!!z && Math.abs(z.at - 1) < 0.05 && Math.abs(z.w - z.h) < 1e-6 && Math.abs(z.x - 0.55) < 0.01, `zoom added at the playhead with the project's shape (${z && [z.x, z.y, z.w, z.h].map((v) => v.toFixed(2)).join(', ')})`);
  check(!document.querySelector('.area-pick'), 'picking ends after the drag');
  A.app.player.seek(2.2); await wait(400);
  await shot('zoom-2-zoomed');
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
