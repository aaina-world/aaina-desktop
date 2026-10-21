#!/bin/sh
# A soft background pad for the demo video, made from plain sine tones with ffmpeg: no samples, nothing to license.
# Four slow chords (C maj7, A min7, F maj7, G6), each 8 s, crossfaded, looped to the length asked, with a gentle echo.
#   sh docs/tools/demo/music.sh <seconds> <out.wav>
set -e
LEN=${1:-200}
OUT=${2:-docs/tools/demo/out/music.wav}
TMP=$(mktemp -d)
chord() { # name f1 f2 f3 f4 f5
  expr=""
  for f in $2 $3 $4 $5 $6; do
    expr="${expr}${expr:++}sin(2*PI*$f*t)+0.6*sin(2*PI*$f*1.004*t)"
  done
  ffmpeg -v error -y -f lavfi -i "aevalsrc='0.045*($expr)*(0.85+0.15*sin(2*PI*0.2*t))':s=44100:d=9.5" \
    -af "afade=t=in:d=2.5,afade=t=out:st=6.5:d=3,lowpass=f=1800" "$TMP/$1.wav"
}
chord c 130.81 164.81 196.00 246.94 329.63
chord a 110.00 130.81 164.81 196.00 261.63
chord f 87.31 110.00 130.81 164.81 220.00
chord g 98.00 146.83 196.00 246.94 329.63
ffmpeg -v error -y -i "$TMP/c.wav" -i "$TMP/a.wav" -i "$TMP/f.wav" -i "$TMP/g.wav" -filter_complex \
  "[0][1]acrossfade=d=1.5[x];[x][2]acrossfade=d=1.5[y];[y][3]acrossfade=d=1.5[z]" \
  -map "[z]" "$TMP/loop.wav"
ffmpeg -v error -y -stream_loop -1 -i "$TMP/loop.wav" -t "$LEN" \
  -af "aecho=0.8:0.7:180|420:0.25|0.15,highpass=f=60,afade=t=in:d=3,afade=t=out:st=$((LEN-5)):d=5,aformat=channel_layouts=stereo" "$OUT"
rm -rf "$TMP"
echo "$OUT"
