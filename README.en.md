# FORMA — Generative Art Studio

A local procedural art studio for abstract compositions and wallpapers. **Rust** implements the UI, the 22 generators, color and palettes, the library, and the export pipeline. The browser runs the studio as **WebAssembly**. WebGL2 uses GLSL shaders, with a Canvas 2D fallback backed by the same Rust engine. The Rust launcher embeds all studio assets.

[Español](README.md) · [Downloads](https://github.com/danieliiisimo22-bit/FORMA/releases/tag/v1.2.0-preview.1) · [MIT license](LICENSE)

![The FORMA studio with its canvas, library, and controls](docs/validacion/estudio.png)

Download the ZIP for Windows x64, macOS 13+ (Apple Silicon or Intel), or Linux x64. Extract it and launch `forma.exe` on Windows or run `./forma` in a terminal on macOS or Linux. Keep the terminal open while using the studio at `http://127.0.0.1:56144/`. The macOS binaries are previews distributed without Apple notarization. [Desktop guide](docs/desktop.md)

Pick a style in **Biblioteca** and adjust its controls in **Simple** or **Estudio**. FORMA includes deterministic seeds, 36 palettes, per-color and parameter locks, favorites, and side-by-side comparison. It imports existing schema 1 recipes and libraries and exports PNG, JPEG, or WebP in 8-bit sRGB. [Gallery](docs/validacion/galeria.png) · [Generator catalog](docs/generators.md)

With stable Rust, run:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --locked --version 0.2.130
cargo test --locked -p forma-core
cargo run --locked -p forma-build -- desktop
```

Node.js is required for the optional Playwright browser tests. [Architecture](docs/architecture.md) · [Validation](docs/validation.md) · [Roadmap](docs/roadmap.md)
