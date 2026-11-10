// Visual check: chroma key over a photo, picture-in-picture, a transition mid-way, and a title.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const M = new URL('./media/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const S = st.store;
  const [photo, green, t2] = await A.importPaths([M + 'photo.png', M + 'green.mp4', M + 'test2.mp4']);
  const main = st.mainTrack();
  await A.insertItem({ kind: 'media', id: photo.id }, { trackId: main.id, time: 0 });
  await A.insertItem({ kind: 'media', id: t2.id }, { trackId: main.id, time: 5 });
  const tracks = st.videoTracks();
  await A.insertItem({ kind: 'media', id: green.id }, { trackId: tracks[1].id, time: 0 });
  await A.insertItem({ kind: 'media', id: t2.id }, { trackId: tracks[0].id, time: 0 });
  const [cPhoto, cT2, cGreen, cPip] = S.project.clips;
  st.edit(() => {
    cGreen.chroma.on = true; cGreen.chroma.color = '#00c040';
    Object.assign(cPip.transform, { scale: 0.3, x: 0.32, y: -0.3 }); cPip.duration = 4;
    cT2.tIn = { id: 'circle-open', duration: 2 };
  });
  S.time = 0; await A.insertItem({ kind: 'title', id: 'lt-bar' });
  const p = A.app.player;
  p.suspended = true;
  const comp = A.app.compositor;
  for (const t of [1, 5.0]) {
    await p.prepareExact(t);
    comp.setSize(960, 540);
    comp.render(S.project, t, p.source, {});
    const b = await new Promise((r) => comp.canvas.toBlob(r, 'image/png'));
    await window.native.cacheWrite(`layers-${t}.png`, await b.arrayBuffer());
  }
  p.suspended = false;
  st.select(cGreen.id); S.emit('inspect', 'chroma'); p.seek(1);
  await new Promise((r) => setTimeout(r, 1200));
  await window.native.selftestCapture(OUT + 'ui-chroma.png');
  log('ALL OK');
} catch (e) { log('FATAL', e.stack); }
window.native.selftestDone(0);
