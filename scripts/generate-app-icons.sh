#!/bin/sh
# macOS sips: resize the exact approved symbol already used by BrandLogo.
# No cropping, tracing, color changes, transparency or pre-rounded corners.
set -eu
cd "$(dirname "$0")/.."
icon_temp=$(mktemp -d)
trap 'rm -rf "$icon_temp"' EXIT
make_icon() {
  icon_size=$1
  artwork_height=$2
  icon_output=$3
  sips -Z "$artwork_height" public/brand/option-b-tower.png --out "$icon_temp/art.png" >/dev/null
  sips -p "$icon_size" "$icon_size" --padColor 101923 "$icon_temp/art.png" --out "public/$icon_output" >/dev/null
}
make_icon 192 150 app-icon-192.png
make_icon 512 400 app-icon-512.png
# The entire 260x307 artwork rectangle fits in the radius-204.8px safe circle.
make_icon 512 307 app-icon-maskable-512.png
make_icon 180 140 apple-touch-icon.png
