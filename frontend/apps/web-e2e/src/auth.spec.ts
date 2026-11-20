import { expect, test } from '@playwright/test';
import { login } from './support';

test.describe('authentication and shell', () => {
  test('anonymous users are sent to the login page', async ({ page }) => {
    await page.goto('/accounting/invoices');
    await expect(page).toHaveURL(/\/login/);
  });

  test('bad credentials show an error and stay on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', 'auditor@alyamama.example');
    await page.fill('input[formcontrolname=password]', 'nope');
    await page.click('button[type=submit]');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a valid sign-in lands on the dashboard inside the shell', async ({ page }) => {
    await login(page);
    await expect(page.locator('aside nav a').first()).toBeVisible();
    await expect(page.locator('erp-dashboard-page')).toBeVisible();
  });

  test('switching to Arabic flips the document to right-to-left', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'عربي' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('unknown routes show the not-found page', async ({ page }) => {
    await login(page);
    await page.goto('/no/such/page');
    await expect(page.locator('erp-not-found-page, erp-not-found')).toBeVisible();
  });

});
