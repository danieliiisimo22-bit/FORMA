import { mod, rotate, TAU } from './math'
import type { Finish, Symmetry, SymmetryMode } from './types'

export const symmetryNames: Record<SymmetryMode, string> = {
  free: 'Libre', mirror: 'Espejo', horizontal: 'Horizontal', vertical: 'Vertical',
  quadrants: 'Cuadrantes', radial: 'Radial', kaleido: 'Caleidoscópica',
}
export const finishNames: Record<Finish, string> = {
  none: 'Sin textura', fine: 'Grano fino', film: 'Grano de película', halftone: 'Semitono',
  blur: 'Desenfoque', bloom: 'Halo', vignette: 'Viñeta', posterize: 'Posterización',
  print: 'Impresión', analog: 'Papel analógico', aberration: 'Aberración cromática',
}
export const symmetryModes = Object.keys(symmetryNames) as SymmetryMode[]
export const finishes = Object.keys(finishNames) as Finish[]

export function fold(x: number, y: number, symmetry: Symmetry): [number, number] {
  const { mode, order, axis, phase, perturbation } = symmetry
  if (mode === 'free') return [x, y]
  ;[x, y] = rotate(x, y, -axis)
  if (mode === 'horizontal' || mode === 'quadrants') y = Math.abs(y)
  if (mode === 'mirror' || mode === 'vertical' || mode === 'quadrants') x = Math.abs(x)
  if (mode === 'radial' || mode === 'kaleido') {
    const radius = Math.hypot(x, y)
    const sector = TAU / order
    let angle = mod(Math.atan2(y, x) - phase + sector * 0.5, sector) - sector * 0.5
    if (mode === 'kaleido') angle = Math.abs(angle)
    angle += perturbation * 0.25 * Math.sin(radius * 6 + angle * order)
    x = Math.cos(angle) * radius
    y = Math.sin(angle) * radius
  } else {
    x += perturbation * Math.sin(y * 7 + phase) * 0.07
    y += perturbation * Math.sin(x * 7 - phase) * 0.07
  }
  return rotate(x, y, axis)
}
