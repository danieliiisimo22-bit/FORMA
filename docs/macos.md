# FORMA para macOS

Descomprime `FORMA-1.0.0-macOS-universal.zip` y abre **FORMA.app**. Node.js se usa para compilar el proyecto. La aplicación instalada lleva los recursos web dentro del paquete y usa el WebKit del sistema. Funciona localmente desde una ventana de macOS y usa un puerto en loopback para persistencia y exportación.

## Compatibilidad y distribución

- Objetivo de compilación: macOS 13 o posterior.
- Arquitecturas del binario: Apple silicon (`arm64`) e Intel (`x86_64`).
- El paquete tiene firma ad hoc. Apple no ha notarizado esta entrega. Al descargarlo de Internet, Gatekeeper puede pedir autorización en **Ajustes del Sistema → Privacidad y seguridad**.
- La aplicación guarda sus datos por separado de los del estudio abierto en un navegador. Usa **Mis recetas → Exportar biblioteca** para trasladarlos.
- FORMA usa el puerto 56143 en 127.0.0.1. Si otro proceso lo ocupa, la aplicación muestra un error al abrir.

## Compilación

Con Xcode Command Line Tools y Node.js instalados:

```sh
npm ci
npm run build:macos
```

El script compila el frontend, construye ambas arquitecturas en Swift, crea el icono, firma la app y produce `release/FORMA.app` y el ZIP para distribuir. Para comprobar el arranque, el render y una descarga PNG en WebKit desde la terminal:

```sh
release/FORMA.app/Contents/MacOS/FORMA --smoke-test
```

## Validación del paquete 1.0.0

Se ejecutó la app en Apple silicon y se comprobó que WebKit renderiza el lienzo, puede usar almacenamiento local y descarga un PNG de 120 × 80. Se comprobaron la firma ad hoc y la presencia de ambas arquitecturas en el ejecutable. La variante Intel queda compilada para macOS 13 o posterior y pendiente de prueba en un Mac Intel.
