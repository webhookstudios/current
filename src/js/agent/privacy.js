// What Current tells people about the Assistant and their data, in one place, so the panel, the
// Assistant window and the About box say the same thing. The README's Privacy section matches it.
import { h } from '../util.js';

export const ANTHROPIC = {
  privacy: 'https://www.anthropic.com/legal/privacy',
  commercial: 'https://www.anthropic.com/legal/commercial-terms',
  usage: 'https://www.anthropic.com/legal/aup',
};
export const SENT = 'the project outline (clip and file names, times, texts and captions), transcripts of what is said, and the still frames Claude asks to see';
export const TRADEMARK = 'Claude is a trademark of Anthropic, PBC. Current is an independent app, not made or endorsed by Anthropic.';
export const ONLINE = 'Current has no accounts, analytics or tracking, and sends nothing to webhookstudios. It goes online only to download the speech model the first time you make captions, and to reach Claude when you use the Assistant.';

const link = (text, url) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.native.openExternal(url); } }, text);

// route 'panel': your own API key; 'apps': Claude's own apps and your Claude plan.
export function privacyText(route) {
  return route === 'panel'
    ? [h('p', `When you ask Claude, Current sends Anthropic (the company that makes Claude) what you ask, ${SENT}, using your API key. Your video and sound files stay on this computer.`),
      h('p', 'Anthropic handles this under your API agreement with them (', link('Commercial Terms', ANTHROPIC.commercial), ', ', link('Usage Policy', ANTHROPIC.usage), ') and its ', link('Privacy Policy', ANTHROPIC.privacy), '. webhookstudios never sees it. Claude can’t export, save or delete files, and each request undoes in one step.')]
    : [h('p', `Through Claude’s apps, Claude sees ${SENT}. That goes to Anthropic under your Claude plan’s terms and its `, link('Privacy Policy', ANTHROPIC.privacy), '; webhookstudios never sees it. Your video and sound files stay on this computer, and Claude can’t export, save or delete files.')];
}
