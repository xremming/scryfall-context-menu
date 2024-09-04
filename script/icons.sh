#!/bin/bash

set -euo pipefail

echo "Removing old icons..."
rm -f icon-*.png

echo "Downloading latest icon..."
curl https://scryfall.com/icon-512.png -o icon-512.png

echo "Generating matte for rounded corners..."
convert -size 512x512 xc:none -draw "roundrectangle 0,0,512,512,64,64" matte.png

echo "Generating icon-128.png..."
convert icon-512.png -matte matte.png \
  -gravity center -background none \
  -resize 96x96 -extent 128x128 \
  -compose DstIn -composite \
  -define png:exclude-chunks=date,time \
  icon-128.png

echo "Generating icon-48.png..."
convert icon-512.png -matte matte.png \
  -background none -resize 48x48 \
  -compose DstIn -composite \
  -define png:exclude-chunks=date,time \
  icon-48.png

echo "Generating icon-16.png..."
convert icon-512.png -matte matte.png \
  -background none -resize 16x16 \
  -compose DstIn -composite \
  -define png:exclude-chunks=date,time \
  icon-16.png
