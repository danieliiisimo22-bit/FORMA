# Plan de desarrollo

| Área | Trabajo pendiente |
| --- | --- |
| Composición | Perfiles para distribuir masas visuales, ubicar el foco y regular densidad, contraste y espacio negativo. Variaciones guiadas por estos controles. |
| Validación visual | Comparación GPU/CPU y pruebas de exportación en Firefox y WebKit. |
| Biblioteca | Copias de seguridad y validación de sesiones largas. |
| Distribución | Firma de Windows, notarización de macOS, instaladores y actualizaciones. |
| Edición | Capas, máscaras, mezcla de algoritmos y edición no destructiva. |
| Producción | Animación procedural, lotes y formatos de mayor profundidad cromática. |

## Director de composición

| Perfil | Criterio |
| --- | --- |
| Minimalista | Pocos elementos, márgenes amplios y un foco de baja densidad. |
| Equilibrado | Peso visual repartido, detalle moderado y un foco legible. |
| Dramático | Foco dominante, mayor contraste y espacio libre alrededor. |
| Orgánico | Distribución asimétrica, transiciones suaves y agrupaciones espaciadas. |
| Experimental | Cambios de encuadre y ritmo con control de saturación visual. |

La receta debe conservar el perfil al exportar. La validación debe cubrir
formatos horizontales, ultrapanorámicos y verticales, y comprobar la apertura
de recetas guardadas sin perfil.
