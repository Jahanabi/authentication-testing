import { test, expect, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { LoginPage } from '../pages/login.page';

dotenv.config();

const baseUrl = process.env.BASE_URL;
const validEmail = process.env.LOGIN_EMAIL;
const validPassword = process.env.LOGIN_PASSWORD;

if (!baseUrl) {
  throw new Error('BASE_URL is missing in .env file');
}

if (!validEmail) {
  throw new Error('LOGIN_EMAIL is missing in .env file');
}

if (!validPassword) {
  throw new Error('LOGIN_PASSWORD is missing in .env file');
}


// =====================================================
// DESKTOP
// =====================================================

const desktopTest = test.extend({});

desktopTest.use({
  ...devices['Desktop Chrome'],
});

desktopTest(
  'RESP-001 - Login functionality on Desktop',
  async ({ page }) => {
    const loginPage = new LoginPage(page);

    console.log('====================================');
    console.log('Testing Login on DESKTOP');
    console.log('====================================');

    await page.goto(baseUrl!, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Verify login page
    await expect(loginPage.getEmailInput()).toBeVisible({
      timeout: 10000,
    });

    await expect(loginPage.getPasswordInput()).toBeVisible({
      timeout: 10000,
    });

    // Verify login button
    await expect(loginPage.getLoginButton()).toBeVisible({
      timeout: 10000,
    });

    // Perform login
    await loginPage.login(
      validEmail!,
      validPassword!
    );

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    console.log(
      'RESP-001: Desktop login test completed successfully'
    );
  }
);


// =====================================================
// TABLET
// =====================================================

const tabletTest = test.extend({});

tabletTest.use({
  ...devices['iPad (gen 7)'],
});

tabletTest(
  'RESP-002 - Login functionality on Tablet',
  async ({ page }) => {
    const loginPage = new LoginPage(page);

    console.log('====================================');
    console.log('Testing Login on TABLET');
    console.log('====================================');

    await page.goto(baseUrl!, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Verify login page
    await expect(loginPage.getEmailInput()).toBeVisible({
      timeout: 10000,
    });

    await expect(loginPage.getPasswordInput()).toBeVisible({
      timeout: 10000,
    });

    // Verify login button
    await expect(loginPage.getLoginButton()).toBeVisible({
      timeout: 10000,
    });

    // Perform login
    await loginPage.login(
      validEmail!,
      validPassword!
    );

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    console.log(
      'RESP-002: Tablet login test completed successfully'
    );
  }
);


// =====================================================
// MOBILE
// =====================================================

const mobileTest = test.extend({});

mobileTest.use({
  ...devices['Pixel 5'],
});

mobileTest(
  'RESP-003 - Login functionality on Mobile',
  async ({ page }) => {
    const loginPage = new LoginPage(page);

    console.log('====================================');
    console.log('Testing Login on MOBILE');
    console.log('====================================');

    await page.goto(baseUrl!, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Verify login page
    await expect(loginPage.getEmailInput()).toBeVisible({
      timeout: 10000,
    });

    await expect(loginPage.getPasswordInput()).toBeVisible({
      timeout: 10000,
    });

    // Verify login button
    await expect(loginPage.getLoginButton()).toBeVisible({
      timeout: 10000,
    });

    // Perform login
    await loginPage.login(
      validEmail!,
      validPassword!
    );

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    console.log(
      'RESP-003: Mobile login test completed successfully'
    );
  }
);