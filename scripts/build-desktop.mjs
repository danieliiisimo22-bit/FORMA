import { spawnSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const cargo = process.env.FORMA_CARGO || 'cargo'
const npm = process.env.npm_execpath

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(cargo, ['build', '--locked', '--release', '-p', 'forma-core', '--target', 'wasm32-unknown-unknown'])
process.env.VITE_FORMA_RUST_CORE = '1'
run(process.execPath, [npm, 'run', 'build'])
copyFileSync('target/wasm32-unknown-unknown/release/forma_core.wasm', 'dist/forma-core.wasm')
run(cargo, ['build', '--locked', '--release', '-p', 'forma'])
