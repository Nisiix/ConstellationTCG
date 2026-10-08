import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a production build (`pnpm build` first) serving the bundled Base
 * Set fixture from a throwaway embedded database under `.data/e2e`. `e2e/serve.mjs` prepares the
 * data and starts the server. Set `PLAYWRIGHT_CHROMIUM_PATH` to use a pre-installed browser.
 */
const PORT = Number(process.env.E2E_PORT ?? 3101)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
