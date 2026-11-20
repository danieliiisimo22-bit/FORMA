import { Renderer } from '../engine/render'
import type { Canvas, Context2D } from '../engine/render'
import type { Recipe } from '../engine/types'
import { aspectRatio } from '../presets/recipes'

export type ImageFormat = 'image/png' | 'image/jpeg' | 'image/webp'
export interface ExportOptions { width: number; height: number; format: ImageFormat; quality: number }
export const suffix: Record<ImageFormat, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
export const MAX_PIXELS = 34_000_000
export const MAX_SIDE = 8192

export function resolution(recipe: Recipe, shortSide: number): [number, number] {
  const aspect = aspectRatio(recipe)
  const width = aspect >= 1 ? Math.round(shortSide * aspect) : shortSide
  const height = aspect >= 1 ? shortSide : Math.round(shortSide / aspect)
  const factor = Math.min(1, MAX_SIDE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)))
  return [Math.floor(width * factor), Math.floor(height * factor)]
}

export function validateSize(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || Math.min(width, height) < 16
    || Math.max(width, height) > MAX_SIDE || width * height > MAX_PIXELS) {
    throw new Error('Usa dimensiones enteras entre 16 y 8192 px, con un máximo de 34 megapíxeles.')
  }
}

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function encode(canvas: Canvas, format: ImageFormat, quality: number) {
  let blob: Blob | null
  try {
    blob = 'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: format, quality })
      : await new Promise((resolve) => canvas.toBlob(resolve, format, quality))
  } catch {
    throw new Error('El navegador no pudo codificar esta imagen. Prueba con una resolución menor.')
  }
  if (!blob || blob.type !== format) throw new Error('Este navegador no admite la codificación en el formato elegido.')
  return blob
}

export async function renderExport(
  recipe: Recipe, options: ExportOptions, makeCanvas: (width: number, height: number) => Canvas,
  progress: (fraction: number, message: string) => void, signal?: AbortSignal,
) {
  const { width, height, format, quality } = options
  validateSize(width, height)
  const output = makeCanvas(width, height)
  const surface = makeCanvas(1, 1)
  const context = output.getContext('2d', { alpha: false, colorSpace: 'srgb' }) as Context2D | null
  if (!context || output.width !== width || output.height !== height) throw new Error('El navegador rechazó estas dimensiones.')
  const renderer = new Renderer(surface)
  const step = renderer.tileLimit
  const cells = Math.ceil(width / step) * Math.ceil(height / step)
  let done = 0
  let backend: 'WebGL2' | 'Canvas 2D' | undefined
  try {
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        signal?.throwIfAborted()
        const current = renderer.draw(recipe, {
          width: Math.min(step, width - x), height: Math.min(step, height - y), x, y, fullWidth: width, fullHeight: height,
        }, context, x, y)
        if (backend && backend !== current) throw new Error('El contexto gráfico cambió durante la exportación. Vuelve a intentarlo.')
        backend = current
        progress(++done / cells * 0.89, 'Renderizando imagen')
        await yieldFrame()
      }
    }
    signal?.throwIfAborted()
    progress(0.94, 'Codificando archivo')
    const blob = await encode(output, format, quality)
    signal?.throwIfAborted()
    progress(1, 'Archivo listo')
    return blob
  } finally {
    renderer.dispose()
    output.width = output.height = 1
    surface.width = surface.height = 1
  }
}
