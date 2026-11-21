import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomWordTs } from '../src/engine/math.ts'

const wasm = await readFile(new URL('../dist/forma-core.wasm', import.meta.url))
const { instance } = await WebAssembly.instantiate(wasm)
const randomWord = instance.exports.forma_random_word

function check(state) {
  assert.equal(randomWord(state) >>> 0, randomWordTs(state), `Estado ${state}`)
}

for (const edge of [0, 1, 482901, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff]) check(edge)
let state = 0
for (let i = 0; i < 65536; i++) {
  state = (state + 0x6d2b79f5) >>> 0
  check(state)
}
console.log('Semillas: 65 543 estados idénticos entre FORMA TypeScript y Rust/WASM.')
