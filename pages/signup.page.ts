import { Page, Locator } from '@playwright/test';

export class SignupPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // =========================================================
  // LOCATORS
  // =========================================================

  getFullNameInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /^full\s*name$/i,
    }).first();
  }

  getEmailInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /^email(?:\s+address)?$/i,
    }).first();
  }

  getPhoneInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /phone(?:\s+number| numbers are 9 or 10)?|mobile(?:\s+number)?|contact\s*number/i,
    }).first();
  }

  getPasswordInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /^(?:create\s+)?password$/i,
    }).first();
  }

  getConfirmPasswordInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /confirm\s*password|re[-\s]?enter\s*password|repeat\s*password/i,
    }).first();
  }

  getReferralCodeInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /referral\s*code/i,
    }).first();
  }

  // =========================================================
  // IMPORTANT:
  // Only target the REAL "Create Account" button.
  //
  // Do NOT include "Sign up" here because the page also has
  // "Sign up with Google".
  // =========================================================

  getCreateAccountButton(): Locator {
    return this.page.getByRole('button', {
      name: /^(create\s+account|sign\s*up|submit)$/i,
    }).first();
  }

  // =========================================================
  // GOOGLE SIGNUP
  // =========================================================

  getGoogleSignupButton(): Locator {
    const googleButton = this.page.getByRole('button', {
      name: /(?:sign\s*up|signup|continue)\s+with\s+google|google.*(?:sign\s*up|signup|continue)/i,
    }).first();

    const googleLink = this.page.getByRole('link', {
      name: /(?:sign\s*up|signup|continue)\s+with\s+google|google.*(?:sign\s*up|signup|continue)/i,
    }).first();

    return googleButton.or(googleLink).first();
  }

  // =========================================================
  // EMAIL SIGNUP
  // =========================================================

  getEmailSignupButton(): Locator {
    return this.page.getByRole('button', {
      name: /^sign\s*up\s*with\s*email$/i,
    }).first();
  }

  // =========================================================
  // OTP
  // =========================================================

  getOtpInput(): Locator {
    return this.page.getByRole('textbox', {
      name: /otp.*6\s*digits|otp|verification\s*code/i,
    }).first();
  }

  getContinueButton(): Locator {
    return this.page.getByRole('button', {
      name: /^continue$/i,
    }).first();
  }

  getLoginLink(): Locator {
    return this.page.getByRole('link', {
      name: /login|sign\s*in/i,
    }).first();
  }

  // =========================================================
  // MESSAGES
  // =========================================================

  getSuccessMessage(): Locator {
    return this.page.getByText(
      /successfully\s*(created|registered|signed\s*up|logged\s*in)|account\s*(created|registered)\s*successfully|registration\s*successful|sign\s*up\s*successful|logged\s*in\s*successfully/i
    ).first();
  }

  getErrorMessage(): Locator {
    return this.page.getByText(
      /error|invalid|already exists|already registered|user already exists|failed|incorrect|must|required|please enter|please provide|does not match|passwords.*match/i
    ).first();
  }

  // =========================================================
  // FIELD EXISTENCE CHECKS
  // =========================================================

  async hasFullName(): Promise<boolean> {
    return await this.getFullNameInput()
      .isVisible()
      .catch(() => false);
  }

  async hasEmail(): Promise<boolean> {
    return await this.getEmailInput()
      .isVisible()
      .catch(() => false);
  }

  async hasPhone(): Promise<boolean> {
    return await this.getPhoneInput()
      .isVisible()
      .catch(() => false);
  }

  async hasPassword(): Promise<boolean> {
    return await this.getPasswordInput()
      .isVisible()
      .catch(() => false);
  }

  async hasConfirmPassword(): Promise<boolean> {
    return await this.getConfirmPasswordInput()
      .isVisible()
      .catch(() => false);
  }

  async hasReferralCode(): Promise<boolean> {
    return await this.getReferralCodeInput()
      .isVisible()
      .catch(() => false);
  }

  async hasGoogleSignup(): Promise<boolean> {
    return await this.getGoogleSignupButton()
      .isVisible()
      .catch(() => false);
  }

  async hasEmailSignup(): Promise<boolean> {
    return await this.getEmailSignupButton()
      .isVisible()
      .catch(() => false);
  }

  async hasOtp(): Promise<boolean> {
    return await this.getOtpInput()
      .isVisible()
      .catch(() => false);
  }

  // =========================================================
  // ACTIONS
  // =========================================================

  async enterFullName(name: string): Promise<void> {
    await this.getFullNameInput().fill(name);
  }

  async enterEmail(email: string): Promise<void> {
    await this.getEmailInput().fill(email);
  }

  async enterPhone(phone: string): Promise<void> {
    await this.getPhoneInput().fill(phone);
  }

  async enterPassword(password: string): Promise<void> {
    await this.getPasswordInput().fill(password);
  }

  async enterConfirmPassword(password: string): Promise<void> {
    await this.getConfirmPasswordInput().fill(password);
  }

  async enterReferralCode(code: string): Promise<void> {
    await this.getReferralCodeInput().fill(code);
  }

  async clickCreateAccount(): Promise<void> {
    await this.getCreateAccountButton().click();
  }

  async clickEmailSignup(): Promise<void> {
    await this.getEmailSignupButton().click();
  }

  async clickGoogleSignup(): Promise<void> {
    await this.getGoogleSignupButton().click();
  }

  async enterOtp(otp: string): Promise<void> {
    await this.getOtpInput().fill(otp);
  }

  async clickContinue(): Promise<void> {
    await this.getContinueButton().click();
  }

  // =========================================================
  // COMPLETE SIGNUP WORKFLOW
  // =========================================================

  async signup(
    name: string,
    email: string,
    phone: string,
    password: string,
    confirmPassword?: string,
    referralCode?: string
  ): Promise<void> {

    // Mandatory fields
    await this.enterFullName(name);
    await this.enterEmail(email);
    await this.enterPassword(password);

    // Optional Phone
    if (await this.hasPhone()) {
      await this.enterPhone(phone);
    }

    // Optional Confirm Password
    if (await this.hasConfirmPassword()) {
      await this.enterConfirmPassword(
        confirmPassword ?? password
      );
    }

    // Optional Referral Code
    if (
      referralCode &&
      await this.hasReferralCode()
    ) {
      await this.enterReferralCode(referralCode);
    }

    await this.clickCreateAccount();
  }
}