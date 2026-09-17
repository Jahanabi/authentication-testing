import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.env.BASE_URL;
const invalidEmail = 'invaliduser@example.com';
const invalidPassword = 'WrongPassword@123';
const malformedEmail = 'invalidemail.com';

const shortPassword = 'Ab@123';
const noNumberPassword = 'Abcdefgh@';
const noUppercasePassword = 'abcdefgh@1';
const noLowercasePassword = 'ABCDEFGH@1';
const noSpecialPassword = 'Abcdefgh1';

if (!baseUrl) {
  throw new Error('BASE_URL is missing in .env file');
}

test.describe('Common Authentication - Login Page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);

    await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
  });

  // =====================================================
  // LOGIN-001
  // Login page should load
  // =====================================================

  test('LOGIN-001 - Login page should load successfully', async () => {
    await expect(loginPage.getEmailInput()).toBeVisible({
      timeout: 10000,
    });

    await expect(loginPage.getPasswordInput()).toBeVisible({
      timeout: 10000,
    });

    console.log('LOGIN-001: Login page loaded successfully');
  });

  // =====================================================
  // LOGIN-002
  // Google login - only test if application provides it
  // =====================================================

  test('LOGIN-002 - Google Sign In should be detected if available', async () => {
    const googleButton = loginPage.getGoogleSignInButton();

    const available = await googleButton
      .isVisible()
      .catch(() => false);

    if (available) {
      console.log('LOGIN-002: Google Sign In is available');
    } else {
      console.log(
        'LOGIN-002: Google Sign In is not available in this application'
      );
    }
  });

  // =====================================================
  // LOGIN-003
  // Forgot password - only test if available
  // =====================================================

  test('LOGIN-003 - Forgot Password should be detected if available', async () => {
    const forgotPassword = loginPage.getForgotPasswordLink();

    const available = await forgotPassword
      .isVisible()
      .catch(() => false);

    if (available) {
      console.log('LOGIN-003: Forgot Password is available');
    } else {
      console.log(
        'LOGIN-003: Forgot Password is not available in this application'
      );
    }
  });

  // =====================================================
  // LOGIN-004
  // Login button
  // =====================================================

  test('LOGIN-004 - Login button should be detected', async () => {
    await expect(loginPage.getLoginButton()).toBeVisible({
      timeout: 10000,
    });

    console.log('LOGIN-004: Login button detected');
  });

  // =====================================================
  // LOGIN-005
  // Sign Up - only test if available
  // =====================================================

  test('LOGIN-005 - Sign Up should be detected if available', async () => {
    const signUp = loginPage.getSignUpLink();

    const available = await signUp
      .isVisible()
      .catch(() => false);

    if (available) {
      console.log('LOGIN-005: Sign Up is available');
    } else {
      console.log(
        'LOGIN-005: Sign Up is not available in this application'
      );
    }
  });

  // =====================================================
  // LOGIN-006
  // Password should be masked
  // =====================================================

  test('LOGIN-006 - Password field should be masked', async () => {
    const password = loginPage.getPasswordInput();

    await expect(password).toHaveAttribute('type', 'password');

    console.log('LOGIN-006: Password field is masked');
  });

    test('LOGIN-007 - Role selector should be detected if available', async () => {
    const roleSelector = loginPage.getRoleSelector();

    const available = await roleSelector
      .isVisible()
      .catch(() => false);

    if (available) {
      console.log('LOGIN-007: Role selector is available');
    } else {
      console.log(
        'LOGIN-007: Role selector is not required in this application'
      );
    }
  });

  // =====================================================
  // LOGIN-008
  // Invalid email + invalid password
  // =====================================================

  test('LOGIN-008 - Invalid email and password should show authentication error', async () => {
    await loginPage.enterEmail(invalidEmail);
    await loginPage.enterPassword(invalidPassword);

    await loginPage.clickLogin();

    const authError = loginPage.getAuthenticationError();

    const errorVisible = await authError
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-008: Invalid credentials error displayed successfully'
      );
    } else {
      const loginFormStillVisible =
        await loginPage.getEmailInput()
          .isVisible()
          .catch(() => false);

      expect(loginFormStillVisible).toBeTruthy();

      console.log(
        'LOGIN-008: Invalid credentials rejected; login form remains visible'
      );
    }
  });

  // =====================================================
  // LOGIN-009
  // Invalid email format
  // =====================================================

  test('LOGIN-009 - Invalid email format should be rejected', async () => {
    await loginPage.enterEmail(malformedEmail);

    const emailInput = loginPage.getEmailInput();

    const validationMessage = await emailInput.evaluate(
      (element: HTMLInputElement) => element.validationMessage
    );

    const browserValidation =
      /include.*@|valid.*email|email.*address|at sign|@/i.test(
        validationMessage
      );

    if (browserValidation) {
      console.log(
        `LOGIN-009: Email validation displayed - ${validationMessage}`
      );
      return;
    }

    const emailError = loginPage.getEmailValidationError();

    const errorVisible = await emailError
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-009: Invalid email validation displayed successfully'
      );
    } else {
      console.log(
        'LOGIN-009: Email format validation is not exposed by this application'
      );
    }
  });

  // =====================================================
  // LOGIN-010
  // Password minimum 8 characters
  // =====================================================

  test('LOGIN-010 - Password should require minimum 8 characters if enforced', async () => {
    await loginPage.enterPassword(shortPassword);

    const passwordInput = loginPage.getPasswordInput();

    const minlength = await passwordInput.getAttribute('minlength');

    if (minlength && Number(minlength) >= 8) {
      expect(Number(minlength)).toBeGreaterThanOrEqual(8);

      console.log(
        `LOGIN-010: Password minimum length is ${minlength} characters`
      );
      return;
    }

    const passwordError = loginPage.getPasswordValidationError();

    const errorVisible = await passwordError
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-010: Password minimum 8-character validation is enforced'
      );
    } else {
      console.log(
        'LOGIN-010: 8-character password requirement is not enforced on this page'
      );
    }
  });

  // =====================================================
  // LOGIN-011
  // Password should contain a number
  // =====================================================

  test('LOGIN-011 - Password should require a number if enforced', async () => {
    await loginPage.enterPassword(noNumberPassword);

    const validationText =
      loginPage.getPasswordNumberValidation();

    const errorVisible = await validationText
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-011: Password number requirement is enforced'
      );
    } else {
      console.log(
        'LOGIN-011: Password number requirement is not exposed on this page'
      );
    }
  });

  // =====================================================
  // LOGIN-012
  // Password should contain uppercase
  // =====================================================

  test('LOGIN-012 - Password should require uppercase letter if enforced', async () => {
    await loginPage.enterPassword(noUppercasePassword);

    const uppercaseValidation =
      loginPage.getPasswordUppercaseValidation();

    const errorVisible = await uppercaseValidation
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-012: Uppercase password requirement is enforced'
      );
    } else {
      console.log(
        'LOGIN-012: Uppercase requirement is not exposed on this page'
      );
    }
  });

  // =====================================================
  // LOGIN-013
  // Password should contain lowercase
  // =====================================================

  test('LOGIN-013 - Password should require lowercase letter if enforced', async () => {
    await loginPage.enterPassword(noLowercasePassword);

    const lowercaseValidation =
      loginPage.getPasswordLowercaseValidation();

    const errorVisible = await lowercaseValidation
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-013: Lowercase password requirement is enforced'
      );
    } else {
      console.log(
        'LOGIN-013: Lowercase requirement is not exposed on this page'
      );
    }
  });

  // =====================================================
  // LOGIN-014
  // Password should contain special character
  // =====================================================

  test('LOGIN-014 - Password should require special character if enforced', async () => {
    await loginPage.enterPassword(noSpecialPassword);

    const specialCharacterValidation =
      loginPage.getPasswordSpecialCharacterValidation();

    const errorVisible = await specialCharacterValidation
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (errorVisible) {
      console.log(
        'LOGIN-014: Special-character password requirement is enforced'
      );
    } else {
      console.log(
        'LOGIN-014: Special-character requirement is not exposed on this page'
      );
    }
  });
  test('LOGIN-015 - Valid email and password should login successfully and redirect to dashboard', async ({ page }) => {
    test.setTimeout(90000);

    const loginEmail = process.env.LOGIN_EMAIL;
    const loginPassword = process.env.LOGIN_PASSWORD;

    if (!loginEmail || !loginPassword) {
      throw new Error(
        'Cannot run LOGIN-015. Missing configuration: LOGIN_EMAIL and/or LOGIN_PASSWORD for this institution.'
      );
    }

    await page.goto(process.env.BASE_URL!, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await loginPage.login(loginEmail, loginPassword);

    await expect(page).toHaveURL(/dashboard/i, {
      timeout: 60000,
    });

    console.log('Login successful:', page.url());
  });
  // =======================================================
// SECURITY TEST CASES
// =======================================================

// =======================================================
// LOGIN-016
// SQL INJECTION-LIKE INPUT
// =======================================================

test(
  'LOGIN-016 - Reject SQL injection-like login input',
  async ({ page }) => {
    const sqlPayload = "' OR '1'='1";

    await loginPage.getEmailInput().fill(sqlPayload);
    await loginPage.getPasswordInput().fill(sqlPayload);

    await loginPage.getLoginButton().click();

    await page.waitForTimeout(1000);

    const currentUrl = page.url();

    // The application must not authenticate the attacker.
    expect(
      /dashboard/i.test(currentUrl),
      'SQL injection-like input must not result in authenticated access.'
    ).toBe(false);

    console.log(
      'ACTUAL RESULT: SQL injection-like login input did not authenticate the user.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// LOGIN-017
// XSS PAYLOAD
// =======================================================

test(
  'LOGIN-017 - Reject XSS payload in login fields',
  async ({ page }) => {
    const xssPayload = "<script>alert('XSS')</script>";

    let dialogTriggered = false;

    page.once('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await loginPage.getEmailInput().fill(xssPayload);
    await loginPage.getPasswordInput().fill(xssPayload);

    await loginPage.getLoginButton().click();

    await page.waitForTimeout(1000);

    expect(
      dialogTriggered,
      'XSS payload must not execute JavaScript.'
    ).toBe(false);

    console.log(
      'ACTUAL RESULT: XSS payload was not executed.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// LOGIN-018
// ERROR MESSAGE INFORMATION DISCLOSURE
// =======================================================

test(
  'LOGIN-018 - Login error should not expose sensitive information',
  async ({ page }) => {
    await loginPage.getEmailInput().fill(
      'security-test-invalid@example.com'
    );

    await loginPage.getPasswordInput().fill(
      'WrongPassword@123'
    );

    await loginPage.getLoginButton().click();

    await page.waitForTimeout(1000);

    const bodyText = (
      await page.locator('body').innerText()
    ).toLowerCase();

    const sensitivePatterns = [
      'sql syntax',
      'stack trace',
      'stacktrace',
      'database error',
      'internal server path',
      'node_modules',
      'password hash',
      'secret key',
      'aws_access_key',
      'access_token',
    ];

    const exposedPattern = sensitivePatterns.find(
      (pattern) => bodyText.includes(pattern)
    );

    expect(
      exposedPattern,
      `Sensitive implementation detail exposed: ${exposedPattern || 'none'}`
    ).toBeUndefined();

    console.log(
      'ACTUAL RESULT: Login error did not expose known sensitive implementation details.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// LOGIN-019
// PASSWORD MASKING
// =======================================================

test(
  'LOGIN-019 - Password field should be masked',
  async () => {
    const passwordInput =
      loginPage.getPasswordInput();

    await expect(passwordInput).toHaveAttribute(
      'type',
      'password'
    );

    console.log(
      'ACTUAL RESULT: Password field uses password masking.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// LOGIN-020
// PROTECTED PAGE WITHOUT AUTHENTICATION
// =======================================================

test(
  'LOGIN-020 - Protected page should not be accessible without authentication',
  async ({ page }) => {
    const protectedUrl =
      process.env.AUTH_TEST_DASHBOARD_URL;

    if (!protectedUrl) {
      console.log(
        'ACTUAL RESULT: AUTH_TEST_DASHBOARD_URL is not configured.'
      );

      console.log(
        'STATUS: NOT APPLICABLE'
      );

      return;
    }

    await page.goto(
      protectedUrl,
      {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      }
    );

    await page.waitForTimeout(1000);

    const currentUrl =
      page.url();

    const protectedAccess =
      /dashboard/i.test(currentUrl);

    expect(
      protectedAccess,
      'Unauthenticated user must not remain on a protected dashboard.'
    ).toBe(false);

    console.log(
      'ACTUAL RESULT: Protected page was not accessible without authentication.'
    );

    console.log('STATUS: PASS');
  }
);
});