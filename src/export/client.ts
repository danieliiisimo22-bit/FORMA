import type { Recipe } from '../engine/types'
import { renderExport, validateSize } from './image'
import type { ExportOptions } from './image'

type Progress = (fraction: number, message: string) => void
type Response = { type: 'unsupported' } | { type: 'progress'; fraction: number; message: string }
  | { type: 'done'; blob: Blob } | { type: 'error'; message: string }

const domCanvas = (width: number, height: number) => Object.assign(document.createElement('canvas'), { width, height })
export async function exportImage(recipe: Recipe, options: ExportOptions, progress: Progress, signal: AbortSignal) {
  validateSize(options.width, options.height)
  signal.throwIfAborted()
  const fallback = () => renderExport(recipe, options, domCanvas, progress, signal)
  if (!globalThis.Worker || !globalThis.OffscreenCanvas) return fallback()
  let worker: Worker
  try {
    worker = new Worker(new URL('../workers/export.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return fallback()
  }
  let abort: (() => void) | undefined
  let blob: Blob | null
  try {
    blob = await new Promise<Blob | null>((resolve, reject) => {
      abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      worker.addEventListener('message', ({ data }: MessageEvent<Response>) => {
        if (data.type === 'progress') progress(data.fraction, data.message)
        if (data.type === 'unsupported') resolve(null)
        if (data.type === 'done') resolve(data.blob)
        if (data.type === 'error') reject(new Error(data.message))
      })
      worker.addEventListener('error', () => resolve(null), { once: true })
      worker.addEventListener('messageerror', () => resolve(null), { once: true })
      worker.postMessage({ recipe, options })
    })
  } finally {
    if (abort) signal.removeEventListener('abort', abort)
    worker.terminate()
  }
  return blob ?? fallback()
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadJson = (value: unknown, name: string) =>
  download(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }), name)
