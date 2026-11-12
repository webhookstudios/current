# Current

*Part of the Sedge family of webhookstudios apps.*

A video editor built around ready-made templates. Drag animated titles, transitions, effects, colour filters, stickers, backgrounds, music and sound effects onto a multi-track timeline, layer clips with green screen and picture-in-picture, clean up audio, and export to MP4, MOV, WebM or MP3.

![The Current editor](docs/screenshots/editor.png)

## What's in the box

| Library | Count | Examples |
|---|---|---|
| Starter templates | 12 | YouTube vlog, travel montage, travel highlights, product promo, tutorial, podcast clip (1:1), reel/short (9:16), birthday, family memories, gaming highlights, wedding, year in review |
| Sequences | 280 | Ready-made pieces built from separate clips, so every text, number and piece can be edited and moved. **Intros** and **Outros** (40 each), including fifteen professional pairs where each intro has a matching outro: Block Reveal, Lesson Opener, Side Panel, Line Frame, Bold Bands, Chart Rise, Chapter Number, Monogram, Shutter, and six charts (Line Climb, Donut Fill, Big Number, Stacked Columns, Ranking Bars, Milestone Timeline). **Education** mid-rolls (40): Lesson Agenda and Recap, Key Term, Quick Quiz, True or False, Step by Step, Formula, Worked Example, Activity Timer (a real countdown for any length), Exit Ticket, Fill in the Blank, Myth vs Fact and more. **Professional** mid-rolls (40): Big Number, Before / After, Roadmap, Team Member, Customer Quote, Pricing Plans, FAQ, Do’s and Don’ts, Action Items, Why Choose Us, Visit Us, Special Offer, SWOT, Event Date and more, none with charts that would need real company numbers. **News**, **Gaming** and **Travel** (40 each): ten intros with matching outros and twenty mid-rolls in each, from Breaking Bulletin, Weather Forecast and Fact Check to Press Start, Patch Notes and Tier List, and Boarding Pass, Packing List and Local Phrase |
| Titles | 105 | Openers, professional (with a matching lower third for each professional style), lower thirds, subtitles (incl. word highlight), social, callouts, quotes, countdowns, end credits |
| Transitions | 85 | Dissolves, dips, wipes, slides, whip pans, zooms, spins, 3D cube/flip/page turn, glitch, film burn, light leak, shapes |
| Effects | 55 | Blur, tilt shift, fisheye, VHS, old film, CRT, glitch, comic book, shake, mirror, kaleidoscope, rain, snow, dreamy glow |
| Filters | 50 | Cinematic, film stocks, vintage, black & white, moods, food & travel |
| Stickers | 100 | Animated emoji, 20 annotations (circles, highlighter, tooltips, star rating, spotlight…), 15 arrows (straight, double, block, elbow, U-turn, rotate, curved, neon, rainbow, sparkle trail…), confetti, frames |
| Backgrounds | 78 | Solid colours (incl. green/blue screen), gradients, radial glows, animated, patterns, scenes and textures |
| Audio | 80 | 50 music tracks and 30 sound effects, generated on first use |
| Fonts | 22 | Bundled display and script fonts for titles |

Every card animates when you hover over it, and the **+** button adds it at the playhead. Hover a music, sound or video card and press play to hear it first. Click the star on any card in Audio, Sequences, Titles, Transitions, Effects, Filters or Stickers to keep it in that tab’s **Favorites** group.

New projects start blank. The start screen also offers the 12 starter templates; pick one and drop your own clips onto its “Your clip” blocks.

![The start screen with starter templates](docs/screenshots/start.png)

## Editing

- **Multi-track timeline** with snapping, trimming, ripple delete, split (Ctrl+B), duplicate, copy/paste, marquee selection, undo/redo, and track hide, mute and lock.
- **Layering:** clips on higher tracks sit on top. Each clip has position, scale, rotation, flip, crop, opacity and 9 blend modes, with drag handles in the preview.
- **Crop** with drag handles in the preview, aspect presets (16:9, 9:16, 1:1…) and fill/fit after cropping.
- **Green screen / blue screen:** chroma key with tolerance (default 15), edge softness, spill removal and a colour picker that samples the preview.
- The move/resize box hugs the actual sticker or text, and scaling or rotating keeps it in place.
- **Every piece of a title is movable:** each line of text, bar and underline has its own dashed box in the preview. Drag one to move just that piece; Shift-drag moves the whole title.
- **Pick from preview** samples any pixel, including a keyed clip on top; one click picks and returns to normal, Esc cancels.
- **Picture in picture:** right-click a clip and choose *Picture in picture*, or use the corner presets in the Video tab.
- **Adjustment layers:** drop an effect or filter on an empty part of a track to apply it to everything below.
- **Zoom to area:** drag a box over the preview and the clip smoothly zooms into it and back out, like pointing at a menu in a screen recording. Each clip can have several zooms, each with its own start, length and ease.
- **Shapes:** show any video or photo as a rectangle, a rounded rectangle or a circle, with an outline in any colour.
- **Animation:** 14 entrance and exit motions and 9 continuous ones (Ken Burns, pan, pulse, float, shake…).
- **Speed** from 0.1× to 8×, freeze frame and colour correction (exposure, contrast, highlights, shadows, temperature, tint, hue, vignette, sharpen).

## Recording and captions

- **Record your screen** (Tools › Record screen, <kbd>Shift</kbd>+<kbd>R</kbd>, or the screen button above the timeline). Your desktop asks which screen or window to share. Add a webcam and it lands as a round, outlined bubble in the bottom-right corner; your microphone goes on its own audio track, marked as Voice. Current can hide itself while you record; stop from its floating panel, with Space, or with the stop button your desktop shows in the top bar. Recordings are saved in `~/Videos/Current recordings`.
- **Automatic captions** (Tools › Generate captions, or the **CC** button above the timeline). Speech is turned into captions on this computer with whisper.cpp, in 17 languages or detected automatically; nothing is uploaded. The speech model (60 MB, or 190 MB for the most accurate one) downloads once and is checked against its published checksum. Each caption appears as its words are spoken: word times come from whisper's alignment and are matched to the sound, so captions leave during pauses. Long sentences are split into even parts, so no word is left on its own. Captions use any subtitle style (Word Highlight lights up each word as it is spoken), and sit on their own Captions track.
- **Edit captions** fixes wording line by line, deletes lines and changes the style of all of them. Each caption is also a normal title you can move, retime or restyle.
- **Show captions** always on screen (burned in), as an `.srt` caption file saved next to the exported video for viewers to turn on, or both. Choose in the Tools menu, the captions window or Export.

## Brand kits

Save your colours, a heading font, a logo, your company name and initials as a brand kit. Keep as many kits as you like, pick the one in use from the Brand menu or the button in the top bar, or switch branding off entirely. While a kit is on, the titles, stickers and sequences you add take its colours and font (whites, blacks and greys stay, so text stays readable), the library previews show your look, and the Monogram intro and lower third use your initials. **Apply brand** recolours clips you already added, and **Add logo at playhead** puts your logo in the corner.

## Audio

![Audio tools](docs/screenshots/audio.png)

- **Record a voiceover** (<kbd>R</kbd>, or the microphone button above the timeline): pick your microphone and check its level, set a countdown (3 seconds unless you change it, 0 to start at once), then talk while the video plays from the playhead. A small panel shows the time, the level and **Stop recording**; drag it anywhere so it doesn't cover the picture. Space also stops. The take lands on a free audio track where you started, and is saved as a WAV file in `~/Videos/Current voiceovers`.
- Volume up to 400%, fade in and out, mute per clip or track, and **Normalize loudness** (peaks to −1 dB).
- **Noise removal** (light, medium, strong): spectral gating that learns the noise floor from the quietest parts of the clip and removes hum, hiss, fans and room tone.
- **Voice and effect presets:** voice enhance, podcast voice, telephone, old radio, megaphone, echo, small room, concert hall, cathedral, underwater, next room, bass boost, robot and lo-fi, each with a dry/wet mix.
- **Equalizer** (bass, mid, treble), low-cut filter and compressor.
- **Auto-ducking:** music dips while someone is talking and comes back up in the pauses. Every sound clip is marked Voice, Music or Sound effect (Current guesses: voiceovers, recordings and video sound are voice); music clips added from now on duck by default, by 12 dB unless you change it.
- **Remove pauses:** cut the quiet stretches out of a voiceover or talking-head clip in one go. A preview shades what will be cut; later clips on the same track move up to close the gaps.
- Split audio clips like any other clip, and **Detach audio** from a video to edit it on its own track.
- Speed changes keep the natural pitch.

## Requirements

- Ubuntu 24.04 or newer (tested on Ubuntu 26.04 with GNOME 50)
- A GPU with WebGL 2 (any driver from the last decade)
- GStreamer for export: `gstreamer1.0-plugins-good`, `-ugly` and `-libav` (the deb installs these)

Current has only been tested on Ubuntu 26.04.

## Install

### With the deb package (recommended)

Download `current_1.6.0_amd64.deb` from the [latest release](https://github.com/webhookstudios/current/releases/latest), then install it:

```bash
sudo apt install ./current_1.6.0_amd64.deb
```

Open **Current** from the apps menu. To remove it:

```bash
sudo apt remove current
```

### From source

```bash
git clone https://github.com/webhookstudios/current.git
```

```bash
cd current && npm install && ./install.sh
```

Or run it straight from the checkout with `npm start`.

## Using it

| To do this | Do this |
|---|---|
| Start a project | Pick an aspect ratio (16:9, 9:16 for Shorts and Reels, 1:1, 4:5, 4:3, 21:9) and click **New Project** |
| Add media | Click **Import**, or drop files on the library or straight onto the timeline |
| Add a template | Drag it to a track, or hover and click **+** |
| Add a transition | Drop it on the cut between two clips (or on a clip's start or end to fade from or to black) |
| Apply an effect or filter to one clip | Drop it on the clip |
| Edit a clip | Select it and use the panel on the right, or right-click it (or open the **Clip** menu) for everything you can do to it |
| Crop a clip | Select it, open **Crop**, and drag the handles in the preview |
| Key out a green screen | Put the clip on a track above the background, crop off anything the screen does not cover, then **Green Screen → Remove background colour** |
| Add an intro or outro | Open **Sequences** and click **+** (intros go first, outros go last). In News, Gaming and Travel they sit under their own headings |
| Add a mid-roll | Put the playhead where it should go, open **Sequences › Education**, **Professional**, or a mid-roll in **News**, **Gaming** or **Travel**, and click **+**: the clip under the playhead is split and everything after it moves along |
| Set a countdown | Add **Sequences › Education › Activity Timer**, select its title and type a time in **Timer length** (like 1:00, 5:00 or 10 min): it counts down in real time and anything after it moves along |
| Record a voiceover | Put the playhead where it should start, press **R** (or **Tools › Record voiceover**, or the microphone button above the timeline), pick your microphone, then **Start recording**. Press **Stop recording** or Space when you're done |
| Record your screen | Press **Shift+R** (or **Tools › Record screen**), choose a webcam and microphone, press **Start recording**, then pick the screen or window |
| Add captions | **Tools › Generate captions**, choose the language and style, and how to show them; fix any line in **Tools › Edit captions** |
| Use your brand | **Brand › Brand kits…**, make a kit, and switch it on |
| Zoom into part of a clip | Select it, **Clip › Zoom to area…**, **Add zoom at playhead**, and drag a box over the preview |
| Tighten a voiceover | Select it, **Clip › Remove pauses…** |
| Clean up a voice | Select the clip, **Audio → Noise removal**, then try **Voice Enhance** |
| Export | Click **Export**, pick a format, resolution, frame rate and quality |

Hover any button to see what it does; a greyed-out one also says what to select first. Press **?** in the app for all keyboard shortcuts, and see **Help › What’s new** for the newest features and where to find them.

## Building the package

```bash
npm install
```

```bash
./build-deb.sh
```

The package is written to `dist/`. It bundles Electron, so it is about 95 MB.

## Tests

```bash
./tests/make-media.sh
```

```bash
npx electron . --selftest=tests/smoke.js
```

Further tests: `tests/navigation.js` (menus, toolbar, hover tips and right-click items), `tests/text-fit.js` (every title, sticker and sequence keeps its text inside its bubble, also with longer words), `tests/brand.js`, `tests/audio-tools.js` (ducking and Remove pauses, measured on generated sound), `tests/zoom-shape.js`, `tests/pro-packs.js`, `tests/pro-ui.js`, `tests/favorites.js` (stars and Favorites groups) and `tests/sections.js` (News, Gaming and Travel headings, where + puts each kind, and the countdown’s time box). Screen recording and captions use simulated devices and a ready-made transcript:

```bash
CURRENT_RECORDING_DIR=tests/out/recordings npx electron . --selftest=tests/screenrec.js --use-fake-device-for-media-stream
```

```bash
CURRENT_FAKE_WHISPER=tests/fixtures/whisper-words.json npx electron . --selftest=tests/captions.js
```

To check real captions on any narrated video (needs `whisper.cpp`; downloads the 60 MB model the first time), link the video as `tests/out/speech.mp4`. The timing checks expect a sentence starting "Find the" at about 29.5 s, so change that check for another video:

```bash
npx electron . --selftest=tests/captions-real.js
```

To test voiceover recording with a simulated microphone:

```bash
CURRENT_VOICEOVER_DIR=tests/out/voiceovers npx electron . --selftest=tests/voiceover.js --use-fake-device-for-media-stream
```

The smoke test compiles every shader, draws every template at several points in time, builds a timeline with transitions, effects, music, noise removal and a title, and exports it through GStreamer.

## How it works

The editor is an Electron app. Each frame is composited in WebGL 2: every clip is placed into a frame-sized layer (transform, crop, chroma key), graded, run through its effects, mixed with its neighbour by a transition shader and blended onto the layers below. Titles, stickers and backgrounds are drawn with Canvas 2D. Audio plays through Web Audio effect chains. Export renders frame by frame with frame-exact seeking, mixes the audio offline through the same effect chains, and pipes raw frames and audio into GStreamer (x264, VP9, AAC, Opus, LAME).

## License

GPL-2.0-or-later. Bundled fonts are under the SIL Open Font License 1.1.
