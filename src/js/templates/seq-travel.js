// Travel sequences: intros, mid-rolls and outros for travel vlogs and guides. Every word is editable,
// every part can be moved, and each works in 16:9, 9:16 and 1:1. Hotels, flights and people are
// made-up placeholders.
import {
  tx, kin, lerp, frame, TY, sized, pill, card, checkBadge, glyph, iconDisc, numOf, wrapO, measure, animText, drawText, piece, line,
  roundRect, growRect, ease, clamp, rgba, K, area, fo, para, column, block, beside,
} from './scenekit.js';

const L = [];
const seq = (id, name, role, theme, o, draw) => L.push({ id, name, cat: 'Travel', role, dur: role === 'intro' ? 5 : 6, bg: TH[theme].bg, colors: TH[theme].c, ...o, draw });

// Colour sets: [text, accent, second accent, muted text, card, text on the accent].
const TH = {
  ocean: { bg: ['bg-white', '#f2f8fa'], c: ['#1c2226', '#0e9aa7', '#f4a261', '#6b7280', '#ffffff', '#ffffff'] },
  sunset: { bg: ['bg-mountains', '#ff9a5a', '#3b2c55'], c: ['#ffffff', '#ffd166', '#ef476f', '#e5e7eb', '#ffffff', '#1f1a24'] },
  forest: { bg: ['bg-white', '#f1f6f0'], c: ['#1c2420', '#2d6a4f', '#e9a03b', '#5f6b66', '#ffffff', '#ffffff'] },
  sky: { bg: ['bg-clouds', '#74b9ff', '#ffffff'], c: ['#1a1d23', '#ff6b35', '#1d4ed8', '#374151', '#ffffff', '#ffffff'] },
  beach: { bg: ['bg-beach', '#8ecae6', '#f6d6a8'], c: ['#1a1d23', '#e76f51', '#2a9d8f', '#374151', '#ffffff', '#ffffff'] },
  night: { bg: ['bg-night-city', '#0b1026', '#ffd166'], c: ['#ffffff', '#ffd166', '#4cc9f0', '#aab4c0', '#ffffff', '#111827'] },
  paper: { bg: ['bg-paper', '#f4efe4', '#d8cfbd'], c: ['#2b2620', '#c2410c', '#0f766e', '#78716c', '#ffffff', '#ffffff'] },
  navy: { bg: ['bg-navy', '#102a43'], c: ['#ffffff', '#f4a261', '#2ec4b6', '#aab4c0', '#ffffff', '#111827'] },
  sand: { bg: ['bg-white', '#fbf4e9'], c: ['#2a2420', '#e76f51', '#2a9d8f', '#78716c', '#ffffff', '#ffffff'] },
};
const still0 = { anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 };
const SCRIPT = { font: 'Pacifico', fontFixed: true, weight: 400 };
const HAND = { font: 'Caveat', fontFixed: true, weight: 700 };
const label = (text, k, delay = 0.1, extra = {}) => ({ text, o: TY.label, color: k.acc, anim: 'fade', delay, ...extra });
const big = (f, wide, tall = wide * 0.86, sq = wide * 0.74) => (f.tall ? tall : f.square ? sq : wide);
// Pick a picture from words: plane, train, bus, car (a pin), boat (a pin).
const modeIcon = (t) => (/fl[yi]|plane|air/i.test(t) ? 'plane' : /train|rail/i.test(t) ? 'train' : /bus|coach/i.test(t) ? 'bus' : 'pin');
const skyIcon = (t) => (/rain|shower/i.test(t) ? 'rain' : /storm|thunder/i.test(t) ? 'bolt' : /cloud|grey|overcast|fog/i.test(t) ? 'cloud' : /night|clear night/i.test(t) ? 'moon' : 'sun');

// A five-point star, full or part-filled (for ratings).
function star(c, x, y, r, fill, color, empty) {
  const path = () => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); };
  c.fillStyle = empty; path(); c.fill();
  if (fill > 0) { c.save(); c.beginPath(); c.rect(x - r, y - r, r * 2 * fill, r * 2); c.clip(); c.fillStyle = color; path(); c.fill(); c.restore(); }
}

// ================= intros (the matching outros reuse them with closing words) =================

// Passport Stamp: a round stamp thumps down with the place and date, beside the title.
function stampOpen(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 230 : f.square ? 165 : 220) * u;
  beside(ctx, S, f, { vw: R * 2.1, vh: R * 2.1, gap: f.square ? 60 : 90 }, () => [
    { text: tx(S, 2), o: { ...SCRIPT, size: big(f, 120) }, color: k.ink, delay: 0.9 },
    { text: tx(S, 3), o: TY.body, color: k.muted, gap: 24, anim: 'fade', delay: 1.3 },
  ], (cx, cy) => piece(ctx, { x: cx - R * 1.05, y: cy - R * 1.05, w: R * 2.1, h: R * 2.1 }, (c) => {
    const kk = clamp((S.t - 0.2) / 0.25); if (kk <= 0) return;
    const sc = 1 + (1 - ease.outCubic(kk)) * 0.9;
    c.globalAlpha = fo(S) * Math.min(1, kk * 1.4) * 0.92; c.save(); c.translate(cx, cy); c.rotate(-0.16); c.scale(sc, sc);
    c.strokeStyle = k.acc; c.lineWidth = 10 * u; c.beginPath(); c.arc(0, 0, R - 6 * u, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 4 * u; c.beginPath(); c.arc(0, 0, R - 30 * u, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 6 * u; c.beginPath(); c.moveTo(-R * 0.72, -3 * u - R * 0.36); c.lineTo(R * 0.72, -3 * u - R * 0.36); c.moveTo(-R * 0.72, R * 0.3 + 3 * u); c.lineTo(R * 0.72, R * 0.3 + 3 * u); c.stroke();
    glyph(c, 'plane', 0, -R * 0.56, R * 0.16, k.acc, 1, u);
    drawText(c, S, tx(S, 0), 0, -R * 0.02, { ...sized(TY.big, (R / u) * 0.34), upper: true, fontFixed: true, color: k.acc, align: 'center', maxWidth: (R * 1.1) / S.W, ...still0 });
    drawText(c, S, tx(S, 1), 0, R * 0.47, { ...sized(TY.num, (R / u) * 0.1), color: k.acc, align: 'center', maxWidth: (R * 0.78) / S.W, ...still0 });
    c.restore();
  }));
}

// Boarding Pass: a pass slides up with where from and to, then the flight, gate and seat.
function boarding(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, f.tall ? cw : 1300 * u), stub = f.tall ? 0 : w * 0.24, pad = (f.tall ? 44 : 56) * u;
  const mw = w - stub, codeO = { ...sized(TY.big, f.tall ? 110 : f.square ? 96 : 130), fontFixed: true }, mC = measure(ctx, S, 'NYC', codeO);
  const head = 76 * u, h = head + pad + mC.h + 50 * u + 30 * u + 110 * u + pad, x = f.W / 2 - w / 2, y = f.H / 2 - h / 2;
  const kk = ease.outCubic(clamp((S.t - 0.1) / 0.6)), dy = (1 - kk) * f.H * 0.6;
  piece(ctx, { x, y, w, h }, (c) => {
    if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(0, dy);
    c.shadowColor = 'rgba(0,0,0,0.22)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 14 * u;
    c.fillStyle = '#ffffff'; roundRect(c, x, y, w, h, 26 * u); c.fill(); c.shadowColor = 'transparent';
    c.save(); roundRect(c, x, y, w, h, 26 * u); c.clip(); c.fillStyle = k.acc; c.fillRect(x, y, w, head); if (stub) { c.fillStyle = rgba(k.acc, 0.12); c.fillRect(x + mw, y + head, stub, h - head); } c.restore();
    if (stub) { c.setLineDash([12 * u, 10 * u]); c.strokeStyle = 'rgba(17,24,39,0.3)'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(x + mw, y + head + 16 * u); c.lineTo(x + mw, y + h - 16 * u); c.stroke(); c.setLineDash([]); }
    drawText(c, S, tx(S, 0), x + pad, y + head / 2 + 2 * u, { ...TY.label, color: k.on, align: 'left', maxWidth: (w - pad * 2 - 80 * u) / S.W, ...still0 });
    glyph(c, 'plane', x + w - pad - 26 * u, y + head / 2, 26 * u, k.on, 1, u);
    const cy = y + head + pad + mC.h / 2, half = (mw - pad * 2) / 2;
    [[tx(S, 1), tx(S, 2), x + pad, 'left'], [tx(S, 3), tx(S, 4), x + mw - pad, 'right']].forEach(([code, city, xx, al], i) => {
      const a = clamp((S.t - 0.6 - i * 0.2) / 0.4);
      drawText(c, S, code, xx, cy, { ...codeO, color: '#111827', align: al, maxWidth: (half - 70 * u) / S.W, ...still0, alpha: a });
      drawText(c, S, city, xx, cy + mC.h / 2 + 34 * u, { ...sized(TY.strong, 32), color: '#6b7280', align: al, maxWidth: (half - 70 * u) / S.W, ...still0, alpha: a });
    });
    const pk = kin(S, 0.7, 0.9, ease.inOutCubic);
    c.strokeStyle = 'rgba(17,24,39,0.25)'; c.setLineDash([8 * u, 10 * u]); c.lineWidth = 3 * u; c.beginPath(); c.moveTo(x + mw / 2 - 60 * u, cy); c.lineTo(x + mw / 2 + 60 * u, cy); c.stroke(); c.setLineDash([]);
    glyph(c, 'plane', x + mw / 2 - 60 * u + 120 * u * pk, cy, 28 * u, k.acc, 1, u);
    const ry = y + h - pad - 55 * u, colW = (mw - pad * 2) / 3;
    [0, 1, 2].forEach((i) => {
      const a = clamp((S.t - 1.1 - i * 0.12) / 0.3), rx = x + pad + colW * i;
      drawText(c, S, tx(S, 5 + i * 2), rx, ry - 22 * u, { ...sized(TY.label, 22), color: '#6b7280', align: 'left', maxWidth: (colW - 20 * u) / S.W, ...still0, alpha: a });
      drawText(c, S, tx(S, 6 + i * 2), rx, ry + 26 * u, { ...sized(TY.head, 44), color: '#111827', align: 'left', maxWidth: (colW - 20 * u) / S.W, ...still0, alpha: a });
    });
    if (stub) { const sx = x + mw + stub / 2; for (let i = 0; i < 9; i++) c.fillRect(sx - 60 * u + i * 14 * u, y + head + 60 * u, (i % 3 ? 6 : 10) * u, h - head - 120 * u); }
    c.restore();
  });
}

// Postcard: a postcard flips round with "Greetings from" and the place in big letters.
function postcard(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, f.tall ? cw : 1250 * u), h = w * (f.tall ? 0.75 : 0.6), x = f.W / 2 - w / 2, y = f.H / 2 - h / 2;
  const po = { ...sized(TY.big, f.tall ? 120 : f.square ? 110 : 170), font: 'Bebas Neue', fontFixed: true, weight: 400 };
  piece(ctx, { x, y, w, h }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.7)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(f.W / 2, f.H / 2); c.rotate(-0.04 * kk); c.scale(Math.max(0.02, Math.min(1, kk)), 1); c.translate(-f.W / 2, -f.H / 2);
    c.shadowColor = 'rgba(0,0,0,0.2)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 14 * u;
    c.fillStyle = '#fffdf7'; roundRect(c, x, y, w, h, 14 * u); c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = k.acc2; c.lineWidth = 5 * u; c.setLineDash([22 * u, 12 * u]); roundRect(c, x + 16 * u, y + 16 * u, w - 32 * u, h - 32 * u, 8 * u); c.stroke(); c.setLineDash([]);
    const sw = w * 0.13, sh = sw * 1.2; c.fillStyle = rgba(k.acc, 0.2); c.fillRect(x + w - sw - 44 * u, y + 44 * u, sw, sh); c.strokeStyle = k.acc; c.lineWidth = 3 * u; c.strokeRect(x + w - sw - 44 * u, y + 44 * u, sw, sh);
    glyph(c, 'sun', x + w - sw / 2 - 44 * u, y + 44 * u + sh / 2, sw * 0.3, k.acc, 1, u);
    if (kk > 0.6) {
      const a = clamp((kk - 0.6) / 0.4), inner = (w - sw - 160 * u) / S.W;
      drawText(c, S, tx(S, 0), x + 60 * u, y + h * 0.3, { ...HAND, size: f.tall ? 56 : 62, color: '#4b5563', align: 'left', maxWidth: inner, ...still0, alpha: a });
      const g = c.createLinearGradient(0, y + h * 0.4, 0, y + h * 0.75); g.addColorStop(0, k.acc); g.addColorStop(1, k.acc2);
      drawText(c, S, tx(S, 1), x + 60 * u, y + h * 0.58, { ...po, color: g, align: 'left', maxWidth: (w - 120 * u) / S.W, ...still0, alpha: a });
      drawText(c, S, tx(S, 2), x + 60 * u, y + h * 0.84, { ...HAND, size: f.tall ? 46 : 52, color: '#4b5563', align: 'left', maxWidth: (w - 120 * u) / S.W, ...still0, alpha: clamp((S.t - 1.2) / 0.4) });
    }
    c.restore();
  });
}

// Flight Path: a dotted arc draws from one city to the other with a plane flying along it.
function flightPath(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const to = { ...SCRIPT, size: big(f, 120) }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to), arcH = (f.tall ? 380 : f.square ? 260 : 300) * u;
  column(f, [
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.1, maxWidth: mw })],
    [arcH + 70 * u, (y) => {
      const ax = x0 + 60 * u, bx = x0 + cw - 60 * u, by = y + arcH, top = y + 30 * u;
      const P = (p) => { const x = lerp(ax, bx, p); return [x, by - Math.sin(Math.PI * p) * (by - top)]; };
      piece(ctx, { x: x0, y, w: cw, h: arcH + 20 * u }, (c) => {
        const kk = kin(S, 0.5, 1.6, ease.inOutCubic); if (S.t < 0.4) return;
        c.globalAlpha = fo(S); c.fillStyle = k.dark ? '#ffffff' : rgba(k.ink, 0.6);
        for (let p = 0; p <= kk; p += 0.022) { const [x, yy] = P(p); c.beginPath(); c.arc(x, yy, 4 * u, 0, Math.PI * 2); c.fill(); }
        for (const [x, yy] of [[ax, by], [bx, by]]) { c.fillStyle = k.acc; c.beginPath(); c.arc(x, yy, 14 * u, 0, Math.PI * 2); c.fill(); }
        const [px, py] = P(kk), [qx, qy] = P(Math.min(1, kk + 0.01)), ang = Math.atan2(qy - py, qx - px);
        c.save(); c.translate(px, py); c.rotate(kk >= 1 ? 0 : ang); glyph(c, 'plane', 0, 0, 34 * u, k.acc2, 1, u); c.restore();
      });
      animText(ctx, S, tx(S, 1), ax, by + 50 * u, { ...sized(TY.head, 40), color: k.ink, anim: 'fade', delay: 0.5, maxWidth: (cw * 0.45) / f.W });
      animText(ctx, S, tx(S, 2), bx, by + 50 * u, { ...sized(TY.head, 40), color: k.ink, anim: 'fade', delay: 1.8, maxWidth: (cw * 0.45) / f.W });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 3), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 2.0, maxWidth: mw })],
  ], 30 * u);
}

// Road Trip: a road runs towards you with its centre line moving, under the title.
function roadTrip(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), hz = f.H * (f.tall ? 0.6 : 0.55);
  piece(ctx, { x: 0, y: hz, w: f.W, h: f.H - hz }, (c) => {
    const kk = kin(S, 0, 0.6); if (kk <= 0) return;
    c.globalAlpha = fo(S) * kk;
    c.fillStyle = 'rgba(20,20,24,0.88)'; c.beginPath(); c.moveTo(f.W / 2 - f.W * 0.04, hz); c.lineTo(f.W / 2 + f.W * 0.04, hz); c.lineTo(f.W * 0.98, f.H); c.lineTo(f.W * 0.02, f.H); c.closePath(); c.fill();
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const p = ((i / 8 + S.t * 0.35) % 1), p2 = Math.min(1, p + 0.05), e = (q) => q * q;
      const y1 = lerp(hz, f.H, e(p)), y2 = lerp(hz, f.H, e(p2)), w1 = lerp(2, 18, e(p)) * u, w2 = lerp(2, 18, e(p2)) * u;
      c.beginPath(); c.moveTo(f.W / 2 - w1, y1); c.lineTo(f.W / 2 + w1, y1); c.lineTo(f.W / 2 + w2, y2); c.lineTo(f.W / 2 - w2, y2); c.closePath(); c.fill();
    }
  });
  const b = block(ctx, S, [
    { pill: tx(S, 2), o: sized(TY.label, 28), bg: k.acc, ink: k.on, h: 56, delay: 0.9 },
    { text: tx(S, 0), o: { ...sized(TY.big, big(f, 140)), font: 'Bebas Neue', fontFixed: true, weight: 400 }, color: k.ink, gap: 20, delay: 0.3 },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 48 : 52), color: k.ink, gap: 16, anim: 'fade', delay: 0.8 },
  ], cw);
  b.draw(f.W / 2, Math.max(f.my * 0.8, hz * 0.5 - b.h / 2), 'center');
}

// Compass: the needle swings and settles on north, beside the title.
function compass(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 220 : f.square ? 160 : 220) * u;
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: f.square ? 60 : 90 }, () => [
    { text: tx(S, 0), o: sized(TY.big, big(f, 110)), color: k.ink, delay: 0.5 },
    { text: tx(S, 1), o: TY.body, color: k.muted, gap: 22, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.05) / 0.6)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.scale(kk, kk);
    c.fillStyle = k.dark ? 'rgba(255,255,255,0.08)' : '#ffffff'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = k.ink; c.lineWidth = 8 * u; c.beginPath(); c.arc(0, 0, R - 4 * u, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, l = i % 9 ? 0.06 : 0.12; c.lineWidth = (i % 9 ? 2 : 5) * u; c.beginPath(); c.moveTo(Math.sin(a) * R * 0.86, -Math.cos(a) * R * 0.86); c.lineTo(Math.sin(a) * R * (0.86 - l), -Math.cos(a) * R * (0.86 - l)); c.stroke(); }
    [2, 3, 4, 5].forEach((ti, i) => { const a = (i / 4) * Math.PI * 2; drawText(c, S, tx(S, ti), Math.sin(a) * R * 0.6, -Math.cos(a) * R * 0.6 + 4 * u, { ...sized(TY.head, (R / u) * 0.16), color: i ? k.ink : k.acc, align: 'center', maxWidth: (R * 0.3) / S.W, ...still0 }); });
    const swing = Math.sin(S.t * 5) * Math.exp(-S.t * 1.4) * 1.6 + (1 - kin(S, 0, 1.2, ease.outCubic)) * 3;
    c.rotate(swing);
    c.fillStyle = k.acc; c.beginPath(); c.moveTo(0, -R * 0.42); c.lineTo(R * 0.08, 0); c.lineTo(-R * 0.08, 0); c.closePath(); c.fill();
    c.fillStyle = rgba(k.ink, 0.55); c.beginPath(); c.moveTo(0, R * 0.42); c.lineTo(R * 0.08, 0); c.lineTo(-R * 0.08, 0); c.closePath(); c.fill();
    c.fillStyle = k.ink; c.beginPath(); c.arc(0, 0, 12 * u, 0, Math.PI * 2); c.fill();
    c.restore();
  }));
}

// Mountain Sunrise: three ridges rise one after another in front of a low sun, under the title.
function peaks(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), base = f.H, top = f.H * (f.tall ? 0.55 : 0.5);
  piece(ctx, { x: 0, y: top - f.H * 0.12, w: f.W, h: base - top + f.H * 0.12 }, (c) => {
    c.globalAlpha = fo(S);
    const ks = kin(S, 0.1, 1.4, ease.outCubic); c.fillStyle = '#f6bd60'; c.beginPath(); c.arc(f.W * 0.72, top + f.H * 0.16 - ks * f.H * 0.08, Math.min(f.W, f.H) * 0.1, 0, Math.PI * 2); c.fill();
    const layers = [[rgba(k.acc, 0.35), 0.0, 0.35], [rgba(k.acc, 0.6), 0.25, 0.22], [k.acc, 0.5, 0.1]];
    layers.forEach(([col, d, hgt], j) => {
      const kk = kin(S, d, 0.9, ease.outCubic); if (kk <= 0) return;
      const yb = top + (base - top) * hgt + (1 - kk) * (base - top), pts = 7;
      c.fillStyle = col; c.beginPath(); c.moveTo(0, base);
      for (let i = 0; i <= pts; i++) { const x = (i / pts) * f.W, hh = ((i * 37 + j * 13) % 10) / 10; c.lineTo(x, yb + (i % 2 ? (base - top) * 0.25 : -(base - top) * 0.12 * hh)); }
      c.lineTo(f.W, base); c.closePath(); c.fill();
    });
  });
  const b = block(ctx, S, [
    label(tx(S, 2), k, 0.8),
    { text: tx(S, 0), o: sized(TY.big, big(f, 130)), color: k.ink, gap: 18, delay: 0.6 },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 46 : 50), color: k.muted, gap: 16, anim: 'fade', delay: 1.0 },
  ], cw);
  b.draw(f.W / 2, Math.max(f.my * 0.7, (f.my + top - f.H * 0.1) / 2 - b.h / 2), 'center');
}

// Map Unfold: three map panels open out one after another, a pin drops, beside the title.
function mapFold(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = f.tall ? cw : Math.min(cw * (f.square ? 0.42 : 0.48), 720 * u), mh = mw * 0.72;
  beside(ctx, S, f, { vw: mw, vh: mh, gap: f.square ? 50 : 80 }, () => [
    label(tx(S, 2), k, 0.9),
    { text: tx(S, 0), o: sized(TY.big, big(f, 110)), color: k.ink, gap: 16, delay: 1.0 },
    { text: tx(S, 1), o: TY.body, color: k.muted, gap: 20, anim: 'fade', delay: 1.3 },
  ], (cx, cy) => piece(ctx, { x: cx - mw / 2, y: cy - mh / 2, w: mw, h: mh }, (c) => {
    c.globalAlpha = fo(S); const pw = mw / 3, x0 = cx - mw / 2, y0 = cy - mh / 2;
    for (let i = 0; i < 3; i++) {
      const kk = kin(S, 0.1 + i * 0.25, 0.4, ease.outCubic); if (kk <= 0) continue;
      const px = x0 + pw * i;
      c.save(); c.beginPath(); c.rect(px, y0, pw * kk, mh); c.clip();
      c.fillStyle = i % 2 ? '#f3efe2' : '#faf7ee'; c.fillRect(px, y0, pw, mh);
      c.fillStyle = 'rgba(42,157,143,0.18)'; c.beginPath(); c.ellipse(x0 + mw * 0.3, y0 + mh * 0.45, mw * 0.22, mh * 0.3, 0.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x0 + mw * 0.75, y0 + mh * 0.6, mw * 0.2, mh * 0.25, -0.3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba(k.acc, 0.8); c.lineWidth = 4 * u; c.setLineDash([10 * u, 9 * u]); c.beginPath(); c.moveTo(x0 + mw * 0.1, y0 + mh * 0.8); c.bezierCurveTo(x0 + mw * 0.35, y0 + mh * 0.2, x0 + mw * 0.55, y0 + mh * 0.9, x0 + mw * 0.82, y0 + mh * 0.35); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(px + pw - 3 * u, y0, 3 * u, mh);
      c.restore();
    }
    const kp = ease.outBounce(clamp((S.t - 0.9) / 0.6)); if (kp > 0) glyph(c, 'pin', x0 + mw * 0.82, y0 + mh * 0.35 - 40 * u - (1 - kp) * 160 * u, 44 * u, k.acc, 1, u);
  }));
}

// Suitcase: a suitcase with travel stickers drops in and settles, beside the title.
function suitcase(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 190 : f.square ? 140 : 180) * u;
  beside(ctx, S, f, { vw: R * 2, vh: R * 2.1, gap: f.square ? 60 : 90 }, () => [
    { pill: tx(S, 2), o: sized(TY.label, 26), bg: k.acc2, ink: k.on, h: 52, delay: 0.8 },
    { text: tx(S, 0), o: { ...sized(TY.big, big(f, 130)), font: 'Bebas Neue', fontFixed: true, weight: 400 }, color: k.ink, gap: 20, delay: 0.6 },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 46 : 48), color: k.muted, gap: 14, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R * 1.05, w: R * 2, h: R * 2.1 }, (c) => {
    const kk = ease.outBounce(clamp((S.t - 0.05) / 0.8)); if (S.t < 0.05) return;
    const wob = Math.sin(S.t * 8) * Math.exp(-S.t * 2) * 0.08;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy + R * 0.9 - (1 - kk) * -f.H * 0.0 - (1 - kk) * R * 2); c.rotate(wob); c.translate(0, -R * 0.9);
    const w = R * 1.7, h = R * 1.3;
    c.strokeStyle = rgba(k.ink, 0.8); c.lineWidth = 14 * u; roundRect(c, -R * 0.3, -h / 2 - R * 0.32, R * 0.6, R * 0.4, 14 * u); c.stroke();
    c.fillStyle = k.acc; roundRect(c, -w / 2, -h / 2, w, h, 26 * u); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(-w * 0.28, -h / 2, 14 * u, h); c.fillRect(w * 0.28 - 14 * u, -h / 2, 14 * u, h);
    [[-0.25, -0.15, k.acc2, 0.2], [0.18, 0.18, '#ffffff', 0.16], [0.3, -0.22, '#ffd166', 0.12]].forEach(([sx, sy, col, sr], i) => { const ks = ease.outBack(clamp((S.t - 0.7 - i * 0.15) / 0.3)); if (ks <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(w * sx, h * sy, R * sr * ks, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = rgba(k.ink, 0.7); c.beginPath(); c.arc(-w * 0.32, h / 2 + 10 * u, 12 * u, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(w * 0.32, h / 2 + 10 * u, 12 * u, 0, Math.PI * 2); c.fill();
    c.restore();
  }));
}

// Polaroids: three photos drop in at angles with handwritten captions, then the title.
function polaroids(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, n = 3;
  const pw = Math.min((cw - 40 * u) / 3, (f.tall ? 300 : 360) * u), ph = pw * 1.18, grads = [['#8ecae6', '#f6d6a8'], ['#e76f51', '#f4a261'], ['#3a0ca3', '#f72585']];
  const to = { ...SCRIPT, size: big(f, 110) }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [ph + 30 * u, (y) => { for (let i = 0; i < n; i++) {
      const cx = f.W / 2 + (i - 1) * (pw + 20 * u), cy = y + ph / 2 + 10 * u, d = 0.1 + i * 0.2, rot = [-0.08, 0.04, 0.09][i];
      piece(ctx, { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph }, (c) => {
        const kk = ease.outBack(clamp((S.t - d) / 0.5)); if (kk <= 0) return;
        c.globalAlpha = fo(S); c.save(); c.translate(cx, cy - (1 - Math.min(1, kk)) * 200 * u); c.rotate(rot * kk);
        c.shadowColor = 'rgba(0,0,0,0.22)'; c.shadowBlur = 24 * u; c.shadowOffsetY = 8 * u; c.fillStyle = '#ffffff'; c.fillRect(-pw / 2, -ph / 2, pw, ph); c.shadowColor = 'transparent';
        const m = pw * 0.07, iw = pw - m * 2, g = c.createLinearGradient(0, -ph / 2, 0, -ph / 2 + iw); g.addColorStop(0, grads[i][0]); g.addColorStop(1, grads[i][1]);
        c.fillStyle = g; c.fillRect(-pw / 2 + m, -ph / 2 + m, iw, iw);
        drawText(c, S, tx(S, 2 + i), 0, -ph / 2 + m + iw + (ph - iw - m) / 2, { ...HAND, size: (pw / u) * 0.14, color: '#374151', align: 'center', maxWidth: (iw * 0.95) / S.W, ...still0 });
        c.restore();
      });
    } }],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.9, maxWidth: mw })],
    [40 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.3, maxWidth: mw })],
  ], 30 * u);
}

// ================= mid-rolls =================

// Destination: a pin, the country, the place in big letters and a line about it.
function destination(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = 70 * u;
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: 40, tallGap: 40 }, () => [
    label(tx(S, 2), k, 0.4, { o: sized(TY.label, 30) }),
    { text: tx(S, 1), o: sized(TY.big, big(f, 140)), color: k.ink, gap: 16, delay: 0.5 },
    { text: tx(S, 3), o: sized(TY.body, 40), color: k.muted, gap: 22, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => iconDisc(ctx, S, 'pin', cx, cy, R, k.acc, k.on, 0.2));
  animText(ctx, S, tx(S, 0), area(f).x0, f.my, { ...TY.label, color: k.muted, align: 'left', anim: 'fade', delay: 0.1, maxWidth: area(f).cw / f.W });
}

// A list of rows with a mark on the left (tick, number or icon). rows: [{ text, sub, icon }].
function markList(ctx, S, f, k, { title, sub, rows, mark = 'tick', cols = 1, rowH = 92, icons, delay = 0.4 }) {
  const u = f.u, { cw, x0 } = area(f), n = rows.length, r = 28 * u, perCol = Math.ceil(n / cols), colW = (cw - (cols - 1) * 40 * u) / cols, rh = rowH * u;
  const hb = block(ctx, S, [label(sub, k), { text: title, o: sized(TY.title, f.tall ? 64 : 72), color: k.ink, gap: 14, delay: 0.2 }], cw);
  column(f, [
    [hb.h, (y) => hb.draw(x0, y, 'left')],
    [perCol * rh, (y) => rows.forEach((row, i) => {
      const cx = x0 + Math.floor(i / perCol) * (colW + 40 * u), cy = y + (i % perCol) * rh + rh / 2, d = delay + i * 0.15;
      if (mark === 'tick') piece(ctx, { x: cx, y: cy - r, w: r * 2, h: r * 2 }, (c) => { c.globalAlpha = fo(S); checkBadge(c, cx + r, cy, r, ease.outBack(clamp((S.t - d) / 0.35)), k.acc, k.on, u); });
      else if (mark === 'icon') iconDisc(ctx, S, icons[i], cx + r, cy, r, k.acc, k.on, d);
      else piece(ctx, { x: cx, y: cy - r, w: r * 2, h: r * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - d) / 0.35)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.acc; c.beginPath(); c.arc(cx + r, cy, r * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, String(i + 1), cx + r, cy + 2 * u, { ...sized(TY.num, 28), color: k.on, align: 'center', ...still0, alpha: Math.min(1, kk) }); });
      const tw = (colW - r * 2 - 26 * u) / f.W;
      animText(ctx, S, row.text, cx + r * 2 + 26 * u, row.sub ? cy - 18 * u : cy, { ...sized(TY.head, 40), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: tw });
      if (row.sub) animText(ctx, S, row.sub, cx + r * 2 + 26 * u, cy + 24 * u, { ...sized(TY.body, 30), color: k.muted, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: tw });
    })],
  ], 36 * u);
}

// Packing List: six things to pack, ticked off (two columns on wide frames).
const packing = (ctx, S) => { const f = frame(S), k = K(S); markList(ctx, S, f, k, { sub: '', title: tx(S, 0), rows: [1, 2, 3, 4, 5, 6].map((i) => ({ text: tx(S, i) })), cols: f.tall ? 1 : 2, rowH: f.tall ? 96 : 92 }); };

// Day Plan: the day on a tag, its theme, then morning, afternoon and evening with what happens.
function dayPlan(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), rowH = (f.tall ? 130 : 112) * u, R = 34 * u, icons = ['sun', 'sun', 'moon'];
  const hb = block(ctx, S, [{ pill: tx(S, 0), o: sized(TY.label, 28), bg: k.acc, ink: k.on, h: 56, delay: 0.1 }, { text: tx(S, 1), o: sized(TY.title, f.tall ? 62 : 72), color: k.ink, gap: 18, delay: 0.3 }], cw);
  column(f, [
    [hb.h, (y) => hb.draw(x0, y, 'left')],
    [rowH * 3, (y) => {
      growRect(ctx, x0 + R - 3 * u, y + rowH / 2, 6 * u, rowH * 2, kin(S, 0.5, 1.0, ease.inOutCubic), 'd', rgba(k.ink, 0.15), 3 * u, fo(S));
      for (let i = 0; i < 3; i++) {
        const cy = y + rowH * i + rowH / 2, d = 0.5 + i * 0.3, tw = (cw - R * 2 - 30 * u) / f.W;
        iconDisc(ctx, S, icons[i], x0 + R, cy, R, i === 2 ? rgba(k.ink, 0.85) : k.acc2, i === 2 ? (k.dark ? '#111827' : '#ffffff') : k.on, d);
        animText(ctx, S, tx(S, 2 + i * 2), x0 + R * 2 + 30 * u, cy - 20 * u, { ...sized(TY.label, 24), color: k.muted, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: tw });
        animText(ctx, S, tx(S, 3 + i * 2), x0 + R * 2 + 30 * u, cy + 20 * u, { ...sized(TY.head, 42), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: tw });
      }
    }],
  ], 34 * u);
}

// Local Phrase: the language, the phrase, how to say it, and what it means, with a speaker.
function phrase(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), R = 44 * u;
  const po = sized(TY.big, big(f, 140)), b = block(ctx, S, [
    { pill: tx(S, 4), o: sized(TY.label, 26), bg: k.acc2, ink: k.on, h: 52, delay: 0.2 },
    { text: tx(S, 1), o: po, color: k.ink, gap: 22, delay: 0.3 },
    { text: tx(S, 2), o: { font: 'Playfair Display', fontFixed: true, weight: 400, size: 44 }, color: k.acc, gap: 14, anim: 'fade', delay: 0.9 },
    { text: tx(S, 3), o: sized(TY.title, 52), color: k.muted, gap: 26, anim: 'fade', delay: 1.4 },
  ], cw - R * 2 - 30 * u);
  const y = f.H / 2 - b.h / 2;
  b.draw(x0, y, 'left');
  iconDisc(ctx, S, 'speaker', x0 + cw - R, y + 26 * u, R, k.acc, k.on, 0.6);
  animText(ctx, S, tx(S, 0), x0, Math.max(f.my * 0.7, y - 60 * u), { ...TY.label, color: k.muted, align: 'left', anim: 'fade', delay: 0.1, maxWidth: cw / f.W });
}

// Daily Budget: what each thing costs, a line, then the total.
function budget(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, 900 * u), x0 = f.W / 2 - w / 2, rowH = 84 * u, pad = 50 * u, n = 3;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h, h = pad * 2 + rowH * n + 30 * u + rowH;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: w / f.W })],
    [h, (y) => {
      card(ctx, S, { x: x0, y, w, h }, { color: k.surf, delay: 0.2, r: 24, border: k.dark ? null : rgba(k.ink, 0.08) });
      for (let i = 0; i < n; i++) {
        const cy = y + pad + rowH * i + rowH / 2, d = 0.4 + i * 0.2;
        animText(ctx, S, tx(S, 1 + i * 2), x0 + pad, cy, { ...sized(TY.strong, 40), color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (w * 0.55) / f.W });
        animText(ctx, S, tx(S, 2 + i * 2), x0 + w - pad, cy, { ...sized(TY.num, 40), color: k.ink, align: 'right', anim: 'fade', delay: d + 0.1, maxWidth: (w * 0.3) / f.W });
      }
      const ly = y + pad + rowH * n + 15 * u;
      line(ctx, x0 + pad, ly, x0 + w - pad, ly, kin(S, 1.1, 0.5) * fo(S), rgba(k.ink, 0.3), 3 * u);
      animText(ctx, S, tx(S, 7), x0 + pad, ly + 15 * u + rowH / 2, { ...sized(TY.head, 44), color: k.ink, align: 'left', anim: 'fade', delay: 1.3, maxWidth: (w * 0.5) / f.W });
      animText(ctx, S, tx(S, 8), x0 + w - pad, ly + 15 * u + rowH / 2, { ...sized(TY.num, 52), color: k.acc, align: 'right', anim: 'pop', delay: 1.4, maxWidth: (w * 0.35) / f.W });
    }],
  ], 34 * u);
}

// Travel Tip: a bulb on a coloured card with the tip beside it.
function travelTip(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 54 * u, R = 54 * u;
  const bo = sized(TY.title, f.tall ? 54 : 60), t = wrapO(ctx, S, tx(S, 1), bo, (cw - pad * 3 - R * 2) / f.W), mt = measure(ctx, S, t, bo);
  const h = Math.max(R * 2, 40 * u + 20 * u + mt.h) + pad * 2, y = f.H / 2 - h / 2;
  card(ctx, S, { x: x0, y, w: cw, h }, { color: rgba(k.acc, 0.12), delay: 0.1, r: 30, border: rgba(k.acc, 0.4) });
  iconDisc(ctx, S, 'bulb', x0 + pad + R, y + h / 2, R, k.acc, k.on, 0.3);
  const tx0 = x0 + pad * 2 + R * 2, ty = y + h / 2 - (40 * u + 20 * u + mt.h) / 2;
  animText(ctx, S, tx(S, 0), tx0, ty + 20 * u, { ...TY.label, color: k.acc, align: 'left', anim: 'fade', delay: 0.4, maxWidth: (cw - pad * 3 - R * 2) / f.W });
  animText(ctx, S, t, tx0, ty + 60 * u + mt.h / 2, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: 0.6, maxWidth: (cw - pad * 3 - R * 2) / f.W });
}

// Weather Check: a weather picture that follows the words, the temperature, and what to pack.
function weatherCheck(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 150 : f.square ? 110 : 140) * u, g = skyIcon(tx(S, 2));
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: f.square ? 50 : 70 }, () => [
    label(tx(S, 0), k, 0.3),
    { text: tx(S, 1), o: { ...sized(TY.big, big(f, 170)), fontFixed: true }, color: k.ink, gap: 10, delay: 0.4 },
    { text: tx(S, 2), o: sized(TY.title, 56), color: k.ink, gap: 6, delay: 0.6 },
    { text: tx(S, 3), o: TY.body, color: k.muted, gap: 20, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.fillStyle = k.dark ? 'rgba(255,255,255,0.08)' : '#ffffff'; c.beginPath(); c.arc(cx, cy, R * kk, 0, Math.PI * 2); c.fill();
    glyph(c, g, cx, cy + Math.sin(S.t * 2) * 6 * u, R * 0.75, g === 'sun' || g === 'bolt' ? '#f59e0b' : g === 'moon' ? '#fbbf24' : '#94a3b8', Math.min(1, kk), u);
  }));
}

// Getting There: each way to travel with its picture (from the words: fly, train, bus...) and how long.
function gettingThere(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 3, rowH = (f.tall ? 130 : 116) * u, R = 40 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const cy = y + rowH * i + rowH / 2, d = 0.4 + i * 0.25;
      card(ctx, S, { x: x0, y: cy - rowH / 2 + 8 * u, w: cw, h: rowH - 16 * u }, { color: k.surf, delay: d, r: 20, border: k.dark ? null : rgba(k.ink, 0.07) });
      iconDisc(ctx, S, modeIcon(tx(S, 1 + i * 2)), x0 + 30 * u + R, cy, R, i ? k.acc2 : k.acc, k.on, d + 0.1);
      animText(ctx, S, tx(S, 1 + i * 2), x0 + 30 * u + R * 2 + 26 * u, cy, { ...sized(TY.head, 44), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: (cw * 0.45) / f.W });
      animText(ctx, S, tx(S, 2 + i * 2), x0 + cw - 34 * u, cy, { ...sized(TY.num, 38), color: k.acc, align: 'right', anim: 'fade', delay: d + 0.25, maxWidth: (cw * 0.35) / f.W });
    } }],
  ], 36 * u);
}

// Three cards in a row (one under another on tall frames), each with a number or icon, a name and a line.
function threeCards(ctx, S, { icon }) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), across = !f.tall && !f.square, gap = 26 * u, pw = across ? (cw - gap * 2) / 3 : cw, ph = across ? 330 * u : 180 * u, R = 46 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? ph : ph * 3 + gap * 2, (y) => { for (let i = 0; i < 3; i++) {
      const bx = across ? x0 + i * (pw + gap) : x0, by = across ? y : y + i * (ph + gap), d = 0.3 + i * 0.2;
      card(ctx, S, { x: bx, y: by, w: pw, h: ph }, { color: k.surf, delay: d, r: 24, border: k.dark ? null : rgba(k.ink, 0.07) });
      const ix = across ? bx + 40 * u + R : bx + 36 * u + R, iy = across ? by + 40 * u + R : by + ph / 2;
      if (icon) iconDisc(ctx, S, icon, ix, iy, R, k.acc, k.on, d + 0.15);
      else piece(ctx, { x: ix - R, y: iy - R, w: R * 2, h: R * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - d - 0.15) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.acc; c.beginPath(); c.arc(ix, iy, R * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, String(i + 1), ix, iy + 2 * u, { ...sized(TY.num, 40), color: k.on, align: 'center', ...still0, alpha: Math.min(1, kk) }); });
      const tx0 = across ? bx + 40 * u : bx + 36 * u + R * 2 + 28 * u, tw = (across ? pw - 80 * u : pw - (tx0 - bx) - 30 * u) / f.W;
      animText(ctx, S, tx(S, 1 + i * 2), tx0, across ? by + ph - 110 * u : by + ph / 2 - 22 * u, { ...sized(TY.head, 42), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.25, maxWidth: tw });
      animText(ctx, S, tx(S, 2 + i * 2), tx0, across ? by + ph - 58 * u : by + ph / 2 + 26 * u, { ...sized(TY.body, 32), color: k.muted, align: 'left', anim: 'fade', delay: d + 0.35, maxWidth: tw });
    } }],
  ], 40 * u);
}

// Good to Know: three facts with icons (money, plugs, language).
function goodToKnow(ctx, S) {
  const f = frame(S), k = K(S);
  markList(ctx, S, f, k, { sub: '', title: tx(S, 0), mark: 'icon', icons: ['gem', 'bolt', 'chat'], rows: [0, 1, 2].map((i) => ({ text: tx(S, 2 + i * 2), sub: tx(S, 1 + i * 2) })), rowH: f.tall ? 130 : 118 });
}

// Time Difference: two clocks whose hands follow the times typed under them, and the gap between.
function timeZones(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), side = !f.tall, R = (side ? (f.square ? 130 : 170) : 160) * u;
  const clockAt = (cx, cy, time, d) => {
    const [hh, mm] = (String(time).match(/\d+/g) || ['0', '0']).map(Number);
    piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
      const kk = ease.outBack(clamp((S.t - d) / 0.5)); if (kk <= 0) return;
      c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.scale(kk, kk);
      const night = (hh % 24) >= 19 || (hh % 24) < 6;
      c.fillStyle = night ? '#1e293b' : '#ffffff'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = night ? '#ffffff' : '#111827'; c.lineWidth = 7 * u; c.beginPath(); c.arc(0, 0, R - 4 * u, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.lineWidth = (i % 3 ? 3 : 6) * u; c.beginPath(); c.moveTo(Math.sin(a) * R * 0.78, -Math.cos(a) * R * 0.78); c.lineTo(Math.sin(a) * R * 0.88, -Math.cos(a) * R * 0.88); c.stroke(); }
      const p = kin(S, d + 0.2, 1.2, ease.inOutCubic), ha = (((hh % 12) + (mm || 0) / 60) / 12) * Math.PI * 2 * p, ma = ((mm || 0) / 60) * Math.PI * 2 * p;
      c.lineCap = 'round'; c.lineWidth = 10 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ha) * R * 0.48, -Math.cos(ha) * R * 0.48); c.stroke();
      c.strokeStyle = k.acc; c.lineWidth = 6 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ma) * R * 0.72, -Math.cos(ma) * R * 0.72); c.stroke();
      c.fillStyle = k.acc; c.beginPath(); c.arc(0, 0, 10 * u, 0, Math.PI * 2); c.fill();
      c.restore();
    });
  };
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h, gap = side ? cw - R * 4 : 0;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? R * 2 + 110 * u : (R * 2 + 110 * u) * 2 + 40 * u, (y) => [0, 1].forEach((i) => {
      const cx = side ? x0 + R + i * (R * 2 + gap) : f.W / 2, cy = side ? y + R : y + R + i * (R * 2 + 150 * u), d = 0.3 + i * 0.3;
      clockAt(cx, cy, tx(S, 2 + i * 2), d);
      animText(ctx, S, tx(S, 1 + i * 2), cx, cy + R + 40 * u, { ...sized(TY.head, 40), color: k.ink, anim: 'fade', delay: d + 0.3, maxWidth: (R * 2.4) / f.W });
      animText(ctx, S, tx(S, 2 + i * 2), cx, cy + R + 86 * u, { ...sized(TY.num, 32), color: k.muted, anim: 'fade', delay: d + 0.4, maxWidth: (R * 2.4) / f.W });
    })],
    [56 * u, (y) => pill(ctx, S, tx(S, 5), f.W / 2, y + 28 * u, { o: sized(TY.num, 32), bg: k.acc, ink: k.on, align: 'center', h: 60, delay: 1.4, maxW: cw })],
  ], 34 * u);
  if (side) piece(ctx, { x: x0 + R * 2 + 20 * u, y: f.H / 2 - 20 * u, w: gap - 40 * u, h: 40 * u }, (c) => { const kk = kin(S, 0.9, 0.6, ease.inOutCubic); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = rgba(k.ink, 0.35); for (let x = x0 + R * 2 + 40 * u; x < x0 + R * 2 + 40 * u + (gap - 80 * u) * kk; x += 22 * u) { c.beginPath(); c.arc(x, f.H / 2 - (34 + 72) * u / 2 + 28 * u, 5 * u, 0, Math.PI * 2); c.fill(); } });
}

// Hidden Gem: a gem in a ring, the place and why it is worth finding.
function hiddenGem(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 150 : f.square ? 110 : 140) * u;
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: f.square ? 50 : 80 }, () => [
    label(tx(S, 0), k, 0.5),
    { text: tx(S, 1), o: sized(TY.big, big(f, 100)), color: k.ink, gap: 16, delay: 0.6 },
    { text: tx(S, 2), o: sized(TY.body, 40), color: k.muted, gap: 22, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.strokeStyle = k.acc2; c.lineWidth = 6 * u; c.beginPath(); c.arc(cx, cy, (R - 6 * u) * Math.min(1, kk), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kin(S, 0.3, 1.0)); c.stroke();
    c.fillStyle = rgba(k.acc2, 0.15); c.beginPath(); c.arc(cx, cy, (R - 26 * u) * kk, 0, Math.PI * 2); c.fill();
    glyph(c, 'gem', cx, cy + Math.sin(S.t * 2) * 5 * u, R * 0.5, k.acc2, Math.min(1, kk), u);
  }));
}

// Today's Drive: two towns joined by a dotted road, a car dot driving between them, and the distance.
function route(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), side = !f.tall, R = 26 * u;
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h, len = side ? cw - 200 * u : f.H * 0.32;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? 200 * u : len + 160 * u, (y) => {
      const ax = side ? x0 + 100 * u : f.W / 2, ay = side ? y + 70 * u : y + 50 * u, bx = side ? ax + len : ax, by = side ? ay : ay + len;
      piece(ctx, { x: Math.min(ax, bx) - 40 * u, y: Math.min(ay, by) - 40 * u, w: Math.abs(bx - ax) + 80 * u, h: Math.abs(by - ay) + 80 * u }, (c) => {
        const kk = kin(S, 0.4, 1.4, ease.inOutCubic); if (S.t < 0.3) return;
        c.globalAlpha = fo(S); c.fillStyle = rgba(k.ink, 0.35);
        const n = Math.floor(len / (24 * u)); for (let i = 0; i <= n * kk; i++) { const p = i / n; c.beginPath(); c.arc(lerp(ax, bx, p), lerp(ay, by, p), 5 * u, 0, Math.PI * 2); c.fill(); }
        for (const [x, yy] of [[ax, ay], [bx, by]]) { c.fillStyle = k.acc; c.beginPath(); c.arc(x, yy, R, 0, Math.PI * 2); c.fill(); c.fillStyle = k.on; c.beginPath(); c.arc(x, yy, R * 0.4, 0, Math.PI * 2); c.fill(); }
        const cx = lerp(ax, bx, kk), cy = lerp(ay, by, kk); c.fillStyle = k.acc2; roundRect(c, cx - 22 * u, cy - 14 * u, 44 * u, 28 * u, 10 * u); c.fill();
      });
      const lo = sized(TY.head, 44);
      if (side) { animText(ctx, S, tx(S, 1), ax, ay + 70 * u, { ...lo, color: k.ink, anim: 'fade', delay: 0.4, maxWidth: (len * 0.45) / f.W }); animText(ctx, S, tx(S, 2), bx, by + 70 * u, { ...lo, color: k.ink, anim: 'fade', delay: 1.6, maxWidth: (len * 0.45) / f.W }); }
      else { animText(ctx, S, tx(S, 1), ax + R + 30 * u, ay, { ...lo, color: k.ink, align: 'left', anim: 'fade', delay: 0.4, maxWidth: (cw / 2 - R - 30 * u) / f.W }); animText(ctx, S, tx(S, 2), bx + R + 30 * u, by, { ...lo, color: k.ink, align: 'left', anim: 'fade', delay: 1.6, maxWidth: (cw / 2 - R - 30 * u) / f.W }); }
    }],
    [56 * u, (y) => pill(ctx, S, tx(S, 3), f.W / 2, y + 28 * u, { o: sized(TY.strong, 32), bg: k.acc, ink: k.on, align: 'center', h: 60, delay: 1.8, maxW: cw })],
  ], 34 * u);
}

// Checked In: a key card, then the place you are staying and for how long.
function checkIn(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), cwid = (f.tall ? 420 : f.square ? 300 : 400) * u, ch = cwid * 0.63;
  beside(ctx, S, f, { vw: cwid, vh: ch, gap: f.square ? 50 : 80 }, () => [
    label(tx(S, 0), k, 0.6),
    { text: tx(S, 1), o: sized(TY.big, big(f, 90)), color: k.ink, gap: 16, delay: 0.7 },
    { pill: tx(S, 2), o: sized(TY.strong, 32), bg: k.acc2, ink: k.on, h: 58, gap: 22, delay: 1.1 },
  ], (cx, cy) => piece(ctx, { x: cx - cwid / 2, y: cy - ch / 2, w: cwid, h: ch }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.rotate(-0.08 * kk); c.scale(kk, kk);
    const g = c.createLinearGradient(-cwid / 2, -ch / 2, cwid / 2, ch / 2); g.addColorStop(0, k.acc); g.addColorStop(1, k.acc2);
    c.fillStyle = g; roundRect(c, -cwid / 2, -ch / 2, cwid, ch, 22 * u); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-cwid / 2, -ch * 0.18, cwid, ch * 0.16);
    glyph(c, 'key', -cwid * 0.22, ch * 0.24, ch * 0.18, '#ffffff', 1, u);
    c.restore();
  }));
}

// Photo Spot: camera corners round the picture, a camera, the place and the best time to go.
function photoSpot(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = 60 * u, m = (f.tall ? 70 : 60) * u, a = 80 * u;
  piece(ctx, { x: m, y: m, w: f.W - m * 2, h: f.H - m * 2 }, (c) => {
    const kk = kin(S, 0.1, 0.5, ease.outCubic); if (kk <= 0) return;
    c.globalAlpha = fo(S) * kk; c.strokeStyle = k.ink; c.lineWidth = 6 * u; c.lineCap = 'round';
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [f.W - m, m, -1, 1], [m, f.H - m, 1, -1], [f.W - m, f.H - m, -1, -1]]) { c.beginPath(); c.moveTo(x, y + dy * a * kk); c.lineTo(x, y); c.lineTo(x + dx * a * kk, y); c.stroke(); }
    c.lineWidth = 3 * u; c.beginPath(); c.moveTo(f.W / 2 - 30 * u, f.H / 2); c.lineTo(f.W / 2 + 30 * u, f.H / 2); c.moveTo(f.W / 2, f.H / 2 - 30 * u); c.lineTo(f.W / 2, f.H / 2 + 30 * u); c.globalAlpha = fo(S) * kk * 0.35; c.stroke();
  });
  beside(ctx, S, f, { vw: R * 2, vh: R * 2, gap: 40, tallGap: 40 }, () => [
    label(tx(S, 0), k, 0.4),
    { text: tx(S, 1), o: sized(TY.big, big(f, 110)), color: k.ink, gap: 14, delay: 0.5 },
    { text: tx(S, 2), o: sized(TY.strong, 38), color: k.muted, gap: 20, anim: 'fade', delay: 0.9 },
  ], (cx, cy) => iconDisc(ctx, S, 'camera', cx, cy, R, k.acc, k.on, 0.3));
}

// Before You Go: a passport and the things to check before travelling, ticked.
const beforeGo = (ctx, S) => { const f = frame(S), k = K(S); markList(ctx, S, f, k, { sub: '', title: tx(S, 0), rows: [1, 2, 3].map((i) => ({ text: tx(S, i) })), rowH: f.tall ? 110 : 100 }); };

// Day Recap: the day, "Highlights", and three moments ticked off.
const dayRecap = (ctx, S) => { const f = frame(S), k = K(S); markList(ctx, S, f, k, { sub: tx(S, 0), title: tx(S, 1), rows: [2, 3, 4].map((i) => ({ text: tx(S, i) })), mark: 'tick', rowH: f.tall ? 110 : 100 }); };

// Next Stop: an arrow slides across, then the next place and how you get there.
function nextStop(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const to = sized(TY.big, big(f, 170)), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to), ah = 70 * u;
  column(f, [
    [ah, (y) => {
      const kk = kin(S, 0.1, 0.7, ease.outExpo), w = Math.min(cw, 520 * u);
      piece(ctx, { x: x0, y, w, h: ah }, (c) => { if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.acc; const e = x0 + w * kk; c.fillRect(x0, y + ah * 0.35, Math.max(0, e - x0 - ah * 0.6), ah * 0.3); c.beginPath(); c.moveTo(e, y + ah / 2); c.lineTo(e - ah * 0.7, y); c.lineTo(e - ah * 0.7, y + ah); c.closePath(); c.fill(); });
    }],
    [30 * u, (y) => animText(ctx, S, tx(S, 0), x0, y + 15 * u, { ...TY.label, color: k.acc, align: 'left', anim: 'fade', delay: 0.4, maxWidth: mw })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'left', delay: 0.5, maxWidth: mw })],
    [44 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 22 * u, { ...sized(TY.strong, 42), color: k.muted, align: 'left', anim: 'fade', delay: 1.0, maxWidth: mw })],
  ], 26 * u);
}

// Our Rating: the place, five stars filled to the score typed (out of 5), and the verdict.
function rating(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, score = clamp(numOf(tx(S, 2), 4) / 5), sr = (f.tall ? 52 : 60) * u, sg = sr * 2.4;
  const to = sized(TY.big, big(f, 96)), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const vo = sized(TY.title, f.tall ? 44 : 48), v = wrapO(ctx, S, tx(S, 3), vo, mw), mv = measure(ctx, S, v, vo);
  column(f, [
    [30 * u, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + 15 * u, { ...TY.label, color: k.acc, anim: 'fade', delay: 0.1, maxWidth: mw })],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.2, maxWidth: mw })],
    [sr * 2, (y) => piece(ctx, { x: f.W / 2 - sg * 2.5, y, w: sg * 5, h: sr * 2 }, (c) => {
      c.globalAlpha = fo(S);
      for (let i = 0; i < 5; i++) { const kk = ease.outBack(clamp((S.t - 0.6 - i * 0.12) / 0.35)); if (kk <= 0) continue; const fill = clamp(score * 5 - i); c.save(); c.translate(f.W / 2 + (i - 2) * sg, y + sr); c.scale(kk, kk); star(c, 0, 0, sr, fill, '#f59e0b', rgba(k.ink, 0.15)); c.restore(); }
    })],
    [56 * u, (y) => pill(ctx, S, `${tx(S, 2)} / 5`, f.W / 2, y + 28 * u, { o: sized(TY.num, 30), bg: k.acc, ink: k.on, align: 'center', h: 56, delay: 1.3, maxW: cw })],
    [mv.h, (y) => animText(ctx, S, v, f.W / 2, y + mv.h / 2, { ...vo, color: k.muted, anim: 'fade', delay: 1.5, maxWidth: mw })],
  ], 28 * u);
}

// ================= the list =================
const sw = [['sfx-swipe', 0.1]], pop = [['sfx-pop', 0.15]], wh = [['sfx-whoosh', 0.1]];
seq('stamp', 'Passport Stamp', 'intro', 'paper', { sfx: [['sfx-hit', 0.3]], texts: ['Lisbon', '12 · 05 · 2026', 'Travel Diary', 'Five days on the Atlantic coast'] }, stampOpen);
seq('stamp-end', 'Passport Stamp Sign-off', 'outro', 'paper', { sfx: [['sfx-hit', 0.3]], texts: ['Home', '19 · 05 · 2026', 'Until Next Time', 'Thanks for travelling with us'] }, stampOpen);
seq('boarding', 'Boarding Pass', 'intro', 'sky', { sfx: [['sfx-whoosh', 0.1], ['sfx-ding', 1.2]], texts: ['Boarding pass', 'NYC', 'New York', 'LIS', 'Lisbon', 'Flight', 'CR 202', 'Gate', 'B12', 'Seat', '14A'] }, boarding);
seq('boarding-end', 'Boarding Pass Sign-off', 'outro', 'sky', { sfx: wh, texts: ['Thanks for flying with us', 'LIS', 'Lisbon', 'NYC', 'New York', 'Flight', 'CR 203', 'Gate', 'A4', 'Seat', '22C'] }, boarding);
seq('postcard', 'Postcard', 'intro', 'beach', { sfx: wh, texts: ['Greetings from', 'Santorini', 'Wish you were here!'] }, postcard);
seq('postcard-end', 'Postcard Sign-off', 'outro', 'beach', { sfx: wh, texts: ['See you soon from', 'Santorini', 'Thanks for watching!'] }, postcard);
seq('flight', 'Flight Path', 'intro', 'navy', { sfx: [['sfx-whoosh', 0.6], ['sfx-ding', 2.1]], texts: ['Off to Japan', 'London', 'Tokyo', '14 hours · 9,600 km'] }, flightPath);
seq('flight-end', 'Flight Path Sign-off', 'outro', 'navy', { sfx: [['sfx-whoosh', 0.6]], texts: ['Heading Home', 'Tokyo', 'London', 'Thanks for coming along'] }, flightPath);
seq('road', 'Road Trip', 'intro', 'sunset', { sfx: [['sfx-riser', 0.0]], texts: ['Road Trip Diaries', 'Coast to coast in ten days', 'Day 1'] }, roadTrip);
seq('road-end', 'Road Trip Sign-off', 'outro', 'sunset', { texts: ['End of the Road', 'Thanks for riding along', 'Day 10'] }, roadTrip);
seq('compass', 'Compass', 'intro', 'forest', { sfx: [['sfx-tick', 0.3]], texts: ['Wander North', 'Stories from the far north', 'N', 'E', 'S', 'W'] }, compass);
seq('compass-end', 'Compass Sign-off', 'outro', 'forest', { texts: ['Until the Next Adventure', 'Thanks for watching', 'N', 'E', 'S', 'W'] }, compass);
seq('peaks', 'Mountain Sunrise', 'intro', 'sand', { sfx: [['sfx-riser', 0.0]], texts: ['Into the Alps', 'A week above the clouds', 'Episode 1'] }, peaks);
seq('peaks-end', 'Mountain Sunrise Sign-off', 'outro', 'sand', { texts: ['See You on the Trail', 'Thanks for watching', 'Episode 1'] }, peaks);
seq('map-fold', 'Map Unfold', 'intro', 'ocean', { sfx: [['sfx-swipe', 0.1], ['sfx-swipe', 0.35], ['sfx-swipe', 0.6], ['sfx-drop', 1.0]], texts: ['The Grand Tour', 'Six countries, one train pass', 'Europe by rail'] }, mapFold);
seq('map-fold-end', 'Map Unfold Sign-off', 'outro', 'ocean', { sfx: sw, texts: ['Journey Complete', 'Next stop: you decide', 'Europe by rail'] }, mapFold);
seq('suitcase', 'Suitcase', 'intro', 'sand', { sfx: [['sfx-boing', 0.3], ['sfx-pop', 0.75], ['sfx-pop', 0.9]], texts: ['Pack Your Bags', 'Weekend getaways on a budget', 'New series'] }, suitcase);
seq('suitcase-end', 'Suitcase Sign-off', 'outro', 'sand', { sfx: [['sfx-boing', 0.3]], texts: ['Unpacking Next Week', 'Thanks for watching', 'See you soon'] }, suitcase);
seq('polaroids', 'Polaroids', 'intro', 'navy', { sfx: [['sfx-shutter', 0.1], ['sfx-shutter', 0.3], ['sfx-shutter', 0.5]], texts: ['Summer Memories', 'Our trip in pictures', 'Beach', 'Old town', 'Sunset'] }, polaroids);
seq('polaroids-end', 'Polaroids Sign-off', 'outro', 'navy', { sfx: [['sfx-shutter', 0.1]], texts: ['Thanks for Watching', 'More photos on our page', 'Beach', 'Old town', 'Sunset'] }, polaroids);
// Mid-rolls
seq('destination', 'Destination', 'mid', 'ocean', { sfx: [['sfx-drop', 0.2]], texts: ['Today we’re in', 'Kyoto', 'Japan', 'Temples, gardens and the best tofu you’ll ever eat'] }, destination);
seq('packing', 'Packing List', 'mid', 'sand', { dur: 7, sfx: [['sfx-click', 0.4], ['sfx-click', 0.55], ['sfx-click', 0.7], ['sfx-click', 0.85]], texts: ['Packing list', 'Passport', 'Phone charger', 'Rain jacket', 'Walking shoes', 'Sunscreen', 'Travel adapter'] }, packing);
seq('day-plan', 'Day Plan', 'mid', 'ocean', { dur: 7, sfx: sw, texts: ['Day 2', 'Exploring the old town', 'Morning', 'Castle tour', 'Afternoon', 'Tile museum', 'Evening', 'Dinner by the river'] }, dayPlan);
seq('phrase', 'Local Phrase', 'mid', 'paper', { dur: 7, sfx: pop, texts: ['Say it like a local', 'Obrigado', 'oh-bree-GAH-doo', 'Thank you', 'Portuguese'] }, phrase);
seq('budget', 'Daily Budget', 'mid', 'forest', { dur: 7, sfx: [['sfx-cha-ching', 1.4]], texts: ['Daily budget', 'Hostel', '€30', 'Food', '€25', 'Transport', '€10', 'Total', '€65'] }, budget);
seq('tip', 'Travel Tip', 'mid', 'sand', { dur: 7, texts: ['Travel tip', 'Buy a day pass: it pays for itself after three rides.'] }, travelTip);
seq('weather', 'Weather Check', 'mid', 'sky', { sfx: wh, texts: ['Weather today', '24°', 'Sunny', 'Pack sunscreen and a hat'] }, weatherCheck);
seq('getting-there', 'Getting There', 'mid', 'navy', { dur: 7, sfx: sw, texts: ['Getting there', 'Fly', '2 h 30 min', 'Train', '6 hours', 'Bus', '9 hours'] }, gettingThere);
seq('must-see', 'Must-See Spots', 'mid', 'ocean', { dur: 7, sfx: pop, texts: ['Must-see spots', 'The river tower', 'A fortress on the water', 'The old quarter', 'Lanes full of music', 'The hill palaces', 'A short train ride away'] }, (c, S) => threeCards(c, S, {}));
seq('food', 'Food to Try', 'mid', 'paper', { dur: 7, sfx: pop, texts: ['Food to try', 'Custard tarts', 'Warm, flaky and sweet', 'Grilled sardines', 'A summer favourite', 'Pork sandwich', 'The perfect quick lunch'] }, (c, S) => threeCards(c, S, { icon: 'bowl' }));
seq('good-know', 'Good to Know', 'mid', 'forest', { dur: 7, sfx: sw, texts: ['Good to know', 'Money', 'Euro (€)', 'Plugs', 'Type F, 230 V', 'Language', 'Portuguese'] }, goodToKnow);
seq('timezone', 'Time Difference', 'mid', 'navy', { dur: 7, sfx: [['sfx-tick', 0.5]], texts: ['Time difference', 'Home', '9:00', 'Tokyo', '22:00', '+13 hours'] }, timeZones);
seq('gem', 'Hidden Gem', 'mid', 'navy', { sfx: [['sfx-magic', 0.3]], texts: ['Hidden gem', 'The Grace Viewpoint', 'The best sunset in town, without the crowds'] }, hiddenGem);
seq('route', 'Today’s Drive', 'mid', 'sand', { dur: 7, sfx: [['sfx-whoosh', 0.4]], texts: ['Today’s drive', 'Porto', 'Lisbon', '313 km · about 3 hours'] }, route);
seq('checkin', 'Checked In', 'mid', 'ocean', { sfx: [['sfx-ding', 0.6]], texts: ['Checked in', 'Casa Azul Guesthouse', '3 nights · Room 12'] }, checkIn);
seq('photo-spot', 'Photo Spot', 'mid', 'ocean', { sfx: [['sfx-shutter', 0.6]], texts: ['Photo spot', 'The Iron Bridge', 'Best light: an hour before sunset'] }, photoSpot);
seq('before-go', 'Before You Go', 'mid', 'paper', { dur: 7, sfx: [['sfx-click', 0.4], ['sfx-click', 0.55], ['sfx-click', 0.7]], texts: ['Before you go', 'Passport valid for six months', 'Check if you need a visa', 'Get travel insurance'] }, beforeGo);
seq('recap', 'Day Recap', 'mid', 'forest', { dur: 7, sfx: [['sfx-ding', 0.5]], texts: ['Day 3', 'Highlights', 'Sunrise over the bay', 'Boat trip to the caves', 'Fresh seafood dinner'] }, dayRecap);
seq('next-stop', 'Next Stop', 'mid', 'navy', { sfx: wh, texts: ['Next stop', 'Porto', 'Three hours north by train'] }, nextStop);
seq('rating', 'Our Rating', 'mid', 'sand', { dur: 7, sfx: [['sfx-pop', 0.6], ['sfx-pop', 0.72], ['sfx-pop', 0.84], ['sfx-pop', 0.96], ['sfx-pop', 1.08]], texts: ['Our rating', 'Casa Azul Guesthouse', '4.5', 'Great value and friendly hosts'] }, rating);

export const TRAVEL_SEQS = L;
