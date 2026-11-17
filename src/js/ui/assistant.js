// Tools › Assistant: let Claude edit the open project from Claude's own apps (the connector), and how
// to set those apps up. The panel inside Current comes later.
import { h, icon } from '../util.js';
import { store } from '../state.js';
import { modal, toggle, toast } from './widgets.js';
import { catalog } from '../agent/catalog.js';
import { privacyText, TRADEMARK } from '../agent/privacy.js';

const ago = (t) => {
  if (!t) return 'not used yet';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'last used just now' : m < 60 ? `last used ${m} min ago` : `last used ${Math.round(m / 60)} h ago`;
};
const copy = (text) => navigator.clipboard.writeText(text).then(() => toast('Copied'));

export async function openAssistant() {
  let s = await window.native.assistantGet();
  const body = h('div.asst');
  function paint() {
    body.replaceChildren(
      h('p.asst-lead', 'Ask Claude to edit this project: build a first cut from your media, trim it, add titles, music and captions. The changes happen here while you watch, and Undo takes them back.'),
      h('div.asst-by', 'Works with Claude, by Anthropic.'),
      toggle({ label: 'Let Claude edit in Current', value: s.connector, onChange: async (v) => { await window.native.assistantSet({ connector: v }); s = await window.native.assistantGet(); paint(); } }),
      h('div.hint', s.connector ? `On. Claude can reach Current while it is open (${ago(s.lastUsed)}).` : 'Off. Claude cannot reach Current.'),
      h('div.asst-step',
        h('b', 'Claude’s desktop app'),
        h('div.hint', 'Save the connector file, then open it with Claude’s desktop app to install it. You can also install it in Claude under Settings › Extensions › Advanced settings › Install Extension.'),
        h('div', h('button.btn', { onclick: async () => {
          const p = await window.native.assistantSaveBundle(catalog());
          if (p) toast(`Saved ${p.split('/').pop()}. Open it with Claude’s desktop app to install it.`, '', 7000);
        } }, icon('download', 15), 'Save the connector file…'))),
      h('div.asst-step',
        h('b', 'Claude Code'),
        h('div.hint', 'Run this once in a terminal:'),
        h('div.cap-cmd', h('code', s.claudeCode), h('button.btn.small', { onclick: () => copy(s.claudeCode) }, icon('copy', 13), 'Copy'))),
      h('details.asst-more',
        h('summary', 'Other apps that take connectors'),
        h('div.hint', 'Add Current to the app’s connector settings with:'),
        h('pre.asst-json', s.mcpConfig),
        h('button.btn.small', { onclick: () => copy(s.mcpConfig) }, icon('copy', 13), 'Copy')),
      h('div.asst-privacy', icon('info', 15), h('div', ...privacyText('apps'), h('p.asst-tm', TRADEMARK))),
    );
  }
  paint();
  modal({ title: 'Assistant', body, width: '620px', actions: [{ label: 'Done', primary: true, run: (close) => close() }] });
}

// The top-bar marker while Claude is making changes.
export function assistantPill() {
  const pill = h('div.assist-pill.hidden', { 'data-tip': 'Claude is editing this project. Undo takes its changes back at once.' }, icon('chat', 14), 'Claude is editing');
  store.on('assistant', (on) => pill.classList.toggle('hidden', !on));
  return pill;
}
