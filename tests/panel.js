// The Assistant panel inside Current, with a scripted Claude (CURRENT_FAKE_CLAUDE) instead of the real
// one: the key setup (kept encrypted), the first-use note, a request that edits (one undo step, the
// steps shown live, usage and Undo all), what is sent to Claude (model, fallbacks, caching, tools,
// tool results with pictures), refusals by a tool, Stop, an API error, frames switched off, the First
// cut form, New conversation and removing the key.
//   CURRENT_ASSISTANT_SOCKET=tests/out/assistant.sock CURRENT_FAKE_CLAUDE=1 \
//   CURRENT_FAKE_WHISPER=tests/fixtures/whisper-words.json npx electron . --selftest=tests/panel.js
const base = new URL('../src/js/', import.meta.url).href;
const M = decodeURIComponent(new URL('./media/', import.meta.url).pathname);
const OUT = decodeURIComponent(new URL('./out/', import.meta.url).pathname);
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; log(ok ? 'ok  ' : 'FAIL', msg); };
const until = async (f, ms = 5000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const textTurn = (text) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' });
const toolTurn = (text, ...uses) => ({ content: [...(text ? [{ type: 'text', text }] : []), ...uses.map(([id, name, input]) => ({ type: 'tool_use', id, name, input }))], stop_reason: 'tool_use' });
const shot = (n) => { document.getAnimations().filter((x) => x.effect?.getComputedTiming().iterations !== Infinity).forEach((x) => x.finish()); return window.native.selftestCapture(OUT + n + '.png'); };

try {
  document.querySelector('.start button.primary')?.click();
  await wait(400);
  try { localStorage.removeItem('current.assistant'); } catch { /* fine */ }
  const st = await import(base + 'state.js');
  const A = await import(base + 'actions.js');
  const P = await import(base + 'ui/panel.js');
  const Tl = await import(base + 'agent/tools.js');
  const S = st.store;
  await window.native.assistantRemoveKey();

  // 1. setting up the key
  $('.ap-toggle').click(); await wait(300);
  check(P.panelOpen() && !!$('.ap-card input[type=password]'), 'the top-bar button opens the panel, asking for an API key');
  const keyIn = $('.ap-card input[type=password]'), save = $('.ap-card .btn.primary');
  keyIn.value = 'not a key'; save.click(); await wait(300);
  check(/doesn’t look like a Claude API key/.test($('.ap-card .hint').textContent), 'something that isn\'t a key is refused');
  keyIn.value = 'sk-ant-bad-0123456789abcdefghij'; save.click(); await wait(400);
  check(/didn’t accept this API key/.test($('.ap-card .hint').textContent), 'a key Claude rejects is not saved');
  const ring = await window.native.assistantKeyStatus();
  keyIn.value = 'sk-ant-test-0123456789abcdefWXYZ'; save.click();
  await until(() => /Before you start/.test($('.ap-card')?.textContent || '')); // saving goes through the keyring, which can take a moment
  const ks = await window.native.assistantKeyStatus();
  check(ring.secure ? ks.hasKey && ks.hint === '…WXYZ' : !ks.hasKey, `a good key is saved (keyring: ${ring.backend})`);
  if (ks.hasKey) {
    const raw = new TextDecoder('latin1').decode(await window.native.readBinary(OUT + 'assistant-key.bin'));
    check(!raw.includes('sk-ant-test'), 'the saved key is encrypted, not readable in the file');
  }
  check(!!$('.ap-card') && /Before you start/.test($('.ap-card').textContent) && /stay on this computer/.test($('.ap-card').textContent), 'then a note says what Claude sees');
  [...$$('.ap-card .btn.primary')].find((b) => /Got it/.test(b.textContent)).click(); await wait(300);
  check(!!$('.ap-empty') && !$('.ap-compose').classList.contains('hidden'), 'and the conversation opens with suggestions and a text box');

  // 2. a request that edits
  const [m1] = await A.importPaths([M + 'test1.mp4']);
  await wait(200);
  await window.native.selftestFakeClaude([
    toolTurn('I’ll add your clip.', ['t1', 'add_media', { media_id: m1.id, in: 1, out: 4 }]),
    toolTurn(null, ['t2', 'view_frame', { time: 1 }], ['t3', 'list_library', { kind: 'music', search: 'chill' }]),
    textTurn('Done: I added **one clip** from 0:01 to 0:04.\n\n- It starts at the beginning\n- Music next time'),
  ]);
  const undo0 = S.undoStack.length;
  await P.sendToClaude('Put three seconds of my clip at the start.');
  await wait(200);
  check(S.project.clips.length === 1 && S.undoStack.length === undo0 + 1, `Claude's edit lands on the timeline as one undo step (${S.project.clips.length} clip, ${S.undoStack.length - undo0} step)`);
  check(/Put three seconds/.test($('.ap-you')?.textContent) && /I’ll add your clip/.test($$('.ap-claude')[0]?.textContent), 'the panel shows your message and Claude\'s reply');
  const steps = $$('.ap-step').map((s) => s.textContent);
  check(steps.length === 3 && /Added test1\.mp4/.test(steps[0]) && /Checking the video at 0:01/.test(steps[1]) && /Searching the library/.test(steps[2]), `each step is listed (${steps.join(' | ')})`);
  check(!!$$('.ap-claude').at(-1)?.querySelector('b') && $$('.ap-claude').at(-1).querySelectorAll('li').length === 2, 'Claude\'s summary shows its bold text and list');
  check(/1 change · [\d,]+ tokens, about \$\d/.test($('.ap-foot')?.textContent || ''), `what it used is shown (${$('.ap-foot')?.textContent})`);
  let reqs = await window.native.selftestFakeClaudeRequests();
  const r0 = reqs[0];
  check(reqs.length === 3 && r0.model === 'claude-opus-5-5' && r0.fallbacks === 'default' && r0.betas.includes('server-side-fallback-2026-07-01') && r0.thinking.type === 'adaptive' && r0.output_config.effort === 'medium' && r0.cache_control?.type === 'ephemeral', 'requests go to Claude Opus 5.5 with fallbacks, adaptive thinking, medium effort and caching');
  check(r0.tools.length === Tl.toolList().length && r0.tools.every((t) => t.eager_input_streaming && t.input_schema) && /editing a video in Current/.test(r0.system[0].text) && /Assistant panel/.test(r0.system[1].text), `with all ${r0.tools.length} tools and the instructions`);
  const tr1 = reqs[1].messages.at(-1).content[0], tr2 = reqs[2].messages.at(-1).content;
  check(tr1.type === 'tool_result' && tr1.tool_use_id === 't1' && /Added test1/.test(tr1.content[0].text) && !tr1.is_error, 'the tool result goes back to Claude');
  check(tr2.length === 2 && tr2[0].content.some((c) => c.type === 'image' && c.source.type === 'base64' && c.source.media_type === 'image/jpeg' && c.source.data.length > 1000), 'pictures go back as images, and two calls in one turn answer together');
  await shot('panel-1');
  $('.ap-foot .btn').click(); await wait(200);
  check(S.project.clips.length === 0 && $('.ap-foot .btn').disabled, 'Undo all of this takes the edit back');

  // 3. a refused tool call, then Stop, then an API error
  await window.native.selftestFakeClaude([toolTurn(null, ['t4', 'add_media', { media_id: 5 }]), textTurn('That didn’t work; sorry.')]);
  await P.sendToClaude('Add something.');
  reqs = await window.native.selftestFakeClaudeRequests();
  const bad4 = reqs[1].messages.at(-1).content[0];
  check(bad4.is_error === true && /media_id should be string/.test(bad4.content[0].text) && $$('.ap-step.bad').length === 1, 'a refused call is shown as a problem and sent back as an error');
  check(reqs[0].messages.length === 7, `the conversation carries on from before (${reqs[0].messages.length} messages)`);
  await window.native.selftestFakeClaude([{ ...textTurn('Thinking a long time…'), delay_ms: 4000 }]);
  const pending = P.sendToClaude('Take your time.');
  await wait(400);
  check($('.ap-go').classList.contains('stop'), 'while Claude works the send button becomes Stop');
  $('.ap-go').click();
  await pending; await wait(150);
  check(/Stopped\./.test($$('.ap-note').at(-1)?.textContent) && !$('.ap-go').classList.contains('stop'), 'Stop ends the request');
  await window.native.selftestFakeClaude([{ error: 429 }]);
  await P.sendToClaude('Again please.');
  check(/too many requests/.test($$('.ap-note.err').at(-1)?.textContent || ''), 'an API error is explained in plain words');
  await window.native.selftestFakeClaudeRequests();

  // 4. frames switched off
  localStorage.setItem('current.assistant', JSON.stringify({ frames: false, seenNote: true }));
  // the panel reads its preferences once; the menu item flips the live one
  const menuBtn = $$('.ap-head .ibtn')[1];
  menuBtn.click(); await wait(150);
  [...$$('.dropdown .item')].find((i) => /look at frames/.test(i.textContent))?.click(); await wait(100);
  await window.native.selftestFakeClaude([textTurn('OK.')]);
  await P.sendToClaude('Hello.');
  reqs = await window.native.selftestFakeClaudeRequests();
  check(!reqs[0].tools.some((t) => /view_/.test(t.name)) && reqs[0].tools.length === Tl.toolList().length - 3, 'with frames off, Claude gets no picture tools');
  menuBtn.click(); await wait(150);
  [...$$('.dropdown .item')].find((i) => /look at frames/.test(i.textContent))?.click(); await wait(100);

  // 5. the First cut form
  $('.ap-first').click(); await wait(300);
  const form = $('.modal .ap-form');
  check(!!form && /Claude looks through the 1 file/.test(form.textContent), 'Make a first cut opens a short form');
  [...$$('.modal .modal-f .btn')].find((b) => /Make the first cut/.test(b.textContent)).click(); await wait(150);
  check(!!$('.modal .ap-form'), 'it needs to know what the video is');
  form.querySelector('input').value = 'a weekend in Porto'; form.querySelector('input').dispatchEvent(new Event('input'));
  form.querySelector('select').value = '30 seconds'; form.querySelector('select').dispatchEvent(new Event('change'));
  [...form.querySelectorAll('.chip-btn')].find((b) => b.textContent === 'Upbeat').click();
  [...form.querySelectorAll('.chip-btn')].find((b) => b.textContent === 'Captions').click();
  await window.native.selftestFakeClaude([textTurn('Here is your first cut.')]);
  [...$$('.modal .modal-f .btn')].find((b) => /Make the first cut/.test(b.textContent)).click();
  await wait(800);
  reqs = await window.native.selftestFakeClaudeRequests();
  const fcText = reqs[0]?.messages.at(-1).content;
  check(reqs[0]?.output_config.effort === 'high' && /What it is: a weekend in Porto/.test(fcText) && /Target length: 30 seconds/.test(fcText) && /Mood: upbeat/.test(fcText) && /an intro, an outro and music/.test(fcText), 'the form sends the First cut prompt with the answers, at high effort');

  // 6. New conversation, another project, removing the key
  $$('.ap-head .ibtn')[0].click(); await wait(300);
  await window.native.selftestFakeClaude([textTurn('Fresh start.')]);
  await P.sendToClaude('Hi.');
  reqs = await window.native.selftestFakeClaudeRequests();
  check(reqs[0].messages.length === 1 && $$('.ap-you').length === 1, 'New conversation starts Claude afresh');
  await shot('panel-2');
  await window.native.assistantRemoveKey();
  $$('.ap-head .ibtn')[2].click(); await wait(100);
  $('.ap-toggle').click(); await wait(300);
  check(!!$('.ap-card input[type=password]') && !(await window.native.assistantKeyStatus()).hasKey, 'after removing the key the panel asks for one again');
  $('.ap-toggle').click();
} catch (e) { bad++; log('FAIL error', e.stack || e.message); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
