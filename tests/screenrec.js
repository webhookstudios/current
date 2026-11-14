// Screen recording with a webcam bubble. An animated canvas stands in for the desktop's share
// dialog; run with simulated camera and microphone:
//   CURRENT_RECORDING_DIR=tests/out/recordings npx electron . --selftest=tests/screenrec.js --use-fake-device-for-media-stream
const base = new URL('../src/js/', import.meta.url).href;
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
const until = async (f, ms = 15000) => { const t = performance.now(); while (performance.now() - t < ms) { const v = f(); if (v) return v; await wait(100); } return null; };
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
try {
  localStorage.removeItem('current.screenrec');
  // the stand-in for a shared screen: a moving pattern
  window.__currentTestScreen = async () => {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
    const g = cv.getContext('2d', { alpha: false });
    let f = 0;
    setInterval(() => { f++; g.fillStyle = '#2b3a55'; g.fillRect(0, 0, 1280, 720); g.fillStyle = '#ffd166'; g.fillRect((f * 12) % 1280, 300, 160, 120); g.fillStyle = '#fff'; g.font = '48px sans-serif'; g.fillText('Shared screen ' + f, 60, 100); }, 33);
    return cv.captureStream(30);
  };
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const SR = await import(base + 'ui/screenrec.js');
  const S = st.store;
  // a new project moves the playhead to 0 on its next frame; a capture forces that frame now
  await shot('screenrec-0-new');
  A.app.player.seek(1.5);
  SR.openScreenRecord();
  const dlg = await until(() => [...document.querySelectorAll('.modal')].find((m) => m.textContent.includes('Record screen')));
  await until(() => dlg.querySelector('video.sr-cam')?.srcObject);
  const [camSel, micSel] = dlg.querySelectorAll('select');
  check(camSel.options.length > 1 && camSel.value && micSel.value, `webcam "${camSel.selectedOptions[0]?.textContent}" and microphone "${micSel.selectedOptions[0]?.textContent}" chosen by default`);
  check(!!dlg.querySelector('video.sr-cam').srcObject, 'the webcam shows a live round preview');
  const cd = [...dlg.querySelectorAll('.row')].find((r) => r.textContent.startsWith('Countdown')).querySelector('input.val');
  cd.value = 1; cd.dispatchEvent(new Event('change'));
  const hide = [...dlg.querySelectorAll('.row')].find((r) => r.textContent.includes('Hide Current')).querySelector('input');
  hide.click(); // keep the test window on screen
  await shot('screenrec-1-dialog');
  [...dlg.querySelectorAll('.modal-f button')].find((b) => b.textContent.includes('Start recording')).click();
  const panel = await until(() => document.querySelector('.rec-panel.live'), 4000);
  check(!!panel, 'countdown, then recording');
  await wait(2500);
  await shot('screenrec-2-recording');
  panel.querySelector('button').click();
  const sc = await until(() => S.project.clips.find((c) => c.name === 'Screen recording'), 20000);
  const cc = S.project.clips.find((c) => c.name === 'Webcam');
  check(!!sc && !!cc, 'screen and webcam clips added');
  if (sc && cc) {
    const sm = st.mediaById(sc.mediaId), cm = st.mediaById(cc.mediaId);
    check(Math.abs(sc.start - 1.5) < 0.01 && sc.trackId === st.mainTrack().id, `the screen goes on the main track at the playhead (start ${sc.start.toFixed(2)}, ${st.trackById(sc.trackId).name})`);
    check(sc.duration > 2 && sc.duration < 4 && isFinite(sm.duration), `length ${sc.duration.toFixed(2)} s, readable duration (file was remuxed)`);
    const ac = S.project.clips.find((c) => c.name === 'Screen recording sound');
    const D = await import(base + 'engine/duck.js');
    check(!!ac && st.trackById(ac.trackId).kind === 'audio' && Math.abs(ac.start - sc.start) < 0.01, 'the microphone is its own clip on an audio track, starting with the screen');
    check(ac && Math.abs(ac.duration - sc.duration) < 0.6 && D.roleOf(ac) === 'voice' && st.mediaById(ac.mediaId).path.endsWith('.wav'), `narration ${ac?.duration.toFixed(2)} s, a WAV file, marked as Voice`);
    check(sc.muted, 'the screen clip itself is silent');
    check(sm.path.includes('/recordings/Screen recording ') && /\.(webm|mp4)$/.test(sm.path) /* H.264 MP4 on macOS */, `saved as ${sm.path.split('/').slice(-2).join('/')}`);
    const vt = st.videoTracks();
    check(vt.indexOf(st.trackById(cc.trackId)) < vt.indexOf(st.trackById(sc.trackId)), 'the webcam is on a track above the screen');
    check(cc.shape === 'circle' && cc.border?.width > 0 && cc.muted && cc.transform.scale < 0.4 && cc.transform.x > 0.2 && cc.transform.y > 0.2, 'the webcam is a round, outlined bubble in the bottom-right corner');
    const cw = 1 - cc.crop.l - cc.crop.r, chh = 1 - cc.crop.t - cc.crop.b;
    check(Math.abs((cw * cm.width) - (chh * cm.height)) < 2, 'cropped to a square, so the bubble is a true circle');
  }
  A.app.player.seek(2.5); await wait(800);
  await shot('screenrec-3-added');
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
