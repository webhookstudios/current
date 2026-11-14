# Current for Mac: hand-off brief

This brief is for a Claude Code session on a Mac. It explains what a Mac version of Current needs and how to fit in with the Linux work. It was written on 2026-11-13, from version 1.6.0 (commit `c421eeb`).

## The goal

Build a Mac version of Current. It should open from a `.dmg`, edit and export videos the same way the Ubuntu version does, and come from the same code. Keep the Ubuntu version working exactly as it does now.

You're done when:

- `npm start` runs Current on the Mac.
- A packaged `Current.app` imports, plays and exports MP4, MOV, WebM and MP3.
- Screen recording, voiceover and webcam recording work.
- Captions work.
- The test suites pass on the Mac.
- All of the work is in a pull request to `main` that leaves Linux behaviour unchanged.

## Rules from the owner (follow these exactly)

- **Ask before every commit, push, release or upload.** Never commit or push without a clear yes.
- **Commit identity:** `git -c user.name=webhookstudios -c user.email=354619278+webhookstudios@users.noreply.github.com commit …`. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Work on a `mac` branch** and open a pull request. Don't push to `main`. A Linux session reruns the Ubuntu tests before anything is merged.
- **Leave these alone:** the version number, `RELEASE-NOTES.md`, the website and other apps. Another chat handles those.
- **No other companies' names in the app.** Never name or compare to other companies' products in the app or its text. Sample text uses made-up names only. Naming the platform ("macOS", "System Settings") is fine where needed.
- **Icon rules:**
  - No icons that resemble another company's logo.
  - No burst or asterisk shapes.
  - Suns are a circle with a ring, never rays.
  - Toolbar buttons are icon-only, with hover tips.

## How the app is built

- **Electron 45.2.3.** `main.js` (427 lines) is the main process and `preload.js` is the bridge. Everything else is plain web code in `src/`, and none of it is platform-specific apart from the points below.
- **Running and tests:**
  - Run from a checkout with `npm install` and then `npm start`.
  - Tests run inside the app with `npx electron . --selftest=tests/<name>.js` and print `ALL OK` or a failure count.
  - `tests/media/` is created by `tests/make-media.sh` and isn't in git.
- **Packaging:** `build-deb.sh` and `install.sh` copy only `package.json`, `main.js`, `preload.js`, `src/` and one PNG from `data/`. If you add a new file that `main.js` needs, such as `encoder.js` at the top level, add it to both scripts. Otherwise the Ubuntu package will break. Code inside `src/` is copied automatically.

## What to change

### 1. Encoding: GStreamer to a bundled ffmpeg (the biggest job)

On Ubuntu, `main.js` runs `gst-launch-1.0` from the system packages. Macs don't have it. Bundle an ffmpeg binary inside the app and use it **on macOS only**, keeping the GStreamer path for Linux. A small `encoder` layer with two backends works well, chosen by `process.platform`.

Three places use GStreamer:

| What | Where | What it does |
|---|---|---|
| Export | `buildExportArgs` and the `export:*` handlers, near the end of `main.js` | Takes raw RGBA frames on stdin plus an optional WAV file and writes MP4, MOV, WebM or MP3 |
| Media proxies | the `media:proxy` handler | Converts files Chromium can't play into an H.264/AAC MP4 in the cache |
| Recording clean-up | the `recording:save` handler | Remuxes the recorder's WebM (video only, VP8) so it has a duration and seek index |
| Encoder check | `gst:check` (end of `main.js`), used at `src/js/app.js:60` | Shows a toast if the encoders are missing. The toast and the About text at `src/js/app.js:361` both name GStreamer, so give macOS its own wording |

**Export settings to match** (from `buildExportArgs`):

- **Frames arrive upside down.** They are raw `rgba`, width × height × 4 bytes each, at `o.fps`. GStreamer flips them with `videoflip method=vertical-flip`. With ffmpeg, use `-f rawvideo -pix_fmt rgba -s WxH -r FPS -i pipe:0 -vf vflip`.
- **Audio** is a WAV file at `o.audioPath`, converted to 48 kHz stereo.
- **MP4 and MOV:**
  - x264 in constant-quality mode, quality 17/21/26 for high/medium/low (`-crf` in ffmpeg);
  - preset `slow`/`medium`/`veryfast`;
  - keyframe every `fps*2`;
  - High profile, `yuv420p`, faststart;
  - AAC at 256 kb/s. MOV uses the QuickTime container.
- **WebM:**
  - VP9 in realtime mode (`deadline=1`), `cpu-used` 2/4/6, row-mt;
  - target bitrate `width*height*fps*{0.12, 0.07, 0.04}/1000` kb/s;
  - keyframe every `fps*4`;
  - Opus at 160 kb/s.
- **MP3:** LAME, constant 256 kb/s.
- **Proxy:** x264 `veryfast`, quality 20, keyframe every 30 frames, AAC 192 kb/s at 48 kHz, faststart. If the file has no sound, retry without audio. With ffmpeg, `-map 0:a:0?` handles that in one go.
- **Recording clean-up:** `ffmpeg -i raw.webm -map 0:v:0 -c copy out.webm`.

**Getting ffmpeg into the app:**

- It needs libx264, libvpx (VP9), libopus, libmp3lame and AAC. Check with `ffmpeg -encoders`.
- It must be a standalone build. Homebrew's ffmpeg depends on other Homebrew libraries and can't be bundled.
- Fetch or build it with a script, for example `scripts/mac-tools.sh`. Keep the binary out of git: put it in `vendor/mac/` and add that folder to `.gitignore`.
- Ship it with `extraResources`. In the packaged app, find it under `process.resourcesPath`; when running from a checkout, find it in `vendor/mac/`.
- The x264 build is GPL. Current is GPL-2.0-or-later, so that's allowed. Include ffmpeg's licence and a link to the exact source version.

### 2. Captions (whisper.cpp)

- `main.js:226` runs `/usr/bin/whisper-cli`, or whatever `CURRENT_WHISPER_CLI` points to.
- The flags are `-ml 1 -sow -ojf -nfa -dtw <model> -pp`. They are known to work with whisper.cpp 1.8.3, the version Ubuntu ships. Use 1.8.3 or newer and check that `-dtw` still exists.
- The speech models download into the user-data folder and are checked against their SHA-256. That part already works on any system.
- **Recommended:** build `whisper-cli` from source (cmake, with Metal on Apple Silicon) and bundle it next to ffmpeg. Mac users then have nothing to install. whisper.cpp is MIT-licensed.
- `src/js/ui/captions.js:155` tells people to run `sudo apt install whisper.cpp`. On macOS, show a Mac message instead, or nothing at all if the engine is bundled.

### 3. Screen, microphone and camera

- **Linux-only switches.** `main.js:19-21` adds Wayland and PipeWire switches. Wrap them in `if (process.platform === 'linux')`.
- **Screen picker.** At `main.js:96`, `setDisplayMediaRequestHandler` takes `sources[0]`, because Linux's own share dialog has already asked which screen to share. On a Mac that would record the main screen without asking. Use one of these instead:
  - the system picker, by passing `{ useSystemPicker: true }` as the second argument (macOS 15 and newer);
  - your own picker, listing `desktopCapturer.getSources` thumbnails in the record window (`src/js/ui/screenrec.js`).
- **Permissions:**
  - Screen recording needs the Screen Recording permission. Without it, captures come out blank, so check `systemPreferences.getMediaAccessStatus('screen')` and explain how to allow it.
  - Microphone and camera need `NSMicrophoneUsageDescription` and `NSCameraUsageDescription` in Info.plist.
  - Call `systemPreferences.askForMediaAccess('microphone' / 'camera')` before `getUserMedia`. That happens in `src/js/ui/voiceover.js` and `screenrec.js`.

### 4. Menus and shortcuts

- **Menu bar.** `main.js:51` removes the menu bar (`Menu.setApplicationMenu(null)`). A Mac needs one: an app menu (About, Hide, Quit ⌘Q) and an Edit menu with the standard roles. Without the Edit menu, ⌘C, ⌘V, ⌘X, ⌘A and ⌘Z do nothing in text boxes.
  - After adding it, check that the editor's own ⌘Z, ⌘C and ⌘V still act on clips. They're handled in the page at `src/js/app.js:365` and `:398`.
- **Shortcut labels.** The shortcut handler already accepts ⌘ (`e.ctrlKey || e.metaKey`), but the labels say "Ctrl+…":
  - menus at `src/js/app.js:83-125`;
  - the timeline right-click menu at `src/js/ui/timeline.js:490-508`;
  - the Keyboard shortcuts window at `src/js/app.js:318`.

  Use one helper that shows ⌘, ⇧ and ⌥ on macOS and leaves Linux unchanged.
- **Click modifiers.** `src/js/ui/timeline.js:459` adds to the selection with Shift or Ctrl. On a Mac, Ctrl-click is a right-click, so accept ⌘ there too, as line 383 already does. Timeline zoom (`timeline.js:125`) uses `ctrlKey`, which trackpad pinch already sends. ⌘ + scroll would be a nice extra.

### 5. Fonts

The font list (`src/js/util.js:214`) includes Noto Sans, DejaVu Serif and Liberation Mono, which come with Ubuntu but not with macOS. Bundle all three in `src/fonts/` and `src/css/fonts.css`, so projects look the same on both systems. Their licences allow it: OFL for Noto and Liberation, and DejaVu's own free licence. Add each licence next to `OFL.txt`.

### 6. Packaging

- **Builder.** Add `electron-builder` as a devDependency, with a `build` section in `package.json`. `build-deb.sh` strips `devDependencies` and `scripts` and doesn't use `build`, so Linux is unaffected.
- **Target.** A `.dmg` for Apple Silicon. Ask the owner whether Intel Macs matter; if they do, make a universal build or a second `.dmg`.
- **App ID.** `io.github.webhookstudios.Current`, the same ID Linux uses.
- **Icon:**
  - Build an `.icns` from `data/io.github.webhookstudios.Current.svg` at 1024 px.
  - The logo is already a rounded square. Keep it on macOS's standard rounded-square grid, or recent macOS shows it on a grey tile.
  - Only `data/…Current.png` (256 px) exists today, which is too small.
- **File type.** Register the `.splice` project type with `fileAssociations` (name "Current project").
  - Linux doesn't open a project passed to the app at launch yet.
  - If you add `app.on('open-file')` for double-clicking projects in Finder, keep it Mac-only, or add the same behaviour for Linux's argv in a way the Linux tests cover.
- **Signing:**
  - Without an Apple Developer account, the app runs on this Mac (ad-hoc signed). Anyone who downloads it will see macOS block it.
  - Shipping it to other people needs Developer ID signing and notarization: an Apple Developer account at $99 a year, hardened runtime, and entitlements for JIT, microphone and camera.
  - **Ask the owner before anything that costs money.**
  - An unsigned app built during development may lose its Screen Recording permission after each rebuild. That's expected.
- **Leave as they are:** user data goes to `~/Library/Application Support/Current` and exports to `~/Movies`. Electron's paths already do this.

## Testing

1. Test media:
   - `tests/make-media.sh` uses GStreamer.
   - Add an ffmpeg branch that writes the same four files (`test1.mp4`, `test2.mp4`, `green.mp4`, `photo.png`), with the same sizes, lengths and patterns as the GStreamer lines.
2. Run every suite. Keep the Mac display awake and unlocked, because tests take screenshots of the window.
   - These run with no setup: `smoke`, `titles-audit`, `text-fit`, `pro-packs`, `pro-ui`, `brand`, `audio-tools`, `zoom-shape`, `ui`, `ui2`, `ui3`, `navigation`, `favorites` and `sections`.
   - `CURRENT_RECORDING_DIR=tests/out/recordings npx electron . --selftest=tests/screenrec.js --use-fake-device-for-media-stream`
   - `CURRENT_FAKE_WHISPER=tests/fixtures/whisper-words.json npx electron . --selftest=tests/captions.js`
   - `CURRENT_VOICEOVER_DIR=tests/out/voiceovers npx electron . --selftest=tests/voiceover.js --use-fake-device-for-media-stream`
   - `captions-real` needs a narrated video linked as `tests/out/speech.mp4` (see the README).
3. `smoke.js` and `ui.js` export video. They must pass using ffmpeg.
4. Also check by hand in the packaged `.app`:
   - Exported files open in the Mac's built-in player, with the picture the right way up and the sound in sync.
   - A real screen recording and webcam recording work.
   - Real captions on a short clip work.
   - Copy and paste work in text boxes.
5. Before opening the pull request, confirm that a Linux-only code path is unchanged wherever you touched shared code. The Linux session will rerun all the suites on Ubuntu.

## Releasing (only when the owner says yes)

- The Mac `.dmg` is attached to the same GitHub release as the Ubuntu `.deb`, for example `gh release upload v1.6.0 dist/Current-1.6.0-arm64.dmg --repo webhookstudios/current`.
- The owner signs in to `gh` on the Mac themselves.
- Don't create or edit releases otherwise. Don't touch the website.
- Add a Mac section to the README (install, requirements, building the `.dmg`) in the same pull request.

## Questions to ask the owner early

1. Is there an Apple Developer account for signing, or is this for personal use first?
2. Apple Silicon only, or Intel Macs too?
3. Bundle the captions engine (recommended), or ask Mac users to install it?
