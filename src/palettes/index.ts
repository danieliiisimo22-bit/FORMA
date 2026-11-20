import { clamp, mix, mod, randomFrom, TAU } from '../engine/math'
import type { Harmony, Personality } from '../engine/types'

export type Color3 = [number, number, number]
export interface Palette { name: string; colors: string[] }
const curated = [
  ['Brasa', '#140c18', '#3c172d', '#a43630', '#ef773f', '#ffd5a2'],
  ['Violeta', '#201634', '#49255d', '#884c9b', '#c97ba9', '#fbd2af'],
  ['Abisal', '#071522', '#102f4c', '#185d77', '#37a3a2', '#cceccf'],
  ['Bauhaus', '#202326', '#2d5f94', '#bf3b30', '#e6aa3d', '#f4e7cb'],
  ['Luz gótica', '#161222', '#383259', '#5e6cae', '#bf86c7', '#ffdbc6'],
  ['Tinta índigo', '#121321', '#2f364f', '#5b63a0', '#a2a9cb', '#ece9e2'],
  ['Glaciar', '#141d2a', '#263b5c', '#4a7395', '#8eb6bf', '#e7e3d0'],
  ['Mandarina', '#462127', '#a63747', '#ed6144', '#f4a761', '#f9e2aa'],
  ['Prisma', '#261b49', '#5e4eb1', '#50a4b1', '#a5d6b3', '#f6d5a9'],
  ['Cal y óxido', '#2d2223', '#733923', '#a66441', '#d2a477', '#f4e3c8'],
  ['Liquen', '#172722', '#2b5141', '#62896a', '#aac086', '#eeeac3'],
  ['Ultramar', '#11132d', '#292261', '#3f53b0', '#ae85ca', '#f3c4a7'],
  ['Pizarra', '#121518', '#30383b', '#586063', '#9ba09e', '#eaeee5'],
  ['Marfil', '#392d2a', '#69534b', '#a38369', '#cbb79b', '#fbf2dd'],
  ['Cobalto', '#121727', '#202e5e', '#353eb1', '#7c88f0', '#d0deff'],
  ['Limón negro', '#171d16', '#39462b', '#718142', '#aabd58', '#e6f58f'],
  ['Niebla rosa', '#301c2a', '#644354', '#aa7385', '#d9a5a4', '#f5d8c8'],
  ['Marea', '#102429', '#204b50', '#438583', '#8ebeb0', '#e6eac3'],
  ['Terracota', '#211719', '#573432', '#985747', '#ca886a', '#f7cda1'],
  ['Uva ácida', '#20132c', '#54245f', '#986498', '#bc972c', '#f3e984'],
  ['Menta', '#172927', '#305346', '#579677', '#97d1a5', '#e5f7d8'],
  ['Órbita', '#10121a', '#302754', '#66518e', '#bc6790', '#ffb47c'],
  ['Café frío', '#211719', '#4e3734', '#81615a', '#b18e7d', '#dfc4a8'],
  ['Papel salmón', '#37202b', '#71454e', '#ad6b68', '#de9c89', '#ffe0be'],
  ['Lago mineral', '#162829', '#274b52', '#416d86', '#8697b3', '#c9d2d1'],
  ['Oro viejo', '#231e1d', '#5a452c', '#967144', '#d0ac6b', '#f5e3aa'],
  ['Lila pálido', '#292637', '#4e4569', '#8277a0', '#b5aacc', '#e9e2ee'],
  ['Escarlata', '#280d1b', '#661c36', '#b3354d', '#ed675b', '#fbcaa4'],
  ['Celadón', '#1c2d26', '#385441', '#648062', '#a4b591', '#e2e7c4'],
  ['Espectro', '#171625', '#443f7a', '#5876ac', '#cf758f', '#ffd588'],
  ['Mediodía', '#422521', '#915028', '#d88428', '#f4bc51', '#fff0b6'],
  ['Mar profundo', '#0e1926', '#1b3444', '#22587b', '#3299a3', '#b9e4de'],
] as const
export const palettes: Palette[] = curated.map(([name, ...colors]) => ({ name, colors }))
export const paletteByName = new Map(palettes.map((palette) => [palette.name, palette]))
export const personalities: Personality[] = ['Calm', 'Balanced', 'Bold', 'Editorial', 'Retro', 'Nocturne', 'Solar', 'Chromatic']
export const harmonies: Record<Harmony, string> = {
  mono: 'Monocromática', analog: 'Análoga', complement: 'Complementaria', split: 'Complementaria dividida',
  triad: 'Triádica', tetrad: 'Tetrádica', tonal: 'Escala tonal', duotone: 'Duotono', controlled: 'Tríada controlada',
}

const harmonyOffsets: Record<Harmony, number[]> = {
  mono: [0, 0, 0, 0, 0], analog: [-18, -28, 0, 20, 37], complement: [180, 164, 0, 12, 182],
  split: [152, 205, 0, 13, 149], triad: [238, 120, 0, 113, 246], tetrad: [92, 180, 0, 272, 12],
  tonal: [4, 2, 0, -3, -8], duotone: [150, 150, 0, 0, 0], controlled: [132, 115, 0, 25, 231],
}

type Profile = { lights: number[]; chroma: number; shift: number; harmony: Harmony }
const profiles: Record<Personality, Profile> = {
  Calm: { lights: [0.33, 0.49, 0.65, 0.78, 0.94], chroma: 0.085, shift: -9, harmony: 'analog' },
  Balanced: { lights: [0.15, 0.30, 0.53, 0.71, 0.89], chroma: 0.15, shift: 0, harmony: 'analog' },
  Bold: { lights: [0.13, 0.29, 0.52, 0.71, 0.93], chroma: 0.26, shift: 7, harmony: 'split' },
  Editorial: { lights: [0.16, 0.32, 0.52, 0.69, 0.91], chroma: 0.10, shift: -4, harmony: 'duotone' },
  Retro: { lights: [0.21, 0.37, 0.57, 0.73, 0.90], chroma: 0.14, shift: 22, harmony: 'controlled' },
  Nocturne: { lights: [0.10, 0.20, 0.40, 0.62, 0.83], chroma: 0.20, shift: -27, harmony: 'complement' },
  Solar: { lights: [0.27, 0.46, 0.67, 0.81, 0.97], chroma: 0.18, shift: 23, harmony: 'analog' },
  Chromatic: { lights: [0.17, 0.34, 0.58, 0.75, 0.91], chroma: 0.22, shift: 0, harmony: 'tetrad' },
}
export const defaultHarmony = (personality: Personality) => profiles[personality].harmony
export const validHex = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

const toLinear = (x: number) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
const toSrgb = (x: number) => x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
export const hexToRgb = (hex: string): Color3 => [
  parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255,
]
export const rgbToHex = (rgb: Color3) =>
  '#' + rgb.map((x) => Math.round(clamp(x) * 255).toString(16).padStart(2, '0')).join('')

export function rgbToLab(rgb: Color3): Color3 {
  const [r, g, b] = rgb.map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

function labToLinear([L, a, b]: Color3): Color3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

export function labToRgb([lightness, a, b]: Color3): Color3 {
  const L = clamp(lightness)
  const linear = (factor: number) => labToLinear([L, a * factor, b * factor])
  const inGamut = (rgb: Color3) => rgb.every((channel) => channel >= -1e-7 && channel <= 1 + 1e-7)
  let rgb = linear(1)
  if (!inGamut(rgb)) {
    let low = 0
    let high = 1
    for (let i = 0; i < 15; i++) {
      const candidate = (low + high) * 0.5
      if (inGamut(linear(candidate))) low = candidate
      else high = candidate
    }
    rgb = linear(low)
  }
  return rgb.map((channel) => toSrgb(clamp(channel))) as Color3
}

export function lchToLab(L: number, C: number, H: number): Color3 {
  const rad = H * TAU / 360
  return [L, C * Math.cos(rad), C * Math.sin(rad)]
}

export function generateColors(base: string[], personality: Personality, harmony: Harmony, seed: number, locks: number[] = []) {
  const profile = profiles[personality]
  const rng = randomFrom(seed ^ 0x6576c9f7)
  const [, a, b] = rgbToLab(hexToRgb(base[2]))
  const baseHue = Math.hypot(a, b) < 0.015 ? rng() * 360 : Math.atan2(b, a) * 360 / TAU
  const dominant = mod(baseHue + (rng() - 0.5) * 64 + profile.shift, 360)
  const weights = [0.37, 0.56, 1, 0.79, 0.43]
  const offsets = harmonyOffsets[harmony]
  return weights.map((weight, i) => {
    const L = clamp(profile.lights[i] + (rng() - 0.5) * 0.07)
    const C = profile.chroma * weight * (0.86 + rng() * 0.28)
    const H = dominant + offsets[i] + (rng() - 0.5) * (harmony === 'mono' ? 0 : 8)
    return locks.includes(i) ? base[i] : rgbToHex(labToRgb(lchToLab(L, C, H)))
  })
}

export function buildRamp(colors: string[], saturation: number) {
  const stops = colors.map((hex) => {
    const [L, a, b] = rgbToLab(hexToRgb(hex))
    return [L, a * saturation, b * saturation]
  })
  const size = 512
  const ramp = new Uint8Array(size * 4)
  for (let i = 0; i < size; i++) {
    const p = i / (size - 1) * (stops.length - 1)
    const index = Math.min(stops.length - 2, Math.floor(p))
    const fraction = p - index
    const lab = stops[index].map((component, j) => mix(component, stops[index + 1][j], fraction)) as Color3
    const rgb = labToRgb(lab)
    for (let j = 0; j < 3; j++) ramp[i * 4 + j] = Math.round(rgb[j] * 255)
    ramp[i * 4 + 3] = 255
  }
  return ramp
}

export function extractColors(pixels: Uint8ClampedArray) {
  const samples: Color3[] = []
  const stride = Math.max(1, Math.ceil(pixels.length / 4 / 1800)) * 4
  for (let i = 0; i < pixels.length; i += stride) {
    samples.push(rgbToLab([pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255]))
  }
  if (!samples.length) return [...palettes[0].colors]
  samples.sort((a, b) => a[0] - b[0])
  return [0.04, 0.22, 0.51, 0.78, 0.96].map((quantile) =>
    rgbToHex(labToRgb(samples[Math.round(quantile * (samples.length - 1))])))
}
