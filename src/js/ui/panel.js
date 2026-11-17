// The Assistant panel inside Current: ask Claude, through your own Claude API key, to edit the open
// project. The key and the conversation with Claude live in the main process (assistant.js); this side
// shows the conversation, Claude's steps as they happen, and what each request used. Every request is
// one undo step. Claude's own apps can do the same through the connector (Tools › Assistant).
import { h, icon } from '../util.js';
import { store, undo } from '../state.js';
import { beginRequest, endRequest } from '../agent/tools.js';
import { panelState } from '../agent/connector.js';
import { clockLabel } from '../agent/analyze.js';
import { PROMPTS, fillPrompt } from '../agent/guide.js';
import { modal, toggle, toast, showMenu } from './widgets.js';
import { openAssistant } from './assistant.js';
import { privacyText, TRADEMARK } from '../agent/privacy.js';

const PREFS = 'current.assistant';
const loadPrefs = () => { try { return { frames: true, seenNote: false, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return { frames: true, seenNote: false }; } };
let prefs = loadPrefs(); // read again each time the panel opens
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* fine */ } };

let el, body, logEl, foot, input, goBtn, thinking;
let running = false, cur = null;

// ---------- what Claude's steps are called ----------
const mediaName = (id) => store.project?.media.find((m) => m.id === id)?.name;
function stepLabel(name, inp = {}) {
  const m = inp.media_id && mediaName(inp.media_id);
  switch (name) {
    case 'get_project': return 'Reading the timeline';
    case 'list_media': return 'Listing your media';
    case 'view_media': return `Looking through ${m || 'a file'}`;
    case 'view_media_frame': return `Checking a frame of ${m || 'a file'}`;
    case 'view_frame': return `Checking the video at ${clockLabel(inp.time || 0)}`;
    case 'analyse_media': return `Analysing ${m || 'a file'}`;
    case 'get_media_transcript': return `Listening to ${m || 'a file'}`;
    case 'get_transcript': return 'Listening to the video';
    case 'find_pauses': return 'Finding pauses';
    case 'list_library': return `Searching the library${inp.kind ? ` (${String(inp.kind).replace('_', ' ')})` : ''}`;
    default: return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
  }
}

// ---------- Claude's text: paragraphs, lists, **bold** and `code` ----------
function inline(s) {
  const out = [], re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] != null ? h('b', m[1]) : h('code', m[2]));
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function richText(text) {
  const box = h('div.ap-text');
  for (const block of text.trim().split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
      box.append(h(/^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul', lines.map((l) => h('li', ...inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))))));
    } else if (/^#{1,4}\s/.test(lines[0]) && lines.length === 1) box.append(h('p', h('b', lines[0].replace(/^#+\s*/, ''))));
    else box.append(h('p', ...lines.flatMap((l, i) => (i ? [h('br'), ...inline(l)] : inline(l)))));
  }
  return box;
}

// ---------- the log ----------
const nearBottom = () => logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 80;
function add(node) {
  const stick = nearBottom();
  logEl.insertBefore(node, thinking.isConnected ? thinking : null);
  if (stick) logEl.scrollTop = logEl.scrollHeight;
  return node;
}
const addNote = (text, kind = '') => add(h(`div.ap-note${kind ? '.' + kind : ''}`, kind === 'err' ? icon('info', 14) : null, h('span', text)));

// Claude's text streams in; it is drawn a few times a second (and once more when its turn ends).
function drawText(c) {
  clearTimeout(c.paint); c.paint = 0;
  if (!c.textEl) return;
  const stick = nearBottom();
  c.textEl.replaceChildren(richText(c.text));
  if (stick) logEl.scrollTop = logEl.scrollHeight;
}
function onEvent(ev) {
  const c = cur;
  if (!c) return;
  if (ev.type === 'turn' || ev.type === 'tool') { drawText(c); c.textEl = null; c.text = ''; }
  if (ev.type === 'text') {
    if (!c.textEl) c.textEl = add(h('div.ap-msg.ap-claude'));
    c.text += ev.delta;
    if (!c.paint) c.paint = setTimeout(() => drawText(c), 60);
  }
  if (ev.type === 'tool') {
    const label = stepLabel(ev.name, ev.input);
    const row = add(h('div.ap-step.run', h('span.ap-dot'), h('span', label)));
    c.steps.set(ev.id, { row, label });
  }
  if (ev.type === 'toolDone') {
    const s = c.steps.get(ev.id);
    if (s) {
      s.row.classList.remove('run');
      s.row.classList.toggle('bad', !ev.ok);
      s.row.replaceChildren(ev.ok ? icon('check', 13) : icon('info', 13), h('span', ev.ok ? ev.text || s.label : ev.text));
    }
  }
  if (ev.type === 'end') finish(ev);
}

function setRunning(on) {
  running = on;
  goBtn.replaceChildren(on ? icon('stop', 15) : icon('chevronR', 16));
  goBtn.dataset.tip = on ? 'Stop Claude' : 'Send (Enter)';
  goBtn.classList.toggle('stop', on);
  thinking.remove();
  if (on) { logEl.append(thinking); logEl.scrollTop = logEl.scrollHeight; }
}

export async function sendToClaude(text, { effort = 'medium' } = {}) {
  text = String(text || '').trim();
  if (!text || running || !store.project) return;
  openPanel();
  add(h('div.ap-msg.ap-you', text));
  logEl.querySelector('.ap-empty')?.remove();
  const undoAt = store.undoStack.length;
  const req = beginRequest();
  panelState.req = req;
  store.emit('assistant', true);
  cur = { req, undoAt, textEl: null, text: '', steps: new Map(), paint: 0 };
  setRunning(true);
  const res = await window.native.assistantPanelSend({ text, effort, frames: prefs.frames });
  if (res && !res.reason) finish({ reason: 'error', message: res.message }); // it never started
}

function finish(ev) {
  if (!cur) return;
  drawText(cur);
  const { req, undoAt } = cur;
  cur = null;
  endRequest();
  panelState.req = null;
  store.emit('assistant', false);
  setRunning(false);
  if (ev.reason === 'stopped') addNote('Stopped.');
  else if (ev.reason !== 'done') addNote(ev.message || 'Something went wrong.', 'err');
  const parts = [];
  if (ev.usage) {
    const tokens = ev.usage.input + ev.usage.output + ev.usage.cacheRead + ev.usage.cacheWrite;
    if (tokens) parts.push(`${tokens.toLocaleString()} tokens, about $${ev.cost < 0.01 ? '0.01' : ev.cost.toFixed(2)}`);
  }
  const changed = req.log.length > 0;
  const undoBtn = changed && store.undoStack.length === undoAt + 1
    ? h('button.btn.small', { onclick: () => {
      if (store.undoStack.length !== undoAt + 1) { toast('Other changes came after this one. Use Undo to step back.', 'err'); return; }
      undo(); undoBtn.disabled = true; undoBtn.textContent = 'Undone';
    } }, icon('undo', 13), 'Undo all of this')
    : null;
  if (parts.length || undoBtn) add(h('div.ap-foot', h('span', changed ? `${req.log.length} change${req.log.length > 1 ? 's' : ''}${parts.length ? ' · ' : ''}${parts.join('')}` : parts.join('')), undoBtn));
  input.focus();
}

// ---------- first cut ----------
export function openFirstCut() {
  const o = { about: '', length: '', mood: '', include: new Set(['intro', 'outro', 'music', 'captions']) };
  const about = h('input.grow', { type: 'text', placeholder: 'A 60-second recap of our Lisbon trip', oninput: () => { o.about = about.value; } });
  const len = h('select.grow', { onchange: () => { o.length = len.value; } },
    [['', 'Whatever suits the footage'], ['15 seconds'], ['30 seconds'], ['60 seconds'], ['90 seconds'], ['2 minutes'], ['3 minutes']].map(([v, n]) => h('option', { value: v }, n || v)));
  const moods = h('div.chips');
  const paintMoods = () => moods.replaceChildren(...['Calm', 'Upbeat', 'Dramatic', 'Warm', 'Playful'].map((m) => h('button.chip-btn', { class: `chip-btn${o.mood === m.toLowerCase() ? ' on' : ''}`, onclick: () => { o.mood = o.mood === m.toLowerCase() ? '' : m.toLowerCase(); paintMoods(); } }, m)));
  paintMoods();
  const inc = h('div.chips');
  const paintInc = () => inc.replaceChildren(...[['intro', 'Intro'], ['outro', 'Outro'], ['music', 'Music'], ['captions', 'Captions']].map(([k, n]) => h('button.chip-btn', { class: `chip-btn${o.include.has(k) ? ' on' : ''}`, onclick: () => { if (o.include.has(k)) o.include.delete(k); else o.include.add(k); paintInc(); } }, n)));
  paintInc();
  const files = store.project.media.filter((m) => !m.library).length;
  const dlg = modal({
    title: 'Make a first cut', width: '560px',
    body: h('div.ap-form',
      h('div.row', h('label', 'What is it?'), about),
      h('div.row', h('label', 'Length'), len),
      h('div.row', h('label', 'Mood'), moods),
      h('div.row', h('label', 'Include'), inc),
      h('div.hint', `Claude looks through the ${files} file${files === 1 ? '' : 's'} in Project Media, then builds the video on the timeline while you watch. Undo takes it all back.`)),
    actions: [
      { label: 'Cancel', run: (c) => c() },
      { label: 'Make the first cut', primary: true, run: (c) => {
        if (!o.about.trim()) { about.focus(); toast('Say in a few words what the video is.', 'err'); return; }
        const names = { intro: 'an intro', outro: 'an outro', music: 'music', captions: 'captions if people speak' };
        const list = [...o.include].map((k) => names[k]);
        const include = list.length ? list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] : 'just the footage, nothing added';
        c();
        sendToClaude(fillPrompt(PROMPTS.find((p) => p.name === 'first_cut'), { about: o.about, length: o.length, mood: o.mood, include }), { effort: 'high' });
      } },
    ],
  });
  setTimeout(() => about.focus(), 50);
  return dlg;
}

// ---------- the panel ----------
async function newConversation(quiet = false) {
  if (running) await window.native.assistantPanelStop();
  await window.native.assistantPanelReset();
  logEl.replaceChildren();
  if (!quiet) paint();
}

function keyCard(status, onSaved) {
  const keyIn = h('input.grow', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: false });
  const msg = h('div.hint');
  const save = h('button.btn.primary', { onclick: async () => {
    save.disabled = true; msg.textContent = 'Checking the key with Claude…'; msg.classList.remove('ap-bad');
    const r = await window.native.assistantSaveKey(keyIn.value);
    save.disabled = false; msg.textContent = r.message; msg.classList.toggle('ap-bad', !r.ok);
    if (r.ok) { keyIn.value = ''; onSaved(); }
  } }, 'Save key');
  keyIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
  const link = (text, url) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.native.openExternal(url); } }, text);
  return h('div.ap-card',
    h('b', 'Use your own Claude API key'),
    h('p', 'The Assistant sends your requests to Claude through your own Claude developer account, and they are billed there. A small edit usually costs a few cents; a first cut can cost about a dollar.'),
    h('div.ap-keyrow', keyIn, save), msg,
    h('p.hint', 'Make a key in your Claude developer account at ', link('platform.claude.com', 'https://platform.claude.com/'), '. Current keeps it encrypted with this computer’s keyring and sends it only to Anthropic.'),
    h('p.hint', 'Before you send anything, the panel shows what goes to Anthropic and which of their terms apply.'),
    status.secure ? null : h('p.hint.ap-bad', 'This computer has no keyring to keep a key safe, so a key can’t be saved here.'),
    h('p.hint', 'Prefer to use your Claude plan instead? ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openAssistant(); } }, 'Connect Claude’s own apps'), '.'));
}

function noteCard(onDone) {
  return h('div.ap-card',
    h('b', 'Before you start'),
    ...privacyText('panel'),
    toggle({ label: 'Let Claude look at frames (better edits)', value: prefs.frames, onChange: (v) => { prefs.frames = v; savePrefs(); } }),
    h('p.hint', TRADEMARK),
    h('div', h('button.btn.primary', { onclick: () => { prefs.seenNote = true; savePrefs(); onDone(); } }, 'Got it')));
}

function emptyState() {
  const media = store.project?.media.filter((m) => !m.library).length;
  const chip = (label, run) => h('button.chip-btn', { onclick: run }, label);
  return h('div.ap-empty',
    h('p', media ? 'Ask for any edit, or let Claude make a first cut from your media.' : 'Ask for any edit. To have Claude build a video for you, add your clips to Project Media first.'),
    h('div.chips',
      media ? chip('Make a first cut…', openFirstCut) : null,
      chip('Cut the long pauses', () => sendToClaude('Cut the long pauses out of the clips where people talk.')),
      chip('Add music that fits', () => sendToClaude('Add music that fits the video, under the whole thing.')),
      chip('Add captions', () => sendToClaude('Add captions for everything that is said.')),
      chip('Suggest improvements', () => sendToClaude('Look at the video and suggest a few improvements. Don’t change anything yet.'))));
}

async function paint() {
  const status = await window.native.assistantKeyStatus();
  const kids = [];
  if (!status.hasKey) kids.push(keyCard(status, paint));
  else if (!prefs.seenNote) kids.push(noteCard(paint));
  else {
    if (!logEl.children.length || (logEl.children.length === 1 && thinking.isConnected)) logEl.prepend(emptyState());
    kids.push(logEl);
  }
  body.replaceChildren(...kids);
  foot.classList.toggle('hidden', !status.hasKey || !prefs.seenNote);
  const fc = foot.querySelector('.ap-first');
  const hasMedia = !!store.project?.media.some((m) => !m.library);
  fc.classList.toggle('hidden', !hasMedia);
  fc.classList.toggle('primary', hasMedia && !store.project.clips.length);
  if (!foot.classList.contains('hidden')) input.focus();
}

function settingsMenu(e) {
  const r = e.currentTarget.getBoundingClientRect();
  showMenu(r.right - 240, r.bottom + 4, [
    { label: 'Let Claude look at frames', icon: prefs.frames ? 'check' : null, run: () => { prefs.frames = !prefs.frames; savePrefs(); toast(prefs.frames ? 'Claude can look at frames.' : 'Claude won’t look at frames. It works from the analysis and transcripts.'); } },
    '-',
    { label: 'Change API key…', icon: 'reset', run: async () => { await window.native.assistantRemoveKey(); paint(); } },
    { label: 'Remove API key', icon: 'trash', run: async () => { await window.native.assistantRemoveKey(); toast('Key removed from this computer.'); paint(); } },
    '-',
    { label: 'Use Claude’s own apps…', icon: 'chat', run: openAssistant },
  ]);
}

export const panelOpen = () => !!el && !el.classList.contains('hidden');
export function openPanel() {
  if (panelOpen()) return;
  const bar = document.querySelector('.topbar');
  el.style.top = `${bar ? bar.getBoundingClientRect().bottom : 44}px`;
  el.classList.remove('hidden');
  prefs = loadPrefs();
  paint();
}
export function togglePanel() { if (panelOpen()) el.classList.add('hidden'); else openPanel(); }

export function initPanel() {
  logEl = h('div.ap-log');
  thinking = h('div.ap-thinking', h('span.ap-dot'), h('span', 'Claude is working…'));
  input = h('textarea.ap-input', { rows: 2, placeholder: 'Ask Claude to edit this video…' });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!running) { const t = input.value; input.value = ''; sendToClaude(t); } }
  });
  goBtn = h('button.ibtn.ap-go', { 'data-tip': 'Send (Enter)', onclick: () => {
    if (running) { window.native.assistantPanelStop(); return; }
    const t = input.value; input.value = ''; sendToClaude(t);
  } }, icon('chevronR', 16));
  foot = h('div.ap-compose',
    h('button.btn.small.ap-first', { onclick: openFirstCut }, icon('wand', 14), 'Make a first cut…'),
    h('div.ap-inrow', input, goBtn));
  body = h('div.ap-body');
  el = h('aside.ap.hidden',
    h('div.ap-head',
      icon('chat', 16), h('b', 'Assistant'), h('span.ap-by', 'Works with Claude'), h('div.sp'),
      h('button.ibtn.sm', { 'data-tip': 'New conversation', onclick: () => newConversation() }, icon('reset', 15)),
      h('button.ibtn.sm', { 'data-tip': 'Assistant settings', onclick: settingsMenu }, icon('menu', 15)),
      h('button.ibtn.sm', { 'data-tip': 'Close', onclick: togglePanel }, icon('x', 15))),
    body, foot);
  document.body.append(el);
  window.native.onAssistantPanelEvent(onEvent);
  // another project: Claude's conversation was about the old one
  store.on('change', (kind) => { if (kind === 'load') newConversation(!panelOpen()); });
  store.on('media', () => { if (panelOpen() && !running) { const fc = foot.querySelector('.ap-first'); const has = !!store.project?.media.some((m) => !m.library); fc.classList.toggle('hidden', !has); } });
}

// The top-bar button that opens the panel.
export function panelButton() {
  return h('button.ibtn.ap-toggle', { 'data-tip': 'Assistant: ask Claude to edit this video', onclick: togglePanel }, icon('chat', 18));
}
