
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import {
  getInstitution,
  playwrightEnv,
} from './config/institution-config';

dotenv.config();

if (process.env.INSTITUTION) {
  Object.assign(process.env, playwrightEnv(getInstitution(process.env.INSTITUTION)));
}

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/login.spec.ts', '**/signup.spec.ts'],
  testIgnore: ['**/example.spec.ts', '**/responsive.spec.ts'],
  grep: /LOGIN-|SIGNUP-/,

  fullyParallel: true,

  timeout: 30 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  // =====================================================
  // REPORTERS
  // =====================================================

  reporter: [
    // HTML report
    [
      'html',
      {
        outputFolder: 'reports/html',
        open: 'never',
      },
    ],

    // Console report
    ['list'],

    // JSON report for Excel conversion
    [
      'json',
      {
        outputFile: 'test-results/results.json',
      },
    ],
  ],

  // =====================================================
  // COMMON PLAYWRIGHT SETTINGS
  // =====================================================

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',

    trace: 'on-first-retry',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',
  },

  // =====================================================
  // PROJECTS
  // =====================================================

  projects: [

    // ===================================================
    // DESKTOP
    // ===================================================

    {
      name: 'Desktop Chrome',

      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // ===================================================
    // TABLET
    // ===================================================

    {
      name: 'Tablet',

      use: {
        ...devices['iPad (gen 7)'],
      },
    },

    // ===================================================
    // MOBILE
    // ===================================================

    {
      name: 'Mobile Chrome',

      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
});

