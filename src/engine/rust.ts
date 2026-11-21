import { useRustRandomWord } from './math'

const enabled = import.meta.env.VITE_FORMA_RUST_CORE === '1'
let ready: Promise<void> | undefined

export function loadRustCore() {
  if (!enabled) return Promise.resolve()
  return ready ??= WebAssembly.instantiateStreaming(fetch('/forma-core.wasm'), {}).then(({ instance }) => {
    const mixWord = instance.exports.forma_random_word
    if (typeof mixWord !== 'function') throw new Error('La función de semillas no está disponible.')
    useRustRandomWord(mixWord as (state: number) => number)
  })
}
