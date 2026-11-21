import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const localChrome = process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app')
const desktop = process.env.FORMA_DESKTOP === '1'
const origin = desktop ? 'http://127.0.0.1:56144' : 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  grepInvert: desktop ? /@gallery/ : undefined,
  use: {
    ...devices['Desktop Chrome'],
    channel: (process.env.FORMA_BROWSER ?? (localChrome ? 'chrome' : 'chromium')) === 'chrome' ? 'chrome' : undefined,
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    baseURL: origin,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: desktop
      ? (process.platform === 'win32' ? '.\\target\\release\\forma.exe --no-open' : './target/release/forma --no-open')
      : 'node node_modules/vite/bin/vite.js --host 127.0.0.1',
    url: origin,
    reuseExistingServer: !desktop && !process.env.CI,
    timeout: 20_000,
  },
})
