// Checks every title in 16:9, 9:16 and 1:1 for text colliding with lines or other text,
// and writes a contact sheet of all titles for a visual check.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const { TITLES } = await import(base + 'templates/titles.js');
const { drawTemplateTo } = await import(base + 'engine/renderer.js');
let bad = 0;
const shrink = (b, f) => ({ x: b.x, w: b.w, y: b.y + b.h * (1 - f) / 2, h: b.h * f });
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
for (const [W, H, label] of [[1920, 1080, '16:9'], [1080, 1920, '9:16'], [1080, 1080, '1:1']]) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  for (const T of TITLES) {
    const clip = { type: 'title', template: T.id, start: 0, duration: T.dur, params: {} };
    const t = Math.min(T.dur - 0.8, 2.6); // everything has animated in
    const rec = [];
    drawTemplateTo(ctx, clip, W, H, t, rec);
    const texts = rec.filter((r) => r.type === 'text').map((r) => shrink(r, 0.72));
    const lines = rec.filter((r) => r.type === 'line').map((r) => shrink(r, 0.4));
    for (let i = 0; i < texts.length; i++) {
      for (const L of lines) if (hit(texts[i], L)) { bad++; log(`COLLIDE ${label} ${T.id}: text and line`); }
      for (let j = i + 1; j < texts.length; j++) if (hit(texts[i], texts[j])) { bad++; log(`COLLIDE ${label} ${T.id}: text ${i} and text ${j}`); }
      const b = texts[i];
      if (b.x < -2 || b.x + b.w > W + 2) { bad++; log(`OFFSCREEN ${label} ${T.id}: text ${i} wider than frame`); }
    }
  }
}
// contact sheet (16:9)
const cw = 320, ch = 180, cols = 8, rows = Math.ceil(TITLES.length / cols);
const sheet = document.createElement('canvas'); sheet.width = cw * cols; sheet.height = (ch + 18) * rows;
const sx = sheet.getContext('2d'); sx.fillStyle = '#222'; sx.fillRect(0, 0, sheet.width, sheet.height);
const cell = document.createElement('canvas'); cell.width = 960; cell.height = 540;
TITLES.forEach((T, i) => {
  const c = cell.getContext('2d');
  drawTemplateTo(c, { type: 'title', template: T.id, start: 0, duration: T.dur, params: {} }, 960, 540, Math.min(T.dur - 0.8, 2.6));
  const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 18);
  sx.fillStyle = '#3a4a5a'; sx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
  sx.drawImage(cell, x, y, cw, ch);
  sx.fillStyle = '#fff'; sx.font = '12px sans-serif'; sx.fillText(T.id, x + 4, y + ch + 13);
});
const blob = await new Promise((r) => sheet.toBlob(r, 'image/png'));
const buf = new Uint8Array(await blob.arrayBuffer());
await window.native.writeText(OUT + 'titles-sheet.b64', btoa(Array.from(buf, (b) => String.fromCharCode(b)).join('')));
log(bad ? `FAILED ${bad}` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
