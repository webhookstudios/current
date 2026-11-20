// Plays for 2 s and checks the clock, element sync, and a save/load round trip.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const M = decodeURIComponent(new URL('./media/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
let bad = 0;
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const S = st.store;
  const [v] = await A.importPaths([M + 'test1.mp4']);
  await A.insertItem({ kind: 'media', id: v.id });
  const c = S.project.clips[0];
  st.edit(() => { c.in = 3; c.duration = 10; c.audioFx.preset = 'echo'; });
  const p = A.app.player;
  p.seek(1);
  p.play();
  await new Promise((r) => setTimeout(r, 2000));
  const e = p.els.get(c.id);
  const expect = 3 + (S.time - c.start);
  log('time', S.time.toFixed(2), 'video', e.v.currentTime.toFixed(2), 'expected', expect.toFixed(2), 'paused', e.v.paused);
  if (Math.abs(S.time - 3) > 0.4) { bad++; log('clock off'); }
  if (Math.abs(e.v.currentTime - expect) > 0.3) { bad++; log('video out of sync'); }
  p.pause();
  // split + undo
  S.time = 4; A.splitAtPlayhead();
  log('after split', S.project.clips.map((x) => `${x.start}+${x.duration}@in${x.in}`).join(' '));
  if (S.project.clips.length !== 2 || Math.abs(S.project.clips[1].in - 7) > 1e-6) bad++;
  st.undo();
  if (S.project.clips.length !== 1) { bad++; log('undo failed'); }
  // save / load
  const path = OUT + 'rt.splice';
  await window.native.writeText(path, JSON.stringify(S.project));
  const back = JSON.parse(await window.native.readText(path));
  if (back.clips.length !== 1 || back.clips[0].audioFx.preset !== 'echo') { bad++; log('roundtrip mismatch'); }
  log(bad ? `FAILED ${bad}` : 'ALL OK');
} catch (e) { log('FATAL', e.stack); }
window.native.selftestDone(bad);
