// Current: the main-process side of the Assistant panel inside Current.
// The person's own Claude API key is kept encrypted with the system keyring (Electron safeStorage) and
// never reaches the editor page. A request streams from Claude with Anthropic's SDK; each tool call
// runs in the editor page (askPage) and its result goes back, until Claude is done, the person presses
// Stop, or the step limit is reached. The conversation is kept until New conversation or another project.
// Tests set CURRENT_FAKE_CLAUDE=1 and give scripted turns over IPC instead of calling Claude.
'use strict';
const fs = require('fs');
const path = require('path');
const { ipcMain, safeStorage } = require('electron');
const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;

const MODEL = 'claude-opus-5-5';
// Dollars per million tokens, for the estimate shown after each request (5-minute cache writes cost 1.25×).
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const STEP_LIMIT = 60;
const FRAME_TOOLS = new Set(['view_media', 'view_media_frame', 'view_frame']);
const PANEL_NOTE = 'You are working in the Assistant panel inside Current. The person sees each step you take listed in the panel, so keep your messages short: a line before you start, and a brief summary at the end.';

module.exports = function setupAssistantPanel({ getWin, askPage, dir, selftest }) {
  const KEY_FILE = () => path.join(dir(), 'assistant-key.bin');
  const fake = process.env.CURRENT_FAKE_CLAUDE ? { turns: [], requests: [] } : null;
  const convo = { messages: [], ctrl: null };
  const emit = (ev) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('assistant:panelEvent', ev); };

  // ---------- the API key ----------
  function keyring() {
    const backend = process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'system';
    return { ok: safeStorage.isEncryptionAvailable() && !['basic_text', 'unknown'].includes(backend), backend };
  }
  function readKey() {
    try { return safeStorage.decryptString(fs.readFileSync(KEY_FILE())); } catch { return null; }
  }
  const clientFor = (apiKey) => (fake ? fakeClient(apiKey) : new Anthropic({ apiKey }));

  ipcMain.handle('assistant:keyStatus', async () => {
    const k = readKey(), ring = keyring();
    return { hasKey: !!k, hint: k ? `…${k.slice(-4)}` : '', secure: ring.ok, backend: ring.backend };
  });
  ipcMain.handle('assistant:saveKey', async (_e, raw) => {
    const key = String(raw || '').trim();
    if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false, message: 'That doesn’t look like a Claude API key. Keys start with “sk-ant-”.' };
    if (!keyring().ok) return { ok: false, message: 'This computer has no keyring to keep the key safe, so it was not saved. Use Claude’s own apps instead (Tools › Assistant).' };
    try {
      await clientFor(key).models.retrieve(MODEL);
    } catch (err) {
      return { ok: false, message: explain(err) };
    }
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(KEY_FILE(), safeStorage.encryptString(key), { mode: 0o600 });
    return { ok: true, message: 'Key saved. It is kept encrypted on this computer.' };
  });
  ipcMain.handle('assistant:removeKey', async () => { try { fs.unlinkSync(KEY_FILE()); } catch { /* none */ } return true; });

  // ---------- errors in plain words ----------
  function explain(err) {
    if (err instanceof Anthropic.APIUserAbortError) return 'Stopped.';
    if (err instanceof Anthropic.APIConnectionError) return 'Could not reach Claude. Check your internet connection and try again.';
    const status = err?.status;
    if (status === 401) return 'Claude didn’t accept this API key. Check it, or paste a new one.';
    if (status === 403) return 'This API key can’t use Claude Opus 5.5. Check its workspace and permissions.';
    if (status === 404) return 'Claude Opus 5.5 isn’t available to this API key.';
    if (status === 429) return 'Claude has had too many requests from this key just now. Wait a minute and try again.';
    if (status === 400 && /credit/i.test(err.message || '')) return 'This API key’s account is out of credit. Add credit in your Claude developer account, then try again.';
    if (status >= 500) return 'Claude is busy right now. Try again in a moment.';
    return `Claude couldn’t take that request: ${err?.message || err}`;
  }

  // ---------- one request ----------
  const toApiContent = (content) => (content || []).map((c) => (c.type === 'image'
    ? { type: 'image', source: { type: 'base64', media_type: c.mediaType || 'image/jpeg', data: c.data } }
    : { type: 'text', text: c.text }));
  const doneText = (out) => { try { return JSON.parse(out.content[0].text).done || ''; } catch { return out.content?.[0]?.text || ''; } };

  async function run({ text, effort = 'medium', frames = true }) {
    const key = readKey();
    if (!key) return { ok: false, message: 'Add your Claude API key first.' };
    if (convo.ctrl) return { ok: false, message: 'Claude is still working on the last request.' };
    const client = clientFor(key);
    const cat = await askPage('catalog');
    if (!cat?.tools) return { ok: false, message: 'Current is still starting. Try again in a moment.' };
    const tools = cat.tools.filter((t) => frames || !FRAME_TOOLS.has(t.name)).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema, eager_input_streaming: true }));
    const system = [{ type: 'text', text: cat.instructions }, { type: 'text', text: PANEL_NOTE }];
    const ctrl = new AbortController();
    convo.ctrl = ctrl;
    convo.messages.push({ role: 'user', content: text });
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    let calls = 0, retries = 0, reason = 'done', message = '';
    try {
      for (;;) {
        emit({ type: 'turn' });
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 64000,
          system,
          tools,
          messages: convo.messages,
          thinking: { type: 'adaptive' },
          output_config: { effort },
          cache_control: { type: 'ephemeral' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        }, { signal: ctrl.signal });
        stream.on('text', (delta) => emit({ type: 'text', delta }));
        let msg;
        try {
          msg = await stream.finalMessage();
          retries = 0;
        } catch (err) {
          // only a tool input that could not be parsed at all is worth asking again
          if (err instanceof Anthropic.APIError || ctrl.signal.aborted || retries++ >= 2) throw err;
          continue;
        }
        const u = msg.usage || {};
        usage.input += u.input_tokens || 0; usage.output += u.output_tokens || 0;
        usage.cacheRead += u.cache_read_input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0;
        if (msg.stop_reason === 'refusal') { reason = 'refusal'; message = 'Claude declined this request.'; break; }
        if (msg.stop_reason === 'pause_turn') { convo.messages.push({ role: 'assistant', content: msg.content }); continue; }
        const uses = msg.content.filter((b) => b.type === 'tool_use');
        if (msg.stop_reason === 'max_tokens' && uses.length) { reason = 'error'; message = 'Claude’s answer was cut off. Try asking for less at once.'; break; }
        convo.messages.push({ role: 'assistant', content: msg.content });
        if (!uses.length) break;
        const results = [];
        for (const tu of uses) {
          if (ctrl.signal.aborted) { results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'Stopped by the person.' }); continue; }
          if (++calls > STEP_LIMIT) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'The step limit for one request is reached. Stop here and summarise what you did; the person can ask you to carry on.' });
            continue;
          }
          emit({ type: 'tool', id: tu.id, name: tu.name, input: tu.input });
          const out = await askPage('call', tu.name, tu.input, { panel: true });
          emit({ type: 'toolDone', id: tu.id, name: tu.name, ok: !!out.ok, text: doneText(out) });
          results.push({ type: 'tool_result', tool_use_id: tu.id, ...(out.ok ? {} : { is_error: true }), content: toApiContent(out.content) });
        }
        convo.messages.push({ role: 'user', content: results });
        if (ctrl.signal.aborted) { reason = 'stopped'; break; }
        if (calls > STEP_LIMIT + 10) { reason = 'limit'; message = 'Claude reached the step limit for one request. Ask it to carry on if there is more to do.'; break; }
      }
    } catch (err) {
      if (ctrl.signal.aborted || err instanceof Anthropic.APIUserAbortError) reason = 'stopped';
      else { reason = 'error'; message = explain(err); }
    } finally {
      convo.ctrl = null;
    }
    const cost = (usage.input * PRICE.input + usage.output * PRICE.output + usage.cacheRead * PRICE.cacheRead + usage.cacheWrite * PRICE.cacheWrite) / 1e6;
    const summary = { ok: reason === 'done', reason, message, usage, cost, steps: calls };
    emit({ type: 'end', ...summary });
    return summary;
  }

  ipcMain.handle('assistant:panelSend', async (_e, request) => run(request));
  ipcMain.handle('assistant:panelStop', async () => { convo.ctrl?.abort(); return true; });
  ipcMain.handle('assistant:panelReset', async () => { convo.ctrl?.abort(); convo.messages = []; return true; });

  // ---------- a scripted Claude for tests ----------
  // Each request takes the next turn: { content, stop_reason, delay_ms } or { error: status }.
  function fakeClient(apiKey) {
    const apiError = (status) => Object.assign(new Anthropic.APIError(status, undefined, `fake error ${status}`, undefined), { status });
    return {
      models: { retrieve: async () => { if (/bad/.test(apiKey)) throw apiError(401); return { id: MODEL }; } },
      beta: { messages: { stream(params, { signal } = {}) {
        fake.requests.push(JSON.parse(JSON.stringify(params)));
        const turn = fake.turns.shift() || { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' };
        let onText = null;
        return {
          on(ev, cb) { if (ev === 'text') onText = cb; return this; },
          async finalMessage() {
            const t0 = Date.now();
            while (Date.now() - t0 < (turn.delay_ms || 20)) {
              if (signal?.aborted) throw new Anthropic.APIUserAbortError();
              await new Promise((r) => setTimeout(r, 20));
            }
            if (turn.error) throw apiError(turn.error);
            for (const b of turn.content) if (b.type === 'text') for (const part of b.text.match(/.{1,12}/gs) || []) onText?.(part);
            return { content: turn.content, stop_reason: turn.stop_reason, usage: { input_tokens: 1200, output_tokens: 150, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 } };
          },
        };
      } } },
    };
  }
  if (fake && selftest) {
    ipcMain.handle('selftest:fakeClaude', async (_e, turns) => { fake.turns.push(...turns); return true; });
    ipcMain.handle('selftest:fakeClaudeRequests', async () => fake.requests.splice(0));
  }
};
