// The editor's side of the connector: tool calls from Claude's apps arrive from the main process, run
// here, and the answers go back. Claude's apps send one call at a time with no sign of where a request
// ends, so calls close together form one request: its edits undo as one step, which ends after a quiet
// spell (or when another project opens). Meanwhile the top bar says Claude is editing.
import { store } from '../state.js';
import { runTool, beginRequest, endRequest } from './tools.js';
import { catalog } from './catalog.js';
import { toast } from '../ui/widgets.js';

export const connector = { idleMs: 20000 };
// The panel inside Current opens and closes its own request (ui/panel.js); its calls arrive with panel: true.
export const panelState = { req: null };
let req = null, idle = 0;

function open() {
  clearTimeout(idle);
  if (req) return;
  req = beginRequest();
  store.emit('assistant', true);
}
export function closeConnectorRequest() {
  clearTimeout(idle);
  if (!req) return;
  const n = req.log.length;
  endRequest();
  req = null;
  store.emit('assistant', false);
  if (n) toast(`Claude made ${n} change${n > 1 ? 's' : ''}. Undo (Ctrl+Z) takes ${n > 1 ? 'them all' : 'it'} back at once.`, '', 7000);
}
export const connectorBusy = () => !!req;

export function initConnector() {
  store.on('change', (kind) => { if (kind === 'load') closeConnectorRequest(); });
  window.native.onAssistantCall(async ({ id, method, name, input, panel }) => {
    let out;
    try {
      if (method === 'catalog') out = catalog();
      else if (panel) out = await runTool(name, input, panelState.req);
      else { open(); out = await runTool(name, input, req); }
    } catch (e) {
      out = { ok: false, content: [{ type: 'text', text: `That did not work: ${e.message}` }] };
    } finally {
      if (method === 'call' && !panel && req) idle = setTimeout(closeConnectorRequest, connector.idleMs);
    }
    window.native.assistantResult(id, out);
  });
  window.native.assistantReady();
}
