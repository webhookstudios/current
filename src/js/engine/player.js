// Preview playback: keeps one media element per clip in sync with the timeline clock,
// routes clip audio through effect chains, and drives the compositor.
import { store, mediaById, projectDuration } from '../state.js';
import { fileUrl } from '../util.js';
import { visualStack, sortedByTrack, audibleAt, sourceTime, clipGain } from './scene.js';
import { buildChain } from './audio.js';
import { duckGain } from './duck.js';
import { images, playPath } from './media.js';

export class Player {
  constructor(compositor) {
    this.comp = compositor;
    this.actx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.actx.createGain();
    this.analyser = this.actx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(this.analyser);
    this.analyser.connect(this.actx.destination);
    this.els = new Map(); // clipId -> entry
    this.raf = 0;
    this.renderQueued = false;
    this.scale = 0.5;
    this.loopRange = null;
    this.onFrame = null;
  }

  // ---------- media elements ----------
  entry(c) {
    let e = this.els.get(c.id);
    const m = c.mediaId ? mediaById(c.mediaId) : null;
    if (!m) return null;
    const wantVideo = c.type === 'video';
    const audioPath = c.audioFx?.denoisePath || null;
    const srcPath = playPath(m);
    if (e && (e.srcPath !== srcPath || e.audioPath !== audioPath)) { this.dropEntry(c.id); e = null; }
    if (e) return e;
    e = { clipId: c.id, srcPath, audioPath, v: null, a: null, gain: this.actx.createGain(), chain: null, fxKey: '' };
    e.gain.connect(this.master);
    if (wantVideo) {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.playsInline = true;
      v.src = fileUrl(srcPath);
      v.preservesPitch = true;
      v.addEventListener('seeked', () => this.requestRender());
      v.addEventListener('loadeddata', () => this.requestRender());
      e.v = v;
    }
    const soundPath = audioPath || (c.type === 'audio' ? srcPath : null);
    if (soundPath) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = fileUrl(soundPath);
      a.preservesPitch = true;
      e.a = a;
      if (e.v) e.v.muted = true;
    }
    const sound = e.a || e.v;
    if (sound) {
      try { e.node = this.actx.createMediaElementSource(sound); } catch { e.node = null; }
    }
    this.els.set(c.id, e);
    return e;
  }
  dropEntry(id) {
    const e = this.els.get(id);
    if (!e) return;
    for (const el of [e.v, e.a]) if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
    try { e.node?.disconnect(); } catch { /* */ }
    e.chain?.dispose();
    try { e.gain.disconnect(); } catch { /* */ }
    this.els.delete(id);
    this.comp.dropTexture('c:' + id);
  }
  fxChain(e, c) {
    const key = JSON.stringify(c.audioFx || {});
    if (e.fxKey === key && e.chain) return;
    e.fxKey = key;
    try { e.node?.disconnect(); } catch { /* */ }
    e.chain?.dispose();
    e.chain = buildChain(this.actx, c.audioFx);
    e.node?.connect(e.chain.input);
    e.chain.output.connect(e.gain);
  }

  // Frame source for the compositor.
  source = (c) => {
    if (c.type === 'image') {
      const img = images.get(c.mediaId);
      return img ? { el: img, w: img.naturalWidth, h: img.naturalHeight } : null;
    }
    const e = this.els.get(c.id) || this.entry(c);
    if (!e?.v || e.v.readyState < 2) return e?.lastOk ? { el: e.v, w: e.v.videoWidth, h: e.v.videoHeight } : null;
    e.lastOk = true;
    return { el: e.v, w: e.v.videoWidth, h: e.v.videoHeight };
  };

  // Which clips need elements at t (visual + audible + upcoming).
  needed(t, lookahead = 0) {
    const p = store.project;
    const set = new Map();
    const byTrack = sortedByTrack(p);
    for (const { state } of visualStack(p, t, byTrack)) for (const c of [state.a, state.b]) if (c && c.type === 'video') set.set(c.id, c);
    for (const c of audibleAt(p, t)) set.set(c.id, c);
    if (lookahead) for (const c of p.clips) if ((c.type === 'video' || c.type === 'audio') && c.start > t && c.start < t + lookahead) set.set(c.id, c);
    return { set, byTrack };
  }

  sync(t, playing) {
    const { set, byTrack } = this.needed(t, playing ? 2 : 0);
    const muted = new Set(store.project.tracks.filter((tr) => tr.muted).map((tr) => tr.id));
    for (const [id, e] of this.els) {
      if (!set.has(id)) { e.v?.pause(); e.a?.pause(); if (!store.project.clips.some((c) => c.id === id)) this.dropEntry(id); }
    }
    for (const c of set.values()) {
      const e = this.entry(c);
      if (!e) continue;
      this.fxChain(e, c);
      const m = mediaById(c.mediaId);
      const upcoming = c.start > t;
      const want = sourceTime(c, upcoming ? c.start : t, m?.duration);
      const g = upcoming || muted.has(c.trackId) ? 0 : clipGain(c, t) * duckGain(c, t);
      e.gain.gain.setTargetAtTime(g, this.actx.currentTime, 0.012);
      for (const el of [e.v, e.a]) {
        if (!el) continue;
        const rate = c.speed || 1;
        if (el.playbackRate !== rate) el.playbackRate = rate;
        if (playing && !upcoming) {
          if (el.paused) { if (Math.abs(el.currentTime - want) > 0.05) el.currentTime = want; el.play().catch(() => {}); }
          else if (Math.abs(el.currentTime - want) > 0.2 * rate) el.currentTime = want;
        } else {
          if (!el.paused) el.pause();
          if (Math.abs(el.currentTime - want) > 0.5 / (store.project.fps || 30) && !el.seeking) el.currentTime = want + 0.001;
        }
      }
    }
    return byTrack;
  }

  // ---------- transport ----------
  // openEnded: keep going past the end of the project instead of stopping there (used while
  // recording a voiceover, which may run longer than the video, or start after it).
  play({ openEnded = false } = {}) {
    if (store.playing) return;
    if (this.actx.state === 'suspended') this.actx.resume();
    const dur = projectDuration();
    this.openEnded = openEnded;
    if (!openEnded && store.time >= dur - 0.05) store.time = 0;
    store.playing = true;
    this.t0 = store.time;
    this.p0 = performance.now();
    store.emit('play', true);
    const tick = () => {
      if (!store.playing) return;
      let t = this.t0 + (performance.now() - this.p0) / 1000;
      const end = this.loopRange ? this.loopRange[1] : projectDuration();
      if (t >= end && !this.openEnded) {
        if (this.loopRange) { this.t0 = this.loopRange[0]; this.p0 = performance.now(); t = this.t0; } else { store.time = end; this.pause(); return; }
      }
      store.time = t;
      store.emit('time', t);
      const byTrack = this.sync(t, true);
      this.renderNow(t, byTrack);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  pause() {
    store.playing = false;
    this.openEnded = false;
    cancelAnimationFrame(this.raf);
    for (const e of this.els.values()) { e.v?.pause(); e.a?.pause(); }
    store.emit('play', false);
    this.seek(store.time);
  }
  toggle() { store.playing ? this.pause() : this.play(); }
  seek(t) {
    const was = store.playing;
    if (was) { this.t0 = Math.max(0, t); this.p0 = performance.now(); store.time = this.t0; store.emit('time', this.t0); return; }
    store.time = Math.max(0, t);
    store.emit('time', store.time);
    this.sync(store.time, false);
    this.requestRender();
  }

  requestRender() {
    if (store.playing || this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (store.playing || this.suspended) return;
      this.sync(store.time, false);
      this.renderNow(store.time);
    });
  }

  renderNow(t, byTrack) {
    const p = store.project;
    if (!p) return;
    const s = this.scale;
    this.comp.setSize(p.width * s, p.height * s);
    this.comp.render(p, t, this.source, { byTrack });
    this.onFrame?.(t);
  }

  // ---------- export support ----------
  // Seek every element needed at t to the exact frame and wait for it.
  async prepareExact(t) {
    const { set, byTrack } = this.needed(t);
    const waits = [];
    for (const c of set.values()) {
      if (c.type !== 'video') continue;
      const e = this.entry(c);
      if (!e?.v) continue;
      const m = mediaById(c.mediaId);
      const want = sourceTime(c, t, m?.duration) + 0.001;
      const v = e.v;
      v.pause();
      if (v.readyState < 2) waits.push(new Promise((r) => { const f = () => { v.removeEventListener('loadeddata', f); r(); }; v.addEventListener('loadeddata', f); setTimeout(r, 8000); }));
      if (Math.abs(v.currentTime - want) > 1e-4) {
        waits.push(new Promise((r) => {
          const done = () => { v.removeEventListener('seeked', done); r(); };
          v.addEventListener('seeked', done);
          v.currentTime = want;
          setTimeout(done, 5000);
        }));
      }
    }
    await Promise.all(waits);
    // when seek lands on the same frame Chromium may not fire a new paint; give it one frame
    return byTrack;
  }

  muteAll(m) { this.master.gain.value = m ? 0 : 1; }
}
