// Auto-ducking and Remove pauses, with generated sound: a "voice" (1 kHz bursts with gaps) and
// "music" (a steady 220 Hz tone). The exported mix is measured at each frequency.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const until = async (f, ms = 8000) => { const t = performance.now(); while (performance.now() - t < ms) { const v = f(); if (v) return v; await wait(50); } return null; };
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };

function wav(seconds, fn, sr = 48000) {
  const n = Math.round(seconds * sr), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, fn(i / sr))) * 0x7fff, true);
  return buf;
}
// Voice: talking 0–1, 2–3, 4.5–5.5 s; silent in between and after (to 7 s).
const talking = (t) => (t < 1) || (t >= 2 && t < 3) || (t >= 4.5 && t < 5.5);
function level(samples, sr, f, from, to) { // Goertzel magnitude of frequency f over [from, to)
  const a = Math.floor(from * sr), b = Math.floor(to * sr), k = 2 * Math.cos(2 * Math.PI * f / sr);
  let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = samples[i] + k * s1 - s2; s2 = s1; s1 = s0; }
  return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2) / (b - a);
}

try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const D = await import(base + 'engine/duck.js');
  const SIL = await import(base + 'ui/silence.js');
  const { mixAudio } = await import(base + 'ui/export.js');
  const S = st.store;
  const vPath = await window.native.cacheWrite('test-voice.wav', wav(7, (t) => (talking(t) ? 0.5 * Math.sin(2 * Math.PI * 1000 * t) : 0.002 * Math.sin(2 * Math.PI * 50 * t))));
  const mPath = await window.native.cacheWrite('test-music.wav', wav(7, (t) => 0.3 * Math.sin(2 * Math.PI * 220 * t)));
  const [vm, mm] = await A.importPaths([vPath, mPath]);
  vm.voiceover = true; vm.name = 'Voiceover 1';
  await A.insertItem({ kind: 'media', id: vm.id }, { trackId: st.audioTracks()[0].id, time: 0 });
  await A.insertItem({ kind: 'media', id: mm.id }, { trackId: st.audioTracks()[1].id, time: 0 });
  const voice = S.project.clips.find((c) => c.mediaId === vm.id), music = S.project.clips.find((c) => c.mediaId === mm.id);
  const media = await import(base + 'engine/media.js');
  await until(() => media.peaks.get(vPath) && media.peaks.get(mPath));
  check(D.roleOf(voice) === 'voice' && D.roleOf(music) === 'music', `roles: voiceover is ${D.roleOf(voice)}, imported song is ${D.roleOf(music)}`);
  check(D.ducks(music) && !D.ducks(voice), 'new music clips duck by default; voices never do');
  st.changed();
  const g = (t) => D.duckGain(music, t);
  log('duck gain at 0.5/1.5/2.5/3.9/5/6.6 s:', [0.5, 1.5, 2.5, 3.9, 5, 6.6].map((t) => g(t).toFixed(2)).join(' '));
  check(g(0.5) < 0.3 && g(2.5) < 0.3 && g(5) < 0.3, 'music is about 12 dB down while the voice talks');
  check(g(1.5) < 0.6, 'and stays down across a short 1 s gap (held)');
  check(g(3.95) > 0.8 && g(6.6) > 0.95, 'and comes back up in longer pauses and after the voice ends');
  // the exported mix
  const out = await mixAudio(S.project, 7);
  const ctx = new OfflineAudioContext(1, 48000, 48000);
  const buf = await ctx.decodeAudioData(out.slice(0));
  const d = buf.getChannelData(0);
  const mTalk = level(d, buf.sampleRate, 220, 0.3, 0.9), mQuiet = level(d, buf.sampleRate, 220, 6.2, 6.9);
  log(`export: music level while talking ${mTalk.toFixed(3)}, after the voice ends ${mQuiet.toFixed(3)}`);
  check(mTalk / mQuiet < 0.35, 'the exported music dips under the voice');
  // switching ducking off restores full music level
  st.edit(() => { music.duck.on = false; });
  check(D.duckGain(music, 0.5) === 1, 'turning ducking off keeps the music at full level');
  st.undo();
  // the Audio tab
  st.select(music.id); S.emit('inspect', 'audio'); await wait(300);
  const insp = document.querySelector('.insp-body').textContent;
  check(insp.includes('Lower under voices') && insp.includes('Lower by') && insp.includes('Remove pauses'), 'Audio tab shows clip type, ducking and Remove pauses');
  await shot('audio-1-tab');
  // Remove pauses on the voice (the undo above replaced the clip objects)
  const pauses = SIL.findPauses(voice, { rel: 30, minLen: 0.7, pad: 0.15 });
  log('pauses:', pauses.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`).join(', '));
  check(pauses.length === 3, `finds the two gaps and the silent end (${pauses.length})`);
  st.select(voice.id); S.emit('inspect', 'audio'); await wait(200);
  SIL.openRemovePauses(voice); await wait(500);
  check(!!document.querySelector('.sil-wave') && /3 pauses found/.test(document.querySelector('.sil-sum').textContent), `dialog: ${document.querySelector('.sil-sum')?.textContent}`);
  await shot('audio-2-pauses');
  [...document.querySelectorAll('.modal-f button')].find((b) => b.textContent === 'Remove pauses').click();
  await wait(300);
  const parts = S.project.clips.filter((c) => c.mediaId === vm.id).sort((a, b) => a.start - b.start);
  const total = parts.reduce((s, c) => s + c.duration, 0);
  log('parts:', parts.map((c) => `${c.start.toFixed(2)}+${c.duration.toFixed(2)} @${c.in.toFixed(2)}`).join(' | '));
  check(parts.length === 3 && parts.every((c, i) => !i || Math.abs(c.start - (parts[i - 1].start + parts[i - 1].duration)) < 0.001), 'the voice is now 3 back-to-back pieces with no gaps');
  check(Math.abs(total - 3.9) < 0.2, `kept ${total.toFixed(2)} s (3 s of talking plus padding)`);
  st.undo();
  check(S.project.clips.filter((c) => c.mediaId === vm.id).length === 1 && Math.abs(st.clipById(voice.id).duration - 7) < 0.01, 'Ctrl+Z puts the whole clip back');
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
