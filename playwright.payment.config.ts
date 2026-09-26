import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  testMatch: '**/payment.spec.ts',

  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 1 : 0,

  workers: 1,

 reporter: [
  ['html', {
    outputFolder: 'reports/payment-html',
    open: 'never',
  }],
  ['list'],
  ['json', {
    outputFile: 'test-results/payment-results.json',
  }],
],

  use: {
    baseURL:
      process.env.HAPPYPRANCER_BASE_URL ||
      'https://beta.happyprancer.com',

    headless: false,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'on-first-retry',

    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'Payment Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});