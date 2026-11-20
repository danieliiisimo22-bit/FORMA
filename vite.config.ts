import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwind()],
  server: { port: 5173, strictPort: true },
  test: { include: ['tests/**/*.test.ts'] },
})
