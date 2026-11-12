// Reusable UI pieces: sliders, selects, colour pickers, menus, modals, toasts.
import { h, icon, clamp } from '../util.js';

export function slider({ label, min = 0, max = 100, step = 1, value = 0, unit = '', onInput, onChange, onStart, fmt, reset }) {
  const range = h('input', { type: 'range', min, max, step, value });
  const num = h('input.val', { type: 'number', min, max, step, value: fmtNum(value) });
  const paint = () => range.style.setProperty('--fill', `${((range.value - min) / (max - min)) * 100}%`);
  let started = false;
  const begin = () => { if (!started) { started = true; onStart?.(); } };
  range.addEventListener('pointerdown', begin);
  range.addEventListener('input', () => { begin(); num.value = fmtNum(+range.value); paint(); onInput?.(+range.value); });
  range.addEventListener('change', () => { started = false; onChange?.(+range.value); });
  num.addEventListener('change', () => {
    const v = clamp(+num.value, min, max);
    range.value = v; num.value = fmtNum(v); paint();
    onStart?.(); onInput?.(v); onChange?.(v);
  });
  paint();
  const row = h('div.row', h('label', label), range, num, unit ? h('span.hint', unit) : null);
  if (reset != null) row.addEventListener('dblclick', (e) => { if (e.target === row.firstChild) { range.value = reset; num.value = fmtNum(reset); paint(); onStart?.(); onInput?.(reset); onChange?.(reset); } });
  row.set = (v) => { range.value = v; num.value = fmtNum(v); paint(); };
  return row;
}
const fmtNum = (v) => (Math.abs(v) < 10 && v % 1 ? (+v).toFixed(2) : Math.round(v * 10) / 10);

export function select({ label, options, value, onChange }) {
  const s = h('select.grow', { onchange: () => onChange(s.value) }, options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
  return label ? h('div.row', h('label', label), s) : s;
}

export function toggle({ label, value, onChange }) {
  const inp = h('input', { type: 'checkbox', checked: !!value, onchange: () => onChange(inp.checked) });
  return h('div.row', h('label.grow', { style: { width: 'auto' } }, label), h('label.switch', inp, h('span')));
}

export function colorRow({ label, value, onInput, onChange, onStart }) {
  const c = h('input', { type: 'color', value: value || '#ffffff' });
  const hex = h('input', { type: 'text', value: value || '#ffffff', style: { width: '88px' } });
  c.addEventListener('pointerdown', () => onStart?.());
  c.addEventListener('input', () => { hex.value = c.value; onInput?.(c.value); });
  c.addEventListener('change', () => onChange?.(c.value));
  hex.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { c.value = hex.value; onStart?.(); onInput?.(hex.value); onChange?.(hex.value); } });
  return h('div.row', h('label', label), c, hex);
}

export function section(title, ...kids) {
  const extra = kids.length && kids[0] instanceof Node && kids[0].classList?.contains('sec-actions') ? kids.shift() : null;
  return h('div.sec', h('div.sec-h', h('span', title), extra), ...kids);
}

let openMenu = null;
export function closeMenu() { openMenu?.remove(); openMenu = null; document.querySelectorAll('.menu-btn.open').forEach((b) => b.classList.remove('open')); }
export function showMenu(x, y, items) {
  closeMenu();
  const m = h('div.dropdown', items.map((it) => {
    if (it === '-') return h('div.sep');
    return h('div.item', { class: it.disabled ? 'item disabled' : 'item', onclick: () => { closeMenu(); it.run(); } }, it.icon ? icon(it.icon, 16) : h('span', { style: { width: '16px' } }), it.label, it.kbd ? h('span.kbd', it.kbd) : null);
  }));
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  openMenu = m;
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('pointerdown', off, true); } }, true));
  return m;
}

export function modal({ title, body, actions = [], width, onClose, closable = true }) {
  const back = h('div.modal-back');
  const close = () => { back.remove(); document.removeEventListener('keydown', esc, true); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape' && closable) { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', esc, true);
  const m = h('div.modal', { style: width ? { width } : null },
    title ? h('div.modal-h', title, closable ? h('button.ibtn', { onclick: close }, icon('x')) : null) : null,
    h('div.modal-b', body),
    actions.length ? h('div.modal-f', actions.map((a) => h(`button.btn${a.primary ? '.primary' : ''}`, { onclick: () => a.run(close) }, a.label))) : null);
  back.append(m);
  if (closable) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.body.append(back);
  return { close, el: m, back };
}

export function toast(msg, kind = '', ms = 3200) {
  const t = h(`div.toast${kind ? '.' + kind : ''}`, kind === 'err' ? icon('info', 16) : icon('check', 16), msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

export function confirmBox(message, detail, okLabel = 'OK') {
  return new Promise((res) => {
    modal({ title: message, body: h('div.hint', { style: { maxWidth: '420px' } }, detail), actions: [{ label: 'Cancel', run: (c) => { c(); res(false); } }, { label: okLabel, primary: true, run: (c) => { c(); res(true); } }], onClose: () => res(false) });
  });
}

// Hover tips: anything with data-tip shows it in a small label after a short pause (at once when moving
// along a row of buttons). A greyed-out button also shows its data-tip-off, which says what to do first.
// The label floats over the whole window, so no panel edge cuts it off, and it stays inside the window.
let tipEl = null, tipFor = null, tipTimer = 0, tipGone = 0, tipWatch = 0;
const isOff = (el) => el.disabled || el.classList.contains('disabled');
function showTip(el) {
  const off = isOff(el) ? el.dataset.tipOff : '';
  tipEl.replaceChildren(h('div', el.dataset.tip), ...(off ? [h('div.tip-off', off)] : []));
  tipEl.classList.add('show');
  const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect(), gap = 7;
  const fitsBelow = r.bottom + gap + t.height <= innerHeight - 4, fitsAbove = r.top - gap - t.height >= 4;
  const up = el.classList.contains('tip-up') ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
  const top = up ? r.top - gap - t.height : r.bottom + gap;
  const left = clamp(r.left + r.width / 2 - t.width / 2, 6, innerWidth - t.width - 6);
  tipEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  clearInterval(tipWatch);
  tipWatch = setInterval(() => { if (!el.isConnected) hideTip(); else if (tipEl.firstChild?.textContent !== el.dataset.tip || !!tipEl.children[1] !== !!(isOff(el) && el.dataset.tipOff)) showTip(el); }, 250);
}
export function hideTip() {
  clearTimeout(tipTimer); clearInterval(tipWatch);
  if (tipEl?.classList.contains('show')) tipGone = performance.now();
  tipEl?.classList.remove('show');
  tipFor = null;
}
export function initTips() {
  tipEl = h('div.tip-pop', { role: 'tooltip' });
  document.body.append(tipEl);
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el === tipFor) return;
    hideTip();
    if (!el?.dataset.tip) return;
    tipFor = el;
    tipTimer = setTimeout(() => { if (tipFor === el && el.isConnected) showTip(el); }, performance.now() - tipGone < 500 ? 0 : 350);
  });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) hideTip(); });
  document.addEventListener('pointerdown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  document.addEventListener('wheel', hideTip, { capture: true, passive: true });
}
