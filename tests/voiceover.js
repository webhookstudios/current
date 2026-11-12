// Voiceover recording and the Effects list. Run with a simulated microphone:
//   CURRENT_VOICEOVER_DIR=tests/out/voiceovers npx electron . --selftest=tests/voiceover.js --use-fake-device-for-media-stream
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const M = new URL('./media/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const ptr = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const until = async (f, ms = 6000) => { const t = performance.now(); while (performance.now() - t < ms) { const v = f(); if (v) return v; await wait(50); } return null; };
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };

async function openDialog(viaKey) {
  if (viaKey) key('r');
  else document.querySelector('[data-tip="Record voiceover (R)"]').click();
  const dlg = await until(() => [...document.querySelectorAll('.modal')].find((m) => m.textContent.includes('Record a voiceover')));
  const start = dlg && [...dlg.querySelectorAll('.modal-f button')].find((b) => b.textContent.includes('Start recording'));
  await until(() => start && !start.disabled);
  return { dlg, start };
}
function setCountdown(dlg, v) {
  const num = [...dlg.querySelectorAll('.row')].find((r) => r.textContent.startsWith('Countdown')).querySelector('input.val');
  num.value = v; num.dispatchEvent(new Event('change'));
}

try {
  localStorage.removeItem('current.voiceover');
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const S = st.store;
  const [vid] = await A.importPaths([M + 'test1.mp4']);
  await A.insertItem({ kind: 'media', id: vid.id }, { trackId: st.mainTrack().id, time: 0 });
  const end0 = st.projectDuration();
  A.app.player.seek(2); await wait(400);

  // 1. Dialog: microphone list, level meter, Start enabled, countdown 3 by default
  let { dlg, start } = await openDialog(false);
  const opts = dlg.querySelectorAll('select option');
  check(opts.length > 0 && !start.disabled, `dialog lists ${opts.length} microphone(s): ${[...opts].map((o) => o.textContent).join(' | ')}`);
  const cd = [...dlg.querySelectorAll('.row')].find((r) => r.textContent.startsWith('Countdown')).querySelector('input.val').value;
  check(+cd === 3, `countdown defaults to ${cd}`);
  let peak = 0;
  for (let i = 0; i < 30; i++) { peak = Math.max(peak, parseFloat(dlg.querySelector('.vo-meter i').style.width) || 0); await wait(50); }
  check(peak > 5, `level meter moves (peak ${peak.toFixed(0)}%)`);
  await shot('vo-1-dialog');

  // 2. Countdown 2 s, then the panel can be dragged while it counts down
  setCountdown(dlg, 2);
  start.click();
  const panel = await until(() => document.querySelector('.rec-panel'));
  await wait(250);
  check(document.querySelector('.rec-count b')?.textContent === '2', `countdown shows ${document.querySelector('.rec-count b')?.textContent}`);
  check(!S.playing, 'nothing plays during the countdown');
  await shot('vo-2-countdown');
  const g = panel.querySelector('.grip').getBoundingClientRect();
  const off = [g.left + 4 - panel.offsetLeft, g.top + 4 - panel.offsetTop]; // where the grip was grabbed, inside the panel
  ptr(panel.querySelector('.grip'), 'pointerdown', g.left + 4, g.top + 4);
  ptr(window, 'pointermove', 140, 120); ptr(window, 'pointerup', 140, 120);
  check(Math.abs(panel.offsetLeft - (140 - off[0])) < 2 && Math.abs(panel.offsetTop - (120 - off[1])) < 2, `panel dragged to ${panel.offsetLeft},${panel.offsetTop}`);
  check(!!JSON.parse(localStorage.getItem('current.voiceover')).panel, 'panel position is remembered');

  // 3. Recording: preview plays, red edge, panel shows Stop
  await until(() => panel.classList.contains('live'), 3000);
  check(S.playing && document.querySelector('.stage .frame').classList.contains('recording'), 'recording: project playing, preview outlined');
  const stopBtn = panel.querySelector('button');
  check(stopBtn.textContent.includes('Stop recording'), `panel button says "${stopBtn.textContent}"`);
  await wait(1200);
  await shot('vo-3-recording');
  await wait(1300);
  stopBtn.click();
  const c1 = await until(() => S.project.clips.find((c) => c.name === 'Voiceover 1'));
  check(!!c1, 'Voiceover 1 added to the timeline');
  if (c1) {
    const tr = st.trackById(c1.trackId);
    check(tr.kind === 'audio', `on audio track "${tr.name}"`);
    check(Math.abs(c1.start - 2) < 0.01, `starts at the playhead (${c1.start.toFixed(3)} s)`);
    check(c1.duration > 2.2 && c1.duration < 3.0, `length matches the recording (${c1.duration.toFixed(2)} s)`);
    const m = st.mediaById(c1.mediaId);
    check(m.path.includes('voiceovers/Voiceover ') && m.path.endsWith('.wav') && await window.native.exists(m.path), `saved as ${m.path.split('/').slice(-2).join('/')}`);
    check(S.selection.has(c1.id), 'new clip is selected');
  }
  check(!document.querySelector('.rec-panel, .rec-shield') && !S.playing, 'panel gone and playback stopped');
  await wait(600);
  await shot('vo-4-added');

  // 4. R opens it; Esc during the countdown cancels with nothing added
  const n0 = S.project.clips.length;
  ({ dlg, start } = await openDialog(true));
  check(+[...dlg.querySelectorAll('.row')].find((r) => r.textContent.startsWith('Countdown')).querySelector('input.val').value === 2, 'countdown setting remembered (2)');
  start.click();
  await until(() => document.querySelector('.rec-panel'));
  await wait(300);
  key('Escape');
  await wait(300);
  check(!document.querySelector('.rec-panel') && S.project.clips.length === n0 && !S.playing, 'Esc during countdown cancels');

  // 5. Countdown 0 starts at once; Space stops
  ({ dlg, start } = await openDialog(true));
  setCountdown(dlg, 0);
  start.click();
  await until(() => document.querySelector('.rec-panel.live'), 1500);
  check(!!document.querySelector('.rec-panel.live'), 'countdown 0 starts recording right away');
  await wait(1200);
  key(' ');
  const c2 = await until(() => S.project.clips.find((c) => c.name === 'Voiceover 2'));
  check(!!c2 && c2.duration > 0.9 && c2.duration < 1.6, `Space stops: Voiceover 2, ${c2?.duration.toFixed(2)} s`);

  // 6. Starting after the end of the video keeps going past the end
  A.app.player.seek(end0 + 1);
  ({ dlg, start } = await openDialog(false));
  start.click();
  await until(() => document.querySelector('.rec-panel.live'), 1500);
  await wait(1500);
  check(S.playing && S.time > end0 + 2, `records past the end (playhead ${S.time.toFixed(2)} s, video ends ${end0.toFixed(2)} s)`);
  document.querySelector('.rec-panel button').click();
  const c3 = await until(() => S.project.clips.find((c) => c.name === 'Voiceover 3'));
  check(!!c3 && Math.abs(c3.start - (end0 + 1)) < 0.01, `Voiceover 3 starts at ${c3?.start.toFixed(2)} s`);

  // 7. Undo takes the last take off
  st.undo();
  check(!S.project.clips.some((c) => c.name === 'Voiceover 3'), 'Ctrl+Z removes the last voiceover');

  // 8. Effects list updates as soon as an effect is added or removed (no tab switch)
  const v = S.project.clips.find((c) => c.type === 'video');
  st.select(v.id); S.emit('inspect', 'effects'); await wait(200);
  const count = () => document.querySelectorAll('.insp-body .fx-item').length;
  const before = count();
  const sel = [...document.querySelectorAll('.insp-body select')].find((s) => s.textContent.includes('Add an effect'));
  sel.focus();
  sel.value = sel.options[3].value; sel.dispatchEvent(new Event('change'));
  await wait(150);
  check(count() === before + 1, `adding an effect shows at once (${before} → ${count()})`);
  const sel2 = [...document.querySelectorAll('.insp-body select')].find((s) => s.textContent.includes('Add an effect'));
  sel2.focus();
  sel2.value = sel2.options[8].value; sel2.dispatchEvent(new Event('change'));
  await wait(150);
  check(count() === before + 2, `adding a second effect shows at once (${count()})`);
  await shot('vo-5-effects');
  const x = document.querySelector('.insp-body .fx-item button');
  x.focus(); x.click();
  await wait(150);
  check(count() === before + 1 && v.effects.length === before + 1, `removing an effect shows at once (${count()})`);
  // dropping an effect from the library while a button in the panel has focus
  document.querySelector('.insp-body .fx-item button').focus();
  A.applyLookToClip(v.id, { kind: 'effect', id: 'vhs' });
  await wait(150);
  check(count() === before + 2, `effect dropped from the library shows at once (${count()})`);
  // typing in a text box is still not interrupted
  await A.insertItem({ kind: 'title', id: 'lt-pill' }, { trackId: st.videoTracks()[0].id, time: 0 });
  const t = S.project.clips.at(-1);
  st.select(t.id); S.emit('inspect', 'text'); await wait(200);
  const ta = document.querySelector('.insp-body textarea, .insp-body input[type=text]');
  if (ta) {
    ta.focus(); ta.value += ' typed'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(100);
    check(document.activeElement === ta, 'typing in a text box keeps focus');
  }
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
