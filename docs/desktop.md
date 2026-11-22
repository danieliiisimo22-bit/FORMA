# FORMA de escritorio

El lanzador Rust sirve los archivos embebidos en `http://127.0.0.1:56144/` y abre el navegador predeterminado. Deja la terminal abierta mientras trabajas y usa `Ctrl+C` para cerrar. `--no-open` inicia solo el servidor y `--version` imprime la versión.

Si el puerto está ocupado, el lanzador avisa y termina. Cierra la instancia anterior o selecciona otro puerto con `--port <puerto>`. El navegador mantiene una biblioteca independiente para cada puerto.

## Ejecutar los portables

Extrae el ZIP de tu plataforma. En Windows x64, abre **Iniciar FORMA.cmd** o **forma.exe**. En Linux x64 y macOS 13+, ejecuta `./forma` desde el directorio extraído. Si el extractor omite los permisos en Unix, usa `chmod +x forma`. Los ejecutables de Windows se distribuyen sin firma y los de macOS sin notarización. [Guía de macOS](macos.md)

## Verificar un ZIP

Sitúate en la carpeta de descarga. Calcula la suma del ZIP elegido y
compárala con la línea del mismo archivo en `SHA256SUMS.txt`.

| Sistema | Comando |
| --- | --- |
| Windows | `Get-FileHash -Algorithm SHA256 -LiteralPath '<archivo.zip>'` |
| macOS | `shasum -a 256 '<archivo.zip>'` |
| Linux | `sha256sum '<archivo.zip>'` |

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

La sesión, los favoritos, las recetas y las paletas se guardan en el navegador. Borrar los datos del sitio elimina la copia guardada allí. Usa **Mis recetas → Exportar biblioteca** para guardar un respaldo y **Importar JSON** para recuperarlo en otro puerto, navegador o equipo. La importación comprueba límites y nombres repetidos antes de guardar toda la colección.
