// Contact sheets of the professional intros and outros: each row is one pack at eight moments,
// from the first motion to the last frame. Writes tests/out/pro-16x9.b64 and pro-9x16.b64 (PNG).
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const { PACKS } = await import(base + 'templates/packs.js');
const { drawTemplateTo } = await import(base + 'engine/renderer.js');
const { titleById } = await import(base + 'templates/titles.js');
const packs = PACKS.filter((p) => /-pro-/.test(p.id));
let bad = 0;
if (packs.length !== 20) { bad++; log('expected 20 professional packs, found', packs.length); }

function frame(ctx, pk, W, H, t) {
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  for (const L of pk.layers) {
    if (L.kind === 'audio') continue;
    const at = L.at || 0, dur = L.dur ?? pk.dur - at;
    if (t < at || t >= at + dur) continue;
    const lc = layer.getContext('2d'); lc.clearRect(0, 0, W, H);
    drawTemplateTo(lc, { type: L.kind, template: L.id, start: at, duration: dur, params: { ...(L.colors ? { colors: L.colors } : {}), ...(L.params || {}) } }, W, H, t);
    ctx.drawImage(layer, 0, 0);
  }
}

async function sheet(W, H, cw, name, list) {
  const times = (d) => [0.2, 0.45, 0.8, 1.3, 2.5, d - 0.75, d - 0.35, d - 0.05];
  const ch = Math.round(cw * H / W), cols = 8;
  const sh = document.createElement('canvas'); sh.width = cw * cols; sh.height = (ch + 18) * list.length;
  const sx = sh.getContext('2d'); sx.fillStyle = '#333'; sx.fillRect(0, 0, sh.width, sh.height);
  const cell = document.createElement('canvas'); cell.width = W; cell.height = H;
  list.forEach((pk, r) => times(pk.dur).forEach((t, i) => {
    frame(cell.getContext('2d'), pk, W, H, t);
    sx.drawImage(cell, i * cw, r * (ch + 18), cw - 2, ch);
    sx.fillStyle = '#fff'; sx.font = '12px sans-serif';
    sx.fillText(`${pk.name}  t=${t.toFixed(2)}`, i * cw + 4, r * (ch + 18) + ch + 13);
  }));
  const blob = await new Promise((res) => sh.toBlob(res, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  await window.native.writeText(OUT + name + '.b64', btoa(s));
}

// Every title of every pack: the last frame is empty of text, and pieces stay on screen at rest.
for (const pk of packs) {
  for (const L of pk.layers.filter((l) => l.kind === 'title')) {
    const T = titleById(L.id);
    if (!T) { bad++; log('missing title', L.id); continue; }
    for (const [W, H] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const rec = [];
      drawTemplateTo(cv.getContext('2d'), { type: 'title', template: T.id, start: 0, duration: T.dur, params: {} }, W, H, 2.6, rec);
      for (const r of rec) if (r.x < -W * 0.02 || r.y < -H * 0.02 || r.x + r.w > W * 1.08 || r.y + r.h > H * 1.08) { if (r.type === 'text') { bad++; log(`OFFSCREEN ${W}x${H} ${T.id} ${r.key} ${r.type}`); } }
    }
  }
}
await sheet(960, 540, 320, 'pro-16x9', packs);
await sheet(540, 960, 160, 'pro-9x16', packs);
log(`${packs.length} packs drawn`);
log(bad ? `FAILED ${bad}` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
