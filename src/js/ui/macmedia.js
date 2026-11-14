// macOS: privacy permissions for the microphone, camera and screen, and Current's own screen picker
// for macOS versions older than 15 (newer ones use the system's picker). Does nothing elsewhere.
import { h, IS_MAC } from '../util.js';
import { modal } from './widgets.js';

const NAMES = { microphone: 'the microphone', camera: 'the camera', screen: 'screen recording' };
const SETTING = {
  microphone: 'System Settings › Privacy & Security › Microphone',
  camera: 'System Settings › Privacy & Security › Camera',
  screen: 'System Settings › Privacy & Security › Screen & System Audio Recording',
};

// Explains how to turn access on, with a button that opens the right page of System Settings.
export function explainAccess(kind) {
  const extra = kind === 'screen' ? ' After turning it on, quit Current and open it again.' : '';
  modal({
    title: `Allow ${NAMES[kind]}`,
    body: h('div', { style: { maxWidth: '420px', lineHeight: 1.55 } },
      h('p', { style: { marginTop: 0 } }, `Current is not allowed to use ${NAMES[kind]}. Turn on Current in ${SETTING[kind]}.${extra}`)),
    actions: [{ label: 'Not now', run: (c) => c() }, { label: 'Open System Settings', primary: true, run: (c) => { c(); window.native.openPrivacy(kind); } }],
  });
}

// Asks for the microphone or camera (the system prompt shows the first time). Resolves true when
// allowed. With quiet, a refusal is not explained (used when only filling in device names).
export async function allowMedia(kind, { quiet = false } = {}) {
  if (!IS_MAC) return true;
  const st = await window.native.mediaAccess(kind).catch(() => 'granted');
  if (st === 'granted' || st === 'not-determined') return true;
  if (!quiet) explainAccess(kind);
  return false;
}

// Screen recording: the system asks the first time; once it has been refused, macOS hands over a
// blank picture, so say so before recording rather than after.
export async function screenAllowed() {
  if (!IS_MAC) return true;
  const st = await window.native.mediaAccess('screen').catch(() => 'granted');
  if (st === 'denied' || st === 'restricted') { explainAccess('screen'); return false; }
  return true;
}

// The picker for macOS 14 and older: screens first, then windows. Resolves with the chosen id or null.
function pickScreen(list) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (id) => { if (!done) { done = true; resolve(id); } };
    const card = (s) => h('button.sr-pick', { type: 'button', onclick: () => { finish(s.id); dlg.close(); } },
      h('img', { src: s.thumb, alt: '' }), h('span', s.screen ? s.name || 'Screen' : s.name));
    const screens = list.filter((s) => s.screen), windows = list.filter((s) => !s.screen);
    const dlg = modal({
      title: 'Choose what to record',
      width: '760px',
      body: h('div.sr-picker',
        screens.length ? [h('div.kbd-group', 'Screens'), h('div.sr-grid', screens.map(card))] : null,
        windows.length ? [h('div.kbd-group', 'Windows'), h('div.sr-grid', windows.map(card))] : null),
      actions: [{ label: 'Cancel', run: (c) => c() }],
      onClose: () => finish(null),
    });
  });
}

export function initMacMedia() {
  if (IS_MAC) window.native.onScreenPick(pickScreen);
}
