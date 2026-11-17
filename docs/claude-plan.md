# Editing with Claude: plan

Written 2026-11-17, against Current 1.6.0 plus commit `dd20615`.

**Progress:**
- **Part 1 is built:** `src/js/agent/tools.js` (31 tools) and `src/js/agent/analyze.js`, tested by `tests/agent-tools.js`.
- **Part 2 is built:** `mcp/bridge.js` plus Tools › Assistant, tested by `tests/connector.js`.
  - Tried for real with Claude Code on 2026-11-17: from an 82-second tutorial it made a 32-second teaser in about a minute, with an intro, five steps, an outro, music and captions.
  - The bridge speaks MCP itself (plain Node, no packages), so the Ubuntu package needs nothing extra.
  - Claude's desktop app installs the saved `.mcpb` on macOS and Windows. On Ubuntu, Claude Code, or any app that takes an MCP configuration, runs the bridge with Current's own runtime.
- **Part 3 is built:** `assistant.js` (main process: the key in the keyring, and the Claude loop with Anthropic's SDK) and `src/js/ui/panel.js`, tested by `tests/panel.js` with a scripted Claude. Not yet tried with a real API key.
- **Part 4 is built:** the Make a first cut form in the panel, and the First cut prompt in the connector.

## What people get

**A first cut from their own media.**
- The person adds their footage, photos and audio to the project, then says what they're making ("a 60-second vertical travel recap, upbeat").
- Claude looks through every file and builds the video: it picks the best moments, puts them in order, trims them, and adds an intro and outro, titles, music, transitions and captions.
- The person gets at least a solid starting point, and often a finished video that only needs tweaks (part 4).

**Edits in plain words, at any time.** For example: "cut the long pauses, put the Boarding Pass intro at the start, add calm music under it and caption everything".
- Claude makes the edit in the open project, step by step, and the person watches it happen on the timeline.
- All of Claude's changes for one request undo as a single step.

There are two ways in, because Anthropic doesn't allow other apps to offer Claude account sign-in:

| | Route 1: connector | Route 2: panel inside Current |
|---|---|---|
| Where they type | Claude's own desktop app (Mac, Windows, Linux), or Claude Code | A panel in Current |
| How they sign in | Their own Claude account, through Anthropic's sign-in | Their own Claude API key, pasted into Current |
| Who pays | Their existing Claude plan | Their own pay-as-you-go developer account |
| What Current ships | A small connector (an MCP server) | The panel, plus Anthropic's official SDK |

Both routes use the same **editing tools** (part 1), so each tool is written and tested once.

## Part 1: the editing tools (shared)

`src/js/agent/tools.js` holds a list of tools. Each one has a name, a short description, an input schema, and a function that runs it in the editor through the existing functions in `actions.js` and `state.js`. Claude can only do what these tools allow.

**Looking (changes nothing)**
- `get_project`: the timeline as plain data (tracks, clips with ids, times, names, texts and effects), plus the aspect ratio, length and selection.
- `list_library`: search titles, sequences, music, sound effects, transitions, effects, filters, stickers and backgrounds by kind, category or words.
- `get_transcript`: what is said and when, word by word. If there are no captions yet, it runs the local speech engine first, so the audio still never leaves the computer.
- `view_frame`: a picture of the video at a given time, rendered by the preview (`player.renderNow`) at about 1000 px wide.
- `find_pauses`: silent stretches in a clip (`silence.js`).

**Understanding the media (for the first cut; changes nothing)**
- `list_media`: everything in Project Media, with:
  - type and length;
  - shape (wide, tall or square) and size;
  - whether it has sound, its date, and whether it's already used.
- `view_media`: a contact sheet for one file, as a single picture. It holds 6 to 12 frames spread across the file, each labelled with its time. Long files get one sheet per stretch.
  - This is how Claude "watches" footage. The API takes pictures, not video, so Claude sees stills, and the analysis below fills in the motion and sound.
- `view_media_frame`: one full frame from a file at a given time, to check a specific moment.
- `get_media_transcript`: what is said in a file and when, using the local speech engine. This lets Claude cut on whole sentences and drop false starts.
- `analyse_media`: worked out on the computer, with nothing uploaded:
  - shot changes;
  - quiet and loud stretches;
  - stretches that are too dark, blurry or shaky;
  - where the motion peaks.
  - Each file is analysed once and the result is kept in the cache, so asking again is instant.

**Editing (one undo step per request)**
- Add: `add_media` (something in Project Media, **with in and out points**, so Claude can take seconds 12.4 to 17.9 of a file; clips already store this as `in` and `duration`), `add_library_item` (title, sequence, music, sticker and so on, placed by role: intro, outro, at a time or at the playhead).
- Start from a template: `start_from_template` builds one of the 12 starter templates (`buildFromTemplate`), and `fill_clip_block` swaps a "Your clip" block for a chosen moment.
- Shape: `split`, `trim`, `move`, `delete` (with or without closing the gap), `set_speed`, `freeze_frame`.
- Words and look: `set_text`, `set_style` (fonts and colours), `apply_effect`, `apply_filter`, `set_transition`, `apply_brand_kit`.
- Sound: `set_volume`, `set_clip_type` (voice, music or sound effect, which drives auto-ducking), `remove_pauses`.
- Captions: `make_captions` (style, words per line, burned in or as a file).
- Sequences: `set_timer_length` for the Activity Timer (`retimeTimer`).

**Never available to Claude:** export, save, open or delete files, import files from disk, change settings, or anything outside the open project. The person always exports and saves.

**How requests run**
- Before Claude's first edit in a request, the editor takes one undo checkpoint (`checkpoint()`). Each tool then edits without adding more checkpoints, so **Undo** removes the whole request at once.
- Every tool checks its input against its schema and returns a clear error (an unknown clip id or a time past the end) instead of guessing.
- A short log shows what Claude did ("Split Clip 2 at 0:14", "Added Calm Ambient under the whole video").

**Tests:** `tests/agent-tools.js` drives every tool directly, with no network. It checks that each edit lands correctly, that one request undoes in one step, and that bad input is refused cleanly.

## Part 2: route 1, the connector

**How it fits together**
1. In Current, **Settings › Claude › Let Claude edit this project** switches on a local connection. It's off by default, and only allowed while Current is open.
   - The main process (`main.js`) listens on a socket inside Current's user-data folder (`~/.config/Current` or `~/Library/Application Support/Current`). Only the person's own account can open it.
   - Tool calls pass to the editor page over IPC.
2. `mcp/bridge.js` is a small MCP server built on the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`). It lists the tools from part 1 and forwards each call to the socket.
   - If Current isn't open, or the switch is off, the bridge tells Claude to ask the person to open Current.
3. People connect it in one of two ways:
   - **Claude desktop app:** a **Connect to Claude** button in Current saves a `current.mcpb` bundle (manifest plus bridge), which the person opens to install. The desktop app runs Node itself, so nothing else is needed.
   - **Claude Code:** Current shows a one-line command to copy. It runs the bridge with Current's own runtime (`ELECTRON_RUN_AS_NODE=1`), so Node isn't needed there either.
4. `view_frame` returns an image, `get_transcript` returns text, and the rest return short JSON.

**Packaging:** `build-deb.sh`, `install.sh` and the Mac build each copy `mcp/` and make `current.mcpb`.

**Tests:** `tests/connector.js` starts the bridge the way the Claude app would, as a child process. It lists the tools, runs a short edit through the socket, and checks the timeline and the single undo step. This needs no Claude account and no network.

## Part 3: route 2, the panel inside Current

**Setup**
- **Settings › Claude › API key**:
  - The person pastes a key from their Claude developer account.
  - Current stores it with Electron's `safeStorage` (the system keyring on Ubuntu, Keychain on Mac) and never shows it again.
  - A **Check** button makes one tiny request to confirm the key works.
- The key stays in the main process. The editor page never sees it.

**The panel**
- An icon-only toolbar button with a hover tip opens a side panel with a text box and a **Stop** button.
- The icon is a speech bubble. It's never Claude's logo, which would also break the no-burst-shapes rule.
- While Claude works, the panel shows the log from part 1, live.
- When it finishes: Claude's short summary, **Undo all of this**, and how many tokens the request used.
- The first time, a note says what is sent to Anthropic: the project outline, the texts, the transcript, and any frames Claude asks to see. Whole videos are never uploaded.
  - The note also has a **Let Claude look at frames** switch (on unless turned off).

**How it talks to Claude** (main process, `@anthropic-ai/sdk`)
- **Model:** `claude-opus-5-5`, with adaptive thinking and streaming.
  - Fallbacks are on by default (`fallbacks: "default"`), so a request the model declines is retried on another model.
  - Tool choice is left on `auto`, since this model doesn't accept forced tool choice.
  - Tools are `strict`, and each tool's input is checked again before it runs.
- **Prompt caching:** the system prompt and tool list never change between requests, so they are cached and repeat requests cost less.
- **The loop:** main sends the request, Claude asks for a tool, main forwards it to the editor over IPC, and the result goes back to Claude. This repeats until Claude is done, the person presses Stop, or a step limit (about 40 tool calls) is reached.
- **Follow-ups:** the conversation carries over within the project ("now make the intro shorter"). **New conversation** clears it.
- **Errors:** a wrong key, no internet, rate limits and declined requests each get a plain-language message in the panel.

**Cost:** billed to the person's own developer account at $4 per million tokens read and $20 per million written. I'd estimate 10 to 30 cents for a typical request, with caching; I'll measure real numbers during testing.

**Tests:**
- `tests/claude-panel.js` uses `CURRENT_FAKE_CLAUDE`, a scripted fake, like the existing fake speech engine. It checks the loop, Stop, Undo all, the step limit, the error messages and that the key never reaches the page.
- One real test with your key at the end, which costs a little money, so I'll ask first.

## Part 4: First cut

**For the person**
1. They add their files to Project Media (import, drag in, or record).
2. They press **Make a first cut**. It's in the panel, and also offered once the project has media and an empty timeline.
3. A short form asks:
   - what the video is (one line, like "a 60-second travel recap from our Lisbon trip");
   - the shape (it starts on the project's own shape);
   - a target length;
   - a mood (calm, upbeat, dramatic, warm);
   - which of these to include: an intro, an outro, captions, music.
4. Claude builds the video while the person watches. When it's done, the panel shows a short outline of what it made and why, for example: "Opened on the tram shot, then the market, the food, and the sunset to close; skipped two blurry clips". Any part can be redone with a follow-up ("swap the opening shot", "make it 30 seconds", "less music").
5. **Undo all of this** puts the empty timeline back.

On the connector route the same thing is offered as a ready-made prompt called **First cut**. MCP servers can include prompts, and Claude's app lists them for the person to pick. The person answers the same questions in their Claude chat.

**How Claude works through it** (written into the instructions Claude gets)
1. **Look:**
   - `list_media`, then `analyse_media` and `view_media` for every file;
   - `get_media_transcript` for files with speech.
   - For large piles it looks at the sheets first and checks single frames only where it's unsure.
2. **Plan:** picks the moments, their order and the music, against the person's goal and target length. It drops blurry, dark or repeated shots and false starts.
3. **Build:**
   - the main clips with their in and out points;
   - then an intro and outro from the matching Sequences section (Travel, News, Gaming, Education, Professional);
   - title text written from what it saw and heard;
   - music from the library, set as music so it ducks under voices;
   - transitions, and captions if asked for.
4. **Check:** `view_frame` at a few points of the finished timeline, and fix anything that looks wrong (text over a face, a cut mid-word).
5. **Summarise:** the outline the person sees.

**What it can't do:**
- Claude doesn't see motion, only stills plus the local analysis, so it can miss a great moment that happens between sampled frames.
- Without the speech engine installed (`whisper.cpp` on Ubuntu), it works from pictures and sound levels only, and the form says so.

**Cost and time:** a first cut reads much more than a single edit, mostly the contact sheets. I'd estimate about 50 cents to 2 dollars and one to three minutes for about 20 clips, on the person's own key or Claude plan. Real numbers come from testing.

**Privacy:** the person's own frames (as stills) and transcripts are sent to Anthropic. Video and sound files never leave the computer. The first-use note says this plainly.

**Tests:**
- `tests/first-cut.js` runs the whole flow against the scripted stand-in for Claude, using the test media. It checks that the contact sheets, transcripts and analysis come back right, that the build lands on the timeline, and that Undo all empties it.
- The local analysis gets its own checks: generated test clips with a known cut, a dark stretch and a silent stretch, which must be found.

## Order of work

1. **The editing tools, the media tools and the local analysis, with their tests.** Everything else depends on these.
2. **The connector**, including the First cut prompt. It uses people's existing Claude plans, and needs no keys or billing in Current.
3. **The panel**, including Make a first cut.
4. **Wrap-up:** What's new, the README, a full test run, then release as **1.7.0**. The Mac branch would pick it up too, because none of this is platform-specific apart from the socket path.

## Decisions (made 2026-11-17)

The feature is called **Assistant**, with "Works with Claude" underneath. Claude may look at frames by default, with a switch in the panel's menu. The connector came first. The First cut form asks what the video is; length, mood and what to include are optional.

## Decisions as first asked

1. **Naming.** The feature has to mention Claude, which is an exception to the no-other-companies rule. Anthropic's guidelines allow its name in plain text ("Works with Claude") but not as part of a feature name or with its logo. So the feature needs a name of its own. Suggestion: **Assistant**, with "Works with Claude" underneath.
2. **Frames.** Should Claude be able to look at frames by default (better edits), or only after the person allows it?
3. **Order.** Connector first (recommended), or the panel first?
4. **First cut form.** Are the questions above (what it is, shape, length, mood, include intro, outro, captions or music) the right ones, or should it be just one line of description?
