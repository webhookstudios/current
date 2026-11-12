// Brand kits: saved colors, a heading font, a logo and a company name. Kept for the whole app (not
// per project) in brand-kits.json in Current's settings folder. While a kit is on, titles, stickers
// and intros take its colors and font as they are added; turning branding off stops that, and clips
// already on the timeline keep the look they were given.
import { store } from './state.js';
import { uid } from './util.js';

export const brand = { enabled: false, active: null, kits: [] };

export async function loadBrand() {
  try {
    const saved = await window.native.brandLoad();
    if (saved && Array.isArray(saved.kits)) Object.assign(brand, { enabled: !!saved.enabled, active: saved.active || null, kits: saved.kits });
  } catch { /* first run */ }
  store.emit('brand');
}

let saveTimer = 0;
export function saveBrand() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.native.brandSave(JSON.parse(JSON.stringify(brand))).catch(() => {}), 250);
  store.emit('brand');
}

export const activeKit = () => (brand.enabled ? brand.kits.find((k) => k.id === brand.active) || null : null);

export function newKit(name = 'My brand') {
  return { id: uid('kit'), name, colors: { primary: '#2f6bff', secondary: '#1fd1b9', accent: '#ffb703' }, font: '', logo: null, company: '', initials: '' };
}

// ---------- applying a kit ----------
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}
// Whites, blacks and greys keep text readable, so they are never replaced.
export function isNeutral(c) {
  if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return true;
  const { s, l } = hsl(c);
  return s < 0.2 || l < 0.12 || l > 0.94;
}

// Template colors with every brand-able color swapped for the kit's colors, in order of appearance.
export function brandColors(colors, kit = activeKit()) {
  if (!kit || !Array.isArray(colors)) return colors;
  const pal = [kit.colors?.primary, kit.colors?.secondary, kit.colors?.accent].filter(Boolean);
  if (!pal.length) return colors;
  const seen = new Map();
  return colors.map((c) => {
    if (isNeutral(c)) return c;
    const k = c.toLowerCase();
    if (!seen.has(k)) seen.set(k, pal[seen.size % pal.length]);
    return seen.get(k);
  });
}

// Brand a clip that is being added: colors and font, and the company name or initials for
// templates that ask for them (tpl.brandTexts: { index: 'company' | 'initials' }).
export function brandClip(c, tpl, kit = activeKit()) {
  if (!kit || !c.params || c.type === 'background' || isEmoji(c.template)) return c;
  if (c.params.colors) c.params.colors = brandColors(c.params.colors, kit);
  if (c.type === 'title' && kit.font) c.params.font = kit.font;
  if (tpl?.brandTexts && c.params.texts) {
    for (const [i, key] of Object.entries(tpl.brandTexts)) if (kit[key]) c.params.texts[+i] = kit[key];
  }
  return c;
}

// Emoji stickers keep their own colors.
const isEmoji = (id) => /^emo-/.test(id || '');

// The look a library preview should show: the template's own, or the active kit's.
export const previewColors = (colors, kind, id) => (kind === 'background' || isEmoji(id) ? colors : brandColors(colors));
export const previewFont = () => activeKit()?.font || null;
