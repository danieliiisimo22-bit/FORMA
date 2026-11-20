import { generatorById, accentField } from '../generators'
import { buildRamp } from '../palettes'
import { fragment, vertex } from '../shaders/studio'
import { clamp, fbm, fract, mix, noise, randomFrom, rotate, smooth, TAU } from './math'
import { finishes, fold, symmetryModes } from './symmetry'
import type { Generator, Recipe } from './types'

export type Canvas = HTMLCanvasElement | OffscreenCanvas
export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export interface Tile {
  width: number
  height: number
  x: number
  y: number
  fullWidth: number
  fullHeight: number
}

export function fullTile(width: number, height: number): Tile {
  return { width, height, x: 0, y: 0, fullWidth: width, fullHeight: height }
}

const rampCache = new Map<string, Uint8Array>()
function scene(recipe: Recipe) {
  const generator = generatorById.get(recipe.generator)!
  const rng = randomFrom(recipe.seed)
  const phase = rng() * TAU
  const tilt = (rng() - 0.5) * (generator.family === 'Geometría' ? 0.20 : 0.52)
  const scale = 0.90 + rng() * 0.24
  const centered = generator.family === 'Simetría' ? 0.35 : 1
  const dx = (rng() - 0.5) * 0.46 * centered
  const dy = (rng() - 0.5) * 0.29 * centered
  const fingerprint = recipe.palette.join() + '|' + recipe.saturation
  let ramp = rampCache.get(fingerprint)
  if (!ramp) {
    ramp = buildRamp(recipe.palette, recipe.saturation)
    if (rampCache.size >= 24) rampCache.delete(rampCache.keys().next().value!)
    rampCache.set(fingerprint, ramp)
  }
  return { generator, phase, tilt, scale, dx, dy, ramp }
}

function pixelNoise(x: number, y: number, seed: number) {
  let h = (Math.imul(x + 313 * seed, 374761393) + Math.imul(y + 17, 668265263)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) & 65535) / 65535 - 0.5
}

export function cpuPixels(recipe: Recipe, tile: Tile): Uint8ClampedArray<ArrayBuffer> {
  const { generator, phase, tilt, scale, dx, dy, ramp } = scene(recipe)
  const { width, height, x: x0, y: y0, fullWidth, fullHeight } = tile
  const pixels = new Uint8ClampedArray(width * height * 4)
  const inv = 1 / Math.min(fullWidth, fullHeight)
  const [a, b, c, d] = recipe.parameters
  const { finish, amount } = recipe.texture
  const { contrast, complexity, symmetry, render } = recipe
  const seed = recipe.seed & 0xffff
  const technical = render.dither ? 1 : 0
  const tone = (x: number, y: number) => {
    if (symmetry.mode !== 'free') [x, y] = fold(x, y, symmetry)
    const [xx, yy] = rotate(x, y, tilt)
    x = xx * scale + dx
    y = yy * scale + dy
    let t = generator.sample(x, y, a, b, c, d, complexity, phase)
    if (render.mix) t = mix(t, t * 0.48 + accentField(x, y, phase) * 0.52, render.mix)
    return clamp((t - 0.5) * contrast + 0.5)
  }
  const channel = (t: number, j: number) => {
    const u = clamp(t) * 511
    const left = Math.min(510, Math.floor(u))
    return mix(ramp[left * 4 + j], ramp[left * 4 + j + 4], u - left)
  }

  for (let iy = 0; iy < height; iy++) {
    const y = (2 * (iy + y0 + 0.5) - fullHeight) * inv
    for (let ix = 0; ix < width; ix++) {
      const x = (2 * (ix + x0 + 0.5) - fullWidth) * inv
      let t = tone(x, y)
      const rnd = pixelNoise(ix + x0, iy + y0, seed)
      if (finish === 'halftone') t += (0.5 - Math.hypot(fract(x * 58) - 0.5, fract(y * 58) - 0.5)) * amount * 0.40
      if (finish === 'blur') {
        const offset = 0.015 + amount * 0.050
        t = mix(t, (tone(x + offset, y) + tone(x - offset, y) + tone(x, y + offset) + tone(x, y - offset)) * 0.25, amount)
      }
      if (finish === 'bloom') t += Math.max(Math.max(t, tone(x + 0.055, y + 0.018), tone(x - 0.055, y - 0.018)) - 0.48, 0) * amount * 0.33
      if (finish === 'vignette') t -= smooth(0.45, 1.9, Math.hypot(x, y)) * amount * 0.26
      if (finish === 'posterize') {
        const levels = 21 - Math.floor(17 * amount)
        t = mix(t, Math.floor(t * levels + 0.5) / levels, amount)
      }
      if (finish === 'print') t += (Math.cos(x * 122 + y * 168) * 0.038 + rnd * 0.039) * amount
      if (finish === 'analog') t += (fbm(x * 94, y * 94) - 0.5) * amount * 0.15
      let grain = rnd * technical
      if (finish === 'fine') grain += rnd * amount * 0.12 * 255
      if (finish === 'film') grain += (rnd * 0.091 + (noise(x * 176, y * 176) - 0.5) * 0.13) * amount * 255
      const index = (iy * width + ix) * 4
      const offset = amount * 0.026
      pixels[index] = channel(finish === 'aberration' ? tone(x + offset, y) : t, 0) + grain
      pixels[index + 1] = channel(t, 1) + grain
      pixels[index + 2] = channel(finish === 'aberration' ? tone(x - offset, y) : t, 2) + grain
      pixels[index + 3] = 255
    }
  }
  return pixels
}

const uniforms = ['uSize', 'uOrigin', 'uTileHeight', 'uParams', 'uLayout', 'uSym', 'uFinish', 'uGeometry', 'uGrades', 'uRamp'] as const
type Program = { program: WebGLProgram; u: Record<typeof uniforms[number], WebGLUniformLocation | null> }

export class Renderer {
  readonly canvas: Canvas
  private gl: WebGL2RenderingContext | null
  private programs = new Map<string, Program>()
  private unavailable = new Set<string>()
  private texture: WebGLTexture | null = null
  private previousRamp: Uint8Array | null = null
  private permanentlyDisposed = false

  constructor(canvas: Canvas) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true })
    canvas.addEventListener('webglcontextlost', this.handleLoss)
    canvas.addEventListener('webglcontextrestored', this.handleRestore)
  }

  private handleLoss = (event: Event) => {
    event.preventDefault()
    this.programs.clear()
    this.unavailable.clear()
    this.texture = null
    this.previousRamp = null
  }

  private handleRestore = () => {
    this.previousRamp = null
  }

  get gpu() {
    return !!this.gl && !this.gl.isContextLost() && !this.permanentlyDisposed
  }

  get tileLimit() {
    if (!this.gpu) return 384
    const gl = this.gl!
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array
    return Math.min(1536, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, viewport[0], viewport[1])
  }

  private compile(gl: WebGL2RenderingContext, generator: Generator) {
    const cached = this.programs.get(generator.id)
    if (cached) return cached
    const program = gl.createProgram()
    if (!program) throw new Error('WebGL no pudo crear el programa.')
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment(generator.glsl)]] as const) {
        const shader = gl.createShader(type)
        if (!shader) throw new Error('WebGL no pudo crear el shader.')
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const message = gl.getShaderInfoLog(shader)
          gl.deleteShader(shader)
          throw new Error(message ?? 'Error al compilar GLSL.')
        }
        gl.attachShader(program, shader)
        gl.deleteShader(shader)
      }
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Error de enlace GLSL.')
      const u = Object.fromEntries(uniforms.map((key) => [key, gl.getUniformLocation(program, key)])) as Program['u']
      const compiled = { program, u }
      this.programs.set(generator.id, compiled)
      return compiled
    } catch (error) {
      gl.deleteProgram(program)
      throw error
    }
  }

  draw(recipe: Recipe, tile: Tile, output: Context2D, destX = 0, destY = 0): 'WebGL2' | 'Canvas 2D' {
    const gl = this.gl
    if (gl && this.gpu && !this.unavailable.has(recipe.generator)) {
      try {
        const { width, height, fullWidth, fullHeight, x, y } = tile
        if (this.canvas.width !== width) this.canvas.width = width
        if (this.canvas.height !== height) this.canvas.height = height
        if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) throw new Error('Tamaño de buffer no disponible.')
        const { generator, phase, tilt, scale, dx, dy, ramp } = scene(recipe)
        const { program, u } = this.compile(gl, generator)
        if (!this.texture) this.texture = gl.createTexture()
        if (!this.texture) throw new Error('No se pudo crear la textura cromática.')
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        if (this.previousRamp !== ramp) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 512, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, ramp)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          this.previousRamp = ramp
        }
        gl.disable(gl.DITHER)
        gl.viewport(0, 0, width, height)
        gl.useProgram(program)
        gl.uniform2f(u.uSize, fullWidth, fullHeight)
        gl.uniform2f(u.uOrigin, x, y)
        gl.uniform1f(u.uTileHeight, height)
        gl.uniform4f(u.uParams, ...recipe.parameters)
        gl.uniform4f(u.uLayout, phase, recipe.complexity, recipe.seed & 0xffff, dy)
        gl.uniform4f(u.uGeometry, tilt, scale, dx, symmetryModes.indexOf(recipe.symmetry.mode))
        gl.uniform4f(u.uSym, recipe.symmetry.order, recipe.symmetry.axis, recipe.symmetry.phase, recipe.symmetry.perturbation)
        gl.uniform4f(u.uFinish, finishes.indexOf(recipe.texture.finish), recipe.texture.amount, 0, 0)
        gl.uniform3f(u.uGrades, recipe.contrast, recipe.render.mix, recipe.render.dither ? 1 : 0)
        gl.uniform1i(u.uRamp, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Falló el dibujo en WebGL.')
        output.drawImage(this.canvas, destX, destY)
        return 'WebGL2'
      } catch (error) {
        if (this.gpu) this.unavailable.add(recipe.generator)
        if (import.meta.env.DEV) console.warn('FORMA: se usará Canvas 2D.', error)
      }
    }
    output.putImageData(new ImageData(cpuPixels(recipe, tile), tile.width, tile.height), destX, destY)
    return 'Canvas 2D'
  }

  dispose() {
    const gl = this.gl
    if (gl) {
      for (const { program } of this.programs.values()) gl.deleteProgram(program)
      gl.deleteTexture(this.texture)
    }
    this.programs.clear()
    this.unavailable.clear()
    this.texture = null
    this.previousRamp = null
    this.canvas.removeEventListener('webglcontextlost', this.handleLoss)
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestore)
    this.permanentlyDisposed = true
  }
}

let preview: Renderer | undefined
export function previewRenderer() {
  return preview ??= new Renderer(document.createElement('canvas'))
}
if (import.meta.hot) import.meta.hot.dispose(() => preview?.dispose())
