#!/bin/sh
# Generates the sample clips the self-tests use (needs GStreamer).
set -e
D="$(cd "$(dirname "$0")" && pwd)/media"
mkdir -p "$D" "$(dirname "$D")/out"
gst-launch-1.0 -q -e videotestsrc num-buffers=600 pattern=ball ! video/x-raw,width=1920,height=1080,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast key-int-max=60 ! mp4mux name=m ! filesink location="$D/test1.mp4" audiotestsrc num-buffers=900 freq=440 volume=0.2 ! audio/x-raw,rate=44100 ! audioconvert ! avenc_aac ! m.
gst-launch-1.0 -q -e videotestsrc num-buffers=300 pattern=smpte ! video/x-raw,width=1280,height=720,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast ! mp4mux ! filesink location="$D/test2.mp4"
gst-launch-1.0 -q -e videotestsrc num-buffers=150 pattern=ball background-color=0xff00c040 foreground-color=0xffff3060 ! video/x-raw,width=1280,height=720,framerate=30/1 ! videoconvert ! x264enc speed-preset=ultrafast ! mp4mux ! filesink location="$D/green.mp4"
gst-launch-1.0 -q videotestsrc num-buffers=1 pattern=pinwheel ! video/x-raw,width=1600,height=1200 ! pngenc ! filesink location="$D/photo.png"
# analysis.mp4 (10 s) for the assistant's media analysis: 0-4 s sharp checkers with a 440 Hz tone,
# 4-6 s black and silent, 6-10 s blurred colour bars with a 660 Hz tone. So: cuts at 4 and 6, dark and
# quiet from 4 to 6, soft from 6 to 10.
V='video/x-raw,format=I420,width=640,height=360,framerate=30/1'
A='audio/x-raw,format=S16LE,rate=44100,channels=1,layout=interleaved'
gst-launch-1.0 -q -e \
  concat name=vc ! videoconvert ! x264enc speed-preset=ultrafast key-int-max=30 ! queue ! mp4mux name=mux ! filesink location="$D/analysis.mp4" \
  concat name=ac ! audioconvert ! avenc_aac ! queue ! mux. \
  videotestsrc num-buffers=120 pattern=checkers-8 ! $V ! vc. \
  videotestsrc num-buffers=60 pattern=black ! $V ! vc. \
  videotestsrc num-buffers=120 pattern=smpte ! videoconvert ! gaussianblur sigma=6 ! videoconvert ! $V ! vc. \
  audiotestsrc num-buffers=40 samplesperbuffer=4410 freq=440 volume=0.3 ! $A ! ac. \
  audiotestsrc num-buffers=20 samplesperbuffer=4410 wave=silence ! $A ! ac. \
  audiotestsrc num-buffers=40 samplesperbuffer=4410 freq=660 volume=0.3 ! $A ! ac.
echo "Test media written to $D"
