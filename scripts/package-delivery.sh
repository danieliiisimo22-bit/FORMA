#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(node -p "require('./package.json').version")"
app="release/FORMA.app"
native="FORMA-$version-macOS-universal.zip"
delivery="FORMA-$version-GitHub-y-macOS.zip"
codesign --verify --strict "$app"
test -f "release/$native"

work="$(mktemp -d "${TMPDIR:-/tmp}/forma-delivery.XXXXXX")"
trap 'rm -rf "$work"' EXIT
root="$work/FORMA-$version"
source="$root/codigo-fuente"
mkdir -p "$source"
for item in .github .gitattributes .gitignore LICENSE README.md README.en.md docs macos scripts public src tests index.html package.json package-lock.json playwright.config.ts tsconfig.json vite.config.ts; do
  ditto "$item" "$source/$item"
done
ditto "$app" "$root/FORMA.app"
cat > "$root/LEEME.txt" <<'README'
FORMA — Generative Art Studio

• Abre FORMA.app en macOS 13 o posterior. Compatibilidad de compilación:
  Apple silicon e Intel. La app lleva todos sus recursos y funciona sin Node.js.
• codigo-fuente/ contiene el repositorio listo para GitHub. Empieza por README.md.
• Los datos del repositorio y la vista social están en codigo-fuente/docs/github.md.
• El paquete de macOS tiene firma ad hoc y carece de notarización de Apple.
README
ditto -c -k --sequesterRsrc --keepParent "$root" "release/$delivery"
(cd release && shasum -a 256 "$delivery" "$native" > SHA256SUMS.txt)
