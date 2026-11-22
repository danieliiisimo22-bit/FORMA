# Validación

| Comprobación | Cobertura |
| --- | --- |
| Compatibilidad visual | Comparación de 66 recetas del esquema 1. Cada canal del renderizado CPU puede diferir hasta un nivel de su muestra guardada. |
| Motor | Semillas deterministas, distribución de color, variantes y bloqueos. El renderizado CPU por teselas conserva píxeles idénticos en el área compartida. |
| Renderizado web | Los 22 generadores en WebGL2 y recuperación con Canvas 2D tras perder el contexto. |
| Interfaz | Flujos de edición, navegación con teclado, diálogos, historial, comparación y diseño móvil. |
| Biblioteca | Persistencia, importación y exportación de recetas y paletas, límites y conflictos de nombres. |
| Exportación | PNG, JPEG y WebP a tamaño final. Renderizado 8K, cancelación y reintento. |
| Escritorio | Compilación y arranque en Windows x64, Linux x64 y macOS para Apple Silicon e Intel. |

## Ejecutar las pruebas

```sh
cargo test --locked -p forma-core
cargo run --locked -p forma-build -- desktop
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm run test:gallery` prueba los 22 shaders en WebGL2 y guarda
capturas bajo `test-results/`. La suite automatizada de navegador usa
Chromium. La comparación de píxeles cubre el renderizado CPU. La paridad
entre GPU y CPU requiere una prueba específica.

[Captura de escritorio](validacion/estudio-espiral.png) · [Vista móvil](validacion/movil.png) · [Generadores](generators.md)
