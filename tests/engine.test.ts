import { describe, expect, it } from 'vitest'
import { randomFrom, TAU } from '../src/engine/math'
import { fullTile, cpuPixels } from '../src/engine/render'
import { fold } from '../src/engine/symmetry'
import { generatorById, generators } from '../src/generators'
import { buildRamp, generateColors, harmonies, hexToRgb, labToRgb, lchToLab, palettes, personalities, rgbToHex, rgbToLab } from '../src/palettes'
import { explore, initialRecipe, mutate, parseRecipe, presets, surprise, variant } from '../src/presets/recipes'
import { resolution, validateSize } from '../src/export/image'

describe('determinismo y composición', () => {
  it('produce una secuencia estable de enteros para cada semilla', () => {
    const rng = randomFrom(482901)
    const known = [3379038118, 2876805299, 388268013]
    const outputs = known.map(() => Math.floor(rng() * 0x100000000))
    expect(outputs).toEqual(known)
    expect(randomFrom(0)()).not.toBe(randomFrom(482901)())
  })

  it.each(presets)('$generator es reproducible, aporta una distribución visible y responde a la semilla', (recipe) => {
    const tile = fullTile(61, 43)
    const pixels = cpuPixels(recipe, tile)
    expect(pixels).toEqual(cpuPixels(recipe, tile))
    const child = cpuPixels(variant(recipe, (recipe.seed + 35611) >>> 0), tile)
    let distance = 0
    const colors = new Set<string>()
    for (let i = 0; i < pixels.length; i += 4) {
      distance += Math.abs(child[i] - pixels[i]) + Math.abs(child[i + 1] - pixels[i + 1]) + Math.abs(child[i + 2] - pixels[i + 2])
      colors.add(pixels.slice(i, i + 3).join(','))
    }
    expect(colors.size).toBeGreaterThan(20)
    expect(distance / (tile.width * tile.height * 3)).toBeGreaterThan(2)
  })

  it('mantiene coordenadas y grano entre tiles', () => {
    const whole = cpuPixels(initialRecipe, fullTile(121, 83))
    const tile = cpuPixels(initialRecipe, { width: 13, height: 56, x: 48, y: 13, fullWidth: 121, fullHeight: 83 })
    for (let line = 0; line < 56; line++) {
      const start = ((line + 13) * 121 + 48) * 4
      expect(tile.slice(line * 52, (line + 1) * 52)).toEqual(whole.slice(start, start + 52))
    }
  })

  it('respeta bloqueos y diferencia operaciones de exploración', () => {
    const recipe = { ...initialRecipe, paletteLocked: true, parameterLocks: [0, 2] }
    const child = variant(recipe, 33)
    const descendants = mutate(recipe, 9384567, 16)
    expect(new Set(descendants.map((item) => item.seed)).size).toBe(16)
    expect(descendants).toEqual(mutate(recipe, 9384567, 16))
    for (const composition of [child, ...descendants]) {
      expect(composition.generator).toBe(recipe.generator)
      expect(composition.palette).toBe(recipe.palette)
      expect(composition.parameters[0]).toBe(recipe.parameters[0])
      expect(composition.parameters[2]).toBe(recipe.parameters[2])
    }
    const explored = explore(initialRecipe, 55)
    expect(explored.generator).not.toBe(initialRecipe.generator)
    expect(generatorById.get(explored.generator)?.family).toBe('Fluidos')
    expect(surprise(recipe, 777).palette).toBe(recipe.palette)
    expect(generatorById.get(surprise(recipe, 777).generator)?.family).not.toBe('Fluidos')
  })
})

describe('color y recetas', () => {
  it('reconvierte colores sRGB y reduce croma fuera de gamut sin cambiar el tono', () => {
    expect(palettes.length).toBeGreaterThanOrEqual(30)
    for (const { colors } of palettes) {
      for (const color of colors) expect(rgbToHex(labToRgb(rgbToLab(hexToRgb(color))))).toBe(color)
    }
    const rgb = labToRgb(lchToLab(0.71, 0.55, 32))
    expect(rgb.every((channel) => channel >= 0 && channel <= 1)).toBe(true)
    const [light, a, b] = rgbToLab(rgb)
    expect(light).toBeCloseTo(0.71, 4)
    expect(Math.atan2(b, a) * 360 / TAU).toBeCloseTo(32, 3)
    const ramp = buildRamp(palettes[0].colors, 1)
    expect(ramp).toHaveLength(512 * 4)
    expect(ramp.slice(0, 3)).toEqual(Uint8Array.of(20, 12, 24))
  })

  it('hace reproducibles armonías, personalidades y colores bloqueados', () => {
    const base = palettes[0].colors
    const variants = personalities.map((personality) => generateColors(base, personality, 'analog', 33862, [1, 4]))
    expect(new Set(variants.map((colors) => colors.join())).size).toBe(personalities.length)
    for (const colors of variants) {
      expect(colors[1]).toBe(base[1])
      expect(colors[4]).toBe(base[4])
      for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
    const results = (Object.keys(harmonies) as (keyof typeof harmonies)[]).map((harmony) => generateColors(base, 'Bold', harmony, 15))
    expect(new Set(results.map((colors) => colors.join())).size).toBe(Object.keys(harmonies).length)
  })

  it('valida recetas serializadas y rechaza versiones o valores incompatibles', () => {
    expect(generators).toHaveLength(22)
    for (const preset of presets) expect(parseRecipe(JSON.parse(JSON.stringify(preset)))).toEqual(preset)
    expect(() => parseRecipe({ ...initialRecipe, algorithm: 2 })).toThrow()
    expect(() => parseRecipe({ ...initialRecipe, seed: -1 })).toThrow()
    expect(() => parseRecipe({ ...initialRecipe, palette: ['#FFAA00'] })).toThrow()
    expect(() => parseRecipe({ ...initialRecipe, customAspect: [100, 1] })).toThrow()
  })
})

describe('geometría y exportación', () => {
  it('conserva los ejes y los sectores matemáticos', () => {
    const s = initialRecipe.symmetry
    expect(fold(1, 0.5, { ...s, mode: 'mirror' })).toEqual(fold(-1, 0.5, { ...s, mode: 'mirror' }))
    expect(fold(1, 0.5, { ...s, mode: 'horizontal' })).toEqual(fold(1, -0.5, { ...s, mode: 'horizontal' }))
    const radial = { ...s, mode: 'radial' as const, order: 7, phase: 0.16, axis: -0.8, perturbation: 0.16 }
    const sector = TAU / radial.order
    for (let i = 0; i < 7; i++) {
      const point = fold(Math.cos(0.61 + sector * i), Math.sin(0.61 + sector * i), radial)
      const expected = fold(Math.cos(0.61), Math.sin(0.61), radial)
      expect(point[0]).toBeCloseTo(expected[0], 9)
      expect(point[1]).toBeCloseTo(expected[1], 9)
    }
  })

  it('respeta las dimensiones nominales y limita opciones de alta resolución', () => {
    expect(resolution({ ...initialRecipe, aspect: '16:9' }, 1080)).toEqual([1920, 1080])
    expect(resolution({ ...initialRecipe, aspect: '9:16' }, 1440)).toEqual([1440, 2560])
    expect(resolution({ ...initialRecipe, aspect: '16:9' }, 4320)).toEqual([7680, 4320])
    expect(() => validateSize(...resolution({ ...initialRecipe, aspect: '21:9' }, 4320))).not.toThrow()
    expect(() => validateSize(8192, 8192)).toThrow()
    expect(() => validateSize(0, 800)).toThrow()
  })
})
