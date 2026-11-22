# Validación de FORMA 1.1.0-preview.2

La suite web de Chromium completó 23 pruebas y el motor completó 30 pruebas de Vitest. El ejecutable de Linux x64 devolvió la versión esperada y sirvió el HTML y el módulo WebAssembly en WSL.

| Verificación | Cobertura |
| --- | --- |
| Motor | Los 22 generadores responden a la semilla y son reproducibles. Se comprueban identidad entre teselas CPU, simetría, gama cromática, validación de recetas y conservación de bloqueos. |
| Rust/WASM | Se cotejaron 65.543 estados de semillas contra la implementación de referencia en TypeScript. |
| Interfaz | Generación, historial, deshacer y rehacer, restauración de sesión, estilos cromáticos, controles contextuales, variantes, favoritos, comparación y paletas. |
| Bibliotecas | Importación y exportación de recetas y colecciones, importación con límite de capacidad y paletas individuales. |
| Exportación | Dimensiones de PNG, JPEG y WebP. Exportación UHD 8K tras cancelar y volver a iniciar. |
| Recuperación | Transición a Canvas 2D al perder el contexto y vuelta a WebGL2 al restaurarlo. |
| Móvil | Lienzo vertical y diálogo de exportación a 390 × 844 sin desbordamiento horizontal. |
| Portables | Compilación de Windows x64, Linux x64 y macOS 13+ Apple Silicon e Intel. La validación en equipos Mac queda pendiente. |

## Galería

Se renderizaron **110 composiciones en WebGL2** con los 22 generadores y cinco combinaciones de semilla y formato por generador. Las combinaciones cubren 3:2, 16:9, 21:9, 9:16 y 1:1. Todas superaron el umbral de dispersión de luminancia de la prueba. La comparación por teselas conservó los canales de color dentro de un nivel en la receta evaluada.

- [Galería de 110 composiciones](validacion/galeria.png)
- [Captura de escritorio](validacion/estudio.png)
- [Lienzo móvil](validacion/movil.png) y [ajustes móviles](validacion/movil-ajustes.png)
- [Mediciones por render](validacion/metricas.json)

Los tiempos de render incluyen una lectura de píxeles para medir luminancia. Dependen del equipo, el navegador, el backend, la resolución y la receta. La selección personal de fondos y su evaluación al tamaño de pantalla final siguen en el roadmap. [Revisión artística](roadmap.md#revisión-artística)

## Reproducir

`npm test` comprueba el motor y `npm run test:e2e` ejecuta las pruebas de navegador. `npm run test:gallery` guarda las capturas y las métricas en `test-results/`. Tras compilar escritorio, `node --experimental-strip-types scripts/check-seed-parity.mjs` verifica la paridad de semillas. [Pruebas contra el ejecutable](desktop.md#alcance-del-port)

Los resultados del proyecto original se conservan en la revisión de noviembre. [Informe del 19 de noviembre de 2026](revision-2026-11-19/INFORME.txt)
