#!/bin/sh
# Rebuild the clean SVG identity and opaque ivory-on-navy phone icons on macOS.
set -eu
cd "$(dirname "$0")/.."
node scripts/generate-brand-assets.mjs
icon_cache=$(mktemp -d)
trap 'rm -rf "$icon_cache"' EXIT
CLANG_MODULE_CACHE_PATH="$icon_cache" swift -module-cache-path "$icon_cache" scripts/generate-app-icons.swift
