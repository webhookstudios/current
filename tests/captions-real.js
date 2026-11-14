// Real captions: whisper.cpp from Ubuntu's archive and the real model (downloaded once), on real speech.
//   ln -sf /path/to/narrated-video.mp4 tests/out/speech.mp4 && npx electron . --selftest=tests/captions-real.js
// Needs `sudo apt install whisper.cpp` and an internet connection the first time (60 MB model).
const base = new URL('../src/js/', import.meta.url).href;
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const until = async (f, ms = 15000) => { const t = performance.now(); while (performance.now() - t < ms) { const v = f(); if (v) return v; await wait(200); } return null; };
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
try {
  const speech = OUT + 'speech.mp4';
  document.querySelector('.start button.primary')?.click();
  await shot('capreal-0');
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const C = await import(base + 'ui/captions.js');
  const S = st.store;
  const status = await window.native.captionsStatus();
  check(status.engine, 'speech recognition (whisper-cli) is installed');
  log('standard model already downloaded:', status.models.standard.have);
  const [m] = await A.importPaths([speech]);
  await until(() => st.mediaById(m.id)?.duration > 0);
  await A.insertItem({ kind: 'media', id: m.id }, { trackId: st.mainTrack().id, time: 0 });
  const clip = S.project.clips[0];
  log(`clip "${clip.name}", ${clip.duration.toFixed(1)} s`);
  try { localStorage.setItem('current.captions', JSON.stringify({ lang: 'en', model: 'standard', style: 'sub-box', maxWords: 7 })); } catch { /* fine */ }
  C.openCaptions();
  const dlg = await until(() => [...document.querySelectorAll('.modal')].find((x) => x.textContent.includes('Generate captions')));
  check(!!dlg && !dlg.querySelector('.cap-warn'), 'the dialog finds speech recognition (no install notice)');
  await shot('capreal-1-dialog');
  // watch the progress window and any error message
  const seen = new Set();
  const watch = setInterval(() => {
    const big = document.querySelector('.exp-progress .big')?.textContent;
    if (big) seen.add(big.replace(/\d+%/, '%'));
    document.querySelectorAll('.toast').forEach((t) => seen.add('toast: ' + t.textContent));
  }, 150);
  const t0 = performance.now();
  [...dlg.querySelectorAll('.modal-f button')].find((b) => b.textContent.includes('Generate captions')).click();
  await wait(1500);
  await shot('capreal-2-progress');
  const caps = await until(() => (C.captionClips().length && C.captionClips()) || [...seen].find((s) => s.startsWith('toast: Captions could not')), 8 * 60 * 1000);
  clearInterval(watch);
  log(`finished in ${((performance.now() - t0) / 1000).toFixed(1)} s; stages seen:`, [...seen].join(' | '));
  check(Array.isArray(caps) && caps.length >= 5, `captions made: ${Array.isArray(caps) ? caps.length : caps}`);
  if (Array.isArray(caps)) {
    caps.forEach((c) => log(`  ${c.start.toFixed(2).padStart(6)}–${(c.start + c.duration).toFixed(2).padStart(6)}  ${c.params.texts[0]}`));
    const all = caps.map((c) => c.params.texts[0]).join(' ');
    check(/[a-z]{3,}/i.test(all) && !/\[|\]/.test(all), 'real words, no [BLANK_AUDIO]-style tags');
    check(caps.every((c, i) => !i || c.start >= caps[i - 1].start + caps[i - 1].duration - 1e-6), 'captions do not overlap');
    check(caps.every((c) => c.start >= 0 && c.start + c.duration <= clip.duration + 0.5), 'all captions sit inside the video');
    check(caps.every((c) => c.params.texts[0].split(' ').length <= 7), 'no caption longer than 7 words');
    // timing against the sound itself: loud 10 ms steps of the clip's audio
    const AU = await import(base + 'engine/audio.js');
    const buf = await AU.decodeFile(speech);
    const d = buf.getChannelData(0), hop = Math.round(buf.sampleRate / 100), nf = Math.floor(d.length / hop);
    const rms = Array.from({ length: nf }, (_, f) => { let s = 0; for (let i = f * hop; i < (f + 1) * hop; i++) s += d[i] * d[i]; return Math.sqrt(s / hop); });
    const srt = [...rms].sort((a, b) => a - b), thr = srt[Math.floor(nf * 0.1)] + (srt[Math.floor(nf * 0.95)] - srt[Math.floor(nf * 0.1)]) * 0.1;
    const loudIn = (a, b) => rms.slice(Math.max(0, Math.floor(a * 100)), Math.floor(b * 100)).some((v) => v >= thr);
    const lastLoud = (a, b) => { for (let f = Math.floor(b * 100) - 1; f >= a * 100; f--) if (rms[f] >= thr) return f / 100; return a; };
    const early = caps.filter((c) => !loudIn(c.start, c.start + 0.6));
    // lingering: on screen through a pause after its last word (the next speech may start just before the next caption)
    const late = caps.filter((c) => { const end = c.start + c.duration; return end - lastLoud(c.start, end - 0.3) > 1.5; });
    early.forEach((c) => log('  starts before the speech:', c.start.toFixed(2), c.params.texts[0]));
    late.forEach((c) => log('  stays after the speech:', (c.start + c.duration).toFixed(2), c.params.texts[0]));
    check(early.length <= 1, `each caption appears as its words are spoken (${early.length} start early)`);
    check(late.length <= 1, `and leaves soon after (${late.length} linger over a pause)`);
    const find = caps.find((c) => c.params.texts[0].startsWith('Find the'));
    check(find && find.start > 29.2 && find.start < 29.9, `"Find the…" appears with the speech at 29.5 s (${find?.start.toFixed(2)})`);
    check(!caps.some((c) => c.params.texts[0].split(' ').length === 1 && caps.length > 1 && /[.!?]$/.test(c.params.texts[0]) && c.duration < 3), 'no word left alone at the end of a sentence');
    const status2 = await window.native.captionsStatus();
    check(status2.models.standard.have, 'the model is kept for next time');
    A.app.player.seek(caps[2].start + 0.3); await wait(600);
    await shot('capreal-3-preview');
  }
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
