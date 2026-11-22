import init, { start } from './forma_studio.js'

try {
  await init()
  start()
} catch (error) {
  document.querySelector('#root').textContent = 'FORMA no pudo iniciar. Abre el estudio por HTTP en un navegador compatible con WebAssembly.'
  console.error(error)
}
