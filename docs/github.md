# Ficha para GitHub

| Campo | Valor |
| --- | --- |
| Repositorio creado | `danieliiisimo22-bit/FORMA` |
| Visibilidad comprobada | Privado |
| Nombre del proyecto | FORMA — Generative Art Studio |
| Descripción | Local-first procedural generative art studio for the web and macOS. |
| Lenguaje principal | TypeScript |
| Otros lenguajes | GLSL para shaders, Swift para macOS, CSS y HTML |
| Interfaz | React, Vite, Tailwind CSS |
| Motor | WebGL2 y Canvas 2D |
| Licencia | MIT |
| Temas | `generative-art`, `creative-coding`, `procedural-generation`, `typescript`, `react`, `glsl`, `webgl2`, `swift`, `macos`, `local-first` |
| Rama principal | `main` |
| Primera etiqueta | `v1.0.0` |
| Título de la release | FORMA 1.0.0 |
| Archivo de release | `FORMA-1.0.0-macOS-universal.zip` |
| Vista social | [Imagen de 1280 × 640](github-social.png) |
| Capturas | [Escritorio](validacion/estudio.png), [móvil](validacion/movil.png), [galería](validacion/galeria.png) |

Se creó `https://github.com/danieliiisimo22-bit/FORMA`, privado, y se autenticó Git en el M1. Consulta `CONTINUIDAD.txt` para comprobar la sincronización y trabajar entre equipos. Esta carpeta de código fuente es la raíz de Git y de `main`; no se incluye en Git la aplicación compilada de la carpeta superior. El workflow valida el proyecto y empaqueta la aplicación como artefacto de CI. Los binarios se generan localmente o mediante CI y se pueden adjuntar a una release cuando se decida distribuirlos.

## Texto de la release

FORMA permite crear arte procedural con 12 generadores, 32 paletas curadas, edición en dos niveles, variaciones y exportación en PNG, JPEG y WebP. Desde esta versión también se puede usar como aplicación de escritorio en macOS sin instalar Node.js.

Descarga el ZIP universal de macOS, descomprímelo y abre **FORMA.app**. Requiere macOS 13 o posterior. Esta compilación usa firma ad hoc y carece de notarización de Apple. Consulta los detalles de instalación y compilación en la [guía de macOS](macos.md).

La imagen social está dimensionada según la [guía de GitHub para vistas previas](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview). El ZIP completo agrega el código fuente y los recursos visuales. El ZIP de macOS es el archivo previsto para **Releases**.
