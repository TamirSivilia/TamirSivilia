#!/bin/sh
# Free local placeholder clips + click-track "song" to test the pipeline (no paid calls).
set -e; cd "$(dirname "$0")/.."; mkdir -p build/ph
for i in 01 02 03 04 05 06 07 08 09 10; do
  ffmpeg -y -hide_banner -loglevel error -f lavfi -i "testsrc2=s=720x1280:d=5:r=24" build/ph/scene_$i.mp4
done
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=f=440:d=60" build/ph/song.wav
