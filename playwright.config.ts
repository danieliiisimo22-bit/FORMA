import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const localChrome = process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app')

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: (process.env.FORMA_BROWSER ?? (localChrome ? 'chrome' : 'chromium')) === 'chrome' ? 'chrome' : undefined,
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    baseURL: 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
})
