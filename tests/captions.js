// Automatic captions with a ready-made transcript in whisper.cpp's JSON format:
//   CURRENT_FAKE_WHISPER=tests/fixtures/whisper-words.json npx electron . --selftest=tests/captions.js
const base = new URL('../src/js/', import.meta.url).href;
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const until = async (f, ms = 15000) => { const t = performance.now(); while (performance.now() - t < ms) { const v = f(); if (v) return v; await wait(100); } return null; };
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
function wav(seconds, fn, sr = 48000) {
  const n = Math.round(seconds * sr), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, fn(i / sr) * 0x7fff, true);
  return buf;
}
try {
  document.querySelector('.start button.primary')?.click();
  await shot('cap-0');
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const C = await import(base + 'ui/captions.js');
  const S = st.store;
  const path = await window.native.cacheWrite('test-speech.wav', wav(10, (t) => 0.3 * Math.sin(2 * Math.PI * 300 * t)));
  const [m] = await A.importPaths([path]);
  m.voiceover = true;
  await A.insertItem({ kind: 'media', id: m.id }, { trackId: st.audioTracks()[0].id, time: 0 });
  // the dialog
  C.openCaptions();
  const dlg = await until(() => [...document.querySelectorAll('.modal')].find((x) => x.textContent.includes('Generate captions')));
  check(!!dlg && !dlg.querySelector('.cap-warn'), 'Generate captions opens (speech recognition found)');
  dlg.querySelector('select:nth-of-type(1)');
  const styleSel = [...dlg.querySelectorAll('.row')].find((r) => r.textContent.startsWith('Style')).querySelector('select');
  styleSel.value = 'sub-karaoke'; styleSel.dispatchEvent(new Event('change'));
  [...dlg.querySelectorAll('.cap-radio')].find((r) => r.textContent.startsWith('Both')).querySelector('input').click();
  await shot('cap-1-dialog');
  [...dlg.querySelectorAll('.modal-f button')].find((b) => b.textContent.includes('Generate captions')).click();
  const caps = await until(() => C.captionClips().length && C.captionClips());
  check(caps && caps.length === 4, `captions made: ${caps && caps.map((c) => `"${c.params.texts[0]}"`).join(' | ')}`);
  if (caps) {
    check(caps[0].params.texts[0] === 'Welcome to the lesson.' && !caps.some((c) => /BLANK/.test(c.params.texts[0])), 'breaks at the end of sentences, drops [BLANK_AUDIO]');
    check(caps.every((c) => c.template === 'sub-karaoke' && c.params.words?.length === c.params.texts[0].split(' ').length), 'Word Highlight style, with each word’s real timing');
    check(caps.every((c, i) => !i || c.start >= caps[i - 1].start + caps[i - 1].duration - 1e-6), 'captions do not overlap');
    const tr = st.trackById(caps[0].trackId);
    check(tr.name === 'Captions' && tr.captions && st.videoTracks()[0] === tr, 'on a Captions track at the top');
    check(S.project.captions?.mode === 'both', 'the show-captions choice is saved with the project');
  }
  // editing
  C.openCaptionEditor(); await wait(300);
  const rows = [...document.querySelectorAll('.cap-row')];
  check(rows.length === 4, `Edit captions lists ${rows.length} captions`);
  const inp = rows[0].querySelector('input');
  inp.value = 'Welcome to lesson one.'; inp.dispatchEvent(new Event('change'));
  check(C.captionClips()[0].params.texts[0] === 'Welcome to lesson one.', 'editing a line changes the caption');
  await shot('cap-2-editor');
  rows[3].querySelector('button.ibtn').click(); await wait(100);
  check(C.captionClips().length === 3, 'deleting a caption removes it');
  document.querySelector('.modal-f .btn.primary').click(); await wait(100);
  st.undo();
  check(C.captionClips().length === 4, 'Ctrl+Z brings it back');
  // the caption file
  const srt = C.captionsSrt();
  log('srt starts:', JSON.stringify(srt.slice(0, 80)));
  check(/^1\n00:00:00,300 --> 00:00:0\d,\d{3}\nWelcome to lesson one\.\n\n2\n/.test(srt), 'SRT file text is numbered, timed and in order');
  // file only: captions are left out of the picture
  const c0 = C.captionClips()[0];
  A.app.player.seek(c0.start + 0.5); await wait(300);
  const comp = A.app.compositor, sum = () => { const px = comp.readPixels(); let s = 0; for (let i = 0; i < px.length; i += 16) s += px[i]; return s; };
  comp.render(S.project, c0.start + 0.5, A.app.player.source, { offscreen: true }); const withCaps = sum();
  comp.render(S.project, c0.start + 0.5, A.app.player.source, { offscreen: true, skip: (c) => c.caption }); const without = sum();
  check(withCaps > 0 && without === 0, 'with "file only", captions are left out of the exported picture');
  A.app.player.seek(c0.start + 0.6); await wait(400);
  await shot('cap-3-preview');
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
