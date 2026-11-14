#!/bin/sh
# Generates the sample clips the self-tests use (GStreamer on Linux, ffmpeg on macOS).
set -e
D="$(cd "$(dirname "$0")" && pwd)/media"
mkdir -p "$D" "$(dirname "$D")/out"
if [ "$(uname)" = Darwin ]; then
  R="$(cd "$(dirname "$0")/.." && pwd)"
  FF="${CURRENT_FFMPEG:-$R/vendor/mac/ffmpeg}"
  [ -x "$FF" ] || FF=ffmpeg
  Q="-hide_banner -loglevel error -y"
  "$FF" $Q -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=20" -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=20.9" -af volume=0.2 -c:v libx264 -preset ultrafast -g 60 -pix_fmt yuv420p -c:a aac "$D/test1.mp4"
  "$FF" $Q -f lavfi -i "smptebars=size=1280x720:rate=30:duration=10" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$D/test2.mp4"
  "$FF" $Q -f lavfi -i "color=c=0x00c040:size=1280x720:rate=30:duration=5,drawbox=x=560:y=280:w=160:h=160:color=0xff3060:t=fill" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$D/green.mp4"
  "$FF" $Q -f lavfi -i "testsrc=size=1600x1200:rate=1:duration=1" -frames:v 1 "$D/photo.png"
  echo "Test media written to $D"
  exit 0
fi
gst-launch-1.0 -q -e videotestsrc num-buffers=600 pattern=ball ! video/x-raw,width=1920,height=1080,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast key-int-max=60 ! mp4mux name=m ! filesink location="$D/test1.mp4" audiotestsrc num-buffers=900 freq=440 volume=0.2 ! audio/x-raw,rate=44100 ! audioconvert ! avenc_aac ! m.
gst-launch-1.0 -q -e videotestsrc num-buffers=300 pattern=smpte ! video/x-raw,width=1280,height=720,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast ! mp4mux ! filesink location="$D/test2.mp4"
gst-launch-1.0 -q -e videotestsrc num-buffers=150 pattern=ball background-color=0xff00c040 foreground-color=0xffff3060 ! video/x-raw,width=1280,height=720,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast ! mp4mux ! filesink location="$D/green.mp4"
gst-launch-1.0 -q videotestsrc num-buffers=1 pattern=pinwheel ! video/x-raw,width=1600,height=1200 ! pngenc ! filesink location="$D/photo.png"
echo "Test media written to $D"
