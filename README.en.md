# FORMA — Generative Art Studio

The 1.1 preview adds a Rust desktop launcher and a Rust/WebAssembly seed routine. See the [desktop guide (Spanish)](docs/desktop.md).

A browser studio for procedural abstract art. Generate and export images locally with deterministic WebGL2 rendering and a Canvas 2D fallback. FORMA runs without accounts, telemetry, external services, or generative AI.

[README en español](README.md) · [Architecture](docs/architecture.md) · [Generators](docs/generators.md) · [Validation](docs/validation.md)

![FORMA desktop studio](docs/validacion/estudio.png)

**Primary language:** TypeScript. The graphics engine uses GLSL and the macOS app uses Swift and WebKit.

[macOS installation](docs/macos.md) · [GitHub repository metadata](docs/github.md) · [Artwork gallery](docs/validacion/galeria.png)

## Getting started

Use Node.js 20.19 or 22.12 or later, and a modern browser.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. The interface is in Spanish. Choose a family in **Biblioteca** and use the row chevron to reveal alternate styles. Adjust color, complexity, symmetry and texture in **Simple**, or switch to **Estudio** for per-generator controls.

- **Generar** changes the seed while keeping your settings. **Nueva variante** also nudges parameters. **Explorar** ranges within the family. **Sorpréndeme** changes families and can pick a different palette.
- **Variantes** and **Mutar composición** create 4, 9, or 16 descendants. Select a thumbnail to open it or use **Comparar composiciones** for side-by-side comparison.
- The palette editor includes 32 curated palettes, per-color locks, direct HEX editing, extraction from an artwork, and custom palettes.
- Use the heart to favorite a composition and **Mis recetas** to save a named preset or transfer your collection as JSON. Browser storage retains the most recent session, visual history, favorites, presets, and palettes.
- **Exportar** downloads a rendered image. **Exportar receta** downloads the editable procedure as JSON.

## Build and test

```sh
npm run build
npm run preview
npm test
npx playwright install chromium
npm run test:e2e
npm run test:gallery
```

Serve the generated `dist/` directory over HTTP to enable the export worker. Once dependencies are installed, the local server works offline. The browser tests use Google Chrome on macOS when installed in `/Applications`. Set `FORMA_BROWSER=chromium` to select Playwright Chromium or `FORMA_BROWSER=chrome` to select an installed Chrome on another system.

## Export

Images use 8-bit sRGB PNG, JPEG, or WebP. Presets use nominal short sides of 1080, 1440, 2160, and 4320 pixels, adjusted to fit the chosen aspect ratio and memory bounds. Custom export supports up to 8192 px per side and 34 megapixels. Browser support and available memory can lower the practical limit. Output is rendered directly at the final pixel dimensions.

The initial library covers 12 generators across seven families. See the [catalog](docs/generators.md) for supported effects and planned extensions. Released under the [MIT license](LICENSE).
