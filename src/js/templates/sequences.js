// The Sequences built from their own scenes: the chart intros and outros, and the Education and
// Professional mid-rolls. Each entry defines its scene, its words and colours, and the background and
// sounds of its pack; this turns them into title templates (kept out of the Titles tab) and packs.
import { CHART_SEQS } from './seq-charts.js';
import { EDU_SEQS } from './seq-edu.js';
import { BIZ_SEQS } from './seq-biz.js';

const packId = (s) => (s.cat === 'Intros' ? `intro-pro-${s.id}` : s.cat === 'Outros' ? `outro-pro-${s.id.replace(/-end$/, '')}` : s.cat === 'Education' ? `edu-${s.id}` : `biz-${s.id}`);
const ALL = [...CHART_SEQS, ...EDU_SEQS, ...BIZ_SEQS];
// Title ids carry the group, so an Education "timeline" and the chart "timeline" stay apart.
const titleId = (s) => (s.cat === 'Education' ? `seq-edu-${s.id}` : s.cat === 'Professional' ? `seq-biz-${s.id}` : `seq-${s.id}`);

export const SEQ_TITLES = ALL.map((s) => ({ id: titleId(s), name: s.name, cat: 'Sequences', seq: true, texts: s.texts, colors: s.colors, font: s.font || 'Montserrat', dur: s.dur || 6, brandTexts: s.brandTexts, draw: s.draw }));
// [cat, id, name, dur, layers] in the form packs.js uses
export const SEQ_PACKS = ALL.map((s) => [s.cat, packId(s), s.name, s.dur || 6, [
  ['background', s.bg[0], { colors: [s.bg[1]] }],
  ['title', titleId(s)],
  ...(s.sfx || []).map(([id, at]) => ['audio', id, { at }]),
]]);
