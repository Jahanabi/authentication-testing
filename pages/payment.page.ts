import { expect, FrameLocator, Locator, Page } from '@playwright/test';

/**
 * HappyPrancer payment/subscription page object.
 *
 * This page object is intentionally separate from LoginPage and SignupPage.
 * The existing authentication page objects are not modified.
 */
export class PaymentPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // =====================================================
  // NAVIGATION / SUBSCRIPTION
  // =====================================================

  getPaymentsButton(): Locator {
    return this.page
      .getByRole('button', { name: 'Payments' })
      .first();
  }

  getSubscribeAndUnlockButton(): Locator {
    return this.page.getByRole('button', {
      name: 'SUBSCRIBE AND UNLOCK',
    });
  }

  getSubscriptionHeading(): Locator {
    return this.page.getByRole('heading', {
      name: /Find the membership that fits your flow/i,
    });
  }

  getTrialButton(): Locator {
    return this.page.getByRole('button', { name: 'Trial' }).first();
  }

  getMonthlyButton(): Locator {
    return this.page.getByRole('button', { name: 'Monthly' }).first();
  }

  getYearlyButton(): Locator {
    return this.page.getByRole('button', { name: 'Yearly' }).first();
  }

  getCourseOption(): Locator {
    return this.page
      .getByRole('button', {
        name: /Choose .*hybrid class/i,
      })
      .first();
  }

  getSubscriptionDetailsHeading(): Locator {
    return this.page.getByRole('heading', {
      name: 'Choose anupam hybrid class',
    });
  }

  getReferralInput(): Locator {
    return this.page.getByRole('textbox', {
      name: 'Referral or discount code',
    });
  }

  getApplyButton(): Locator {
    return this.page.getByRole('button', { name: 'Apply' });
  }

  getProceedToPayButton(): Locator {
    return this.page.getByRole('button', {
      name: 'Proceed To Pay →',
    });
  }

  // =====================================================
  // PAYMENT GATEWAY
  // =====================================================

  getPaymentFrame(): FrameLocator {
    return this.page.frameLocator('iframe').first();
  }

  getPaymentContactInput(): Locator {
    return this.getPaymentFrame().getByTestId('contactNumber');
  }

  getPaymentEmailInput(): Locator {
    return this.getPaymentFrame().getByTestId('email');
  }

  getPaymentContinueButton(): Locator {
    return this.getPaymentFrame().getByRole('button', {
      name: 'Continue',
    });
  }

  getShowQrButton(): Locator {
    return this.getPaymentFrame().getByRole('button', {
      name: 'Show QR',
    });
  }

  getPaymentStatusHeading(): Locator {
    return this.getPaymentFrame().getByTestId('payment-status-heading');
  }

  getPaymentStatusMessage(): Locator {
    return this.getPaymentFrame().getByTestId('payment-status-message');
  }

  // =====================================================
  // PAYMENT DASHBOARD
  // =====================================================

  getCurrentPlan(): Locator {
    return this.page.getByText('Current Plan').first();
  }

  getNextRenewal(): Locator {
    return this.page.getByText('Next Renewal').first();
  }

  getAccountDetails(): Locator {
    return this.page.getByText('Account Details').first();
  }

  getBillingHistoryHeading(): Locator {
    return this.page.getByRole('heading', {
      name: 'Billing History',
    });
  }

  getBillingFilter(): Locator {
    return this.page.getByText('All Months').first();
  }

  getBillingColumn(name: string): Locator {
    return this.page.getByRole('columnheader', { name });
  }

  getModifyButton(): Locator {
    return this.page.getByRole('button', { name: 'Modify' }).first();
  }

  getUpgradeButton(): Locator {
    return this.page.getByRole('button', { name: 'Upgrade' }).first();
  }

  getDowngradeButton(): Locator {
    return this.page.getByRole('button', { name: 'Downgrade' }).first();
  }

  getConfirmUpgradeButton(): Locator {
    return this.page.getByRole('button', {
      name: 'Confirm and Upgrade',
    });
  }

  getPauseButton(): Locator {
    return this.page.getByRole('button', { name: 'Pause' }).first();
  }

  getPauseSubscriptionButton(): Locator {
    return this.page.getByRole('button', {
      name: 'Pause Subscription',
    });
  }

  getCancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel' }).first();
  }

  getCancelSubscriptionHeading(): Locator {
    return this.page.getByRole('heading', {
      name: 'Cancel Subscription',
    });
  }

  getConfirmCancelButton(): Locator {
    return this.page.getByRole('button', {
      name: 'I am sure, cancel subscription',
    });
  }

  getAlert(): Locator {
    return this.page.getByRole('alert').first();
  }

  // =====================================================
  // HELPERS
  // =====================================================

  async openPayments(): Promise<void> {
    const button = this.getPaymentsButton();

    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }

    await this.page.goto('/payments', {
      waitUntil: 'domcontentloaded',
    });
  }

  async expectPaymentDashboard(): Promise<void> {
    await expect(this.getCurrentPlan()).toBeVisible();
    await expect(this.getNextRenewal()).toBeVisible();
    await expect(this.getAccountDetails()).toBeVisible();
    await expect(this.getBillingHistoryHeading()).toBeVisible();
  }
}
