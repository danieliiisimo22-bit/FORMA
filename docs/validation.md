# Validación de FORMA 1.2.0-preview.2

| Verificación | Cobertura |
| --- | --- |
| Compatibilidad de arte | 66 recetas publicadas con FORMA 1.1, tres por generador. La prueba de Rust compara todos los canales de cada muestra CPU frente al registro original y admite una diferencia máxima de un nivel. |
| Semillas y render | Secuencia determinista, densidad de color y diferencias entre semillas. La prueba por teselas comprueba píxeles idénticos dentro del área compartida. |
| Interfaz Rust/WebAssembly | Los 22 generadores en WebGL2, recuperación con Canvas 2D, navegación móvil, controles, variantes, comparación y persistencia. |
| Bibliotecas | Colecciones y recetas del esquema 1, límites, conflictos de nombres y paletas individuales. |
| Exportación | PNG, JPEG y WebP a tamaño final. Worker Rust/WebAssembly, exportación 8K, cancelación y reintento. |
| Portables | Windows x64, Linux x64 y macOS 13+ para Apple Silicon e Intel. Los ZIP incluyen permisos ejecutables y sumas SHA-256. |

La galería de 110 composiciones se conserva como referencia visual. Las capturas de la interfaz y las muestras de los cuatro estilos cromáticos se generan con la compilación Rust. [Galería](validacion/galeria.png) · [Captura de escritorio](validacion/estudio-espiral.png) · [Vista móvil](validacion/movil.png) · [Ajustes móviles](validacion/movil-ajustes.png)

Para verificar el motor, ejecuta `cargo test --locked -p forma-core`. Compila el escritorio y ejecuta `npm run test:e2e` para probarlo en Chromium. `npm run test:gallery` verifica los 22 shaders en WebGL2 y genera capturas nuevas. [Compilación](desktop.md) · [Pruebas de compatibilidad](../rust/core/tests/compatibility.rs)

Los resultados anteriores se conservan en el [informe del 19 de noviembre de 2026](revision-2026-11-19/INFORME.txt).
