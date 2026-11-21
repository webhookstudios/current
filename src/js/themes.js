// Colour themes for the editor's own interface (not the video). Pine is the original look and the
// default; the others replace the colour variables in app.css. The choice is kept on this computer.
import { h } from './util.js';
import { modal } from './ui/widgets.js';

const KEY = 'current.theme';

// Every theme sets the same variables. Pine sets none: its values are the ones in app.css.
export const THEMES = [
  { id: 'pine', name: 'Pine', note: 'The original: pine green and teal', vars: {},
    preview: { chrome: '#17201c', bg: '#191a1c', panel: '#202123', accent: '#4fb3a5' } },
  { id: 'midnight', name: 'Midnight', note: 'Deep navy with a soft blue', vars: {
    '--bg0': '#0f1117', '--bg1': '#151821', '--bg2': '#1b1f2a', '--bg3': '#232837', '--bg4': '#2c3242', '--line': '#252a37', '--line2': '#343a4b',
    '--fg': '#e6e9f0', '--fg2': '#a9b0c2', '--fg3': '#8a92a6', '--accent': '#7aa2f7', '--accent2': '#4a6fc4', '--accent-ink': '#0b1631',
    '--accent-hi': '#8fb2f9', '--accent-hover': '#a5c1fa', '--hl': '#6ea8ff', '--chrome': '#141a2a', '--chrome-line': '#222b44' } },
  { id: 'graphite', name: 'Graphite', note: 'Neutral grays, no color', vars: {
    '--bg0': '#111111', '--bg1': '#18181a', '--bg2': '#1f1f22', '--bg3': '#28282c', '--bg4': '#323236', '--line': '#2a2a2e', '--line2': '#3a3a3f',
    '--fg': '#ececee', '--fg2': '#b0b0b6', '--fg3': '#8f8f96', '--accent': '#d0d0d6', '--accent2': '#7d7d85', '--accent-ink': '#161618',
    '--accent-hi': '#dcdce1', '--accent-hover': '#e6e6ea', '--hl': '#e0e0e6', '--chrome': '#1a1a1c', '--chrome-line': '#2b2b2f' } },
  { id: 'ember', name: 'Ember', note: 'Warm browns with orange', vars: {
    '--bg0': '#141110', '--bg1': '#1b1716', '--bg2': '#221d1b', '--bg3': '#2b2523', '--bg4': '#352e2b', '--line': '#2e2826', '--line2': '#3f3734',
    '--fg': '#f0e9e6', '--fg2': '#b9ada8', '--fg3': '#978a85', '--accent': '#f0904f', '--accent2': '#b65f27', '--accent-ink': '#2b1203',
    '--accent-hi': '#f3a26a', '--accent-hover': '#f6b585', '--hl': '#ff9a52', '--chrome': '#23170f', '--chrome-line': '#3a2719' } },
  { id: 'plum', name: 'Plum', note: 'Dusky purple with violet', vars: {
    '--bg0': '#131116', '--bg1': '#1a171e', '--bg2': '#211d26', '--bg3': '#2a2530', '--bg4': '#342e3b', '--line': '#2b2631', '--line2': '#3c3544',
    '--fg': '#ece8f1', '--fg2': '#b2aabd', '--fg3': '#918a9c', '--accent': '#b48cf2', '--accent2': '#7b55c0', '--accent-ink': '#1c0d33',
    '--accent-hi': '#c2a1f4', '--accent-hover': '#cfb4f7', '--hl': '#b98bff', '--chrome': '#1f1726', '--chrome-line': '#33263f' } },
  { id: 'rose', name: 'Rose', note: 'Deep wine with pink', vars: {
    '--bg0': '#141113', '--bg1': '#1c171a', '--bg2': '#231d21', '--bg3': '#2c2429', '--bg4': '#362d33', '--line': '#2e262b', '--line2': '#40353c',
    '--fg': '#f1e8ec', '--fg2': '#bba9b2', '--fg3': '#998790', '--accent': '#ef7fa2', '--accent2': '#b84a6e', '--accent-ink': '#2e0b18',
    '--accent-hi': '#f294b2', '--accent-hover': '#f5aac2', '--hl': '#ff7aa5', '--chrome': '#26151d', '--chrome-line': '#3d2330' } },
];
for (const t of THEMES) if (!t.preview) t.preview = { chrome: t.vars['--chrome'], bg: t.vars['--bg1'], panel: t.vars['--bg2'], accent: t.vars['--accent'] };
const ALL_VARS = [...new Set(THEMES.flatMap((t) => Object.keys(t.vars)))];

export function currentTheme() {
  let id = 'pine';
  try { id = localStorage.getItem(KEY) || 'pine'; } catch { /* storage unavailable: the default */ }
  return THEMES.some((t) => t.id === id) ? id : 'pine';
}

export function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0], root = document.documentElement;
  for (const v of ALL_VARS) root.style.removeProperty(v);
  for (const [v, val] of Object.entries(t.vars)) root.style.setProperty(v, val);
  root.dataset.theme = t.id;
}

export function setTheme(id) {
  applyTheme(id);
  try { localStorage.setItem(KEY, id); } catch { /* the theme still applies until the app closes */ }
}

// Settings: for now, the colour theme. Clicking a theme applies it at once.
export function openSettings() {
  const grid = h('div.theme-grid');
  const paint = () => {
    const cur = currentTheme();
    grid.replaceChildren(...THEMES.map((t) => {
      const p = t.preview;
      return h('button.theme-card', { type: 'button', class: `theme-card${t.id === cur ? ' on' : ''}`, 'aria-pressed': String(t.id === cur), onclick: () => { setTheme(t.id); paint(); } },
        h('div.theme-swatch', { style: { background: p.bg } },
          h('i.ts-bar', { style: { background: p.chrome } }),
          h('i.ts-panel', { style: { background: p.panel } }),
          h('i.ts-dot', { style: { background: p.accent } }),
          h('i.ts-btn', { style: { background: p.accent } })),
        h('b', t.name, t.id === 'pine' ? h('span.theme-default', 'Default') : null),
        h('small', t.note));
    }));
  };
  paint();
  modal({ title: 'Settings', width: '560px',
    body: h('div.settings', h('div.kbd-group', 'Color theme'), h('div.hint', { style: { marginBottom: '12px' } }, 'Changes the editor’s colors, not your video. It applies at once and is remembered on this computer.'), grid),
    actions: [{ label: 'Done', primary: true, run: (close) => close() }] });
}
