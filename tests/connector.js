// The connector for Claude's apps: mcp/bridge.js is started the way Claude's apps start it (a child
// process speaking MCP on stdin/stdout) and talks to this window over the local socket.
// Checks the handshake, tools, prompts, edits as one undo step, pictures, refusals, Current switched off,
// the saved bundle for Claude's desktop app, and that mcp/catalog.json matches the tools.
//   CURRENT_ASSISTANT_SOCKET=tests/out/assistant.sock CURRENT_BUNDLE_PATH=tests/out/Current.mcpb \
//   CURRENT_FAKE_WHISPER=tests/fixtures/whisper-words.json npx electron . --selftest=tests/connector.js
const base = new URL('../src/js/', import.meta.url).href;
const M = decodeURIComponent(new URL('./media/', import.meta.url).pathname);
const CATALOG_FILE = decodeURIComponent(new URL('../mcp/catalog.json', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; log(ok ? 'ok  ' : 'FAIL', msg); };

const INIT = [
  { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
];
const call = (id, name, args, meta) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args, ...(meta ? { _meta: meta } : {}) } });
async function session(msgs, env) {
  const r = await window.native.selftestBridge([...INIT, ...msgs], env);
  const by = Object.fromEntries(r.answers.map((a) => [a.id, a]));
  if (r.stderr) log('bridge stderr:', r.stderr.trim());
  return { ...r, by };
}
const textOf = (a) => a?.result?.content?.find((c) => c.type === 'text')?.text || '';
const dataOf = (a) => { try { return JSON.parse(textOf(a)); } catch { return null; } };

function unzip(buf) {
  const dv = new DataView(buf), dec = new TextDecoder(), out = {};
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  let p = dv.getUint32(e + 16, true);
  for (let i = 0, n = dv.getUint16(e + 10, true); i < n; i++) {
    const nl = dv.getUint16(p + 28, true), size = dv.getUint32(p + 20, true), at = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nl));
    out[name] = new Uint8Array(buf, at + 30 + dv.getUint16(at + 26, true) + dv.getUint16(at + 28, true), size);
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return out;
}

try {
  document.querySelector('.start button.primary')?.click();
  await wait(400);
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const Tl = await import(base + 'agent/tools.js');
  const { catalog } = await import(base + 'agent/catalog.js');
  const { connector } = await import(base + 'agent/connector.js');
  const S = st.store;

  // 1. the saved catalog matches the tools
  const fresh = JSON.stringify(catalog(), null, 1) + '\n';
  const savedText = await fetch(new URL('../mcp/catalog.json', import.meta.url)).then((r) => r.text()).catch(() => '');
  if (savedText !== fresh) await window.native.selftestWriteText(CATALOG_FILE, fresh);
  check(savedText === fresh, savedText === fresh ? 'mcp/catalog.json matches the tools' : 'mcp/catalog.json was out of date and has been rewritten: run the test again');

  // 2. switched on, the handshake, tools and prompts
  await window.native.assistantSet({ connector: true });
  const [m1, an] = await A.importPaths([M + 'test1.mp4', M + 'analysis.mp4']);
  let r = await session([
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { jsonrpc: '2.0', id: 2, method: 'prompts/list' },
    { jsonrpc: '2.0', id: 3, method: 'prompts/get', params: { name: 'first_cut', arguments: { about: 'a weekend in Porto' } } },
    { jsonrpc: '2.0', id: 4, method: 'prompts/get', params: { name: 'first_cut', arguments: {} } },
    { jsonrpc: '2.0', id: 5, method: 'ping' },
    { jsonrpc: '2.0', id: 6, method: 'resources/list' },
  ]);
  const init = r.by[0]?.result;
  check(init?.protocolVersion === '2025-06-18' && init.serverInfo?.name === 'current' && /editing a video in Current/.test(init.instructions) && init.capabilities?.tools, 'initialize answers with the protocol, the server and its instructions');
  const tools = r.by[1]?.result?.tools || [];
  check(tools.length === Tl.toolList().length && tools.every((t) => t.inputSchema?.type === 'object' && t.description && t.annotations), `tools/list gives all ${tools.length} tools in MCP's shape`);
  check(tools.find((t) => t.name === 'view_media')?.annotations.readOnlyHint === true && tools.find((t) => t.name === 'add_media')?.annotations.readOnlyHint === false, 'looking tools are marked read-only, editing tools are not');
  check(r.by[2]?.result?.prompts?.[0]?.name === 'first_cut' && r.by[2].result.prompts[0].arguments.some((a) => a.name === 'about' && a.required), 'prompts/list offers First cut');
  const ptext = r.by[3]?.result?.messages?.[0]?.content?.text || '';
  check(/What it is: a weekend in Porto/.test(ptext) && /Target length: what the footage supports/.test(ptext), 'prompts/get fills in the answers and the defaults');
  check(r.by[4]?.error?.code === -32602 && /about/.test(r.by[4].error.message), 'prompts/get without the description is refused');
  check(r.by[5]?.result && r.by[6]?.error?.code === -32601, 'ping answers, and unknown methods are refused');

  // 3. edits from Claude's app: one undo step, the marker in the top bar, a summary at the end
  connector.idleMs = 1200;
  const undo0 = S.undoStack.length;
  r = await session([call(10, 'add_media', { media_id: m1.id, in: 1, out: 4 })]);
  check(r.by[10]?.result?.isError === false && dataOf(r.by[10])?.clip?.end === 3, 'tools/call add_media puts the clip on the timeline');
  check(!document.querySelector('.assist-pill').classList.contains('hidden'), 'the top bar says Claude is editing');
  r = await session([call(11, 'add_media', { media_id: an.id })]);
  check(S.project.clips.length === 2 && S.undoStack.length === undo0 + 1, `calls close together are one undo step (${S.undoStack.length - undo0})`);
  await wait(1600);
  const toastText = [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ');
  check(document.querySelector('.assist-pill').classList.contains('hidden') && /Claude made 2 changes/.test(toastText), `after a quiet spell the marker goes and a note says what happened (${toastText})`);
  st.undo(); await wait(100);
  check(S.project.clips.length === 0, 'one Undo takes both back');
  st.redo(); await wait(100);

  // the person editing in between keeps their own step
  const undo1 = S.undoStack.length;
  await session([call(12, 'set_volume', { clip_id: S.project.clips[0].id, volume: 0.5 })]);
  st.edit(() => { S.project.clips[0].name = 'Renamed by hand'; });
  await session([call(13, 'set_volume', { clip_id: S.project.clips[1].id, volume: 0.7 })]);
  check(S.undoStack.length === undo1 + 3, `an edit by hand in the middle stays its own step (${S.undoStack.length - undo1} steps)`);
  st.undo(); await wait(50);
  check(S.project.clips[1].volume === 1 && S.project.clips[0].name === 'Renamed by hand', 'so Undo takes back only Claude\'s last change first');
  st.redo();
  await wait(1400);

  // 4. pictures, progress notes and refusals
  r = await session([call(20, 'view_media', { media_id: m1.id, count: 16 }, { progressToken: 'p1' })], { CURRENT_BRIDGE_BEAT_MS: '150' });
  const img = r.by[20]?.result?.content?.find((c) => c.type === 'image');
  check(img?.mimeType === 'image/jpeg' && img.data.length > 10000, 'view_media comes back as an MCP image');
  check(r.notes.some((n) => n.method === 'notifications/progress' && n.params.progressToken === 'p1'), `a slow call sends progress notes (${r.notes.length})`);
  r = await session([call(21, 'split', { clip_id: 'nope', time: 1 }), call(22, 'add_media', { media_id: 5 })]);
  check(r.by[21]?.result?.isError === true && /no clip nope/.test(textOf(r.by[21])) && r.by[22]?.result?.isError === true && /media_id should be string/.test(textOf(r.by[22])), 'refusals come back as errors with the reason');
  await wait(1400);

  // 5. switched off: calls explain what to do; the tool list still works from the saved copy
  await window.native.assistantSet({ connector: false });
  r = await session([{ jsonrpc: '2.0', id: 30, method: 'tools/list' }, call(31, 'get_project', {})]);
  check((r.by[30]?.result?.tools || []).length === Tl.toolList().length, 'with Current switched off the tool list comes from the saved copy');
  check(r.by[31]?.result?.isError === true && /switched off/.test(textOf(r.by[31])), `and calls say how to switch it on (${textOf(r.by[31]).slice(0, 60)}…)`);
  const s = await window.native.assistantGet();
  check(!s.connector && /claude mcp add current --scope user -e ELECTRON_RUN_AS_NODE=1 -- /.test(s.claudeCode) && JSON.parse(s.mcpConfig).mcpServers.current.env.ELECTRON_RUN_AS_NODE === '1', 'the setting is saved, and the setup command and config are ready to copy');

  // 6. the bundle for Claude's desktop app
  const out = await window.native.assistantSaveBundle(catalog());
  const files = unzip(await window.native.readBinary(out));
  const man = JSON.parse(new TextDecoder().decode(files['manifest.json'] || new Uint8Array()));
  check(['manifest.json', 'server/bridge.js', 'server/catalog.json', 'icon.png'].every((f) => files[f]?.length > 0), `the bundle holds the manifest, the bridge, the catalog and the icon (${Object.keys(files).join(', ')})`);
  check(man.manifest_version === '0.3' && man.name === 'current' && man.server?.type === 'node' && man.server.entry_point === 'server/bridge.js' && man.server.mcp_config.args[0] === '${__dirname}/server/bridge.js', 'the manifest runs the bridge with the app\'s own Node');
  check(man.tools.length === Tl.toolList().length && /\$\{arguments\.about\}/.test(man.prompts[0].text) && man.author?.name === 'webhookstudios', 'the manifest lists the tools and the First cut prompt');
  check(new TextDecoder().decode(files['server/bridge.js']).includes('Current\'s connector for Claude\'s apps'), 'the bundled bridge is the one in mcp/');

  // 7. the Assistant window
  const { openAssistant } = await import(base + 'ui/assistant.js');
  await openAssistant(); await wait(300);
  const dlg = document.querySelector('.modal .asst');
  check(!!dlg && /Let Claude edit in Current/.test(dlg.textContent) && /claude mcp add/.test(dlg.textContent) && /stay on this computer/.test(dlg.textContent), 'Tools › Assistant shows the switch, the setup for each app and what Claude can see');
  document.getAnimations().filter((x) => x.effect?.getComputedTiming().iterations !== Infinity).forEach((x) => x.finish()); // animations wait for a frame in the test window
  await window.native.selftestCapture(decodeURIComponent(new URL('./out/assistant-window.png', import.meta.url).pathname));
  document.querySelector('.modal-f .btn.primary')?.click();
} catch (e) { bad++; log('FAIL error', e.stack || e.message); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
