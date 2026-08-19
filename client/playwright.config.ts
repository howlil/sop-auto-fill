import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const clientDir = fileURLToPath(new URL('.', import.meta.url))
const authState = fileURLToPath(new URL('./e2e/.auth/user.json', import.meta.url))
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const startClient = process.env.E2E_SKIP_WEB_SERVER !== 'true'
const criticalAudit = process.env.E2E_CRITICAL === 'true'
const useHostedChrome = Boolean(process.env.CI)

export default defineConfig({
  testDir: fileURLToPath(new URL('./e2e', import.meta.url)),
  testMatch: [
    'journeys/mvp-vertical-slice.spec.ts',
    'journeys/ai-assisted-draft.spec.ts',
    'journeys/ai-sop-quality-review.spec.ts',
  ],
  globalSetup: fileURLToPath(new URL('./e2e/global-setup.ts', import.meta.url)),
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: criticalAudit ? 0 : process.env.CI ? 1 : 0,
  maxFailures: criticalAudit ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    storageState: authState,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: startClient
    ? {
        command: 'pnpm dev --host 0.0.0.0',
        cwd: clientDir,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(useHostedChrome ? { channel: 'chrome' as const } : {}),
      },
    },
    ...(process.env.E2E_ALL_BROWSERS === 'true'
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
          {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 7'] },
          },
        ]
      : []),
  ],
})
