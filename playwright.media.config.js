// @ts-check
import { defineConfig, devices } from '@playwright/test';

const mediaPort = Number(process.env.MEDIA_PORT || 47639);

export default defineConfig({
  testDir: './test/media',
  outputDir: './test-results/media',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${mediaPort}`,
    trace: 'off',
    screenshot: 'off',
    video: 'on',
    colorScheme: 'light',
    viewport: { width: 1440, height: 960 },
    launchOptions: {
      slowMo: process.env.CI ? 0 : 125,
    },
  },
  webServer: {
    command: `MEDIA_PORT=${mediaPort} ./scripts/start-media-sandbox.sh`,
    port: mediaPort,
    timeout: 120_000,
    reuseExistingServer: !!process.env.MEDIA_REUSE_EXISTING,
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
