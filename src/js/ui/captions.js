// Automatic captions: the voice clips are mixed to 16 kHz mono, transcribed on this computer by
// whisper.cpp (Ubuntu's package) with a model downloaded once, grouped into short captions and
// placed as title clips on a Captions track. Each caption can be edited like any title, or all
// of them at once in Edit captions. Captions can be burned into the video, saved as an .srt file
// next to it, or both.
import { h, icon, clamp } from '../util.js';
import { store, edit, makeClip, addClip, videoTracks, ensureTrack, selectedClips, projectDuration, mediaById, select, removeClips } from '../state.js';
import { app } from '../actions.js';
import { TITLES, titleById } from '../templates/titles.js';
import { roleOf } from '../engine/duck.js';
import { decodeFile, encodeWav } from '../engine/audio.js';
import { playPath } from '../engine/media.js';
import { modal, slider, toast } from './widgets.js';

export const CAPTION_MODES = [['burn', 'Always on screen (burned into the video)'], ['file', 'As a caption file (.srt) viewers can turn on'], ['both', 'Both']];
export const LANGS = [['auto', 'Detect automatically'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['nl', 'Dutch'], ['pl', 'Polish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['tr', 'Turkish'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese']];
const STYLES = () => TITLES.filter((t) => t.cat === 'Subtitles');
export const captionClips = (p = store.project) => p.clips.filter((c) => c.caption).sort((a, b) => a.start - b.start);
export const captionMode = () => store.project.captions?.mode || 'burn';

// ---------- words into captions ----------
// Phrases end at the end of a sentence or at a clear pause. A phrase longer than maxWords words or about
// 5 seconds is split into even parts (at a comma when one is close), so no word is left alone at the end.
export function groupWords(words, maxWords = 7) {
  const phrases = [];
  let cur = [];
  for (const w of words) {
    if (cur.length && w.t0 - cur.at(-1).t1 > 0.7) { phrases.push(cur); cur = []; }
    cur.push(w);
    if (/[.!?]["”’)]*$/.test(w.text)) { phrases.push(cur); cur = []; }
  }
  if (cur.length) phrases.push(cur);
  const out = [];
  for (const p of phrases) {
    const n = p.length;
    const k = Math.min(n, Math.max(Math.ceil(n / maxWords), Math.ceil((p.at(-1).t1 - p[0].t0) / 5)));
    let i = 0;
    for (let part = 1; part < k; part++) {
      const left = k - part; // parts still to come after this cut
      const lo = Math.max(i + 1, n - left * maxWords), hi = Math.min(i + maxWords, n - left);
      const ideal = Math.min(hi, Math.max(lo, i + Math.round((n - i) / (left + 1))));
      let cut = ideal;
      for (const d of [0, 1, -1, 2, -2]) {
        const j = ideal + d;
        if (j >= lo && j <= hi && /[,;:]["”’)]*$/.test(p[j - 1].text)) { cut = j; break; }
      }
      out.push(p.slice(i, cut));
      i = cut;
    }
    out.push(p.slice(i));
  }
  return out;
}

// Whisper gives where each word starts; where it ends is read from the sound. The sound is split into
// stretches of speech (gaps under a quarter second count as speech). A word ends where its stretch ends, or
// where the next word starts. A word that starts in a clear silence moves up to where the speech begins, and
// a word placed in a silence with no speech after it (whisper sometimes trails the last words of a sentence)
// moves back to the end of the speech before it.
export function fitWordsToSound(words, samples, sr) {
  const hop = Math.max(1, Math.round(sr / 100)), n = Math.floor(samples.length / hop);
  if (!n) return words;
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) { let s = 0; for (let i = f * hop, e = i + hop; i < e; i++) s += samples[i] * samples[i]; rms[f] = Math.sqrt(s / hop); }
  const sorted = Float32Array.from(rms).sort();
  const floor = sorted[Math.floor(n * 0.1)], peak = sorted[Math.floor(n * 0.95)];
  const thr = peak > floor * 2 ? floor + (peak - floor) * 0.1 : 0; // no clear quiet parts: treat it all as sound
  const runs = []; // [start, end) in seconds
  for (let f = 0; f < n; f++) {
    if (rms[f] < thr) continue;
    const last = runs.at(-1);
    if (last && f / 100 - last[1] < 0.25) last[1] = (f + 1) / 100; else runs.push([f / 100, (f + 1) / 100]);
  }
  const speech = runs.filter(([a, b]) => b - a >= 0.05); // ignore clicks
  const out = words.map((w) => ({ ...w }));
  out.forEach((w, i) => {
    const lim = Math.min(words[i + 1]?.t0 ?? Infinity, w.t0 + 3, n / 100);
    const prev = out[i - 1];
    let run = speech.find(([a, b]) => a <= w.t0 && b > w.t0);
    if (!run) { // the word is marked in a pause: it goes with the nearer stretch of speech
      const after = speech.find(([a]) => a > w.t0 && a < lim);
      const before = prev && speech.findLast(([, b]) => b <= w.t0 && b > prev.t0);
      if (after && (!before || after[0] - w.t0 < w.t0 - before[1])) {
        if (after[0] - w.t0 >= 0.3) w.t0 = after[0] - 0.05;
        run = after;
      } else if (prev) {
        w.t0 = Math.max(prev.t0 + 0.05, Math.min(w.t0, prev.t1 - 0.1));
        w.t1 = Math.min(lim, w.t0 + 0.15);
        return;
      } else { w.t1 = Math.min(lim, w.t0 + 0.3); return; }
    }
    w.t1 = Math.max(Math.min(lim, w.t0 + 0.1), Math.min(lim, run[1] + 0.05));
  });
  return out;
}

// Caption clips for timeline-timed words.
export function buildCaptions(words, { style = 'sub-box', maxWords = 7 } = {}) {
  const tpl = titleById(style) || STYLES()[0];
  const groups = groupWords(words, maxWords);
  return groups.map((g, i) => {
    const start = g[0].t0;
    const next = groups[i + 1]?.[0].t0 ?? Infinity;
    const end = Math.min(Math.max(g.at(-1).t1 + 0.25, start + 0.7), next);
    const text = g.map((w) => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1');
    const c = makeClip('title', { template: tpl.id, name: text.length > 40 ? text.slice(0, 38) + '…' : text, start, duration: Math.min(Math.max(0.3, end - start), next - start), params: { texts: [text], colors: [...tpl.colors], words: g.map((w) => ({ t0: w.t0 - start, t1: w.t1 - start })) } });
    c.caption = true;
    return c;
  });
}

function captionTrack() {
  return videoTracks().find((t) => t.captions) || (() => { const t = ensureTrack('video', 'top'); t.name = 'Captions'; t.captions = true; return t; })();
}

// ---------- the speech to transcribe ----------
async function speechAudio(clips, from, to) {
  const sr = 16000;
  const octx = new OfflineAudioContext(1, Math.ceil((to - from) * sr) + 1, sr);
  let any = false;
  for (const c of clips) {
    const m = mediaById(c.mediaId);
    if (!m || m.hasAudio === false) continue;
    const buf = await decodeFile(c.audioFx?.denoisePath || playPath(m));
    if (!buf) continue;
    const a = Math.max(c.start, from), b = Math.min(c.start + c.duration, to);
    if (b <= a) continue;
    const speed = c.speed || 1;
    const src = octx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = speed;
    const g = octx.createGain(); g.gain.value = Math.min(2, c.volume ?? 1);
    src.connect(g); g.connect(octx.destination);
    src.start(a - from, (c.in || 0) + (a - c.start) * speed, (b - a) * speed);
    any = true;
  }
  if (!any) return null;
  return octx.startRendering();
}

// ---------- Generate captions ----------
export async function openCaptions() {
  if (!store.project) return;
  if (store.playing) app.player.pause();
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('current.captions') || '{}'); } catch { return {}; } })();
  const sel = selectedClips().find((c) => c.type === 'video' || c.type === 'audio');
  const voices = store.project.clips.filter((c) => (c.type === 'video' || c.type === 'audio') && !c.muted && roleOf(c) === 'voice');
  const o = { source: sel ? 'selected' : 'voices', lang: prefs.lang || 'auto', model: prefs.model || 'standard', style: prefs.style || 'sub-box', maxWords: prefs.maxWords || 7, mode: captionMode() };
  const status = await window.native.captionsStatus();
  const chip = (key, val, label) => h('button.chip-btn', { class: `chip-btn${o[key] === val ? ' on' : ''}`, onclick: () => { o[key] = val; paint(); } }, label);
  const body = h('div.cap');
  const mb = (n) => `${Math.round(n / 1e6)} MB`;
  function paint() {
    body.replaceChildren(
      !status.engine ? h('div.cap-warn', icon('info', 16), h('div', h('b', 'Speech recognition is not installed yet.'), h('div', 'Install it once from Ubuntu’s software archive, then press Check again:'), h('div.cap-cmd', h('code', 'sudo apt install whisper.cpp'), h('button.btn.small', { onclick: () => navigator.clipboard.writeText('sudo apt install whisper.cpp').then(() => toast('Copied')) }, icon('copy', 13), 'Copy'), h('button.btn.small', { onclick: async () => { Object.assign(status, await window.native.captionsStatus()); paint(); refresh(); } }, 'Check again')))) : null,
      h('div.row', h('label', 'Captions for'), h('div.chips', chip('source', 'voices', `All voices (${voices.length} clip${voices.length === 1 ? '' : 's'})`), sel ? chip('source', 'selected', 'The selected clip') : null)),
      h('div.row', h('label', 'Language'), h('select.grow', { onchange: (e) => { o.lang = e.target.value; } }, LANGS.map(([v, n]) => h('option', { value: v, selected: o.lang === v }, n)))),
      h('div.row', h('label', 'Accuracy'), h('div.chips',
        chip('model', 'standard', `Standard${status.models.standard.have ? '' : ` · ${mb(status.models.standard.size)} download`}`),
        chip('model', 'accurate', `Most accurate${status.models.accurate.have ? '' : ` · ${mb(status.models.accurate.size)} download`}`))),
      h('div.row', h('label', 'Style'), h('select.grow', { onchange: (e) => { o.style = e.target.value; } }, STYLES().map((t) => h('option', { value: t.id, selected: o.style === t.id }, t.name)))),
      slider({ label: 'Words per caption', min: 2, max: 14, step: 1, value: o.maxWords, onInput: (v) => { o.maxWords = Math.round(v); } }),
      h('div.row.cap-mode', h('label', 'Show captions'), h('div.cap-modes', CAPTION_MODES.map(([v, n]) => h('label.cap-radio', h('input', { type: 'radio', name: 'capmode', checked: o.mode === v, onchange: () => { o.mode = v; } }), n)))),
      h('div.hint', 'Everything runs on this computer; nothing is uploaded. The model is downloaded once. Captions already in the same place are replaced, and every caption can be edited afterwards.'));
  }
  paint();
  const dlg = modal({
    title: 'Generate captions', body, width: '620px',
    actions: [
      { label: 'Cancel', run: (c) => c() },
      { label: 'Generate captions', primary: true, run: (c) => {
        if (!status.engine) { toast('Install speech recognition first (see the top of this window).', 'err'); return; }
        try { localStorage.setItem('current.captions', JSON.stringify({ lang: o.lang, model: o.model, style: o.style, maxWords: o.maxWords })); } catch { /* fine */ }
        c();
        generate(o, o.source === 'selected' ? sel : null, voices);
      } },
    ],
  });
  const go = dlg.el.querySelector('.modal-f .btn.primary');
  go.prepend(icon('cc', 15));
  const refresh = () => { go.disabled = !status.engine; };
  refresh();
}

async function generate(o, clip, voices) {
  const clips = clip ? [clip] : voices;
  if (!clips.length) { toast('There are no voice clips to caption. Mark a clip as Voice in its Audio tab, or select one.', 'err', 7000); return; }
  const from = clip ? clip.start : 0, to = clip ? clip.start + clip.duration : projectDuration();
  const label = h('div.big', 'Getting ready…'), bar = h('i'), info = h('div.hint', '');
  let cancelled = false;
  const m = modal({ title: 'Generating captions', closable: false, body: h('div.exp-progress', label, h('div.progress', bar), info), actions: [{ label: 'Cancel', run: async (close) => { cancelled = true; await window.native.captionsCancel(); close(); } }] });
  const off = window.native.onCaptionsProgress(({ phase, p }) => {
    bar.style.width = `${clamp(p) * 100}%`;
    label.textContent = phase === 'download' ? `Downloading the speech model… ${Math.round(p * 100)}%` : `Listening… ${Math.round(p * 100)}%`;
  });
  try {
    const status = await window.native.captionsStatus();
    if (!status.models[o.model].have) {
      info.textContent = 'This happens once. Later captions start right away.';
      await window.native.captionsDownload(o.model);
    }
    if (cancelled) return;
    label.textContent = 'Preparing the sound…'; info.textContent = '';
    const audio = await speechAudio(clips, from, to);
    if (!audio) throw new Error('These clips have no sound to caption.');
    const path = await window.native.cacheWrite(`captions-${Date.now()}.wav`, encodeWav(audio));
    label.textContent = 'Listening… 0%';
    info.textContent = 'Speech recognition runs on this computer. Longer videos take a little while.';
    const heard = await window.native.captionsTranscribe(path, o.model, o.lang);
    const words = fitWordsToSound(heard, audio.getChannelData(0), audio.sampleRate).map((w) => ({ ...w, t0: w.t0 + from, t1: w.t1 + from }));
    if (cancelled) return;
    m.close();
    if (!words.length) { toast('No speech was found, so no captions were added.', 'err', 6000); return; }
    const made = buildCaptions(words, o);
    edit(() => {
      const old = captionClips().filter((c) => c.start < to && c.start + c.duration > from).map((c) => c.id);
      removeClips(old);
      const track = captionTrack();
      for (const c of made) { c.trackId = track.id; addClip(c, { overwrite: false }); }
      store.project.captions = { ...(store.project.captions || {}), mode: o.mode };
      select([]);
    });
    app.player.seek(store.time);
    toast(`${made.length} captions added on the Captions track. Edit them in Tools › Edit captions, or select one to change it.`, '', 7000);
  } catch (e) {
    if (!cancelled) { m.close(); toast(`Captions could not be made: ${e.message}`, 'err', 8000); }
  } finally { off(); }
}

// ---------- Edit captions ----------
export function openCaptionEditor() {
  const list = h('div.cap-list');
  const paint = () => {
    const caps = captionClips();
    if (!caps.length) { list.replaceChildren(h('div.hint', { style: { padding: '20px 4px' } }, 'No captions yet. Use Generate captions, or add a title from Titles › Subtitles.')); return; }
    list.replaceChildren(...caps.map((c) => {
      const inp = h('input.grow', { type: 'text', value: c.params.texts[0] || '', onchange: () => edit(() => {
        const v = inp.value.trim();
        if (v.split(/\s+/).length !== (c.params.words || []).length) delete c.params.words; // word timings no longer match
        c.params.texts[0] = v;
        c.name = v.length > 40 ? v.slice(0, 38) + '…' : v;
      }) });
      return h('div.cap-row',
        h('button.btn.small.ghost.cap-time', { title: 'Go to this caption', onclick: () => { app.player.seek(c.start + 0.01); select(c.id); } }, `${Math.floor(c.start / 60)}:${(c.start % 60).toFixed(1).padStart(4, '0')}`),
        inp,
        h('button.ibtn.sm', { title: 'Delete this caption', onclick: () => { edit(() => removeClips([c.id])); paint(); } }, icon('trash', 14)));
    }));
  };
  const caps = captionClips();
  const style = h('select.grow', { onchange: () => edit(() => captionClips().forEach((c) => { const t = titleById(style.value); c.template = t.id; c.params.colors = [...t.colors]; })) },
    STYLES().map((t) => h('option', { value: t.id, selected: caps[0]?.template === t.id }, t.name)));
  const mode = h('select.grow', { onchange: () => edit(() => { store.project.captions = { ...(store.project.captions || {}), mode: mode.value }; }) },
    CAPTION_MODES.map(([v, n]) => h('option', { value: v, selected: captionMode() === v }, n)));
  paint();
  modal({
    title: 'Edit captions', width: '720px',
    body: h('div.cap', h('div.row', h('label', 'Style'), style), h('div.row', h('label', 'Show captions'), mode), list,
      h('div.hint', 'Changes apply as you leave each line. Select a caption on the timeline to move it, change its timing or style it like any title.')),
    actions: [{ label: 'Done', primary: true, run: (c) => c() }],
  });
}

// ---------- the caption file ----------
const srtTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
export function captionsSrt(p = store.project) {
  return captionClips(p).map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.duration)}\n${(c.params.texts?.[0] || '').trim()}\n`).join('\n');
}
