#!/bin/bash

set -euo pipefail

echo "Removing old zip file..."
rm -f scryfall-context-menu.zip

echo "Creating new zip file..."
zip -r scryfall-context-menu.zip \
  manifest.json \
  background.js \
  icon-{16,48,128}.png
