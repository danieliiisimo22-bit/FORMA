# FORMA — Generative Art Studio

Estudio de arte abstracto procedural para el navegador. Genera y exporta imágenes localmente con un motor determinista, WebGL2 y un respaldo Canvas 2D. La aplicación funciona sin cuentas, telemetría, servicios externos ni modelos generativos.

[English README](README.en.md) · [Arquitectura](docs/architecture.md) · [Guía de generadores](docs/generators.md) · [Validación](docs/validation.md)

![FORMA en escritorio](docs/validacion/estudio.png)

La vista previa 1.1 incluye un ejecutable Rust que abre el estudio en el navegador y utiliza Rust/WebAssembly para las semillas. La interfaz React/TypeScript y el renderizado WebGL2/Canvas 2D se comparten con la versión web. Consulta la [guía de escritorio](docs/desktop.md).

Para continuar el mismo proyecto entre el Mac M1 y el Mac M4, consulta la [nota de continuidad](CONTINUIDAD.txt). La [revisión del 19 de noviembre de 2026](docs/revision-2026-11-19/INFORME.txt) recoge las pruebas y las limitaciones observadas en el M1.

La [revisión del código](docs/revision-2026-11-19/REVISION-CODIGO.txt) documenta el estado de la versión original. Esta vista previa corrige la importación al llegar al límite de la biblioteca, admite el JSON de una paleta individual y devuelve el acceso a Ayuda en pantallas estrechas.

[Instalación en macOS](docs/macos.md) · [Ficha de GitHub](docs/github.md) · [Galería de composiciones](docs/validacion/galeria.png)

## Empezar

Requiere Node.js 20.19 o 22.12 en adelante y un navegador moderno.

```sh
npm ci
npm run dev
```

Abre la dirección local que imprime Vite. El archivo de bloqueo permite volver a instalar las mismas versiones de dependencias.

1. Elige una familia en **Biblioteca** y pulsa el desplegable de la fila para ver sus estilos.
2. Ajusta color, complejidad, simetría y textura desde **Simple**. **Estudio** muestra los parámetros del algoritmo activo.
3. Pulsa **Generar** para cambiar la semilla con los ajustes actuales, **Nueva variante** para variar también algunos parámetros, **Explorar** para recorrer la familia o **Sorpréndeme** para cambiar de familia y buscar otro color.
4. Abre **Variantes** y pulsa **Mutar composición** para crear 4, 9 o 16 descendientes. Selecciona uno para llevarlo al lienzo o usa **Comparar composiciones** para ver dos resultados a la vez.
5. Guarda con el corazón o crea un preset con nombre en **Mis recetas**. Usa **Exportar** para obtener la imagen o **Exportar receta** para compartir el estado editable en JSON.

El menú de paletas contiene 32 paletas curadas y permite introducir colores HEX, extraer colores de la obra, bloquear colores individuales y guardar paletas propias. Las variantes mantienen los colores y parámetros bloqueados. La última sesión, el historial visual, las paletas y las recetas se guardan en el almacenamiento del mismo origen del navegador. Exporta la biblioteca JSON para mover tus datos o hacer una copia.

Atajos disponibles en **Ayuda y atajos**. `G` genera, `Ctrl/⌘+Z` deshace, `Ctrl/⌘+Mayús+Z` rehace y `Ctrl/⌘+S` abre las recetas.

## Compilar y probar

```sh
npm run build
npm run preview
npm test
npx playwright install chromium
npm run test:e2e
npm run test:gallery
```

`dist/` contiene la aplicación estática compilada. Sírvela por HTTP para habilitar el worker de exportación. Tras instalar las dependencias, FORMA funciona desde el servidor local sin conexión a Internet. En macOS, Playwright detecta Google Chrome si está instalado en `/Applications`. Define `FORMA_BROWSER=chromium` para usar el Chromium de Playwright, o `FORMA_BROWSER=chrome` para usar Chrome instalado en otros sistemas.

## Exportación

PNG, JPEG y WebP de 8 bits por canal en sRGB. Las clases 1080p, 1440p, 4K y 8K parten de un lado corto de 1080, 1440, 2160 y 4320 px y se ajustan a la proporción elegida. La exportación personalizada admite hasta 8192 px por lado y 34 megapíxeles. Algunos navegadores o equipos pueden requerir dimensiones menores. La exportación vuelve a evaluar la receta en cada píxel y comprueba que el navegador haya producido el formato solicitado.

## Alcance

La biblioteca inicial contiene 12 generadores en siete familias. El [catálogo](docs/generators.md) enumera los estilos disponibles y las extensiones pendientes. Distribuido bajo la [licencia MIT](LICENSE).
