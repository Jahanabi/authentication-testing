import { Page } from '@playwright/test';

export async function verifyLoginSuccess(
  page: Page,
  originalUrl: string
): Promise<boolean> {

  await page.waitForTimeout(2000);

  // Method 1:
  // URL changed after successful authentication.
  if (page.url() !== originalUrl) {
    return true;
  }

  // Method 2:
  // Common authenticated UI indicators.
  const authenticatedIndicators = [
    'text=Logout',
    'text=Log Out',
    'text=Sign Out',
    'text=My Account',
    '[href*="logout" i]',
    '[href*="dashboard" i]',
    '[data-testid*="logout" i]',
    '[data-testid*="dashboard" i]'
  ];

  for (const selector of authenticatedIndicators) {
    const element = page.locator(selector).first();

    if (await element.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}