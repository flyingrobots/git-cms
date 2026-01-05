// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  globalSetup: './test/e2e/global-setup.js',
  fullyParallel: false, // Serial for now to avoid repo race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for git repo safety
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4638',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'GIT_CMS_REPO=./test-repo PORT=4638 npm run serve',
    port: 4638,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
