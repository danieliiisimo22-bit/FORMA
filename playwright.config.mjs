import { defineConfig, devices } from "@playwright/test";
const port = 56147;
const origin = "http://127.0.0.1:" + port;
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs",
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.FORMA_BROWSER === "chrome" ? "chrome" : undefined,
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    baseURL: origin,
    screenshot: "only-on-failure"
  },
  webServer: {
    command: (process.platform === "win32" ? ".\\target\\release\\forma.exe" : "./target/release/forma") + " --no-open --port " + port,
    url: origin,
    reuseExistingServer: false,
    timeout: 20_000
  }
});
