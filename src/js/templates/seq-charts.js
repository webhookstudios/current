// Chart intros and outros in the vein of Chart Rise: a chart builds itself next to (or under) the title,
// and in the outro winds back down at the end. Numbers and chart values are editable text.
import { tx, col, kin, kend, lerp, frame, TY, sized, stack, pill, polyPart, checkBadge, countUp, listOf, numOf, measure, animText, piece, line, roundRect, ease, clamp, rgba } from './scenekit.js';

const L = [];
const seq = (id, name, o, draw) => L.push({ id, name, ...o, draw });

// Text on one side and the chart on the other; on tall and square frames the text sits above the chart.
function split(S, f) {
  const u = f.u;
  if (!f.tall && !f.square) {
    const x0 = f.W * 0.52;
    return { x: f.mx, mid: f.H / 2, maxW: (x0 - f.mx - 70 * u) / f.W, align: 'left', c: { x0, x1: f.W - f.mx, y0: f.H * 0.2, y1: f.H * 0.8 } };
  }
  return { x: f.mx, mid: f.H * (f.tall ? 0.27 : 0.25), maxW: f.cw / f.W, align: 'left', c: { x0: f.mx, x1: f.W - f.mx, y0: f.H * (f.tall ? 0.46 : 0.47), y1: f.H * (f.tall ? 0.84 : 0.88) } };
}
// The label, title and line of text, centred on mid.
function textBlock(ctx, S, lay, ink, accent, muted, i = { label: 2, title: 0, sub: 1 }, size = 92) {
  const items = [
    { text: tx(S, i.label), o: TY.label, color: accent, anim: 'fade', delay: 0.2 },
    { text: tx(S, i.title), o: sized(TY.title, size), color: ink, gap: 24, delay: 0.35 },
    { text: tx(S, i.sub), o: TY.body, color: muted, gap: 18, anim: 'fade', delay: 0.75 },
  ];
  const h = stack(ctx, S, items, lay.x, 0, { maxW: lay.maxW, draw: false });
  stack(ctx, S, items, lay.x, lay.mid - h / 2, { maxW: lay.maxW, align: lay.align });
}

// 1. Line Climb: grid lines, then a line graph draws itself with an area under it; dots pop on at each
// point and the last value pops up in a bubble.
function lineClimb(ctx, S, outro) {
  const f = frame(S), u = f.u, lay = split(S, f), c = lay.c;
  const ink = col(S, 0), acc = col(S, 1), hi = col(S, 2), muted = col(S, 3);
  const drop = outro ? 1 - kend(S, 1.1, 0.7, ease.inOutCubic) : 1;
  const vals = listOf(tx(S, 4), [12, 18, 15, 24, 22, 31, 38]);
  const lo = Math.min(...vals), hiV = Math.max(...vals), span = Math.max(1e-6, hiV - lo);
  const top = c.y0 + 70 * u, bot = c.y1;
  for (let g = 0; g < 4; g++) {
    const y = lerp(bot, top, g / 3);
    line(ctx, c.x0, y, c.x1, y, kin(S, 0.05 + g * 0.06, 0.5, ease.inOutCubic) * f.fo, rgba(muted, g ? 0.22 : 0.5), (g ? 2 : 3) * u);
  }
  const pts = vals.map((v, i) => [lerp(c.x0 + 20 * u, c.x1 - 20 * u, i / (vals.length - 1)), lerp(bot - 18 * u, top, (v - lo) / span)]);
  const k = kin(S, 0.45, 1.25, ease.inOutCubic) * drop;
  piece(ctx, { x: c.x0, y: top, w: c.x1 - c.x0, h: bot - top }, (cx) => {
    if (k <= 0) return;
    cx.globalAlpha = f.fo;
    // the area under the drawn part of the line
    const xEnd = lerp(pts[0][0], pts[pts.length - 1][0], k);
    cx.save(); cx.beginPath(); cx.rect(c.x0, top - 40 * u, xEnd - c.x0, bot - top + 40 * u); cx.clip();
    const g = cx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, rgba(acc, 0.32)); g.addColorStop(1, rgba(acc, 0));
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(pts[0][0], bot); pts.forEach((p) => cx.lineTo(...p)); cx.lineTo(pts[pts.length - 1][0], bot); cx.closePath(); cx.fill();
    cx.restore();
    cx.strokeStyle = acc; cx.lineWidth = 6 * u; cx.lineCap = 'round'; cx.lineJoin = 'round';
    polyPart(cx, pts, k);
    pts.forEach((p, i) => {
      const at = i / (pts.length - 1);
      const d = ease.outBack(clamp((k - at) * 6)) * drop;
      if (d <= 0) return;
      cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(p[0], p[1], 11 * u * d, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = i === pts.length - 1 ? hi : acc; cx.beginPath(); cx.arc(p[0], p[1], 7 * u * d, 0, Math.PI * 2); cx.fill();
    });
  });
  // the last value in a bubble above the last point
  const last = pts[pts.length - 1], val = countUp(tx(S, 3), kin(S, 1.2, 0.9));
  const m = measure(ctx, S, tx(S, 3), TY.num), bw = m.w + 44 * u;
  const bx = Math.min(last[0], f.W - f.mx - bw / 2);
  piece(ctx, { x: bx - bw / 2, y: last[1] - 112 * u, w: bw, h: 70 * u }, (cx) => {
    const kb = ease.outBack(clamp((S.t - 1.55) / 0.4)) * drop;
    if (kb <= 0) return;
    cx.globalAlpha = f.fo;
    cx.translate(bx, last[1] - 40 * u); cx.scale(kb, kb); cx.translate(-bx, -(last[1] - 40 * u));
    cx.fillStyle = hi; roundRect(cx, bx - bw / 2, last[1] - 112 * u, bw, 64 * u, 32 * u); cx.fill();
    cx.beginPath(); cx.moveTo(bx - 12 * u, last[1] - 49 * u); cx.lineTo(bx + 12 * u, last[1] - 49 * u); cx.lineTo(Math.min(bx, last[0]), last[1] - 30 * u); cx.closePath(); cx.fill();
  });
  animText(ctx, S, val, bx, last[1] - 80 * u, { ...TY.num, color: '#ffffff', anim: 'fade', delay: 1.7, inDur: 0.3, outDur: outro ? 0.3 : 0.5, outEarly: outro ? 1.1 : 0, maxWidth: (bw - 30 * u) / S.W });
  textBlock(ctx, S, lay, ink, acc, muted);
}

// 2. Donut Fill: a ring fills in segment by segment while the number in the middle counts up.
function donutFill(ctx, S, outro) {
  const f = frame(S), u = f.u, lay = split(S, f), c = lay.c;
  const ink = col(S, 0), segs = [col(S, 1), col(S, 2), col(S, 3)], muted = col(S, 4);
  const drop = outro ? 1 - kend(S, 1.1, 0.7, ease.inOutCubic) : 1;
  const vals = listOf(tx(S, 5), [45, 27, 28]).slice(0, 3), sum = vals.reduce((a, b) => a + b, 0) || 1;
  const cx0 = (c.x0 + c.x1) / 2, cy0 = (c.y0 + c.y1) / 2;
  const R = Math.min(c.x1 - c.x0, c.y1 - c.y0) * 0.46, th = R * 0.3;
  const k = kin(S, 0.4, 1.4, ease.inOutCubic) * drop;
  piece(ctx, { x: cx0 - R - th / 2, y: cy0 - R - th / 2, w: (R + th / 2) * 2, h: (R + th / 2) * 2 }, (cx) => {
    cx.globalAlpha = f.fo;
    cx.lineWidth = th; cx.lineCap = 'butt';
    const track = kin(S, 0.1, 0.5) * (outro ? 1 - kend(S, 0.5, 0.4) : 1);
    if (track > 0) { cx.strokeStyle = rgba(muted, 0.18 * track); cx.beginPath(); cx.arc(cx0, cy0, R, 0, Math.PI * 2); cx.stroke(); }
    let a = -Math.PI / 2, left = k * Math.PI * 2;
    vals.forEach((v, i) => {
      const sweep = (v / sum) * Math.PI * 2, gap = 0.035;
      const s = Math.min(sweep - gap, left);
      if (s > 0) { cx.strokeStyle = segs[i]; cx.beginPath(); cx.arc(cx0, cy0, R, a, a + s); cx.stroke(); }
      left -= sweep; a += sweep;
    });
  });
  const inner = (R - th / 2) * 2 * 0.78;
  animText(ctx, S, countUp(tx(S, 3), kin(S, 0.4, 1.4)), cx0, cy0 - 14 * u, { ...sized(TY.num, Math.min(96, (R / u) * 0.42)), color: ink, anim: 'pop', delay: 0.4, inDur: 0.5, stagger: 0, maxWidth: inner / S.W, outEarly: outro ? 1.0 : 0 });
  animText(ctx, S, tx(S, 4), cx0, cy0 + R * 0.26, { ...TY.small, color: muted, anim: 'fade', delay: 1.0, maxWidth: (inner * 0.9) / S.W, outEarly: outro ? 1.0 : 0 });
  textBlock(ctx, S, lay, ink, segs[0], muted);
}

// 3. Big Number: a large figure counts up over a row of small bars, with the title under it.
function bigNumber(ctx, S, outro) {
  const f = frame(S), u = f.u;
  const ink = col(S, 0), acc = col(S, 1), bars = col(S, 2), muted = col(S, 3);
  const drop = outro ? 1 - kend(S, 1.1, 0.7, ease.inOutCubic) : 1;
  const vals = listOf(tx(S, 4), [6, 9, 8, 12, 11, 15, 18]), hiV = Math.max(...vals);
  const maxW = f.cw / f.W;
  const no = sized(TY.big, f.tall ? 170 : 200, { fontFixed: true });
  const mn = measure(ctx, S, tx(S, 3), no), fitN = Math.min(1, (maxW * f.W) / mn.w), nH = mn.h * fitN * 0.82;
  const mt = measure(ctx, S, tx(S, 0), sized(TY.title, 72)), ms = measure(ctx, S, tx(S, 1), TY.body);
  const barH = 90 * u, pillH = 54 * u;
  const total = pillH + 34 * u + nH + 26 * u + barH + 40 * u + mt.h + 14 * u + ms.h;
  let y = f.H / 2 - total / 2;
  pill(ctx, S, tx(S, 2), f.W / 2, y + pillH / 2, { bg: acc, ink: '#ffffff', align: 'center', delay: 0.15 });
  y += pillH + 34 * u;
  animText(ctx, S, countUp(tx(S, 3), kin(S, 0.35, 1.5, ease.outQuart)), f.W / 2, y + nH / 2, { ...no, color: ink, anim: 'up', delay: 0.3, inDur: 0.5, stagger: 0, maxWidth: maxW, outEarly: outro ? 1.0 : 0 });
  y += nH + 26 * u;
  // the small bars, as wide as the number
  const bw = Math.min(mn.w * fitN, f.cw), bx = f.W / 2 - bw / 2, slot = bw / vals.length;
  piece(ctx, { x: bx, y, w: bw, h: barH }, (cx) => {
    cx.globalAlpha = f.fo;
    vals.forEach((v, i) => {
      const k = kin(S, 0.6 + i * 0.08, 0.5, ease.outCubic) * drop;
      if (k <= 0) return;
      const h = barH * (v / hiV) * k;
      cx.fillStyle = i === vals.length - 1 ? acc : rgba(bars, 0.55);
      roundRect(cx, bx + slot * i + slot * 0.18, y + barH - h, slot * 0.64, h, Math.min(6 * u, h / 2)); cx.fill();
    });
  });
  y += barH + 40 * u;
  stack(ctx, S, [{ text: tx(S, 0), o: sized(TY.title, 72), color: ink, delay: 0.9 }, { text: tx(S, 1), o: TY.body, color: muted, gap: 14, anim: 'fade', delay: 1.15 }], f.W / 2, y, { align: 'center', maxW });
}

// 4. Stacked Columns: columns build up in three coloured layers, with the years under them and a key.
function stackedColumns(ctx, S, outro) {
  const f = frame(S), u = f.u, lay = split(S, f), c = lay.c;
  const ink = col(S, 0), segs = [col(S, 1), col(S, 2), col(S, 3)], muted = col(S, 4);
  const drop = outro ? 1 - kend(S, 1.1, 0.7, ease.inOutCubic) : 1;
  const years = String(tx(S, 6)).split(/\s+/).filter(Boolean).slice(0, 6);
  const n = Math.max(3, years.length || 5);
  const data = Array.from({ length: n }, (_, i) => [0.16 + i * 0.05, 0.12 + i * 0.035, 0.08 + i * 0.03]);
  const keyH = 40 * u, axisH = 44 * u;
  const top = c.y0 + 10 * u, base = c.y1 - axisH - keyH - 20 * u, ch = base - top;
  const slot = (c.x1 - c.x0) / n, bw = slot * 0.56;
  line(ctx, c.x0, base, c.x1, base, kin(S, 0.05, 0.5, ease.inOutCubic) * f.fo, rgba(muted, 0.6), 3 * u);
  piece(ctx, { x: c.x0, y: top, w: c.x1 - c.x0, h: ch }, (cx) => {
    cx.globalAlpha = f.fo;
    data.forEach((col3, i) => {
      let y = base;
      col3.forEach((v, j) => {
        const k = kin(S, 0.3 + i * 0.1 + j * 0.18, 0.45, ease.outCubic) * drop;
        if (k <= 0) return;
        const h = ch * v * k;
        cx.fillStyle = segs[j];
        const r = j === 2 || k < 1 ? Math.min(6 * u, h / 2) : 0;
        roundRect(cx, c.x0 + slot * i + (slot - bw) / 2, y - h, bw, h, r); cx.fill();
        y -= h;
      });
    });
  });
  years.forEach((yr, i) => animText(ctx, S, yr, c.x0 + slot * (i + 0.5), base + axisH / 2 + 6 * u, { ...TY.small, color: muted, anim: 'fade', delay: 0.4 + i * 0.08, maxWidth: (slot * 0.95) / S.W }));
  // the key: a coloured square and a name for each layer
  const names = [tx(S, 3), tx(S, 4), tx(S, 5)];
  const ko = sized(TY.small, 28);
  const ws = names.map((t) => measure(ctx, S, t, ko).w + 22 * u + 12 * u);
  const gap = 34 * u, kw = ws.reduce((a, b) => a + b, 0) + gap * 2;
  const ks = Math.min(1, (c.x1 - c.x0) / kw);
  let kx = c.x0, ky = c.y1 - keyH / 2;
  names.forEach((t, i) => {
    const x = kx;
    piece(ctx, { x, y: ky - 11 * u, w: 22 * u, h: 22 * u }, (cx) => { const k = kin(S, 1.2 + i * 0.1, 0.3); if (k <= 0) return; cx.globalAlpha = f.fo * k; cx.fillStyle = segs[i]; roundRect(cx, x, ky - 11 * u, 22 * u, 22 * u, 5 * u); cx.fill(); });
    animText(ctx, S, t, x + 34 * u, ky, { ...ko, color: ink, align: 'left', anim: 'fade', delay: 1.25 + i * 0.1, maxWidth: (ws[i] * ks - 34 * u) / S.W });
    kx += (ws[i] + gap) * ks;
  });
  textBlock(ctx, S, lay, ink, segs[0], muted);
}

// 5. Ranking Bars: bars race out to their values beside each name, the leader in the accent colour.
function rankingBars(ctx, S, outro) {
  const f = frame(S), u = f.u, lay = split(S, f), c = lay.c;
  const ink = col(S, 0), acc = col(S, 1), rest = col(S, 2), muted = col(S, 3);
  const drop = outro ? 1 - kend(S, 1.1, 0.7, ease.inOutCubic) : 1;
  const names = [3, 4, 5, 6].map((i) => tx(S, i));
  const vals = listOf(tx(S, 7), [92, 78, 64, 51]).slice(0, 4), top = Math.max(...vals);
  const no = TY.strong, vo = sized(TY.num, 34);
  const nameW = Math.min(Math.max(...names.map((t) => measure(ctx, S, t, no).w)), (c.x1 - c.x0) * 0.34);
  const valW = Math.max(...vals.map((v) => measure(ctx, S, String(v), vo).w));
  const bx = c.x0 + nameW + 28 * u, bmax = c.x1 - bx - valW - 24 * u;
  const rowH = Math.min((c.y1 - c.y0) / 4, 110 * u), bh = rowH * 0.46;
  const y0 = (c.y0 + c.y1) / 2 - rowH * 2 + rowH / 2;
  names.forEach((t, i) => {
    const y = y0 + rowH * i, d = 0.35 + i * 0.14;
    animText(ctx, S, t, c.x0, y, { ...no, color: ink, align: 'left', anim: 'fade', delay: d, maxWidth: nameW / S.W });
    const k = kin(S, d + 0.1, 0.9, ease.outCubic) * drop;
    const w = Math.max(bh, bmax * (vals[i] / top));
    piece(ctx, { x: bx, y: y - bh / 2, w, h: bh }, (cx) => {
      if (k <= 0) return;
      cx.globalAlpha = f.fo; cx.fillStyle = i === 0 ? acc : rgba(rest, 0.85 - i * 0.12);
      roundRect(cx, bx, y - bh / 2, w * k, bh, bh / 2); cx.fill();
    });
    animText(ctx, S, countUp(String(vals[i]), k), bx + w * k + 16 * u, y, { ...vo, color: i === 0 ? acc : muted, align: 'left', anim: 'fade', delay: d + 0.2, inDur: 0.3, outEarly: outro ? 1.0 : 0 });
  });
  textBlock(ctx, S, lay, ink, acc, muted);
}

// 6. Milestone Timeline: a line draws across, and each milestone lights up as it passes, with its
// year above and a few words below (down the side on tall frames). The outro ticks the last one.
function milestones(ctx, S, outro) {
  const f = frame(S), u = f.u;
  const ink = col(S, 0), acc = col(S, 1), muted = col(S, 2), dotBg = col(S, 3);
  const years = [3, 4, 5, 6].map((i) => tx(S, i)), caps = [7, 8, 9, 10].map((i) => tx(S, i));
  const vert = f.tall;
  const head = { x: f.mx, align: 'left', maxW: f.cw / f.W };
  const items = [
    { text: tx(S, 2), o: TY.label, color: acc, anim: 'fade', delay: 0.15 },
    { text: tx(S, 0), o: sized(TY.title, 84), color: ink, gap: 22, delay: 0.3 },
    { text: tx(S, 1), o: TY.body, color: muted, gap: 16, anim: 'fade', delay: 0.6 },
  ];
  const hh = stack(ctx, S, items, 0, 0, { maxW: head.maxW, draw: false });
  const lk = kin(S, 0.7, 1.4, ease.inOutCubic) * (outro ? 1 - kend(S, 0.9, 0.6, ease.inOutCubic) : 1);
  const r = 16 * u;
  if (!vert) {
    stack(ctx, S, items, head.x, f.H * 0.36 - hh / 2, { maxW: head.maxW });
    const ly = f.H * 0.68, x0 = f.mx, x1 = f.W - f.mx, slot = (x1 - x0) / 4;
    line(ctx, x0, ly, x1, ly, lk * f.fo, rgba(acc, 0.5), 4 * u);
    years.forEach((yr, i) => {
      const x = x0 + slot * (i + 0.5), at = (i + 0.5) / 4, d = 0.7 + at * 1.4;
      piece(ctx, { x: x - r * 1.6, y: ly - r * 1.6, w: r * 3.2, h: r * 3.2 }, (cx) => {
        const k = ease.outBack(clamp((S.t - d) / 0.35)) * (outro ? 1 - kend(S, 0.9 - at * 0.3, 0.4) : 1);
        if (k <= 0) return;
        cx.globalAlpha = f.fo;
        if (outro && i === 3) { checkBadge(cx, x, ly, r * 1.6, k, acc, dotBg, u); return; }
        cx.fillStyle = ink; cx.beginPath(); cx.arc(x, ly, r * 1.5 * k, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = acc; cx.beginPath(); cx.arc(x, ly, r * k, 0, Math.PI * 2); cx.fill();
      });
      animText(ctx, S, yr, x, ly - 62 * u, { ...sized(TY.num, 44), color: ink, anim: 'up', delay: d, inDur: 0.4, stagger: 0, maxWidth: (slot * 0.9) / S.W });
      animText(ctx, S, caps[i], x, ly + 64 * u, { ...TY.small, color: muted, anim: 'fade', delay: d + 0.15, maxWidth: (slot * 0.9) / S.W });
    });
  } else {
    stack(ctx, S, items, head.x, f.H * 0.22 - hh / 2, { maxW: head.maxW });
    const lx = f.mx + r * 1.6, y0 = f.H * 0.42, y1 = f.H * 0.88, slot = (y1 - y0) / 4;
    line(ctx, lx, y0, lx, y1, lk * f.fo, rgba(acc, 0.5), 4 * u);
    const tw = (f.W - f.mx - lx - 50 * u) / S.W;
    years.forEach((yr, i) => {
      const y = y0 + slot * (i + 0.5), at = (i + 0.5) / 4, d = 0.7 + at * 1.4;
      piece(ctx, { x: lx - r * 1.6, y: y - r * 1.6, w: r * 3.2, h: r * 3.2 }, (cx) => {
        const k = ease.outBack(clamp((S.t - d) / 0.35)) * (outro ? 1 - kend(S, 0.9 - at * 0.3, 0.4) : 1);
        if (k <= 0) return;
        cx.globalAlpha = f.fo;
        if (outro && i === 3) { checkBadge(cx, lx, y, r * 1.6, k, acc, dotBg, u); return; }
        cx.fillStyle = ink; cx.beginPath(); cx.arc(lx, y, r * 1.5 * k, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = acc; cx.beginPath(); cx.arc(lx, y, r * k, 0, Math.PI * 2); cx.fill();
      });
      animText(ctx, S, yr, lx + 50 * u, y - 24 * u, { ...sized(TY.num, 44), color: ink, align: 'left', anim: 'up', delay: d, inDur: 0.4, stagger: 0, maxWidth: tw });
      animText(ctx, S, caps[i], lx + 50 * u, y + 26 * u, { ...TY.small, color: muted, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: tw });
    });
  }
}

const sw = [['sfx-swipe', 0.2]], wh = [['sfx-whoosh', 0.15]];
seq('line', 'Line Climb', { cat: 'Intros', dur: 5, bg: ['bg-white', '#f5f7fb'], sfx: sw, texts: ['Growth Report', 'How the year added up, month by month', '2026 in review', '+38%', '12 18 15 24 22 31 38'], colors: ['#0f172a', '#2563eb', '#f59e0b', '#64748b'] }, (c, S) => lineClimb(c, S, false));
seq('line-end', 'Line Climb Thanks', { cat: 'Outros', dur: 6, bg: ['bg-white', '#f5f7fb'], texts: ['Thank You', 'Questions? team@company.com', '2026 in review', '+38%', '12 18 15 24 22 31 38'], colors: ['#0f172a', '#2563eb', '#f59e0b', '#64748b'] }, (c, S) => lineClimb(c, S, true));
seq('donut', 'Donut Fill', { cat: 'Intros', dur: 5, bg: ['bg-black', '#0b1220'], sfx: wh, texts: ['Where Our Time Goes', 'A look at the work behind every project', 'Team report', '72%', 'on target', '45 27 28'], colors: ['#ffffff', '#22d3ee', '#a78bfa', '#f472b6', '#9ca3af'] }, (c, S) => donutFill(c, S, false));
seq('donut-end', 'Donut Fill Thanks', { cat: 'Outros', dur: 6, bg: ['bg-black', '#0b1220'], texts: ['Thanks for Watching', 'Full report at company.com/report', 'Team report', '72%', 'on target', '45 27 28'], colors: ['#ffffff', '#22d3ee', '#a78bfa', '#f472b6', '#9ca3af'] }, (c, S) => donutFill(c, S, true));
seq('count', 'Big Number', { cat: 'Intros', dur: 5, bg: ['bg-white', '#ffffff'], sfx: [['sfx-riser', 0.1]], texts: ['Customers Served', 'And every one of them counted', 'This year', '24,860', '6 9 8 12 11 15 18'], colors: ['#111827', '#10b981', '#6ee7b7', '#6b7280'] }, (c, S) => bigNumber(c, S, false));
seq('count-end', 'Big Number Thanks', { cat: 'Outros', dur: 6, bg: ['bg-white', '#ffffff'], texts: ['Thank You', 'Here’s to the next 25,000', 'This year', '24,860', '6 9 8 12 11 15 18'], colors: ['#111827', '#10b981', '#6ee7b7', '#6b7280'] }, (c, S) => bigNumber(c, S, true));
seq('stack', 'Stacked Columns', { cat: 'Intros', dur: 5, bg: ['bg-charcoal', '#18181b'], sfx: sw, texts: ['Revenue by Region', 'Five years of steady growth', 'Annual report', 'North', 'South', 'West', '2022 2023 2024 2025 2026'], colors: ['#ffffff', '#6366f1', '#22c55e', '#f59e0b', '#a1a1aa'] }, (c, S) => stackedColumns(c, S, false));
seq('stack-end', 'Stacked Columns Thanks', { cat: 'Outros', dur: 6, bg: ['bg-charcoal', '#18181b'], texts: ['Thanks for Watching', 'See you at the next review', 'Annual report', 'North', 'South', 'West', '2022 2023 2024 2025 2026'], colors: ['#ffffff', '#6366f1', '#22c55e', '#f59e0b', '#a1a1aa'] }, (c, S) => stackedColumns(c, S, true));
seq('rank', 'Ranking Bars', { cat: 'Intros', dur: 5, bg: ['bg-white', '#fbf7f0'], sfx: wh, texts: ['Top Performing Teams', 'Ranked by quarterly results', 'Q3 leaderboard', 'Design', 'Sales', 'Support', 'Marketing', '92 78 64 51'], colors: ['#1c1917', '#e11d48', '#78716c', '#57534e'] }, (c, S) => rankingBars(c, S, false));
seq('rank-end', 'Ranking Bars Thanks', { cat: 'Outros', dur: 6, bg: ['bg-white', '#fbf7f0'], texts: ['Great Work, Everyone', 'Next update in Q4', 'Q3 leaderboard', 'Design', 'Sales', 'Support', 'Marketing', '92 78 64 51'], colors: ['#1c1917', '#e11d48', '#78716c', '#57534e'] }, (c, S) => rankingBars(c, S, true));
seq('timeline', 'Milestone Timeline', { cat: 'Intros', dur: 5, bg: ['bg-navy', '#0f1e36'], sfx: sw, texts: ['Our Story So Far', 'Ten years of building together', 'Since 2016', '2016', '2019', '2022', '2026', 'Founded', 'First office', '100 people', 'Today'], colors: ['#ffffff', '#38bdf8', '#aab4c0', '#0b1526'] }, (c, S) => milestones(c, S, false));
seq('timeline-end', 'Milestone Timeline Thanks', { cat: 'Outros', dur: 6, bg: ['bg-navy', '#0f1e36'], texts: ['Thanks for Being Part of It', 'Here’s to the next chapter', 'Since 2016', '2016', '2019', '2022', '2026', 'Founded', 'First office', '100 people', 'Today'], colors: ['#ffffff', '#38bdf8', '#aab4c0', '#0b1526'] }, (c, S) => milestones(c, S, true));

export const CHART_SEQS = L;
