// The assistant's tools: everything Claude may look at or change in the open project, used by both
// ways in (the connector for Claude's own apps, and the panel inside Current). Each tool has a name,
// a description and a JSON input schema for Claude, and a function that runs it here in the editor.
//
// Times are seconds. Timeline times count from the start of the video; "in" and "out" on media count
// from the start of the file. Claude never exports, saves, opens or deletes files.
//
// runTool(name, input, request) checks the input, runs the tool and returns
// { ok, content: [{ type: 'text', text } | { type: 'image', data, mediaType }] }.
// All edits made between beginRequest() and endRequest() undo as one step.
import {
  store, edit, makeClip, addClip, mediaById, clipById, trackById, mainTrack, videoTracks, trackClips, clipEnd,
  removeClips, splitClip, ensureTrack, freeTrack, projectDuration, clampClip, beginGroup, endGroup, groupBusy,
  cloneClip, VISUAL, AUDIBLE,
} from '../state.js';
import { app, clipFromPayload, insertPack, setTransition, setSpeed, retimeTimer, buildFromTemplate } from '../actions.js';
import { TITLES, titleById } from '../templates/titles.js';
import { PACKS, packById } from '../templates/packs.js';
import { AUDIO_LIBRARY } from '../templates/audiolib.js';
import { SONGS } from '../templates/songs.js';
import { ELEMENTS, BACKGROUNDS, elementById, backgroundById } from '../templates/elements.js';
import { EFFECTS, FILTERS, effectById, filterById } from '../templates/effects.js';
import { TRANSITIONS } from '../templates/transitions.js';
import { PROJECT_TEMPLATES } from '../templates/projects.js';
import { TIMER } from '../templates/scenekit.js';
import { findPauses, removePauses } from '../ui/silence.js';
import { transcribeClips, buildCaptions, placeCaptions, groupWords, captionClips, captionMode } from '../ui/captions.js';
import { roleOf } from '../engine/duck.js';
import { activeKit, brandClip } from '../brand.js';
import { templateOf } from '../engine/renderer.js';
import { EPS, clamp, FONTS } from '../util.js';
import { mediaFrame, contactSheet, analyseMedia, mediaOrThrow, clockLabel, cacheGet, cachePut, waveform, SHEET_MAX } from './analyze.js';

// ---------- schema helpers ----------
const num = (description, extra) => ({ type: 'number', description, ...extra });
const str = (description, extra) => ({ type: 'string', description, ...extra });
const bool = (description) => ({ type: 'boolean', description });
const oneOf = (values, description) => ({ type: 'string', enum: values, description });
const list = (items, description, extra) => ({ type: 'array', items, description, ...extra });
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const CLIP_ID = str('A clip id from get_project.');
const MEDIA_ID = str('A media id from list_media.');
const TIME = num('Seconds from the start of the video.', { minimum: 0 });
const TRACK = str('Where it goes: "main" (the main video track), "overlay" (a free track above the main one, for things shown on top), "audio" (a free audio track), or a track id from get_project.');
const MAKE_ROOM = bool('Make room at `at`: whatever is there is split, and everything from that time on (every track) moves later by this item\'s length, like inserting a scene. Without it, the spot must be free.');

// ---------- small helpers ----------
class ToolError extends Error {}
const fail = (msg) => { throw new ToolError(msg); };
const r2 = (t) => Math.round(t * 100) / 100;
const ts = clockLabel;

function clipOrThrow(id) {
  const c = clipById(id);
  if (!c) fail(`There is no clip ${id}. Call get_project for the current ids.`);
  if (trackById(c.trackId)?.locked) fail(`${c.name} is on a locked track.`);
  return c;
}
const isFree = (track, start, end, exceptId) => !trackClips(track.id).some((o) => o.id !== exceptId && o.start < end - EPS && clipEnd(o) > start + EPS);
const blocker = (track, start, end, exceptId) => trackClips(track.id).find((o) => o.id !== exceptId && o.start < end - EPS && clipEnd(o) > start + EPS);
const trackEnd = (track) => trackClips(track.id).reduce((m, o) => Math.max(m, clipEnd(o)), 0);

// A free video track above the main one (the Captions track stays on top).
function overlayTrack(start, end, exceptId) {
  const vids = videoTracks(), mi = vids.indexOf(mainTrack());
  for (let i = mi - 1; i >= 0; i--) {
    const t = vids[i];
    if (!t.locked && !t.captions && isFree(t, start, end, exceptId)) return t;
  }
  const t = ensureTrack('video', 'top');
  const cap = store.project.tracks.find((x) => x.captions);
  if (cap) {
    const all = store.project.tracks;
    all.splice(all.indexOf(cap), 1);
    all.splice(all.findIndex((x) => x.kind === 'video'), 0, cap);
  }
  return t;
}

// Split what is at time t and move everything from t on later by d (unlocked tracks), like a mid-roll.
function makeRoomAt(t, d) {
  for (const o of [...store.project.clips]) if (o.start < t - EPS && clipEnd(o) > t + EPS && !trackById(o.trackId)?.locked) splitClip(o, t);
  for (const o of store.project.clips) if (o.start >= t - EPS && !trackById(o.trackId)?.locked) o.start += d;
}

// Work out where a new clip goes (before any change, so a refusal leaves the project untouched),
// then return a function that puts it there. Call that inside edit().
function planPlace(c, { at, track, makeRoom }) {
  const audio = c.type === 'audio';
  const where = track || (audio ? 'audio' : 'main');
  const dur = c.duration;
  let start, pick;
  if (where === 'audio') {
    if (!audio) fail('Only sound goes on an audio track.');
    start = at ?? 0;
    pick = () => freeTrack('audio', start, start + dur);
  } else if (where === 'overlay') {
    if (audio) fail('Sound goes on an audio track, not an overlay.');
    start = at ?? 0;
    pick = () => overlayTrack(start, start + dur);
  } else {
    const tr = where === 'main' ? mainTrack() : trackById(where);
    if (!tr) fail(`There is no track ${where}.`);
    if ((tr.kind === 'audio') !== audio) fail(audio ? 'Sound goes on an audio track.' : 'Pictures go on a video track.');
    if (tr.locked) fail(`${tr.name} is locked.`);
    start = at ?? trackEnd(tr);
    if (!makeRoom) {
      const b = blocker(tr, start, start + dur);
      if (b) fail(`${tr.name} is taken from ${ts(b.start)} to ${ts(clipEnd(b))} by ${b.name}. Use make_room to insert here, choose another time, or use the overlay track.`);
    }
    pick = () => tr;
  }
  return () => {
    if (makeRoom) makeRoomAt(start, dur);
    const tr = pick();
    c.trackId = tr.id;
    c.start = Math.max(0, start);
    addClip(c, { overwrite: false });
    return c;
  };
}

function clipInfo(c) {
  const o = { id: c.id, type: c.type, track: c.trackId, start: r2(c.start), end: r2(clipEnd(c)), name: c.name };
  if (c.mediaId) { o.media_id = c.mediaId; o.in = r2(c.in || 0); if ((c.speed || 1) !== 1) o.speed = r2(c.speed); }
  if (c.template) o.template = c.template;
  if (c.params?.texts) o.texts = c.params.texts;
  if (c.params?.font) o.font = c.params.font;
  if (c.params?.colors && c.type !== 'background') o.colors = c.params.colors;
  if (AUDIBLE.has(c.type)) {
    o.sound = roleOf(c);
    if (c.muted) o.muted = true;
    if ((c.volume ?? 1) !== 1) o.volume = r2(c.volume);
    if (c.fadeIn) o.fade_in = r2(c.fadeIn);
    if (c.fadeOut) o.fade_out = r2(c.fadeOut);
  }
  if (c.filter) o.filter = c.filter.id;
  if (c.effects?.length) o.effects = c.effects.map((e) => e.id);
  if (c.tIn) o.transition_in = c.tIn.id;
  if (c.tOut) o.transition_out = c.tOut.id;
  if (c.type === 'background' && /^Your clip/.test(c.name)) o.clip_block = true;
  if (c.template === 'seq-edu-timer') o.timer_seconds = r2(c.duration - TIMER.lead - TIMER.tail);
  return o;
}

const shapeOf = (w, h) => (!w || !h ? null : Math.abs(w - h) / Math.max(w, h) < 0.05 ? 'square' : w > h ? 'wide' : 'tall');
const aspectOf = (p) => { const r = p.width / p.height; return Object.entries({ '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 0.8, '4:3': 4 / 3, '21:9': 21 / 9 }).find(([, v]) => Math.abs(v - r) < 0.02)?.[0] || `${p.width}×${p.height}`; };
const songOf = (id) => SONGS.find((s) => s[0] === id)?.[2];

// The voice clips (what captions and transcripts listen to).
const voiceClips = () => store.project.clips.filter((c) => (c.type === 'video' || c.type === 'audio') && !c.muted && roleOf(c) === 'voice');

function phrasesOf(words) {
  return groupWords(words, 14).map((g) => ({ start: r2(g[0].t0), end: r2(g.at(-1).t1), text: g.map((w) => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1') }));
}

// ---------- the library, for list_library ----------
const LIBRARY = {
  title: () => TITLES.filter((t) => !t.seq).map((t) => ({ id: t.id, name: t.name, category: t.cat, seconds: t.dur, texts: t.texts })),
  sequence: () => PACKS.map((p) => ({ id: p.id, name: p.name, category: p.cat, role: p.role, seconds: r2(p.dur) })),
  music: () => AUDIO_LIBRARY.filter((a) => a.cat === 'Music').map((a) => { const s = songOf(a.id); return { id: a.id, name: a.name, seconds: a.dur, ...(s ? { bpm: s.bpm, mode: s.mode, groove: s.groove } : {}) }; }),
  sound_effect: () => AUDIO_LIBRARY.filter((a) => a.cat === 'Sound Effects').map((a) => ({ id: a.id, name: a.name, seconds: a.dur })),
  sticker: () => ELEMENTS.map((e) => ({ id: e.id, name: e.name, category: e.cat, seconds: e.dur })),
  background: () => BACKGROUNDS.map((b) => ({ id: b.id, name: b.name, category: b.cat })),
  transition: () => TRANSITIONS.map((t) => ({ id: t.id, name: t.name, category: t.cat })),
  effect: () => EFFECTS.map((e) => ({ id: e.id, name: e.name, category: e.cat, default_amount: e.def })),
  filter: () => FILTERS.map((f) => ({ id: f.id, name: f.name, category: f.cat })),
  starter_template: () => PROJECT_TEMPLATES.map((t) => ({ id: t.id, name: t.name, shape: t.aspect, about: t.desc, clip_blocks: t.scenes.map((s) => s[0]) })),
};

// ---------- the tools ----------
const T = [];
const tool = (name, description, input_schema, run, readOnly = false) => T.push({ name, description, input_schema, run, readOnly });

// Looking (changes nothing)
tool('get_project',
  'The open project: its shape, length, tracks and every clip on the timeline (ids, times, names, texts, sound, effects, transitions). Call this before editing and again after big changes. Caption clips are summarised unless include_captions is true.',
  obj({ include_captions: bool('List every caption clip too.') }),
  async ({ include_captions }) => {
    const p = store.project;
    const caps = captionClips();
    const clips = p.clips.filter((c) => include_captions || !c.caption).sort((a, b) => a.start - b.start).map(clipInfo);
    return { data: {
      name: p.name, shape: aspectOf(p), width: p.width, height: p.height, fps: p.fps, duration: r2(projectDuration()), playhead: r2(store.time),
      tracks: p.tracks.map((t) => ({ id: t.id, name: t.name, kind: t.kind, ...(t.main ? { main: true } : {}), ...(t.captions ? { captions: true } : {}), ...(t.locked ? { locked: true } : {}) })),
      clips,
      captions: caps.length ? { count: caps.length, show: captionMode() } : null,
      media_items: p.media.filter((m) => !m.library).length,
    } };
  }, true);

tool('list_media',
  'Everything in Project Media that can be put on the timeline: the person\'s own videos, photos and sound, with length, shape, size, whether it has sound and whether it is already used. Library music already added shows as library: true.',
  obj({}),
  async () => {
    const used = new Set(store.project.clips.map((c) => c.mediaId).filter(Boolean));
    const items = [];
    for (const m of store.project.media) {
      const st = await window.native.stat(m.path).catch(() => null);
      items.push({
        id: m.id, name: m.name, type: m.type, seconds: m.type === 'image' ? null : r2(m.duration || 0),
        ...(m.width ? { width: m.width, height: m.height, shape: shapeOf(m.width, m.height) } : {}),
        has_sound: m.type === 'image' ? false : m.hasAudio !== false,
        used: used.has(m.id),
        ...(st?.mtime ? { file_date: new Date(st.mtime).toISOString().slice(0, 10) } : {}),
        ...(m.library ? { library: true } : {}), ...(m.missing ? { missing: true } : {}),
      });
    }
    return { data: { media: items } };
  }, true);

tool('view_media',
  `A contact sheet of one video: several frames from it in one picture, each labelled with its time in the file. This is how to watch footage (you see stills, not motion). Narrow from/to to look closer at part of a long video. Photos come back whole. Up to ${SHEET_MAX} frames.`,
  obj({ media_id: MEDIA_ID, from: num('Seconds into the file to start (default 0).', { minimum: 0 }), to: num('Seconds into the file to end (default: the end).', { minimum: 0 }), count: { type: 'integer', minimum: 1, maximum: SHEET_MAX, description: 'How many frames (default 9).' } }, ['media_id']),
  async ({ media_id, from, to, count }) => {
    const m = mediaOrThrow(media_id);
    const s = await contactSheet(m, { from, to, count: count ?? 9 });
    return { data: { media_id: m.id, name: m.name, frame_times: s.times }, images: [s] };
  }, true);

tool('view_media_frame',
  'One full frame of a video (or a photo) at a time in the file, to check a moment closely.',
  obj({ media_id: MEDIA_ID, time: num('Seconds into the file.', { minimum: 0 }) }, ['media_id', 'time']),
  async ({ media_id, time }) => {
    const m = mediaOrThrow(media_id);
    if (m.type === 'video' && time > m.duration) fail(`${m.name} is only ${r2(m.duration)} seconds long.`);
    const f = await mediaFrame(m, time);
    return { data: { media_id: m.id, name: m.name, time: r2(time) }, images: [f] };
  }, true);

tool('view_frame',
  'What the finished video looks like at a time on the timeline, with every layer, title and effect. Use it to check your work.',
  obj({ time: TIME }, ['time']),
  async ({ time }) => {
    const p = store.project, dur = projectDuration();
    if (!dur) fail('The timeline is empty.');
    if (time > dur) fail(`The video is only ${r2(dur)} seconds long.`);
    const pl = app.player;
    const s = Math.min(1, 1024 / Math.max(p.width, p.height)), prev = pl.scale;
    pl.scale = s;
    try {
      const byTrack = await pl.prepareExact(time);
      pl.renderNow(time, byTrack);
      const canvas = pl.comp.canvas;
      return { data: { time: r2(time) }, images: [{ data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mediaType: 'image/jpeg' }] };
    } finally { pl.scale = prev; pl.requestRender(); }
  }, true);

tool('analyse_media',
  'Facts about one file worked out on this computer: shots (where the camera cuts), dark, soft (blurry or low detail) and shaky stretches, motion peaks (busiest moments), and for sound: quiet stretches, loud peaks and how much of it has sound. Ranges are [from, to] in seconds into the file. Slow the first time for long videos; then instant.',
  obj({ media_id: MEDIA_ID }, ['media_id']),
  async ({ media_id }) => ({ data: await analyseMedia(mediaOrThrow(media_id)) }), true);

tool('get_media_transcript',
  'What is said in one file and when (seconds into the file), heard on this computer. Phrases by default; words: true adds each word\'s time, for exact cuts.',
  obj({ media_id: MEDIA_ID, language: str('A language code such as "en", or "auto" (default).'), words: bool('Also list every word with its times.'), download_model: bool('Allow downloading the speech model (60 MB) if it is missing. Ask the person first.') }, ['media_id']),
  async ({ media_id, language = 'auto', words: wantWords, download_model }) => {
    const m = mediaOrThrow(media_id);
    if (m.type === 'image') fail(`${m.name} is a photo.`);
    if (m.hasAudio === false) fail(`${m.name} has no sound.`);
    const key = `transcript-${language}`;
    let words = (await cacheGet(m, key))?.words;
    if (!words) {
      words = await transcribeClips([{ mediaId: m.id, start: 0, duration: m.duration, in: 0, speed: 1, volume: 1 }], 0, m.duration, { lang: language, download: !!download_model });
      await cachePut(m, key, { words });
    }
    return { data: { media_id: m.id, name: m.name, phrases: phrasesOf(words), ...(wantWords ? { words: words.map((w) => ({ text: w.text, start: r2(w.t0), end: r2(w.t1) })) } : {}), ...(words.length ? {} : { note: 'No speech was found.' }) } };
  }, true);

tool('get_transcript',
  'What is said in the video as it is now, timed on the timeline: every clip marked as voice, heard on this computer.',
  obj({ language: str('A language code such as "en", or "auto" (default).'), download_model: bool('Allow downloading the speech model (60 MB) if it is missing. Ask the person first.') }),
  async ({ language = 'auto', download_model }) => {
    const voices = voiceClips();
    if (!voices.length) fail('No clips are marked as voice. Use set_clip_type, or add clips with speech.');
    const words = await transcribeClips(voices, 0, projectDuration(), { lang: language, download: !!download_model });
    return { data: { phrases: phrasesOf(words), ...(words.length ? {} : { note: 'No speech was found.' }) } };
  }, true);

tool('find_pauses',
  'The quiet stretches in a clip, as timeline times, without changing anything.',
  obj({ clip_id: CLIP_ID, quieter_than_db: num('How far below the loudest part counts as quiet (default 30).', { minimum: 6, maximum: 60 }), min_seconds: num('Shortest pause to report (default 0.7).', { minimum: 0.2, maximum: 10 }) }, ['clip_id']),
  async ({ clip_id, quieter_than_db = 30, min_seconds = 0.7 }) => {
    const c = clipById(clip_id) || fail(`There is no clip ${clip_id}.`);
    const m = AUDIBLE.has(c.type) && mediaById(c.mediaId);
    if (!m) fail(`${c.name} has no sound.`);
    await waveform(m);
    const p = findPauses(c, { rel: quieter_than_db, minLen: min_seconds }) || [];
    return { data: { pauses: p.map(([a, b]) => [r2(c.start + a), r2(c.start + b)]) } };
  }, true);

tool('list_library',
  'Search Current\'s built-in library. Kinds: title (text designs), sequence (ready-made intros, outros and mid-rolls in sections: Intros, Outros, Education, Professional, News, Gaming, Travel), music (with bpm and mode), sound_effect, sticker, background, transition, effect, filter, starter_template (whole layouts with clip blocks to fill). Without a category, the categories are listed too.',
  obj({ kind: oneOf(Object.keys(LIBRARY), 'What to list.'), category: str('Only this category.'), search: str('Words to look for in names and categories.'), limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many to return (default 40).' } }, ['kind']),
  async ({ kind, category, search, limit = 40 }) => {
    let items = LIBRARY[kind]();
    const cats = [...new Set(items.map((i) => i.category).filter(Boolean))];
    if (category) items = items.filter((i) => (i.category || '').toLowerCase() === category.toLowerCase());
    if (search) {
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      items = items.filter((i) => { const hay = `${i.name} ${i.category || ''} ${i.id} ${i.groove || ''} ${i.mode || ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
    }
    return { data: { kind, total: items.length, ...(category ? {} : { categories: cats }), items: items.slice(0, limit) } };
  }, true);

// Editing
tool('add_media',
  'Put a file from Project Media on the timeline. For video and sound, in/out pick the part of the file (seconds into the file). Without `at` it goes after the last clip on its track, so calling it in order builds the video from start to end.',
  obj({ media_id: MEDIA_ID, in: num('Start, in seconds into the file (default 0).', { minimum: 0 }), out: num('End, in seconds into the file (default: the end).', { minimum: 0 }), seconds: num('How long a photo shows (default 5).', { minimum: 0.2, maximum: 600 }), at: TIME, track: TRACK, make_room: MAKE_ROOM }, ['media_id']),
  async ({ media_id, in: inP, out, seconds, at, track, make_room }) => {
    const m = mediaOrThrow(media_id);
    let c;
    if (m.type === 'image') c = makeClip('image', { mediaId: m.id, name: m.name, duration: seconds ?? 5 });
    else {
      const a = inP ?? 0, b = out ?? m.duration;
      if (a >= m.duration - 0.05) fail(`${m.name} is only ${r2(m.duration)} seconds long.`);
      if (b <= a + 0.05) fail('out must be after in.');
      if (b > m.duration + 0.05) fail(`${m.name} is only ${r2(m.duration)} seconds long.`);
      c = makeClip(m.type, { mediaId: m.id, name: m.name, in: a, duration: Math.min(b, m.duration) - a });
      if (m.type === 'video' && m.hasAudio === false) c.muted = true;
    }
    const put = planPlace(c, { at, track, makeRoom: make_room });
    edit(put);
    return { data: { clip: clipInfo(c) }, done: `Added ${m.name}${m.type === 'image' ? '' : ` (${ts(c.in)}–${ts(c.in + c.duration)})`} at ${ts(c.start)}` };
  });

tool('add_library_item',
  'Add something from the library (ids from list_library). Sequences are placed by `placement`: "start" (moves everything later), "end", or "at" (inserted at `at`, making room, unless make_room is false). Music and sound effects go on an audio track; music ducks under voices by itself. Titles, stickers, effects and filters go on the overlay track by default, so they show on top; `track: "main"` puts a title card or background in the main sequence.',
  obj({
    kind: oneOf(['sequence', 'title', 'music', 'sound_effect', 'sticker', 'background', 'effect', 'filter'], 'What it is.'),
    id: str('The library id.'),
    at: TIME, seconds: num('How long it lasts (titles, stickers, backgrounds, effects, filters), or where to stop music early.', { minimum: 0.3, maximum: 3600 }),
    placement: oneOf(['start', 'end', 'at'], 'Sequences only. Default: intros at the start, outros at the end; mid-rolls need "at".'),
    track: TRACK, make_room: MAKE_ROOM,
    texts: list(str('One line.'), 'Titles: the text lines, in order.', { minItems: 1, maxItems: 12 }),
    volume: num('Music and sound effects: 0 to 2 (1 is as made).', { minimum: 0, maximum: 2 }),
  }, ['kind', 'id']),
  async ({ kind, id, at, seconds, placement, track, make_room, texts, volume }) => {
    if (kind === 'sequence') {
      const pack = packById(id) || fail(`There is no sequence ${id}. Use list_library with kind "sequence".`);
      const where = placement || (pack.role === 'intro' ? 'start' : pack.role === 'outro' ? 'end' : 'at');
      if (where === 'at' && at == null) fail('Give `at` for where this sequence goes.');
      const before = new Set(store.project.clips.map((c) => c.id)), time = store.time;
      if (where === 'start') await insertPack({ ...pack, role: 'intro' }, undefined, true);
      else if (where === 'end') await insertPack({ ...pack, role: 'outro' }, undefined, true);
      else if (make_room === false) await insertPack(pack, { time: at, trackId: mainTrack().id }, true);
      else { store.time = Math.min(at, projectDuration()); await insertPack({ ...pack, role: 'mid' }, undefined, true); }
      store.time = time; app.player?.seek(time);
      const pieces = store.project.clips.filter((c) => !before.has(c.id)).sort((a, b) => a.start - b.start).map(clipInfo);
      return { data: { pieces }, done: `Added the ${pack.name} sequence at ${ts(pieces[0]?.start ?? 0)}` };
    }
    if (kind === 'music' || kind === 'sound_effect') {
      const item = AUDIO_LIBRARY.find((a) => a.id === id && (a.cat === 'Music') === (kind === 'music')) || fail(`There is no ${kind.replace('_', ' ')} ${id}.`);
      const c = await clipFromPayload({ kind: 'audio-lib', id: item.id });
      if (seconds && seconds < c.duration) { c.duration = seconds; if (kind === 'music') c.fadeOut = Math.min(2.5, seconds / 3); }
      if (volume != null) c.volume = volume;
      edit(planPlace(c, { at: at ?? 0, track: track === 'main' || track === 'overlay' ? 'audio' : track, makeRoom: make_room }));
      return { data: { clip: clipInfo(c) }, done: `Added ${item.name} at ${ts(c.start)}` };
    }
    const look = { title: titleById, sticker: elementById, background: backgroundById, effect: effectById, filter: filterById }[kind];
    const tpl = look(id);
    if (!tpl || (kind === 'title' && tpl.seq)) fail(`There is no ${kind} ${id}. Use list_library with kind "${kind}".`);
    const c = await clipFromPayload({ kind: kind === 'sticker' ? 'element' : kind, id });
    if (seconds) c.duration = seconds;
    if (texts) {
      if (kind !== 'title') fail('Only titles have text.');
      if (texts.length > tpl.texts.length) fail(`${tpl.name} has ${tpl.texts.length} line${tpl.texts.length > 1 ? 's' : ''} of text.`);
      texts.forEach((t, i) => { c.params.texts[i] = t; });
    }
    edit(planPlace(c, { at, track: track || (kind === 'background' ? 'main' : 'overlay'), makeRoom: make_room }));
    return { data: { clip: clipInfo(c) }, done: `Added ${tpl.name} at ${ts(c.start)}` };
  });

tool('start_from_template',
  'Lay out a starter template (list_library kind "starter_template"): an intro, clip blocks to fill with fill_clip_block, overlays, an outro and music. Only on an empty timeline.',
  obj({ template_id: str('The starter template id.') }, ['template_id']),
  async ({ template_id }) => {
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === template_id) || fail(`There is no starter template ${template_id}.`);
    if (store.project.clips.length) fail('The timeline must be empty to start from a template.');
    await buildFromTemplate(tpl, { keepHistory: true });
    const blocks = store.project.clips.filter((c) => c.type === 'background' && /^Your clip/.test(c.name)).sort((a, b) => a.start - b.start).map(clipInfo);
    const note = aspectOf(store.project) === tpl.aspect ? undefined : `This template was made for ${tpl.aspect}; the project is ${aspectOf(store.project)}.`;
    return { data: { clip_blocks: blocks, ...(note ? { note } : {}) }, done: `Laid out the ${tpl.name} template` };
  });

tool('fill_clip_block',
  'Replace a clip block (clip_block: true in get_project) with a file from Project Media, keeping the block\'s place, length and transitions. For video, `in` picks where in the file to start.',
  obj({ clip_id: CLIP_ID, media_id: MEDIA_ID, in: num('Start, in seconds into the file (default 0).', { minimum: 0 }) }, ['clip_id', 'media_id']),
  async ({ clip_id, media_id, in: inP = 0 }) => {
    const b = clipOrThrow(clip_id);
    if (!(b.type === 'background' && /^Your clip/.test(b.name))) fail(`${b.name} is not a clip block.`);
    const m = mediaOrThrow(media_id);
    if (m.type === 'audio') fail('A clip block needs a video or a photo.');
    if (m.type === 'video' && m.duration - inP < b.duration - 0.05) fail(`From ${ts(inP)}, ${m.name} has only ${r2(Math.max(0, m.duration - inP))} seconds, and the block is ${r2(b.duration)}. Start earlier, or trim the block first.`);
    const c = makeClip(m.type, { mediaId: m.id, name: m.name, duration: b.duration, ...(m.type === 'video' ? { in: inP } : {}) });
    if (m.type === 'video' && m.hasAudio === false) c.muted = true;
    edit(() => {
      Object.assign(c, { start: b.start, trackId: b.trackId, tIn: b.tIn, tOut: b.tOut });
      removeClips([b.id]);
      addClip(c, { overwrite: false });
    });
    return { data: { clip: clipInfo(c) }, done: `Filled “${b.name.replace(/^Your clip: /, '')}” with ${m.name}` };
  });

tool('split',
  'Cut a clip in two at a timeline time. Returns the id of the new right-hand part.',
  obj({ clip_id: CLIP_ID, time: TIME }, ['clip_id', 'time']),
  async ({ clip_id, time }) => {
    const c = clipOrThrow(clip_id);
    if (time <= c.start + 0.05 || time >= clipEnd(c) - 0.05) fail(`${time} is not inside ${c.name} (${r2(c.start)} to ${r2(clipEnd(c))}).`);
    const right = edit(() => splitClip(c, time));
    return { data: { left: clipInfo(c), right: clipInfo(right) }, done: `Split ${c.name} at ${ts(time)}` };
  });

tool('trim',
  'Change where a clip starts or ends on the timeline. For video and sound, the picture stays in sync: trimming the start skips into the file. The new range must be free on its track.',
  obj({ clip_id: CLIP_ID, start: num('New start on the timeline.', { minimum: 0 }), end: num('New end on the timeline.', { minimum: 0 }) }, ['clip_id']),
  async ({ clip_id, start, end }) => {
    const c = clipOrThrow(clip_id);
    if (start == null && end == null) fail('Give start, end or both.');
    const s = start ?? c.start, e = end ?? clipEnd(c);
    if (e - s < 0.1) fail('The clip would be shorter than a tenth of a second.');
    const speed = c.speed || 1;
    const newIn = 'in' in c ? (c.in || 0) + (s - c.start) * speed : null;
    if (newIn != null && newIn < -EPS) fail(`${c.name} cannot start earlier: the file starts ${r2(c.start - (c.in || 0) / speed)} seconds on the timeline.`);
    if (newIn != null && (c.type === 'video' || c.type === 'audio')) {
      const m = mediaById(c.mediaId);
      if (m?.duration && newIn + (e - s) * speed > m.duration + 0.05) fail(`${c.name} cannot run that long: its file ends at ${r2(s + (m.duration - newIn) / speed)} on the timeline.`);
    }
    const b = blocker(trackById(c.trackId), s, e, c.id);
    if (b) fail(`${b.name} is in the way (${ts(b.start)}–${ts(clipEnd(b))}).`);
    edit(() => {
      if (newIn != null) c.in = Math.max(0, newIn);
      c.start = s; c.duration = e - s;
      if (c.fadeIn) c.fadeIn = Math.min(c.fadeIn, c.duration);
      if (c.fadeOut) c.fadeOut = Math.min(c.fadeOut, c.duration);
      clampClip(c);
    });
    return { data: { clip: clipInfo(c) }, done: `Trimmed ${c.name} to ${ts(c.start)}–${ts(clipEnd(c))}` };
  });

tool('move',
  'Move a clip to another time, another track, or both. The new spot must be free.',
  obj({ clip_id: CLIP_ID, start: num('New start on the timeline.', { minimum: 0 }), track: TRACK }, ['clip_id']),
  async ({ clip_id, start, track }) => {
    const c = clipOrThrow(clip_id);
    const s = start ?? c.start, e = s + c.duration, audio = c.type === 'audio';
    let tr;
    if (!track) tr = trackById(c.trackId);
    else if (track === 'overlay') { if (audio) fail('Sound goes on an audio track.'); tr = null; }
    else if (track === 'audio') { if (!audio) fail('Only sound goes on an audio track.'); tr = null; }
    else {
      tr = track === 'main' ? mainTrack() : trackById(track);
      if (!tr) fail(`There is no track ${track}.`);
      if ((tr.kind === 'audio') !== audio) fail(audio ? 'Sound goes on an audio track.' : 'Pictures go on a video track.');
      if (tr.locked) fail(`${tr.name} is locked.`);
    }
    if (tr) { const b = blocker(tr, s, e, c.id); if (b) fail(`${tr.name} is taken there by ${b.name} (${ts(b.start)}–${ts(clipEnd(b))}).`); }
    edit(() => {
      const target = tr || (audio ? freeTrack('audio', s, e) : overlayTrack(s, e, c.id));
      c.start = s; c.trackId = target.id;
    });
    return { data: { clip: clipInfo(c) }, done: `Moved ${c.name} to ${ts(s)}` };
  });

tool('delete',
  'Remove clips from the timeline (the files stay in Project Media). close_gap moves later clips on the same track up to fill the space.',
  obj({ clip_ids: list(str('A clip id.'), 'The clips to remove.', { minItems: 1, maxItems: 500 }), close_gap: bool('Close the gaps left behind.') }, ['clip_ids']),
  async ({ clip_ids, close_gap }) => {
    const cs = clip_ids.map(clipOrThrow);
    edit(() => removeClips(cs.map((c) => c.id), !!close_gap));
    return { data: { removed: cs.length }, done: `Removed ${cs.length === 1 ? cs[0].name : `${cs.length} clips`}` };
  });

tool('set_speed',
  'Play a video or sound clip faster or slower (1 is normal). Later clips on the same track move to keep up.',
  obj({ clip_id: CLIP_ID, speed: num('0.25 to 4.', { minimum: 0.25, maximum: 4 }) }, ['clip_id', 'speed']),
  async ({ clip_id, speed }) => {
    const c = clipOrThrow(clip_id);
    if (c.type !== 'video' && c.type !== 'audio') fail('Only video and sound clips have a speed.');
    const end0 = clipEnd(c);
    edit(() => {
      setSpeed(c, speed);
      const d = clipEnd(c) - end0;
      for (const o of store.project.clips) if (o.trackId === c.trackId && o.id !== c.id && o.start >= end0 - EPS) o.start += d;
    });
    return { data: { clip: clipInfo(c) }, done: `Set ${c.name} to ${speed}× speed` };
  });

tool('freeze_frame',
  'Hold the picture of a video clip still at a timeline time; everything after it on that track moves later.',
  obj({ clip_id: CLIP_ID, time: TIME, seconds: num('How long to hold (default 2).', { minimum: 0.2, maximum: 30 }) }, ['clip_id', 'time']),
  async ({ clip_id, time, seconds = 2 }) => {
    const c = clipOrThrow(clip_id);
    if (c.type !== 'video') fail('Only video clips can freeze.');
    if (time <= c.start + 0.05 || time >= clipEnd(c) - 0.05) fail(`${time} is not inside ${c.name}.`);
    let hold;
    edit(() => {
      splitClip(c, time);
      hold = cloneClip(c);
      Object.assign(hold, { start: time, in: c.in + (time - c.start) * (c.speed || 1), speed: 0.0001, duration: seconds, muted: true, tIn: null, tOut: null, name: 'Freeze frame' });
      for (const o of store.project.clips) if (o.trackId === c.trackId && o.start >= time - EPS) o.start += seconds;
      store.project.clips.push(hold);
    });
    return { data: { clip: clipInfo(hold) }, done: `Froze ${c.name} at ${ts(time)} for ${seconds} s` };
  });

tool('set_text',
  'Change the words of a title, caption or sequence piece. texts replaces the lines in order; lines left out stay as they are.',
  obj({ clip_id: CLIP_ID, texts: list(str('One line.'), 'The new lines.', { minItems: 1, maxItems: 12 }) }, ['clip_id', 'texts']),
  async ({ clip_id, texts }) => {
    const c = clipOrThrow(clip_id);
    const tpl = c.type === 'title' && titleById(c.template);
    if (!tpl) fail(`${c.name} has no text to change.`);
    const cur = [...(c.params.texts || tpl.texts)];
    if (texts.length > cur.length) fail(`${c.name} has ${cur.length} line${cur.length > 1 ? 's' : ''} of text.`);
    edit(() => {
      texts.forEach((t, i) => { cur[i] = t; });
      if (c.caption && c.params.words && cur[0].split(/\s+/).length !== c.params.words.length) delete c.params.words;
      c.params.texts = cur;
      if (c.caption) c.name = cur[0].length > 40 ? cur[0].slice(0, 38) + '…' : cur[0];
    });
    return { data: { clip: clipInfo(c) }, done: `Changed the text of ${c.name}` };
  });

tool('set_style',
  `Change a title's or sticker's colours (hex like "#ff4d6d", in the template's order) or a title's font. Fonts: ${FONTS.join(', ')}; null goes back to the template's font.`,
  obj({ clip_id: CLIP_ID, colors: list(str('A colour like "#ffffff".', { pattern: '^#[0-9a-fA-F]{6}$' }), 'The colours in order; leave out ones to keep.', { minItems: 1, maxItems: 8 }), font: { type: ['string', 'null'], description: 'A font name from the list, or null.' } }, ['clip_id']),
  async ({ clip_id, colors, font }) => {
    const c = clipOrThrow(clip_id);
    if (!['title', 'element', 'background'].includes(c.type) || !c.params) fail(`${c.name} has no colours or font to change.`);
    if (colors && colors.length > (c.params.colors || []).length) fail(`${c.name} has ${(c.params.colors || []).length} colours.`);
    if (font !== undefined && c.type !== 'title') fail('Only titles have a font.');
    if (font && !FONTS.includes(font)) fail(`${font} is not one of the fonts.`);
    edit(() => {
      if (colors) colors.forEach((x, i) => { c.params.colors[i] = x.toLowerCase(); });
      if (font !== undefined) c.params.font = font;
    });
    return { data: { clip: clipInfo(c) }, done: `Restyled ${c.name}` };
  });

tool('apply_effect',
  'Add an effect to a clip (or change its amount, or remove it). Use list_library kind "effect" for ids.',
  obj({ clip_id: CLIP_ID, effect_id: str('The effect id.'), amount: num('0 to 1 (default: the effect\'s own).', { minimum: 0, maximum: 1 }), remove: bool('Take the effect off instead.') }, ['clip_id', 'effect_id']),
  async ({ clip_id, effect_id, amount, remove }) => {
    const c = clipOrThrow(clip_id);
    if (!VISUAL.has(c.type) || !c.effects) fail(`${c.name} cannot take effects.`);
    const e = effectById(effect_id) || fail(`There is no effect ${effect_id}.`);
    edit(() => {
      c.effects = c.effects.filter((x) => x.id !== e.id);
      if (!remove) c.effects.push({ id: e.id, amount: amount ?? e.def });
    });
    return { data: { clip: clipInfo(c) }, done: `${remove ? 'Removed' : 'Applied'} ${e.name} ${remove ? 'from' : 'to'} ${c.name}` };
  });

tool('apply_filter',
  'Give a clip a colour filter (list_library kind "filter"), or null to remove it.',
  obj({ clip_id: CLIP_ID, filter_id: { type: ['string', 'null'], description: 'The filter id, or null.' }, amount: num('0 to 1 (default 1).', { minimum: 0, maximum: 1 }) }, ['clip_id', 'filter_id']),
  async ({ clip_id, filter_id, amount = 1 }) => {
    const c = clipOrThrow(clip_id);
    if (!VISUAL.has(c.type) || !('filter' in c)) fail(`${c.name} cannot take a filter.`);
    const f = filter_id && (filterById(filter_id) || fail(`There is no filter ${filter_id}.`));
    edit(() => { c.filter = f ? { id: f.id, amount } : null; });
    return { data: { clip: clipInfo(c) }, done: f ? `Applied ${f.name} to ${c.name}` : `Removed the filter from ${c.name}` };
  });

tool('set_transition',
  'Set how a clip comes in (side "in", from the clip before it) or goes out ("out"). null removes it. Use list_library kind "transition" for ids.',
  obj({ clip_id: CLIP_ID, side: oneOf(['in', 'out'], 'Which end.'), transition_id: { type: ['string', 'null'], description: 'The transition id, or null.' }, seconds: num('How long (default 1).', { minimum: 0.1, maximum: 5 }) }, ['clip_id', 'side', 'transition_id']),
  async ({ clip_id, side, transition_id, seconds = 1 }) => {
    const c = clipOrThrow(clip_id);
    if (!VISUAL.has(c.type)) fail(`${c.name} has no picture to transition.`);
    const tr = transition_id && (TRANSITIONS.find((x) => x.id === transition_id) || fail(`There is no transition ${transition_id}.`));
    edit(() => { if (tr) setTransition(c, side, tr.id, Math.min(seconds, c.duration)); else if (side === 'in') c.tIn = null; else c.tOut = null; });
    return { data: { clip: clipInfo(c) }, done: tr ? `${tr.name} ${side === 'in' ? 'into' : 'out of'} ${c.name}` : `Removed the transition ${side === 'in' ? 'into' : 'out of'} ${c.name}` };
  });

tool('apply_brand_kit',
  'Give titles and stickers the colours and font of the brand kit the person has turned on. Without clip_ids, every title and sticker.',
  obj({ clip_ids: list(str('A clip id.'), 'Only these clips.', { minItems: 1, maxItems: 500 }) }),
  async ({ clip_ids }) => {
    const kit = activeKit() || fail('No brand kit is turned on. The person can choose one from the Brand menu.');
    const cs = (clip_ids ? clip_ids.map(clipOrThrow) : store.project.clips).filter((c) => c.type === 'title' || c.type === 'element');
    if (!cs.length) fail('There are no titles or stickers to brand.');
    edit(() => cs.forEach((c) => brandClip(c, templateOf(c), kit)));
    return { data: { branded: cs.length }, done: `Applied the “${kit.name}” brand kit to ${cs.length} clip${cs.length > 1 ? 's' : ''}` };
  });

tool('set_volume',
  'Loudness and fades of a video or sound clip.',
  obj({ clip_id: CLIP_ID, volume: num('0 to 2 (1 is as recorded).', { minimum: 0, maximum: 2 }), fade_in: num('Seconds of fade in.', { minimum: 0, maximum: 30 }), fade_out: num('Seconds of fade out.', { minimum: 0, maximum: 30 }), muted: bool('Silence the clip.') }, ['clip_id']),
  async ({ clip_id, volume, fade_in, fade_out, muted }) => {
    const c = clipOrThrow(clip_id);
    if (!AUDIBLE.has(c.type)) fail(`${c.name} has no sound.`);
    edit(() => {
      if (volume != null) c.volume = volume;
      if (fade_in != null) c.fadeIn = Math.min(fade_in, c.duration);
      if (fade_out != null) c.fadeOut = Math.min(fade_out, c.duration);
      if (muted != null) c.muted = muted;
    });
    return { data: { clip: clipInfo(c) }, done: `Changed the sound of ${c.name}` };
  });

tool('set_clip_type',
  'Say what a sound is: voice (captions and transcripts listen to it, and music dips under it), music (dips under voices when duck is on) or effect.',
  obj({ clip_id: CLIP_ID, sound: oneOf(['voice', 'music', 'effect'], 'What the sound is.'), duck: bool('Music only: dip under voices (default on).') }, ['clip_id', 'sound']),
  async ({ clip_id, sound, duck }) => {
    const c = clipOrThrow(clip_id);
    if (!AUDIBLE.has(c.type)) fail(`${c.name} has no sound.`);
    edit(() => {
      c.role = sound;
      if (sound === 'music' && !c.duck) c.duck = { on: true, amount: 12 };
      if (duck != null) c.duck = { amount: 12, ...(c.duck || {}), on: duck };
    });
    return { data: { clip: clipInfo(c) }, done: `Marked ${c.name} as ${sound}` };
  });

tool('remove_pauses',
  'Cut the quiet stretches out of a clip and close the gaps (later clips on its track move up). Speech keeps a little silence either side.',
  obj({ clip_id: CLIP_ID, quieter_than_db: num('How far below the loudest part counts as quiet (default 30).', { minimum: 6, maximum: 60 }), min_seconds: num('Shortest pause to cut (default 0.7).', { minimum: 0.2, maximum: 10 }) }, ['clip_id']),
  async ({ clip_id, quieter_than_db = 30, min_seconds = 0.7 }) => {
    const c = clipOrThrow(clip_id);
    const m = AUDIBLE.has(c.type) && mediaById(c.mediaId);
    if (!m) fail(`${c.name} has no sound.`);
    await waveform(m);
    const pauses = findPauses(c, { rel: quieter_than_db, minLen: min_seconds }) || [];
    if (!pauses.length) return { data: { pieces: 1, removed_seconds: 0 }, done: `Found no pauses in ${c.name}` };
    const before = c.duration;
    const ids = removePauses(c, pauses);
    const after = ids.map(clipById).filter(Boolean).reduce((s, x) => s + x.duration, 0);
    return { data: { pieces: ids.map((id) => clipInfo(clipById(id))), removed_seconds: r2(before - after) }, done: `Removed ${r2(before - after)} s of pauses from ${c.name}` };
  });

tool('make_captions',
  'Caption everything said in the video (clips marked as voice), heard on this computer. Replaces existing captions. Styles are the Subtitles titles (list_library kind "title", category "Subtitles").',
  obj({ style: str('A Subtitles title id (default "sub-box").'), words_per_caption: { type: 'integer', minimum: 2, maximum: 14, description: 'Most words on screen at once (default 7).' }, show: oneOf(['burn', 'file', 'both'], 'burn: always on screen; file: an .srt file next to the export; both.'), language: str('A language code such as "en", or "auto" (default).'), download_model: bool('Allow downloading the speech model (60 MB) if it is missing. Ask the person first.') }),
  async ({ style = 'sub-box', words_per_caption = 7, show = 'burn', language = 'auto', download_model }) => {
    const tpl = titleById(style);
    if (!tpl || tpl.cat !== 'Subtitles') fail(`${style} is not a caption style.`);
    const voices = voiceClips();
    if (!voices.length) fail('No clips are marked as voice. Use set_clip_type first.');
    const dur = projectDuration();
    const words = await transcribeClips(voices, 0, dur, { lang: language, download: !!download_model });
    if (!words.length) fail('No speech was found.');
    const made = buildCaptions(words, { style, maxWords: words_per_caption });
    placeCaptions(made, 0, dur, show);
    return { data: { captions: made.length }, done: `Added ${made.length} captions` };
  });

tool('set_timer_length',
  'Set how long an Activity Timer countdown runs; the clip, its background and everything after it adjust.',
  obj({ clip_id: CLIP_ID, seconds: num('5 seconds to 3 hours.', { minimum: 5, maximum: 10800 }) }, ['clip_id', 'seconds']),
  async ({ clip_id, seconds }) => {
    const c = clipOrThrow(clip_id);
    if (c.template !== 'seq-edu-timer') fail(`${c.name} is not an Activity Timer.`);
    edit(() => retimeTimer(c, seconds));
    return { data: { clip: clipInfo(c) }, done: `Set the timer to ${ts(seconds)}` };
  });

export const TOOLS = T;
const BY_NAME = new Map(T.map((t) => [t.name, t]));

// The tool list as Claude sees it.
export const toolList = () => T.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
export const isReadOnly = (name) => !!BY_NAME.get(name)?.readOnly;

// ---------- input checking ----------
const isType = (t, v) => (t === 'number' ? typeof v === 'number' && Number.isFinite(v)
  : t === 'integer' ? Number.isInteger(v)
    : t === 'string' ? typeof v === 'string'
      : t === 'boolean' ? typeof v === 'boolean'
        : t === 'array' ? Array.isArray(v)
          : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
            : t === 'null' ? v === null : false);

export function checkInput(schema, v, path = 'input') {
  const types = [].concat(schema.type || []);
  if (types.length && !types.some((t) => isType(t, v))) return `${path} should be ${types.join(' or ')}`;
  if (v === null) return null;
  if (schema.enum && !schema.enum.includes(v)) return `${path} should be one of: ${schema.enum.join(', ')}`;
  if (typeof v === 'number') {
    if (schema.minimum != null && v < schema.minimum) return `${path} should be at least ${schema.minimum}`;
    if (schema.maximum != null && v > schema.maximum) return `${path} should be at most ${schema.maximum}`;
  }
  if (typeof v === 'string' && schema.pattern && !new RegExp(schema.pattern).test(v)) return `${path} is not in the right form`;
  if (Array.isArray(v)) {
    if (schema.minItems != null && v.length < schema.minItems) return `${path} needs at least ${schema.minItems}`;
    if (schema.maxItems != null && v.length > schema.maxItems) return `${path} takes at most ${schema.maxItems}`;
    for (let i = 0; i < v.length; i++) { const e = schema.items && checkInput(schema.items, v[i], `${path}[${i}]`); if (e) return e; }
  }
  if (isType('object', v) && schema.properties) {
    for (const k of schema.required || []) if (v[k] === undefined) return `${path}.${k} is missing`;
    for (const [k, x] of Object.entries(v)) {
      if (!schema.properties[k]) { if (schema.additionalProperties === false) return `${path}.${k} is not an option`; continue; }
      if (x === undefined) continue;
      const e = checkInput(schema.properties[k], x, `${path}.${k}`);
      if (e) return e;
    }
  }
  return null;
}

// ---------- running ----------
// One request from the person: its edits undo together. log lists what was done, in order.
export function beginRequest() { beginGroup(); return { log: [] }; }
export function endRequest() { endGroup(); }

function result(out) {
  const content = [];
  const data = { ...(out.data || {}), ...(out.done ? { done: out.done } : {}) };
  content.push({ type: 'text', text: JSON.stringify(data) });
  for (const im of out.images || []) content.push({ type: 'image', data: im.data, mediaType: im.mediaType || 'image/jpeg' });
  return { ok: true, content };
}
const failure = (text) => ({ ok: false, content: [{ type: 'text', text }] });

export async function runTool(name, input, req = null) {
  const t = BY_NAME.get(name);
  if (!t) return failure(`There is no tool called ${name}.`);
  if (!store.project) return failure('No project is open in Current.');
  input = input ?? {};
  const bad = checkInput(t.input_schema, input);
  if (bad) return failure(`That input was not accepted: ${bad}.`);
  const own = !req;
  if (own) req = beginRequest();
  groupBusy(true);
  try {
    const out = await t.run(input, req);
    if (!t.readOnly) {
      if (out.done) req.log.push(out.done);
      store.emit('selection');
      app.player?.requestRender();
    }
    return result(out);
  } catch (e) {
    return failure(e instanceof ToolError ? e.message : `That did not work: ${e.message}`);
  } finally {
    groupBusy(false);
    if (own) endRequest();
  }
}
