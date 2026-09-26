import { test, expect, Page, Locator, type Frame } from '@playwright/test';
import dotenv from 'dotenv';
import { LoginPage } from '../pages/login.page';

dotenv.config();

/*
|--------------------------------------------------------------------------
| Environment
|--------------------------------------------------------------------------
*/

const BASE_URL =
  process.env.HAPPYPRANCER_BASE_URL ||
  'https://beta.happyprancer.com';

const LOGIN_EMAIL =
  process.env.HAPPYPRANCER_LOGIN_EMAIL ||
  process.env.LOGIN_EMAIL ||
  '';

const LOGIN_PASSWORD =
  process.env.HAPPYPRANCER_LOGIN_PASSWORD ||
  process.env.LOGIN_PASSWORD ||
  '';

const PAYMENT_PHONE =
  process.env.HAPPYPRANCER_PAYMENT_PHONE ||
  '';

const PAYMENT_EMAIL =
  process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
  LOGIN_EMAIL;

const HAPPYPRANCER_PAYMENT_PHONE =
  process.env.HAPPYPRANCER_PAYMENT_PHONE || '';

const HAPPYPRANCER_PAYMENT_EMAIL =
  process.env.HAPPYPRANCER_PAYMENT_EMAIL || '';
/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

function requireCredentials() {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    throw new Error(
      'Missing HappyPrancer login credentials. Add HAPPYPRANCER_LOGIN_EMAIL and HAPPYPRANCER_LOGIN_PASSWORD to .env'
    );
  }
}

async function skipOnboardingIfVisible(page: Page) {
  // Wait briefly for the onboarding/Joyride popup to appear.
  await page.waitForTimeout(10000);

  // First try the actual Skip button/text shown in the onboarding popup.
  const skipText = page.getByText('Skip', {
    exact: true,
  }).first();

  if (await skipText.isVisible().catch(() => false)) {
    await skipText.click({ force: true }).catch(async () => {
      await skipText.click();
    });

    // Wait for Joyride overlay to disappear.
    await page.locator('[data-test-id="overlay"]')
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => {});

    return;
  }

  // Codegen showed this test ID for the Skip button.
  const skipButton = page.locator(
    '[data-test-id="button-skip"]'
  ).first();

  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click({ force: true }).catch(async () => {
      await skipButton.click();
    });

    // Wait for Joyride overlay to disappear.
    await page.locator('[data-test-id="overlay"]')
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => {});

    return;
  }

  // If no Skip button was found, check whether the Joyride overlay
  // is still present.
  const overlay = page.locator(
    '[data-test-id="overlay"]'
  ).first();

  if (await overlay.isVisible().catch(() => false)) {
    // Try Skip one more time after the popup has fully rendered.
    const retrySkip = page.getByText('Skip', {
      exact: true,
    }).first();

    if (await retrySkip.isVisible().catch(() => false)) {
      await retrySkip.click({ force: true }).catch(() => {});
    }

    await overlay.waitFor({
      state: 'hidden',
      timeout: 5000,
    }).catch(() => {});
  }
}

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

async function login(page: Page) {
  requireCredentials();

  const loginPage = new LoginPage(page);

  // Open HappyPrancer
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
  });

  // Codegen showed that the login form is opened
  // by clicking the Login link on the home page.
  const loginLink = page.getByRole('link', {
    name: 'Login',
  }).first();

  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
  }

  // Make sure the login form is actually visible
  // before using the existing LoginPage implementation.
  await expect(
    page.getByRole('textbox', {
      name: /email(?: address)?/i,
    }).first()
  ).toBeVisible({
    timeout: 15_000,
  });

  /*
   * Use the existing LoginPage implementation.
   * We are NOT modifying login.page.ts.
   */
  await loginPage.login(
    LOGIN_EMAIL,
    LOGIN_PASSWORD
  );

  /*
   * HappyPrancer may go through:
   *
   * /login
   *    ↓
   * /redirect
   *    ↓
   * /dashboard
   *
   * Wait until the login page is gone.
   */
  await expect
    .poll(
      async () => {
        return new URL(page.url()).pathname.toLowerCase();
      },
      {
        timeout: 30_000,
        intervals: [500, 1000, 1500],
      }
    )
    .not.toContain('/login');

  // Wait for the application to finish loading.
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  /*
   * Explicitly open dashboard after authentication.
   * This verifies that the authenticated session is usable.
   */
  await page.goto(`${BASE_URL}/dashboard`, {
  waitUntil: 'domcontentloaded',
});

// Automatically skip the onboarding popup if it appears
await skipOnboardingIfVisible(page);

/*
 * If authentication failed, HappyPrancer will
 * redirect back to /login.
 */
await expect(page).not.toHaveURL(/\/login/i);

  // Give the dashboard/session time to finish loading.
  await page.waitForLoadState('networkidle').catch(() => {});
}


/*
|--------------------------------------------------------------------------
| Dashboard state detection
|--------------------------------------------------------------------------
*/

function subscribeAndUnlockButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /SUBSCRIBE AND UNLOCK/i,
  }).first();
}

function currentPlan(page: Page): Locator {
  return page.getByText(/Current Plan/i).first();
}

async function isNonSubscribedUser(
  page: Page
): Promise<boolean> {
  return await subscribeAndUnlockButton(page)
    .isVisible()
    .catch(() => false);
}

async function isSubscribedUser(
  page: Page
): Promise<boolean> {
  return await currentPlan(page)
    .isVisible()
    .catch(() => false);
}
async function waitForDashboardReady(page: Page) {
  await expect(
    page.getByRole('heading', {
      name: /Verifying your session/i,
    })
  ).not.toBeVisible({
    timeout: 30_000,
  }).catch(() => {});

  await expect
    .poll(
      async () => {
        const subscribed = await currentPlan(page)
          .isVisible()
          .catch(() => false);

        const unsubscribed = await subscribeAndUnlockButton(page)
          .isVisible()
          .catch(() => false);

        return subscribed || unsubscribed;
      },
      {
        timeout: 30_000,
        intervals: [500, 1000, 2000],
      }
    )
    .toBe(true);
}

/*
|--------------------------------------------------------------------------
| Profile / Payments
|--------------------------------------------------------------------------
*/

async function openProfileMenu(page: Page) {
  /*
   * Your Codegen showed the profile button as "JD".
   * We first try that, then fall back to a button
   * containing initials.
   */
  await skipOnboardingIfVisible(page);
  const jdButton = page.getByRole('button', {
    name: /^JD$/i,
  }).first();

  if (
    await jdButton.isVisible().catch(() => false)
  ) {
    await jdButton.click();
    return;
  }

  const profileButtons = page.locator(
    'button'
  );

  const count = await profileButtons.count();

  for (let i = 0; i < count; i++) {
    const button = profileButtons.nth(i);

    const text = (
      await button.innerText().catch(() => '')
    ).trim();

    if (
      /^[A-Z]{1,3}$/i.test(text) &&
      text.length <= 3
    ) {
      await button.click();
      return;
    }
  }

  throw new Error(
    'Could not find the HappyPrancer profile button.'
  );
}


async function openPaymentsFromMenu(page: Page) {
  await openProfileMenu(page);

  const paymentsButton =
    page.getByRole('button', {
      name: /^Payments$/i,
    }).first();

  if (
    await paymentsButton.isVisible().catch(() => false)
  ) {
    await paymentsButton.click();
  } else {
    const paymentsText =
      page.getByText(/^Payments$/i).first();

    await expect(paymentsText).toBeVisible({
      timeout: 10_000,
    });

    await paymentsText.click();
  }

  await page.waitForLoadState(
    'domcontentloaded'
  ).catch(() => {});
}


/*
|--------------------------------------------------------------------------
| Subscription page
|--------------------------------------------------------------------------
*/

async function openSubscriptionPage(
  page: Page
) {
  const button = subscribeAndUnlockButton(page);

  await expect(button).toBeVisible({
    timeout: 15_000,
  });

  await button.click();

  await page.waitForLoadState(
    'domcontentloaded'
  ).catch(() => {});

  await expect(page).toHaveURL(
    /\/subscription/i
  );
}


/*
|--------------------------------------------------------------------------
| Payment buttons
|--------------------------------------------------------------------------
*/

function monthlyButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /^Monthly$/i,
  }).first();
}

function yearlyButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /^Yearly$/i,
  }).first();
}

function trialButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /^Trial$/i,
  }).first();
}

function proceedToPayButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /Proceed To Pay/i,
  }).first();
}


/*
|--------------------------------------------------------------------------
| Payment gateway
|--------------------------------------------------------------------------
*/
/*async function openPaymentGatewayForExitTest(page: Page) {
  // 1. Proceed to payment
  const proceedToPay = page.getByRole('button', {
    name: /Proceed To Pay/i,
  }).first();

  await expect(proceedToPay).toBeVisible({
    timeout: 30_000,
  });

  await expect(proceedToPay).toBeEnabled({
    timeout: 30_000,
  });

  await proceedToPay.click();

  console.log('Proceed To Pay clicked.');

  // 2. Wait for Razorpay iframe to be created
  const razorpayIframe = page.locator('iframe').first();

  await expect(razorpayIframe).toBeAttached({
    timeout: 60_000,
  });

  console.log('Razorpay iframe attached.');

  // 3. Get Razorpay frame
  const paymentFrame =
    razorpayIframe.contentFrame();

  // 4. Wait for Razorpay contact form
  const phoneInput =
    paymentFrame.getByTestId('contactNumber');

  const emailInput =
    paymentFrame.getByTestId('email');

  await expect(phoneInput).toBeVisible({
    timeout: 90_000,
  });

  await expect(emailInput).toBeVisible({
    timeout: 30_000,
  });

  console.log('Razorpay contact form is ready.');

  return paymentFrame;
}
  */
/*
|--------------------------------------------------------------------------
| SUBSCRIBED USER TESTS
|--------------------------------------------------------------------------
*/

test.describe(
  'HappyPrancer Payment - Subscribed State',
  () => {

    test(
      'PAYMENT-001 - Payment dashboard should load for subscribed user',
      async ({ page }) => {

        await login(page);

        /*
         * We are using the SAME login account.
         * Check its current subscription state.
         */
        const unsubscribed =
          await isNonSubscribedUser(page);

        if (unsubscribed) {
          test.skip(
            true,
            'Current account has no active subscription. Payment Dashboard is not available in this state.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(page).toHaveURL(
          /\/payments/i
        );

        await expect(
          page.getByText(/Current Plan/i).first()
        ).toBeVisible();

        await expect(
          page.getByText(/Next Renewal/i).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-002 - Current Plan should be displayed',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(
          page.getByText(/Current Plan/i).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-003 - Next Renewal should be displayed',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(
          page.getByText(/Next Renewal/i).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-004 - Account Details should be displayed',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(
          page.getByText(/Account Details/i).first()
        ).toBeVisible();

        await expect(
          page.getByText(/Member Since/i).first()
        ).toBeVisible();

        await expect(
          page.getByText(/Billing Amount/i).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-005 - Billing History should be displayed',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(
          page.getByRole('heading', {
            name: /Billing History/i,
          })
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-006 - Billing History columns should be displayed',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);
        await page.waitForTimeout(5000);
        const columns = [
          'Date',
          'Description',
          'Method',
          'Amount',
          'Status',
          'Actions',
        ];

        for (const column of columns) {
          await expect(
            page.getByRole('columnheader', {
              name: new RegExp(
                `^${column}$`,
                'i'
              ),
            })
          ).toBeVisible();
        }
      }
    );


    test(
      'PAYMENT-007 - Modify button should be displayed',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(
          page.getByRole('button', {
            name: /^Modify$/i,
          }).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-008 - Modify should show Upgrade',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await page.getByRole('button', {
          name: /^Modify$/i,
        }).first().click();

        await expect(
          page.getByRole('button', {
            name: /^Upgrade$/i,
          }).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-009 - Modify should show Downgrade',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await page.getByRole('button', {
          name: /^Modify$/i,
        }).first().click();

        await expect(
          page.getByRole('button', {
            name: /^Downgrade$/i,
          }).first()
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-010 - Modify should show Pause',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await page.getByRole('button', {
          name: /^Modify$/i,
        }).first().click();

        await expect(
          page.getByRole('button', {
            name: /^Pause$/i,
          })
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-011 - Modify should show Cancel',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await page.getByRole('button', {
          name: /^Modify$/i,
        }).first().click();

        await expect(
          page.getByRole('button', {
            name: /^Cancel$/i,
          })
        ).toBeVisible();
      }
    );

test(
  'PAYMENT-012 - Upgrade subscription to 12121 and verify updated current plan',
  async ({ page }) => {
test.setTimeout(180_000);
    // 1. Login
    await login(page);

    // 2. TC-012 requires an active subscription
    if (await isNonSubscribedUser(page)) {
      test.skip(
        true,
        'Account currently has no active subscription.'
      );
    }

    // 3. Open Payments
    await openPaymentsFromMenu(page);
// 4. Click Modify

const modifyButton = page.getByRole('button', {
  name: /^Modify$/i,
}).first();

await expect(modifyButton).toBeVisible({ timeout: 15000 });
await expect(modifyButton).toBeEnabled({ timeout: 15000 });

await modifyButton.click();

// 6. Upgrade should now be available
const upgradeMenuButton = page.getByRole('button', {
  name: /^Upgrade$/i,
}).first();

await expect(upgradeMenuButton).toBeVisible({
  timeout: 15000,
});

await expect(upgradeMenuButton).toBeEnabled({
  timeout: 15000,
});

// 7. Click Upgrade
await upgradeMenuButton.click();

// 8. Change Plan must appear
await expect(
  page.getByRole('heading', {
    name: 'Change Plan',
  })
).toBeVisible({
  timeout: 15000,
});
// 8. Locate the 12121 plan
const plan12121Text = page.getByText('12121', {
  exact: true,
});

await expect(plan12121Text).toBeVisible({
  timeout: 15000,
});

// 9. Get the 12121 plan card
const plan12121Card = plan12121Text.locator('..');

const upgrade12121 = plan12121Card.getByRole('button', {
  name: /^Upgrade$/i,
});

await expect(upgrade12121).toBeVisible({
  timeout: 15000,
});

// 10. Click Upgrade for 12121
await upgrade12121.click();

    // 8. Confirm the upgrade
    const confirmUpgrade = page.getByRole('button', {
      name: /Confirm and Upgrade/i,
    });

    await expect(confirmUpgrade).toBeVisible({
      timeout: 15000,
    });

    await confirmUpgrade.click();

    // 9. Wait for Active Subscription/payment page
    await expect(
      page.getByRole('heading', {
        name: 'Active Subscription',
      })
    ).toBeVisible({
      timeout: 30000,
    });

    // 10. Proceed to payment
    const proceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    });

    await expect(proceedToPay).toBeVisible({
      timeout: 30000,
    });

    await expect(proceedToPay).toBeEnabled({
      timeout: 15000,
    });

    await proceedToPay.click();

    // 11. Wait for Razorpay iframe
    const razorpayIframe = page.locator('iframe').first();

    await expect(razorpayIframe).toBeAttached({
      timeout: 30000,
    });

    // 12. Payment iframe
    const paymentFrame =
      razorpayIframe.contentFrame();

    // 13. Fill payment contact details
    const phoneInput =
      paymentFrame.getByTestId('contactNumber');

    const emailInput =
      paymentFrame.getByTestId('email');

    await expect(phoneInput).toBeVisible({
      timeout: 30000,
    });

    await expect(emailInput).toBeVisible({
      timeout: 30000,
    });

    await phoneInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_PHONE ||
        '7827197829'
    );

    await emailInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
        'usertester@gmail.com'
    );

    // 14. Continue
    const continueButton =
      paymentFrame.getByRole('button', {
        name: 'Continue',
      });

    await expect(continueButton).toBeVisible({
      timeout: 15000,
    });

    await expect(continueButton).toBeEnabled({
      timeout: 15000,
    });

    await continueButton.click();

    // 15. Click Show QR
    const showQR =
      paymentFrame.getByRole('button', {
        name: 'Show QR',
      });

    await expect(showQR).toBeVisible({
      timeout: 30000,
    });

    await showQR.click();

    // 16. Click the UPI QR Code
const upiQR = paymentFrame.getByRole('button', {
  name: 'UPI QR Code',
});

await expect(upiQR).toBeVisible({
  timeout: 30000,
});

await upiQR.click();

// Codegen recorded the QR button being clicked again
const upiQRAgain = paymentFrame.getByRole('button', {
  name: 'UPI QR Code',
});

if (await upiQRAgain.isVisible().catch(() => false)) {
  await upiQRAgain.click();
}

// 17. Wait for payment to become successful
const paymentStatus = paymentFrame.getByTestId(
  'payment-status-heading'
);

await expect(paymentStatus).toBeVisible({
  timeout: 30000,
});

await expect(paymentStatus).toHaveText(
  /Payment Successful/i,
  {
    timeout: 120_000,
  }
);

// 18. Payment is successful. Allow HappyPrancer to restore the session.
await expect(
  page.getByText(/Verifying your session/i)
).toBeVisible({
  timeout: 15_000,
}).catch(() => {});

// 19. Wait until session restoration finishes
await expect(
  page.getByText(/Verifying your session/i)
).not.toBeVisible({
  timeout: 60_000,
}).catch(() => {});

    // 19. Payment successful → go to dashboard
await page.goto(`${BASE_URL}/dashboard`, {
  waitUntil: 'domcontentloaded',
});
await expect(
  page.getByText(/Verifying your session/i)
).not.toBeVisible({
  timeout: 30_000,
});

// 21. Make sure we are on dashboard
await expect(page).not.toHaveURL(/\/login/i);
// 20. Handle onboarding if it appears
await skipOnboardingIfVisible(page);

// 22. Open profile menu
await openProfileMenu(page);
// 24. Open Payments
await page.getByRole('button', {
  name: 'Payments',
}).first().click();

    // 24. Verify Current Plan section
    await expect(
      page.getByText('Current Plan', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // 25. Verify the upgraded plan is 12121
    await expect(
      page.getByText('12121', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });
  }
);

test(
  'PAYMENT-013 - Downgrade subscription and verify updated current plan',
  async ({ page }) => {
    test.setTimeout(180_000);

    // =========================================================
    // 1. Login
    // =========================================================

    await login(page);

    // =========================================================
    // 2. TC-013 requires an active subscription
    // =========================================================

    if (await isNonSubscribedUser(page)) {
      test.skip(
        true,
        'Account currently has no active subscription.'
      );
    }

    // =========================================================
    // 3. Open Payments
    // =========================================================

    await openPaymentsFromMenu(page);

    // =========================================================
    // 4. Click Modify
    // =========================================================

    const modifyButton = page.getByRole('button', {
      name: /^Modify$/i,
    }).first();

    await expect(modifyButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(modifyButton).toBeEnabled({
      timeout: 15_000,
    });

    await modifyButton.click();

    // =========================================================
    // 5. Downgrade should now be available
    // =========================================================

    const upgradeMenuButton = page.getByRole('button', {
      name: /^Upgrade$/i,
    }).first();

    await expect(upgradeMenuButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(upgradeMenuButton).toBeEnabled({
      timeout: 15_000,
    });

    // =========================================================
    // 6. Click Downgrade
    // =========================================================

    await upgradeMenuButton.click();

    // =========================================================
    // 7. Change Plan must appear
    // =========================================================

    await expect(
      page.getByRole('heading', {
        name: 'Change Plan',
      })
    ).toBeVisible({
      timeout: 15_000,
    });

    // =========================================================
    // 8. Locate the 1 Day plan
    // =========================================================

    const oneDayText = page.getByText('1 Day', {
      exact: true,
    });

    await expect(oneDayText).toBeVisible({
      timeout: 15_000,
    });

    // =========================================================
    // 9. Get the 1 Day plan card
    // =========================================================

    const oneDayCard = oneDayText.locator('..');

    const downgradeOneDay = oneDayCard.getByRole('button', {
      name: /^Downgrade$/i,
    });

    await expect(downgradeOneDay).toBeVisible({
      timeout: 15_000,
    });

    // =========================================================
    // 10. Click Downgrade for 1 Day
    // =========================================================

    await downgradeOneDay.click();

    // =========================================================
    // 11. Confirm the downgrade if confirmation appears
    // =========================================================

    const confirmDowngrade = page.getByRole('button', {
      name: /Downgrade/i,
    }).last();

    if (
      await confirmDowngrade.isVisible().catch(() => false)
    ) {
      await confirmDowngrade.click();
    }

    // =========================================================
    // 12. Wait for Active Subscription/payment page
    // =========================================================

    await expect(
      page.getByRole('heading', {
        name: 'Active Subscription',
      })
    ).toBeVisible({
      timeout: 30_000,
    });

    // =========================================================
    // 13. Proceed to payment
    // =========================================================

    const proceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    });

    await expect(proceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(proceedToPay).toBeEnabled({
      timeout: 15_000,
    });

    // Click ONLY ONCE
    await proceedToPay.click();

    // =========================================================
    // 14. Wait for Razorpay iframe
    // Same structure as TC-012
    // =========================================================

    const razorpayIframe = page.locator('iframe').first();

    await expect(razorpayIframe).toBeAttached({
      timeout: 30_000,
    });

    // =========================================================
    // 15. Payment iframe
    // =========================================================

    const paymentFrame =
      razorpayIframe.contentFrame();

    // =========================================================
    // 16. Contact form OR Show QR
    // =========================================================

    const phoneInput =
      paymentFrame.getByTestId('contactNumber');

    const emailInput =
      paymentFrame.getByTestId('email');

    const showQR =
      paymentFrame.getByRole('button', {
        name: 'Show QR',
      });

    // Wait until either the contact form or Show QR appears.
    await expect
      .poll(
        async () => {
          const contactVisible =
            await phoneInput.isVisible().catch(() => false);

          const qrVisible =
            await showQR.isVisible().catch(() => false);

          return contactVisible || qrVisible;
        },
        {
          timeout: 60_000,
          intervals: [1000, 2000, 3000],
        }
      )
      .toBe(true);

    // =========================================================
    // 17. Fill payment contact details if contact form appears
    // =========================================================

    if (
      await phoneInput.isVisible().catch(() => false)
    ) {
      await phoneInput.fill(
        process.env.HAPPYPRANCER_PAYMENT_PHONE ||
          '7827197829'
      );

      await expect(emailInput).toBeVisible({
        timeout: 30_000,
      });

      await emailInput.fill(
        process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
          'usertester@gmail.com'
      );

      // =======================================================
      // 18. Continue
      // =======================================================

      const continueButton =
        paymentFrame.getByRole('button', {
          name: 'Continue',
        });

      await expect(continueButton).toBeVisible({
        timeout: 15_000,
      });

      await expect(continueButton).toBeEnabled({
        timeout: 15_000,
      });

      await continueButton.click();
    }

    // =========================================================
    // 19. Click Show QR
    // =========================================================

    await expect(showQR).toBeVisible({
      timeout: 30_000,
    });

    await showQR.click();

    // =========================================================
    // 20. Click UPI QR Code
    // =========================================================

    const upiQR =
      paymentFrame.getByRole('button', {
        name: 'UPI QR Code',
      });

    await expect(upiQR).toBeVisible({
      timeout: 30_000,
    });

    await upiQR.click();

    // Codegen recorded the QR button being clicked again
    const upiQRAgain =
      paymentFrame.getByRole('button', {
        name: 'UPI QR Code',
      });

    if (
      await upiQRAgain.isVisible().catch(() => false)
    ) {
      await upiQRAgain.click();
    }

    // =========================================================
    // 21. Wait for payment to become successful
    // =========================================================

    const paymentStatus =
      paymentFrame.getByTestId(
        'payment-status-heading'
      );

    await expect(paymentStatus).toBeVisible({
      timeout: 30_000,
    });

    await expect(paymentStatus).toHaveText(
      /Payment Successful/i,
      {
        timeout: 120_000,
      }
    );

    // =========================================================
    // 22. Allow HappyPrancer to restore the session
    // =========================================================

    await expect(
      page.getByText(/Verifying your session/i)
    ).toBeVisible({
      timeout: 15_000,
    }).catch(() => {});

    // =========================================================
    // 23. Wait until session restoration finishes
    // =========================================================

    await expect(
      page.getByText(/Verifying your session/i)
    ).not.toBeVisible({
      timeout: 60_000,
    }).catch(() => {});

    // =========================================================
    // 24. Payment successful → go to dashboard
    // =========================================================

    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByText(/Verifying your session/i)
    ).not.toBeVisible({
      timeout: 30_000,
    });

    // =========================================================
    // 25. Make sure we are on dashboard
    // =========================================================

    await expect(page).not.toHaveURL(/login/i);

    // =========================================================
    // 26. Handle onboarding if it appears
    // =========================================================

    await skipOnboardingIfVisible(page);

    // =========================================================
    // 27. Open profile menu
    // =========================================================

    await openProfileMenu(page);

    // =========================================================
    // 28. Open Payments
    // =========================================================

    await page.getByRole('button', {
      name: 'Payments',
    }).first().click();

    // =========================================================
    // 29. Verify Current Plan section
    // =========================================================

    await expect(
      page.getByText('Current Plan', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15_000,
    });

    // =========================================================
    // 30. Verify the downgraded plan is 1 Day
    // =========================================================

    await expect(
      page.getByText('1 Day', {
        exact: true,
      }).last()
    ).toBeVisible({
      timeout: 15_000,
    });
  }
);

//PAYMENT-014 - Pause subscription should show confirmation modal
    test(
      'PAYMENT-014 - Pause should show confirmation',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await page.getByRole('button', {
          name: /^Modify$/i,
        }).first().click();

        await page.getByRole('button', {
          name: /^Pause$/i,
        }).click();

        await expect(
          page.getByRole('heading', {
            name: /Pause Subscription/i,
          })
        ).toBeVisible();
      }
    );
test(
  'PAYMENT-015 - Cancel subscription confirmation modal can be dismissed',
  async ({ page }) => {

    await login(page);

    if (await isNonSubscribedUser(page)) {
      test.skip(
        true,
        'Account currently has no active subscription.'
      );
    }

    await openPaymentsFromMenu(page);

    // Click Modify
    await page.getByRole('button', {
      name: /^Modify$/i,
    }).first().click();

    // Click Cancel from Modify menu
    await page.getByRole('button', {
      name: /^Cancel$/i,
    }).click();

    // Verify confirmation modal
    await expect(
      page.getByRole('heading', {
        name: /Cancel Subscription/i,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // Click Cancel inside the confirmation modal
    const cancelConfirmationButton = page.getByRole('button', {
      name: /^Cancel$/i,
    }).last();

    await expect(cancelConfirmationButton).toBeVisible({
      timeout: 10000,
    });

    await cancelConfirmationButton.click();

    // Confirmation modal should disappear
    await expect(
      page.getByRole('heading', {
        name: /Cancel Subscription/i,
      })
    ).not.toBeVisible({
      timeout: 10000,
    });

    // Subscription should still be active
    await expect(
      page.getByText('Current Plan', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    console.log(
      'PAYMENT-015.1 completed. Cancellation confirmation was dismissed and subscription remains active.'
    );
  }
);
test(
  'PAYMENT-016 - Confirm cancellation and verify SUBSCRIBE AND UNLOCK',
  
  async ({ page }) => {
   test.setTimeout(120_000);
    await login(page);

    if (await isNonSubscribedUser(page)) {
      test.skip(
        true,
        'Account currently has no active subscription.'
      );
    }

    await openPaymentsFromMenu(page);

    // Click Modify
    await page.getByRole('button', {
      name: /^Modify$/i,
    }).first().click();

    // Click Cancel from Modify menu
    await page.getByRole('button', {
      name: /^Cancel$/i,
    }).click();

    // Verify confirmation modal
    await expect(
      page.getByRole('heading', {
        name: /Cancel Subscription/i,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // Click "I am sure, cancel subscription"
    const confirmCancelButton = page.getByRole('button', {
      name: /I am sure, cancel subscription/i,
    });

    await expect(confirmCancelButton).toBeVisible({
      timeout: 10000,
    });

    await expect(confirmCancelButton).toBeEnabled({
      timeout: 10000,
    });

    await confirmCancelButton.click();
    // HappyPrancer shows "Cancelling..." first
// =========================================================

await expect(
  page.getByText(/Cancelling/i)
).toBeVisible({
  timeout: 15_000,
}).catch(() => {});

// =========================================================
// Wait for session verification to appear
// =========================================================

await expect(
  page.getByText(/Verifying your session/i)
).toBeVisible({
  timeout: 30_000,
}).catch(() => {});


// =========================================================
// Wait until session verification finishes
// =========================================================

await expect(
  page.getByText(/Verifying your session/i)
).not.toBeVisible({
  timeout: 60_000,
}).catch(() => {});

    // Go to dashboard
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
    });

    await skipOnboardingIfVisible(page);

    await expect(page).not.toHaveURL(/\/login/i);

    // Verify subscription is cancelled
    await expect(
      subscribeAndUnlockButton(page)
    ).toBeVisible({
      timeout: 15000,
    });

    console.log(
      'PAYMENT-016 completed. Subscription cancelled and SUBSCRIBE AND UNLOCK is visible.'
    );
  }
);
  }
);


/*
|--------------------------------------------------------------------------
| NO-SUBSCRIPTION / SUBSCRIBE AND UNLOCK TESTS
|--------------------------------------------------------------------------
*/

test.describe(
  'HappyPrancer Payment - No Active Subscription',
  () => {

    test(
      'PAYMENT-017 - User without subscription should see SUBSCRIBE AND UNLOCK',
      async ({ page }) => {

        await login(page);

        await expect(
          subscribeAndUnlockButton(page)
        ).toBeVisible({
          timeout: 15_000,
        });
      }
    );


    test(
      'PAYMENT-018 - SUBSCRIBE AND UNLOCK should redirect to subscription',
      async ({ page }) => {

        await login(page);

        await expect(
          subscribeAndUnlockButton(page)
        ).toBeVisible();

        await subscribeAndUnlockButton(page).click();

        await expect(page).toHaveURL(
          /\/subscription/i
        );
      }
    );


    test(
      'PAYMENT-019 - Subscription page should show membership heading',
      async ({ page }) => {

        await login(page);

        await openSubscriptionPage(page);

        await expect(
          page.getByRole('heading', {
            name: /Find the membership that fits/i,
          })
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-020 - Trial option should be available',
      async ({ page }) => {

        await login(page);

        await openSubscriptionPage(page);

        await expect(
          trialButton(page)
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-021 - Monthly option should be available',
      async ({ page }) => {

        await login(page);

        await openSubscriptionPage(page);

        await expect(
          monthlyButton(page)
        ).toBeVisible();
      }
    );


    test(
      'PAYMENT-022 - Yearly option should be available',
      async ({ page }) => {

        await login(page);

        await openSubscriptionPage(page);

        await expect(
          yearlyButton(page)
        ).toBeVisible();
      }
    );


   test(
  'PAYMENT-023 - Monthly selection should display subscription details',
  async ({ page }) => {

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    await expect(
      page.getByRole('heading', {
        name: /Anupam Hybrid Class/i,
      })
    ).toBeVisible({
      timeout: 10_000,
    });
  }
);


   test(
  'PAYMENT-024 - Referral or discount field should be displayed',
  async ({ page }) => {

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    // Select the monthly plan
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 10_000,
    });

    await choosePlanButton.click();

    // Referral/discount field appears on the payment page
    await expect(
      page.getByRole('textbox', {
        name: /Referral or discount code/i,
      })
    ).toBeVisible({
      timeout: 15_000,
    });
  }
);


    test(
  'PAYMENT-025 - Apply button should be displayed',
  async ({ page }) => {

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    // Select monthly plan
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 10_000,
    });

    await choosePlanButton.click();

    // Verify Apply button on payment page
    await expect(
      page.getByRole('button', {
        name: /^Apply$/i,
      })
    ).toBeVisible({
      timeout: 15_000,
    });
  }
);


test(
  'PAYMENT-026 - Subtotal should be displayed',
  async ({ page }) => {

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    // Select monthly plan
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 10_000,
    });

    await choosePlanButton.click();

    // Verify Subtotal on payment page
    await expect(
      page.getByText(/Subtotal/i).first()
    ).toBeVisible({
      timeout: 15_000,
    });
  }
);


test(
  'PAYMENT-027 - Total should be displayed',
  async ({ page }) => {

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    // Select monthly plan
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 10_000,
    });

    await choosePlanButton.click();

    // Verify Total on payment page
    await expect(
      page.getByText(/^Total/i).first()
    ).toBeVisible({
      timeout: 15_000,
    });
  }
);


test(
  'PAYMENT-028 - Proceed To Pay should be displayed',
  async ({ page }) => {

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    // Select monthly plan
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 10_000,
    });

    await choosePlanButton.click();

    // Verify Proceed To Pay on payment page
    await expect(
      proceedToPayButton(page)
    ).toBeVisible({
      timeout: 15_000,
    });
  }
);

test(
  'PAYMENT-029 - Payment gateway should open',
  async ({ page }) => {

    test.setTimeout(90_000);

    await login(page);

    await openSubscriptionPage(page);

    await monthlyButton(page).click();

    // Select monthly plan
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 10_000,
    });

    await choosePlanButton.click();

    // 10. Proceed to payment
    const proceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    });

    await expect(proceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(proceedToPay).toBeEnabled({
      timeout: 15_000,
    });

    await proceedToPay.click();

    // 11. Wait for Razorpay iframe
    const razorpayIframe = page.locator('iframe').first();

    await expect(razorpayIframe).toBeAttached({
      timeout: 30_000,
    });

    // 12. Get payment iframe
    const paymentFrame = razorpayIframe.contentFrame();

  }
);

test(
  'PAYMENT-030 - Exit payment gateway and return to payment page',
  async ({ page }) => {
    test.setTimeout(180_000);

    // 1. Login
    await login(page);

    // 2. Open subscription page
    await openSubscriptionPage(page);

    // 3. Select Monthly
    await monthlyButton(page).click();

    // 4. Choose Anupam Hybrid Class
    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 15_000,
    });

    await choosePlanButton.click();

    // --------------------------------------------------
    // 5. FIRST Proceed To Pay
    // --------------------------------------------------

    const firstProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(firstProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(firstProceedToPay).toBeEnabled({
      timeout: 30_000,
    });

    await firstProceedToPay.click();

    console.log('First Proceed To Pay clicked.');

    // --------------------------------------------------
    // 6. Wait for betapayment page
    // --------------------------------------------------

    await expect(page).toHaveURL(
      /betapayment\.happyprancer\.com/,
      {
        timeout: 30_000,
      }
    );

    console.log('Betapayment page opened.');
// --------------------------------------------------
// 7. SECOND Proceed To Pay
//    This starts the Razorpay gateway.
// --------------------------------------------------
// --------------------------------------------------
// 7. RELOAD BETAPAYMENT PAGE
//    Wait for payment/session data to initialize.
// --------------------------------------------------

await page.reload({
  waitUntil: 'domcontentloaded',
});

console.log('Betapayment page reloaded.');

// Give the page a few seconds to initialize payment data.
await page.waitForTimeout(5000);

// --------------------------------------------------
// 8. SECOND Proceed To Pay
// --------------------------------------------------

const secondProceedToPay = page.getByRole('button', {
  name: /Proceed To Pay/i,
}).first();

await expect(secondProceedToPay).toBeVisible({
  timeout: 30_000,
});

await expect(secondProceedToPay).toBeEnabled({
  timeout: 90_000,
});

console.log('Second Proceed To Pay is enabled.');

await secondProceedToPay.click();

console.log('Second Proceed To Pay clicked.');
// --------------------------------------------------
// 8. Wait for Razorpay X / Close button
// --------------------------------------------------
// --------------------------------------------------
// 8. Wait for Razorpay contact form
// --------------------------------------------------

let paymentFrame: Frame | undefined;

await expect.poll(
  async () => {
    for (const frame of page.frames()) {
      const phoneInput = frame.getByTestId('contactNumber');

      if (await phoneInput.isVisible().catch(() => false)) {
        paymentFrame = frame;
        return true;
      }
    }

    return false;
  },
  {
    timeout: 90_000,
    intervals: [2000, 3000, 5000],
  }
).toBe(true);

if (!paymentFrame) {
  throw new Error(
    'Razorpay contact form did not appear within 90 seconds.'
  );
}

console.log('Razorpay contact form appeared.');

// --------------------------------------------------
// 9. Fill phone number and email
// --------------------------------------------------

const phoneInput = paymentFrame.getByTestId('contactNumber');
const emailInput = paymentFrame.getByTestId('email');

await expect(phoneInput).toBeVisible({
  timeout: 30_000,
});

await expect(emailInput).toBeVisible({
  timeout: 30_000,
});

await phoneInput.fill(
  process.env.HAPPYPRANCER_PAYMENT_PHONE || '7827197829'
);

await emailInput.fill(
  process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
    'usertester@gmail.com'
);

console.log('Phone number and email entered.');

// --------------------------------------------------
// 10. Click Continue
// --------------------------------------------------

const continueButton = paymentFrame.getByRole('button', {
  name: 'Continue',
});

await expect(continueButton).toBeVisible({
  timeout: 15_000,
});

await expect(continueButton).toBeEnabled({
  timeout: 15_000,
});

await continueButton.click();

console.log('Razorpay Continue clicked.');

// --------------------------------------------------
// 11. Wait for Razorpay X / Close button
// --------------------------------------------------

let closeFrame: Frame | undefined;

await expect.poll(
  async () => {
    for (const frame of page.frames()) {
      const closeButton =
        frame.getByTestId('checkout-close');

      if (
        await closeButton.isVisible().catch(() => false)
      ) {
        closeFrame = frame;
        return true;
      }
    }

    return false;
  },
  {
    timeout: 60_000,
    intervals: [2000, 3000, 5000],
  }
).toBe(true);

if (!closeFrame) {
  throw new Error(
    'Razorpay X / close button did not appear.'
  );
}

console.log('Razorpay payment gateway appeared.');

// --------------------------------------------------
// 12. Click X / Close
// --------------------------------------------------

const closeButton =
  closeFrame.getByTestId('checkout-close');

await expect(closeButton).toBeVisible({
  timeout: 15_000,
});

await closeButton.click();

console.log('Razorpay X clicked.');

// --------------------------------------------------
// 13. Confirm "Yes, exit"
// --------------------------------------------------

let exitFrame: Frame | undefined;

await expect.poll(
  async () => {
    for (const frame of page.frames()) {
      const exitButton =
        frame.getByTestId('confirm-negative');

      if (
        await exitButton.isVisible().catch(() => false)
      ) {
        exitFrame = frame;
        return true;
      }
    }

    return false;
  },
  {
    timeout: 15_000,
    intervals: [1000, 2000],
  }
).toBe(true);

if (!exitFrame) {
  throw new Error(
    'Razorpay "Yes, exit" button was not found.'
  );
}

const exitButton =
  exitFrame.getByTestId('confirm-negative');

await expect(exitButton).toBeVisible({
  timeout: 15_000,
});

await exitButton.click();

console.log('Clicked Yes, exit.');

    // --------------------------------------------------
    // 14. Verify HappyPrancer payment page
    // --------------------------------------------------

    await expect(
      page.getByRole('heading', {
        name: 'Total Payment',
      })
    ).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByRole('heading', {
        name: 'Subscription Details',
      })
    ).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText('Anupam Hybrid Class', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 30_000,
    });

    console.log(
      'PAYMENT-030 PASSED: Returned to payment page.'
    );
  }
);
test(
  'PAYMENT-031 - Continue to payment after closing gateway',
  async ({ page }) => {
    test.setTimeout(180_000);

    // --------------------------------------------------
    // 1. Login
    // --------------------------------------------------

    await login(page);

    // --------------------------------------------------
    // 2. Open subscription page
    // --------------------------------------------------

    await openSubscriptionPage(page);

    // --------------------------------------------------
    // 3. Select Monthly
    // --------------------------------------------------

    await monthlyButton(page).click();

    // --------------------------------------------------
    // 4. Choose Anupam Hybrid Class
    // --------------------------------------------------

    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 15_000,
    });

    await choosePlanButton.click();

    // --------------------------------------------------
    // 5. FIRST Proceed To Pay
    // --------------------------------------------------

    const firstProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(firstProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(firstProceedToPay).toBeEnabled({
      timeout: 30_000,
    });

    await firstProceedToPay.click();

    console.log('First Proceed To Pay clicked.');

    // --------------------------------------------------
    // 6. Wait for betapayment page
    // --------------------------------------------------

    await expect(page).toHaveURL(
      /betapayment\.happyprancer\.com/,
      {
        timeout: 30_000,
      }
    );

    console.log('Betapayment page opened.');

    // --------------------------------------------------
    // 7. RELOAD BETAPAYMENT PAGE
    //    Wait for payment/session data to initialize.
    // --------------------------------------------------

    await page.reload({
      waitUntil: 'domcontentloaded',
    });

    console.log('Betapayment page reloaded.');

    await page.waitForTimeout(5000);

    // --------------------------------------------------
    // 8. SECOND Proceed To Pay
    // --------------------------------------------------

    const secondProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(secondProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(secondProceedToPay).toBeEnabled({
      timeout: 90_000,
    });

    console.log('Second Proceed To Pay is enabled.');

    await secondProceedToPay.click();

    console.log('Second Proceed To Pay clicked.');

    // --------------------------------------------------
    // 9. Wait for Razorpay contact form
    // --------------------------------------------------

    let paymentFrame: Frame | undefined;

    await expect.poll(
      async () => {
        for (const frame of page.frames()) {
          const phoneInput =
            frame.getByTestId('contactNumber');

          if (
            await phoneInput
              .isVisible()
              .catch(() => false)
          ) {
            paymentFrame = frame;
            return true;
          }
        }

        return false;
      },
      {
        timeout: 90_000,
        intervals: [2000, 3000, 5000],
      }
    ).toBe(true);

    if (!paymentFrame) {
      throw new Error(
        'Razorpay contact form did not appear within 90 seconds.'
      );
    }

    console.log(
      'Razorpay contact form appeared.'
    );

    // --------------------------------------------------
    // 10. Fill phone number and email
    // --------------------------------------------------

    const phoneInput =
      paymentFrame.getByTestId('contactNumber');

    const emailInput =
      paymentFrame.getByTestId('email');

    await expect(phoneInput).toBeVisible({
      timeout: 30_000,
    });

    await expect(emailInput).toBeVisible({
      timeout: 30_000,
    });

    await phoneInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_PHONE ||
        '7827197829'
    );

    await emailInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
        'usertester@gmail.com'
    );

    console.log(
      'Phone number and email entered.'
    );

    // --------------------------------------------------
    // 11. Click Continue
    // --------------------------------------------------

    const continueButton =
      paymentFrame.getByRole('button', {
        name: 'Continue',
      });

    await expect(continueButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(continueButton).toBeEnabled({
      timeout: 15_000,
    });

    await continueButton.click();

    console.log(
      'Razorpay Continue clicked.'
    );

    // --------------------------------------------------
    // 12. Wait for Razorpay X / Close button
    // --------------------------------------------------

    let closeFrame: Frame | undefined;

    await expect.poll(
      async () => {
        for (const frame of page.frames()) {
          const closeButton =
            frame.getByTestId('checkout-close');

          if (
            await closeButton
              .isVisible()
              .catch(() => false)
          ) {
            closeFrame = frame;
            return true;
          }
        }

        return false;
      },
      {
        timeout: 60_000,
        intervals: [2000, 3000, 5000],
      }
    ).toBe(true);

    if (!closeFrame) {
      throw new Error(
        'Razorpay X / close button did not appear.'
      );
    }

    console.log(
      'Razorpay payment gateway appeared.'
    );

    // --------------------------------------------------
    // 13. Click X / Close
    // --------------------------------------------------

    const closeButton =
      closeFrame.getByTestId('checkout-close');

    await expect(closeButton).toBeVisible({
      timeout: 15_000,
    });

    await closeButton.click();

    console.log(
      'Razorpay X clicked.'
    );

   // --------------------------------------------------
// 14. Click "Continue to payment"
// --------------------------------------------------

let continuePaymentFrame: Frame | undefined;

await expect.poll(
  async () => {
    for (const frame of page.frames()) {
      const continuePaymentButton =
        frame.getByTestId('confirm-negative');

      if (
        await continuePaymentButton
          .isVisible()
          .catch(() => false)
      ) {
        continuePaymentFrame = frame;
        return true;
      }
    }

    return false;
  },
  {
    timeout: 15_000,
    intervals: [1000, 2000],
  }
).toBe(true);

if (!continuePaymentFrame) {
  throw new Error(
    'Razorpay "Continue to payment" button was not found.'
  );
}

const continuePaymentButton =
  continuePaymentFrame.getByTestId(
    'confirm-negative'
  );

await expect(continuePaymentButton).toBeVisible({
  timeout: 15_000,
});

await expect(continuePaymentButton).toBeEnabled({
  timeout: 15_000,
});

await continuePaymentButton.click();

console.log(
  'Clicked Continue to payment.'
);
// --------------------------------------------------
// 15. Verify Payment Options page remains displayed
// --------------------------------------------------

let paymentOptionsFrame: Frame | undefined;

await expect.poll(
  async () => {
    for (const frame of page.frames()) {
      const title = frame.getByTestId('title');

      if (
        await title.isVisible().catch(() => false)
      ) {
        paymentOptionsFrame = frame;
        return true;
      }
    }

    return false;
  },
  {
    timeout: 30_000,
    intervals: [1000, 2000, 3000],
  }
).toBe(true);

if (!paymentOptionsFrame) {
  throw new Error(
    'Razorpay Payment Options page was not displayed.'
  );
}

console.log(
  'Razorpay Payment Options page is displayed.'
);

// --------------------------------------------------
// 16. Verify Payment Options page
// --------------------------------------------------

await expect(
  paymentOptionsFrame.getByTestId('title')
).toBeVisible({
  timeout: 15_000,
});

await expect(
  paymentOptionsFrame.locator('body')
).toBeVisible({
  timeout: 15_000,
});

console.log(
  'PAYMENT-031 PASSED: Continue to payment kept the Payment Options page open.'
);
  });
test(
  'PAYMENT-032 - Complete payment using UPI QR and verify dashboard',
  async ({ page }) => {
    test.setTimeout(180_000);

    // --------------------------------------------------
    // 1. Login
    // --------------------------------------------------

    await login(page);

    // --------------------------------------------------
    // 2. Open subscription page
    // --------------------------------------------------

    await openSubscriptionPage(page);

    // --------------------------------------------------
    // 3. Select Monthly
    // --------------------------------------------------

    await monthlyButton(page).click();

    // --------------------------------------------------
    // 4. Choose Anupam Hybrid Class
    // --------------------------------------------------

    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 15_000,
    });

    await choosePlanButton.click();

    // --------------------------------------------------
    // 5. FIRST Proceed To Pay
    // --------------------------------------------------

    const firstProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(firstProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(firstProceedToPay).toBeEnabled({
      timeout: 30_000,
    });

    await firstProceedToPay.click();

    console.log('First Proceed To Pay clicked.');

    // --------------------------------------------------
    // 6. Wait for betapayment page
    // --------------------------------------------------

    await expect(page).toHaveURL(
      /betapayment\.happyprancer\.com/,
      {
        timeout: 30_000,
      }
    );

    console.log('Betapayment page opened.');

    // --------------------------------------------------
    // 7. Reload betapayment page
    // --------------------------------------------------

    await page.reload({
      waitUntil: 'domcontentloaded',
    });

    console.log('Betapayment page reloaded.');

    await page.waitForTimeout(5000);

    // --------------------------------------------------
    // 8. SECOND Proceed To Pay
    // --------------------------------------------------

    const secondProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(secondProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(secondProceedToPay).toBeEnabled({
      timeout: 90_000,
    });

    console.log('Second Proceed To Pay is enabled.');

    await secondProceedToPay.click();

    console.log('Second Proceed To Pay clicked.');

    // --------------------------------------------------
    // 9. Wait for Razorpay contact form
    // --------------------------------------------------

    let paymentFrame: Frame | undefined;

    await expect.poll(
      async () => {
        for (const frame of page.frames()) {
          const phoneInput =
            frame.getByTestId('contactNumber');

          if (
            await phoneInput
              .isVisible()
              .catch(() => false)
          ) {
            paymentFrame = frame;
            return true;
          }
        }

        return false;
      },
      {
        timeout: 90_000,
        intervals: [2000, 3000, 5000],
      }
    ).toBe(true);

    if (!paymentFrame) {
      throw new Error(
        'Razorpay contact form did not appear within 90 seconds.'
      );
    }

    console.log(
      'Razorpay contact form appeared.'
    );

    // --------------------------------------------------
    // 10. Fill phone number and email
    // --------------------------------------------------

    const phoneInput =
      paymentFrame.getByTestId('contactNumber');

    const emailInput =
      paymentFrame.getByTestId('email');

    await expect(phoneInput).toBeVisible({
      timeout: 30_000,
    });

    await expect(emailInput).toBeVisible({
      timeout: 30_000,
    });

    await phoneInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_PHONE ||
        '7827197829'
    );

    await emailInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
        'usertester@gmail.com'
    );

    console.log(
      'Phone number and email entered.'
    );

    // --------------------------------------------------
    // 11. Click Continue
    // --------------------------------------------------

    const continueButton =
      paymentFrame.getByRole('button', {
        name: 'Continue',
      });

    await expect(continueButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(continueButton).toBeEnabled({
      timeout: 15_000,
    });

    await continueButton.click();

    console.log(
      'Razorpay Continue clicked.'
    );

    // --------------------------------------------------
    // 12. Click Show QR
    // --------------------------------------------------

    const showQR =
      paymentFrame.getByRole('button', {
        name: 'Show QR',
      });

    await expect(showQR).toBeVisible({
      timeout: 30_000,
    });

    await showQR.click();

    console.log(
      'Show QR clicked.'
    );

    // --------------------------------------------------
    // 13. Click UPI QR Code
    // --------------------------------------------------

    const upiQR =
      paymentFrame.getByRole('button', {
        name: 'UPI QR Code',
      });

    await expect(upiQR).toBeVisible({
      timeout: 30_000,
    });

    await upiQR.click();

    console.log(
      'UPI QR Code clicked.'
    );

    // --------------------------------------------------
    // 14. Codegen recorded the QR button
    //     being clicked again
    // --------------------------------------------------

    const upiQRAgain =
      paymentFrame.getByRole('button', {
        name: 'UPI QR Code',
      });

    if (
      await upiQRAgain
        .isVisible()
        .catch(() => false)
    ) {
      await upiQRAgain.click();

      console.log(
        'UPI QR Code clicked again.'
      );
    }

    // --------------------------------------------------
    // 15. Wait for payment to become successful
    // --------------------------------------------------

    const paymentStatus =
      paymentFrame.getByTestId(
        'payment-status-heading'
      );

    await expect(paymentStatus).toBeVisible({
      timeout: 30_000,
    });

    await expect(paymentStatus).toHaveText(
      /Payment Successful/i,
      {
        timeout: 120_000,
      }
    );

    console.log(
      'Payment Successful displayed.'
    );

    // --------------------------------------------------
    // 16. Payment successful.
    //     Allow HappyPrancer to restore session.
    // --------------------------------------------------

    await expect(
      page.getByText(
        /Verifying your session/i
      )
    ).toBeVisible({
      timeout: 15_000,
    }).catch(() => {});

    // --------------------------------------------------
    // 17. Wait until session restoration finishes
    // --------------------------------------------------

    await expect(
      page.getByText(
        /Verifying your session/i
      )
    ).not.toBeVisible({
      timeout: 60_000,
    }).catch(() => {});

    console.log(
      'Session restoration completed.'
    );

    // --------------------------------------------------
    // 18. Payment successful → go to dashboard
    // --------------------------------------------------

    await page.goto(
      `${BASE_URL}/dashboard`,
      {
        waitUntil: 'domcontentloaded',
      }
    );

    await expect(
      page.getByText(
        /Verifying your session/i
      )
    ).not.toBeVisible({
      timeout: 30_000,
    });

    // --------------------------------------------------
    // 19. Make sure we are on dashboard
    // --------------------------------------------------

    await expect(page).not.toHaveURL(
      /\/login/i
    );

    console.log(
      'PAYMENT-032 PASSED: Payment successful and dashboard opened.'
    );
  }
);
test(
  'PAYMENT-033 - Cancel subscription, resubscribe and verify card payment failure',
  async ({ page }) => {
    test.setTimeout(180_000);

    // ---------------------------------------------------------
    // 1. Login
    // ---------------------------------------------------------
    await login(page);

    // ---------------------------------------------------------
    // 2. Check subscription state
    // ---------------------------------------------------------
    if (!(await isNonSubscribedUser(page))) {
      // User is subscribed → cancel the subscription first
      await openPaymentsFromMenu(page);

      const modifyButton = page.getByRole('button', {
        name: /^Modify$/i,
      }).first();

      await expect(modifyButton).toBeVisible({
        timeout: 15_000,
      });

      await modifyButton.click();

      const cancelButton = page.getByRole('button', {
        name: /^Cancel$/i,
      }).first();

      await expect(cancelButton).toBeVisible({
        timeout: 15_000,
      });

      await cancelButton.click();

      const confirmCancelButton = page.getByRole('button', {
        name: /I am sure, cancel subscription/i,
      });

      await expect(confirmCancelButton).toBeVisible({
        timeout: 15_000,
      });

      await expect(confirmCancelButton).toBeEnabled({
        timeout: 15_000,
      });

      await confirmCancelButton.click();

      // Cancellation can take some time
      await expect(
        page.getByText(/Cancelling/i)
      )
        .toBeVisible({ timeout: 15_000 })
        .catch(() => {});

      await expect(
        page.getByText(/Verifying your session/i)
      )
        .toBeVisible({ timeout: 30_000 })
        .catch(() => {});

      await expect(
        page.getByText(/Verifying your session/i)
      )
        .not.toBeVisible({ timeout: 60_000 })
        .catch(() => {});

      // Give the dashboard a few seconds to update
      await page.waitForTimeout(5_000);
    }

    // ---------------------------------------------------------
    // 3. Verify subscription is cancelled
    // ---------------------------------------------------------
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).not.toHaveURL(/\/login/i);

    await skipOnboardingIfVisible(page);

    const subscribeButton = page.getByRole('button', {
      name: /SUBSCRIBE AND UNLOCK/i,
    });

    await expect(subscribeButton).toBeVisible({
      timeout: 30_000,
    });

    // ---------------------------------------------------------
    // 4. Open subscription page
    // ---------------------------------------------------------
    await subscribeButton.click();

    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 30_000,
    });

    await choosePlanButton.click();

    // ---------------------------------------------------------
    // 5. Proceed to payment
    // ---------------------------------------------------------
    const firstProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(firstProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(firstProceedToPay).toBeEnabled({
      timeout: 30_000,
    });

    await firstProceedToPay.click();

    // ---------------------------------------------------------
    // 6. Wait for payment page
    // ---------------------------------------------------------
    await expect(page).toHaveURL(
      /betapayment\.happyprancer\.com/,
      {
        timeout: 30_000,
      }
    );

    // Same initialization flow used in PAYMENT-033
    await page.reload({
      waitUntil: 'domcontentloaded',
    });

    await page.waitForTimeout(5_000);

    const secondProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(secondProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(secondProceedToPay).toBeEnabled({
      timeout: 90_000,
    });

    await secondProceedToPay.click();

    // ---------------------------------------------------------
    // 7. Wait for Razorpay contact form
    // ---------------------------------------------------------
    let paymentFrame: Frame | undefined;

    await expect.poll(
      async () => {
        for (const frame of page.frames()) {
          const phoneInput = frame.getByTestId(
            'contactNumber'
          );

          if (
            await phoneInput.isVisible().catch(() => false)
          ) {
            paymentFrame = frame;
            return true;
          }
        }

        return false;
      },
      {
        timeout: 90_000,
        intervals: [2000, 3000, 5000],
      }
    ).toBe(true);

    if (!paymentFrame) {
      throw new Error(
        'Razorpay payment frame did not appear.'
      );
    }

    // ---------------------------------------------------------
    // 8. Fill contact information
    // ---------------------------------------------------------
    const phoneInput = paymentFrame.getByTestId(
      'contactNumber'
    );

    const emailInput = paymentFrame.getByTestId(
      'email'
    );

    await expect(phoneInput).toBeVisible({
      timeout: 30_000,
    });

    await expect(emailInput).toBeVisible({
      timeout: 30_000,
    });

    await phoneInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_PHONE ||
        '7978753410'
    );

    await emailInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
        'usertester@gmail.com'
    );

    const continueButton = paymentFrame.getByRole(
      'button',
      {
        name: 'Continue',
      }
    );

    await expect(continueButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(continueButton).toBeEnabled({
      timeout: 15_000,
    });

    await continueButton.click();

    // ---------------------------------------------------------
    // 9. Select Cards
    // ---------------------------------------------------------
    const cardOption = paymentFrame.getByTestId('card');

    await expect(cardOption).toBeVisible({
      timeout: 30_000,
    });

    await cardOption.click();

    // Select Cards VISA / Mastercard / RuPay / Maestro
    const cardsRadio = paymentFrame.getByRole('radio', {
      name: 'Cards VISA MC RUPAY MAES',
    });

    await expect(cardsRadio).toBeVisible({
      timeout: 15_000,
    });

    await cardsRadio.check();

    // ---------------------------------------------------------
    // 10. Enter test card details
    // ---------------------------------------------------------
    const cardNumber = paymentFrame.getByRole(
      'textbox',
      {
        name: 'Card Number',
      }
    );

    await expect(cardNumber).toBeVisible({
      timeout: 15_000,
    });

    await cardNumber.fill('4242424242424242');

    const expiry = paymentFrame.getByRole(
      'textbox',
      {
        name: 'MM / YY',
      }
    );

    await expiry.fill('12 / 34');

    const cvv = paymentFrame.getByRole(
      'textbox',
      {
        name: 'CVV',
      }
    );

    await cvv.fill('122');

    const cardName = paymentFrame.getByRole(
      'textbox',
      {
        name: 'Enter name on card',
      }
    );

    await cardName.fill('userTester');

    // ---------------------------------------------------------
    // 11. Click Add Card / Continue
    // ---------------------------------------------------------
    const addCardButton = paymentFrame.locator(
      '[data-test-id="add-card-cta"]'
    );

    await expect(addCardButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(addCardButton).toBeEnabled({
      timeout: 15_000,
    });

    // Codegen shows this opens the simulated bank page
    const bankPagePromise = page.waitForEvent(
      'popup'
    );

    await addCardButton.click();

    const bankPage = await bankPagePromise;
// ---------------------------------------------------------
// 12. Wait for simulated Razorpay bank page
// ---------------------------------------------------------

// The popup may navigate through the Razorpay authenticate URL.
// Do not wait for the intermediate "Loading bank page..." text.
// Wait for the actual bank-page action instead.

await bankPage.waitForLoadState('domcontentloaded').catch(() => {});

const failureButton = bankPage.getByRole('button', {
  name: 'Failure',
});

await expect(failureButton).toBeVisible({
  timeout: 60_000,
});

await expect(failureButton).toBeEnabled({
  timeout: 15_000,
});

// ---------------------------------------------------------
// 13. Click FAILURE
// ---------------------------------------------------------

await failureButton.click();

// ---------------------------------------------------------
// 14. Verify payment failure modal
// ---------------------------------------------------------

const paymentStatusModal = paymentFrame.getByTestId(
  'payment-status-modal'
);

await expect(paymentStatusModal).toBeVisible({
  timeout: 30_000,
});

await expect(paymentStatusModal).toContainText(
  /Payment could not be completed/i,
  {
    timeout: 30_000,
  }
);

// ---------------------------------------------------------
// 15. Click X on the failure modal
// ---------------------------------------------------------

const closeFailureModal = paymentStatusModal
  .getByRole('button')
  .filter({ hasText: /^$/ })
  .first();

await expect(closeFailureModal).toBeVisible({
  timeout: 15_000,
});

await closeFailureModal.click();

// ---------------------------------------------------------
// 16. Verify Payment Options is displayed again
// ---------------------------------------------------------

const paymentOptionsTitle = paymentFrame.getByTestId(
  'title'
);

await expect(paymentOptionsTitle).toBeVisible({
  timeout: 30_000,
});

// Verify Cards option is available again
await expect(
  paymentFrame.getByTestId('card')
).toBeVisible({
  timeout: 15_000,
});

console.log(
  'PAYMENT-033 PASSED: Card payment failure was displayed and Payment Options was restored.'
);
  }
);
test(
  'PAYMENT-034 - Cancel subscription, resubscribe and complete successful card payment',
  async ({ page }) => {
    test.setTimeout(180_000);

    // ---------------------------------------------------------
    // 1. Login
    // ---------------------------------------------------------
    await login(page);

    // ---------------------------------------------------------
    // 2. Cancel existing subscription if active
    // ---------------------------------------------------------
    if (!(await isNonSubscribedUser(page))) {
      await openPaymentsFromMenu(page);

      const modifyButton = page.getByRole('button', {
        name: /^Modify$/i,
      }).first();

      await expect(modifyButton).toBeVisible({
        timeout: 15_000,
      });

      await modifyButton.click();

      const cancelButton = page.getByRole('button', {
        name: /^Cancel$/i,
      }).first();

      await expect(cancelButton).toBeVisible({
        timeout: 15_000,
      });

      await cancelButton.click();

      const confirmCancelButton = page.getByRole('button', {
        name: /I am sure, cancel subscription/i,
      });

      await expect(confirmCancelButton).toBeVisible({
        timeout: 15_000,
      });

      await confirmCancelButton.click();

      await expect(
        page.getByText(/Cancelling/i)
      )
        .toBeVisible({ timeout: 15_000 })
        .catch(() => {});

      await expect(
        page.getByText(/Verifying your session/i)
      )
        .toBeVisible({ timeout: 30_000 })
        .catch(() => {});

      await expect(
        page.getByText(/Verifying your session/i)
      )
        .not.toBeVisible({ timeout: 60_000 })
        .catch(() => {});

      await page.waitForTimeout(5_000);
    }

    // ---------------------------------------------------------
    // 3. Verify SUBSCRIBE AND UNLOCK
    // ---------------------------------------------------------
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).not.toHaveURL(/\/login/i);

    await skipOnboardingIfVisible(page);

    const subscribeButton = page.getByRole('button', {
      name: /SUBSCRIBE AND UNLOCK/i,
    });

    await expect(subscribeButton).toBeVisible({
      timeout: 30_000,
    });

    // ---------------------------------------------------------
    // 4. Select subscription plan
    // ---------------------------------------------------------
    await subscribeButton.click();

    const choosePlanButton = page.getByRole('button', {
      name: /Choose anupam hybrid class/i,
    });

    await expect(choosePlanButton).toBeVisible({
      timeout: 30_000,
    });

    await choosePlanButton.click();

    // ---------------------------------------------------------
    // 5. Proceed to payment
    // ---------------------------------------------------------
    const firstProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(firstProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(firstProceedToPay).toBeEnabled({
      timeout: 30_000,
    });

    await firstProceedToPay.click();

    // ---------------------------------------------------------
    // 6. Payment page initialization
    // ---------------------------------------------------------
    await expect(page).toHaveURL(
      /betapayment\.happyprancer\.com/,
      {
        timeout: 30_000,
      }
    );

    await page.reload({
      waitUntil: 'domcontentloaded',
    });

    await page.waitForTimeout(5_000);

    const secondProceedToPay = page.getByRole('button', {
      name: /Proceed To Pay/i,
    }).first();

    await expect(secondProceedToPay).toBeVisible({
      timeout: 30_000,
    });

    await expect(secondProceedToPay).toBeEnabled({
      timeout: 90_000,
    });

    await secondProceedToPay.click();

    // ---------------------------------------------------------
    // 7. Find Razorpay payment frame
    // ---------------------------------------------------------
    let paymentFrame: Frame | undefined;

    await expect.poll(
      async () => {
        for (const frame of page.frames()) {
          const phoneInput = frame.getByTestId(
            'contactNumber'
          );

          if (
            await phoneInput.isVisible().catch(() => false)
          ) {
            paymentFrame = frame;
            return true;
          }
        }

        return false;
      },
      {
        timeout: 90_000,
        intervals: [2000, 3000, 5000],
      }
    ).toBe(true);

    if (!paymentFrame) {
      throw new Error(
        'Razorpay payment frame did not appear.'
      );
    }

    // ---------------------------------------------------------
    // 8. Fill contact information
    // ---------------------------------------------------------
    const phoneInput = paymentFrame.getByTestId(
      'contactNumber'
    );

    const emailInput = paymentFrame.getByTestId(
      'email'
    );

    await expect(phoneInput).toBeVisible({
      timeout: 30_000,
    });

    await expect(emailInput).toBeVisible({
      timeout: 30_000,
    });

    await phoneInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_PHONE ||
        '7978753410'
    );

    await emailInput.fill(
      process.env.HAPPYPRANCER_PAYMENT_EMAIL ||
        'usertester@gmail.com'
    );

    const continueButton = paymentFrame.getByRole(
      'button',
      {
        name: 'Continue',
      }
    );

    await expect(continueButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(continueButton).toBeEnabled({
      timeout: 15_000,
    });

    await continueButton.click();

    // ---------------------------------------------------------
    // 9. Select Cards
    // ---------------------------------------------------------
    const cardOption = paymentFrame.getByTestId('card');

    await expect(cardOption).toBeVisible({
      timeout: 30_000,
    });

    await cardOption.click();

    const cardsRadio = paymentFrame.getByRole('radio', {
      name: 'Cards VISA MC RUPAY MAES',
    });

    await expect(cardsRadio).toBeVisible({
      timeout: 15_000,
    });

    await cardsRadio.check();

    // ---------------------------------------------------------
    // 10. Enter card details
    // ---------------------------------------------------------
    const cardNumber = paymentFrame.getByRole(
      'textbox',
      {
        name: 'Card Number',
      }
    );

    await expect(cardNumber).toBeVisible({
      timeout: 15_000,
    });

    await cardNumber.fill('4242424242424242');

    const expiry = paymentFrame.getByRole(
      'textbox',
      {
        name: 'MM / YY',
      }
    );

    await expiry.fill('12 / 34');

    const cvv = paymentFrame.getByRole(
      'textbox',
      {
        name: 'CVV',
      }
    );

    await cvv.fill('122');

    const cardName = paymentFrame.getByRole(
      'textbox',
      {
        name: 'Enter name on card',
      }
    );

    await cardName.fill('userTester');

    // ---------------------------------------------------------
    // 11. Add card
    // ---------------------------------------------------------
    const addCardButton = paymentFrame.locator(
      '[data-test-id="add-card-cta"]'
    );

    await expect(addCardButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(addCardButton).toBeEnabled({
      timeout: 15_000,
    });

    const bankPagePromise = page.waitForEvent('popup');

    await addCardButton.click();

    const bankPage = await bankPagePromise;

    // ---------------------------------------------------------
    // 12. Wait for simulated Razorpay bank page
    // ---------------------------------------------------------
    await bankPage.waitForLoadState(
      'domcontentloaded'
    ).catch(() => {});

    const successButton = bankPage.getByRole(
      'button',
      {
        name: 'Success',
      }
    );

    await expect(successButton).toBeVisible({
      timeout: 60_000,
    });

    await expect(successButton).toBeEnabled({
      timeout: 15_000,
    });

    // ---------------------------------------------------------
    // 13. Click SUCCESS
    // ---------------------------------------------------------
    await successButton.click();

    // ---------------------------------------------------------
    // 14. Verify payment successful
    // ---------------------------------------------------------
    const paymentStatusHeading =
      paymentFrame.getByTestId(
        'payment-status-heading'
      );

    await expect(paymentStatusHeading).toBeVisible({
      timeout: 30_000,
    });

    await expect(paymentStatusHeading).toHaveText(
      /Payment Successful/i,
      {
        timeout: 120_000,
      }
    );

    // ---------------------------------------------------------
    // 15. Wait for HappyPrancer session restoration
    // ---------------------------------------------------------
    await expect(
      page.getByText(/Verifying your session/i)
    )
      .toBeVisible({
        timeout: 15_000,
      })
      .catch(() => {});

    await expect(
      page.getByText(/Verifying your session/i)
    )
      .not.toBeVisible({
        timeout: 60_000,
      })
      .catch(() => {});

    // ---------------------------------------------------------
    // 16. Navigate to dashboard
    // ---------------------------------------------------------
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByText(/Verifying your session/i)
    ).not.toBeVisible({
      timeout: 30_000,
    });

    // ---------------------------------------------------------
    // 17. Verify dashboard
    // ---------------------------------------------------------
    await expect(page).not.toHaveURL(/\/login/i);

    console.log(
      'PAYMENT-034 PASSED: Card payment was successful and dashboard was opened.'
    );
  }
);
test(
  'PAYMENT-035 - Pause confirmation dialog Cancel should return to Payments dashboard',
  async ({ page }) => {
    await login(page);

    if (await isNonSubscribedUser(page)) {
      test.skip(
        true,
        'Account currently has no active subscription.'
      );
    }

    await openPaymentsFromMenu(page);

    // Open Modify
    await page.getByRole('button', {
      name: /^Modify$/i,
    }).first().click();

    // Click Pause
    await page.getByRole('button', {
      name: /^Pause$/i,
    }).first().click();

    // Verify Pause Subscription dialog
    await expect(
      page.getByRole('heading', {
        name: /^Pause Subscription$/i,
      })
    ).toBeVisible({
      timeout: 15_000,
    });

    // Verify confirmation message
    await expect(
      page.getByText(
        /Are you sure you want to pause your subscription/i
      )
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click Cancel
    const cancelButton = page.getByRole('button', {
      name: /^Cancel$/i,
    }).last();

    await expect(cancelButton).toBeVisible({
      timeout: 10_000,
    });

    await cancelButton.click();

    // Dialog should disappear
    await expect(
      page.getByRole('heading', {
        name: /^Pause Subscription$/i,
      })
    ).not.toBeVisible({
      timeout: 10_000,
    });

    // Underlying Payments dashboard should be visible
    await expect(
      page.getByText('Current Plan', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByText('Billing History', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15_000,
    });

    console.log(
      'PAYMENT-035 PASSED: Cancel closed the Pause Subscription dialog and returned to the Payments dashboard.'
    );
  }
);
test(
  'PAYMENT-036 - Confirm Pause Subscription should pause subscription successfully',
  async ({ page }) => {
    test.setTimeout(120_000);

    await login(page);

    if (await isNonSubscribedUser(page)) {
      test.skip(
        true,
        'Account currently has no active subscription.'
      );
    }

    await openPaymentsFromMenu(page);

    // Open Modify
    await page.getByRole('button', {
      name: /^Modify$/i,
    }).first().click();

    // Click Pause
    await page.getByRole('button', {
      name: /^Pause$/i,
    }).first().click();

    // Verify confirmation dialog
    await expect(
      page.getByRole('heading', {
        name: /^Pause Subscription$/i,
      })
    ).toBeVisible({
      timeout: 15_000,
    });

    // Verify confirmation text
    await expect(
      page.getByText(
        /Are you sure you want to pause your subscription/i
      )
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click "Pause Subscription"
    const confirmPauseButton = page.getByRole('button', {
      name: /^Pause Subscription$/i,
    });

    await expect(confirmPauseButton).toBeVisible({
      timeout: 10_000,
    });

    await expect(confirmPauseButton).toBeEnabled({
      timeout: 10_000,
    });

    await confirmPauseButton.click();

    // Wait for pause operation to complete
    await expect(
      page.getByText(/Pausing|Processing|Updating/i)
    )
      .toBeVisible({
        timeout: 15_000,
      })
      .catch(() => {});

    // Verify a successful pause message.
    // Keep this flexible because the exact success text
    // may differ in the application.
    await expect(
      page.getByText(
        /subscription.*paused|paused.*subscription|successfully.*paused/i
      )
    ).toBeVisible({
      timeout: 30_000,
    });

    // Verify the subscription is now shown as paused.
    await expect(
      page.getByText(/Paused/i).first()
    ).toBeVisible({
      timeout: 30_000,
    });

    console.log(
      'PAYMENT-036 PASSED: Subscription was successfully paused.'
    );
  }
);
  });


/*
|--------------------------------------------------------------------------
| SECURITY TESTS
|--------------------------------------------------------------------------
*/

test.describe(
  'HappyPrancer Payment - Security',
  () => {

    test(
      'PAYMENT-SEC-001 - Unauthenticated user should not access payments',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        await expect(page).toHaveURL(
          /\/login/i
        );
      }
    );


    test(
      'PAYMENT-SEC-002 - Direct payment URL should require login',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        await expect(page).toHaveURL(
          /\/login/i
        );
      }
    );


    test(
      'PAYMENT-SEC-003 - Payment URL should use HTTPS',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        expect(page.url()).toMatch(
          /^https:\/\//i
        );
      }
    );


    test(
      'PAYMENT-SEC-004 - Subscription URL should use HTTPS',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/subscription`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        expect(page.url()).toMatch(
          /^https:\/\//i
        );
      }
    );


    test(
      'PAYMENT-SEC-005 - URL should not contain password parameters',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        expect(page.url()).not.toMatch(
          /password=|passwd=|pwd=/i
        );
      }
    );


    test(
      'PAYMENT-SEC-006 - URL should not expose access token',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        expect(page.url()).not.toMatch(
          /access_token=|auth_token=|token=/i
        );
      }
    );


    test(
      'PAYMENT-SEC-007 - No obvious stack trace should be visible',
      async ({ page }) => {

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        const body =
          await page.locator('body').innerText();

        expect(body).not.toMatch(
          /stack trace|traceback|internal server error/i
        );
      }
    );


    test(
      'PAYMENT-SEC-008 - Payment page should not expose card number',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        const body =
          await page.locator('body').innerText();

        expect(body).not.toMatch(
          /\b(?:\d[ -]*?){13,19}\b/
        );
      }
    );


    test(
      'PAYMENT-SEC-009 - Password input should not be present on payment page',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        await expect(
          page.locator(
            'input[type="password"]'
          )
        ).toHaveCount(0);
      }
    );


    test(
      'PAYMENT-SEC-010 - Payment page should not expose OTP in visible text',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        const body =
          await page.locator('body').innerText();

        expect(body).not.toMatch(
          /\bOTP\s*[:\-]?\s*\d{4,8}\b/i
        );
      }
    );


    test(
      'PAYMENT-SEC-011 - Payment page should not expose auth token in visible text',
      async ({ page }) => {

        await login(page);

        if (
          await isNonSubscribedUser(page)
        ) {
          test.skip(
            true,
            'Account currently has no active subscription.'
          );
        }

        await openPaymentsFromMenu(page);

        const body =
          await page.locator('body').innerText();

        expect(body).not.toMatch(
          /access_token\s*[:=]|refresh_token\s*[:=]|authorization\s*[:=]/i
        );
      }
    );


    test(
      'PAYMENT-SEC-012 - Protected payment content should not be visible without authentication',
      async ({ page }) => {

        await page.context().clearCookies();

        await page.goto(
          `${BASE_URL}/payments`,
          {
            waitUntil: 'domcontentloaded',
          }
        );

        await expect(page).toHaveURL(
          /\/login/i
        );

        const body =
          await page.locator('body').innerText();

        expect(body).not.toMatch(
          /Current Plan|Billing History|Next Renewal/i
        );
      }
    );
  }
);