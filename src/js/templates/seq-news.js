// News sequences: intros, mid-rolls and outros for a news show or report. Every word is editable,
// every part can be moved, and each works in 16:9, 9:16 and 1:1. Channel and people names are
// made-up placeholders.
import {
  tx, kin, lerp, frame, TY, sized, pill, card, glyph, iconDisc, countUp, wrapO, measure, animText, drawText, piece, line,
  roundRect, growRect, ease, clamp, rgba, K, area, fo, para, column, block, beside,
} from './scenekit.js';

const L = [];
const seq = (id, name, role, theme, o, draw) => L.push({ id, name, cat: 'News', role, dur: role === 'intro' ? 5 : 6, bg: TH[theme].bg, colors: TH[theme].c, ...o, draw });

// Colour sets: [text, accent, second accent, muted text, card, text on the accent]. Text, card and
// muted colours are neutral, so a brand kit only swaps the accents.
const TH = {
  desk: { bg: ['bg-navy', '#0b1a33'], c: ['#ffffff', '#e11d48', '#38bdf8', '#aab4c0', '#ffffff', '#ffffff'] },
  net: { bg: ['bg-particles', '#0b1a33', '#38bdf8'], c: ['#ffffff', '#e11d48', '#38bdf8', '#aab4c0', '#ffffff', '#ffffff'] },
  paper: { bg: ['bg-white', '#f6f6f3'], c: ['#111827', '#dc2626', '#1d4ed8', '#6b7280', '#ffffff', '#ffffff'] },
  night: { bg: ['bg-black', '#0b0b0d'], c: ['#fafafa', '#f5b301', '#ef4444', '#a1a1aa', '#ffffff', '#111111'] },
  slate: { bg: ['bg-charcoal', '#1b2130'], c: ['#ffffff', '#0ea5e9', '#f43f5e', '#9ca3af', '#ffffff', '#0b1220'] },
  wire: { bg: ['bg-white', '#eef2f8'], c: ['#0f172a', '#1e3a8a', '#dc2626', '#64748b', '#ffffff', '#ffffff'] },
  dawn: { bg: ['bg-white', '#fff6ec'], c: ['#1c1917', '#ea580c', '#f59e0b', '#78716c', '#ffffff', '#ffffff'] },
};
const still0 = { anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 };
const dark = (k) => (k.dark ? '#111827' : '#ffffff'); // text on a bar of the main text colour

// A red dot that pulses, like a live light.
function liveDot(ctx, S, x, y, r, color, delay) {
  piece(ctx, { x: x - r * 1.8, y: y - r * 1.8, w: r * 3.6, h: r * 3.6 }, (c) => {
    const kk = kin(S, delay, 0.3); if (kk <= 0) return;
    const p = (S.t * 1.3) % 1;
    c.fillStyle = color;
    c.globalAlpha = fo(S) * kk * (1 - p) * 0.45; c.beginPath(); c.arc(x, y, r * (1 + p * 0.8), 0, Math.PI * 2); c.fill();
    c.globalAlpha = fo(S) * kk; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  });
}
// A station mark: a rounded square with the channel's initials, popping in.
function stationBug(ctx, S, cx, cy, size, text, k, delay, dot = true) {
  const u = S.u;
  piece(ctx, { x: cx - size / 2, y: cy - size / 2, w: size, h: size }, (c) => {
    const kk = ease.outBack(clamp((S.t - delay) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.scale(kk, kk);
    c.fillStyle = k.acc; roundRect(c, -size / 2, -size / 2, size, size, size * 0.18); c.fill();
    c.strokeStyle = rgba(k.on, 0.5); c.lineWidth = 4 * u; roundRect(c, -size / 2 + 12 * u, -size / 2 + 12 * u, size - 24 * u, size - 24 * u, size * 0.12); c.stroke();
    drawText(c, S, text, 0, 4 * u, { ...sized(TY.num, (size / u) * 0.36), color: k.on, align: 'center', maxWidth: (size * 0.6) / S.W, ...still0, alpha: Math.min(1, kk) });
    c.restore();
  });
  if (dot) liveDot(ctx, S, cx + size / 2 - 4 * u, cy - size / 2 + 4 * u, 13 * u, '#ef4444', delay + 0.4);
}
// Four camera-frame corners round the edge of the picture.
function corners(ctx, S, f, k, delay, inset = 50) {
  const u = f.u, m = inset * u, a = 70 * u;
  piece(ctx, { x: m, y: m, w: f.W - m * 2, h: f.H - m * 2 }, (c) => {
    const kk = kin(S, delay, 0.5, ease.outCubic); if (kk <= 0) return;
    c.globalAlpha = fo(S) * kk; c.strokeStyle = rgba(k.ink, 0.7); c.lineWidth = 5 * u; c.lineCap = 'round';
    const s = a * kk;
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [f.W - m, m, -1, 1], [m, f.H - m, 1, -1], [f.W - m, f.H - m, -1, -1]]) { c.beginPath(); c.moveTo(x, y + dy * s); c.lineTo(x, y); c.lineTo(x + dx * s, y); c.stroke(); }
  });
}
const label = (text, k, delay = 0.1, extra = {}) => ({ text, o: TY.label, color: k.acc, anim: 'fade', delay, ...extra });

// ================= intros (and the matching outros, which reuse them with closing words) =================

// Newsroom Globe: a turning wire globe, the channel name on a red tag, the show and the date.
function globeOpen(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f);
  const R = f.tall ? Math.min(cw * 0.4, 300 * u) : f.square ? 175 * u : Math.min(f.H * 0.29, 290 * u);
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: f.square ? 70 : 100 }, (tw) => [
    { pill: tx(S, 0), o: sized(TY.label, 30), bg: k.acc, ink: k.on, h: 64, r: 6, delay: 0.5 },
    { text: tx(S, 1), o: sized(TY.big, f.tall ? 96 : f.square ? 84 : 108), color: k.ink, gap: 26, delay: 0.7 },
    { text: tx(S, 2), o: TY.body, color: k.muted, gap: 22, anim: 'fade', delay: 1.1 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.05) / 0.7)); if (kk <= 0) return;
    const r = R * Math.min(kk, 1.04);
    c.globalAlpha = fo(S);
    c.fillStyle = rgba(k.acc2, 0.12); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgba(k.acc2, 0.9); c.lineWidth = 3 * u;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 4; i++) { const a = S.t * 0.6 + (i * Math.PI) / 4; c.beginPath(); c.ellipse(cx, cy, Math.max(1, Math.abs(Math.cos(a)) * r), r, 0, 0, Math.PI * 2); c.stroke(); }
    for (const fy of [-0.55, 0, 0.55]) { const hw = Math.sqrt(Math.max(0, 1 - fy * fy)) * r; c.beginPath(); c.ellipse(cx, cy + fy * r, hw, hw * 0.13, 0, 0, Math.PI * 2); c.stroke(); }
  }));
}

// Breaking Bulletin: a slanted red slab slams across with the words, then the channel on a bar.
function breaking(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f);
  const so = { ...sized(TY.big, f.tall ? 92 : 124), upper: true, fontFixed: true }, smw = (cw - 80 * u) / f.W;
  const st = wrapO(ctx, S, tx(S, 0), so, smw), ms = measure(ctx, S, st, so);
  const slabH = ms.h * Math.min(1, (cw - 80 * u) / ms.w) + 80 * u, sk = 70 * u;
  const no = sized(TY.head, f.tall ? 44 : 50), nbW = Math.min(cw, measure(ctx, S, tx(S, 1), no).w + 160 * u), nbH = 96 * u;
  column(f, [
    [slabH, (y) => {
      piece(ctx, { x: 0, y, w: f.W, h: slabH }, (c) => {
        const kk = kin(S, 0.1, 0.45, ease.outExpo); if (kk <= 0) return;
        c.globalAlpha = fo(S); c.fillStyle = k.acc;
        const x1 = lerp(-f.W - sk * 2, -sk, kk);
        c.beginPath(); c.moveTo(x1 + sk, y); c.lineTo(x1 + f.W + sk * 2, y); c.lineTo(x1 + f.W + sk, y + slabH); c.lineTo(x1, y + slabH); c.closePath(); c.fill();
      });
      animText(ctx, S, st, f.W / 2, y + slabH / 2, { ...so, color: k.on, anim: 'zoom', delay: 0.35, stagger: 0.02, maxWidth: smw });
    }],
    [nbH, (y) => {
      const bx = f.W / 2 - nbW / 2;
      growRect(ctx, bx, y, nbW, nbH, kin(S, 0.6, 0.45, ease.outExpo), 'r', k.ink, 8 * u, fo(S));
      liveDot(ctx, S, bx + 48 * u, y + nbH / 2, 12 * u, k.acc, 0.9);
      animText(ctx, S, tx(S, 1), f.W / 2 + 22 * u, y + nbH / 2, { ...no, color: dark(k), anim: 'fade', delay: 0.9, maxWidth: (nbW - 160 * u) / f.W });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.3, maxWidth: cw / f.W })],
  ], 36 * u);
}

// Headline Stripes: four slanted stripes sweep up, beside the show's name, its line and its time.
function stripesOpen(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), side = !f.tall;
  const y0 = side ? 0 : 0, y1 = side ? f.H : f.H * 0.3, bw = side ? f.W * 0.05 : f.W * 0.08, slant = (y1 - y0) * 0.35;
  const cols = [k.acc, k.acc2, rgba(k.ink, 0.85), k.acc];
  piece(ctx, { x: side ? f.W * 0.66 : 0, y: y0, w: side ? f.W * 0.34 : f.W, h: y1 - y0 }, (c) => {
    c.globalAlpha = fo(S);
    c.save(); c.beginPath(); c.rect(0, y0, f.W, y1 - y0); c.clip();
    for (let i = 0; i < 4; i++) {
      const kk = kin(S, 0.05 + i * 0.1, 0.7, ease.outExpo); if (kk <= 0) continue;
      const bx = side ? f.W * 0.7 + i * bw * 1.35 : f.W * 0.12 + i * bw * 1.7, off = (1 - kk) * (y1 - y0);
      c.fillStyle = cols[i];
      c.beginPath(); c.moveTo(bx, y1 + off); c.lineTo(bx + bw, y1 + off); c.lineTo(bx + bw + slant, y0 + off); c.lineTo(bx + slant, y0 + off); c.closePath(); c.fill();
    }
    c.restore();
  });
  const tw = side ? cw * 0.6 : cw;
  const b = block(ctx, S, [
    { pill: tx(S, 2), o: sized(TY.label, 26), bg: k.acc2, ink: k.on, h: 54, r: 6, delay: 0.5 },
    { text: tx(S, 0), o: sized(TY.big, f.tall ? 100 : 116), color: k.ink, gap: 26, delay: 0.6 },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 48 : 52), color: k.muted, gap: 20, anim: 'fade', delay: 1.0 },
  ], tw);
  if (side) b.draw(x0, f.H / 2 - b.h / 2, 'left');
  else b.draw(x0, f.H * 0.62 - b.h / 2, 'left');
}

// Morning Show: a warm sun rises over the horizon beside the show's name.
function morning(ctx, S) {
  const f = frame(S), u = f.u, k = K(S);
  const R = f.tall ? f.W * 0.3 : f.square ? 160 * u : Math.min(f.H * 0.3, 300 * u);
  beside(ctx, S, f, { vw: R * 2.2, vh: R * 1.7, gap: f.square ? 60 : 90, right: true }, () => [
    label(tx(S, 2), k, 0.6),
    { text: tx(S, 0), o: sized(TY.big, f.tall ? 96 : f.square ? 80 : 110), color: k.ink, gap: 20, delay: 0.5 },
    { text: tx(S, 1), o: TY.body, color: k.muted, gap: 22, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - R * 1.1, y: cy - R * 0.85, w: R * 2.2, h: R * 1.7 }, (c) => {
    const kk = kin(S, 0.1, 1.4, ease.outCubic); if (kk <= 0) return;
    const hy = cy + R * 0.45, sy = hy + R * 0.8 - kk * R * 1.4;
    c.globalAlpha = fo(S);
    c.save(); c.beginPath(); c.rect(cx - R * 1.1, cy - R * 0.85, R * 2.2, hy - (cy - R * 0.85)); c.clip();
    const g = c.createLinearGradient(0, sy - R, 0, sy + R); g.addColorStop(0, k.acc2); g.addColorStop(1, k.acc);
    c.fillStyle = g; c.beginPath(); c.arc(cx, sy, R * 0.72, 0, Math.PI * 2); c.fill();
    c.restore();
    c.fillStyle = rgba(k.ink, 0.8); c.fillRect(cx - R * 1.1 * kk, hy, R * 2.2 * kk, 6 * u);
    c.fillStyle = rgba(k.ink, 0.25); for (let i = 1; i < 4; i++) c.fillRect(cx - R * (1 - i * 0.22) * kk, hy + i * 18 * u, R * 2 * (1 - i * 0.22) * kk, 4 * u);
  }));
}

// Special Report: black bars close in at top and bottom; a gold label, a serif title, an underline.
function special(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const bh = f.H * 0.11;
  growRect(ctx, 0, 0, f.W, bh, kin(S, 0, 0.6, ease.outExpo), 'd', '#000000', 0, fo(S));
  growRect(ctx, 0, f.H - bh, f.W, bh, kin(S, 0, 0.6, ease.outExpo), 'u', '#000000', 0, fo(S));
  const to = { font: 'Playfair Display', fontFixed: true, weight: 700, size: f.tall ? 92 : 108 };
  const t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to), lo = TY.label, lw = measure(ctx, S, tx(S, 0), lo).w;
  column(f, [
    [30 * u, (y) => {
      animText(ctx, S, tx(S, 0), f.W / 2, y + 15 * u, { ...lo, color: k.acc, anim: 'track', delay: 0.4, maxWidth: mw * 0.7 });
      const kk = kin(S, 0.6, 0.6, ease.inOutCubic) * fo(S), half = Math.min(lw, cw * 0.7) / 2 + 30 * u, len = Math.min(160 * u, (cw / 2 - half));
      line(ctx, f.W / 2 - half - len, y + 15 * u, f.W / 2 - half, y + 15 * u, kk, k.acc, 3 * u);
      line(ctx, f.W / 2 + half, y + 15 * u, f.W / 2 + half + len, y + 15 * u, kk, k.acc, 3 * u);
    }],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.6, stagger: 0.01, maxWidth: mw })],
    [8 * u, (y) => growRect(ctx, f.W / 2 - 110 * u, y, 220 * u, 8 * u, kin(S, 1.0, 0.6, ease.inOutCubic), 'c', k.acc, 4 * u, fo(S))],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.3, maxWidth: mw })],
  ], 34 * u);
}

// Live Desk: a station mark with a red light, a LIVE tag, the channel and where it is live from.
function liveDesk(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), size = (f.tall ? 240 : 230) * u;
  corners(ctx, S, f, k, 0.2, f.tall ? 60 : 50);
  beside(ctx, S, f, { vw: size, vh: size, gap: 80 }, () => [
    { pill: tx(S, 0), o: sized(TY.label, 28), bg: k.acc, ink: k.on, h: 52, r: 6, delay: 0.5 },
    { text: tx(S, 1), o: sized(TY.big, f.tall ? 92 : 104), color: k.ink, gap: 24, delay: 0.6 },
    { text: tx(S, 2), o: sized(TY.strong, 38), color: k.muted, gap: 20, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => stationBug(ctx, S, cx, cy, size, tx(S, 3), k, 0.1));
}

// Weekly Roundup: four topic tiles flip in beside the title.
function roundup(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), side = !f.tall && !f.square;
  const gw = side ? cw * 0.48 : cw, gap = 22 * u, tw = (gw - gap) / 2, th = tw * 0.58;
  const fills = [k.acc, k.acc2, rgba(k.ink, 0.86), k.acc];
  const inks = [k.on, k.on, dark(k), k.on];
  beside(ctx, S, f, { vw: gw, vh: th * 2 + gap, gap: 80, right: true }, () => [
    { text: tx(S, 0), o: sized(TY.big, f.tall ? 92 : 100), color: k.ink, delay: 0.2 },
    { text: tx(S, 1), o: TY.body, color: k.muted, gap: 22, anim: 'fade', delay: 0.6 },
  ], (cx, cy) => {
    for (let i = 0; i < 4; i++) {
      const bx = cx - gw / 2 + (i % 2) * (tw + gap), by = cy - (th * 2 + gap) / 2 + Math.floor(i / 2) * (th + gap), d = 0.3 + i * 0.15;
      piece(ctx, { x: bx, y: by, w: tw, h: th }, (c) => {
        const kk = ease.outBack(clamp((S.t - d) / 0.5)); if (kk <= 0) return;
        c.globalAlpha = fo(S); c.save(); c.translate(bx + tw / 2, by + th / 2); c.scale(1, Math.max(0.01, kk));
        c.fillStyle = fills[i]; roundRect(c, -tw / 2, -th / 2, tw, th, 18 * u); c.fill();
        drawText(c, S, tx(S, 2 + i), 0, 4 * u, { ...sized(TY.head, 40), color: inks[i], align: 'center', maxWidth: (tw - 60 * u) / f.W, ...still0, alpha: Math.min(1, kk) });
        c.restore();
      });
    }
  });
}

// Investigation: a spotlight sweeps a dark room while the title types itself out.
function inside(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  piece(ctx, { x: 0, y: 0, w: f.W, h: f.H }, (c) => {
    const kk = kin(S, 0, 0.8); if (kk <= 0) return;
    const sx = f.W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(S.t * 0.9 - 1.2))), r = Math.max(f.W, f.H) * 0.45;
    const g = c.createRadialGradient(sx, f.H * 0.45, 0, sx, f.H * 0.45, r); g.addColorStop(0, rgba(k.acc, 0.22)); g.addColorStop(1, rgba(k.acc, 0));
    c.globalAlpha = fo(S) * kk; c.fillStyle = g; c.fillRect(0, 0, f.W, f.H);
  });
  const to = sized(TY.big, f.tall ? 100 : 120), t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [30 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 15 * u, { ...TY.label, color: k.acc2, align: 'left', anim: 'fade', delay: 0.3, maxWidth: mw })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'type', cursor: false, delay: 0.5, inDur: 1.1, maxWidth: mw })],
    [8 * u, (y) => growRect(ctx, x0, y, Math.min(cw, 300 * u), 8 * u, kin(S, 1.5, 0.6, ease.inOutCubic), 'l', k.acc2, 4 * u, fo(S))],
    [44 * u, (y) => animText(ctx, S, tx(S, 1), x0, y + 22 * u, { ...sized(TY.strong, 42), color: k.muted, align: 'left', anim: 'fade', delay: 1.7, maxWidth: mw })],
  ], 30 * u);
}

// Local Report: a city skyline rises along the bottom, with a pin over one roof, under the title.
function local(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const n = f.tall ? 9 : 14, bw = f.W / n, base = f.H, top = f.H * (f.tall ? 0.72 : 0.68);
  const hs = Array.from({ length: n }, (_, i) => 0.35 + ((i * 37) % 11) / 11 * 0.65);
  const pinI = Math.floor(n * 0.62);
  piece(ctx, { x: 0, y: top, w: f.W, h: base - top }, (c) => {
    c.globalAlpha = fo(S);
    for (let i = 0; i < n; i++) {
      const kk = kin(S, 0.1 + i * 0.04, 0.6, ease.outCubic); if (kk <= 0) continue;
      const h = (base - top) * hs[i] * kk, x = i * bw;
      c.fillStyle = i === pinI ? rgba(k.acc, 0.85) : rgba(k.ink, 0.1 + (i % 3) * 0.05); c.fillRect(x + 4 * u, base - h, bw - 8 * u, h);
      c.fillStyle = k.dark ? 'rgba(255,214,102,0.55)' : 'rgba(255,255,255,0.7)';
      for (let wy = base - h + 20 * u; wy < base - 20 * u; wy += 34 * u) for (let wx = x + 18 * u; wx < x + bw - 24 * u; wx += 28 * u) if (((wx + wy) / u | 0) % 3) c.fillRect(wx, wy, 10 * u, 14 * u);
    }
    const ph = (base - top) * hs[pinI], kp = ease.outBounce(clamp((S.t - 1.0) / 0.7));
    if (kp > 0) glyph(c, 'pin', pinI * bw + bw / 2, base - ph - 60 * u - (1 - kp) * 200 * u, 50 * u, k.acc, 1, u);
  });
  const b = block(ctx, S, [
    label(tx(S, 2), k, 0.4, { o: sized(TY.label, 28) }),
    { text: tx(S, 0), o: sized(TY.big, f.tall ? 100 : 116), color: k.ink, gap: 22, delay: 0.5 },
    { text: tx(S, 1), o: TY.body, color: k.muted, gap: 22, anim: 'fade', delay: 0.9 },
  ], cw);
  b.draw(f.W / 2, Math.max(f.my, top * 0.5 - b.h / 2 - 20 * u), 'center');
}

// Clock: the hands sweep round to the show's time, beside its name.
function clockOpen(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f);
  const R = f.tall ? Math.min(cw * 0.36, 260 * u) : f.square ? 165 * u : Math.min(f.H * 0.27, 260 * u);
  const [hh, mm] = (String(tx(S, 2)).match(/\d+/g) || ['6', '0']).map(Number);
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: f.square ? 70 : 100 }, () => [
    { pill: tx(S, 2), o: sized(TY.num, 30), bg: k.acc, ink: k.on, h: 56, r: 8, delay: 0.9 },
    { text: tx(S, 0), o: sized(TY.big, f.tall ? 88 : f.square ? 76 : 100), color: k.ink, gap: 24, delay: 0.5 },
    { text: tx(S, 1), o: TY.body, color: k.muted, gap: 20, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.05) / 0.6)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.scale(kk, kk);
    c.fillStyle = rgba(k.ink, 0.06); c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = k.ink; c.lineWidth = 8 * u; c.beginPath(); c.arc(0, 0, R - 4 * u, 0, Math.PI * 2); c.stroke();
    c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.lineWidth = (i % 3 ? 4 : 8) * u; c.beginPath(); c.moveTo(Math.sin(a) * R * 0.78, -Math.cos(a) * R * 0.78); c.lineTo(Math.sin(a) * R * 0.88, -Math.cos(a) * R * 0.88); c.stroke(); }
    const p = kin(S, 0.4, 1.6, ease.inOutCubic), ma = ((mm || 0) / 60) * Math.PI * 2 + Math.PI * 2 * 2 * (1 - p), ha = (((hh % 12) + (mm || 0) / 60) / 12) * Math.PI * 2 * p;
    c.strokeStyle = k.ink; c.lineWidth = 12 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ha) * R * 0.48, -Math.cos(ha) * R * 0.48); c.stroke();
    c.strokeStyle = k.acc; c.lineWidth = 7 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ma) * R * 0.72, -Math.cos(ma) * R * 0.72); c.stroke();
    c.fillStyle = k.acc; c.beginPath(); c.arc(0, 0, 14 * u, 0, Math.PI * 2); c.fill();
    c.restore();
  }));
}

// ================= mid-rolls =================

// Breaking Banner: a BREAKING tag, the headline and a line of detail, with a ticker running along the bottom.
function banner(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const bandH = 84 * u, by = f.H - (f.tall ? 260 : 150) * u, lw = Math.min(cw * 0.3, measure(ctx, S, 'LATEST', sized(TY.label, 26)).w + 70 * u);
  const b = block(ctx, S, [
    { pill: tx(S, 0), o: sized(TY.label, 30), bg: k.acc, ink: k.on, h: 62, r: 6, delay: 0.1 },
    { text: tx(S, 1), o: sized(TY.big, f.tall ? 84 : 96), color: k.ink, gap: 30, delay: 0.3 },
    { text: tx(S, 2), o: sized(TY.body, 40), color: k.muted, gap: 24, anim: 'fade', delay: 0.8 },
  ], cw);
  b.draw(x0, Math.max(f.my, (by - b.h) / 2), 'left');
  growRect(ctx, 0, by, f.W, bandH, kin(S, 0.6, 0.5, ease.outExpo), 'l', k.ink, 0, fo(S));
  piece(ctx, { x: 0, y: by, w: f.W, h: bandH }, (c) => {
    const kk = kin(S, 1.0, 0.4); if (kk <= 0) return;
    c.globalAlpha = fo(S) * kk; c.save(); c.beginPath(); c.rect(x0 + lw + 20 * u, by, f.W - 24 * u - (x0 + lw + 20 * u), bandH); c.clip();
    const o = sized(TY.strong, 34), w = measure(ctx, S, tx(S, 3), o).w + 120 * u, x = f.W - ((S.t - 1.0) * 160 * u) % (w + f.W * 0.2);
    for (const xx of [x, x + w + f.W * 0.2]) drawText(c, S, tx(S, 3), xx, by + bandH / 2 + 2 * u, { ...o, color: dark(k), align: 'left', ...still0 });
    c.restore();
  });
  pill(ctx, S, 'LATEST', x0, by + bandH / 2, { o: sized(TY.label, 26), bg: k.acc, ink: k.on, h: bandH, r: 0, delay: 0.9, maxW: lw });
}

// Top Stories: three headlines, each with its number on a square.
function topStories(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), sq = 76 * u, gap = 30 * u;
  const ho = sized(TY.title, f.tall ? 48 : 54), tw = (cw - sq - 34 * u) / f.W;
  const ts = [1, 2, 3].map((i) => wrapO(ctx, S, tx(S, i), ho, tw)), hs = ts.map((t) => Math.max(sq, measure(ctx, S, t, ho).h));
  const tH = measure(ctx, S, tx(S, 0), sized(TY.big, 84)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.big, 84), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [hs.reduce((a, b) => a + b, 0) + gap * 2, (y) => { let yy = y; ts.forEach((t, i) => {
      const h = hs[i], d = 0.4 + i * 0.3;
      if (i) line(ctx, x0, yy - gap / 2, x0 + cw, yy - gap / 2, kin(S, d - 0.1, 0.5) * fo(S), rgba(k.ink, 0.15), 2 * u);
      piece(ctx, { x: x0, y: yy + h / 2 - sq / 2, w: sq, h: sq }, (c) => { const kk = ease.outBack(clamp((S.t - d) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = i ? rgba(k.ink, 0.85) : k.acc; roundRect(c, x0 + sq / 2 - (sq / 2) * kk, yy + h / 2 - (sq / 2) * kk, sq * kk, sq * kk, 10 * u); c.fill(); drawText(c, S, String(i + 1), x0 + sq / 2, yy + h / 2 + 2 * u, { ...sized(TY.num, 40), color: i ? dark(k) : k.on, align: 'center', ...still0, alpha: Math.min(1, kk) }); });
      animText(ctx, S, t, x0 + sq + 34 * u, yy + h / 2, { ...ho, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: tw });
      yy += h + gap;
    }); }],
  ], 44 * u);
}

// Weather: five days, each with its name, a picture of the weather and the temperature. The pictures
// follow the words in the last line (sun, cloud, rain, storm, snow, night), so they always match.
function weather(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 5, across = !f.tall;
  const kinds = String(tx(S, 12)).toLowerCase().split(/[\s,]+/).filter(Boolean);
  const gap = 18 * u, cwid = across ? (cw - gap * 4) / 5 : cw, ch = across ? 330 * u : 150 * u;
  const tb = block(ctx, S, [label(tx(S, 0), k), { text: tx(S, 1), o: sized(TY.title, 68), color: k.ink, gap: 16, delay: 0.2 }], cw);
  const icon = (c, kind, x, y, r) => {
    const g = /rain|shower/.test(kind) ? 'rain' : /storm|thunder/.test(kind) ? 'bolt' : /cloud|grey|overcast/.test(kind) ? 'cloud' : /night|clear night|moon/.test(kind) ? 'moon' : /snow/.test(kind) ? 'cloud' : 'sun';
    glyph(c, g, x, y, r, g === 'sun' || g === 'bolt' ? '#f59e0b' : g === 'moon' ? '#fbbf24' : rgba(k.ink, 0.5), 1, u);
  };
  column(f, [
    [tb.h, (y) => tb.draw(x0, y, 'left')],
    [across ? ch : n * ch + (n - 1) * gap, (y) => { for (let i = 0; i < n; i++) {
      const bx = across ? x0 + i * (cwid + gap) : x0, by = across ? y : y + i * (ch + gap), d = 0.4 + i * 0.12;
      card(ctx, S, { x: bx, y: by, w: cwid, h: ch }, { color: k.surf, delay: d, r: 22, border: k.dark ? null : rgba(k.ink, 0.07), inner: (c, kk) => {
        if (across) icon(c, kinds[i] || 'sun', bx + cwid / 2, by + ch * 0.47, 54 * u); else icon(c, kinds[i] || 'sun', bx + cwid * 0.5, by + ch / 2, 46 * u);
      } });
      const dx = across ? bx + cwid / 2 : bx + 40 * u, al = across ? 'center' : 'left';
      animText(ctx, S, tx(S, 2 + i), dx, across ? by + 50 * u : by + ch / 2, { ...sized(TY.head, 38), color: k.ink, align: al, anim: 'fade', delay: d + 0.15, maxWidth: (across ? cwid - 30 * u : cwid * 0.3) / f.W });
      animText(ctx, S, tx(S, 7 + i), across ? dx : bx + cwid - 40 * u, across ? by + ch - 56 * u : by + ch / 2, { ...sized(TY.num, across ? 52 : 50), color: k.acc, align: across ? 'center' : 'right', anim: 'fade', delay: d + 0.25, maxWidth: (across ? cwid - 30 * u : cwid * 0.25) / f.W });
    } }],
  ], 40 * u);
}

// On the Scene: camera corners and a LIVE tag, a pin and the place, and who is reporting.
function onScene(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = 66 * u;
  corners(ctx, S, f, k, 0.1, f.tall ? 70 : 60);
  pill(ctx, S, tx(S, 3), f.W - (f.tall ? 110 : 120) * u, (f.tall ? 130 : 120) * u, { o: sized(TY.label, 26), bg: k.acc, ink: k.on, h: 50, r: 6, align: 'right', delay: 0.3 });
  liveDot(ctx, S, f.W - (f.tall ? 110 : 120) * u - measure(ctx, S, tx(S, 3), sized(TY.label, 26)).w - 90 * u, (f.tall ? 130 : 120) * u, 12 * u, k.acc, 0.4);
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: 40, tallGap: 40 }, () => [
    label(tx(S, 0), k, 0.5),
    { text: tx(S, 1), o: sized(TY.big, f.tall ? 100 : 116), color: k.ink, gap: 16, delay: 0.6 },
    { text: tx(S, 2), o: sized(TY.strong, 38), color: k.muted, gap: 22, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => iconDisc(ctx, S, 'pin', cx, cy, R, k.acc, k.on, 0.4));
}

// Source Quote: big quotation marks, the quote, and who said it.
function sourceQuote(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const qo = { font: 'Playfair Display', fontFixed: true, weight: 700, size: f.tall ? 62 : 70 }, mw = (cw - 40 * u) / f.W;
  const q = wrapO(ctx, S, tx(S, 0), qo, mw), mq = measure(ctx, S, q, qo);
  column(f, [
    [110 * u, (y) => piece(ctx, { x: x0, y, w: 160 * u, h: 110 * u }, (c) => { const kk = kin(S, 0.1, 0.5); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; drawText(c, S, '“', x0, y + 100 * u, { font: 'Playfair Display', fontFixed: true, weight: 900, size: 240, color: k.acc, align: 'left', ...still0 }); })],
    [mq.h, (y) => animText(ctx, S, q, x0, y + mq.h / 2, { ...qo, color: k.ink, align: 'left', anim: 'fade', delay: 0.3, inDur: 0.8, maxWidth: mw })],
    [90 * u, (y) => {
      growRect(ctx, x0, y + 8 * u, 70 * u, 6 * u, kin(S, 1.0, 0.4), 'l', k.acc, 3 * u, fo(S));
      animText(ctx, S, tx(S, 1), x0, y + 46 * u, { ...sized(TY.strong, 40), color: k.ink, align: 'left', anim: 'fade', delay: 1.1, maxWidth: mw });
      animText(ctx, S, tx(S, 2), x0, y + 86 * u, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: 1.2, maxWidth: mw });
    }],
  ], 26 * u);
}

// Developing Story: a pulsing DEVELOPING tag, the headline, then updates with their times.
function developing(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), rowH = 74 * u, tcol = 170 * u;
  const hb = block(ctx, S, [
    { pill: tx(S, 0), o: sized(TY.label, 26), bg: k.acc, ink: k.on, h: 52, r: 6, delay: 0.1, padX: 56 },
    { text: tx(S, 1), o: sized(TY.big, f.tall ? 78 : 88), color: k.ink, gap: 26, delay: 0.3 },
  ], cw);
  column(f, [
    [hb.h, (y) => { hb.draw(x0, y, 'left'); liveDot(ctx, S, x0 + 28 * u, y + 26 * u, 9 * u, k.on, 0.4); }],
    [rowH * 3, (y) => [0, 1, 2].forEach((i) => {
      const yy = y + rowH * i + rowH / 2, d = 0.9 + i * 0.3;
      line(ctx, x0, yy + rowH / 2, x0 + cw, yy + rowH / 2, kin(S, d, 0.5) * fo(S), rgba(k.ink, 0.12), 2 * u);
      animText(ctx, S, tx(S, 2 + i * 2), x0, yy, { ...sized(TY.num, 34), color: k.acc, align: 'left', anim: 'fade', delay: d, maxWidth: (tcol - 20 * u) / f.W });
      animText(ctx, S, tx(S, 3 + i * 2), x0 + tcol, yy, { ...sized(TY.strong, 38), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (cw - tcol) / f.W });
    })],
  ], 40 * u);
}

// Fact Check: the claim on a card, a verdict stamped across it, and the facts.
function factCheck(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 50 * u;
  const qo = sized(TY.title, f.tall ? 52 : 58), q = wrapO(ctx, S, tx(S, 1), qo, (cw - pad * 2) / f.W), mq = measure(ctx, S, q, qo);
  const ch = mq.h + pad * 2, so = { ...sized(TY.big, 64), upper: true, fontFixed: true }, ms = measure(ctx, S, tx(S, 2), so), sw = Math.min(cw * 0.8, ms.w + 70 * u), sh = ms.h + 46 * u;
  const mF = para(ctx, S, tx(S, 3), 0, 0, TY.body, k.ink, cw / f.W, { draw: false });
  column(f, [
    [30 * u, (y) => animText(ctx, S, tx(S, 0), x0, y + 15 * u, { ...TY.label, color: k.acc2, align: 'left', anim: 'fade', delay: 0.1, maxWidth: cw / f.W })],
    [ch + sh * 0.85, (y) => {
      card(ctx, S, { x: x0, y, w: cw, h: ch }, { color: k.surf, delay: 0.2, r: 22, border: k.dark ? null : rgba(k.ink, 0.08) });
      animText(ctx, S, q, x0 + pad, y + ch / 2, { ...qo, color: k.ink, align: 'left', anim: 'fade', delay: 0.4, maxWidth: (cw - pad * 2) / f.W });
      const cx = x0 + cw - sw / 2 - 30 * u, cy = y + ch + sh * 0.35;
      piece(ctx, { x: cx - sw / 2 - 20 * u, y: cy - sh / 2 - 20 * u, w: sw + 40 * u, h: sh + 40 * u }, (c) => {
        const kk = clamp((S.t - 1.1) / 0.25); if (kk <= 0) return;
        const sc = 1 + (1 - ease.outCubic(kk)) * 0.8;
        c.globalAlpha = fo(S) * Math.min(1, kk * 1.5); c.save(); c.translate(cx, cy); c.rotate(-0.06); c.scale(sc, sc);
        c.fillStyle = k.dark ? '#1b2130' : '#ffffff'; roundRect(c, -sw / 2, -sh / 2, sw, sh, 12 * u); c.fill();
        c.strokeStyle = k.acc2; c.lineWidth = 7 * u; roundRect(c, -sw / 2, -sh / 2, sw, sh, 12 * u); c.stroke();
        drawText(c, S, tx(S, 2), 0, 3 * u, { ...so, color: k.acc2, align: 'center', maxWidth: (sw - 50 * u) / S.W, ...still0 });
        c.restore();
      });
    }],
    [mF.h, (y) => para(ctx, S, tx(S, 3), x0, y, TY.body, k.ink, cw / f.W, { delay: 1.6, top: true })],
  ], 36 * u);
}

// Interview: two name tags with initials, the host and the guest, under "In conversation".
function interview(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), side = !f.tall, gap = 40 * u, pw = side ? (cw - gap) / 2 : cw, ph = 170 * u, R = 52 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 64)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 64), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? ph : ph * 2 + gap, (y) => [0, 1].forEach((i) => {
      const bx = side ? x0 + i * (pw + gap) : x0, by = side ? y : y + i * (ph + gap), d = 0.3 + i * 0.4, tx0 = bx + 36 * u + R * 2 + 26 * u, tw = (pw - (tx0 - bx) - 30 * u) / f.W;
      card(ctx, S, { x: bx, y: by, w: pw, h: ph }, { color: k.surf, delay: d, r: 24, border: k.dark ? null : rgba(k.ink, 0.07), inner: (c, kk) => {
        c.fillStyle = i ? k.acc2 : k.acc; c.beginPath(); c.arc(bx + 36 * u + R, by + ph / 2, R, 0, Math.PI * 2); c.fill();
        drawText(c, S, tx(S, 5 + i), bx + 36 * u + R, by + ph / 2 + 2 * u, { ...sized(TY.num, 36), color: k.on, align: 'center', maxWidth: (R * 1.3) / S.W, ...still0, alpha: kk });
      } });
      animText(ctx, S, tx(S, 1 + i * 2), tx0, by + ph / 2 - 22 * u, { ...sized(TY.head, 44), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: tw });
      animText(ctx, S, tx(S, 2 + i * 2), tx0, by + ph / 2 + 28 * u, { ...sized(TY.body, 32), color: k.muted, align: 'left', anim: 'fade', delay: d + 0.3, maxWidth: tw });
    })],
  ], 44 * u);
}

// How It Happened: times down a line with a dot for each event.
function events(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 4, rowH = (f.tall ? 120 : 100) * u, tcol = (f.tall ? 190 : 230) * u, lx = x0 + tcol;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rowH * n, (y) => {
      growRect(ctx, lx - 3 * u, y + rowH / 2, 6 * u, rowH * (n - 1), kin(S, 0.3, 1.2, ease.inOutCubic), 'd', rgba(k.ink, 0.2), 3 * u, fo(S));
      for (let i = 0; i < n; i++) {
        const yy = y + rowH * i + rowH / 2, d = 0.4 + i * 0.3;
        piece(ctx, { x: lx - 16 * u, y: yy - 16 * u, w: 32 * u, h: 32 * u }, (c) => { const kk = ease.outBack(clamp((S.t - d) / 0.35)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = i === n - 1 ? k.acc : k.ink; c.beginPath(); c.arc(lx, yy, 14 * u * kk, 0, Math.PI * 2); c.fill(); });
        animText(ctx, S, tx(S, 1 + i * 2), lx - 40 * u, yy, { ...sized(TY.num, 32), color: k.acc, align: 'right', anim: 'fade', delay: d, maxWidth: (tcol - 60 * u) / f.W });
        animText(ctx, S, tx(S, 2 + i * 2), lx + 40 * u, yy, { ...sized(TY.strong, 40), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (cw - tcol - 40 * u) / f.W });
      }
    }],
  ], 40 * u);
}

// Just In: a sheet slides in at a tilt with a JUST IN strip, the headline and a line of detail.
function justIn(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, 1200 * u), pad = 56 * u, stripH = 70 * u;
  const ho = sized(TY.title, f.tall ? 62 : 70), h1 = wrapO(ctx, S, tx(S, 1), ho, (w - pad * 2) / f.W), m1 = measure(ctx, S, h1, ho);
  const bo = TY.body, b1 = wrapO(ctx, S, tx(S, 2), bo, (w - pad * 2) / f.W), m2 = measure(ctx, S, b1, bo);
  const h = stripH + pad + m1.h + 24 * u + m2.h + pad, x = f.W / 2 - w / 2, y = f.H / 2 - h / 2;
  const kk = ease.outCubic(clamp((S.t - 0.1) / 0.6)), rot = (1 - kk) * 0.08 - 0.015, dy = (1 - kk) * f.H * 0.5;
  piece(ctx, { x, y, w, h }, (c) => {
    if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(f.W / 2, f.H / 2 + dy); c.rotate(rot); c.translate(-f.W / 2, -f.H / 2);
    c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 12 * u;
    c.fillStyle = '#ffffff'; roundRect(c, x, y, w, h, 14 * u); c.fill(); c.shadowColor = 'transparent';
    c.save(); roundRect(c, x, y, w, h, 14 * u); c.clip(); c.fillStyle = k.acc; c.fillRect(x, y, w, stripH); c.restore();
    drawText(c, S, tx(S, 0), x + pad, y + stripH / 2 + 2 * u, { ...TY.label, color: k.on, align: 'left', maxWidth: (w - pad * 2) / S.W, ...still0 });
    drawText(c, S, h1, x + pad, y + stripH + pad + m1.h / 2, { ...ho, color: '#111827', align: 'left', maxWidth: (w - pad * 2) / S.W, ...still0, alpha: clamp((S.t - 0.6) / 0.4) });
    drawText(c, S, b1, x + pad, y + stripH + pad + m1.h + 24 * u + m2.h / 2, { ...bo, color: '#4b5563', align: 'left', maxWidth: (w - pad * 2) / S.W, ...still0, alpha: clamp((S.t - 0.9) / 0.4) });
    c.restore();
  });
}

// By the Numbers: three big figures that count up, each with what it counts.
function byNumbers(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), across = !f.tall, n = 3, colW = across ? cw / 3 : cw, rowH = across ? 240 * u : 220 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? rowH : rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const cx = across ? x0 + colW * (i + 0.5) : f.W / 2, cy = across ? y + rowH / 2 : y + rowH * (i + 0.5), d = 0.4 + i * 0.3;
      if (i) across ? line(ctx, x0 + colW * i, y + 30 * u, x0 + colW * i, y + rowH - 30 * u, kin(S, d, 0.4) * fo(S), rgba(k.ink, 0.15), 2 * u) : line(ctx, x0 + cw * 0.3, y + rowH * i, x0 + cw * 0.7, y + rowH * i, kin(S, d, 0.4) * fo(S), rgba(k.ink, 0.15), 2 * u);
      animText(ctx, S, countUp(tx(S, 1 + i * 2), kin(S, d, 1.3, ease.outQuart)), cx, cy - 26 * u, { ...sized(TY.big, across ? 110 : 120), fontFixed: true, color: i === 0 ? k.acc : k.ink, anim: 'up', delay: d, stagger: 0, maxWidth: (colW - 60 * u) / f.W });
      animText(ctx, S, tx(S, 2 + i * 2), cx, cy + 58 * u, { ...sized(TY.body, 34), color: k.muted, anim: 'fade', delay: d + 0.3, maxWidth: (colW - 60 * u) / f.W });
    } }],
  ], 50 * u);
}

// Up Next: a picture frame with a play button, then the next story and when.
function upNext(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f);
  const vw = f.tall ? cw : Math.min(cw * (f.square ? 0.4 : 0.45), 640 * u), vh = vw * 0.5625;
  beside(ctx, S, f, { vw, vh, gap: f.square ? 60 : 80 }, () => [
    { pill: tx(S, 0), o: sized(TY.label, 28), bg: k.acc, ink: k.on, h: 54, r: 6, delay: 0.5 },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 66 : f.square ? 56 : 70), color: k.ink, gap: 24, delay: 0.6 },
    { text: tx(S, 2), o: sized(TY.strong, 36), color: k.muted, gap: 20, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh }, (c) => {
    const kk = kin(S, 0.1, 0.6, ease.outCubic); if (kk <= 0) return;
    c.globalAlpha = fo(S) * kk; c.save(); c.translate(0, (1 - kk) * 30 * u);
    const g = c.createLinearGradient(cx - vw / 2, cy - vh / 2, cx + vw / 2, cy + vh / 2); g.addColorStop(0, rgba(k.acc2, 0.55)); g.addColorStop(1, rgba(k.acc, 0.55));
    c.fillStyle = g; roundRect(c, cx - vw / 2, cy - vh / 2, vw, vh, 22 * u); c.fill();
    const pr = Math.min(vh * 0.2, 70 * u), kp = ease.outBack(clamp((S.t - 0.6) / 0.4));
    if (kp > 0) { c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.arc(cx, cy, pr * kp, 0, Math.PI * 2); c.fill(); glyph(c, 'play', cx + 4 * u, cy, pr * 0.62, '#111827', kp, u); }
    c.restore();
  }));
}

// Stay With Us: the station mark, then "Stay with us" and the line under it, with dots ticking along.
function stayTuned(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, size = 200 * u;
  const to = sized(TY.big, f.tall ? 96 : 110), t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [size, (y) => stationBug(ctx, S, f.W / 2, y + size / 2, size, tx(S, 2), k, 0.1, false)],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.5, stagger: 0.01, maxWidth: mw })],
    [40 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 0.9, maxWidth: mw })],
    [24 * u, (y) => piece(ctx, { x: f.W / 2 - 70 * u, y, w: 140 * u, h: 24 * u }, (c) => { const kk = kin(S, 1.2, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; for (let i = 0; i < 3; i++) { const on = Math.floor(S.t * 2.5) % 3 === i; c.fillStyle = on ? k.acc : rgba(k.ink, 0.25); c.beginPath(); c.arc(f.W / 2 + (i - 1) * 46 * u, y + 12 * u, (on ? 12 : 9) * u, 0, Math.PI * 2); c.fill(); } })],
  ], 36 * u);
}

// Correction: a notice with a coloured edge, a label and the corrected facts.
function correction(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 56 * u, edge = 14 * u;
  const bo = sized(TY.body, f.tall ? 42 : 46), t = wrapO(ctx, S, tx(S, 1), bo, (cw - pad * 2 - edge) / f.W), mt = measure(ctx, S, t, bo);
  const h = pad + 54 * u + 30 * u + mt.h + pad, y = f.H / 2 - h / 2;
  card(ctx, S, { x: x0, y, w: cw, h }, { color: k.surf, delay: 0.1, r: 20, shadow: k.dark ? 0 : 26, inner: (c) => { c.save(); roundRect(c, x0, y, cw, h, 20 * u); c.clip(); c.fillStyle = k.acc2; c.fillRect(x0, y, edge, h); c.restore(); } });
  pill(ctx, S, tx(S, 0), x0 + edge + pad, y + pad + 27 * u, { o: sized(TY.label, 26), bg: k.acc2, ink: k.on, h: 54, r: 6, delay: 0.4, maxW: cw - pad * 2 - edge });
  animText(ctx, S, t, x0 + edge + pad, y + pad + 54 * u + 30 * u + mt.h / 2, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: 0.7, maxWidth: (cw - pad * 2 - edge) / f.W });
}

// Your Questions: a viewer's question in a speech bubble, who asked, and where to send more.
function viewerQ(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 54 * u, tail = 40 * u;
  const qo = sized(TY.title, f.tall ? 56 : 62), q = wrapO(ctx, S, tx(S, 1), qo, (cw - pad * 2) / f.W), mq = measure(ctx, S, q, qo), bh = mq.h + pad * 2;
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), x0, y + 27 * u, { bg: k.acc, ink: k.on, delay: 0.1, r: 6 })],
    [bh + tail, (y) => {
      piece(ctx, { x: x0, y, w: cw, h: bh + tail }, (c) => {
        const kk = ease.outBack(clamp((S.t - 0.3) / 0.5)); if (kk <= 0) return;
        c.globalAlpha = fo(S); c.save(); c.translate(x0 + 80 * u, y + bh + tail); c.scale(kk, kk); c.translate(-(x0 + 80 * u), -(y + bh + tail));
        c.fillStyle = k.surf; roundRect(c, x0, y, cw, bh, 30 * u); c.fill();
        c.beginPath(); c.moveTo(x0 + 70 * u, y + bh - 2 * u); c.lineTo(x0 + 80 * u, y + bh + tail); c.lineTo(x0 + 130 * u, y + bh - 2 * u); c.closePath(); c.fill();
        c.restore();
      });
      animText(ctx, S, q, x0 + pad, y + bh / 2, { ...qo, color: k.ink, align: 'left', anim: 'fade', delay: 0.6, maxWidth: (cw - pad * 2) / f.W });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), x0 + 40 * u, y + 20 * u, { ...sized(TY.strong, 36), color: k.ink, align: 'left', anim: 'fade', delay: 1.0, maxWidth: (cw - 40 * u) / f.W })],
    [36 * u, (y) => animText(ctx, S, tx(S, 3), x0 + 40 * u, y + 18 * u, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: 1.3, maxWidth: (cw - 40 * u) / f.W })],
  ], 24 * u);
}

// Traffic Update: roads with their status. The status colour follows the word: closed is red,
// delays or slow traffic amber, anything else green.
function traffic(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 4, rowH = (f.tall ? 110 : 96) * u;
  const tone = (t) => (/clos|block|shut/i.test(t) ? '#dc2626' : /delay|slow|heavy|busy|queue|works/i.test(t) ? '#d97706' : '#16a34a');
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => {
      animText(ctx, S, tx(S, 0), x0 + 80 * u, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: (cw - 80 * u) / f.W });
      iconDisc(ctx, S, 'bus', x0 + 32 * u, y + tH / 2, 32 * u, k.acc, k.on, 0.1);
    }],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const yy = y + rowH * i + rowH / 2, d = 0.4 + i * 0.2, st = tx(S, 2 + i * 2);
      line(ctx, x0, yy + rowH / 2, x0 + cw, yy + rowH / 2, kin(S, d, 0.5) * fo(S), rgba(k.ink, 0.12), 2 * u);
      animText(ctx, S, tx(S, 1 + i * 2), x0, yy, { ...sized(TY.strong, 40), color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (cw * 0.55) / f.W });
      pill(ctx, S, st, x0 + cw, yy, { o: sized(TY.strong, 30), bg: tone(st), ink: '#ffffff', align: 'right', h: 54, delay: d + 0.15, maxW: cw * 0.4 });
    } }],
  ], 40 * u);
}

// Sports Results: two matches, each team with its score on a box.
function scores(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), rowH = (f.tall ? 170 : 140) * u, box = 96 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  const row = (y, a, as, b, bs, d) => {
    card(ctx, S, { x: x0, y, w: cw, h: rowH - 24 * u }, { color: k.surf, delay: d, r: 20, border: k.dark ? null : rgba(k.ink, 0.07) });
    const cy = y + (rowH - 24 * u) / 2, mid = f.W / 2, half = cw / 2 - box - 40 * u;
    [[as, mid - box / 2 - 12 * u], [bs, mid + box / 2 + 12 * u]].forEach(([s, cx], j) => piece(ctx, { x: cx - box / 2, y: cy - box / 2, w: box, h: box }, (c) => {
      const kk = ease.outBack(clamp((S.t - d - 0.3 - j * 0.1) / 0.4)); if (kk <= 0) return;
      c.globalAlpha = fo(S); c.fillStyle = j ? rgba(k.ink, 0.85) : k.acc; roundRect(c, cx - (box / 2) * kk, cy - (box / 2) * kk, box * kk, box * kk, 14 * u); c.fill();
      drawText(c, S, s, cx, cy + 3 * u, { ...sized(TY.num, 52), color: j ? dark(k) : k.on, align: 'center', maxWidth: (box * 0.75) / S.W, ...still0, alpha: Math.min(1, kk) });
    }));
    animText(ctx, S, a, mid - box - 40 * u, cy, { ...sized(TY.head, f.tall ? 36 : 42), color: k.ink, align: 'right', anim: 'fade', delay: d + 0.2, maxWidth: (half - 30 * u) / f.W });
    animText(ctx, S, b, mid + box + 40 * u, cy, { ...sized(TY.head, f.tall ? 36 : 42), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (half - 30 * u) / f.W });
  };
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rowH * 2, (y) => { row(y, tx(S, 1), tx(S, 2), tx(S, 3), tx(S, 4), 0.3); row(y + rowH, tx(S, 5), tx(S, 6), tx(S, 7), tx(S, 8), 0.6); }],
    [40 * u, (y) => animText(ctx, S, tx(S, 9), f.W / 2, y + 20 * u, { ...sized(TY.label, 26), color: k.muted, anim: 'fade', delay: 1.2, maxWidth: cw / f.W })],
  ], 30 * u);
}

// Exclusive: a gold EXCLUSIVE stamp, the headline and where to see it.
function exclusive(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const so = { ...sized(TY.head, 40), upper: true, spacing: 0.18 }, ms = measure(ctx, S, tx(S, 0), so), sw = Math.min(cw, ms.w + 80 * u), sh = 84 * u;
  const to = sized(TY.big, f.tall ? 92 : 104), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [sh, (y) => piece(ctx, { x: x0, y, w: sw, h: sh }, (c) => {
      const kk = ease.outBack(clamp((S.t - 0.1) / 0.45)); if (kk <= 0) return;
      c.globalAlpha = fo(S); c.save(); c.translate(x0 + sw / 2, y + sh / 2); c.scale(kk, kk);
      c.fillStyle = k.acc; roundRect(c, -sw / 2, -sh / 2, sw, sh, 8 * u); c.fill();
      c.strokeStyle = rgba(k.on, 0.6); c.lineWidth = 3 * u; roundRect(c, -sw / 2 + 8 * u, -sh / 2 + 8 * u, sw - 16 * u, sh - 16 * u, 5 * u); c.stroke();
      drawText(c, S, tx(S, 0), 0, 3 * u, { ...so, color: k.on, align: 'center', maxWidth: (sw - 60 * u) / S.W, ...still0, alpha: Math.min(1, kk) });
      c.restore();
    })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'up', delay: 0.5, stagger: 0.01, maxWidth: mw })],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 20 * u, { ...sized(TY.strong, 36), color: k.acc, align: 'left', anim: 'fade', delay: 1.0, maxWidth: mw })],
  ], 36 * u);
}

// Statement: a sheet with a heading, who it is from, the quoted words and a signature line.
function statement(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, 1150 * u), pad = 60 * u, x = f.W / 2 - w / 2;
  const qo = { font: 'Playfair Display', fontFixed: true, weight: 400, size: f.tall ? 50 : 54 }, q = wrapO(ctx, S, tx(S, 2), qo, (w - pad * 2) / f.W), mq = measure(ctx, S, q, qo);
  const h = pad + 40 * u + 20 * u + 34 * u + 30 * u + mq.h + 50 * u + 44 * u + pad, y = f.H / 2 - h / 2, inner = (w - pad * 2) / f.W;
  card(ctx, S, { x, y, w, h }, { color: '#ffffff', delay: 0.1, r: 16, shadow: 34 });
  let yy = y + pad;
  animText(ctx, S, tx(S, 0), x + pad, yy + 20 * u, { ...sized(TY.head, 40), upper: true, color: '#111827', align: 'left', anim: 'fade', delay: 0.4, maxWidth: inner }); yy += 40 * u + 20 * u;
  animText(ctx, S, tx(S, 1), x + pad, yy + 17 * u, { ...TY.small, color: '#6b7280', align: 'left', anim: 'fade', delay: 0.5, maxWidth: inner }); yy += 34 * u + 16 * u;
  line(ctx, x + pad, yy, x + w - pad, yy, kin(S, 0.6, 0.6, ease.inOutCubic) * fo(S), k.acc, 3 * u); yy += 30 * u - 16 * u + 16 * u;
  animText(ctx, S, q, x + pad, yy + mq.h / 2, { ...qo, color: '#111827', align: 'left', anim: 'fade', delay: 0.8, inDur: 0.8, maxWidth: inner }); yy += mq.h + 50 * u;
  line(ctx, x + pad, yy, x + pad + Math.min(w * 0.4, 380 * u), yy, kin(S, 1.4, 0.5) * fo(S), 'rgba(17,24,39,0.35)', 2 * u);
  animText(ctx, S, tx(S, 3), x + pad, yy + 26 * u, { ...sized(TY.strong, 32), color: '#111827', align: 'left', anim: 'fade', delay: 1.5, maxWidth: inner });
}

// Top Headline: a thick accent rule, a label, the headline and its subhead.
function headline(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const b = block(ctx, S, [
    label(tx(S, 0), k, 0.3, { o: sized(TY.label, 30) }),
    { text: tx(S, 1), o: sized(TY.big, f.tall ? 100 : 118), color: k.ink, gap: 24, delay: 0.4 },
    { text: tx(S, 2), o: sized(TY.title, f.tall ? 46 : 50), color: k.muted, gap: 26, anim: 'fade', delay: 0.9 },
  ], cw);
  const y = f.H / 2 - b.h / 2 + 30 * u;
  growRect(ctx, x0, y - 60 * u, Math.min(cw, 520 * u), 16 * u, kin(S, 0.1, 0.6, ease.outExpo), 'l', k.acc, 8 * u, fo(S));
  b.draw(x0, y, 'left');
}

// ================= the list =================
const sw = [['sfx-swipe', 0.1]], wh = [['sfx-whoosh', 0.1]], pop = [['sfx-pop', 0.15]], nt = [['sfx-notify', 0.1]];
// Intros, each followed by its matching outro.
seq('globe', 'Newsroom Globe', 'intro', 'net', { sfx: [['sfx-riser', 0.0], ['sfx-whoosh', 0.5]], texts: ['Harbor City News', 'Tonight at Six', 'Tuesday, 14 May'] }, globeOpen);
seq('globe-end', 'Newsroom Globe Sign-off', 'outro', 'net', { texts: ['Harbor City News', 'Thanks for Watching', 'Good night, and see you tomorrow'] }, globeOpen);
seq('breaking', 'Breaking Bulletin', 'intro', 'desk', { sfx: [['sfx-boom', 0.1], ['sfx-whoosh', 0.55]], texts: ['Breaking News', 'Harbor City News', 'Live coverage starts now'] }, breaking);
seq('breaking-end', 'Breaking Bulletin Sign-off', 'outro', 'desk', { sfx: [['sfx-whoosh', 0.1]], texts: ['That’s All for Now', 'Harbor City News', 'Follow the story on our website'] }, breaking);
seq('stripes', 'Headline Stripes', 'intro', 'paper', { sfx: sw, texts: ['The Northline Report', 'Every story that matters', 'Weeknights at 10'] }, stripesOpen);
seq('stripes-end', 'Headline Stripes Sign-off', 'outro', 'paper', { sfx: sw, texts: ['The Northline Report', 'See you tomorrow night', 'Weeknights at 10'] }, stripesOpen);
seq('morning', 'Morning Show', 'intro', 'dawn', { sfx: [['sfx-riser', 0.0]], texts: ['Good Morning, Riverside', 'Your news, weather and traffic', 'Weekdays 6 – 9 am'] }, morning);
seq('morning-end', 'Morning Show Sign-off', 'outro', 'dawn', { texts: ['Have a Great Day', 'See you tomorrow morning', 'Weekdays 6 – 9 am'] }, morning);
seq('special', 'Special Report', 'intro', 'night', { sfx: [['sfx-boom', 0.0]], texts: ['Special Report', 'Inside the City’s Water Supply', 'A Harbor City News investigation'] }, special);
seq('special-end', 'Special Report Sign-off', 'outro', 'night', { texts: ['Special Report', 'Thank You for Watching', 'The full report is on our website'] }, special);
seq('live', 'Live Desk', 'intro', 'slate', { sfx: nt, texts: ['Live', 'Harbor City News', 'Downtown studio · 6:00 pm', 'HC'] }, liveDesk);
seq('live-end', 'Live Desk Sign-off', 'outro', 'slate', { texts: ['Off air', 'Harbor City News', 'Back tomorrow at 6:00 pm', 'HC'] }, liveDesk);
seq('roundup', 'Weekly Roundup', 'intro', 'wire', { sfx: [['sfx-pop', 0.3], ['sfx-pop', 0.45], ['sfx-pop', 0.6], ['sfx-pop', 0.75]], texts: ['The Week in Review', 'Five days. Every headline.', 'Politics', 'Business', 'Science', 'Sport'] }, roundup);
seq('roundup-end', 'Weekly Roundup Sign-off', 'outro', 'wire', { texts: ['That Was the Week', 'See you next Friday', 'Politics', 'Business', 'Science', 'Sport'] }, roundup);
seq('inside', 'Investigation', 'intro', 'night', { sfx: [['sfx-typing', 0.5]], texts: ['The Inside Story', 'Episode 4: Missing Millions', 'An investigation'] }, inside);
seq('inside-end', 'Investigation Sign-off', 'outro', 'night', { sfx: [['sfx-typing', 0.5]], texts: ['Next Week: Part 5', 'Thanks for watching', 'The Inside Story'] }, inside);
seq('local', 'Local Report', 'intro', 'desk', { sfx: [['sfx-drop', 1.0]], texts: ['Riverside Local', 'News from your neighbourhood', 'Every evening at 5'] }, local);
seq('local-end', 'Local Report Sign-off', 'outro', 'desk', { texts: ['Thanks for Watching', 'See you tomorrow at 5', 'Riverside Local'] }, local);
seq('clock', 'News Clock', 'intro', 'paper', { sfx: [['sfx-tick', 0.4], ['sfx-ding', 2.0]], texts: ['The Six O’Clock Report', 'Live from Harbor City', '6:00'] }, clockOpen);
seq('clock-end', 'News Clock Sign-off', 'outro', 'paper', { sfx: [['sfx-tick', 0.4]], texts: ['Good Night from Harbor City', 'Back tomorrow at six', '6:30'] }, clockOpen);
// Mid-rolls
seq('banner', 'Breaking Banner', 'mid', 'desk', { dur: 7, sfx: [['sfx-boom', 0.1]], texts: ['Breaking', 'Bridge closed after overnight storm', 'Drivers are asked to use the ring road while crews check for damage.', 'Storm damage on Harbor Bridge  •  Ferries running late  •  Schools open as normal'] }, banner);
seq('top3', 'Top Stories', 'mid', 'paper', { dur: 7, sfx: sw, texts: ['Top stories', 'Council approves a new city park', 'Rail strike called off at the last minute', 'Local team through to the final'] }, topStories);
seq('weather', 'Weather Forecast', 'mid', 'wire', { dur: 7, sfx: wh, texts: ['Weather', 'Your five-day forecast', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', '21°', '18°', '15°', '19°', '23°', 'sun cloud rain cloud sun'] }, weather);
seq('scene', 'On the Scene', 'mid', 'slate', { sfx: nt, texts: ['On the scene', 'Harbor Bridge', 'Reporting: Maya Torres', 'Live'] }, onScene);
seq('quote', 'Source Quote', 'mid', 'paper', { dur: 7, texts: ['“We expect the bridge to reopen by Friday morning.”', 'Dana Kim', 'City Transport Director'] }, sourceQuote);
seq('developing', 'Developing Story', 'mid', 'desk', { dur: 7, sfx: nt, texts: ['Developing', 'Power cut across the north side', '9:40', 'Outage first reported', '10:15', 'Crews on the way', '11:00', 'Half of homes back on'] }, developing);
seq('factcheck', 'Fact Check', 'mid', 'wire', { dur: 7, sfx: [['sfx-hit', 1.15]], texts: ['Fact check', '“The new park will cost every family $500.”', 'Mostly false', 'The cost is shared across the city budget over ten years, not charged to families.'] }, factCheck);
seq('interview', 'Interview', 'mid', 'slate', { sfx: pop, texts: ['In conversation', 'Sam Rivera', 'Host', 'Priya Shah', 'Head of Harbor Hospital', 'SR', 'PS'] }, interview);
seq('events', 'How It Happened', 'mid', 'paper', { dur: 7, sfx: sw, texts: ['How it happened', '6:10 am', 'Storm reaches the coast', '7:45 am', 'Bridge closed to traffic', '9:30 am', 'Crews begin repairs', '12:00 pm', 'One lane reopens'] }, events);
seq('justin', 'Just In', 'mid', 'night', { sfx: [['sfx-swoosh-down', 0.1]], texts: ['Just in', 'New ferry route announced', 'Boats will run every 30 minutes between the harbor and Eastport from June.'] }, justIn);
seq('numbers', 'By the Numbers', 'mid', 'desk', { dur: 7, sfx: [['sfx-riser', 0.2]], texts: ['By the numbers', '12,000', 'people at the parade', '45', 'floats', '3 hours', 'of music'] }, byNumbers);
seq('upnext', 'Up Next', 'mid', 'slate', { sfx: wh, texts: ['Up next', 'Meet the baker who feeds a whole street', 'After the break'] }, upNext);
seq('brb', 'Stay With Us', 'mid', 'net', { texts: ['Stay With Us', 'We’ll be right back after the break', 'HC'] }, stayTuned);
seq('correction', 'Correction', 'mid', 'paper', { dur: 7, texts: ['Correction', 'In an earlier report we said the market opens on Sunday. It opens on Saturday. We’re sorry for the mistake.'] }, correction);
seq('viewer', 'Your Questions', 'mid', 'wire', { dur: 7, sfx: [['sfx-bubble', 0.3]], texts: ['Your questions', '“Will the bus routes change while the bridge is closed?”', 'Asked by Jo, Northside', 'Send yours to questions@harborcity.news'] }, viewerQ);
seq('traffic', 'Traffic Update', 'mid', 'slate', { dur: 7, sfx: sw, texts: ['Traffic update', 'Harbor Bridge', 'Closed', 'Ring Road', 'Delays', 'Coast Highway', 'Clear', 'Main Street', 'Slow'] }, traffic);
seq('scores', 'Sports Results', 'mid', 'desk', { dur: 7, sfx: [['sfx-applause', 0.6]], texts: ['Sports results', 'Harbor City', '2', 'Northside', '1', 'Riverside', '0', 'Eastport', '0', 'Full time'] }, scores);
seq('exclusive', 'Exclusive', 'mid', 'night', { sfx: [['sfx-hit', 0.15]], texts: ['Exclusive', 'Inside the plan to rebuild the old harbor', 'Only on Harbor City News'] }, exclusive);
seq('statement', 'Statement', 'mid', 'wire', { dur: 7, texts: ['Statement', 'From the Office of the Mayor', '“We are working around the clock to get the city moving again.”', 'Mayor Alex Morgan'] }, statement);
seq('headline', 'Top Headline', 'mid', 'dawn', { sfx: sw, texts: ['Today’s headline', 'Harbor City named greenest city of the year', 'Judges praised its new parks and cycle lanes'] }, headline);

export const NEWS_SEQS = L;
