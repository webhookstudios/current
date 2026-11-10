#!/bin/sh
# Generates the sample clips the self-tests use (needs GStreamer).
set -e
D="$(cd "$(dirname "$0")" && pwd)/media"
mkdir -p "$D" "$(dirname "$D")/out"
gst-launch-1.0 -q -e videotestsrc num-buffers=600 pattern=ball ! video/x-raw,width=1920,height=1080,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast key-int-max=60 ! mp4mux name=m ! filesink location="$D/test1.mp4" audiotestsrc num-buffers=900 freq=440 volume=0.2 ! audio/x-raw,rate=44100 ! audioconvert ! avenc_aac ! m.
gst-launch-1.0 -q -e videotestsrc num-buffers=300 pattern=smpte ! video/x-raw,width=1280,height=720,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast ! mp4mux ! filesink location="$D/test2.mp4"
gst-launch-1.0 -q -e videotestsrc num-buffers=150 pattern=ball background-color=0xff00c040 foreground-color=0xffff3060 ! video/x-raw,width=1280,height=720,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast ! mp4mux ! filesink location="$D/green.mp4"
gst-launch-1.0 -q videotestsrc num-buffers=1 pattern=pinwheel ! video/x-raw,width=1600,height=1200 ! pngenc ! filesink location="$D/photo.png"
echo "Test media written to $D"
