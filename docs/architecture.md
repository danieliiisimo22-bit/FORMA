# Arquitectura

| Módulo | Responsabilidad |
| --- | --- |
| `rust/core` | Generadores, semillas, color OKLab, recetas, biblioteca y renderizado CPU |
| `rust/studio` | Interfaz WebAssembly, persistencia en el navegador, WebGL2 y exportación |
| `rust/desktop` | Servidor HTTP local y recursos embebidos |
| `rust/build` | Compilación web y de escritorio, paquetes portables y sumas SHA-256 |
| `web` | Documento inicial, estilos y carga de WebAssembly en la página y su worker |

## Renderizado

Una receta validada define el generador, la semilla, la paleta, la composición y el acabado. La interfaz la pasa a WebGL2, que ejecuta los shaders de `rust/core/src/shaders`. Si WebGL2 deja de estar disponible, el motor Rust calcula los píxeles y Canvas 2D los presenta.

El worker de exportación renderiza la misma receta por teselas a la resolución elegida y entrega el resultado al codificador del navegador. PNG, JPEG y WebP se exportan en sRGB de 8 bits por canal.

## Servidor y biblioteca

El ejecutable enlaza con `127.0.0.1`, exige una única cabecera `Host` igual a la dirección y puerto del servidor, y acepta `GET` y `HEAD` para servir archivos embebidos. El servidor carece de rutas de escritura.

La sesión y las colecciones se guardan en `localStorage` bajo el origen del navegador. Recetas, paletas y bibliotecas usan el esquema JSON 1.
