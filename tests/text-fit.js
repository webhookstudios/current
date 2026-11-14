// Text stays inside its bubble: draws every title, sticker and intro/outro layer in 16:9, 9:16 and 1:1,
// records each shape and each piece of text, and flags text that runs past the bubble, pill, card or box
// drawn behind it. Intro/outro packs are also checked for text from one layer landing on another's text.
//   npx electron . --selftest=tests/text-fit.js
// Each title is also tried with longer words, since every text can be edited.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const { TITLES } = await import(base + 'templates/titles.js');
const { ELEMENTS } = await import(base + 'templates/elements.js');
const { PACKS } = await import(base + 'templates/packs.js');
const { drawTemplateTo } = await import(base + 'engine/renderer.js');
const ONLY = null; // set to part of a template id to check just that one
let bad = 0;
let PAD = 0; // room wanted beside text in its shape, as a fraction of the text height (set per pass)
const found = [];

// A 2D context that remembers, in canvas pixels, every filled shape and every piece of text it draws.
function recorder(ctx) {
  const R = { shapes: [], texts: [] };
  let path = [], clip = null;
  const stack = [];
  const pt = (x, y) => { const m = ctx.getTransform(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; };
  const add = (x, y) => path.push(pt(x, y));
  const box = (ps) => { const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
  const cut = (b) => { if (!clip) return b; const x = Math.max(b.x, clip.x), y = Math.max(b.y, clip.y), r = Math.min(b.x + b.w, clip.x + clip.w), btm = Math.min(b.y + b.h, clip.y + clip.h); return r > x && btm > y ? { x, y, w: r - x, h: btm - y } : null; };
  const o = {};
  for (const k of ['beginPath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'clip', 'save', 'restore']) o[k] = ctx[k].bind(ctx);
  const visible = () => ctx.globalAlpha > 0.15 && ctx.globalCompositeOperation === 'source-over';
  let closed = false;
  ctx.beginPath = () => { path = []; closed = false; o.beginPath(); };
  ctx.closePath = () => { closed = true; o.closePath(); };
  ctx.moveTo = (x, y) => { add(x, y); o.moveTo(x, y); };
  ctx.lineTo = (x, y) => { add(x, y); o.lineTo(x, y); };
  ctx.arc = (x, y, r, a0, a1, ccw) => { if (Math.abs(a1 - a0) >= Math.PI * 2 - 0.01) closed = true; add(x - r, y - r); add(x + r, y + r); o.arc(x, y, r, a0, a1, ccw); };
  ctx.arcTo = (x1, y1, x2, y2, r) => { add(x1, y1); add(x2, y2); o.arcTo(x1, y1, x2, y2, r); };
  ctx.ellipse = (x, y, rx, ry, ...a) => { const r = Math.max(rx, ry); add(x - r, y - r); add(x + r, y + r); o.ellipse(x, y, rx, ry, ...a); };
  ctx.rect = (x, y, w, h) => { closed = true; add(x, y); add(x + w, y + h); o.rect(x, y, w, h); };
  ctx.roundRect = (x, y, w, h, r) => { closed = true; add(x, y); add(x + w, y + h); o.roundRect(x, y, w, h, r); };
  ctx.quadraticCurveTo = (a, b, x, y) => { add(x, y); o.quadraticCurveTo(a, b, x, y); };
  ctx.bezierCurveTo = (a, b, c, d, x, y) => { add(x, y); o.bezierCurveTo(a, b, c, d, x, y); };
  ctx.fill = (...a) => { if (path.length > 1 && !(a[0] instanceof Path2D) && visible()) { const b = cut(box(path)); if (b) R.shapes.push({ ...b, n: R.texts.length }); } o.fill(...a); };
  ctx.stroke = (...a) => { if (closed && path.length > 1 && !(a[0] instanceof Path2D) && visible()) { const b = cut(box(path)); if (b && b.w > 30 && b.h > 30) R.shapes.push({ ...b, n: R.texts.length, line: true }); } o.stroke(...a); };
  ctx.strokeRect = (x, y, w, h) => { if (visible()) { const b = cut(box([pt(x, y), pt(x + w, y), pt(x, y + h), pt(x + w, y + h)])); if (b && b.w > 30 && b.h > 30) R.shapes.push({ ...b, n: R.texts.length, line: true }); } o.strokeRect(x, y, w, h); };
  ctx.fillRect = (x, y, w, h) => { if (visible()) { const b = cut(box([pt(x, y), pt(x + w, y), pt(x, y + h), pt(x + w, y + h)])); if (b) R.shapes.push({ ...b, n: R.texts.length }); } o.fillRect(x, y, w, h); };
  const text = (s, x, y, mw) => {
    if (!String(s).trim() || !visible()) return;
    const m = ctx.measureText(s);
    let l = x - m.actualBoundingBoxLeft, r = x + m.actualBoundingBoxRight;
    if (mw && m.width > mw) { const f = mw / m.width; l = x + (l - x) * f; r = x + (r - x) * f; }
    const b = cut(box([pt(l, y - m.actualBoundingBoxAscent), pt(r, y - m.actualBoundingBoxAscent), pt(l, y + m.actualBoundingBoxDescent), pt(r, y + m.actualBoundingBoxDescent)]));
    if (b && b.w > 1 && b.h > 1) R.texts.push({ ...b, s: String(s), i: R.shapes.length });
  };
  ctx.fillText = (s, x, y, mw) => { text(s, x, y, mw); mw === undefined ? o.fillText(s, x, y) : o.fillText(s, x, y, mw); };
  ctx.strokeText = (s, x, y, mw) => { text(s, x, y, mw); mw === undefined ? o.strokeText(s, x, y) : o.strokeText(s, x, y, mw); };
  ctx.clip = (...a) => { if (path.length > 1 && !(a[0] instanceof Path2D)) clip = cut(box(path)) || { x: 0, y: 0, w: 0, h: 0 }; o.clip(...a); };
  ctx.save = () => { stack.push(clip); o.save(); };
  ctx.restore = () => { clip = stack.pop() ?? null; o.restore(); };
  R.reset = () => { R.shapes = []; R.texts = []; path = []; clip = null; stack.length = 0; };
  return R;
}

// Animated text is drawn letter by letter: join letters drawn one after another on the same line into words.
function runs(texts) {
  const out = [];
  for (const T of texts) {
    const L = out[out.length - 1];
    const h = Math.max(T.h, L?.h || 0);
    if (L && Math.abs((L.y + L.h / 2) - (T.y + T.h / 2)) < h * 0.35 && T.x - (L.x + L.w) < h * 0.8 && T.x + T.w > L.x - h * 0.5) {
      const x = Math.min(L.x, T.x), y = Math.min(L.y, T.y);
      Object.assign(L, { x, y, w: Math.max(L.x + L.w, T.x + T.w) - x, h: Math.max(L.y + L.h, T.y + T.h) - y, s: L.s + (T.s.length === 1 && L.s.length && !L.multi ? '' : ' ') + T.s });
    } else out.push({ ...T });
  }
  return out;
}
// Text sits on a shape when the shape was drawn before it, is at least as tall as the text, holds the
// text's middle line, and overlaps it for at least half the narrower width. The last such shape is the
// text's bubble, and the text must stay inside it.
function overflows(R, W, H, u) {
  const out = [];
  const frame = W * H;
  for (const T of runs(R.texts)) {
    const cy = T.y + T.h / 2;
    const ov = (S) => Math.min(S.x + S.w, T.x + T.w) - Math.max(S.x, T.x);
    const under = R.shapes.slice(0, T.i).filter((S) => S.w * S.h < frame * 0.5 && S.h >= T.h * 0.95 && S.w >= T.h && cy > S.y && cy < S.y + S.h && ov(S) >= Math.min(T.w, S.w) * 0.5);
    const S = under[under.length - 1];
    if (!S) continue;
    const pad = PAD * T.h; // room wanted between the text and the shape's sides
    const over = Math.max(S.x - T.x + pad, T.x + T.w - (S.x + S.w) + pad, S.y - T.y, T.y + T.h - (S.y + S.h));
    if (over > 3 * u) out.push({ s: T.s, over: Math.round(over), text: T, shape: S });
  }
  return out;
}
function summarize(list) {
  const by = new Map();
  for (const f of list) { const k = `${Math.round(f.shape.x)},${Math.round(f.shape.y)}`; const g = by.get(k) || { s: '', over: 0 }; g.s += (g.s ? ' / ' : '') + f.s; g.over = Math.max(g.over, f.over); by.set(k, g); }
  return [...by.values()];
}
const longer = (s) => (typeof s === 'string' && s.trim() ? s + (s === s.toUpperCase() ? ' AND MORE' : ' and more') : s);
const t = (dur) => Math.max(0.5, Math.min(dur - 0.8, 2.6)); // everything has animated in

// Pass 1: the words each template comes with, with some room around them inside their bubble.
// Pass 2: a longer word on every line, as when someone types their own: bubbles must grow, or the
// words must shrink to fit shapes that keep their size.
for (const [LONG, pad, name] of [[false, 0.2, ''], [true, 0, ' (longer words)']]) {
PAD = pad;
for (const [W, H, label0] of [[1920, 1080, '16:9'], [1080, 1920, '9:16'], [1080, 1080, '1:1']]) {
  const label = label0 + name;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const R = recorder(ctx);
  const u = Math.min(W, H) / 1080;
  const check = (what, clip, dur) => {
    R.reset();
    drawTemplateTo(ctx, clip, W, H, t(dur), []);
    for (const g of summarize(overflows(R, W, H, u))) { bad++; found.push(`${label} ${what}: “${g.s}” runs ${g.over} px past its shape`); }
    return R.texts.map((x) => ({ ...x }));
  };
  for (const T of TITLES) {
    if (ONLY && !T.id.includes(ONLY)) continue;
    const texts = LONG ? (T.texts || []).map(longer) : undefined;
    check(`title ${T.id}`, { type: 'title', template: T.id, start: 0, duration: T.dur || 5, params: texts ? { texts } : {} }, T.dur || 5);
  }
  for (const E of ELEMENTS) {
    if (ONLY && !E.id.includes(ONLY)) continue;
    const texts = LONG && E.texts ? E.texts.map(longer) : undefined;
    check(`sticker ${E.id}`, { type: 'element', template: E.id, start: 0, duration: E.dur || 5, params: texts ? { texts } : {} }, E.dur || 5);
  }
  // packs: each layer with its own words and colours, then text from different layers must not meet
  for (const P of LONG ? [] : PACKS) {
    if (ONLY && !P.id.includes(ONLY)) continue;
    const placed = [], shapes = [];
    P.layers.forEach((L, li) => {
      if (L.kind !== 'title' && L.kind !== 'element') return;
      const params = { ...(L.params || {}) };
      if (L.texts) params.texts = L.texts;
      if (L.colors) params.colors = L.colors;
      const at = L.at || 0, dur = L.dur ?? P.dur - at;
      R.reset();
      drawTemplateTo(ctx, { type: L.kind, template: L.id, start: 0, duration: dur, params }, W, H, Math.min(t(P.dur) - at, dur - 0.3) > 0.4 ? Math.min(t(P.dur) - at, dur - 0.3) : 0.5, []);
      for (const g of summarize(overflows(R, W, H, u))) { bad++; found.push(`${label} pack ${P.id} (${L.id}): “${g.s}” runs ${g.over} px past its shape`); }
      const sc = L.scale ?? 1, ox = (L.x || 0) * W, oy = (L.y || 0) * H;
      const mv = (x) => ({ x: W / 2 + (x.x - W / 2) * sc + ox, y: H / 2 + (x.y - H / 2) * sc + oy, w: x.w * sc, h: x.h * sc });
      for (const x of runs(R.texts)) placed.push({ li, id: L.id, s: x.s, ...mv(x) });
      for (const x of R.shapes) if (!x.line && x.w * x.h < W * H * 0.5) shapes.push({ li, id: L.id, ...mv(x) });
    });
    // text from one layer that runs across the edge of another layer's bubble, card or sticker
    for (const T of placed) for (const S of shapes) {
      if (S.li === T.li) continue;
      const f = (Math.max(0, Math.min(S.x + S.w, T.x + T.w) - Math.max(S.x, T.x)) * Math.max(0, Math.min(S.y + S.h, T.y + T.h) - Math.max(S.y, T.y))) / (T.w * T.h);
      if (f > 0.12 && f < 0.88 && S.w * S.h > T.w * T.h * 0.3) { bad++; found.push(`${label} pack ${P.id}: “${T.s}” (${T.id}) runs across ${S.id}`); break; }
    }
    const hits = new Set();
    for (const a of placed) for (const b of placed) {
      if (a.li >= b.li) continue;
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 4 * u && iy > Math.min(a.h, b.h) * 0.25) hits.add(`${a.id} and ${b.id}`);
    }
    for (const k of hits) { bad++; found.push(`${label} pack ${P.id}: text from ${k} overlaps`); }
  }
}
}
found.forEach((f) => log('FAIL', f));
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
