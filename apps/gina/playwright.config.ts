import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    baseURL: process.env.APP_URL || 'http://127.0.0.1:4192/gina/',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-MX',
    timezoneId: 'America/Mazatlan',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: process.env.APP_URL ? undefined : {
    command: 'npm run preview -- --configLoader runner',
    url: 'http://127.0.0.1:4192/gina/',
    timeout: 30_000,
    reuseExistingServer: false,
  },
});
