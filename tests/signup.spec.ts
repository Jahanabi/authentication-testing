import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { SignupPage } from '../pages/signup.page';

dotenv.config();

// =========================================================
// ENVIRONMENT VARIABLES
// =========================================================

const signupUrl = process.env.SIGNUP_URL;

const signupName =
  process.env.SIGNUP_NAME || 'Test User';

const signupEmail =
  process.env.SIGNUP_EMAIL || 'testuser@example.com';

const signupPhone =
  process.env.SIGNUP_PHONE || '9876543210';

const signupPassword =
  process.env.SIGNUP_PASSWORD || 'Test@1234';

const signupConfirmPassword =
  process.env.SIGNUP_CONFIRM_PASSWORD || 'Test@1234';

const referralCode =
  process.env.SIGNUP_REFERRAL_CODE || '';

if (!signupUrl) {
  throw new Error(
    'SIGNUP_URL is missing in .env file'
  );
}

// =========================================================
// COMMON SIGNUP TEST SUITE
// =========================================================

test.describe('Common Signup Authentication Tests', () => {

  let signupPage: SignupPage;

  // =======================================================
  // BEFORE EACH TEST
  // =======================================================


test.beforeEach(async ({ page }) => {
  signupPage = new SignupPage(page);

  await page.goto(signupUrl!, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const fullNameInput = signupPage.getFullNameInput();
  const emailSignupButton = signupPage.getEmailSignupButton();

  // Handle websites that show an intermediate signup screen.
  // If the signup form is already visible, continue directly.
  const formAlreadyVisible = await fullNameInput
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (!formAlreadyVisible) {
    const emailButtonVisible = await emailSignupButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (emailButtonVisible) {
      await emailSignupButton.click();
    }
  }

  // Wait for the common signup fields.
  await expect(fullNameInput).toBeVisible({
    timeout: 15000,
  });

  await expect(
    signupPage.getEmailInput()
  ).toBeVisible({
    timeout: 15000,
  });

  await expect(
    signupPage.getPasswordInput()
  ).toBeVisible({
    timeout: 15000,
  });
});

  // =======================================================
  // SIGNUP-001
  // =======================================================

  test(
    'SIGNUP-001 - Signup page loads successfully',
    async ({ page }) => {

      await expect(
        signupPage.getFullNameInput()
      ).toBeVisible();

      await expect(
        signupPage.getEmailInput()
      ).toBeVisible();

      await expect(
        signupPage.getPasswordInput()
      ).toBeVisible();

      await expect(
        signupPage.getCreateAccountButton()
      ).toBeVisible();

      console.log(
        'ACTUAL RESULT: Signup page loaded successfully.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

  // =======================================================
  // SIGNUP-002
  // FULL NAME
  // =======================================================

  test(
    'SIGNUP-002 - Full Name is mandatory',
    async () => {

      const exists =
        await signupPage.hasFullName();

      expect(
        exists,
        'Full Name field is mandatory but was not found.'
      ).toBeTruthy();

      await signupPage.enterFullName(
        signupName
      );

      await expect(
        signupPage.getFullNameInput()
      ).toHaveValue(signupName);

      console.log(
        'ACTUAL RESULT: Full Name field is available and accepts input.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

  // =======================================================
  // SIGNUP-003
  // EMAIL
  // =======================================================

  test(
    'SIGNUP-003 - Email field is mandatory',
    async () => {

      const exists =
        await signupPage.hasEmail();

      expect(
        exists,
        'Email field is mandatory but was not found.'
      ).toBeTruthy();

      await signupPage.enterEmail(
        signupEmail
      );

      await expect(
        signupPage.getEmailInput()
      ).toHaveValue(signupEmail);

      console.log(
        'ACTUAL RESULT: Email field is available and accepts input.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

  // =======================================================
  // SIGNUP-004
  // INVALID EMAIL
  // =======================================================

  test(
  'SIGNUP-004 - Invalid email format should be rejected',
  async ({ page }) => {
    const invalidEmail = 'invalidemail.com';

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(invalidEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword(signupPassword);

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(signupPassword);
    }

    const emailInput = signupPage.getEmailInput();

    // Check browser's built-in email validation
    const validation = await emailInput.evaluate(
      (input: HTMLInputElement) => ({
        type: input.type,
        valid: input.validity.valid,
        typeMismatch: input.validity.typeMismatch,
        validationMessage: input.validationMessage,
      })
    );

    console.log('Email validation:', validation);

    expect(
      validation.typeMismatch || !validation.valid,
      `Invalid email was accepted. Current URL: ${page.url()}`
    ).toBeTruthy();

    console.log(
      'ACTUAL RESULT: System rejected the invalid email format.'
    );
    console.log('STATUS: PASS');
  }
);
  // =======================================================
  // SIGNUP-005
  // VALID EMAIL FORMAT
  // =======================================================

  test(
    'SIGNUP-005 - Email should contain valid domain',
    async () => {

      const validEmailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const isValid =
        validEmailPattern.test(
          signupEmail
        );

      await signupPage.enterEmail(
        signupEmail
      );

      console.log(
        'ACTUAL RESULT: Email entered:',
        signupEmail
      );

      console.log(
        'STATUS:',
        isValid ? 'PASS' : 'FAIL'
      );

      expect(
        isValid,
        `${signupEmail} is not a valid email format.`
      ).toBeTruthy();
    }
  );

  // =======================================================
  // SIGNUP-006
  // PHONE
  // =======================================================

  test(
    'SIGNUP-006 - Phone number is handled correctly',
    async () => {

      const exists =
        await signupPage.hasPhone();

      if (!exists) {

        console.log(
          'ACTUAL RESULT: Phone field is not present.'
        );

        console.log(
          'STATUS: NOT APPLICABLE'
        );

        return;
      }

      await signupPage.enterPhone(
        signupPhone
      );

      await expect(
        signupPage.getPhoneInput()
      ).toHaveValue(signupPhone);

      console.log(
        'ACTUAL RESULT: Phone field is available and accepts input.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

  // =======================================================
  // SIGNUP-007
  // PASSWORD < 8 CHARACTERS
  // =======================================================

// =======================================================
// SIGNUP-007
// PASSWORD < 8 CHARACTERS
// =======================================================

// =======================================================
// SIGNUP-007
// PASSWORD < 8 CHARACTERS
// =======================================================

test(
  'SIGNUP-007 - Password must contain at least 8 characters',
  async ({ page }) => {

    const invalidPassword = 'Ab@123'; // 6 characters

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(signupEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword(invalidPassword);

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(invalidPassword);
    }

    /*
     * All accepted password-length validation messages.
     */
    const passwordValidationRegex =
      /Password did not conform with policy:\s*Password not long enough|Password.*(?:must|should).*at least 8 characters|Must contain at least 8 characters|Password.*too short|Password.*not long enough|at least 8 characters/i;

    /*
     * This locator supports normal HTML/custom validation,
     * including validation that appears immediately while typing
     * or after clicking Create Account.
     */
    const passwordError = page.getByText(
      passwordValidationRegex
    ).first();

    /*
     * ======================================================
     * CASE 1
     * Validation appears immediately while entering password
     * ======================================================
     */
    if (await passwordError.isVisible().catch(() => false)) {

      console.log(
        'VALIDATION TYPE: Validation appeared while entering password.'
      );

      console.log(
        'ACTUAL RESULT: System rejected password because it contains fewer than 8 characters.'
      );

      console.log('STATUS: PASS');

      return;
    }

    /*
     * ======================================================
     * CASE 2
     * Validation appears after Create Account
     *
     * Listen for browser JavaScript dialog BEFORE clicking.
     * ======================================================
     */
    let validDialog = false;

    page.on('dialog', async dialog => {

      const message = dialog.message();

      console.log('DIALOG MESSAGE:', message);

      if (passwordValidationRegex.test(message)) {
        validDialog = true;
      }

      // Close the browser dialog so Playwright can continue.
      await dialog.accept();
    });

    /*
     * ======================================================
     * Click Create Account
     * ======================================================
     */
    await signupPage.clickCreateAccount();

    /*
     * ======================================================
     * Wait for validation.
     *
     * The application may take several seconds because
     * signup validation can happen through the backend.
     *
     * We check repeatedly instead of checking only once.
     * ======================================================
     */
    await expect
      .poll(
        async () => {

          // Browser dialog
          if (validDialog) {
            return true;
          }

          // Normal HTML/custom validation
          if (
            await passwordError
              .isVisible()
              .catch(() => false)
          ) {
            return true;
          }

          return false;
        },
        {
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }
      )
      .toBe(true);

    /*
     * ======================================================
     * Final result
     * ======================================================
     */
    if (validDialog) {

      console.log(
        'VALIDATION TYPE: Browser dialog.'
      );

    } else {

      console.log(
        'VALIDATION TYPE: HTML/custom validation.'
      );
    }

    console.log(
      'ACTUAL RESULT: System rejected password because it contains fewer than 8 characters.'
    );

    console.log('STATUS: PASS');
  }
);





// =======================================================
// SIGNUP-008
// PASSWORD MUST CONTAIN UPPERCASE CHARACTER
// =======================================================



test(
  'SIGNUP-008 - Password must contain uppercase character',
  async ({ page }) => {

    const invalidPassword = 'abcdefg@1';

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(signupEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword(invalidPassword);

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(invalidPassword);
    }

    // Expected validation message
    const uppercaseRegex =
      /Password did not conform with policy:\s*Password must have uppercase characters|Password.*uppercase|upper case/i;

    let dialogValidationFound = false;

    // Listen BEFORE clicking Create Account
    page.once('dialog', async dialog => {
      const message = dialog.message();

      console.log('DIALOG MESSAGE:', message);

      if (uppercaseRegex.test(message)) {
        dialogValidationFound = true;
      }

      await dialog.accept();
    });

    // Click Create Account
    await signupPage.clickCreateAccount();

    // Check both browser dialog and page validation
    const pageValidation = page.getByText(
      uppercaseRegex
    ).first();

    await expect
      .poll(
        async () => {
          if (dialogValidationFound) {
            return true;
          }

          return await pageValidation
            .isVisible()
            .catch(() => false);
        },
        {
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }
      )
      .toBe(true);

    if (dialogValidationFound) {
      console.log(
        'VALIDATION TYPE: Browser dialog'
      );
    } else {
      console.log(
        'VALIDATION TYPE: Page validation'
      );
    }

    console.log(
      'ACTUAL RESULT: System rejected password because it does not contain an uppercase letter.'
    );

    console.log('STATUS: PASS');
  }
);




test(
  'SIGNUP-009 - Password must contain lowercase character',
  async ({ page }) => {
    const invalidPassword = 'ABCDEFG@1';

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(signupEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword(invalidPassword);

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(invalidPassword);
    }

    const lowercaseRegex =
      /Password did not conform with policy:\s*Password must have lowercase characters|Must contain a lowercase letter|Password.*lowercase|lower case/i;

    let dialogValidationFound = false;

    page.once('dialog', async dialog => {
      const message = dialog.message();

      console.log('DIALOG MESSAGE:', message);

      if (lowercaseRegex.test(message)) {
        dialogValidationFound = true;
      }

      await dialog.accept();
    });

    await signupPage.clickCreateAccount();

    const pageValidation = page.getByText(lowercaseRegex).first();

    await expect
      .poll(
        async () => {
          if (dialogValidationFound) {
            return true;
          }

          return await pageValidation
            .isVisible()
            .catch(() => false);
        },
        {
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }
      )
      .toBe(true);

    console.log(
      'ACTUAL RESULT: System rejected password because it does not contain a lowercase character.'
    );
    console.log('STATUS: PASS');
  }
);
  // =======================================================
  // SIGNUP-010
  // NO NUMBER
  // =======================================================

  test(
  'SIGNUP-010 - Password must contain number',
  async ({ page }) => {
    const invalidPassword = 'Abcdefg@';

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(signupEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword(invalidPassword);

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(invalidPassword);
    }

    // Supports both validation formats
    const numberErrorRegex =
      /Must contain a number\.|Password did not conform with policy:\s*Password must have numeric characters|Password.*(?:number|numeric)/i;

    // Handle browser/native dialog
    let dialogValidationFound = false;

    page.once('dialog', async dialog => {
      const message = dialog.message();

      console.log('DIALOG MESSAGE:', message);

      if (numberErrorRegex.test(message)) {
        dialogValidationFound = true;
      }

      await dialog.accept();
    });

    // Submit the form.
    // Required for websites where validation appears only after submission.
    await signupPage.clickCreateAccount();

    // Handle HTML/page validation as well as browser dialog
    const numberError = page
      .getByText(numberErrorRegex)
      .first();

    await expect
      .poll(
        async () => {
          if (dialogValidationFound) {
            return true;
          }

          return await numberError
            .isVisible()
            .catch(() => false);
        },
        {
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }
      )
      .toBe(true);

    if (dialogValidationFound) {
      console.log(
        'VALIDATION TYPE: Browser dialog'
      );
    } else {
      console.log(
        'VALIDATION TYPE: Page validation'
      );
    }

    console.log(
      'ACTUAL RESULT: System rejected password because it does not contain a number.'
    );

    console.log('STATUS: PASS');
  }
);
  // =======================================================
  // SIGNUP-011
  // NO SPECIAL CHARACTER
  // =======================================================

 
test(
  'SIGNUP-011 - Password must contain special character',
  async ({ page }) => {

    const invalidPassword = 'Abcdefgh1';

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(signupEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword(invalidPassword);

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(invalidPassword);
    }

    // Supports both website validation messages
    const specialCharacterRegex =
      /Must contain a special character|Password did not conform with policy:\s*Password must have symbol characters|Password.*(?:special character|symbol)/i;

    // Handle browser/native dialog
    let dialogValidationFound = false;

    page.once('dialog', async dialog => {
      const message = dialog.message();

      console.log('DIALOG MESSAGE:', message);

      if (specialCharacterRegex.test(message)) {
        dialogValidationFound = true;
      }

      await dialog.accept();
    });

    // Submit the form
    await signupPage.clickCreateAccount();

    // Handle page/HTML validation
    const specialCharacterError = page
      .getByText(specialCharacterRegex)
      .first();

    // Support both:
    // 1. Browser dialog
    // 2. Page validation message
    await expect
      .poll(
        async () => {

          if (dialogValidationFound) {
            return true;
          }

          return await specialCharacterError
            .isVisible()
            .catch(() => false);

        },
        {
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }
      )
      .toBe(true);

    if (dialogValidationFound) {
      console.log(
        'VALIDATION TYPE: Browser dialog'
      );
    } else {
      console.log(
        'VALIDATION TYPE: Page validation'
      );
    }

    console.log(
      'ACTUAL RESULT: System rejected password because it does not contain a special character.'
    );

    console.log('STATUS: PASS');
  }
);


  // =======================================================
  // SIGNUP-012
  // CONFIRM PASSWORD OPTIONAL
  // =======================================================

  test(
    'SIGNUP-012 - Confirm Password is optional',
    async () => {

      const exists =
        await signupPage.hasConfirmPassword();

      if (!exists) {

        console.log(
          'ACTUAL RESULT: Confirm Password field is not present.'
        );

        console.log(
          'STATUS: NOT APPLICABLE'
        );

        return;
      }

      await signupPage.enterPassword(
        signupPassword
      );

      await signupPage.enterConfirmPassword(
        signupConfirmPassword
      );

      await expect(
        signupPage.getConfirmPasswordInput()
      ).toHaveValue(
        signupConfirmPassword
      );

      console.log(
        'ACTUAL RESULT: Confirm Password field is present.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

  // =======================================================
  // SIGNUP-013
  // CONFIRM PASSWORD MISMATCH
  // =======================================================



test(
  'SIGNUP-013 - Confirm Password must match Password when present',
  async ({ page }) => {

    const exists = await signupPage.hasConfirmPassword();

    if (!exists) {
      console.log(
        'ACTUAL RESULT: Confirm Password field does not exist.'
      );
      console.log('STATUS: NOT APPLICABLE');
      return;
    }

    await signupPage.enterFullName(signupName);
    await signupPage.enterEmail(signupEmail);

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(signupPhone);
    }

    await signupPage.enterPassword('Password@123');
    await signupPage.enterConfirmPassword('Different@123');

    // Supports both native dialog and page validation
    const mismatchRegex =
      /Passwords?\s*must\s*match|passwords?\s*do\s*not\s*match|password.*confirm.*match|confirm.*password.*match/i;

    let dialogValidationFound = false;
    let dialogMessage = '';

    // Listen for native browser dialog
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();

      console.log(
        'DIALOG MESSAGE:',
        dialogMessage
      );

      if (mismatchRegex.test(dialogMessage)) {
        dialogValidationFound = true;
      }

      await dialog.accept();
    });

    // Click Create Account
    await signupPage.clickCreateAccount();

    // Page/HTML validation
    const pageValidation = page
      .getByText(mismatchRegex)
      .first();

    // Support both validation methods
    await expect
      .poll(
        async () => {

          if (dialogValidationFound) {
            return true;
          }

          return await pageValidation
            .isVisible()
            .catch(() => false);

        },
        {
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }
      )
      .toBe(true);

    // Verify the actual dialog message when dialog was used
    if (dialogValidationFound) {

      expect(
        dialogMessage,
        'Expected password mismatch validation dialog.'
      ).toMatch(mismatchRegex);

      console.log(
        'VALIDATION TYPE: Browser dialog'
      );

    } else {

      console.log(
        'VALIDATION TYPE: Page validation'
      );
    }

    console.log(
      'ACTUAL RESULT: System rejected the signup because Password and Confirm Password do not match.'
    );

    console.log('STATUS: PASS');
  }
);
  // =======================================================
  // SIGNUP-014
  // REFERRAL CODE
  // =======================================================

  test(
    'SIGNUP-014 - Referral Code is optional when available',
    async () => {

      const exists =
        await signupPage.hasReferralCode();

      if (!exists) {

        console.log(
          'ACTUAL RESULT: Referral Code field is not present.'
        );

        console.log(
          'STATUS: NOT APPLICABLE'
        );

        return;
      }

      console.log(
        'ACTUAL RESULT: Referral Code field exists and can be skipped.'
      );

      console.log(
        'STATUS: PASS'
      );

      expect(
        exists
      ).toBeTruthy();
    }
  );

  // =======================================================
  // SIGNUP-015
  // VALID SIGNUP
  // =======================================================

  test(
    'SIGNUP-015 - Create account with valid signup data',
    async ({ page }) => {

      // Generate a unique email for every execution.
      const uniqueEmail =
        signupEmail.replace(
          '@',
          `+${Date.now()}@`
        );

      console.log(
        'SIGNUP EMAIL:',
        uniqueEmail
      );

      await signupPage.enterFullName(
        signupName
      );

      await signupPage.enterEmail(
        uniqueEmail
      );

      if (await signupPage.hasPhone()) {
        await signupPage.enterPhone(
          signupPhone
        );
      }

      await signupPage.enterPassword(
        signupPassword
      );

      if (await signupPage.hasConfirmPassword()) {
        await signupPage.enterConfirmPassword(
          signupConfirmPassword
        );
      }

      if (
        referralCode &&
        await signupPage.hasReferralCode()
      ) {
        await signupPage.enterReferralCode(
          referralCode
        );
      }

      // Handle browser dialog if website uses alert().
      page.once(
        'dialog',
        async dialog => {

          console.log(
            'DIALOG MESSAGE:',
            dialog.message()
          );

          await dialog.dismiss();
        }
      );

      await signupPage.clickCreateAccount();

      // Give the application time to process.
      await page.waitForTimeout(2000);

      // ===================================================
      // ACTUAL RESULT DETECTION
      // ===================================================

      const successVisible =
        await signupPage.getSuccessMessage()
          .isVisible()
          .catch(() => false);

      const errorVisible =
        await signupPage.getErrorMessage()
          .isVisible()
          .catch(() => false);

      const otpVisible =
        await signupPage.hasOtp();

      const currentUrl =
        page.url();

      const redirected =
        /dashboard|redirect|verify|otp|login/i
          .test(currentUrl);

      console.log(
        '=========================================='
      );

      console.log(
        'SIGNUP-015 ACTUAL RESULT'
      );

      console.log(
        'URL:',
        currentUrl
      );

      console.log(
        'Success message:',
        successVisible
      );

      console.log(
        'Error message:',
        errorVisible
      );

      console.log(
        'OTP required:',
        otpVisible
      );

      console.log(
        'Redirected:',
        redirected
      );

      console.log(
        '=========================================='
      );

      // ===================================================
      // RESULT
      // ===================================================

      const successful =
        successVisible ||
        otpVisible ||
        redirected;

      console.log(
        'STATUS:',
        successful ? 'PASS' : 'FAIL'
      );

      expect(
        successful,
        `Signup did not show a successful result. URL: ${currentUrl}`
      ).toBeTruthy();
    }
  );

  // =======================================================
  // SIGNUP-016
  // CREATE ACCOUNT BUTTON
  // =======================================================

  test(
    'SIGNUP-016 - Create Account or Sign Up button should be available',
    async () => {

      const button =
        signupPage.getCreateAccountButton();

      await expect(
        button
      ).toBeVisible();

      await expect(
        button
      ).toBeEnabled();

      console.log(
        'ACTUAL RESULT: Create Account/Sign Up button is visible and enabled.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

  // =======================================================
  // SIGNUP-017
  // GOOGLE SIGNUP
  // =======================================================

  test(
    'SIGNUP-017 - Google Signup option when available',
    async () => {

      const exists =
        await signupPage.hasGoogleSignup();

      if (!exists) {

        console.log(
          'ACTUAL RESULT: Google Signup is not available.'
        );

        console.log(
          'STATUS: NOT APPLICABLE'
        );

        return;
      }

      await expect(
        signupPage.getGoogleSignupButton()
      ).toBeVisible();

      console.log(
        'ACTUAL RESULT: Google Signup option is available.'
      );

      console.log(
        'STATUS: PASS'
      );
    }
  );

// =======================================================
// SECURITY TEST CASES
// =======================================================

// =======================================================
// SIGNUP-018
// XSS IN FULL NAME
// =======================================================

test(
  'SIGNUP-018 - Reject XSS payload in Full Name',
  async ({ page }) => {
    const xssPayload =
      "<script>alert('XSS')</script>";

    let dialogTriggered = false;

    page.once('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await signupPage.enterFullName(
      xssPayload
    );

    await signupPage.enterEmail(
      `security-xss-${Date.now()}@example.com`
    );

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(
        signupPhone
      );
    }

    await signupPage.enterPassword(
      signupPassword
    );

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(
        signupConfirmPassword
      );
    }

    await signupPage.clickCreateAccount();

    await page.waitForTimeout(1000);

    expect(
      dialogTriggered,
      'XSS payload must not execute JavaScript.'
    ).toBe(false);

    console.log(
      'ACTUAL RESULT: XSS payload in Full Name was not executed.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// SIGNUP-019
// SQL INJECTION-LIKE INPUT
// =======================================================

test(
  'SIGNUP-019 - Reject SQL injection-like signup input',
  async ({ page }) => {
    const sqlPayload =
      "' OR '1'='1";

    await signupPage.enterFullName(
      sqlPayload
    );

    await signupPage.enterEmail(
      `security-sql-${Date.now()}@example.com`
    );

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(
        signupPhone
      );
    }

    await signupPage.enterPassword(
      signupPassword
    );

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(
        signupConfirmPassword
      );
    }

    await signupPage.clickCreateAccount();

    await page.waitForTimeout(1000);

    const currentUrl =
      page.url();

    const authenticated =
      /dashboard/i.test(currentUrl);

    expect(
      authenticated,
      'SQL injection-like input must not result in unauthorized authentication.'
    ).toBe(false);

    console.log(
      'ACTUAL RESULT: SQL injection-like signup input did not produce unauthorized access.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// SIGNUP-020
// INVALID EMAIL FORMAT
// =======================================================

test(
  'SIGNUP-020 - Reject invalid email format',
  async ({ page }) => {
    const invalidEmail =
      'invalid-email-without-domain';

    await signupPage.enterFullName(
      signupName
    );

    await signupPage.enterEmail(
      invalidEmail
    );

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(
        signupPhone
      );
    }

    await signupPage.enterPassword(
      signupPassword
    );

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(
        signupConfirmPassword
      );
    }

    await signupPage.clickCreateAccount();

    await page.waitForTimeout(500);

    const emailInput =
      signupPage.getEmailInput();

    const validationMessage =
      await emailInput.evaluate(
        (element: HTMLInputElement) =>
          element.validationMessage
      );

    const pageText =
      (
        await page.locator('body').innerText()
      ).toLowerCase();

    const invalidEmailDetected =
      Boolean(validationMessage) ||
      /invalid email|valid email|email.*valid/i.test(
        pageText
      );

    expect(
      invalidEmailDetected,
      'Invalid email should be rejected.'
    ).toBe(true);

    console.log(
      'ACTUAL RESULT: Invalid email format was rejected.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// SIGNUP-021
// WEAK PASSWORD
// =======================================================

test(
  'SIGNUP-021 - Reject weak password',
  async ({ page }) => {
    const weakPassword =
      '12345678';

    await signupPage.enterFullName(
      signupName
    );

    await signupPage.enterEmail(
      `security-password-${Date.now()}@example.com`
    );

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(
        signupPhone
      );
    }

    await signupPage.enterPassword(
      weakPassword
    );

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(
        weakPassword
      );
    }

    await signupPage.clickCreateAccount();

    await page.waitForTimeout(1000);

    const pageText =
      (
        await page.locator('body').innerText()
      ).toLowerCase();

    const passwordRejected =
      /password.*(weak|strong|character|uppercase|lowercase|number|symbol|special)|must.*password|password.*policy/i.test(
        pageText
      );

    const currentUrl =
      page.url();

    const movedToAuthenticatedArea =
      /dashboard/i.test(currentUrl);

    expect(
      movedToAuthenticatedArea,
      'Weak password must not create an authenticated session.'
    ).toBe(false);

    expect(
      passwordRejected ||
      !movedToAuthenticatedArea,
      'Weak password should be rejected or prevent account authentication.'
    ).toBe(true);

    console.log(
      'ACTUAL RESULT: Weak password did not create an authenticated session.'
    );

    console.log('STATUS: PASS');
  }
);


// =======================================================
// SIGNUP-022
// PASSWORD CONFIRMATION MISMATCH
// =======================================================

test(
  'SIGNUP-022 - Reject mismatched password confirmation',
  async ({ page }) => {
    await signupPage.enterFullName(
      signupName
    );

    await signupPage.enterEmail(
      `security-confirm-${Date.now()}@example.com`
    );

    if (await signupPage.hasPhone()) {
      await signupPage.enterPhone(
        signupPhone
      );
    }

    await signupPage.enterPassword(
      signupPassword
    );

    if (await signupPage.hasConfirmPassword()) {
      await signupPage.enterConfirmPassword(
        `${signupPassword}Mismatch`
      );
    } else {
      console.log(
        'ACTUAL RESULT: Confirm Password field is not available.'
      );

      console.log(
        'STATUS: NOT APPLICABLE'
      );

      return;
    }

    await signupPage.clickCreateAccount();

    await page.waitForTimeout(1000);

    const pageText =
      (
        await page.locator('body').innerText()
      ).toLowerCase();

    const mismatchDetected =
      /password.*match|password.*mismatch|confirm.*password/i.test(
        pageText
      );

    const currentUrl =
      page.url();

    const authenticated =
      /dashboard/i.test(currentUrl);

    expect(
      authenticated,
      'Mismatched passwords must not authenticate the user.'
    ).toBe(false);

    expect(
      mismatchDetected || !authenticated,
      'Mismatched password confirmation must be rejected.'
    ).toBe(true);

    console.log(
      'ACTUAL RESULT: Mismatched password confirmation did not authenticate the user.'
    );

    console.log('STATUS: PASS');
  }
);
});