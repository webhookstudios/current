// Current: encoder backends. Linux uses the system GStreamer (gst-launch-1.0); macOS uses a bundled ffmpeg.
// Each backend turns a job into { cmd, args } for main.js to spawn. The Linux backend is the original pipeline text, unchanged.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

const IS_MAC = process.platform === 'darwin';

// ---------- GStreamer (Linux) ----------
const gstQuote = (p) => `"${String(p).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const gstSplit = (desc) => desc.split(/ (?=(?:[^"]*"[^"]*")*[^"]*$)/);

const gst = {
  name: 'GStreamer',
  cmd: () => 'gst-launch-1.0',

  exportArgs(o) {
    const loc = gstQuote(o.path);
    const raw = `fdsrc fd=0 blocksize=${o.width * o.height * 4} ! queue max-size-buffers=8 ! rawvideoparse width=${o.width} height=${o.height} format=rgba framerate=${o.fps}/1 ! videoconvert ! videoflip method=vertical-flip`;
    const q = { high: 17, medium: 21, low: 26 }[o.quality] ?? 21;
    const audio = o.audioPath ? `filesrc location=${gstQuote(o.audioPath)} ! wavparse ! audioconvert ! audioresample ! audio/x-raw,rate=48000,channels=2` : null;
    const parts = [];
    if (o.format === 'mp3') {
      parts.push(`${audio} ! lamemp3enc target=bitrate bitrate=256 cbr=true ! filesink location=${loc}`);
    } else if (o.format === 'webm') {
      const cpu = { high: 2, medium: 4, low: 6 }[o.quality] ?? 4;
      const br = Math.round(o.width * o.height * o.fps * ({ high: 0.12, medium: 0.07, low: 0.04 }[o.quality] ?? 0.07) / 1000);
      parts.push(`${raw} ! video/x-raw,format=I420 ! vp9enc deadline=1 cpu-used=${cpu} row-mt=true threads=${Math.max(2, os.cpus().length - 1)} target-bitrate=${br * 1000} end-usage=vbr keyframe-max-dist=${o.fps * 4} ! queue ! webmmux name=m ! filesink location=${loc}`);
      if (audio) parts.push(`${audio} ! opusenc bitrate=160000 ! queue ! m.`);
    } else if (o.format === 'mov' || o.format === 'mp4') {
      const mux = o.format === 'mov' ? 'qtmux' : 'mp4mux';
      const preset = { high: 'slow', medium: 'medium', low: 'veryfast' }[o.quality] ?? 'medium';
      parts.push(`${raw} ! video/x-raw,format=I420 ! x264enc speed-preset=${preset} pass=qual quantizer=${q} key-int-max=${o.fps * 2} threads=0 ! video/x-h264,profile=high ! queue ! ${mux} name=m faststart=true ! filesink location=${loc}`);
      if (audio) parts.push(`${audio} ! avenc_aac bitrate=256000 ! queue ! m.`);
    }
    return ['-q', '-e', ...gstSplit(parts.join(' '))];
  },

  proxyArgs(src, tmp, withAudio) {
    const args = ['-q', '-e',
      `filesrc location=${gstQuote(src)} ! decodebin name=d`,
      `d. ! queue ! videoconvert ! video/x-raw,format=I420 ! x264enc speed-preset=veryfast pass=qual quantizer=20 key-int-max=30 ! queue ! mp4mux name=m faststart=true ! filesink location=${gstQuote(tmp)}`];
    if (withAudio) args.push('d. ! queue ! audioconvert ! audioresample ! audio/x-raw,rate=48000 ! avenc_aac bitrate=192000 ! queue ! m.');
    return gstSplit(args.join(' '));
  },

  remuxArgs(raw, out) {
    const desc = `filesrc location=${gstQuote(raw)} ! matroskademux name=d matroskamux name=m ! filesink location=${gstQuote(out)} d.video_0 ! video/x-vp8 ! queue ! m.`;
    return ['-q', '-e', ...gstSplit(desc)];
  },

  check: () => new Promise((resolve) => {
    execFile('gst-inspect-1.0', ['x264enc'], (err) => resolve(!err));
  }),
};

// ---------- ffmpeg (macOS) ----------
// The packaged app carries ffmpeg in Contents/Resources/bin; from a checkout it is vendor/mac/ffmpeg
// (see scripts/mac-tools.sh). CURRENT_FFMPEG overrides both, and a plain `ffmpeg` on PATH is the last resort.
function ffmpegPath() {
  const cands = [];
  if (process.env.CURRENT_FFMPEG) cands.push(process.env.CURRENT_FFMPEG);
  if (process.resourcesPath) cands.push(path.join(process.resourcesPath, 'bin', 'ffmpeg'));
  cands.push(path.join(__dirname, 'vendor', 'mac', 'ffmpeg'));
  return cands.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || 'ffmpeg';
}

const FF_BASE = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'];
// pipe:0 carries the frames, so -nostdin must not be used for exports.
const FF_EXPORT_BASE = ['-hide_banner', '-loglevel', 'error', '-y'];

const ffmpeg = {
  name: 'ffmpeg',
  cmd: () => ffmpegPath(),

  exportArgs(o) {
    const q = { high: 17, medium: 21, low: 26 }[o.quality] ?? 21;
    const args = [...FF_EXPORT_BASE];
    if (o.format === 'mp3') {
      args.push('-i', o.audioPath, '-vn', '-c:a', 'libmp3lame', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-f', 'mp3', o.path);
      return args;
    }
    // Frames arrive as raw RGBA, bottom row first.
    args.push('-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${o.width}x${o.height}`, '-r', String(o.fps), '-i', 'pipe:0');
    if (o.audioPath) args.push('-i', o.audioPath);
    args.push('-map', '0:v:0');
    if (o.audioPath) args.push('-map', '1:a:0');
    args.push('-vf', 'vflip,format=yuv420p');
    if (o.format === 'webm') {
      const cpu = { high: 2, medium: 4, low: 6 }[o.quality] ?? 4;
      const br = Math.round(o.width * o.height * o.fps * ({ high: 0.12, medium: 0.07, low: 0.04 }[o.quality] ?? 0.07) / 1000);
      args.push('-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', String(cpu), '-row-mt', '1',
        '-threads', String(Math.max(2, os.cpus().length - 1)), '-b:v', `${br}k`, '-g', String(o.fps * 4));
      if (o.audioPath) args.push('-c:a', 'libopus', '-b:a', '160k', '-ar', '48000', '-ac', '2');
      args.push('-f', 'webm');
    } else {
      const preset = { high: 'slow', medium: 'medium', low: 'veryfast' }[o.quality] ?? 'medium';
      args.push('-c:v', 'libx264', '-preset', preset, '-crf', String(q), '-g', String(o.fps * 2), '-profile:v', 'high');
      if (o.audioPath) args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2');
      args.push('-movflags', '+faststart', '-f', o.format === 'mov' ? 'mov' : 'mp4');
    }
    args.push(o.path);
    return args;
  },

  proxyArgs(src, tmp, withAudio) {
    const args = [...FF_BASE, '-i', src, '-map', '0:v:0'];
    if (withAudio) args.push('-map', '0:a:0?');
    args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-g', '30');
    if (withAudio) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
    else args.push('-an');
    args.push('-movflags', '+faststart', '-f', 'mp4', tmp);
    return args;
  },

  remuxArgs(raw, out) {
    return [...FF_BASE, '-i', raw, '-map', '0:v:0', '-c', 'copy', '-f', 'webm', out];
  },

  // True when this ffmpeg has every encoder Current uses.
  check: () => new Promise((resolve) => {
    execFile(ffmpegPath(), ['-hide_banner', '-encoders'], { maxBuffer: 1 << 22 }, (err, out) => {
      resolve(!err && ['libx264', 'libvpx-vp9', 'libopus', 'libmp3lame', ' aac '].every((e) => String(out).includes(e)));
    });
  }),
};

module.exports = { ...(IS_MAC ? ffmpeg : gst), IS_MAC, gstQuote };
