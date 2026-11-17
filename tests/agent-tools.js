// The assistant's tools (src/js/agent): input checks, where things are placed, one undo step per request,
// sequences, starter templates and clip blocks, pictures of media and of the video, the media analysis,
// transcripts and captions (from a ready-made transcript) and removing pauses. No network.
//   CURRENT_FAKE_WHISPER=tests/fixtures/whisper-words.json npx electron . --selftest=tests/agent-tools.js
const base = new URL('../src/js/', import.meta.url).href;
const M = decodeURIComponent(new URL('./media/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; log(ok ? 'ok  ' : 'FAIL', msg); };
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;
const covers = (ranges, a, b, tol) => (ranges || []).some(([x, y]) => near(x, a, tol) && near(y, b, tol));
async function imageSize(im) {
  const blob = await (await fetch(`data:${im.mediaType};base64,${im.data}`)).blob();
  const bmp = await createImageBitmap(blob);
  return [bmp.width, bmp.height];
}
try {
  document.querySelector('.start button.primary')?.click();
  await wait(400);
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const Tl = await import(base + 'agent/tools.js');
  const An = await import(base + 'agent/analyze.js');
  const { captionClips } = await import(base + 'ui/captions.js');
  const S = st.store;
  const run = async (name, input, req) => {
    const r = await Tl.runTool(name, input, req);
    let data = null;
    try { data = JSON.parse(r.content[0].text); } catch { /* an error message */ }
    return { ...r, data, text: r.content[0].text, images: r.content.filter((c) => c.type === 'image') };
  };

  // 1. the tool list
  const list = Tl.toolList(), names = list.map((t) => t.name);
  check(list.length >= 30 && new Set(names).size === names.length, `${list.length} tools, each with its own name`);
  check(list.every((t) => t.description.length > 30 && t.input_schema.type === 'object' && t.input_schema.additionalProperties === false), 'every tool has a description and a closed input schema');

  // 2. input checks
  let r = await run('split', { clip_id: 5, time: 1 });
  check(!r.ok && /clip_id should be string/.test(r.text), `a wrong type is refused (${r.text})`);
  r = await run('split', { clip_id: 'x', time: 1, colour: 'red' });
  check(!r.ok && /colour is not an option/.test(r.text), `an unknown option is refused (${r.text})`);
  r = await run('add_media', {});
  check(!r.ok && /media_id is missing/.test(r.text), `a missing input is refused (${r.text})`);
  r = await run('set_volume', { clip_id: 'x', volume: 9 });
  check(!r.ok && /at most 2/.test(r.text), `an out-of-range number is refused (${r.text})`);
  r = await run('no_such_tool', {});
  check(!r.ok && /no tool/.test(r.text), 'an unknown tool is refused');

  // 3. media
  const [m1, m2, ph, an] = await A.importPaths([M + 'test1.mp4', M + 'test2.mp4', M + 'photo.png', M + 'analysis.mp4']);
  r = await run('list_media');
  const lm = r.data?.media || [];
  check(r.ok && lm.length === 4 && lm.find((x) => x.id === ph.id)?.type === 'image' && lm.find((x) => x.id === m1.id)?.shape === 'wide' && lm.every((x) => x.used === false), 'list_media lists the four files with their shape, none used yet');

  // 4. building a video in one request
  const undo0 = S.undoStack.length;
  const req = Tl.beginRequest();
  r = await run('add_media', { media_id: m1.id, in: 2, out: 6 }, req);
  const c1 = r.data?.clip;
  check(r.ok && c1.start === 0 && c1.end === 4 && c1.in === 2, `part of a file goes at the start (${c1?.start}–${c1?.end}, from ${c1?.in} s into the file)`);
  r = await run('add_media', { media_id: m2.id }, req);
  const c2 = r.data?.clip;
  check(r.ok && c2.start === 4 && near(c2.end, 4 + m2.duration, 0.05), `the next file follows it (at ${c2?.start})`);
  r = await run('add_media', { media_id: m1.id, in: 19, out: 25 }, req);
  check(!r.ok && /only 20/.test(r.text), `a range past the end of the file is refused (${r.text})`);
  r = await run('add_media', { media_id: ph.id, at: 1 }, req);
  check(!r.ok && /taken/.test(r.text), 'a taken spot is refused without make_room');
  r = await run('add_media', { media_id: ph.id, at: 2, seconds: 3, make_room: true }, req);
  const parts = S.project.clips.filter((c) => c.mediaId === m1.id).sort((a, b) => a.start - b.start);
  check(r.ok && r.data.clip.start === 2 && parts.length === 2 && near(parts[1].start, 5) && near(parts[1].in, 4), 'make_room splits the clip there and moves the rest along');
  r = await run('add_library_item', { kind: 'title', id: 'lt-pill', at: 1, seconds: 3, texts: ['Lisbon', 'Day 1'] }, req);
  const ti = r.data?.clip;
  check(r.ok && ti.texts[0] === 'Lisbon' && ti.texts[1] === 'Day 1' && ti.track !== st.mainTrack().id, 'a title goes on a track above the main one, with its text');
  r = await run('add_library_item', { kind: 'title', id: 'lt-pill', texts: ['a', 'b', 'c'] }, req);
  check(!r.ok && /2 lines/.test(r.text), 'too many lines for a title are refused');
  r = await run('add_library_item', { kind: 'music', id: 'm-chill', seconds: 8, volume: 0.6 }, req);
  check(r.ok && r.data.clip.sound === 'music' && near(r.data.clip.end, 8, 0.01) && st.trackById(r.data.clip.track).kind === 'audio' && r.data.clip.fade_out > 0, 'music goes on an audio track, cut to length with a fade');
  r = await run('set_transition', { clip_id: c2.id, side: 'in', transition_id: 'dissolve', seconds: 0.8 }, req);
  check(r.ok && st.clipById(c2.id).tIn?.id === 'dissolve', 'a transition goes on');
  const fx = (await run('list_library', { kind: 'effect' })).data.items[0];
  r = await run('apply_effect', { clip_id: c2.id, effect_id: fx.id, amount: 0.5 }, req);
  check(r.ok && st.clipById(c2.id).effects.some((e) => e.id === fx.id && e.amount === 0.5), `an effect goes on (${fx.name})`);
  Tl.endRequest();
  check(req.log.length === 7, `the request logged what it did (${req.log.length}): ${req.log.join(' · ')}`);
  check(S.undoStack.length === undo0 + 1, `all of that is one undo step (${S.undoStack.length - undo0})`);
  st.undo(); await wait(100);
  check(S.project.clips.length === 0, 'one Undo takes it all back');
  st.redo(); await wait(100);
  check(S.project.clips.length === 6, `Redo puts it back (${S.project.clips.length} clips)`);

  // 5. single edits (each its own undo step)
  const id2 = c2.id;
  r = await run('split', { clip_id: id2, time: 10 });
  const right = r.data?.right;
  check(r.ok && near(right.start, 10) && near(right.in, 3, 0.01), 'split cuts a clip and the right part continues the file');
  r = await run('trim', { clip_id: right.id, end: 12 });
  check(r.ok && near(r.data.clip.end, 12), 'trim moves the end');
  r = await run('trim', { clip_id: right.id, start: 10.5 });
  check(r.ok && near(r.data.clip.start, 10.5) && near(r.data.clip.in, 3.5, 0.01), 'trimming the start skips into the file');
  r = await run('trim', { clip_id: right.id, start: 9 });
  check(!r.ok, `trimming into the clip before it is refused (${r.text})`);
  r = await run('move', { clip_id: ti.id, start: 6 });
  check(r.ok && near(r.data.clip.start, 6), 'move changes a clip\'s time');
  r = await run('set_text', { clip_id: ti.id, texts: ['Porto'] });
  check(r.ok && r.data.clip.texts[0] === 'Porto' && r.data.clip.texts[1] === 'Day 1', 'set_text changes one line and keeps the other');
  r = await run('set_text', { clip_id: id2, texts: ['x'] });
  check(!r.ok && /no text/.test(r.text), 'set_text on a video is refused');
  r = await run('set_style', { clip_id: ti.id, font: 'Oswald', colors: ['#112233'] });
  check(r.ok && r.data.clip.font === 'Oswald' && r.data.clip.colors[0] === '#112233', 'set_style changes the font and a colour');
  r = await run('set_style', { clip_id: ti.id, font: 'Comic' });
  check(!r.ok && /not one of the fonts/.test(r.text), 'an unknown font is refused');
  const flt = (await run('list_library', { kind: 'filter' })).data.items[0];
  r = await run('apply_filter', { clip_id: id2, filter_id: flt.id });
  check(r.ok && st.clipById(id2).filter?.id === flt.id, 'a filter goes on');
  r = await run('apply_filter', { clip_id: id2, filter_id: null });
  check(r.ok && !st.clipById(id2).filter, 'and comes off');
  r = await run('set_volume', { clip_id: parts[0].id, volume: 0.5, fade_in: 1 });
  check(r.ok && r.data.clip.volume === 0.5 && r.data.clip.fade_in === 1, 'set_volume sets loudness and a fade');
  r = await run('set_clip_type', { clip_id: parts[0].id, sound: 'music', duck: false });
  check(r.ok && st.clipById(parts[0].id).role === 'music' && st.clipById(parts[0].id).duck.on === false, 'set_clip_type marks a sound as music without ducking');
  r = await run('set_speed', { clip_id: parts[1].id, speed: 2 });
  check(r.ok && near(r.data.clip.end - r.data.clip.start, 1, 0.01) && near(st.clipById(id2).start, 6, 0.01), `set_speed halves the clip and the next one moves up (next at ${st.clipById(id2).start})`);
  r = await run('freeze_frame', { clip_id: id2, time: 7, seconds: 1.5 });
  check(r.ok && near(r.data.clip.end - r.data.clip.start, 1.5) && S.project.clips.some((c) => c.name === 'Freeze frame'), 'freeze_frame holds a frame');
  const nBefore = S.project.clips.length;
  r = await run('delete', { clip_ids: [ti.id] });
  check(r.ok && S.project.clips.length === nBefore - 1 && !st.clipById(ti.id), 'delete removes a clip');
  r = await run('delete', { clip_ids: ['nope'] });
  check(!r.ok && /no clip nope/.test(r.text), 'deleting an unknown clip is refused');
  r = await run('get_project');
  check(r.ok && r.data.clips.length === S.project.clips.length && r.data.shape === '16:9' && r.data.tracks.some((t) => t.main), `get_project describes ${r.data?.clips.length} clips and the tracks`);
  r = await run('list_library', { kind: 'music', search: 'chill' });
  check(r.ok && r.data.items.some((i) => i.id === 'm-chill' && i.bpm), 'list_library finds music by name, with its tempo');
  r = await run('list_library', { kind: 'sequence', category: 'Travel' });
  check(r.ok && r.data.total === 40 && r.data.items.every((i) => i.category === 'Travel'), 'list_library lists a sequence section');

  // 6. sequences
  const firstStart = Math.min(...S.project.clips.map((c) => c.start));
  r = await run('add_library_item', { kind: 'sequence', id: 'travel-stamp' });
  const intro = r.data?.pieces || [];
  const pack = (await import(base + 'templates/packs.js')).packById('travel-stamp');
  check(r.ok && intro.length > 1 && intro[0].start === 0 && near(Math.min(...S.project.clips.filter((c) => !intro.some((p) => p.id === c.id)).map((c) => c.start)), firstStart + pack.dur), 'an intro sequence goes at the start and moves the rest along');
  const t0 = S.time;
  r = await run('add_library_item', { kind: 'sequence', id: 'news-banner', at: 9 });
  check(r.ok && r.data.pieces.length > 0 && near(r.data.pieces[0].start, 9) && S.time === t0, 'a mid-roll goes in at the time given and the playhead stays');
  r = await run('add_library_item', { kind: 'sequence', id: 'news-banner' });
  check(!r.ok && /Give `at`/.test(r.text), 'a mid-roll without a time is refused');
  r = await run('add_library_item', { kind: 'sequence', id: 'edu-timer', placement: 'end' });
  const timer = r.data?.pieces.find((p) => p.template === 'seq-edu-timer');
  r = await run('set_timer_length', { clip_id: timer.id, seconds: 60 });
  check(r.ok && r.data.clip.timer_seconds === 60, 'set_timer_length sets the countdown');

  // 7. pictures
  r = await run('view_media', { media_id: m1.id, count: 6 });
  const [sw, sh] = r.ok ? await imageSize(r.images[0]) : [0, 0];
  check(r.ok && r.images.length === 1 && r.data.frame_times.length === 6 && sw > 600 && sh > 200, `view_media gives one contact sheet of 6 frames (${sw}×${sh})`);
  r = await run('view_media_frame', { media_id: an.id, time: 5 });
  const [fw, fh] = r.ok ? await imageSize(r.images[0]) : [0, 0];
  check(r.ok && fw === 640 && fh === 360, `view_media_frame gives one frame (${fw}×${fh})`);
  r = await run('view_media', { media_id: ph.id });
  check(r.ok && r.images.length === 1, 'view_media on a photo gives the photo');
  const scale0 = A.app.player.scale;
  r = await run('view_frame', { time: 1 });
  const [vw, vh] = r.ok ? await imageSize(r.images[0]) : [0, 0];
  check(r.ok && vw === 1024 && vh === 576 && A.app.player.scale === scale0, `view_frame renders the video (${vw}×${vh}) and leaves the preview as it was`);
  r = await run('view_frame', { time: 9999 });
  check(!r.ok, 'view_frame past the end is refused');

  // 8. analysis (analysis.mp4: cuts at 4 and 6, dark and quiet 4-6, soft 6-10)
  const a = await An.analyseMedia(an, null, { fresh: true });
  log('analysis', JSON.stringify(a));
  const cuts = a.shots.slice(1).map((s) => s[0]);
  check(cuts.length === 2 && near(cuts[0], 4, 0.15) && near(cuts[1], 6, 0.15), `two shot changes, at 4 and 6 (${cuts})`);
  check(covers(a.dark, 4, 6, 0.5) && a.dark.length === 1, `dark from 4 to 6 (${JSON.stringify(a.dark)})`);
  check(covers(a.soft, 6, 10, 0.6) && !a.soft.some(([x]) => x < 3.5), `soft from 6 to 10 only (${JSON.stringify(a.soft)})`);
  check(!a.shaky.length, 'a still camera is not shaky');
  check(a.has_sound && covers(a.quiet, 4, 6, 0.15) && a.quiet.length === 1, `quiet from 4 to 6 (${JSON.stringify(a.quiet)})`);
  const b = await An.analyseMedia(m2, null, { fresh: true });
  check(b.has_sound === false && b.shots.length === 1 && !b.dark.length && !b.soft.length, 'steady colour bars: one shot, not dark, not soft, no sound');
  const t1 = performance.now();
  r = await run('analyse_media', { media_id: an.id });
  check(r.ok && r.data.shots.length === 3 && performance.now() - t1 < 500, `analyse_media answers from the cache the second time (${Math.round(performance.now() - t1)} ms)`);
  check(r.data.media_id === an.id && r.data.name === an.name, 'the cached answer carries this project\'s id for the file, not an earlier one');
  r = await run('analyse_media', { media_id: ph.id });
  check(r.ok && typeof r.data.brightness === 'number', 'a photo gets its brightness');

  // 9. transcripts, captions and pauses (ready-made transcript)
  r = await run('get_media_transcript', { media_id: m1.id, words: true });
  check(r.ok && r.data.phrases.length > 0 && r.data.words.length >= r.data.phrases.length, `get_media_transcript gives ${r.data?.phrases?.length} phrases and the words (${r.ok ? '' : r.text})`);
  r = await run('get_media_transcript', { media_id: ph.id });
  check(!r.ok && /photo/.test(r.text), 'a photo has no transcript');
  r = await run('add_media', { media_id: an.id });
  const ac = r.data?.clip;
  r = await run('set_clip_type', { clip_id: ac.id, sound: 'voice' });
  r = await run('get_transcript');
  check(r.ok && r.data.phrases.length > 0, `get_transcript hears the voice clips (${r.ok ? r.data.phrases.length : r.text})`);
  r = await run('make_captions', { words_per_caption: 5 });
  check(r.ok && r.data.captions > 0 && captionClips().length === r.data.captions, `make_captions adds ${r.data?.captions} captions (${r.ok ? '' : r.text})`);
  r = await run('get_project');
  check(r.ok && r.data.captions?.count === captionClips().length && r.data.clips.length === S.project.clips.length - captionClips().length, 'get_project sums up the captions instead of listing them');
  r = await run('find_pauses', { clip_id: ac.id });
  check(r.ok && r.data.pauses.length === 1 && near(r.data.pauses[0][0], ac.start + 4, 0.2) && near(r.data.pauses[0][1], ac.start + 6, 0.2), `find_pauses finds the quiet part (${JSON.stringify(r.data?.pauses)})`);
  r = await run('remove_pauses', { clip_id: ac.id });
  check(r.ok && r.data.pieces.length === 2 && r.data.removed_seconds > 1.4 && r.data.removed_seconds < 2, `remove_pauses cuts ${r.data?.removed_seconds} s`);

  // 10. starter templates and clip blocks
  r = await run('start_from_template', { template_id: 'vlog' });
  check(!r.ok && /empty/.test(r.text), 'a starter template needs an empty timeline');
  await run('delete', { clip_ids: S.project.clips.map((c) => c.id) });
  const undo1 = S.undoStack.length;
  r = await run('start_from_template', { template_id: 'vlog' });
  const blocks = r.data?.clip_blocks || [];
  check(r.ok && blocks.length === 3 && S.undoStack.length === undo1 + 1, `the vlog template lays out 3 clip blocks as one undo step (${blocks.length}, ${S.undoStack.length - undo1})`);
  r = await run('fill_clip_block', { clip_id: blocks[0].id, media_id: m1.id, in: 18 });
  check(!r.ok && /only 2/.test(r.text), `a block longer than what is left of the file is refused (${r.text})`);
  r = await run('fill_clip_block', { clip_id: blocks[0].id, media_id: m1.id, in: 3 });
  check(r.ok && r.data.clip.media_id === m1.id && near(r.data.clip.start, blocks[0].start) && near(r.data.clip.end, blocks[0].end) && r.data.clip.in === 3 && !st.clipById(blocks[0].id), 'fill_clip_block swaps the block for the video, same place and length');
  r = await run('fill_clip_block', { clip_id: blocks[1].id, media_id: ph.id });
  check(r.ok && r.data.clip.type === 'image', 'a photo can fill a block too');
  st.undo(); st.undo(); st.undo(); await wait(100);
  check(S.project.clips.length === 0, 'Undo takes the fills and the template back');
} catch (e) { bad++; log('FAIL error', e.stack || e.message); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
