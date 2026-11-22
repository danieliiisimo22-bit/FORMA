# FORMA de escritorio

El lanzador Rust sirve los archivos embebidos en `http://127.0.0.1:56144/` y abre el navegador predeterminado. Deja la terminal abierta mientras trabajas y usa `Ctrl+C` para cerrar. `--no-open` inicia solo el servidor y `--version` imprime la versión. El puerto predeterminado conserva el origen de almacenamiento de las versiones portables de FORMA 1.1.

## Ejecutar los portables

Extrae el ZIP de tu plataforma. En Windows x64, abre **Iniciar FORMA.cmd** o **forma.exe**. En Linux x64 y macOS 13+, ejecuta `./forma` desde el directorio extraído. En macOS hay compilaciones separadas para Apple Silicon e Intel. Si el extractor omite los permisos en Unix, usa `chmod +x forma`. Los binarios de macOS están publicados como vista previa sin notarización de Apple. [Paquetes](https://github.com/danieliiisimo22-bit/FORMA/releases/tag/v1.2.0-preview.2)

## Compilar

Instala Rust estable con rustup, el compilador del sistema y las herramientas siguientes.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --locked --version 0.2.130
cargo run --locked -p forma-build -- desktop
```

En Windows se requiere Visual Studio Build Tools con C++ y Windows SDK. Usa `Preparar.ps1` y `Compilar.ps1` desde PowerShell. En macOS se requieren las herramientas de línea de comandos de Xcode. El ejecutable queda en `target/release/`.

El comando `cargo run --locked -p forma-build -- web` compila solo el sitio. Sirve `target/forma-web/` por HTTP con el tipo `application/wasm` para WebAssembly. Las pruebas de navegador usan Playwright y ejecutan el portable en un puerto de prueba independiente.

## Empaquetar

El empaquetador también está escrito en Rust. Una vez disponibles los cuatro ejecutables, `cargo run --locked -p forma-build -- package` crea los ZIP y las sumas SHA-256 en `release/<versión>/`. Usa `target/release/forma.exe` para Windows o el binario bajo su target MSVC y espera los demás en los targets `aarch64-apple-darwin`, `x86_64-apple-darwin` y `x86_64-unknown-linux-musl`. El workflow compila en ejecutores nativos de cada arquitectura. [GitHub Actions](../.github/workflows/desktop.yml)

## Conservar la biblioteca

La versión conserva el esquema 1 de receta, biblioteca y paleta. Usa **Mis recetas → Exportar biblioteca** para guardar una copia y **Importar JSON** para llevarla a otro navegador o equipo. La importación comprueba límites y nombres repetidos antes de guardar toda la colección.
