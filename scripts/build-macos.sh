#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname -s)" != Darwin ]]; then
  echo "El paquete de escritorio se compila en macOS con Xcode Command Line Tools." >&2
  exit 1
fi

npm run build
version="$(node -p "require('./package.json').version")"
work="$(mktemp -d "${TMPDIR:-/tmp}/forma-build.XXXXXX")"
trap 'rm -rf "$work"' EXIT
export CLANG_MODULE_CACHE_PATH="$PWD/release/.module-cache"
mkdir -p "$CLANG_MODULE_CACHE_PATH"
app="$work/FORMA.app"
resources="$app/Contents/Resources"
mkdir -p "$app/Contents/MacOS" "$resources/web"
ditto dist "$resources/web"
cp LICENSE "$resources/LICENSE"
cp macos/Info.plist "$app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${version%%-*}" "$app/Contents/Info.plist"

xcrun swiftc -module-cache-path "$CLANG_MODULE_CACHE_PATH" macos/icon.swift -o "$work/forma-icon"
"$work/forma-icon" "$work/icon.png"
for size in 16 32 64 128 256 512 1024; do
  sips -z "$size" "$size" "$work/icon.png" --out "$work/$size.png" >/dev/null
done
node scripts/make-icns.mjs "$work" "$resources/FORMA.icns"
for arch in arm64 x86_64; do
  xcrun swiftc -O -target "$arch-apple-macos13.0" -module-cache-path "$CLANG_MODULE_CACHE_PATH" macos/main.swift -o "$work/FORMA-$arch"
done
xcrun lipo -create "$work/FORMA-arm64" "$work/FORMA-x86_64" -output "$app/Contents/MacOS/FORMA"
codesign --force --sign - "$app"
codesign --verify --strict "$app"

if [[ -d release/FORMA.app ]]; then
  mv release/FORMA.app "$work/previous.app"
fi
ditto "$app" "release/FORMA.app"
ditto -c -k --sequesterRsrc --keepParent "$app" "release/FORMA-$version-macOS-universal.zip"
echo "Aplicación y ZIP disponibles en release/"
