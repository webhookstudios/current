// Brand kits: several kits, one in use or none, applied to new titles, stickers and intros.
// Restores an empty, switched-off brand file at the end.
const base = new URL('../src/js/', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname;
const M = new URL('./media/', import.meta.url).pathname;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => window.native.selftestCapture(OUT + n + '.png');
let bad = 0;
const check = (ok, what) => { log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
const B = await import(base + 'brand.js');
try {
  document.querySelector('.start button.primary')?.click();
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const UB = await import(base + 'ui/brand.js');
  const S = st.store;
  const chip = () => document.querySelector('.brand-chip').textContent.trim();
  check(chip() === 'Brand off', `chip says "${chip()}" with no kit`);
  // two kits, the first in use
  B.brand.kits.splice(0);
  const a = Object.assign(B.newKit('Acme'), { colors: { primary: '#e63946', secondary: '#457b9d', accent: '#f4a261' }, font: 'Poppins', company: 'Acme Studio', initials: 'AS', logo: M + 'photo.png' });
  const b = Object.assign(B.newKit('Second'), { colors: { primary: '#2a9d8f', secondary: '#264653', accent: '#e9c46a' } });
  B.brand.kits.push(a, b);
  B.brand.enabled = true; B.brand.active = a.id; B.saveBrand();
  await wait(400);
  check(chip() === 'Acme', `chip shows the kit in use (${chip()})`);
  UB.openBrandKits(); await wait(500);
  check(document.querySelectorAll('.bk-item').length === 2, 'Brand kits window lists both kits');
  await shot('brand-1-window');
  document.querySelector('.modal .modal-f .btn.primary').click(); await wait(200);
  // a professional title takes the kit's colors and font
  await A.insertItem({ kind: 'title', id: 'pro-block' }, { trackId: st.videoTracks()[0].id, time: 0 });
  let t = S.project.clips.at(-1);
  check(t.params.colors.join() === ['#1b1f24', '#e63946', '#457b9d', '#5a5f66'].join(), `title colors branded: ${t.params.colors.join(' ')}`);
  check(t.params.font === 'Poppins', 'title uses the kit heading font');
  // the Monogram intro takes the initials and company
  await A.insertPack((await import(base + 'templates/packs.js')).packById('intro-pro-monogram'), { time: 10, trackId: st.mainTrack().id }, true);
  const mono = S.project.clips.find((c) => c.template === 'pro-monogram');
  check(mono.params.texts[0] === 'AS' && mono.params.texts[1] === 'Acme Studio' && mono.params.colors[0] === '#e63946', `Monogram uses ${mono.params.texts.slice(0, 2).join(' / ')} in ${mono.params.colors[0]}`);
  // emoji stickers keep their own colors
  await A.insertItem({ kind: 'element', id: 'emo-heart-eyes' }, { trackId: st.videoTracks()[0].id, time: 20 });
  const emo = S.project.clips.at(-1);
  const E = (await import(base + 'templates/elements.js')).elementById('emo-heart-eyes');
  check(emo.params.colors.join() === E.colors.join(), 'emoji sticker keeps its colors');
  // switching kits, then turning branding off
  B.brand.active = b.id; B.saveBrand();
  await A.insertItem({ kind: 'title', id: 'pro-lesson' }, { trackId: st.videoTracks()[0].id, time: 30 });
  t = S.project.clips.at(-1);
  check(t.params.colors[1] === '#2a9d8f' && !t.params.font, `second kit applied (${t.params.colors[1]}, template font kept)`);
  B.brand.enabled = false; B.saveBrand(); await wait(300);
  await A.insertItem({ kind: 'title', id: 'pro-lesson' }, { trackId: st.videoTracks()[0].id, time: 40 });
  t = S.project.clips.at(-1);
  check(t.params.colors[1] === '#ffb703', 'with branding off, new titles keep their own colors');
  check(chip() === 'Brand off', 'chip shows Brand off');
  // apply to an existing clip
  B.brand.enabled = true; B.brand.active = a.id; B.saveBrand();
  st.select(t.id); UB.applyBrand(st.selectedClips());
  check(t.params.colors[1] === '#e63946', 'Apply brand to selected recolors the clip');
  st.undo();
  check(st.clipById(t.id).params.colors[1] === '#ffb703', 'and Ctrl+Z undoes it');
  // the brand menu
  const items = UB.brandMenu().filter((i) => i !== '-').map((i) => i.label);
  check(items.includes('Off') && items.includes('Acme') && items.includes('Second') && items.includes('Add logo at playhead'), `Brand menu: ${items.join(' | ')}`);
  // the logo goes in at the playhead, top right
  A.app.player.seek(2); await wait(200);
  await UB.brandMenu().find((i) => i.label === 'Add logo at playhead').run();
  await wait(300);
  const logo = S.project.clips.find((c) => c.name === 'Acme logo');
  check(!!logo && Math.abs(logo.start - 2) < 0.01 && logo.transform.x > 0.3, 'Add logo at playhead puts the logo top right');
  const under = S.project.clips.find((c) => c.template === 'pro-block');
  check(st.videoTracks().indexOf(st.trackById(logo.trackId)) < st.videoTracks().indexOf(st.trackById(under.trackId)), 'the logo goes on a track above the title playing at that time');
  // library title previews follow the kit
  (await import(base + 'ui/library.js')).setTab('title'); await wait(500);
  await shot('brand-2-library');
} catch (e) { bad++; console.error('[test] ERROR', e.stack); }
B.brand.kits.splice(0); B.brand.enabled = false; B.brand.active = null; B.saveBrand();
await wait(400);
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
