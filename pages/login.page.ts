import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // =====================================================
  // EMAIL
  // Supports:
  // Email
  // Email Address
  // Enter your email
  // =====================================================

  getEmailInput(): Locator {
    return this.page
      .getByRole('textbox', {
        name: /email(?: address)?/i,
      })
      .first();
  }

  // =====================================================
  // PASSWORD
  // Supports:
  // Password
  // Enter your password
  // =====================================================

  getPasswordInput(): Locator {
    return this.page
      .getByRole('textbox', {
        name: /password/i,
      })
      .first();
  }

  // =====================================================
  // GOOGLE LOGIN
  // Supports:
  // Sign in with Google
  // Continue with Google
  // Google Icon Sign in with...
  // =====================================================

  getGoogleSignInButton(): Locator {
    return this.page
      .getByRole('button', {
        name: /google.*sign\s*in|sign\s*in.*google|continue\s*with\s*google/i,
      })
      .first();
  }

  // =====================================================
  // FORGOT PASSWORD
  // Supports:
  // Forgot password?
  // Forgot your password?
  // Forgot password
  // =====================================================

  getForgotPasswordLink(): Locator {
    return this.page
      .getByRole('link', {
        name: /forgot\s+(your\s+)?password\s*\??/i,
      })
      .first();
  }

  // =====================================================
  // LOGIN BUTTON
  // Supports:
  // Continue
  // Sign In
  // Login
  // =====================================================

  getLoginButton(): Locator {
    return this.page
      .getByRole('button', {
        name: /^(continue|sign\s*in|login|submit)$/i,
      })
      .first();
  }

  // =====================================================
  // SIGN UP
  // Supports:
  // Signup
  // Sign up
  // =====================================================

  getSignUpLink(): Locator {
    return this.page
      .getByRole('link', {
        name: /^sign\s*up$|^signup$/i,
      })
      .first();
  }

  // =====================================================
  // ROLE SELECTOR
  // Example:
  // Bworkz -> member
  // =====================================================

  getRoleSelector(): Locator {
    return this.page.getByRole('combobox').first();
  }

  // =====================================================
  // SEND OTP
  // Supports:
  // Send OTP
  // Send Otp
  // =====================================================

  getSendOtpButton(): Locator {
    return this.page
      .getByRole('button', {
        name: /send\s*otp/i,
      })
      .first();
  }

  // =====================================================
  // AUTHENTICATION ERROR
  // Supports:
  // Incorrect password
  // Incorrect email
  // Invalid credentials
  // Account doesn't exist
  // Wrong password
  // =====================================================

  getAuthenticationError(): Locator {
    return this.page
      .getByText(
        /incorrect\s+(password|email|credentials)|invalid\s+(credentials|email|password)|account\s+(doesn't|does not)\s+exist|user\s+does\s+not\s+exist|wrong\s+(password|email)/i
      )
      .first();
  }

  // =====================================================
  // EMAIL VALIDATION ERROR
  // =====================================================

  getEmailValidationError(): Locator {
    return this.page
      .getByText(
        /please\s+include.*@|valid\s+email|invalid\s+email|enter\s+a\s+valid\s+email|email.*invalid/i
      )
      .first();
  }

  // =====================================================
  // PASSWORD VALIDATION
  // =====================================================

  getPasswordValidationError(): Locator {
    return this.page
      .getByText(
        /at\s+least\s+8\s+characters|minimum\s+8\s+characters|8\s+characters|password.*too\s+short/i
      )
      .first();
  }

  // =====================================================
  // PASSWORD NUMBER VALIDATION
  // =====================================================

  getPasswordNumberValidation(): Locator {
    return this.page
      .getByText(/number|digit|numeric/i)
      .first();
  }

  // =====================================================
  // PASSWORD UPPERCASE VALIDATION
  // =====================================================

  getPasswordUppercaseValidation(): Locator {
    return this.page
      .getByText(/uppercase|capital\s+letter|upper\s+case/i)
      .first();
  }

  // =====================================================
  // PASSWORD LOWERCASE VALIDATION
  // =====================================================

  getPasswordLowercaseValidation(): Locator {
    return this.page
      .getByText(/lowercase|small\s+letter|lower\s+case/i)
      .first();
  }

  // =====================================================
  // PASSWORD SPECIAL CHARACTER VALIDATION
  // =====================================================

  getPasswordSpecialCharacterValidation(): Locator {
    return this.page
      .getByText(
        /special\s+character|special\s+symbol|symbol/i
      )
      .first();
  }

  // =====================================================
  // ACTIONS
  // =====================================================

  async enterEmail(email: string): Promise<void> {
    await this.getEmailInput().fill(email);
  }

  async enterPassword(password: string): Promise<void> {
    await this.getPasswordInput().fill(password);
  }

  // =====================================================
  // SELECT MEMBER ROLE
  // =====================================================

  async selectMemberRole(): Promise<void> {
    const roleSelector = this.getRoleSelector();

    if (await roleSelector.isVisible().catch(() => false)) {
      await roleSelector.selectOption('member');
    }
  }

  // =====================================================
  // CLICK LOGIN
  // =====================================================

  async clickLogin(): Promise<void> {
    const loginButton = this.getLoginButton();

    await loginButton.click();
  }

  // =====================================================
  // COMPLETE LOGIN
  // =====================================================

  async login(email: string, password: string): Promise<void> {
    await this.selectMemberRole();
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.clickLogin();
  }

  // =====================================================
  // FORGOT PASSWORD
  // =====================================================

  async clickForgotPassword(): Promise<void> {
    await this.getForgotPasswordLink().click();
  }

  // =====================================================
  // SIGN UP
  // =====================================================

  async clickSignUp(): Promise<void> {
    await this.getSignUpLink().click();
  }

  // =====================================================
  // GOOGLE LOGIN
  // =====================================================

  async clickGoogleSignIn(): Promise<void> {
    await this.getGoogleSignInButton().click();
  }
}