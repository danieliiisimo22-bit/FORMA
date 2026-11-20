import { useEffect, useRef } from 'react'
import { fullTile, previewRenderer } from '../engine/render'
import type { Recipe } from '../engine/types'
import { aspectRatio } from '../presets/recipes'

const jobs = new Set<() => void>()
let frame = 0
function runThumbnails() {
  frame = 0
  for (let i = 0; i < 5; i++) {
    const job = jobs.values().next().value
    if (!job) break
    jobs.delete(job)
    job()
  }
  if (jobs.size) frame = requestAnimationFrame(runThumbnails)
}

export function Artwork({ recipe, thumbnail = false, paused = false, label }: {
  recipe: Recipe; thumbnail?: boolean; paused?: boolean; label?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ratio = aspectRatio(recipe)
  useEffect(() => {
    const node = canvas.current
    if (!node) return
    const context = node.getContext('2d', { alpha: false, colorSpace: 'srgb' })
    if (!context) return
    const renderer = previewRenderer()
    const render = (highQuality: boolean) => {
      const cap = thumbnail ? 196 : renderer.gpu ? highQuality ? 1600 : 610 : highQuality ? 740 : 360
      const available = Math.max(node.clientWidth, node.clientHeight, thumbnail ? 94 : 240)
      const edge = Math.min(cap, Math.max(1, Math.round(available * (highQuality ? Math.min(devicePixelRatio, 2) : 1))))
      const width = Math.max(1, Math.round(ratio >= 1 ? edge : edge * ratio))
      const height = Math.max(1, Math.round(ratio >= 1 ? edge / ratio : edge))
      if (node.width !== width) node.width = width
      if (node.height !== height) node.height = height
      const start = performance.now()
      const backend = renderer.draw(recipe, fullTile(width, height), context)
      node.dataset.backend = backend
      node.dataset.renderMs = String(Math.round((performance.now() - start) * 10) / 10)
      node.dataset.seed = String(recipe.seed)
    }
    const thumb = () => render(true)
    let animation = 0
    let settle = 0
    let visibility: IntersectionObserver | undefined
    let resize: ResizeObserver | undefined
    const repaint = () => {
      cancelAnimationFrame(animation)
      window.clearTimeout(settle)
      animation = requestAnimationFrame(() => render(false))
      if (!paused) settle = window.setTimeout(() => render(true), 180)
    }
    if (thumbnail) {
      const queue = () => {
        jobs.add(thumb)
        if (!frame) frame = requestAnimationFrame(runThumbnails)
      }
      visibility = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) queue()
        else jobs.delete(thumb)
      })
      visibility.observe(node)
    } else {
      repaint()
      resize = new ResizeObserver(repaint)
      if (node.parentElement) resize.observe(node.parentElement)
      renderer.canvas.addEventListener('webglcontextlost', repaint)
      renderer.canvas.addEventListener('webglcontextrestored', repaint)
    }
    return () => {
      cancelAnimationFrame(animation)
      clearTimeout(settle)
      jobs.delete(thumb)
      visibility?.disconnect()
      resize?.disconnect()
      renderer.canvas.removeEventListener('webglcontextlost', repaint)
      renderer.canvas.removeEventListener('webglcontextrestored', repaint)
    }
  }, [recipe, ratio, thumbnail, paused])
  return <canvas ref={canvas} className="artwork" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
}
