# Roadmap de FORMA

Estado al 22 de noviembre de 2026 · Vista previa **1.2.0-preview.1**

| Fase | Estado actual | Criterio para avanzar |
| --- | --- | --- |
| **1.1 · Estabilización** | Se corrigieron importaciones de bibliotecas y paletas individuales, el acceso móvil a Ayuda y la conservación del historial y Deshacer. Hay pruebas de recuperación del renderizador, importación, exportación y uso móvil. | Revisar sesiones largas y confirmar el uso de los portables en los equipos de destino. |
| **1.2 · Motor Rust y expansión artística** | La interfaz, el motor, las recetas, la exportación y el empaquetado se migraron a Rust. El catálogo conserva 22 generadores en siete familias. | Evaluar la variedad visual, completar el director de composición y añadir variantes guiadas por objetivos visuales. |
| **1.5 · Estudio avanzado** | Planificado. | Incorporar capas, máscaras, mezcla de algoritmos y edición no destructiva. |
| **2.0 · Distribución** | Hay lanzador Rust, paquetes portables para tres sistemas y compilaciones automatizadas. | Completar validación en equipos de destino, instaladores, firma, notarización y actualizaciones. Evaluar Tauri si aporta beneficios medibles. |
| **2.x · Movimiento y producción** | Planificado. | Añadir animación procedural, exportación por lotes y formatos de mayor profundidad de color. |

## Director de composición

Previsto para **1.2** como una capa por encima de los generadores. El perfil debe actuar sobre el encuadre y la densidad, junto con el contraste global y local. Debe poder mover el foco, dejar espacio negativo, ajustar la separación entre elementos y adaptar el detalle a la resolución de salida.

| Perfil propuesto | Criterio visual |
| --- | --- |
| Minimalista | Pocos elementos, márgenes amplios y un foco de baja densidad. |
| Equilibrado | Peso visual repartido, detalle moderado y un foco legible. |
| Dramático | Foco dominante, mayor contraste y zonas de descanso alrededor. |
| Orgánico | Distribución asimétrica, variaciones suaves y agrupaciones espaciadas. |
| Experimental | Encuadres y ritmos menos previsibles, con control de saturación visual. |

La misma receta debe conservar su dirección artística al exportar y las recetas anteriores deben conservar su aspecto. Probar horizontal, ultrapanorámico y vertical permite evaluar la posición del foco y el espacio libre para iconos o reloj.

## Revisión artística

La galería prepara **110 composiciones** con 22 generadores y cinco combinaciones de proporción y semilla por estilo. Incluye **3:2**, **16:9**, **21:9**, **9:16** y **1:1**. Está pendiente la selección personal de los fondos que realmente usarías. Registra la semilla y la proporción de los elegidos y revisa su exportación a tamaño final. La selección ayudará a decidir dónde conviene mejorar la variedad, el efecto de los parámetros o la calidad visual. [Galería](validacion/galeria.png)

Las referencias aportadas orientaron **Cintas de luz** (pliegues luminosos), **Nácar** (reflejos pastel), **Difusión de color** (campos granulados) y **Relieve espectral** (crestas cromáticas sobre sombra). La biblioteca genera cada estilo a partir de fórmulas, paletas y semillas. [Muestras de FORMA](../README.md#galería)

## Evaluación original

La estimación anterior fue **82%** de madurez para una primera versión distribuible y cerca de **90%** para el motor y la experiencia creativa básica. Se conserva como referencia cualitativa histórica. La tabla de fases refleja el estado verificable de esta entrega.

| Dimensión | Estimación original |
| --- | ---: |
| Arquitectura | 92% |
| Motor y generación | 90% |
| Color y personalización | 91% |
| Interfaz y experiencia | 85% |
| Pruebas y confiabilidad | 78% |
| Distribución multiplataforma | 45% |
