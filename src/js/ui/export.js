// Export: settings dialog, offline audio mixdown, frame-by-frame render piped to GStreamer.
import { h, icon, fmtTime, fmtBytes, clamp, nextFrame } from '../util.js';
import { store, projectDuration, mediaById } from '../state.js';
import { app } from '../actions.js';
import { modal, toast } from './widgets.js';
import { decodeFile, buildChain, encodeWav } from '../engine/audio.js';
import { playPath } from '../engine/media.js';
import { sortedByTrack } from '../engine/scene.js';

const FORMATS = [
  { id: 'mp4', name: 'MP4', sub: 'H.264 · works everywhere', ext: 'mp4' },
  { id: 'mov', name: 'MOV', sub: 'H.264 · QuickTime', ext: 'mov' },
  { id: 'webm', name: 'WebM', sub: 'VP9 · for the web', ext: 'webm' },
  { id: 'mp3', name: 'MP3', sub: 'Audio only', ext: 'mp3' },
];

export function openExport() {
  const p = store.project;
  const dur = projectDuration();
  if (dur <= 0) { toast('Add something to the timeline first.', 'err'); return; }
  app.player.pause();
  const short = Math.min(p.width, p.height);
  const s = { format: 'mp4', name: p.name || 'My Video', res: short, fps: p.fps, quality: 'high' };
  const body = h('div.exp');
  const fmts = h('div.exp-formats');
  const set = h('div.exp-set');
  body.append(fmts, set);
  const thumb = document.createElement('canvas');
  thumb.width = 320; thumb.height = Math.round(320 * p.height / p.width);
  try { thumb.getContext('2d').drawImage(app.compositor.canvas, 0, 0, thumb.width, thumb.height); } catch { /* */ }

  const draw = () => {
    fmts.replaceChildren(...FORMATS.map((f) => h('div.exp-fmt', { class: `exp-fmt${s.format === f.id ? ' on' : ''}`, onclick: () => { s.format = f.id; draw(); } }, h('b', f.name), h('small', f.sub))));
    const isAudio = s.format === 'mp3';
    const sizes = [480, 720, 1080, 1440, 2160].filter((r) => r <= Math.max(2160, short));
    const dims = (r) => { const k = r / short; return [Math.round(p.width * k / 2) * 2, Math.round(p.height * k / 2) * 2]; };
    const [W, H] = dims(s.res);
    const est = isAudio ? dur * 32000 : dur * W * H * s.fps * ({ high: 0.11, medium: 0.07, low: 0.04 }[s.quality]) / 8 * (s.format === 'webm' ? 0.8 : 1) + dur * 32000;
    const nameIn = h('input.grow', { type: 'text', value: s.name, oninput: () => { s.name = nameIn.value; } });
    set.replaceChildren(
      h('div.exp-thumb', thumb),
      h('div.row', h('label', 'Name'), nameIn),
      isAudio ? null : h('div.row', h('label', 'Resolution'), h('select.grow', { onchange: (e) => { s.res = +e.target.value; draw(); } }, sizes.map((r) => { const [w, hh] = dims(r); return h('option', { value: r, selected: r === s.res }, `${r === 2160 ? '4K' : r + 'p'} · ${w}×${hh}`); }))),
      isAudio ? null : h('div.row', h('label', 'Frame rate'), h('select.grow', { onchange: (e) => { s.fps = +e.target.value; draw(); } }, [24, 25, 30, 50, 60].map((f) => h('option', { value: f, selected: f === s.fps }, `${f} fps`)))),
      h('div.row', h('label', 'Quality'), h('div.chips', ['low', 'medium', 'high'].map((q) => h('button.chip-btn', { class: `chip-btn${s.quality === q ? ' on' : ''}`, onclick: () => { s.quality = q; draw(); } }, q[0].toUpperCase() + q.slice(1))))),
      h('div.row', h('label', 'Duration'), h('span', fmtTime(dur, p.fps).replace(/^00:/, ''))),
      h('div.row', h('label', 'Estimated size'), h('span', `about ${fmtBytes(est)}`)),
    );
  };
  draw();
  modal({
    title: 'Export',
    body,
    actions: [
      { label: 'Cancel', run: (c) => c() },
      { label: 'Export', primary: true, run: async (c) => {
        const f = FORMATS.find((x) => x.id === s.format);
        const path = await window.native.exportPathDialog(s.name, f.ext);
        if (!path) return;
        c();
        const k = s.res / short;
        run({ path, format: s.format, width: Math.round(p.width * k / 2) * 2, height: Math.round(p.height * k / 2) * 2, fps: s.fps, quality: s.quality });
      } },
    ],
  });
}

async function run(o) {
  const p = store.project;
  const dur = projectDuration();
  const total = Math.max(1, Math.round(dur * o.fps));
  let cancelled = false;
  const pct = h('div.big', '0%');
  const bar = h('i');
  const info = h('div.hint', 'Mixing audio…');
  const preview = document.createElement('canvas');
  preview.width = 480; preview.height = Math.round(480 * o.height / o.width);
  const m = modal({
    title: 'Exporting',
    closable: false,
    body: h('div.exp-progress', h('div.exp-thumb', { style: { aspectRatio: `${o.width}/${o.height}`, maxHeight: '300px' } }, preview), pct, h('div.progress', bar), info),
    actions: [{ label: 'Cancel', run: async () => { cancelled = true; await window.native.exportCancel(); } }],
  });
  const player = app.player;
  const comp = app.compositor;
  player.suspended = true;
  player.muteAll(true);
  const t0 = performance.now();
  try {
    const wav = await mixAudio(p, dur);
    if (o.format === 'mp3' && !wav) throw new Error('There is no audio to export.');
    if (cancelled) throw new Error('cancelled');
    await window.native.exportStart({ path: o.path, format: o.format, width: o.width, height: o.height, fps: o.fps, quality: o.quality, audioWav: wav });
    if (o.format !== 'mp3') {
      comp.setSize(o.width, o.height);
      if (comp.W !== o.width || comp.H !== o.height) throw new Error('Size mismatch');
      const byTrack = sortedByTrack(p);
      const px = new Uint8Array(o.width * o.height * 4);
      const pctx = preview.getContext('2d');
      for (let i = 0; i < total; i++) {
        if (cancelled) throw new Error('cancelled');
        const t = i / o.fps;
        await player.prepareExact(t);
        comp.setSize(o.width, o.height);
        comp.render(p, t, player.source, { byTrack, offscreen: i % 15 !== 0, keepTextures: true });
        comp.readPixels(px);
        await window.native.exportFrame(px);
        if (i % 15 === 0) {
          pctx.drawImage(comp.canvas, 0, 0, preview.width, preview.height);
          const done = (i + 1) / total;
          const el = (performance.now() - t0) / 1000;
          const eta = el / done - el;
          pct.textContent = `${Math.round(done * 100)}%`;
          bar.style.width = `${done * 100}%`;
          info.textContent = `Frame ${i + 1} of ${total} · ${(i / el).toFixed(1)} fps · about ${fmtTime(eta, 1, false)} left`;
          await nextFrame();
        }
      }
    }
    info.textContent = 'Finishing file…';
    const res = await window.native.exportFinish();
    m.back.remove();
    const secs = (performance.now() - t0) / 1000;
    modal({
      title: 'Export complete',
      body: h('div', { style: { width: '460px' } }, h('div.row', icon('check', 22), h('b', res.path.split('/').pop())), h('div.hint', `${fmtBytes(res.size)} · ${o.format === 'mp3' ? 'audio' : `${o.width}×${o.height} at ${o.fps} fps`} · took ${fmtTime(secs, 1, false)}`), h('div.hint', { style: { marginTop: '6px', wordBreak: 'break-all' } }, res.path)),
      actions: [{ label: 'Show in folder', run: (c) => { window.native.showItem(res.path); c(); } }, { label: 'Done', primary: true, run: (c) => c() }],
    });
  } catch (e) {
    m.back.remove();
    await window.native.exportCancel();
    if (e.message !== 'cancelled') modal({ title: 'Export failed', body: h('div.hint', { style: { width: '480px', whiteSpace: 'pre-wrap', userSelect: 'text' } }, e.message), actions: [{ label: 'OK', primary: true, run: (c) => c() }] });
    else toast('Export cancelled');
  } finally {
    player.suspended = false;
    player.muteAll(false);
    player.seek(store.time);
  }
}

// ---------- audio mixdown ----------
export async function mixAudio(p, dur) {
  const sr = 48000;
  const octx = new OfflineAudioContext(2, Math.ceil(dur * sr) + 1, sr);
  const muted = new Set(p.tracks.filter((t) => t.muted).map((t) => t.id));
  let any = false;
  for (const c of p.clips) {
    if (!(c.type === 'video' || c.type === 'audio') || c.muted || muted.has(c.trackId)) continue;
    const m = mediaById(c.mediaId);
    if (!m || m.hasAudio === false) continue;
    const buf = await decodeFile(c.audioFx?.denoisePath || playPath(m));
    if (!buf) continue;
    const speed = c.speed || 1;
    if (speed < 0.05) continue;
    let seg = buf, offset = c.in || 0, length = c.duration * speed;
    if (Math.abs(speed - 1) > 0.001) { seg = timeStretch(octx, buf, offset, length, speed); offset = 0; length = seg.duration; }
    const src = octx.createBufferSource();
    src.buffer = seg;
    const chain = buildChain(octx, c.audioFx);
    const g = octx.createGain();
    const vol = c.volume ?? 1;
    const s = c.start, e = c.start + c.duration;
    g.gain.setValueAtTime(c.fadeIn > 0 ? 0 : vol, s);
    if (c.fadeIn > 0) g.gain.linearRampToValueAtTime(vol, s + Math.min(c.fadeIn, c.duration));
    if (c.fadeOut > 0) { g.gain.setValueAtTime(vol, Math.max(s, e - c.fadeOut)); g.gain.linearRampToValueAtTime(0, e); }
    src.connect(chain.input);
    chain.output.connect(g);
    g.connect(octx.destination);
    src.start(s, offset, Math.min(length, seg.duration - offset));
    src.stop(e + 0.01);
    any = true;
  }
  if (!any) return null;
  const out = await octx.startRendering();
  return encodeWav(out);
}

// Speed change without pitch change (WSOLA): grains are re-spaced and aligned by cross-correlation.
function timeStretch(ctx, buf, from, length, speed) {
  const sr = buf.sampleRate;
  const N = 2048, Ho = 512, search = 384, overlap = 256;
  const s0 = Math.floor(from * sr), inLen = Math.min(buf.length - s0, Math.floor(length * sr));
  const outLen = Math.max(1, Math.floor(inLen / speed));
  const out = ctx.createBuffer(buf.numberOfChannels, outLen, sr);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const ref = buf.getChannelData(0);
  const norm = new Float32Array(outLen + N);
  const chans = [...Array(buf.numberOfChannels)].map((_, c) => ({ inp: buf.getChannelData(c), acc: new Float32Array(outLen + N) }));
  let prevPos = s0;
  for (let o = 0; o < outLen; o += Ho) {
    let ip = s0 + Math.floor(o * speed);
    if (o > 0) {
      // natural continuation of the previous grain
      const nat = prevPos + Ho;
      let best = 0, bestC = -Infinity;
      for (let d = -search; d <= search; d += 8) {
        const q = ip + d;
        if (q < s0 || q + overlap >= s0 + inLen) continue;
        let cc = 0;
        for (let k = 0; k < overlap; k += 4) cc += ref[q + k] * ref[nat + k];
        if (cc > bestC) { bestC = cc; best = d; }
      }
      ip += best;
    }
    prevPos = ip;
    for (const ch of chans) for (let i = 0; i < N; i++) { const si = ip + i; if (si >= s0 + inLen) break; ch.acc[o + i] += ch.inp[si] * win[i]; }
    for (let i = 0; i < N; i++) norm[o + i] += win[i];
  }
  chans.forEach((ch, c) => { const d = out.getChannelData(c); for (let i = 0; i < outLen; i++) d[i] = norm[i] > 1e-3 ? ch.acc[i] / norm[i] : 0; });
  return out;
}

export { clamp };
