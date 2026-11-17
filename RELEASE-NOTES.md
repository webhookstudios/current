# Current 1.7.0

Ask Claude to edit your video, or to build a first cut from your own clips. Also: a new music engine, a cleaner start screen and a more polished look.

**Assistant: edit with Claude**

- **Ask in plain words,** like "cut the long pauses and add the Boarding Pass intro" or "make it 30 seconds with upbeat music". Claude makes the changes in the open project while you watch, and Undo takes each request back in one step.
- **A first cut from your media.** Add your videos, photos and sound to Project Media and press **Make a first cut…**. Say what the video is; length, mood and what to include are optional. Claude looks through every file and builds the video for you to tweak:
  - it picks the best moments, puts them in order and trims them;
  - it adds an intro and outro, titles, music, transitions and captions.
- **Two ways to use it:**
  - **The Assistant panel**, the speech bubble at the top right, with your own Claude API key. The key is kept encrypted with your system's keyring, and requests are billed to your Claude developer account. Each step shows as it happens, then what changed and roughly what it cost.
  - **Claude's own apps, with your Claude plan.** Switch on Tools › Assistant › **Let Claude edit in Current**, then use Claude's desktop app (install the connector file it saves) or Claude Code (copy the one-line command). There is a ready-made **First cut** prompt.
- **What Claude sees:** what you ask, the project outline (clip and file names, times, texts and captions), transcripts and the still frames it asks for. Your video and sound files stay on your computer. Shots, dark, blurry and shaky parts, quiet stretches and transcripts are all worked out here. Claude can't export, save or delete files. The README's Privacy section has the details.

**Music**

- **A new music engine.** All 50 tracks were remade with real-sounding instruments (guitars, pianos, strings, brass, bells and more), proper drum kits, verses and choruses, and tunes of their own. Track names and lengths are unchanged, so existing projects keep working.

**Look**

- **A cleaner start screen.** The aspect ratio picker sits in the middle, with New Project and Open Project at the bottom. What's new moved to the Help menu.
- **A more polished look:** softer buttons, rounder menus and dialogs, a grouped aspect ratio picker, rounded library tabs and thin scrollbars.

**Fixes**

- The timeline zoom slider's blue part now follows its handle.
- The Export window no longer shows the word "null" when a project has no captions.

Install:

```bash
sudo apt install ./current_1.7.0_amd64.deb
```
