# Validación

Se ejecutaron la compilación de producción, 20 pruebas con Vitest y 11 con Playwright. Las pruebas de navegador se ejecutaron en Chrome 157.0.8103.79 sin interfaz gráfica, en macOS arm64, con WebGL2 habilitado.

| Verificación | Resultado |
| --- | --- |
| Motor | Semilla reproducible, 12 campos que responden a cambios de semilla, simetrías por eje y sector, color sRGB dentro de gama, identidad de píxeles entre teselas CPU, validación de recetas y conservación de bloqueos |
| Interfaz | Generación, deshacer y rehacer, restauración de sesión, controles contextuales, favoritos, variantes, comparación, paletas, importación y exportación de biblioteca |
| Exportación | PNG de 327 × 219, JPEG de 1663 × 714 y WebP de 481 × 322 decodificados a las dimensiones esperadas. PNG UHD de 7680 × 4320 después de cancelar y volver a iniciar |
| Recuperación gráfica | Pérdida provocada del contexto del lienzo, transición a Canvas 2D y retorno a WebGL2 tras restaurarlo |
| Adaptabilidad | Uso del lienzo vertical y apertura de exportación a 390 × 844 sin desbordamiento horizontal |

## Galería y revisión visual

Revisión de 36 renders WebGL2 con tres semillas reproducibles por generador. Se verificaron composición, distribución tonal y diferencias entre estilos. La revisión llevó a ajustar la envolvente de Rosetón para despejar sus bordes y la cobertura de tintas de Risografía para distinguir mejor las dos tramas. El conjunto final superó la comprobación de dispersión de luminancia. La comparación de un bloque renderizado por separado con el render completo no encontró píxeles con diferencias mayores a un nivel por canal en la muestra probada.

- [Galería de 36 composiciones](validacion/galeria.png)
- [Captura de escritorio](validacion/estudio.png)
- [Lienzo móvil](validacion/movil.png) y [ajustes móviles](validacion/movil-ajustes.png)

## Rendimiento observado

Las 36 miniaturas de 330 × 220 tuvieron una mediana de 1,35 ms y un rango de 1,0 a 9,0 ms, incluyendo la lectura de píxeles para evaluar luminancia. El segundo intento del PNG UHD 8K inició la descarga en 789 ms. El archivo pesó 45.924.371 bytes. Los tiempos corresponden a esta máquina y a las recetas probadas. El rendimiento depende del navegador, backend, resolución, generador y acabado.

- [Mediciones por render](validacion/metricas.json)
- [Medición de exportación 8K](validacion/exportacion-8k.json)

Ejecuta `npm run test:gallery` para reproducir la galería y obtener capturas nuevas en `test-results/`. Ejecuta `npm run test:e2e` para incluir la exportación UHD y el resto de los flujos. La validación de navegador de esta entrega se hizo en Chrome.
