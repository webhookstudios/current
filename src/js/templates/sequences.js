// The Sequences built from their own scenes: the chart intros and outros, and the Education and
// Professional mid-rolls. Each entry defines its scene, its words and colours, and the background and
// sounds of its pack; this turns them into title templates (kept out of the Titles tab) and packs.
import { CHART_SEQS } from './seq-charts.js';
import { EDU_SEQS } from './seq-edu.js';
import { BIZ_SEQS } from './seq-biz.js';
import { NEWS_SEQS } from './seq-news.js';
import { GAME_SEQS } from './seq-game.js';
import { TRAVEL_SEQS } from './seq-travel.js';

// Themed sections in the Sequences tab, each with intros, mid-rolls and outros of its own.
export const SECTION_CATS = ['News', 'Gaming', 'Travel'];
const GROUP = { Education: 'edu', Professional: 'biz', News: 'news', Gaming: 'game', Travel: 'travel' };
const packId = (s) => (s.cat === 'Intros' ? `intro-pro-${s.id}` : s.cat === 'Outros' ? `outro-pro-${s.id.replace(/-end$/, '')}` : `${GROUP[s.cat]}-${s.id}`);
const ALL = [...CHART_SEQS, ...EDU_SEQS, ...BIZ_SEQS, ...NEWS_SEQS, ...GAME_SEQS, ...TRAVEL_SEQS];
// Title ids carry the group, so an Education "timeline" and the chart "timeline" stay apart.
const titleId = (s) => (GROUP[s.cat] ? `seq-${GROUP[s.cat]}-${s.id}` : `seq-${s.id}`);

export const SEQ_TITLES = ALL.map((s) => ({ id: titleId(s), name: s.name, cat: 'Sequences', seq: true, texts: s.texts, colors: s.colors, font: s.font || 'Montserrat', dur: s.dur || 6, brandTexts: s.brandTexts, timer: s.timer, draw: s.draw }));
// [cat, id, name, dur, layers] in the form packs.js uses
// Retired pieces keep their title template (so old projects still show them) but get no pack.
export const SEQ_PACKS = ALL.filter((s) => !s.retired).map((s) => [s.cat, packId(s), s.name, s.dur || 6, [
  ['background', s.bg[0], { colors: s.bg.slice(1) }],
  ['title', titleId(s)],
  ...(s.sfx || []).map(([id, at]) => ['audio', id, { at }]),
], s.role]);
