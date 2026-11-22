import type { Family } from '../generators/families'
export type SymmetryMode = 'free' | 'mirror' | 'horizontal' | 'vertical' | 'quadrants' | 'radial' | 'kaleido'
export type Finish = 'none' | 'fine' | 'film' | 'halftone' | 'blur' | 'bloom' | 'vignette' | 'posterize' | 'print' | 'analog' | 'aberration'
export type Harmony = 'mono' | 'analog' | 'complement' | 'split' | 'triad' | 'tetrad' | 'tonal' | 'duotone' | 'controlled'
export type Personality = 'Calm' | 'Balanced' | 'Bold' | 'Editorial' | 'Retro' | 'Nocturne' | 'Solar' | 'Chromatic'
export type Aspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:2' | '21:9' | 'custom'

export interface Symmetry {
  mode: SymmetryMode
  order: number
  axis: number
  phase: number
  perturbation: number
}

export interface Recipe {
  schema: 1
  generator: string
  algorithm: 1
  seed: number
  palette: string[]
  paletteName: string
  harmony: Harmony
  personality: Personality
  paletteLocked: boolean
  colorLocks: number[]
  parameters: [number, number, number, number]
  parameterLocks: number[]
  complexity: number
  contrast: number
  saturation: number
  symmetry: Symmetry
  texture: { finish: Finish; amount: number }
  aspect: Aspect
  customAspect: [number, number]
  render: { dither: boolean; mix: number }
}

export interface Parameter {
  label: string
  description: string
  initial: number
  safe: readonly [number, number]
  choices?: readonly string[]
}

export interface Generator {
  id: string
  version: 1
  family: Family
  name: string
  description: string
  palette: string
  presetSeed: number
  presetTexture?: Recipe['texture']
  parameters: readonly [Parameter, Parameter, Parameter, Parameter]
  symmetry: readonly SymmetryMode[]
  intense?: boolean
  glsl: string
  sample: (x: number, y: number, a: number, b: number, c: number, d: number, complexity: number, phase: number) => number
}
