import { clamp, randomFrom, TAU } from '../engine/math'
import type { Aspect, Generator, Recipe } from '../engine/types'
import { finishes, symmetryModes } from '../engine/symmetry'
import { generatorById, generators } from '../generators'
import { generateColors, harmonies, paletteByName, palettes, personalities, validHex } from '../palettes'

export const aspects: Aspect[] = ['1:1', '16:9', '9:16', '4:3', '3:2', '21:9', 'custom']
export function createRecipe(generator: Generator, seed: number): Recipe {
  return {
    schema: 1, generator: generator.id, algorithm: generator.version, seed,
    palette: [...paletteByName.get(generator.palette)!.colors], paletteName: generator.palette,
    harmony: 'analog', personality: 'Balanced', paletteLocked: false, colorLocks: [], parameterLocks: [],
    parameters: generator.parameters.map((p) => p.initial) as Recipe['parameters'],
    complexity: 0.56, contrast: 1, saturation: 1,
    symmetry: { mode: 'free', order: 6, axis: 0, phase: 0, perturbation: 0 },
    texture: { ...(generator.presetTexture ?? { finish: 'fine', amount: 0.17 }) }, aspect: '3:2', customAspect: [3, 2],
    render: { dither: true, mix: 0 },
  }
}

export const presets = generators.map((generator) => createRecipe(generator, generator.presetSeed))
export const initialRecipe = presets[0]
export const starterHistory = [presets[0], presets[1], presets[4], presets[2], presets[5]]

export function aspectRatio(recipe: Recipe) {
  const [width, height] = recipe.aspect === 'custom' ? recipe.customAspect : recipe.aspect.split(':').map(Number)
  return width / height
}

export function variant(recipe: Recipe, seed: number, strength = 0.13): Recipe {
  const generator = generatorById.get(recipe.generator)!
  const rng = randomFrom(seed ^ 0xaa94b)
  const parameters = generator.parameters.map((param, index) => {
    const next = recipe.parameters[index] + (rng() - 0.5) * strength
    if (param.choices || recipe.parameterLocks.includes(index)) return recipe.parameters[index]
    const low = Math.min(param.safe[0], recipe.parameters[index])
    const high = Math.max(param.safe[1], recipe.parameters[index])
    return clamp(next, low, high)
  }) as Recipe['parameters']
  return { ...recipe, seed, parameters }
}

export function explore(recipe: Recipe, seed: number): Recipe {
  const rng = randomFrom(seed ^ 0x57d9)
  const options = presets.filter((candidate) => generatorById.get(candidate.generator)!.family === generatorById.get(recipe.generator)!.family)
  const current = options.findIndex((candidate) => candidate.generator === recipe.generator)
  const sibling = recipe.parameterLocks.length || options.length === 1 ? recipe : options[(current + 1) % options.length]
  const next = variant({ ...recipe, generator: sibling.generator, algorithm: sibling.algorithm, parameters: sibling.parameters,
    symmetry: generatorById.get(sibling.generator)!.symmetry.includes(recipe.symmetry.mode)
      ? recipe.symmetry : { ...recipe.symmetry, mode: 'free' } }, seed, 0.68)
  return { ...next, complexity: 0.27 + rng() * 0.51 }
}

export function surprise(recipe: Recipe, seed: number): Recipe {
  const rng = randomFrom(seed)
  const family = generatorById.get(recipe.generator)!.family
  const safe = presets.filter((preset) => {
    const generator = generatorById.get(preset.generator)!
    return generator.family !== family && !generator.intense
  })
  const pick = safe[Math.floor(rng() * safe.length)]
  const next = variant(pick, seed, 0.32)
  const palette = !recipe.paletteLocked && rng() < 0.45 ? palettes[Math.floor(rng() * palettes.length)] : null
  const colors = palette ? generateColors(palette.colors, recipe.personality, recipe.harmony, seed) : next.palette
  return {
    ...next, aspect: recipe.aspect, customAspect: recipe.customAspect,
    personality: recipe.personality, harmony: recipe.harmony,
    paletteName: recipe.paletteLocked || recipe.colorLocks.length ? recipe.paletteName : palette?.name ?? next.paletteName,
    palette: recipe.paletteLocked ? recipe.palette : colors.map((color, i) => recipe.colorLocks.includes(i) ? recipe.palette[i] : color),
    paletteLocked: recipe.paletteLocked, colorLocks: recipe.colorLocks,
  }
}

export function mutate(recipe: Recipe, seed: number, count: number) {
  const rng = randomFrom(seed)
  const seeds = new Set([recipe.seed])
  const variants: Recipe[] = []
  while (variants.length < count) {
    const child = Math.floor(rng() * 0x100000000)
    if (seeds.has(child)) continue
    seeds.add(child)
    variants.push(variant(recipe, child, 0.14 + variants.length / count * 0.31))
  }
  return variants
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const integer = (value: unknown, min: number, max: number): value is number => number(value, min, max) && Number.isInteger(value)
const contains = <T extends string>(options: readonly T[], value: unknown): value is T => options.includes(value as T)
const indices = (value: unknown, max: number): value is number[] =>
  Array.isArray(value) && value.length <= max + 1 && value.every((index) => integer(index, 0, max)) && new Set(value).size === value.length

export function parseRecipe(value: unknown): Recipe {
  const invalid = () => new Error('La receta es inválida o pertenece a una versión incompatible.')
  if (!record(value) || value.schema !== 1 || typeof value.generator !== 'string') throw invalid()
  const generator = generatorById.get(value.generator)
  const { seed, palette, paletteName, harmony, personality, paletteLocked, colorLocks, parameterLocks,
    parameters, complexity, contrast, saturation, symmetry, texture, aspect, customAspect, render } = value
  if (!generator || value.algorithm !== generator.version || !integer(seed, 0, 0xffffffff)
    || !Array.isArray(palette) || palette.length !== 5 || !palette.every(validHex)
    || typeof paletteName !== 'string' || !paletteName.trim() || paletteName.length > 70
    || !contains(Object.keys(harmonies) as Recipe['harmony'][], harmony) || !contains(personalities, personality)
    || typeof paletteLocked !== 'boolean' || !indices(colorLocks, 4) || !indices(parameterLocks, 3)
    || !Array.isArray(parameters) || parameters.length !== 4 || !parameters.every((p) => number(p, 0, 1))
    || !number(complexity, 0, 1) || !number(contrast, 0.45, 1.65) || !number(saturation, 0, 1.65)
    || !record(symmetry) || !contains(symmetryModes, symmetry.mode) || !generator.symmetry.includes(symmetry.mode)
    || !integer(symmetry.order, 2, 16) || !number(symmetry.axis, -TAU, TAU) || !number(symmetry.phase, -TAU, TAU)
    || !number(symmetry.perturbation, 0, 1)
    || !record(texture) || !contains(finishes, texture.finish) || !number(texture.amount, 0, 1)
    || !contains(aspects, aspect) || !Array.isArray(customAspect) || customAspect.length !== 2
    || !customAspect.every((n) => integer(n, 1, 100)) || customAspect[0] / customAspect[1] > 8 || customAspect[1] / customAspect[0] > 8
    || !record(render) || typeof render.dither !== 'boolean' || !number(render.mix, 0, 1)) throw invalid()
  return {
    schema: 1, generator: generator.id, algorithm: generator.version, seed, palette: [...palette], paletteName,
    harmony, personality, paletteLocked, colorLocks: [...colorLocks], parameterLocks: [...parameterLocks],
    parameters: [...parameters] as Recipe['parameters'], complexity, contrast, saturation,
    symmetry: { mode: symmetry.mode, order: symmetry.order, axis: symmetry.axis, phase: symmetry.phase, perturbation: symmetry.perturbation },
    texture: { finish: texture.finish, amount: texture.amount }, aspect, customAspect: [...customAspect] as [number, number],
    render: { dither: render.dither, mix: render.mix },
  }
}
