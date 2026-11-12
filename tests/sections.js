// News, Gaming and Travel sections: headings for intros, mid-rolls and outros, + places each where it
// belongs, and the Activity Timer's time box sets a real countdown length.
const base = new URL('../src/js/', import.meta.url).href;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; log(ok ? 'ok  ' : 'FAIL', msg); };
const near = (a, b) => Math.abs(a - b) < 1e-3;
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const L = await import(base + 'ui/library.js');
  const { TIMER } = await import(base + 'templates/scenekit.js');
  const S = st.store;
  const M = new URL('./media/', import.meta.url).pathname;

  // 1. headings in each section
  for (const sec of ['News', 'Gaming', 'Travel']) {
    L.setTab('pack', sec); await wait(200);
    const kids = [...document.querySelectorAll('#library .grid > *')];
    const heads = kids.filter((e) => e.classList.contains('grid-head'));
    const count = (role) => { const i = kids.findIndex((e) => e.dataset.role === role); let n = 0; for (let j = i + 1; j < kids.length && kids[j].classList.contains('card'); j++) n++; return n; };
    check(heads.map((e) => e.dataset.role).join(',') === 'intro,mid,outro', `${sec}: headings ${heads.map((e) => e.textContent).join(' | ')}`);
    check(count('intro') === 10 && count('mid') === 20 && count('outro') === 10, `${sec}: 10 intros, 20 mid-rolls, 10 outros (${count('intro')}, ${count('mid')}, ${count('outro')})`);
  }
  L.setTab('pack', 'Intros'); await wait(150);
  check(!document.querySelector('#library .grid .grid-head'), 'the plain Intros group has no headings');

  // 2. + puts a section intro at the start, a mid-roll at the playhead and an outro at the end
  const [vid] = await A.importPaths([M + 'test1.mp4']);
  await A.insertItem({ kind: 'media', id: vid.id }, { trackId: st.mainTrack().id, time: 0 });
  const v = S.project.clips.find((c) => c.mediaId === vid.id), vd = v.duration;
  await A.insertItem({ kind: 'pack', id: 'game-press-start' });
  const intro = S.project.clips.find((c) => c.template === 'seq-game-press-start');
  check(intro && near(intro.start, 0) && near(v.start, 5), `a Gaming intro goes at the start and the video moves to ${v.start.toFixed(2)} s`);
  const endBefore = st.projectDuration();
  await A.insertItem({ kind: 'pack', id: 'travel-stamp-end' });
  const outro = S.project.clips.find((c) => c.template === 'seq-travel-stamp-end');
  check(outro && near(outro.start, endBefore), `a Travel outro goes at the end (${outro?.start.toFixed(2)} s)`);
  S.time = v.start + vd / 2;
  await A.insertItem({ kind: 'pack', id: 'news-banner' });
  const mid = S.project.clips.find((c) => c.template === 'seq-news-banner');
  check(mid && near(mid.start, v.start + vd / 2), `a News mid-roll goes in at the playhead (${mid?.start.toFixed(2)} s)`);

  // 3. the Activity Timer's time box
  S.time = 0;
  await A.insertItem({ kind: 'pack', id: 'edu-timer' });
  const tm = S.project.clips.find((c) => c.template === 'seq-edu-timer');
  check(tm && near(tm.duration, 180 + TIMER.lead + TIMER.tail), `Activity Timer arrives 3 minutes long (${tm?.duration} s)`);
  st.select(tm.id); S.emit('inspect', 'text'); await wait(300);
  const box = [...document.querySelectorAll('.insp-body .hint')].find((e) => e.textContent === 'Timer length')?.nextElementSibling;
  check(box && box.value === '03:00', `the inspector has a Timer length box showing ${box?.value}`);
  box.focus(); box.value = '10 min'; box.dispatchEvent(new Event('input')); box.dispatchEvent(new Event('blur')); await wait(300);
  const tm2 = S.project.clips.find((c) => c.template === 'seq-edu-timer');
  check(near(tm2.duration, 600 + TIMER.lead + TIMER.tail), `typing “10 min” makes it 10 minutes (${tm2.duration} s)`);
  const box2 = [...document.querySelectorAll('.insp-body .hint')].find((e) => e.textContent === 'Timer length')?.nextElementSibling;
  check(box2?.value === '10:00', `the box then reads ${box2?.value}`);
  st.undo(); await wait(200);
  const tm3 = S.project.clips.find((c) => c.template === 'seq-edu-timer');
  check(tm3 && near(tm3.duration, 180 + TIMER.lead + TIMER.tail), `undo puts it back to 3 minutes (${tm3?.duration} s)`);
} catch (e) { bad++; log('FAIL error', e.stack || e.message); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
