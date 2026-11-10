// Walkthrough of the newer features with screenshots: start screen templates, building every
// template, crop mode, the tight selection box on a sticker, the audio panel, and audio previews.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const M = new URL('./media/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
let bad = 0;
try {
  await wait(900);
  document.querySelector('.start-main').scrollTop = 0;
  await shot('2-start');
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const { PROJECT_TEMPLATES } = await import(base + 'templates/projects.js');
  const S = st.store;
  // build every template into a fresh project
  for (const tpl of PROJECT_TEMPLATES) {
    S.project = st.newProject({ aspect: tpl.aspect, name: tpl.name }); S.selection.clear();
    await A.buildFromTemplate(tpl);
    const d = st.projectDuration();
    const placeholders = S.project.clips.filter((c) => c.name.startsWith('Your clip')).length;
    log(`template ${tpl.id}: ${S.project.clips.length} clips, ${d.toFixed(1)}s, ${placeholders} scenes, ${S.project.width}x${S.project.height}`);
    if (placeholders !== tpl.scenes.length || d < 5) bad++;
  }
  // open the Reel template through the real start screen card
  document.querySelector('.start')?.remove();
  const { showStart } = window;
  S.dirty = false;
  const card = [...document.querySelectorAll('.tpl-card')];
  log('template cards on start screen', card.length);
  // fresh project for UI checks
  S.project = st.newProject({ aspect: '16:9' }); S.dirty = false; S.emit('change', 'load'); S.emit('media');
  const [photo, green] = await A.importPaths([M + 'photo.png', M + 'green.mp4']);
  await A.insertItem({ kind: 'media', id: photo.id }, { trackId: st.mainTrack().id, time: 0 });
  await A.insertItem({ kind: 'media', id: green.id }, { trackId: st.videoTracks()[1].id, time: 0 });
  const g = S.project.clips.find((c) => c.mediaId === green.id);
  if (Math.abs(g.chroma.similarity - 0.15) > 1e-6) { bad++; log('tolerance default wrong', g.chroma.similarity); }
  st.edit(() => { g.chroma.on = true; g.chroma.color = '#00c040'; g.crop = { l: 0.1, r: 0.15, t: 0.05, b: 0.1 }; });
  A.app.player.seek(1);
  st.select(g.id); S.emit('inspect', 'crop');
  await wait(900);
  await shot('2-crop');
  if (!document.querySelector('.bbox.crop')) { bad++; log('crop handles missing'); }
  // sticker with tight box
  await A.insertItem({ kind: 'element', id: 'emo-cool' }, { trackId: st.videoTracks()[0].id, time: 0 });
  const em = S.project.clips.at(-1);
  st.edit(() => Object.assign(em.transform, { x: 0.3, y: -0.25, scale: 0.6 }));
  st.select(em.id); S.emit('inspect', 'style');
  A.app.player.seek(1.5);
  await wait(900);
  const bb = document.querySelector('.bbox').getBoundingClientRect(), fr = document.querySelector('.frame').getBoundingClientRect();
  log('sticker box', Math.round(bb.width), 'x', Math.round(bb.height), 'frame', Math.round(fr.width), 'x', Math.round(fr.height));
  if (bb.width > fr.width * 0.4) { bad++; log('sticker box too big'); }
  await shot('2-sticker');
  // audio panel on the photo? use a video with audio
  const [t1] = await A.importPaths([M + 'test1.mp4']);
  await A.insertItem({ kind: 'media', id: t1.id }, { trackId: st.mainTrack().id, time: 10 });
  const v = S.project.clips.at(-1);
  st.select(v.id); S.emit('inspect', 'audio');
  await wait(400);
  const sw = document.querySelector('.insp-body .switch').getBoundingClientRect();
  log('toggle width', Math.round(sw.width));
  if (sw.width > 40) { bad++; log('toggle still too wide'); }
  document.querySelector('.insp-body').scrollTop = 420;
  // audio library with a preview playing
  document.querySelector('.lib-tab[data-tab="audio"]').click();
  await wait(200);
  [...document.querySelectorAll('.lib-cat')].find((c) => c.textContent.startsWith('Music')).click();
  await wait(200);
  document.querySelector('.audio-play').click();
  await wait(2500);
  const playing = document.querySelector('.audio-play.playing');
  log('audio preview playing', !!playing);
  if (!playing) bad++;
  await shot('2-audio');
  playing?.click();
  await wait(200);
  if (document.querySelector('.audio-play.playing')) { bad++; log('preview did not stop'); }
  // video card: hover preview and sound preview
  document.querySelector('.lib-tab[data-tab="media"]').click();
  await wait(300);
  const vcard = [...document.querySelectorAll('.card')].find((c) => c.title === 'test1.mp4');
  vcard.querySelector('.thumb').dispatchEvent(new MouseEvent('mouseenter'));
  await wait(800);
  const hv = vcard.querySelector('video.hover');
  log('video hover preview', !!hv, hv && !hv.paused, hv?.muted);
  if (!hv || hv.paused) bad++;
  vcard.querySelector('.audio-play').click();
  await wait(1200);
  log('video sound preview', !hv.paused, 'muted', hv.muted);
  if (hv.paused || hv.muted) bad++;
  await shot('2-video-preview');
  vcard.querySelector('.audio-play').click();
  // intro/outro tab
  document.querySelector('.lib-tab[data-tab="pack"]').click();
  await wait(1200);
  await shot('2-packs');
  log(bad ? `FAILED ${bad}` : 'ALL OK');
} catch (e) { bad++; log('FATAL', e.stack); }
window.native.selftestDone(bad);
