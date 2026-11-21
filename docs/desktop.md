# FORMA 1.1 · Vista previa de escritorio

FORMA se ejecuta como un servidor Rust que abre el navegador predeterminado en `http://127.0.0.1:56144`. El ejecutable incluye todos los recursos y puede funcionar sin conexión. Deja su ventana de terminal abierta mientras trabajas y usa `Ctrl+C` para cerrarlo. Si el navegador no se abre automáticamente, escribe la dirección en su barra.

## Windows

En el paquete portable Windows x64, abre **Iniciar FORMA.cmd** o **forma.exe**. No necesitas instalar Node.js ni Rust para ejecutar el paquete.

Para compilar desde el repositorio usa Node.js 22.12 o posterior, npm, Rust estable con rustup y Visual Studio Build Tools con el compilador C++ y el Windows SDK. En PowerShell, ejecuta desde la raíz:

```powershell
.\Preparar.ps1
.\Compilar.ps1
```

El ejecutable queda en `target/release/forma.exe`. La versión web de desarrollo se inicia con `npm run dev`.

## macOS y Linux

Con Node.js 22.12 o posterior, npm, Rust estable con rustup y el compilador del sistema, ejecuta:

```sh
rustup target add wasm32-unknown-unknown
npm ci
npm run build:desktop
./target/release/forma
```

En macOS instala primero las Command Line Tools de Xcode si faltan. En Linux el lanzamiento automático utiliza el navegador predeterminado de la sesión gráfica. El mismo ejecutable acepta `--no-open` para iniciar solo el servidor. Para ejecutar un binario descargado o extraído, verifica que tenga permiso de ejecución (`chmod +x forma`).

El [workflow de escritorio](../.github/workflows/desktop.yml) prepara artefactos para Windows x64, macOS Apple Silicon e Intel y Linux x64. La aplicación Swift/WebKit sigue disponible con `npm run build:macos`.

La entrega local incluye un ZIP de Windows x64 y archivos TAR.GZ para Linux x64 y macOS 13 o posterior, con paquetes separados para Apple Silicon e Intel. En Linux se comprobó el arranque y el contenido HTTP en WSL. En macOS se verificaron las arquitecturas de los binarios obtenidos por compilación cruzada. Queda pendiente probarlos en Mac y completar la firma de distribución.

## Bibliotecas y revisión en Windows

En **Mis recetas**, exporta la biblioteca del navegador o equipo anterior y usa **Importar JSON** en la nueva instancia. También puedes importar los archivos creados con **Exportar paleta**. El almacenamiento se comparte entre pestañas del mismo navegador y origen. La versión de escritorio usa un origen distinto del servidor de desarrollo y de la aplicación Swift, por lo que se transfiere la biblioteca por JSON.

Cada colección admite 96 elementos. Si una importación excede el límite o contiene un nombre existente con contenido distinto, FORMA muestra el motivo y conserva la biblioteca. Los nombres y contenidos idénticos se incorporan una sola vez.

Para la revisión de fondos, compara las familias y variantes en formatos horizontal, ultrapanorámico y vertical. Guarda las composiciones que usarías y comprueba su encuadre al exportarlas. Ese resultado alimentará las siguientes etapas del roadmap, junto con la recuperación de bibliotecas y la validación de sesiones largas.

## Alcance del port

Se utilizó [rust-anything 2.1.0](https://github.com/erkamyaman/rust-anything/tree/v2.1.0) para mapear las unidades del proyecto. La primera unidad portada es la mezcla determinista de 32 bits del generador de semillas en `rust/core`. FORMA de escritorio carga ese módulo en la interfaz y el worker de exportación. El generador TypeScript sirve de referencia para comparar las secuencias y mantiene el modo web independiente. Los generadores visuales y shaders siguen utilizando el motor original.

Después de compilar escritorio, comprueba la paridad y ejecuta la suite de Chromium contra el binario:

```powershell
node --experimental-strip-types scripts/check-seed-parity.mjs
npx playwright install chromium
$env:FORMA_DESKTOP = '1'
npm run test:e2e
```

La prueba de galería importa módulos fuente de Vite. Para ejecutarla, abre una sesión de terminal sin `FORMA_DESKTOP` y usa `npm run test:gallery`.

El código y ambos archivos de bloqueo se guardan en Git. Los ejecutables portables, dependencias, resultados de pruebas y bibliotecas personales quedan fuera del historial.
