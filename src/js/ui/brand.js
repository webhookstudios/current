// Brand kits window, the Brand menu and the top-bar indicator.
import { h, icon, FONTS, fileUrl } from '../util.js';
import { store, edit, selectedClips, makeClip, addClip, select, videoTracks, trackClips, ensureTrack } from '../state.js';
import { brand, activeKit, newKit, saveBrand, brandClip, brandColors } from '../brand.js';
import { app, importPaths } from '../actions.js';
import { templateOf, drawTemplateTo } from '../engine/renderer.js';
import { modal, toast, confirmBox } from './widgets.js';

// ---------- the top-bar indicator and the menu ----------
export function brandChip() {
  const chip = h('button.btn.brand-chip', { onclick: (e) => { const r = chip.getBoundingClientRect(); import('./widgets.js').then((w) => w.showMenu(r.left, r.bottom + 4, brandMenu())); } });
  const paint = () => {
    const k = activeKit();
    chip.replaceChildren(k ? h('span.dots', [k.colors.primary, k.colors.secondary, k.colors.accent].map((c) => h('i', { style: { background: c } }))) : icon('brand', 14), k ? k.name : 'Brand off');
    chip.title = k ? `Brand kit “${k.name}” is on: new titles, stickers and intros use its colors and font` : 'No brand kit: titles, stickers and intros keep their own look';
    chip.classList.toggle('on', !!k);
  };
  store.on('brand', paint);
  paint();
  return chip;
}

export function brandMenu() {
  const items = [{ label: 'Brand kits…', icon: 'brand', run: openBrandKits }, '-'];
  items.push({ label: 'Off', icon: !activeKit() ? 'check' : null, run: () => { brand.enabled = false; saveBrand(); toast('Brand kit off. New clips keep their own look.'); } });
  for (const k of brand.kits) items.push({ label: k.name, icon: activeKit()?.id === k.id ? 'check' : null, run: () => useKit(k) });
  if (activeKit()) {
    items.push('-',
      { label: 'Apply brand to selected clips', run: () => applyBrand(selectedClips()) },
      { label: 'Apply brand to every title and sticker', run: () => applyBrand(store.project.clips) },
      { label: 'Add logo at playhead', icon: 'media', disabled: !activeKit().logo, run: addLogo });
  }
  return items;
}

function useKit(k) {
  brand.enabled = true;
  brand.active = k.id;
  saveBrand();
  toast(`Using brand kit “${k.name}” for new titles, stickers and intros.`);
}

export function applyBrand(clips) {
  const kit = activeKit();
  const targets = clips.filter((c) => c.type === 'title' || c.type === 'element');
  if (!kit || !targets.length) { toast(kit ? 'Select a title or sticker first.' : 'Turn on a brand kit first.', 'err'); return; }
  edit(() => targets.forEach((c) => brandClip(c, templateOf(c), kit)));
  app.player.requestRender();
  toast(`Applied “${kit.name}” to ${targets.length} clip${targets.length > 1 ? 's' : ''}.`);
}

async function addLogo() {
  const kit = activeKit();
  if (!kit?.logo) return;
  if (!(await window.native.exists(kit.logo))) { toast('The logo file is missing. Choose it again in Brand kits.', 'err'); return; }
  const [m] = await importPaths([kit.logo]);
  if (!m) return;
  edit(() => {
    const c = makeClip('image', { mediaId: m.id, name: `${kit.name} logo`, start: store.time, duration: 5 });
    Object.assign(c.transform, { scale: 0.16, x: 0.4, y: -0.38 });
    // directly above the topmost track that has anything at this time, so the logo sits over everything
    const vt = videoTracks();
    const busy = vt.findIndex((tr) => trackClips(tr.id).some((o) => o.start < c.start + c.duration && o.start + o.duration > c.start));
    const above = busy < 0 ? vt[0] : vt[busy - 1];
    c.trackId = (above && !above.locked ? above : ensureTrack('video', 'top')).id;
    addClip(c, { overwrite: false });
    select(c.id);
  });
  app.player.seek(store.time);
  toast('Logo added in the top-right corner. Drag it anywhere, or stretch the clip to keep it on screen longer.');
}

// ---------- the Brand kits window ----------
export function openBrandKits() {
  let editing = activeKit() || brand.kits[0] || null;
  const list = h('div.bk-list');
  const pane = h('div.bk-edit');
  const sw = h('input', { type: 'checkbox', checked: brand.enabled, onchange: () => {
    brand.enabled = sw.checked;
    if (brand.enabled && !brand.kits.some((k) => k.id === brand.active)) {
      if (!brand.kits.length) brand.kits.push(newKit());
      brand.active = brand.kits[0].id;
      editing = brand.kits[0];
    }
    saveBrand(); paint();
  } });
  const body = h('div.bk',
    h('div.row.bk-switch', h('label.grow', h('b', 'Use a brand kit'), h('div.hint', 'While on, the titles, stickers and intros you add take the kit’s colors and heading font. Turn it off to keep every template’s own look.')), h('label.switch', sw, h('span'))),
    h('div.bk-main', list, pane));

  function paint() {
    sw.checked = brand.enabled;
    list.replaceChildren(
      ...brand.kits.map((k) => h('div.bk-item', { class: `bk-item${k === editing ? ' on' : ''}`, onclick: () => { editing = k; paint(); } },
        h('span.dots', [k.colors.primary, k.colors.secondary, k.colors.accent].map((c) => h('i', { style: { background: c } }))),
        h('span.nm', k.name),
        activeKit()?.id === k.id ? h('span.tag', 'In use') : null)),
      h('button.btn.small.ghost', { onclick: () => { const k = newKit(`Brand ${brand.kits.length + 1}`); brand.kits.push(k); editing = k; saveBrand(); paint(); } }, icon('plus', 14), 'New kit'));
    pane.replaceChildren(...(editing ? editor(editing) : [h('div.hint', { style: { padding: '30px 10px' } }, 'No brand kits yet. Click New kit to make one.')]));
  }

  function editor(k) {
    const save = () => { saveBrand(); drawSample(); list.querySelectorAll('.bk-item.on .nm').forEach((n) => { n.textContent = k.name; }); };
    const colorIn = (key, label) => h('label.bk-color', h('input', { type: 'color', value: k.colors[key], oninput: (e) => { k.colors[key] = e.target.value; save(); }, onchange: () => paint() }), h('span', label));
    const logoBox = h('div.bk-logo', k.logo ? h('img', { src: fileUrl(k.logo) }) : h('span.hint', 'No logo'));
    const sample = h('canvas.bk-sample', { width: 480, height: 270 });
    const drawSample = () => {
      const tpl = templateOf({ type: 'title', template: 'pro-block' });
      const ctx = sample.getContext('2d');
      ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, 480, 270);
      const tmp = document.createElement('canvas'); tmp.width = 480; tmp.height = 270;
      const texts = [...tpl.texts]; if (k.company) texts[1] = k.company;
      drawTemplateTo(tmp.getContext('2d'), { type: 'title', template: 'pro-block', start: 0, duration: 5, params: { texts, colors: brandColors(tpl.colors, k), font: k.font || null } }, 480, 270, 2.6);
      ctx.drawImage(tmp, 0, 0);
    };
    requestAnimationFrame(drawSample);
    return [
      h('div.row', h('label', 'Name'), h('input.grow', { type: 'text', value: k.name, oninput: (e) => { k.name = e.target.value || 'Untitled kit'; save(); }, onchange: () => paint() })),
      h('div.row', h('label', 'Colors'), h('div.bk-colors', colorIn('primary', 'Main'), colorIn('secondary', 'Second'), colorIn('accent', 'Accent'))),
      h('div.row', h('label', 'Heading font'), h('select.grow', { onchange: (e) => { k.font = e.target.value; save(); } }, h('option', { value: '' }, 'Each template’s own font'), FONTS.map((f) => h('option', { value: f, selected: k.font === f, style: { fontFamily: f } }, f)))),
      h('div.row', h('label', 'Logo'), logoBox,
        h('button.btn.small', { onclick: async () => { const p = await window.native.chooseImage('Choose your logo'); if (p) { k.logo = p; save(); paint(); } } }, k.logo ? 'Change…' : 'Choose…'),
        k.logo ? h('button.btn.small.ghost', { onclick: () => { k.logo = null; save(); paint(); } }, 'Remove') : null),
      h('div.row', h('label', 'Company'), h('input.grow', { type: 'text', value: k.company || '', placeholder: 'Your Company', oninput: (e) => { k.company = e.target.value; save(); } })),
      h('div.row', h('label', 'Initials'), h('input', { type: 'text', value: k.initials || '', placeholder: 'YC', maxlength: 3, style: { width: '70px' }, oninput: (e) => { k.initials = e.target.value; save(); } }),
        h('span.hint', 'Used by the Monogram intro and lower third.')),
      h('div.hint', 'Whites, blacks and greys in templates stay as they are, so text stays readable. Your colors replace the rest.'),
      sample,
      h('div.row.bk-actions',
        activeKit()?.id === k.id ? h('span.hint.inuse', icon('check', 14), 'This kit is in use') : h('button.btn.small.primary', { onclick: () => { useKit(k); paint(); } }, 'Use this kit'),
        h('div', { style: { flex: 1 } }),
        h('button.btn.small', { onclick: () => { const c = { ...JSON.parse(JSON.stringify(k)), id: newKit().id, name: `${k.name} copy` }; brand.kits.push(c); editing = c; saveBrand(); paint(); } }, 'Duplicate'),
        h('button.btn.small.danger', { onclick: async () => {
          if (!(await confirmBox(`Delete “${k.name}”?`, 'Clips that already use its colors keep them.', 'Delete'))) return;
          brand.kits.splice(brand.kits.indexOf(k), 1);
          if (brand.active === k.id) { brand.active = brand.kits[0]?.id || null; if (!brand.active) brand.enabled = false; }
          editing = brand.kits[0] || null; saveBrand(); paint();
        } }, 'Delete')),
    ];
  }

  paint();
  modal({ title: 'Brand kits', body, width: '820px', actions: [{ label: 'Done', primary: true, run: (close) => close() }] });
}

