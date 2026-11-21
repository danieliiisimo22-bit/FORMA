import { renderExport } from '../export/image'
import type { ExportOptions } from '../export/image'
import type { Recipe } from '../engine/types'
import { loadRustCore } from '../engine/rust'

self.addEventListener('message', async ({ data }: MessageEvent<{ recipe: Recipe; options: ExportOptions }>) => {
  if (typeof OffscreenCanvas !== 'function') {
    postMessage({ type: 'unsupported' })
    return
  }
  try {
    await loadRustCore()
    const blob = await renderExport(data.recipe, data.options, (width, height) => new OffscreenCanvas(width, height),
      (fraction, message) => postMessage({ type: 'progress', fraction, message }))
    postMessage({ type: 'done', blob })
  } catch (error) {
    postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Error de exportación.' })
  }
})
