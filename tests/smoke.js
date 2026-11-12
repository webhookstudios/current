// Smoke test: compiles every shader, draws every template, builds a timeline and exports it.
const base = new URL('../src/js/', import.meta.url).href;
const log = (...a) => console.log('[test]', ...a);
const M = new URL('./media/', import.meta.url).pathname;
let fails = 0;
try {
  const { TRANSITIONS, TRANSITION_HEADER } = await import(base + 'templates/transitions.js');
  const { EFFECTS, EFFECT_HEADER, FILTERS } = await import(base + 'templates/effects.js');
  const { TITLES } = await import(base + 'templates/titles.js');
  const { ELEMENTS, BACKGROUNDS } = await import(base + 'templates/elements.js');
  const { Compositor } = await import(base + 'engine/renderer.js');
  const st = await import(base + 'state.js');
  const actions = await import(base + 'actions.js');
  const cv = document.createElement('canvas');
  const comp = new Compositor(cv);
  comp.setSize(320, 180);
  const VS = `#version 300 es\nin vec2 aPos; out vec2 vUv; void main(){ vUv = aPos; gl_Position = vec4(aPos*2.0-1.0,0.0,1.0); }`;
  for (const t of TRANSITIONS) { try { comp.program(VS, TRANSITION_HEADER + t.glsl); } catch (e) { fails++; log('TRANSITION FAIL', t.id, e.message.split('\n')[0]); } }
  for (const t of EFFECTS) { try { comp.program(VS, EFFECT_HEADER + t.glsl); } catch (e) { fails++; log('EFFECT FAIL', t.id, e.message.split('\n')[0]); } }
  log(`shaders: ${TRANSITIONS.length} transitions, ${EFFECTS.length} effects, ${FILTERS.length} filters`);
  const c2 = document.createElement('canvas'); c2.width = 640; c2.height = 360; const ctx = c2.getContext('2d');
  for (const t of [...TITLES, ...ELEMENTS, ...BACKGROUNDS]) {
    for (const tt of [0, 0.5, 2, 4.9]) {
      try { ctx.save(); t.draw(ctx, { W: 640, H: 360, u: 1 / 3, t: tt, d: t.dur || 5, texts: t.texts || [], colors: t.colors || [], font: null, scale: 1, params: {} }); ctx.restore(); } catch (e) { fails++; log('TEMPLATE FAIL', t.id, tt, e.message); break; }
    }
  }
  log(`templates: ${TITLES.length} titles, ${ELEMENTS.length} elements, ${BACKGROUNDS.length} backgrounds`);
  // library sizes the app promises
  const { PACKS } = await import(base + 'templates/packs.js');
  const { AUDIO_LIBRARY } = await import(base + 'templates/audiolib.js');
  const want = { titles: [TITLES.length, 105], transitions: [TRANSITIONS.length, 85], effects: [EFFECTS.length, 55], filters: [FILTERS.length, 50], stickers: [ELEMENTS.length, 100],
    music: [AUDIO_LIBRARY.filter((a) => a.cat === 'Music').length, 20], sfx: [AUDIO_LIBRARY.filter((a) => a.cat === 'Sound Effects').length, 30],
    intros: [PACKS.filter((p) => p.cat === 'Intros').length, 35], outros: [PACKS.filter((p) => p.cat === 'Outros').length, 35], backgrounds: [BACKGROUNDS.length, 66] };
  for (const [k, [have, need]] of Object.entries(want)) if (k === 'backgrounds' ? have < need : have !== need) { fails++; log('COUNT FAIL', k, have, 'expected', need); }
  log('counts', JSON.stringify(Object.fromEntries(Object.entries(want).map(([k, v]) => [k, v[0]]))));
  // every pack layer must point at a real template or sound
  const ids = new Set([...TITLES, ...ELEMENTS, ...BACKGROUNDS, ...AUDIO_LIBRARY].map((x) => x.id));
  for (const p of PACKS) for (const L of p.layers) if (!ids.has(L.id)) { fails++; log('PACK FAIL', p.id, 'missing', L.id); }
  const ids2 = new Set(PACKS.map((p) => p.id)); if (ids2.size !== PACKS.length) { fails++; log('PACK FAIL duplicate ids'); }
  const { PROJECT_TEMPLATES } = await import(base + 'templates/projects.js');
  const trIds = new Set(TRANSITIONS.map((t) => t.id)), packIds = new Set(PACKS.map((p) => p.id));
  if (PROJECT_TEMPLATES.length !== 12) { fails++; log('TEMPLATE COUNT', PROJECT_TEMPLATES.length); }
  for (const tp of PROJECT_TEMPLATES) {
    for (const id of [tp.intro, tp.outro, tp.preview]) if (!packIds.has(id)) { fails++; log('PROJECT FAIL', tp.id, 'pack', id); }
    if (!ids.has(tp.music)) { fails++; log('PROJECT FAIL', tp.id, 'music', tp.music); }
    for (const [, , bgId, tr, over] of tp.scenes) {
      if (!ids.has(bgId)) { fails++; log('PROJECT FAIL', tp.id, 'bg', bgId); }
      if (tr && !trIds.has(tr)) { fails++; log('PROJECT FAIL', tp.id, 'transition', tr); }
      if (over && !ids.has(over[0])) { fails++; log('PROJECT FAIL', tp.id, 'title', over[0]); }
    }
  }
  const { drawPreview, makeThumbCanvas } = await import(base + 'ui/previews.js');
  const pc = makeThumbCanvas();
  for (const p of PACKS) for (const t of [0.1, p.dur / 2, p.dur - 0.1]) drawPreview(pc, 'pack', p.id, t, p.dur);
  // render every sound once (catches synth errors)
  const { libraryAudioPath } = await import(base + 'templates/audiolib.js');
  for (const a of AUDIO_LIBRARY) { try { await libraryAudioPath(a); } catch (e) { fails++; log('AUDIO FAIL', a.id, e.message); } }
  log('rendered', AUDIO_LIBRARY.length, 'library sounds');
  // build a project
  await new Promise((r) => setTimeout(r, 500));
  const media = await actions.importPaths([M + 'test1.mp4', M + 'test2.mp4', M + 'photo.png']);
  log('imported', media.map((m) => `${m.type} ${m.width}x${m.height} ${m.duration?.toFixed?.(2)}`).join(' | '));
  const S = st.store;
  for (const m of media) await actions.insertItem({ kind: 'media', id: m.id });
  const clips = S.project.clips;
  log('clips after insert', clips.map((c) => `${c.type}@${c.start.toFixed(2)}+${c.duration.toFixed(2)}`).join(' '));
  st.edit(() => { clips[1].tIn = { id: 'cube-left', duration: 1 }; clips[2].tIn = { id: 'circle-open', duration: 1 }; clips[0].tIn = { id: 'fade-black', duration: 1 }; });
  S.time = 1; await actions.insertItem({ kind: 'title', id: 'open-cinematic' });
  S.time = 3; await actions.insertItem({ kind: 'element', id: 'el-confetti' });
  S.time = 10; await actions.insertItem({ kind: 'audio-lib', id: 'm-upbeat' });
  S.time = 2; await actions.insertItem({ kind: 'audio-lib', id: 'sfx-whoosh' });
  // an intro pack goes first and pushes everything later
  const before = clips.find((c) => c.type === 'video').start;
  await actions.insertItem({ kind: 'pack', id: 'intro-logo' });
  const shifted = S.project.clips.find((c) => c.type === 'video').start;
  if (Math.abs(shifted - before - 5) > 1e-6) { fails++; log('PACK FAIL intro did not shift timeline', before, shifted); }
  await actions.insertItem({ kind: 'pack', id: 'outro-endscreen' });
  log('after packs', S.project.clips.length, 'clips on', S.project.tracks.length, 'tracks');
  S.time = 0;
  const v = clips.find((c) => c.type === 'video');
  st.edit(() => { v.filter = { id: 'teal-orange', amount: 1 }; v.effects.push({ id: 'vhs', amount: 0.6 }); v.audioFx.preset = 'hall'; v.fadeIn = 1; v.anim.in = 'zoom-in'; });
  // chroma key + PiP on the photo
  const img = clips.find((c) => c.type === 'image');
  log('timeline', S.project.clips.length, 'clips, duration', st.projectDuration().toFixed(2));
  // denoise
  const { denoiseSource } = await import(base + 'engine/audio.js');
  const t0 = performance.now();
  const dn = await denoiseSource(M + 'test1.mp4', 2);
  log('denoise ok', dn.split('/').pop(), ((performance.now() - t0) / 1000).toFixed(2) + 's');
  st.edit(() => { v.audioFx.denoise = 2; v.audioFx.denoisePath = dn; });
  // preview render
  const { app } = actions;
  app.player.renderNow(2.5);
  // export short mp4 via the real pipeline
  const { mixAudio } = await import(base + 'ui/export.js');
  const dur = Math.min(8, st.projectDuration());
  const wav = await mixAudio(S.project, dur);
  log('audio mix bytes', wav?.byteLength);
  const out = M + 'export-test.mp4';
  const W = 640, H = 360, fps = 30;
  await window.native.exportStart({ path: out, format: 'mp4', width: W, height: H, fps, quality: 'medium', audioWav: wav });
  const comp2 = app.compositor; app.player.suspended = true; comp2.setSize(W, H);
  const px = new Uint8Array(W * H * 4);
  const t1 = performance.now();
  const n = Math.round(dur * fps);
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const bt = await app.player.prepareExact(t);
    comp2.setSize(W, H);
    comp2.render(S.project, t, app.player.source, { byTrack: bt, offscreen: true, keepTextures: true });
    comp2.readPixels(px);
    await window.native.exportFrame(px);
  }
  const res = await window.native.exportFinish();
  log('export ok', res.path, res.size, 'bytes', (n / ((performance.now() - t1) / 1000)).toFixed(1), 'fps');
  // grab frames for visual check
  for (const t of [0.5, 2.5, 5.0, 6.0]) {
    await app.player.prepareExact(t);
    comp2.setSize(W, H);
    comp2.render(S.project, t, app.player.source, { keepTextures: true });
    const b = await new Promise((r) => comp2.canvas.toBlob(r, 'image/png'));
    await window.native.cacheWrite(`selftest-${t}.png`, await b.arrayBuffer());
  }
  log('errors in compositor', JSON.stringify(comp.errors.concat(comp2.errors)));
} catch (e) { fails++; log('FATAL', e.stack); }
log(fails ? `FAILED (${fails})` : 'ALL OK');
window.native.selftestDone(fails ? 1 : 0);
