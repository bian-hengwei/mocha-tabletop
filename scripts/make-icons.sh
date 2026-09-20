#!/bin/sh
# Resize the approved Mocha illustration (macOS).
set -eu
cd "$(dirname "$0")/.."
for size in 180 192 512; do
  sips -z "$size" "$size" design/mocha-icon-1024.png --out "public/mocha-icon-$size.png" >/dev/null
done
