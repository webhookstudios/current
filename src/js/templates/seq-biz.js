// Professional mid-rolls: business pieces for the middle of a video (a key number, a funnel, pricing,
// a team member...). Every word and number is editable, every part can be moved, and each works in
// 16:9, 9:16 and 1:1.
import {
  tx, col, kin, kend, lerp, frame, TY, sized, stack, pill, card, checkBadge, glyph, iconDisc, countUp, numOf, listOf,
  wrapO, measure, animText, drawText, piece, line, roundRect, growRect, polyPart, ease, clamp, rgba,
  K, area, fo, header, para, column,
} from './scenekit.js';

const L = [];
const seq = (id, name, theme, o, draw) => L.push({ id, name, cat: 'Professional', dur: 6, bg: TH[theme].bg, colors: TH[theme].c, ...o, draw });

// Colour sets: [text, accent, second accent, muted text, card, text on the accent].
const TH = {
  slate: { bg: ['bg-navy', '#0f172a'], c: ['#ffffff', '#38bdf8', '#a78bfa', '#9ca3af', '#ffffff', '#0b1220'] },
  white: { bg: ['bg-white', '#ffffff'], c: ['#111827', '#2563eb', '#10b981', '#6b7280', '#f3f4f6', '#ffffff'] },
  sand: { bg: ['bg-white', '#f6f1e9'], c: ['#1c1917', '#c2410c', '#0f766e', '#78716c', '#ffffff', '#ffffff'] },
  carbon: { bg: ['bg-charcoal', '#18181b'], c: ['#fafafa', '#f97316', '#22c55e', '#a1a1aa', '#ffffff', '#111111'] },
  deep: { bg: ['bg-navy', '#13293d'], c: ['#ffffff', '#ffd166', '#06d6a0', '#aab4c0', '#ffffff', '#111827'] },
  mist: { bg: ['bg-white', '#eef2f7'], c: ['#0f172a', '#4f46e5', '#0ea5e9', '#64748b', '#ffffff', '#ffffff'] },
};
const UP = '#16a34a', DOWN = '#e11d48';
const words = (t) => String(t).split(/\s+/).filter(Boolean);
const still0 = { anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 };

// A small label and a title, left-aligned or centred: { h, draw(x, y) }.
function topBlock(ctx, S, k, li, ti, mw, size = 72, align = 'left') {
  const items = [
    { text: tx(S, li), o: TY.label, color: k.acc, anim: 'fade', delay: 0.1 },
    { text: wrapO(ctx, S, tx(S, ti), sized(TY.title, size), mw), o: sized(TY.title, size), color: k.ink, gap: 20, delay: 0.25 },
  ].filter((it) => it.text);
  return { h: stack(ctx, S, items, 0, 0, { maxW: mw, draw: false }), draw: (x, y) => stack(ctx, S, items, x, y, { maxW: mw, align }) };
}
// A pill with an up or down arrow for a change like "+12%".
function delta(ctx, S, text, x, y, { align = 'left', delay = 1.2, size = 32 } = {}) {
  const u = S.u, down = /^\s*[-−]/.test(text), c = down ? DOWN : UP, o = sized(TY.strong, size);
  const m = measure(ctx, S, text, o), h = size * 1.7 * u, w = m.w + h + 40 * u;
  const x0 = align === 'center' ? x - w / 2 : x;
  growRect(ctx, x0, y - h / 2, w, h, kin(S, delay, 0.4, ease.outExpo), 'l', rgba(c, 0.15), h / 2, fo(S));
  piece(ctx, { x: x0 + 14 * u, y: y - h / 2, w: h * 0.8, h }, (cx) => { const kk = kin(S, delay + 0.15, 0.3); if (kk <= 0) return; cx.globalAlpha = fo(S) * kk; cx.save(); cx.translate(x0 + 14 * u + h * 0.35, y); cx.rotate(down ? Math.PI / 2 : -Math.PI / 2); glyph(cx, 'arrow', 0, 0, h * 0.34, c, 1, u); cx.restore(); });
  animText(ctx, S, text, x0 + h + 18 * u, y, { ...o, color: c, align: 'left', anim: 'fade', delay: delay + 0.2 });
  return w;
}
// A tiny line graph.
function spark(c, pts, x, y, w, h, k, color, u) {
  const lo = Math.min(...pts), hi = Math.max(...pts), sp = Math.max(1e-6, hi - lo);
  const P = pts.map((v, i) => [x + (w * i) / (pts.length - 1), y + h - ((v - lo) / sp) * h]);
  c.strokeStyle = color; c.lineWidth = 4 * u; c.lineCap = 'round'; c.lineJoin = 'round';
  return polyPart(c, P, k);
}

// 1. Big Number: a large figure counts up, with what it is and how it changed.
function kpi(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const no = { ...sized(TY.big, f.tall ? 200 : 240), fontFixed: true };
  const mN = measure(ctx, S, tx(S, 1), no), nH = mN.h * Math.min(1, cw / mN.w) * 0.85;
  column(f, [
    [40 * u, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + 20 * u, { ...sized(TY.label, 32), color: k.muted, anim: 'fade', delay: 0.1, maxWidth: mw })],
    [nH, (y) => animText(ctx, S, countUp(tx(S, 1), kin(S, 0.25, 1.6, ease.outQuart)), f.W / 2, y + nH / 2, { ...no, color: k.ink, anim: 'up', delay: 0.2, stagger: 0, maxWidth: mw })],
    [56 * u, (y) => delta(ctx, S, tx(S, 2), f.W / 2, y + 28 * u, { align: 'center', delay: 1.3 })],
    [40 * u, (y) => animText(ctx, S, tx(S, 3), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.6, maxWidth: mw })],
  ], 30 * u);
}

// 2. Quarterly Bars: bars rise with their values above them and the period under them.
function bars(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const labels = words(tx(S, 2)), vals = listOf(tx(S, 3), [420, 515, 480, 640]), n = Math.min(labels.length || vals.length, vals.length);
  const hi = Math.max(...vals), tb = topBlock(ctx, S, k, 0, 1, mw, 68);
  const chartH = (f.tall ? 0.42 : 0.44) * f.H, slot = cw / n, bw = Math.min(slot * 0.56, 220 * u);
  column(f, [
    [tb.h, (y) => tb.draw(x0, y)],
    [chartH, (y) => {
      const base = y + chartH - 50 * u, top = y + 60 * u, ch = base - top;
      line(ctx, x0, base, x0 + cw, base, kin(S, 0.3, 0.5, ease.inOutCubic) * fo(S), rgba(k.ink, 0.25), 3 * u);
      for (let i = 0; i < n; i++) {
        const kk = kin(S, 0.5 + i * 0.15, 0.7, ease.outCubic), h = ch * (vals[i] / hi), bx = x0 + slot * (i + 0.5);
        growRect(ctx, bx - bw / 2, base - h, bw, h, kk, 'u', i === n - 1 ? k.acc : rgba(k.ink, 0.22), 10 * u, fo(S));
        animText(ctx, S, countUp(String(vals[i]), kk), bx, base - h * kk - 30 * u, { ...sized(TY.num, 38), color: i === n - 1 ? k.acc : k.ink, anim: 'fade', delay: 0.6 + i * 0.15, maxWidth: (slot * 0.95) / f.W });
        animText(ctx, S, labels[i] || '', bx, base + 28 * u, { ...TY.strong, size: 32, color: k.muted, anim: 'fade', delay: 0.5 + i * 0.15, maxWidth: (slot * 0.95) / f.W });
      }
    }],
  ], 40 * u);
}

// 3. Growth Line: a line chart over a grid, with the period along the bottom and the latest value.
function growth(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const vals = listOf(tx(S, 3), [1.2, 1.5, 1.4, 1.9, 2.3, 2.2, 2.8, 3.1, 3.0, 3.6, 4.0, 4.4]), axis = words(tx(S, 2));
  const tb = topBlock(ctx, S, k, 0, 1, mw, 68), chartH = (f.tall ? 0.4 : 0.46) * f.H;
  column(f, [
    [tb.h, (y) => tb.draw(x0, y)],
    [chartH, (y) => {
      const top = y + 70 * u, base = y + chartH - 50 * u, lo = Math.min(...vals) * 0.8, hi = Math.max(...vals);
      for (let g = 0; g < 4; g++) line(ctx, x0, lerp(base, top, g / 3), x0 + cw, lerp(base, top, g / 3), kin(S, 0.2 + g * 0.05, 0.5) * fo(S), rgba(k.ink, g ? 0.1 : 0.3), 2 * u);
      const P = vals.map((v, i) => [x0 + (cw * i) / (vals.length - 1), lerp(base, top, (v - lo) / (hi - lo))]);
      const kk = kin(S, 0.5, 1.5, ease.inOutCubic);
      piece(ctx, { x: x0, y: top, w: cw, h: base - top }, (c) => {
        if (kk <= 0) return;
        c.globalAlpha = fo(S);
        c.save(); c.beginPath(); c.rect(x0, top - 20 * u, cw * kk, base - top + 20 * u); c.clip();
        const g = c.createLinearGradient(0, top, 0, base); g.addColorStop(0, rgba(k.acc, 0.3)); g.addColorStop(1, rgba(k.acc, 0));
        c.fillStyle = g; c.beginPath(); c.moveTo(P[0][0], base); P.forEach((p) => c.lineTo(...p)); c.lineTo(P[P.length - 1][0], base); c.closePath(); c.fill(); c.restore();
        c.strokeStyle = k.acc; c.lineWidth = 6 * u; c.lineCap = 'round'; c.lineJoin = 'round';
        const end = polyPart(c, P, kk);
        c.fillStyle = k.acc; c.beginPath(); c.arc(end[0], end[1], 10 * u, 0, Math.PI * 2); c.fill();
      });
      axis.forEach((a, i) => animText(ctx, S, a, x0 + (cw * i) / Math.max(1, axis.length - 1), base + 30 * u, { ...TY.small, size: 28, color: k.muted, align: i === 0 ? 'left' : i === axis.length - 1 ? 'right' : 'center', anim: 'fade', delay: 0.4 + i * 0.05 }));
      const last = P[P.length - 1];
      pill(ctx, S, tx(S, 4), last[0], last[1] - 50 * u, { o: sized(TY.num, 30), bg: k.acc, ink: k.on, align: 'right', delay: 2.0, h: 56 });
    }],
  ], 30 * u);
}

// 4. Market Share: a ring with a key of names and shares beside it (under it on tall frames).
function share(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const names = [2, 3, 4, 5].map((i) => tx(S, i)), vals = listOf(tx(S, 6), [34, 26, 22, 18]).slice(0, 4), sum = vals.reduce((a, b) => a + b, 0) || 1;
  const segs = [k.acc, k.acc2, rgba(k.ink, 0.45), rgba(k.ink, 0.22)];
  const side = !f.tall, R = (side ? 210 : 230) * u, th = R * 0.34;
  const keyW = side ? cw - R * 2 - 110 * u : cw, rowH = 76 * u;
  const tb = topBlock(ctx, S, k, 0, 1, cw / f.W, 64);
  const ring = (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = kin(S, 0.5, 1.4, ease.inOutCubic); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.lineWidth = th;
    let a = -Math.PI / 2, left = kk * Math.PI * 2;
    vals.forEach((v, i) => { const sw = (v / sum) * Math.PI * 2, s = Math.min(sw - 0.03, left); if (s > 0) { c.strokeStyle = segs[i]; c.beginPath(); c.arc(cx, cy, R - th / 2, a, a + s); c.stroke(); } left -= sw; a += sw; });
  });
  const key = (x, y) => names.forEach((nm, i) => {
    const yy = y + rowH * i + rowH / 2, d = 0.9 + i * 0.2;
    piece(ctx, { x, y: yy - 14 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = kin(S, d, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; c.fillStyle = segs[i]; roundRect(c, x, yy - 14 * u, 28 * u, 28 * u, 7 * u); c.fill(); });
    animText(ctx, S, nm, x + 48 * u, yy, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (keyW - 48 * u - 130 * u) / f.W });
    animText(ctx, S, countUp(`${vals[i]}%`, kin(S, d, 0.8)), x + keyW, yy, { ...sized(TY.num, 38), color: i === 0 ? k.acc : k.ink, align: 'right', anim: 'fade', delay: d + 0.1 });
  });
  if (side) column(f, [[tb.h, (y) => tb.draw(x0, y)], [Math.max(R * 2, rowH * 4), (y) => { ring(x0 + R, y + Math.max(R * 2, rowH * 4) / 2); key(x0 + R * 2 + 110 * u, y + Math.max(R * 2, rowH * 4) / 2 - rowH * 2); }]], 50 * u);
  else column(f, [[tb.h, (y) => tb.draw(x0, y)], [R * 2, (y) => ring(f.W / 2, y + R)], [rowH * 4, (y) => key(x0, y)]], 50 * u);
}

// 5. KPI Dashboard: three tiles, each with a number counting up, its change and a small line.
function tiles(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const across = !f.tall, gap = 30 * u, n = 3, tw = across ? (cw - gap * 2) / 3 : cw, th = across ? 330 * u : 240 * u, pad = 36 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  const sp = [[3, 4, 3.6, 5, 5.4, 6.2, 7], [2, 2.4, 3.1, 2.8, 3.6, 4, 4.5], [8, 8.4, 8.2, 8.8, 9, 9.1, 9.4]];
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? th : th * 3 + gap * 2, (y) => {
      for (let i = 0; i < n; i++) {
        const bx = across ? x0 + i * (tw + gap) : x0, by = across ? y : y + i * (th + gap), d = 0.3 + i * 0.2;
        card(ctx, S, { x: bx, y: by, w: tw, h: th }, { color: k.surf, delay: d, r: 24, inner: (c) => {
          const kk = kin(S, d + 0.6, 1.0, ease.inOutCubic); if (kk <= 0) return;
          const sw = across ? tw - pad * 2 : tw * 0.36, sx = across ? bx + pad : bx + tw - pad - sw, sy = across ? by + th - pad - 60 * u : by + th / 2 - 30 * u;
          const end = spark(c, sp[i], sx, sy, sw, 60 * u, kk, k.acc, u);
          c.fillStyle = k.acc; c.beginPath(); c.arc(end[0], end[1], 7 * u, 0, Math.PI * 2); c.fill();
        } });
        const tx0 = bx + pad, inner = (across ? tw : tw * 0.58) - pad * 2;
        animText(ctx, S, tx(S, 1 + i * 3), tx0, by + pad + 18 * u, { ...sized(TY.label, 26), color: k.muted, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: inner / f.W });
        animText(ctx, S, countUp(tx(S, 2 + i * 3), kin(S, d + 0.3, 1.3, ease.outQuart)), tx0, by + pad + 36 * u + 50 * u, { ...sized(TY.num, 84), color: k.ink, align: 'left', anim: 'up', delay: d + 0.3, stagger: 0, maxWidth: inner / f.W });
        delta(ctx, S, tx(S, 3 + i * 3), tx0, by + pad + 36 * u + 100 * u + 32 * u, { delay: d + 0.9, size: 28 });
      }
    }],
  ], 40 * u);
}

// 6. Sales Funnel: stages narrowing down, each with its name and number.
function funnel(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const names = [1, 2, 3, 4].map((i) => tx(S, i)), vals = String(tx(S, 5)).split(/\s+/).filter(Boolean);
  const n = 4, sh = (f.tall ? 150 : 118) * u, gap = 12 * u, fw = Math.min(cw, 1100 * u);
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [sh * n + gap * (n - 1), (y) => {
      for (let i = 0; i < n; i++) {
        const w0 = fw * (1 - i * 0.16), w1 = fw * (1 - (i + 1) * 0.16), yy = y + i * (sh + gap), d = 0.3 + i * 0.25;
        piece(ctx, { x: f.W / 2 - w0 / 2, y: yy, w: w0, h: sh }, (c) => {
          const kk = kin(S, d, 0.5, ease.outCubic); if (kk <= 0) return;
          c.globalAlpha = fo(S) * kk; c.fillStyle = i === n - 1 ? k.acc : rgba(k.acc, 0.25 + i * 0.18);
          c.beginPath(); c.moveTo(f.W / 2 - w0 / 2, yy); c.lineTo(f.W / 2 + w0 / 2, yy); c.lineTo(f.W / 2 + w1 / 2, yy + sh); c.lineTo(f.W / 2 - w1 / 2, yy + sh); c.closePath(); c.fill();
        });
        const room = w1 / 2 - 60 * u, ink = i >= 2 ? k.on : k.ink;
        animText(ctx, S, names[i], f.W / 2 - 30 * u, yy + sh / 2, { ...TY.strong, color: ink, align: 'right', anim: 'fade', delay: d + 0.2, maxWidth: room / f.W });
        animText(ctx, S, countUp(vals[i] || '', kin(S, d + 0.2, 1.0)), f.W / 2 + 30 * u, yy + sh / 2, { ...sized(TY.num, 42), color: ink, align: 'left', anim: 'fade', delay: d + 0.25, maxWidth: room / f.W });
      }
    }],
  ], 44 * u);
}

// 7. Before / After: two panels, the old number on grey and the new one on the accent colour.
function beforeAfter(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, gap = 100 * u, pw = side ? (cw - gap) / 2 : cw, ph = (side ? 420 : 380) * u;
  const tH = measure(ctx, S, tx(S, 5), sized(TY.title, 64)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 5), f.W / 2, y + tH / 2, { ...sized(TY.title, 64), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? ph : ph * 2 + gap, (y) => {
      [0, 1].forEach((i) => {
        const bx = side ? x0 + i * (pw + gap) : x0, by = side ? y : y + i * (ph + gap), d = 0.3 + i * 0.8, on = i === 1;
        card(ctx, S, { x: bx, y: by, w: pw, h: ph }, { color: on ? k.acc : rgba(k.ink, 0.08), delay: d, r: 30 });
        const ink = on ? k.on : k.ink, inner = (pw - 80 * u) / f.W;
        animText(ctx, S, tx(S, i), bx + pw / 2, by + 70 * u, { ...sized(TY.label, 30), color: on ? ink : k.muted, anim: 'fade', delay: d + 0.2, maxWidth: inner });
        animText(ctx, S, tx(S, on ? 3 : 2), bx + pw / 2, by + ph / 2 + 6 * u, { ...sized(TY.big, 132), fontFixed: true, color: ink, anim: 'up', delay: d + 0.3, stagger: 0, maxWidth: inner });
        animText(ctx, S, tx(S, 4), bx + pw / 2, by + ph - 66 * u, { ...TY.body, color: on ? ink : k.muted, anim: 'fade', delay: d + 0.5, maxWidth: inner });
      });
      const ax = side ? x0 + pw + gap / 2 : f.W / 2, ay = side ? y + ph / 2 : y + ph + gap / 2, r = 36 * u;
      piece(ctx, { x: ax - r, y: ay - r, w: r * 2, h: r * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - 1.0) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.ink; c.beginPath(); c.arc(ax, ay, r * kk, 0, Math.PI * 2); c.fill(); c.save(); c.translate(ax, ay); if (!side) c.rotate(Math.PI / 2); glyph(c, 'arrow', 0, 0, r * 0.62, k.dark ? '#111827' : '#ffffff', kk, u); c.restore(); });
    }],
  ], 40 * u);
}

// 8. Problem → Solution: the problem on one card, the answer on the next, joined by an arrow.
function problemSolution(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, gap = side ? 120 * u : 90 * u, pad = 44 * u, cwid = side ? (cw - gap) / 2 : cw;
  const bo = sized(TY.title, f.tall ? 54 : 52), r = 34 * u;
  const ts = [1, 3].map((i) => wrapO(ctx, S, tx(S, i), bo, (cwid - pad * 2) / f.W));
  const chh = pad * 2 + r * 2 + 26 * u + 54 * u + 20 * u + Math.max(...ts.map((t) => measure(ctx, S, t, bo).h));
  const y = f.H / 2 - (side ? chh : chh * 2 + gap) / 2;
  [0, 1].forEach((i) => {
    const bx = side ? x0 + i * (cwid + gap) : x0, by = side ? y : y + i * (chh + gap), d = 0.2 + i * 1.1, c0 = i ? UP : DOWN;
    card(ctx, S, { x: bx, y: by, w: cwid, h: chh }, { color: k.surf, delay: d, r: 28, border: rgba(c0, 0.45), inner: (c) => {
      const kk = ease.outBack(clamp((S.t - d - 0.2) / 0.4));
      if (i) checkBadge(c, bx + pad + r, by + pad + r, r, kk, c0, '#ffffff', u);
      else if (kk > 0) { c.fillStyle = c0; c.beginPath(); c.arc(bx + pad + r, by + pad + r, r * kk, 0, Math.PI * 2); c.fill(); glyph(c, 'cross', bx + pad + r, by + pad + r, r * 0.8, '#ffffff', kk, u); }
    } });
    animText(ctx, S, tx(S, i * 2), bx + pad, by + pad + r * 2 + 26 * u + 27 * u, { ...sized(TY.label, 30), color: c0, align: 'left', anim: 'fade', delay: d + 0.3, maxWidth: (cwid - pad * 2) / f.W });
    animText(ctx, S, ts[i], bx + pad, by + pad + r * 2 + 26 * u + 54 * u + 20 * u + measure(ctx, S, ts[i], bo).h / 2, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.45, maxWidth: (cwid - pad * 2) / f.W });
  });
  const ax = side ? x0 + cwid + gap / 2 : f.W / 2, ay = side ? y + chh / 2 : y + chh + gap / 2;
  piece(ctx, { x: ax - 34 * u, y: ay - 34 * u, w: 68 * u, h: 68 * u }, (c) => { const kk = kin(S, 1.0, 0.35, ease.outBack); if (kk <= 0) return; c.globalAlpha = fo(S); c.save(); c.translate(ax, ay); if (!side) c.rotate(Math.PI / 2); glyph(c, 'arrow', 0, 0, 30 * u, k.ink, kk, u); c.restore(); });
}

// 9. Three Pillars: three columns, each with an icon, a heading and a line under it.
function pillars(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const across = !f.tall, gap = 50 * u, n = 3, pw = across ? (cw - gap * 2) / 3 : cw, R = 54 * u;
  const icons = ['shield', 'rocket', 'heart'];
  const bo = TY.body, items = [0, 1, 2].map((i) => wrapO(ctx, S, tx(S, 2 + i * 2), bo, (across ? pw : pw - R * 2 - 40 * u) / f.W));
  const bH = Math.max(...items.map((t) => measure(ctx, S, t, bo).h));
  const ph = across ? R * 2 + 30 * u + 56 * u + 14 * u + bH : Math.max(R * 2, 56 * u + 14 * u + bH);
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), across ? f.W / 2 : x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: across ? 'center' : 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? ph : ph * 3 + gap * 2, (y) => {
      for (let i = 0; i < n; i++) {
        const bx = across ? x0 + i * (pw + gap) : x0, by = across ? y : y + i * (ph + gap), d = 0.4 + i * 0.3;
        const cx = across ? bx + pw / 2 : bx + R, cy = by + R;
        iconDisc(ctx, S, icons[i], cx, across ? cy : by + ph / 2, R, i === 1 ? k.acc2 : k.acc, k.on, d);
        const tx0 = across ? bx + pw / 2 : bx + R * 2 + 40 * u, al = across ? 'center' : 'left', iw = (across ? pw : pw - R * 2 - 40 * u) / f.W;
        const hy = across ? by + R * 2 + 30 * u + 28 * u : by + ph / 2 - (56 * u + 14 * u + bH) / 2 + 28 * u;
        animText(ctx, S, tx(S, 1 + i * 2), tx0, hy, { ...sized(TY.head, 48), color: k.ink, align: al, anim: 'up', delay: d + 0.15, maxWidth: iw });
        animText(ctx, S, items[i], tx0, hy + 28 * u + 14 * u + bH / 2, { ...bo, color: k.muted, align: al, anim: 'fade', delay: d + 0.3, maxWidth: iw });
      }
    }],
  ], 56 * u);
}

// 10. Process Steps: arrow-shaped steps in a row (stacked on tall frames), each with its number.
function chevrons(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const n = 4, across = !f.tall, notch = 40 * u, gap = 10 * u;
  const sw = across ? (cw + notch * (n - 1) - gap * (n - 1)) / n : cw, sh = across ? 170 * u : 140 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? sh : sh * n + gap * (n - 1), (y) => {
      for (let i = 0; i < n; i++) {
        const bx = across ? x0 + i * (sw - notch + gap) : x0, by = across ? y : y + i * (sh + gap), d = 0.3 + i * 0.3;
        piece(ctx, { x: bx, y: by, w: sw, h: sh }, (c) => {
          const kk = kin(S, d, 0.45, ease.outCubic); if (kk <= 0) return;
          c.globalAlpha = fo(S) * kk; c.fillStyle = i === n - 1 ? k.acc : rgba(k.acc, 0.3 + i * 0.18);
          c.beginPath();
          if (across) { c.moveTo(bx, by); c.lineTo(bx + sw - notch, by); c.lineTo(bx + sw, by + sh / 2); c.lineTo(bx + sw - notch, by + sh); c.lineTo(bx, by + sh); if (i) c.lineTo(bx + notch, by + sh / 2); }
          else { c.moveTo(bx, by); c.lineTo(bx + sw, by); c.lineTo(bx + sw, by + sh - notch * 0.6); c.lineTo(bx + sw / 2, by + sh); c.lineTo(bx, by + sh - notch * 0.6); }
          c.closePath(); c.fill();
        });
        const ink = i >= 2 ? k.on : k.ink, inner = across ? sw - notch * 2 - 50 * u : sw - 120 * u;
        const cx = across ? bx + (i ? notch : 0) + 34 * u : bx + 50 * u;
        animText(ctx, S, String(i + 1).padStart(2, '0'), cx, by + sh / 2 - (across ? 26 * u : 0), { ...sized(TY.num, 30), color: ink, align: 'left', anim: 'fade', delay: d + 0.15, alpha: 0.75 });
        animText(ctx, S, tx(S, 1 + i), across ? cx : cx + 70 * u, by + sh / 2 + (across ? 20 * u : -6 * u), { ...sized(TY.head, 40), color: ink, align: 'left', anim: 'up', delay: d + 0.2, maxWidth: (across ? inner : inner - 70 * u) / f.W });
      }
    }],
  ], 50 * u);
}

// 11. Roadmap: a line through the quarters fills up to "now", with what lands in each quarter.
function roadmap(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const q = [2, 3, 4, 5].map((i) => tx(S, i)), items = [6, 7, 8, 9].map((i) => tx(S, i)), now = 1.4;
  const tb = topBlock(ctx, S, k, 0, 1, mw, 68);
  if (!f.tall) {
    const slot = cw / 4, bodyH = 300 * u;
    column(f, [[tb.h, (y) => tb.draw(x0, y)], [bodyH, (y) => {
      const ly = y + 100 * u;
      growRect(ctx, x0, ly - 4 * u, cw, 8 * u, kin(S, 0.3, 0.6), 'l', rgba(k.ink, 0.15), 4 * u, fo(S));
      growRect(ctx, x0, ly - 4 * u, slot * now, 8 * u, kin(S, 0.8, 1.0, ease.inOutCubic), 'l', k.acc, 4 * u, fo(S));
      q.forEach((qq, i) => {
        const x = x0 + slot * (i + 0.5), d = 0.5 + i * 0.25;
        pill(ctx, S, qq, x, ly - 56 * u, { o: sized(TY.num, 28), bg: i < 2 ? k.acc : rgba(k.ink, 0.12), ink: i < 2 ? k.on : k.ink, align: 'center', delay: d, h: 50, maxW: slot * 0.8 });
        piece(ctx, { x: x - 14 * u, y: ly - 14 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = ease.outBack(clamp((S.t - d - 0.2) / 0.3)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = i < 2 ? k.acc : k.muted; c.beginPath(); c.arc(x, ly, 13 * u * kk, 0, Math.PI * 2); c.fill(); });
        const t = wrapO(ctx, S, items[i], TY.strong, (slot * 0.86) / f.W);
        animText(ctx, S, t, x, ly + 50 * u + measure(ctx, S, t, TY.strong).h / 2, { ...TY.strong, color: i < 2 ? k.ink : k.muted, anim: 'fade', delay: d + 0.3, maxWidth: (slot * 0.86) / f.W });
      });
      pill(ctx, S, 'NOW', x0 + slot * now, ly - 128 * u, { o: sized(TY.label, 22), bg: k.acc2, ink: '#ffffff', align: 'center', delay: 1.8, h: 40 });
    }]], 40 * u);
  } else {
    const rowH = 160 * u;
    column(f, [[tb.h, (y) => tb.draw(x0, y)], [rowH * 4, (y) => {
      const lx = x0 + 14 * u;
      growRect(ctx, lx - 4 * u, y, 8 * u, rowH * 4, kin(S, 0.3, 0.6), 'd', rgba(k.ink, 0.15), 4 * u, fo(S));
      growRect(ctx, lx - 4 * u, y, 8 * u, rowH * now, kin(S, 0.8, 1.0, ease.inOutCubic), 'd', k.acc, 4 * u, fo(S));
      q.forEach((qq, i) => {
        const yy = y + rowH * (i + 0.5), d = 0.5 + i * 0.25;
        piece(ctx, { x: lx - 14 * u, y: yy - 14 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = ease.outBack(clamp((S.t - d) / 0.3)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = i < 2 ? k.acc : k.muted; c.beginPath(); c.arc(lx, yy, 13 * u * kk, 0, Math.PI * 2); c.fill(); });
        pill(ctx, S, qq, lx + 40 * u, yy - 30 * u, { o: sized(TY.num, 28), bg: i < 2 ? k.acc : rgba(k.ink, 0.12), ink: i < 2 ? k.on : k.ink, delay: d, h: 48 });
        animText(ctx, S, items[i], lx + 40 * u, yy + 30 * u, { ...TY.strong, color: i < 2 ? k.ink : k.muted, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (cw - 60 * u) / f.W });
      });
    }]], 40 * u);
  }
}

// 12. Team Member: a round avatar with initials, the name, the role and a line about them.
function person(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, R = (side ? 170 : 150) * u;
  const tw = side ? cw - R * 2 - 90 * u : cw, mw = tw / f.W, al = side ? 'left' : 'center';
  const bio = wrapO(ctx, S, tx(S, 3), TY.body, mw), mb = measure(ctx, S, bio, TY.body), mn = measure(ctx, S, tx(S, 1), sized(TY.title, 84));
  const textH = 40 * u + 20 * u + mn.h + 14 * u + 46 * u + 26 * u + mb.h;
  const avatar = (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.55)); if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.strokeStyle = k.acc2; c.lineWidth = 8 * u; c.beginPath(); c.arc(cx, cy, R * kk, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kin(S, 0.3, 1.0, ease.inOutCubic)); c.stroke();
    c.fillStyle = k.acc; c.beginPath(); c.arc(cx, cy, (R - 18 * u) * kk, 0, Math.PI * 2); c.fill();
    drawText(c, S, tx(S, 4), cx, cy + 4 * u, { ...sized(TY.num, (R / u) * 0.62), color: k.on, align: 'center', maxWidth: (R * 1.3) / f.W, ...still0, alpha: Math.min(1, kk) });
  });
  const body = (x, y) => stack(ctx, S, [
    { text: tx(S, 0), o: TY.label, color: k.acc, anim: 'fade', delay: 0.4 },
    { text: tx(S, 1), o: sized(TY.title, 84), color: k.ink, gap: 20, delay: 0.5 },
    { text: tx(S, 2), o: sized(TY.strong, 40), color: k.acc, gap: 14, anim: 'fade', delay: 0.75 },
    { text: bio, o: TY.body, color: k.muted, gap: 26, anim: 'fade', delay: 1.0 },
  ], x, y, { maxW: mw, align: al });
  if (side) { avatar(x0 + R, f.H / 2); body(x0 + R * 2 + 90 * u, f.H / 2 - textH / 2); }
  else column(f, [[R * 2, (y) => avatar(f.W / 2, y + R)], [textH, (y) => body(f.W / 2, y)]], 50 * u);
}

// 13. Customer Quote: the quote on a card with a large quotation mark, then who said it.
function testimonial(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 64 * u;
  const qo = { font: 'Playfair Display', fontFixed: true, weight: 700, size: f.tall ? 58 : 62 }, mw = (cw - pad * 2) / f.W;
  const q = wrapO(ctx, S, tx(S, 0), qo, mw), mq = measure(ctx, S, q, qo), r = 40 * u;
  const ch = pad * 2 + 90 * u + mq.h + 40 * u + r * 2, y = f.H / 2 - ch / 2;
  card(ctx, S, { x: x0, y, w: cw, h: ch }, { color: k.surf, delay: 0.1, r: 30, shadow: k.dark ? 0 : 30, inner: (c) => {
    c.fillStyle = k.acc;
    for (const dx of [0, 54 * u]) { const cx = x0 + pad + 22 * u + dx, cy = y + pad + 24 * u; c.beginPath(); c.arc(cx, cy, 22 * u, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(cx - 19 * u, cy + 8 * u); c.quadraticCurveTo(cx - 18 * u, cy + 50 * u, cx + 14 * u, cy + 58 * u); c.quadraticCurveTo(cx + 2 * u, cy + 36 * u, cx + 19 * u, cy + 10 * u); c.closePath(); c.fill(); }
  } });
  animText(ctx, S, q, x0 + pad, y + pad + 90 * u + mq.h / 2, { ...qo, color: k.ink, align: 'left', anim: 'fade', delay: 0.4, inDur: 0.8, maxWidth: mw });
  const ay = y + ch - pad - r;
  piece(ctx, { x: x0 + pad, y: ay - r, w: r * 2, h: r * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - 1.1) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.acc2; c.beginPath(); c.arc(x0 + pad + r, ay, r * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, tx(S, 3), x0 + pad + r, ay + 2 * u, { ...sized(TY.num, 28), color: '#ffffff', align: 'center', maxWidth: (r * 1.4) / f.W, ...still0, alpha: Math.min(1, kk) }); });
  animText(ctx, S, tx(S, 1), x0 + pad + r * 2 + 24 * u, ay - 20 * u, { ...sized(TY.strong, 38), color: k.ink, align: 'left', anim: 'fade', delay: 1.2, maxWidth: (cw - pad * 2 - r * 2 - 24 * u) / f.W });
  animText(ctx, S, tx(S, 2), x0 + pad + r * 2 + 24 * u, ay + 22 * u, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: 1.3, maxWidth: (cw - pad * 2 - r * 2 - 24 * u) / f.W });
}

// 14. Case Study: the client and what changed, with two big results.
function caseStudy(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const tb = topBlock(ctx, S, k, 0, 1, mw, 84);
  const mS = para(ctx, S, tx(S, 2), 0, 0, TY.body, k.muted, mw, { draw: false });
  const side = !f.tall, gap = 30 * u, bw = side ? (cw - gap) / 2 : cw, bh = 220 * u;
  column(f, [
    [tb.h, (y) => tb.draw(x0, y)],
    [mS.h, (y) => para(ctx, S, tx(S, 2), x0, y, TY.body, k.muted, mw, { delay: 0.6, top: true })],
    [side ? bh : bh * 2 + gap, (y) => [0, 1].forEach((i) => {
      const bx = side ? x0 + i * (bw + gap) : x0, by = side ? y : y + i * (bh + gap), d = 0.9 + i * 0.3;
      card(ctx, S, { x: bx, y: by, w: bw, h: bh }, { color: k.surf, delay: d, r: 26, inner: (c) => { c.fillStyle = i ? k.acc2 : k.acc; roundRect(c, bx + 34 * u, by + 34 * u, 10 * u, bh - 68 * u, 5 * u); c.fill(); } });
      animText(ctx, S, tx(S, 3 + i * 2), bx + 74 * u, by + bh / 2 - 26 * u, { ...sized(TY.big, 110), fontFixed: true, color: i ? k.acc2 : k.acc, align: 'left', anim: 'up', delay: d + 0.2, stagger: 0, maxWidth: (bw - 110 * u) / f.W });
      animText(ctx, S, tx(S, 4 + i * 2), bx + 74 * u, by + bh / 2 + 56 * u, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.35, maxWidth: (bw - 110 * u) / f.W });
    })],
  ], 34 * u);
}

// 15. Feature Spotlight: an icon, the feature, what it does, and three benefit chips.
function feature(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const hH = header(ctx, S, f, k, { icon: 'rocket', tag: tx(S, 0), title: tx(S, 1), x: x0, y: 0, maxW: mw, size: 96, draw: false });
  const mD = para(ctx, S, tx(S, 2), 0, 0, sized(TY.body, 42), k.muted, mw * 0.85, { draw: false });
  const chips = [3, 4, 5].map((i) => tx(S, i)), co = sized(TY.strong, 32), ch = 64 * u, gap = 18 * u;
  const cws = chips.map((t) => measure(ctx, S, t, co).w + 80 * u);
  const rowsH = f.tall ? ch * 3 + gap * 2 : ch;
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { icon: 'rocket', tag: tx(S, 0), title: tx(S, 1), x: x0, y, maxW: mw, size: 96 })],
    [mD.h, (y) => para(ctx, S, tx(S, 2), x0, y, sized(TY.body, 42), k.muted, mw * 0.85, { delay: 0.7, top: true })],
    [rowsH, (y) => { let cx = x0; chips.forEach((t, i) => {
      const w = Math.min(cws[i], cw), bx = f.tall ? x0 : cx, by = f.tall ? y + i * (ch + gap) : y, d = 1.1 + i * 0.15;
      growRect(ctx, bx, by, w, ch, kin(S, d, 0.4, ease.outExpo), 'l', rgba(k.acc2, 0.16), ch / 2, fo(S));
      piece(ctx, { x: bx + 18 * u, y: by + ch / 2 - 14 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = kin(S, d + 0.2, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; glyph(c, 'check', bx + 32 * u, by + ch / 2, 14 * u, k.acc2, 1, u); });
      animText(ctx, S, t, bx + 56 * u, by + ch / 2, { ...co, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (w - 80 * u) / f.W });
      cx += w + gap;
    }); }],
  ], 34 * u);
}

// 16. What's Included: two columns of ticked features (one column on tall frames).
function included(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const two = !f.tall, n = 6, rows = two ? 3 : 6, colW = two ? cw / 2 : cw, rowH = 92 * u, r = 24 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rows * rowH, (y) => { for (let i = 0; i < n; i++) {
      const cx = x0 + (two ? Math.floor(i / rows) : 0) * colW, cy = y + (i % rows) * rowH + rowH / 2, d = 0.4 + i * 0.15;
      piece(ctx, { x: cx, y: cy - r, w: r * 2, h: r * 2 }, (c) => { c.globalAlpha = fo(S); checkBadge(c, cx + r, cy, r, ease.outBack(clamp((S.t - d) / 0.35)), k.acc, k.on, u); });
      animText(ctx, S, tx(S, 1 + i), cx + r * 2 + 24 * u, cy, { ...sized(TY.strong, 40), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (colW - r * 2 - 50 * u) / f.W });
    } }],
  ], 44 * u);
}

// 17. Comparison: a small table of features with a tick or a cross under each column.
function compareTable(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const feats = [3, 4, 5, 6].map((i) => tx(S, i));
  const a = words(tx(S, 7)).map((w) => /^y/i.test(w)), b = words(tx(S, 8)).map((w) => /^y/i.test(w));
  const colW = Math.min(240 * u, cw * 0.22), featW = cw - colW * 2, rowH = 96 * u, headH = 90 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [headH + rowH * 4, (y) => {
      const hx = x0 + featW;
      card(ctx, S, { x: hx, y, w: colW, h: headH + rowH * 4 }, { color: rgba(k.acc, 0.14), delay: 0.3, r: 22, border: rgba(k.acc, 0.6) });
      [1, 2].forEach((i) => animText(ctx, S, tx(S, i), hx + colW * (i - 0.5), y + headH / 2, { ...sized(TY.head, 40), color: i === 1 ? k.acc : k.muted, anim: 'fade', delay: 0.4, maxWidth: (colW - 40 * u) / f.W }));
      feats.forEach((t, j) => {
        const yy = y + headH + rowH * j + rowH / 2, d = 0.6 + j * 0.2;
        line(ctx, x0, yy - rowH / 2, x0 + cw, yy - rowH / 2, kin(S, d - 0.1, 0.4) * fo(S), rgba(k.ink, 0.12), 2 * u);
        animText(ctx, S, t, x0, yy, { ...sized(TY.strong, 38), color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (featW - 30 * u) / f.W });
        [a[j], b[j]].forEach((yes, i) => piece(ctx, { x: hx + colW * (i + 0.5) - 24 * u, y: yy - 24 * u, w: 48 * u, h: 48 * u }, (c) => {
          const kk = ease.outBack(clamp((S.t - d - 0.1 - i * 0.1) / 0.35)); if (kk <= 0) return;
          c.globalAlpha = fo(S);
          if (yes) checkBadge(c, hx + colW * (i + 0.5), yy, 22 * u, kk, i ? k.muted : UP, '#ffffff', u);
          else glyph(c, 'cross', hx + colW * (i + 0.5), yy, 18 * u, rgba(k.ink, 0.4), kk, u);
        }));
      });
    }],
  ], 40 * u);
}

// 18. Pricing Plans: three price cards, the middle one raised and marked as the favourite.
function pricing(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const across = !f.tall, gap = 28 * u, n = 3, pw = across ? (cw - gap * 2) / 3 : cw, ph = across ? 400 * u : 220 * u, lift = across ? 30 * u : 0;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? ph + lift : ph * 3 + gap * 2 + 20 * u, (y) => {
      for (let i = 0; i < n; i++) {
        const hot = i === 1, bx = across ? x0 + i * (pw + gap) : x0, by = across ? y + (hot ? 0 : lift) : y + 20 * u + i * (ph + gap), d = 0.3 + i * 0.2;
        card(ctx, S, { x: bx, y: by, w: pw, h: ph }, { color: hot ? k.acc : k.surf, delay: d, r: 26, shadow: hot && !k.dark ? 40 : 0, border: hot ? null : rgba(k.ink, 0.1) });
        const ink = hot ? k.on : k.ink, inner = (pw - 80 * u) / f.W;
        const cx = across ? bx + pw / 2 : bx + 50 * u, al = across ? 'center' : 'left';
        animText(ctx, S, tx(S, 1 + i * 2), cx, across ? by + 90 * u : by + ph / 2 - 30 * u, { ...sized(TY.head, 44), color: ink, align: al, anim: 'fade', delay: d + 0.15, maxWidth: (across ? pw - 80 * u : pw * 0.45) / f.W });
        animText(ctx, S, tx(S, 2 + i * 2), across ? cx : bx + pw - 50 * u, across ? by + ph / 2 + 10 * u : by + ph / 2, { ...sized(TY.big, across ? 120 : 110), fontFixed: true, color: ink, align: across ? 'center' : 'right', anim: 'up', delay: d + 0.25, stagger: 0, maxWidth: (across ? pw - 80 * u : pw * 0.4) / f.W });
        animText(ctx, S, tx(S, 7), across ? cx : bx + 50 * u, across ? by + ph - 70 * u : by + ph / 2 + 30 * u, { ...TY.small, color: hot ? ink : k.muted, align: al, anim: 'fade', delay: d + 0.4, maxWidth: inner });
        if (hot) pill(ctx, S, tx(S, 8), across ? cx : bx + pw / 2, by - (across ? 0 : 0), { o: sized(TY.label, 22), bg: k.ink, ink: k.dark ? '#111827' : '#ffffff', align: 'center', delay: 1.1, h: 44 });
      }
    }],
  ], 40 * u);
}

// 19. Org Chart: one person at the top, three below, joined by lines.
function orgChart(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const people = [0, 1, 2, 3].map((i) => [tx(S, 1 + i * 2), tx(S, 2 + i * 2)]);
  const across = !f.tall, bw = across ? Math.min(400 * u, (cw - 60 * u) / 3) : cw * 0.8, bh = 140 * u, vgap = across ? 120 * u : 50 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  const box = (x, y, [name, role], d, top) => {
    card(ctx, S, { x, y, w: bw, h: bh }, { color: top ? k.acc : k.surf, delay: d, r: 22, border: top ? null : rgba(k.ink, 0.12) });
    animText(ctx, S, name, x + bw / 2, y + bh / 2 - 20 * u, { ...sized(TY.head, 40), color: top ? k.on : k.ink, anim: 'fade', delay: d + 0.15, maxWidth: (bw - 50 * u) / f.W });
    animText(ctx, S, role, x + bw / 2, y + bh / 2 + 28 * u, { ...TY.small, color: top ? k.on : k.muted, anim: 'fade', delay: d + 0.2, maxWidth: (bw - 50 * u) / f.W });
  };
  const bodyH = across ? bh * 2 + vgap : bh * 4 + vgap * 3;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [bodyH, (y) => {
      const tx0 = f.W / 2 - bw / 2;
      box(tx0, y, people[0], 0.3, true);
      if (across) {
        const gap = (cw - bw * 3) / 2, by = y + bh + vgap, mid = y + bh + vgap / 2;
        const lk = kin(S, 0.7, 0.5, ease.inOutCubic) * fo(S);
        line(ctx, f.W / 2, y + bh, f.W / 2, mid, lk, rgba(k.ink, 0.35), 3 * u);
        line(ctx, x0 + bw / 2, mid, x0 + cw - bw / 2, mid, lk, rgba(k.ink, 0.35), 3 * u);
        for (let i = 0; i < 3; i++) { const bx = x0 + i * (bw + gap); line(ctx, bx + bw / 2, mid, bx + bw / 2, by, lk, rgba(k.ink, 0.35), 3 * u); box(bx, by, people[1 + i], 0.9 + i * 0.15, false); }
      } else {
        line(ctx, f.W / 2, y + bh, f.W / 2, y + bh + vgap / 2, kin(S, 0.6, 0.3) * fo(S), rgba(k.ink, 0.35), 3 * u);
        for (let i = 0; i < 3; i++) { const by = y + (bh + vgap) * (i + 1); box(tx0, by, people[1 + i], 0.8 + i * 0.15, false); }
      }
    }],
  ], 44 * u);
}

// 20. SWOT: four squares with a big letter, the heading and one point each.
function swot(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const gap = 24 * u, bw = (cw - gap) / 2, bh = (f.tall ? 300 : 210) * u, pad = 34 * u;
  const tints = [k.acc, k.acc2, k.acc2, k.acc];
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [bh * 2 + gap, (y) => { for (let i = 0; i < 4; i++) {
      const bx = x0 + (i % 2) * (bw + gap), by = y + Math.floor(i / 2) * (bh + gap), d = 0.3 + i * 0.2, head = tx(S, 1 + i * 2);
      card(ctx, S, { x: bx, y: by, w: bw, h: bh }, { color: rgba(tints[i], 0.12), delay: d, r: 24 });
      animText(ctx, S, head.charAt(0).toUpperCase(), bx + pad + 40 * u, by + pad + 46 * u, { ...sized(TY.big, 84), fontFixed: true, color: tints[i], align: 'center', anim: 'pop', delay: d + 0.1, stagger: 0, maxWidth: (80 * u) / f.W });
      const tx0 = bx + pad + 110 * u, iw = (bw - pad * 2 - 110 * u) / f.W;
      animText(ctx, S, head, tx0, by + pad + 30 * u, { ...sized(TY.head, 36), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: iw });
      const t = wrapO(ctx, S, tx(S, 2 + i * 2), TY.small, iw);
      animText(ctx, S, t, tx0, by + pad + 70 * u + measure(ctx, S, t, TY.small).h / 2, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: d + 0.35, maxWidth: iw });
    } }],
  ], 40 * u);
}

// 21. Market Size: three circles inside each other, each with its name and value off to the side.
function nested(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, R = Math.min(side ? f.H * 0.3 : f.W * 0.34, 330 * u);
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  const rs = [R, R * 0.62, R * 0.3], tints = [rgba(k.acc, 0.2), rgba(k.acc, 0.45), k.acc];
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? R * 2 : R * 2 + 3 * 120 * u, (y) => {
      const cx = side ? x0 + R : f.W / 2, base = y + R * 2;
      rs.forEach((r, i) => piece(ctx, { x: cx - r, y: base - r * 2, w: r * 2, h: r * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - 0.3 - i * 0.3) / 0.5)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = tints[i]; c.beginPath(); c.arc(cx, base - r * kk, r * kk, 0, Math.PI * 2); c.fill(); }));
      rs.forEach((r, i) => {
        const d = 0.8 + i * 0.3, ay = base - r * 2 + Math.min(r * 0.45, 50 * u);
        if (side) {
          const lx = x0 + R * 2 + 60 * u;
          line(ctx, cx + Math.sqrt(Math.max(0, r * r - (ay - (base - r)) ** 2)), ay, lx - 16 * u, ay, kin(S, d, 0.4) * fo(S), rgba(k.ink, 0.35), 2 * u);
          animText(ctx, S, countUp(tx(S, 2 + i * 2), kin(S, d, 1.0)), lx, ay - 22 * u, { ...sized(TY.num, 52), color: i === 2 ? k.acc : k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (cw - R * 2 - 60 * u) / f.W });
          animText(ctx, S, tx(S, 1 + i * 2), lx, ay + 26 * u, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (cw - R * 2 - 60 * u) / f.W });
        } else {
          const ly = base + 60 * u + i * 120 * u;
          piece(ctx, { x: x0, y: ly - 14 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = kin(S, d, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; c.fillStyle = tints[i]; c.beginPath(); c.arc(x0 + 14 * u, ly, 14 * u, 0, Math.PI * 2); c.fill(); });
          animText(ctx, S, tx(S, 1 + i * 2), x0 + 46 * u, ly, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (cw * 0.6) / f.W });
          animText(ctx, S, countUp(tx(S, 2 + i * 2), kin(S, d, 1.0)), x0 + cw, ly, { ...sized(TY.num, 44), color: i === 2 ? k.acc : k.ink, align: 'right', anim: 'fade', delay: d });
        }
      });
    }],
  ], 40 * u);
}

// 22. Survey Result: "8 in 10" with ten people, the share of them filled in.
function people(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const filled = Math.round(clamp(numOf(tx(S, 3), 80) / 100) * 10);
  const no = { ...sized(TY.big, f.tall ? 170 : 190), fontFixed: true }, mN = measure(ctx, S, tx(S, 0), no), nH = mN.h * Math.min(1, cw / mN.w) * 0.85;
  const perRow = f.tall ? 5 : 10, rows = 10 / perRow, pr = Math.min(48 * u, cw / perRow / 2.4), pgap = Math.min(cw / perRow, pr * 2.6);
  const mC = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 56 : 60), k.ink, mw, { draw: false });
  column(f, [
    [nH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + nH / 2, { ...no, color: k.acc, anim: 'up', delay: 0.1, stagger: 0.03, maxWidth: mw })],
    [rows * pr * 2.4, (y) => piece(ctx, { x: f.W / 2 - (pgap * perRow) / 2, y, w: pgap * perRow, h: rows * pr * 2.4 }, (c) => {
      c.globalAlpha = fo(S);
      for (let i = 0; i < 10; i++) {
        const kk = ease.outBack(clamp((S.t - 0.5 - i * 0.1) / 0.35)); if (kk <= 0) continue;
        const cx = f.W / 2 - (pgap * perRow) / 2 + pgap * (i % perRow + 0.5), cy = y + pr * 1.2 + Math.floor(i / perRow) * pr * 2.4;
        glyph(c, 'person', cx, cy, pr, i < filled ? k.acc : rgba(k.ink, 0.18), kk, u);
      }
    })],
    [mC.h, (y) => para(ctx, S, tx(S, 1), f.W / 2, y, sized(TY.title, f.tall ? 56 : 60), k.ink, mw, { align: 'center', delay: 1.2, anim: 'up', top: true })],
    [34 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 17 * u, { ...TY.small, color: k.muted, anim: 'fade', delay: 1.6, maxWidth: mw })],
  ], 34 * u);
}

// 23. Our Offices: a dotted world map with a pin and a name for each office.
const LAND = [[0.13, 0.28, 0.13, 0.13], [0.25, 0.34, 0.06, 0.12], [0.3, 0.63, 0.06, 0.15], [0.5, 0.25, 0.06, 0.08], [0.53, 0.53, 0.08, 0.17], [0.7, 0.28, 0.16, 0.14], [0.75, 0.47, 0.05, 0.06], [0.88, 0.7, 0.06, 0.06]];
const onLand = (x, y) => LAND.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1);
function offices(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  const mw0 = cw, mh = Math.min(cw * 0.5, f.H * (f.tall ? 0.36 : 0.56));
  const cities = [[0.5, 0.21], [0.29, 0.27], [0.79, 0.49], [0.92, 0.69]];
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [mh, (y) => {
      piece(ctx, { x: x0, y, w: mw0, h: mh }, (c) => {
        c.globalAlpha = fo(S);
        const step = Math.max(10 * u, mw0 / 90);
        for (let gy = 0; gy < mh; gy += step) for (let gx = 0; gx < mw0; gx += step) {
          const fx = gx / mw0, fy = gy / mh;
          if (!onLand(fx, fy)) continue;
          const kk = clamp((S.t - 0.2 - fx * 0.6) / 0.3); if (kk <= 0) continue;
          c.fillStyle = rgba(k.ink, 0.22 * kk); c.beginPath(); c.arc(x0 + gx, y + gy, step * 0.28, 0, Math.PI * 2); c.fill();
        }
      });
      cities.forEach(([cx, cy], i) => {
        const px = x0 + cx * mw0, py = y + cy * mh, d = 0.9 + i * 0.25;
        piece(ctx, { x: px - 22 * u, y: py - 56 * u, w: 44 * u, h: 60 * u }, (c) => { const kk = ease.outBounce(clamp((S.t - d) / 0.5)); if (S.t < d) return; c.globalAlpha = fo(S); glyph(c, 'pin', px, py - 22 * u - (1 - kk) * 80 * u, 26 * u, i % 2 ? k.acc2 : k.acc, 1, u); });
        const left = cx > 0.8;
        pill(ctx, S, tx(S, 1 + i), left ? px - 26 * u : px + 26 * u, py - 26 * u, { o: sized(TY.strong, 26, { weight: 700 }), bg: k.ink, ink: k.dark ? '#111827' : '#ffffff', align: left ? 'right' : 'left', delay: d + 0.3, h: 44, maxW: cw * 0.3 });
      });
    }],
  ], 40 * u);
}

// 24. Our Partners: rounded tiles with a simple mark and a name in each.
function partners(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const n = 6, cols = f.tall ? 2 : 3, rows = n / cols, gap = 26 * u, tw = (cw - gap * (cols - 1)) / cols, th = 170 * u;
  const marks = ['gem', 'shield', 'globe', 'rocket', 'heart', 'target'];
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rows * th + (rows - 1) * gap, (y) => { for (let i = 0; i < n; i++) {
      const bx = x0 + (i % cols) * (tw + gap), by = y + Math.floor(i / cols) * (th + gap), d = 0.3 + i * 0.12;
      card(ctx, S, { x: bx, y: by, w: tw, h: th }, { color: k.surf, delay: d, r: 22, border: rgba(k.ink, 0.1), inner: (c) => glyph(c, marks[i], bx + 60 * u, by + th / 2, 32 * u, i % 2 ? k.acc2 : k.acc, 1, u) });
      animText(ctx, S, tx(S, 1 + i), bx + 110 * u, by + th / 2, { ...sized(TY.head, 40), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: (tw - 140 * u) / f.W });
    } }],
  ], 44 * u);
}

// 25. Announcement: a megaphone, the news in large type, and when.
function announce(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const to = sized(TY.big, f.tall ? 92 : 104), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const hH = header(ctx, S, f, k, { icon: 'megaphone', tag: tx(S, 0), x: x0, y: 0, maxW: mw, draw: false });
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { icon: 'megaphone', tag: tx(S, 0), x: x0, y, maxW: mw })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'up', delay: 0.35, inDur: 0.55, stagger: 0.01, maxWidth: mw })],
    [44 * u, (y) => {
      growRect(ctx, x0, y + 20 * u, 90 * u, 6 * u, kin(S, 1.0, 0.4, ease.outExpo), 'l', k.acc, 3 * u, fo(S));
      animText(ctx, S, tx(S, 2), x0 + 116 * u, y + 22 * u, { ...TY.body, color: k.muted, align: 'left', anim: 'fade', delay: 1.1, maxWidth: (cw - 116 * u) / f.W });
    }],
  ], 34 * u);
}

// 26. Event Date: a calendar tile, the event, and the time and place with icons.
function eventDate(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, tw0 = 250 * u, th0 = 280 * u, tw = side ? cw - tw0 - 70 * u : cw, mw = tw / f.W;
  const to = sized(TY.title, 76), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const bodyH = 40 * u + 20 * u + mt.h + 30 * u + 60 * u * 2 + 16 * u;
  const tile = (x, y) => {
    card(ctx, S, { x, y, w: tw0, h: th0 }, { color: k.dark ? rgba('#ffffff', 0.08) : '#ffffff', delay: 0.1, r: 28, shadow: k.dark ? 0 : 30, inner: (c) => { c.save(); roundRect(c, x, y, tw0, th0, 28 * u); c.clip(); c.fillStyle = k.acc; c.fillRect(x, y, tw0, 80 * u); c.restore(); } });
    animText(ctx, S, tx(S, 2), x + tw0 / 2, y + 40 * u, { ...sized(TY.label, 30), color: k.on, anim: 'fade', delay: 0.35, maxWidth: (tw0 - 60 * u) / f.W });
    animText(ctx, S, tx(S, 3), x + tw0 / 2, y + 80 * u + (th0 - 80 * u) / 2, { ...sized(TY.num, 130), color: k.ink, anim: 'pop', delay: 0.45, stagger: 0, maxWidth: (tw0 - 60 * u) / f.W });
  };
  const body = (x, y, al) => {
    animText(ctx, S, tx(S, 0), x, y + 20 * u, { ...TY.label, color: k.acc, align: al, anim: 'fade', delay: 0.5, maxWidth: mw });
    animText(ctx, S, t, x, y + 40 * u + 20 * u + mt.h / 2, { ...to, color: k.ink, align: al, anim: 'up', delay: 0.6, stagger: 0.008, maxWidth: mw });
    [['clock', 4], ['pin', 5]].forEach(([ic, ti], i) => {
      const yy = y + 40 * u + 20 * u + mt.h + 30 * u + i * (60 * u + 16 * u) + 30 * u, d = 1.0 + i * 0.2;
      const m = measure(ctx, S, tx(S, ti), TY.body), rowW = 52 * u + 20 * u + Math.min(m.w, tw - 72 * u);
      const rx = al === 'center' ? x - rowW / 2 : x;
      iconDisc(ctx, S, ic, rx + 26 * u, yy, 26 * u, rgba(k.acc2, 0.9), '#ffffff', d);
      animText(ctx, S, tx(S, ti), rx + 72 * u, yy, { ...TY.body, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (tw - 72 * u) / f.W });
    });
  };
  if (side) { tile(x0, f.H / 2 - th0 / 2); body(x0 + tw0 + 70 * u, f.H / 2 - bodyH / 2, 'left'); }
  else column(f, [[th0, (y) => tile(f.W / 2 - tw0 / 2, y)], [bodyH, (y) => body(f.W / 2, y, 'center')]], 50 * u);
}

// 27. Q&A Break: "Q&A" in big letters with a speech bubble, and where to send questions.
function qa(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const no = { ...sized(TY.big, f.tall ? 260 : 300), fontFixed: true }, mN = measure(ctx, S, tx(S, 0), no), nH = mN.h * Math.min(1, (cw * 0.8) / mN.w) * 0.85;
  const m = measure(ctx, S, tx(S, 2), TY.strong), pw = Math.min(cw, m.w + 120 * u);
  column(f, [
    [nH, (y) => {
      piece(ctx, { x: f.W / 2 + mN.w * 0.32, y: y - 40 * u, w: 140 * u, h: 120 * u }, (c) => { const kk = ease.outBack(clamp((S.t - 0.6) / 0.45)); if (kk <= 0) return; c.globalAlpha = fo(S); glyph(c, 'chat', f.W / 2 + mN.w * 0.32 + 70 * u, y + 10 * u, 60 * u, k.acc2, kk, u); });
      animText(ctx, S, tx(S, 0), f.W / 2, y + nH / 2, { ...no, color: k.acc, anim: 'pop', delay: 0.1, stagger: 0.08, maxWidth: (cw * 0.8) / f.W });
    }],
    [60 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 30 * u, { ...sized(TY.title, 64), color: k.ink, anim: 'up', delay: 0.6, maxWidth: mw })],
    [64 * u, (y) => {
      growRect(ctx, f.W / 2 - pw / 2, y, pw, 64 * u, kin(S, 1.0, 0.4, ease.outExpo), 'c', rgba(k.ink, 0.08), 32 * u, fo(S));
      iconDisc(ctx, S, 'mail', f.W / 2 - pw / 2 + 34 * u, y + 32 * u, 22 * u, k.acc2, '#ffffff', 1.15);
      animText(ctx, S, tx(S, 2), f.W / 2 - pw / 2 + 70 * u, y + 32 * u, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: 1.25, maxWidth: (pw - 100 * u) / f.W });
    }],
  ], 36 * u);
}

// 28. Section Divider: a band sweeps across the middle with the section number and name on it.
function divider(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const bh = (f.tall ? 520 : 360) * u, by = f.H / 2 - bh / 2;
  growRect(ctx, 0, by, f.W, bh, kin(S, 0, 0.7, ease.outExpo), 'l', k.acc, 0, fo(S));
  const no = { ...sized(TY.big, f.tall ? 170 : 220), fontFixed: true };
  if (!f.tall) {
    const mN = measure(ctx, S, tx(S, 1), no), nw = Math.min(mN.w, cw * 0.3);
    animText(ctx, S, tx(S, 1), x0, f.H / 2 + 6 * u, { ...no, color: k.on, align: 'left', anim: 'up', delay: 0.35, stagger: 0.04, maxWidth: (cw * 0.3) / f.W });
    line(ctx, x0 + nw + 50 * u, by + 70 * u, x0 + nw + 50 * u, by + bh - 70 * u, kin(S, 0.5, 0.4) * fo(S), rgba(k.on, 0.5), 3 * u);
    const tx0 = x0 + nw + 100 * u, mw = (x0 + cw - tx0) / f.W;
    const items = [
      { text: tx(S, 0), o: sized(TY.label, 30), color: k.on, anim: 'fade', delay: 0.55 },
      { text: wrapO(ctx, S, tx(S, 2), sized(TY.title, 84), mw), o: sized(TY.title, 84), color: k.on, gap: 18, delay: 0.6 },
    ];
    const h = stack(ctx, S, items, tx0, 0, { maxW: mw, draw: false });
    stack(ctx, S, items, tx0, f.H / 2 - h / 2, { maxW: mw });
  } else {
    animText(ctx, S, tx(S, 1), f.W / 2, by + 140 * u, { ...no, color: k.on, anim: 'up', delay: 0.35, stagger: 0.04, maxWidth: cw / f.W });
    animText(ctx, S, tx(S, 0), f.W / 2, by + 280 * u, { ...sized(TY.label, 30), color: k.on, anim: 'fade', delay: 0.55, maxWidth: cw / f.W });
    animText(ctx, S, wrapO(ctx, S, tx(S, 2), sized(TY.title, 76), cw / f.W), f.W / 2, by + 380 * u, { ...sized(TY.title, 76), color: k.on, anim: 'up', delay: 0.6, maxWidth: cw / f.W });
  }
}

// 29. Agenda Checkpoint: the agenda with what's done ticked, where we are now marked, the rest dimmed.
function agendaNow(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const items = [1, 2, 3, 4].map((i) => tx(S, i)), now = Math.max(1, Math.min(4, Math.round(numOf(tx(S, 5), 3)))) - 1;
  const rowH = 108 * u, r = 26 * u, aw = Math.min(cw, 1100 * u), ax = f.W / 2 - aw / 2;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), ax, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: aw / f.W })],
    [rowH * 4, (y) => items.forEach((t, i) => {
      const yy = y + rowH * i, d = 0.3 + i * 0.18, done = i < now, cur = i === now;
      if (cur) card(ctx, S, { x: ax, y: yy + 8 * u, w: aw, h: rowH - 16 * u }, { color: rgba(k.acc, 0.15), delay: 1.0, r: 20, border: k.acc });
      piece(ctx, { x: ax + 24 * u, y: yy + rowH / 2 - r, w: r * 2, h: r * 2 }, (c) => {
        const kk = ease.outBack(clamp((S.t - d) / 0.35)); if (kk <= 0) return; c.globalAlpha = fo(S);
        if (done) checkBadge(c, ax + 24 * u + r, yy + rowH / 2, r, kk, rgba(k.ink, 0.35), k.dark ? '#111827' : '#ffffff', u);
        else { c.fillStyle = cur ? k.acc : rgba(k.ink, 0.15); c.beginPath(); c.arc(ax + 24 * u + r, yy + rowH / 2, r * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, String(i + 1), ax + 24 * u + r, yy + rowH / 2 + u, { ...sized(TY.num, 26), color: cur ? k.on : k.muted, align: 'center', ...still0, alpha: Math.min(1, kk) }); }
      });
      animText(ctx, S, t, ax + 24 * u + r * 2 + 26 * u, yy + rowH / 2, { ...sized(TY.strong, 42), color: cur ? k.ink : done ? k.muted : rgba(k.ink, 0.55), align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (aw - r * 2 - 200 * u) / f.W });
      if (cur) pill(ctx, S, 'NOW', ax + aw - 24 * u, yy + rowH / 2, { o: sized(TY.label, 22), bg: k.acc, ink: k.on, align: 'right', delay: 1.2, h: 44 });
    })],
  ], 40 * u);
}

// 30. Mission Statement: the statement in the middle between two rules that draw outwards.
function mission(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = (f.tall ? cw : cw * 0.86) / f.W;
  const qo = { font: 'Playfair Display', fontFixed: true, weight: 700, size: f.tall ? 72 : 80 }, t = wrapO(ctx, S, tx(S, 1), qo, mw), mt = measure(ctx, S, t, qo);
  column(f, [
    [40 * u, (y) => {
      const lw = Math.min(260 * u, cw * 0.25);
      line(ctx, f.W / 2 - 180 * u, y + 20 * u, f.W / 2 - 180 * u - lw, y + 20 * u, kin(S, 0.2, 0.6, ease.inOutCubic) * fo(S), k.acc, 3 * u);
      line(ctx, f.W / 2 + 180 * u, y + 20 * u, f.W / 2 + 180 * u + lw, y + 20 * u, kin(S, 0.2, 0.6, ease.inOutCubic) * fo(S), k.acc, 3 * u);
      animText(ctx, S, tx(S, 0), f.W / 2, y + 20 * u, { ...sized(TY.label, 30), color: k.acc, anim: 'fade', delay: 0.1, maxWidth: (300 * u) / f.W });
    }],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...qo, color: k.ink, anim: 'fade', delay: 0.5, inDur: 0.9, maxWidth: mw })],
  ], 50 * u);
}

// 31. Our Values: four tiles, each with an icon, a word and a short line.
function values(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const cols = f.tall ? 2 : 4, rows = 4 / cols, gap = 24 * u, tw = (cw - gap * (cols - 1)) / cols, pad = 32 * u;
  const icons = ['target', 'shield', 'rocket', 'heart'];
  const lines = [0, 1, 2, 3].map((i) => wrapO(ctx, S, tx(S, 2 + i * 2), TY.small, (tw - pad * 2) / f.W));
  const lh = Math.max(...lines.map((t) => measure(ctx, S, t, TY.small).h)), th = pad * 2 + 80 * u + 24 * u + 50 * u + 14 * u + lh;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [th * rows + gap * (rows - 1), (y) => { for (let i = 0; i < 4; i++) {
      const bx = x0 + (i % cols) * (tw + gap), by = y + Math.floor(i / cols) * (th + gap), d = 0.3 + i * 0.2;
      card(ctx, S, { x: bx, y: by, w: tw, h: th }, { color: k.surf, delay: d, r: 24, border: k.dark ? null : rgba(k.ink, 0.06) });
      iconDisc(ctx, S, icons[i], bx + pad + 40 * u, by + pad + 40 * u, 40 * u, i % 2 ? k.acc2 : k.acc, k.on, d + 0.15);
      animText(ctx, S, tx(S, 1 + i * 2), bx + pad, by + pad + 80 * u + 24 * u + 25 * u, { ...sized(TY.head, 44), color: k.ink, align: 'left', anim: 'up', delay: d + 0.25, maxWidth: (tw - pad * 2) / f.W });
      animText(ctx, S, lines[i], bx + pad, by + pad + 80 * u + 24 * u + 50 * u + 14 * u + lh / 2, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: d + 0.4, maxWidth: (tw - pad * 2) / f.W });
    } }],
  ], 44 * u);
}

// 32. Award: a medal on a ribbon swings in, with the award, who gave it and when.
function award(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, R = 130 * u, tw = side ? cw - R * 2 - 100 * u : cw, mw = tw / f.W;
  const to = sized(TY.title, 84), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const textH = 40 * u + 20 * u + mt.h + 20 * u + 44 * u;
  const medal = (cx, cy) => piece(ctx, { x: cx - R, y: cy - R * 1.3, w: R * 2, h: R * 2.9 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.6)); if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.save(); c.translate(cx, cy - R * 1.3); c.rotate(Math.sin(S.t * 2.2) * 0.04 * clamp(2.5 - S.t)); c.translate(-cx, -(cy - R * 1.3));
    c.fillStyle = k.acc2;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * R * 0.15, cy - R * 1.3); c.lineTo(cx + s * R * 0.75, cy - R * 1.3); c.lineTo(cx + s * R * 0.35, cy - R * 0.5); c.lineTo(cx - s * R * 0.05, cy - R * 0.5); c.closePath(); c.fill(); }
    c.fillStyle = k.acc; c.beginPath(); c.arc(cx, cy + R * 0.2, R * 0.82 * kk, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgba('#ffffff', 0.55); c.lineWidth = 6 * u; c.beginPath(); c.arc(cx, cy + R * 0.2, R * 0.62 * kk, 0, Math.PI * 2); c.stroke();
    glyph(c, 'gem', cx, cy + R * 0.2, R * 0.36, '#ffffff', kk, u);
    c.restore();
  });
  const body = (x, y, al) => stack(ctx, S, [
    { text: tx(S, 0), o: TY.label, color: k.acc, anim: 'fade', delay: 0.4 },
    { text: t, o: to, color: k.ink, gap: 20, delay: 0.5 },
    { text: tx(S, 2), o: TY.body, color: k.muted, gap: 20, anim: 'fade', delay: 0.9 },
  ], x, y, { maxW: mw, align: al });
  if (side) { medal(x0 + R, f.H / 2 + R * 0.4); body(x0 + R * 2 + 100 * u, f.H / 2 - textH / 2, 'left'); }
  else column(f, [[R * 2.3, (y) => medal(f.W / 2, y + R * 1.3)], [textH, (y) => body(f.W / 2, y, 'center')]], 50 * u);
}

// 33. We're Hiring: the call, the open roles as chips, and where to apply.
function hiring(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const to = sized(TY.big, f.tall ? 100 : 120), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const roles = [2, 3, 4].map((i) => tx(S, i)), co = sized(TY.strong, 34), ch = 68 * u, gap = 18 * u;
  const ws = roles.map((r) => Math.min(cw, measure(ctx, S, r, co).w + 64 * u)), row = !f.tall && ws.reduce((a, b) => a + b, 0) + gap * 2 <= cw;
  const um = measure(ctx, S, tx(S, 5), TY.strong), uw = Math.min(cw, um.w + 130 * u);
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), x0, y + 27 * u, { bg: k.acc, ink: k.on, delay: 0.1 })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'up', delay: 0.3, stagger: 0.01, maxWidth: mw })],
    [row ? ch : ch * 3 + gap * 2, (y) => { let cx = x0; roles.forEach((r, i) => {
      const bx = row ? cx : x0, by = row ? y : y + i * (ch + gap), d = 0.8 + i * 0.15;
      card(ctx, S, { x: bx, y: by, w: ws[i], h: ch }, { border: rgba(k.ink, 0.35), delay: d, r: 34 });
      animText(ctx, S, r, bx + ws[i] / 2, by + ch / 2, { ...co, color: k.ink, anim: 'fade', delay: d + 0.15, maxWidth: (ws[i] - 50 * u) / f.W });
      cx += ws[i] + gap;
    }); }],
    [70 * u, (y) => {
      growRect(ctx, x0, y, uw, 70 * u, kin(S, 1.4, 0.4, ease.outExpo), 'l', k.acc2, 35 * u, fo(S));
      piece(ctx, { x: x0 + uw - 60 * u, y: y + 15 * u, w: 40 * u, h: 40 * u }, (c) => { const kk = kin(S, 1.6, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; glyph(c, 'arrow', x0 + uw - 40 * u, y + 35 * u, 18 * u, '#ffffff', 1, u); });
      animText(ctx, S, tx(S, 5), x0 + 34 * u, y + 35 * u, { ...TY.strong, color: '#ffffff', align: 'left', anim: 'fade', delay: 1.6, maxWidth: (uw - 110 * u) / f.W });
    }],
  ], 36 * u);
}

// 34. Contact Us: email, phone and website, each on a row with its icon.
function contact(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const rowH = 110 * u, r = 38 * u, aw = Math.min(cw, 1000 * u), ax = f.W / 2 - aw / 2;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.big, 100)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), ax, y + tH / 2, { ...sized(TY.big, 100), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: aw / f.W })],
    [rowH * 3, (y) => [['mail', 1], ['phone', 2], ['globe', 3]].forEach(([ic, ti], i) => {
      const yy = y + rowH * i + rowH / 2, d = 0.4 + i * 0.2;
      iconDisc(ctx, S, ic, ax + r, yy, r, i === 1 ? k.acc2 : k.acc, k.on, d);
      animText(ctx, S, tx(S, ti), ax + r * 2 + 32 * u, yy, { ...sized(TY.strong, 46), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: (aw - r * 2 - 40 * u) / f.W });
    })],
  ], 50 * u);
}

// 35. Call to Action: a big button, a pointer that clicks it, and the link.
function cta(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const mT = measure(ctx, S, tx(S, 0), sized(TY.title, 76)), bo = sized(TY.head, f.tall ? 56 : 60);
  const m = measure(ctx, S, tx(S, 1), bo), bw = Math.min(cw, m.w + 160 * u), bh = 130 * u;
  column(f, [
    [mT.h, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + mT.h / 2, { ...sized(TY.title, 76), color: k.ink, anim: 'up', delay: 0.1, maxWidth: mw })],
    [bh, (y) => {
      const press = S.t > 1.9 && S.t < 2.1 ? 0.94 : 1, pulse = S.t > 2.1 ? (S.t - 2.1) % 1.2 / 1.2 : -1;
      piece(ctx, { x: f.W / 2 - bw / 2, y, w: bw, h: bh }, (c) => {
        const kk = ease.outBack(clamp((S.t - 0.4) / 0.5)); if (kk <= 0) return;
        c.globalAlpha = fo(S);
        if (pulse >= 0) { c.strokeStyle = rgba(k.acc, 1 - pulse); c.lineWidth = 6 * u; roundRect(c, f.W / 2 - bw / 2 - pulse * 30 * u, y - pulse * 30 * u, bw + pulse * 60 * u, bh + pulse * 60 * u, bh / 2 + pulse * 30 * u); c.stroke(); }
        c.translate(f.W / 2, y + bh / 2); c.scale(kk * press, kk * press); c.translate(-f.W / 2, -(y + bh / 2));
        c.fillStyle = k.acc; roundRect(c, f.W / 2 - bw / 2, y, bw, bh, bh / 2); c.fill();
        drawText(c, S, tx(S, 1), f.W / 2, y + bh / 2, { ...bo, color: k.on, align: 'center', maxWidth: (bw - 100 * u) / f.W, ...still0, alpha: Math.min(1, kk) });
      });
      piece(ctx, { x: f.W / 2 + bw * 0.2, y: y + bh * 0.4, w: 60 * u, h: 80 * u }, (c) => {
        const kp = ease.outCubic(clamp((S.t - 1.0) / 0.8)); if (kp <= 0 || S.t > S.d - 0.4) return;
        const px = f.W / 2 + bw * 0.25 + (1 - kp) * bw * 0.5, py = y + bh * 0.55 + (1 - kp) * 160 * u;
        c.fillStyle = '#ffffff'; c.strokeStyle = '#111111'; c.lineWidth = 3 * u;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + 60 * u); c.lineTo(px + 16 * u, py + 46 * u); c.lineTo(px + 28 * u, py + 70 * u); c.lineTo(px + 38 * u, py + 65 * u); c.lineTo(px + 26 * u, py + 42 * u); c.lineTo(px + 46 * u, py + 42 * u); c.closePath(); c.fill(); c.stroke();
      });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...sized(TY.strong, 38), color: k.muted, anim: 'fade', delay: 1.2, maxWidth: mw })],
  ], 44 * u);
}

// 36. Revenue Mix: one bar split into coloured parts that grow in turn, with a key under it.
function splitBar(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const names = [2, 3, 4].map((i) => tx(S, i)), vals = listOf(tx(S, 5), [62, 25, 13]).slice(0, 3), sum = vals.reduce((a, b) => a + b, 0) || 1;
  const segs = [k.acc, k.acc2, rgba(k.ink, 0.35)], bh = 110 * u, keyRow = 84 * u;
  const tb = topBlock(ctx, S, k, 0, 1, mw, 64);
  column(f, [
    [tb.h, (y) => tb.draw(x0, y)],
    [bh, (y) => {
      let x = x0;
      vals.forEach((v, i) => {
        const w = cw * (v / sum), kk = kin(S, 0.5 + i * 0.35, 0.6, ease.inOutCubic);
        growRect(ctx, x + (i ? 4 * u : 0), y, w - (i ? 4 * u : 0), bh, kk, 'l', segs[i], 16 * u, fo(S));
        if (w > 150 * u) animText(ctx, S, countUp(`${Math.round((v / sum) * 100)}%`, kk), x + 30 * u, y + bh / 2, { ...sized(TY.num, 44), color: i === 1 ? '#ffffff' : i === 0 ? k.on : k.ink, align: 'left', anim: 'fade', delay: 0.7 + i * 0.35, maxWidth: (w - 50 * u) / f.W });
        x += w;
      });
    }],
    [keyRow * (f.tall ? 3 : 1), (y) => names.forEach((nm, i) => {
      const kx = f.tall ? x0 : x0 + (cw / 3) * i, ky = f.tall ? y + keyRow * i + keyRow / 2 : y + keyRow / 2, d = 1.0 + i * 0.2;
      piece(ctx, { x: kx, y: ky - 14 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = kin(S, d, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; c.fillStyle = segs[i]; roundRect(c, kx, ky - 14 * u, 28 * u, 28 * u, 7 * u); c.fill(); });
      animText(ctx, S, `${nm}  ·  ${Math.round((vals[i] / sum) * 100)}%`, kx + 44 * u, ky, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: ((f.tall ? cw : cw / 3) - 60 * u) / f.W });
    })],
  ], 40 * u);
}

// 37. Year over Year: pairs of bars, last year in grey and this year in colour, with a key.
function pairs(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const cats = words(tx(S, 3)), a = listOf(tx(S, 4), [40, 55, 30, 45]), b = listOf(tx(S, 5), [52, 61, 44, 58]);
  const n = Math.min(cats.length, a.length, b.length) || 4, hi = Math.max(...a, ...b);
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 68)).h, chartH = f.H * (f.tall ? 0.42 : 0.46), slot = cw / n, bw = Math.min(slot * 0.3, 110 * u);
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 68), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: (cw * 0.6) / f.W })],
    [40 * u, (y) => [1, 2].forEach((i) => {
      const kx = x0 + (i - 1) * Math.min(cw / 2, 320 * u), d = 0.3 + i * 0.1;
      piece(ctx, { x: kx, y: y + 6 * u, w: 28 * u, h: 28 * u }, (c) => { const kk = kin(S, d, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; c.fillStyle = i === 1 ? rgba(k.ink, 0.25) : k.acc; roundRect(c, kx, y + 6 * u, 28 * u, 28 * u, 7 * u); c.fill(); });
      animText(ctx, S, tx(S, i), kx + 42 * u, y + 20 * u, { ...TY.strong, size: 32, color: k.muted, align: 'left', anim: 'fade', delay: d, maxWidth: (Math.min(cw / 2, 320 * u) - 60 * u) / f.W });
    })],
    [chartH, (y) => {
      const base = y + chartH - 50 * u, ch = chartH - 110 * u;
      line(ctx, x0, base, x0 + cw, base, kin(S, 0.4, 0.5) * fo(S), rgba(k.ink, 0.25), 3 * u);
      for (let i = 0; i < n; i++) {
        const cx = x0 + slot * (i + 0.5), d = 0.6 + i * 0.15;
        [[a[i], rgba(k.ink, 0.25), -1], [b[i], k.acc, 1]].forEach(([v, c0, s], j) => {
          const h = ch * (v / hi), kk = kin(S, d + j * 0.12, 0.6, ease.outCubic);
          growRect(ctx, cx + (s < 0 ? -bw - 5 * u : 5 * u), base - h, bw, h, kk, 'u', c0, 8 * u, fo(S));
          if (j) animText(ctx, S, countUp(String(v), kk), cx + 5 * u + bw / 2, base - h * kk - 26 * u, { ...sized(TY.num, 30), color: k.acc, anim: 'fade', delay: d + 0.2 });
        });
        animText(ctx, S, cats[i] || '', cx, base + 28 * u, { ...TY.strong, size: 30, color: k.muted, anim: 'fade', delay: d, maxWidth: (slot * 0.95) / f.W });
      }
    }],
  ], 34 * u);
}

// 38. Goal Progress: a big ring fills toward the goal while the percentage counts up inside it.
function goal(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, R = (side ? 230 : 250) * u, pct = clamp(numOf(tx(S, 1), 84) / 100);
  const tw = side ? cw - R * 2 - 100 * u : cw, mw = tw / f.W;
  const mt = measure(ctx, S, wrapO(ctx, S, tx(S, 2), sized(TY.title, 72), mw), sized(TY.title, 72)), textH = 40 * u + 20 * u + mt.h + 24 * u + 40 * u;
  const ring = (cx, cy) => {
    piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
      const kk = kin(S, 0.3, 1.6, ease.inOutCubic); if (S.t < 0.1) return;
      c.globalAlpha = fo(S); c.lineWidth = 34 * u; c.lineCap = 'round';
      c.strokeStyle = rgba(k.ink, 0.1); c.beginPath(); c.arc(cx, cy, R - 17 * u, 0, Math.PI * 2); c.stroke();
      if (kk > 0) { c.strokeStyle = k.acc; c.beginPath(); c.arc(cx, cy, R - 17 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * kk); c.stroke(); }
    });
    animText(ctx, S, countUp(tx(S, 1), kin(S, 0.3, 1.6, ease.inOutCubic)), cx, cy, { ...sized(TY.num, 110), color: k.ink, anim: 'fade', delay: 0.3, maxWidth: (R * 1.3) / f.W });
  };
  const body = (x, y, al) => stack(ctx, S, [
    { text: tx(S, 0), o: TY.label, color: k.acc, anim: 'fade', delay: 0.4 },
    { text: wrapO(ctx, S, tx(S, 2), sized(TY.title, 72), mw), o: sized(TY.title, 72), color: k.ink, gap: 20, delay: 0.6 },
    { text: tx(S, 3), o: TY.body, color: k.muted, gap: 24, anim: 'fade', delay: 1.4 },
  ], x, y, { maxW: mw, align: al });
  if (side) { ring(x0 + R, f.H / 2); body(x0 + R * 2 + 100 * u, f.H / 2 - textH / 2, 'left'); }
  else column(f, [[R * 2, (y) => ring(f.W / 2, y + R)], [textH, (y) => body(f.W / 2, y, 'center')]], 50 * u);
}

// 39. Key Takeaways: numbered squares down the side, each with its point.
function takeaways(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const sq = 84 * u, gap = 34 * u, bo = sized(TY.title, f.tall ? 50 : 54), tw = (cw - sq - 40 * u) / f.W;
  const ts = [1, 2, 3].map((i) => wrapO(ctx, S, tx(S, i), bo, tw)), hs = ts.map((t) => Math.max(sq, measure(ctx, S, t, bo).h));
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 76)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 76), color: k.acc, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [hs.reduce((a, b) => a + b, 0) + gap * 2, (y) => { let yy = y; ts.forEach((t, i) => {
      const h = hs[i], d = 0.4 + i * 0.35;
      piece(ctx, { x: x0, y: yy + h / 2 - sq / 2, w: sq, h: sq }, (c) => { const kk = ease.outBack(clamp((S.t - d) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.acc; roundRect(c, x0 + sq / 2 - (sq / 2) * kk, yy + h / 2 - (sq / 2) * kk, sq * kk, sq * kk, 18 * u); c.fill(); drawText(c, S, String(i + 1), x0 + sq / 2, yy + h / 2 + 2 * u, { ...sized(TY.num, 44), color: k.on, align: 'center', ...still0, alpha: Math.min(1, kk) }); });
      animText(ctx, S, t, x0 + sq + 40 * u, yy + h / 2, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: tw });
      yy += h + gap;
    }); }],
  ], 44 * u);
}

// 40. Milestone Reached: a big number counts up while paper squares fall, then a thank-you.
function milestoneReached(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  piece(ctx, { x: 0, y: 0, w: f.W, h: f.H }, (c) => {
    c.globalAlpha = fo(S);
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 97.13) % 100) / 100, sp = 0.25 + ((i * 31.7) % 10) / 20, t0 = 1.2 + ((i * 13.3) % 10) / 10;
      const p = (S.t - t0) * sp; if (p <= 0) continue;
      const y = -40 * u + p * f.H, x = sx * f.W + Math.sin(S.t * 2 + i) * 30 * u; if (y > f.H + 40 * u) continue;
      c.save(); c.translate(x, y); c.rotate(S.t * 3 + i); c.fillStyle = [k.acc, k.acc2, rgba(k.ink, 0.4)][i % 3]; c.fillRect(-9 * u, -5 * u, 18 * u, 10 * u); c.restore();
    }
  });
  const no = { ...sized(TY.big, f.tall ? 220 : 260), fontFixed: true }, mN = measure(ctx, S, tx(S, 1), no), nH = mN.h * Math.min(1, cw / mN.w) * 0.85;
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), f.W / 2, y + 27 * u, { bg: k.acc, ink: k.on, align: 'center', delay: 0.1 })],
    [nH, (y) => animText(ctx, S, countUp(tx(S, 1), kin(S, 0.2, 1.4, ease.outQuart)), f.W / 2, y + nH / 2, { ...no, color: k.ink, anim: 'up', delay: 0.15, stagger: 0, maxWidth: mw })],
    [60 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 30 * u, { ...sized(TY.title, 60), color: k.acc, anim: 'up', delay: 1.3, maxWidth: mw })],
    [40 * u, (y) => animText(ctx, S, tx(S, 3), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.7, maxWidth: mw })],
  ], 30 * u);
}

// ---------- the list ----------
const sw = [['sfx-swipe', 0.1]], wh = [['sfx-whoosh', 0.1]], pop = [['sfx-pop', 0.15]];
seq('kpi', 'Big Number', 'white', { sfx: [['sfx-riser', 0.1], ['sfx-ding', 1.8]], texts: ['Monthly revenue', '$1.28M', '+12% vs last quarter', 'Our best month on record'] }, kpi);
seq('bars', 'Quarterly Bars', 'slate', { sfx: sw, texts: ['Quarterly results', 'Revenue by quarter ($K)', 'Q1 Q2 Q3 Q4', '420 515 480 640'] }, bars);
seq('growth', 'Growth Line', 'mist', { sfx: wh, texts: ['Growth', 'Active users over the last 12 months', 'Jan Apr Jul Oct Dec', '1.2 1.5 1.4 1.9 2.3 2.2 2.8 3.1 3.0 3.6 4.0 4.4', '4.4M'] }, growth);
seq('share', 'Market Share', 'carbon', { dur: 7, sfx: sw, texts: ['Market share', 'Our place in the market', 'Us', 'Competitor A', 'Competitor B', 'Others', '34 26 22 18'] }, share);
seq('dashboard', 'KPI Dashboard', 'deep', { dur: 7, sfx: sw, texts: ['This quarter', 'Revenue', '$4.2M', '+18%', 'New customers', '1,240', '+9%', 'Retention', '94%', '+2%'] }, tiles);
seq('funnel', 'Sales Funnel', 'sand', { sfx: sw, texts: ['Sales funnel', 'Visitors', 'Leads', 'Trials', 'Customers', '48,000 6,200 1,450 380'] }, funnel);
seq('before-after', 'Before / After', 'white', { sfx: [['sfx-whoosh', 1.0]], texts: ['Before', 'After', '14 days', '2 days', 'to close a sale', 'Average time to close a sale'] }, beforeAfter);
seq('problem', 'Problem → Solution', 'mist', { dur: 7, sfx: [['sfx-error', 0.4], ['sfx-success', 1.5]], texts: ['The problem', 'Teams lose hours every week hunting for files.', 'Our solution', 'One shared library that finds anything in seconds.'] }, problemSolution);
seq('pillars', 'Three Pillars', 'sand', { dur: 7, sfx: pop, texts: ['How we work', 'Quality', 'Every detail checked twice', 'Speed', 'From idea to launch in weeks', 'Care', 'Support from real people'] }, pillars);
seq('process', 'Process Steps', 'slate', { sfx: sw, texts: ['Our process', 'Discover', 'Design', 'Build', 'Launch'] }, chevrons);
seq('roadmap', 'Roadmap', 'deep', { dur: 7, sfx: sw, texts: ['Roadmap', 'Our 2026 product plan', 'Q1', 'Q2', 'Q3', 'Q4', 'New editor', 'Team spaces', 'Mobile app', 'Integrations'] }, roadmap);
seq('team', 'Team Member', 'white', { sfx: pop, texts: ['Meet the team', 'Alex Morgan', 'Head of Design', 'Ten years designing tools people love to use.', 'AM'] }, person);
seq('testimonial', 'Customer Quote', 'sand', { dur: 7, texts: ['“Setup took ten minutes, and the whole team was sharing files the same day.”', 'Jordan Lee', 'Operations Lead, Brightside Studio', 'JL'] }, testimonial);
seq('case-study', 'Case Study', 'slate', { dur: 7, sfx: sw, texts: ['Case study', 'Brightside Studio', 'How a 40-person studio cut design reviews from days to hours.', '−40%', 'review time', '3×', 'faster sign-off'] }, caseStudy);
seq('feature', 'Feature Spotlight', 'mist', { sfx: wh, texts: ['New feature', 'Smart Search', 'Find any file by what’s inside it, not just its name.', 'Instant results', 'Works offline', 'Private by design'] }, feature);
seq('included', 'What’s Included', 'white', { dur: 7, sfx: [['sfx-click', 0.4], ['sfx-click', 0.7], ['sfx-click', 1.0]], texts: ['What’s included', 'Unlimited projects', 'Team sharing', 'Support around the clock', 'Version history', 'Custom branding', 'Daily backups'] }, included);
seq('compare', 'Comparison Table', 'carbon', { dur: 7, sfx: sw, texts: ['How we compare', 'Us', 'Others', 'Unlimited storage', 'Works offline', 'Live editing', 'No setup fees', 'yes yes yes yes', 'no yes no no'] }, compareTable);
seq('pricing', 'Pricing Plans', 'white', { dur: 7, sfx: pop, texts: ['Simple pricing', 'Starter', '$9', 'Team', '$29', 'Business', '$79', 'per user / month', 'Most popular'] }, pricing);
seq('org', 'Org Chart', 'mist', { dur: 7, sfx: sw, texts: ['Leadership team', 'Sam Rivera', 'Chief Executive', 'Priya Shah', 'Product', 'Leo Martin', 'Engineering', 'Dana Kim', 'Sales'] }, orgChart);
seq('swot', 'SWOT', 'sand', { dur: 7, sfx: sw, texts: ['SWOT analysis', 'Strengths', 'Loyal customers and a strong brand', 'Weaknesses', 'A small sales team', 'Opportunities', 'New markets abroad', 'Threats', 'Rising costs'] }, swot);
seq('market', 'Market Size', 'deep', { dur: 7, sfx: pop, texts: ['Market size', 'Total market', '$42B', 'Market we can reach', '$8B', 'Our target', '$1.2B'] }, nested);
seq('survey', 'Survey Result', 'white', { sfx: pop, texts: ['8 in 10', 'customers would recommend us to a friend', 'Customer survey, 2026', '80'] }, people);
seq('offices', 'Our Offices', 'slate', { sfx: [['sfx-drop', 0.9]], texts: ['Our offices', 'London', 'New York', 'Singapore', 'Sydney'] }, offices);
seq('partners', 'Our Partners', 'mist', { sfx: sw, texts: ['Trusted by teams everywhere', 'Partner A', 'Partner B', 'Partner C', 'Partner D', 'Partner E', 'Partner F'] }, partners);
seq('announcement', 'Announcement', 'carbon', { sfx: [['sfx-notify', 0.1]], texts: ['Announcement', 'We’re opening a new studio in Lisbon', 'Doors open in March 2027'] }, announce);
seq('event', 'Event Date', 'mist', { sfx: pop, texts: ['Save the date', 'Annual Summit 2027', 'Mar', '18', '9:00 am – 5:00 pm', 'Riverside Conference Centre'] }, eventDate);
seq('qa', 'Q&A Break', 'deep', { sfx: pop, texts: ['Q&A', 'Your questions, answered', 'Send yours to questions@company.com'] }, qa);
seq('divider', 'Section Divider', 'slate', { sfx: wh, texts: ['Section', '03', 'Financial Overview'] }, divider);
seq('agenda', 'Agenda Checkpoint', 'white', { dur: 7, sfx: sw, texts: ['Agenda', 'Welcome and introductions', 'This year’s results', 'Our roadmap', 'Questions', '3'] }, agendaNow);
seq('mission', 'Mission Statement', 'sand', { texts: ['Our mission', 'To make great design simple for every team, everywhere.'] }, mission);
seq('values', 'Our Values', 'mist', { dur: 7, sfx: pop, texts: ['Our values', 'Curious', 'We always ask why', 'Honest', 'We say it straight', 'Bold', 'We try new things', 'Kind', 'We look out for each other'] }, values);
seq('award', 'Award', 'deep', { sfx: [['sfx-success', 0.4]], texts: ['Award', 'Best Workplace 2026', 'Regional Business Awards'] }, award);
seq('hiring', 'We’re Hiring', 'carbon', { sfx: pop, texts: ['We’re hiring', 'Come build with us', 'Product Designer', 'Software Engineer', 'Support Lead', 'careers.company.com'] }, hiring);
seq('contact', 'Contact Us', 'white', { sfx: sw, texts: ['Get in touch', 'hello@company.com', '+1 555 010 0100', 'www.company.com'] }, contact);
seq('cta', 'Call to Action', 'slate', { sfx: [['sfx-click', 1.95]], texts: ['Ready to get started?', 'Book a free demo', 'company.com/demo'] }, cta);
seq('mix', 'Revenue Mix', 'sand', { dur: 7, sfx: sw, texts: ['Revenue mix', 'Where this year’s revenue came from', 'Subscriptions', 'Services', 'Hardware', '62 25 13'] }, splitBar);
seq('yoy', 'Year over Year', 'carbon', { dur: 7, sfx: sw, texts: ['Year over year', 'Last year', 'This year', 'North South East West', '40 55 30 45', '52 61 44 58'] }, pairs);
seq('goal', 'Goal Progress', 'mist', { sfx: [['sfx-riser', 0.2]], texts: ['Fundraising', '84%', 'of our $2M goal raised', '$1.68M from 412 donors'] }, goal);
seq('takeaways', 'Key Takeaways', 'deep', { dur: 7, sfx: sw, texts: ['Key takeaways', 'Revenue grew 18% this year', 'Customer churn fell to 6%', 'We’re hiring in three new cities'] }, takeaways);
seq('milestone', 'Milestone Reached', 'white', { sfx: [['sfx-success', 1.4]], texts: ['Milestone', '10,000', 'customers and counting', 'Thank you for being one of them'] }, milestoneReached);

export const BIZ_SEQS = L;
