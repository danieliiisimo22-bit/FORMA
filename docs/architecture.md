# Arquitectura

| Módulo | Responsabilidad |
| --- | --- |
| `rust/core` | Semillas, 22 campos de composición, muestreo CPU, color OKLab, recetas, estado, biblioteca y dimensiones de exportación |
| `rust/studio` | Interfaz y eventos del navegador, persistencia local, adaptación de WebGL2 y Canvas 2D, exportación por teselas y cancelación |
| `rust/desktop` | Servidor local Rust, apertura del navegador y recursos embebidos |
| `rust/build` | Compilación del sitio y el ejecutable, ZIP portables y sumas SHA-256 |
| `web` | Documento inicial, estilos y carga de WebAssembly en la página y su worker |
| `rust/core/src/shaders` | Shaders GLSL de los 22 campos y del pipeline WebGL2 |

La interfaz construye el DOM desde Rust compilado a WebAssembly. La receta validada alimenta el renderizador y la biblioteca. Las imágenes se exportan con el mismo campo y parámetros que la vista previa. El worker ejecuta Rust/WebAssembly y usa el codificador del navegador para PNG, JPEG o WebP. Hay un camino Canvas 2D en Rust para equipos donde WebGL2 falla.

Los dos archivos de carga JavaScript y el enlace generado por `wasm-bindgen` conectan el navegador a WebAssembly. HTML, CSS y GLSL usan los formatos que procesan los navegadores y WebGL. Las pruebas de navegador son JavaScript y Node.js queda en la suite de desarrollo.

## Compatibilidad de la migración

`rust-anything analyze --whole-app` se usó para inventariar el código y ordenar el port de motor, paletas, recetas, estado, interfaz y worker. Las pruebas Rust reproducen **66 recetas y sus píxeles de referencia** extraídos de FORMA 1.1. El esquema JSON y la versión de cada algoritmo se conservan. [Pruebas de compatibilidad](../rust/core/tests/compatibility.rs) · [Verificación de navegador](validation.md)
