// The menu items for clips and for the recording and caption tools, shared by the Clip and Tools menus in the
// top bar, the right-click menu on a clip and the What's new window, so each feature has one name and one
// icon everywhere.
import { store, edit, selectedClips, trackById, trackClips, ensureTrack, clipEnd } from '../state.js';
import { freezeFrame, detachAudio } from '../actions.js';
import { tabsFor } from './inspector.js';
import { openRemovePauses } from './silence.js';
import { openCaptions, openCaptionEditor, captionClips, captionMode, CAPTION_MODES } from './captions.js';
import { openVoiceover } from './voiceover.js';
import { openScreenRecord } from './screenrec.js';
import { toast } from './widgets.js';

// Open a tab of the clip panel on the right, and optionally scroll to one of its sections.
export const inspect = (tab, sectionTitle) => store.emit('inspect', tab, sectionTitle);

export const selectedClip = () => { const s = selectedClips(); return s.length === 1 ? s[0] : null; };

// Shrink a clip into a corner over the track below (and move it up a track if it is on the main track).
export function makePip(c) {
  edit(() => {
    const vids = store.project.tracks.filter((t) => t.kind === 'video');
    const i = vids.indexOf(trackById(c.trackId));
    if (trackById(c.trackId).main || i === vids.length - 1) {
      let up = vids[i - 1];
      if (!up || trackClips(up.id).some((o) => o.start < clipEnd(c) && clipEnd(o) > c.start)) up = ensureTrack('video', 'top');
      c.trackId = up.id;
    }
    Object.assign(c.transform, { scale: 0.35, x: 0.3, y: 0.28 });
  });
  toast('Picture in picture: drag it in the preview to place it');
}

// What can be done to clip c (null: nothing selected). hide leaves out what does not apply, for the
// right-click menu; otherwise those items are greyed out, so the Clip menu always lists everything.
export function clipItems(c, { hide = false } = {}) {
  const has = (t) => !!c && tabsFor(c).some(([id]) => id === t);
  const visual = !!c && (c.type === 'video' || c.type === 'image');
  const sound = !!c && (c.type === 'video' || c.type === 'audio');
  const video = c?.type === 'video';
  const groups = [
    [
      { label: 'Freeze frame', icon: 'freeze', ok: !c || video, run: freezeFrame },
      { label: 'Detach audio', icon: 'detach', ok: video && !c.muted, run: detachAudio },
    ],
    [
      { label: 'Crop', icon: 'crop', ok: has('crop'), run: () => inspect('crop') },
      { label: 'Speed', icon: 'speed', ok: has('speed'), run: () => inspect('speed') },
      { label: 'Color', icon: 'color', ok: has('color'), run: () => inspect('color') },
      { label: 'Green screen', icon: 'wand', ok: has('chroma'), run: () => inspect('chroma') },
      { label: 'Zoom to area…', icon: 'zoomArea', ok: visual, run: () => inspect('video', 'Zoom to area') },
      { label: 'Shape and outline', icon: 'shape', ok: visual, run: () => inspect('video', 'Shape') },
      { label: 'Picture in picture', icon: 'layers', ok: visual, run: () => makePip(c) },
    ],
    [
      { label: 'Audio settings', icon: 'volume', ok: has('audio'), run: () => inspect('audio') },
      { label: 'Remove pauses…', icon: 'pauses', ok: sound, run: () => openRemovePauses(c) },
      { label: 'Captions for this clip…', icon: 'cc', ok: sound, run: openCaptions },
    ],
  ];
  const out = [];
  for (const g of groups) {
    const items = g.filter((it) => it.ok || !hide).map(({ ok, ...it }) => ({ ...it, disabled: !ok }));
    if (!items.length) continue;
    if (out.length) out.push('-');
    out.push(...items);
  }
  return out;
}

const MODE_LABELS = { burn: 'Show captions on screen', file: 'Save captions as a file (.srt)', both: 'Captions on screen and as a file' };

export function toolsItems() {
  const mode = captionMode();
  return [
    { label: 'Record voiceover…', icon: 'mic', kbd: 'R', run: openVoiceover },
    { label: 'Record screen…', icon: 'screen', kbd: 'Shift+R', run: openScreenRecord },
    '-',
    { label: 'Generate captions…', icon: 'cc', run: openCaptions },
    { label: 'Edit captions…', icon: 'text', disabled: !captionClips().length, run: openCaptionEditor },
    '-',
    ...CAPTION_MODES.map(([v]) => ({ label: MODE_LABELS[v], icon: mode === v ? 'check' : null, run: () => edit(() => { store.project.captions = { ...(store.project.captions || {}), mode: v }; }) })),
  ];
}
