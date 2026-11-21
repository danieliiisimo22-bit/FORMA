import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadRustCore } from './engine/rust'
import './styles.css'

const root = document.getElementById('root')!

async function start() {
  await loadRustCore()
  const { default: App } = await import('./App')
  createRoot(root).render(<StrictMode><App /></StrictMode>)
}

void start().catch((error: unknown) => {
  console.error(error)
  root.setAttribute('role', 'alert')
  root.textContent = 'No se pudo iniciar FORMA. Recarga la página para volver a intentarlo.'
})
