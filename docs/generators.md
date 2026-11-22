# Generadores

| Familia | Estilos y técnicas |
| --- | --- |
| Gradientes | **Horizonte** superpone campos gaussianos y un velo de ruido. **Iridiscencia** combina ondas y fase angular. **Difusión de color** combina dos campos de luz y grano de película. |
| Fluidos | **Seda líquida** pliega una corriente con una envolvente y filamentos. **Vórtice** deforma campos multiescala en coordenadas polares. **Cintas de luz** simula pliegues con sombras entre bandas. **Nácar** modela ondas suaves con reflejos especulares. **Relieve espectral** levanta crestas radiales con un foco de luz desplazado. |
| Geometría | **Módulos** tesela cuartos de círculo y diagonales. **Arcadas** crea arcos concéntricos con registro de altura por celda. **Facetas** construye mosaicos equiláteros con juntas y relieve. **Cubos isométricos** compone tres caras a partir de una retícula hexagonal. **Cintas Truchet** conecta cuartos de círculo entre baldosas. **Figuras** superpone un círculo, cuadrado, triángulo o hexágono con su eco desplazado. |
| Simetría | **Rosetón** distribuye pétalos y anillos alrededor del centro. |
| Op Art | **Interferencia** forma batidos entre campos estáticos de líneas. La interfaz avisa sobre la intensidad del patrón. |
| Orgánicos | **Voronoi** utiliza dos distancias vecinas para modelar membranas. **Topografía** dibuja isocurvas sobre ruido de varias escalas. **Dunas** crea crestas onduladas y sombras por estratos. **Ramificaciones** combina un tallo curvo con nervaduras alternas y ramas secundarias. |
| Experimental | **Risografía** superpone dos tramas desplazadas con densidad variable. **Fractura** pliega y gira el plano de forma recursiva. |

## Añadir un estilo

1. Añade una entrada al registro en `src/generators/index.ts` con un ID estable, versión, familia, nombre, descripción y paleta curada. Para añadir una familia, registra su nombre y descripción en `src/generators/families.ts`. El registro determina su orden en la biblioteca.
2. Define cuatro parámetros con etiquetas, explicación, valor inicial y rango seguro. Los controles de Estudio admiten el intervalo completo entre 0 y 1.
3. Implementa el campo con `glsl` y `sample`. Ambos reciben coordenadas normalizadas `x`, `y`, cuatro parámetros `a` a `d`, complejidad `k` y fase `s`. El escalar de salida se traduce a la rampa cromática. El renderer se encarga de la simetría, color, acabado y exportación.
4. Declara los modos de simetría compatibles. Marca `intense` cuando el patrón requiera advertencia. Si usas formas de alta frecuencia, revisa su efecto en miniaturas y al exportar.
5. Define `presetSeed` en los metadatos con una semilla curada. Comprueba el preset y varias semillas con `npm run test:gallery`. Revisa distribución tonal, detalle, contraste y comportamiento al variar la proporción.
6. Conserva la versión existente de un algoritmo para las recetas publicadas. Para introducir cambios incompatibles, añade el despacho por versión y un caso de importación que valide cada versión admitida.

## Extensiones pendientes

El estudio incluye 22 estilos y diez acabados estéticos. El encuadre, las variaciones guiadas y la animación figuran entre las próximas etapas. [Roadmap](roadmap.md)
