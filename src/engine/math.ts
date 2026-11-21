export const TAU = Math.PI * 2
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const fract = (value: number) => value - Math.floor(value)
export const mod = (value: number, divisor: number) => value - divisor * Math.floor(value / divisor)
export const smooth = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function hash(x: number, y: number) {
  let a = fract(x * 0.1031)
  let b = fract(y * 0.1031)
  let c = a
  const dot = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += dot
  b += dot
  c += dot
  return fract((a + b) * c)
}

export function noise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(0, 1, fract(x))
  const fy = smooth(0, 1, fract(y))
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), fx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy)
}

export function fbm(x: number, y: number) {
  return 0.57 * noise(x, y) + 0.28 * noise(2.07 * x + 7.2, 2.07 * y + 3.1) + 0.15 * noise(4.17 * x - 2.3, 4.17 * y + 8.4)
}

export function randomWordTs(state: number) {
  let t = Math.imul(state ^ (state >>> 15), state | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (t ^ (t >>> 14)) >>> 0
}

let randomWord = randomWordTs

export function useRustRandomWord(mixWord: typeof randomWordTs) {
  randomWord = (state) => mixWord(state) >>> 0
}

export function randomFrom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    return randomWord(state) / 4294967296
  }
}

export function freshSeed() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
}

export function rotate(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c - y * s, x * s + y * c]
}
