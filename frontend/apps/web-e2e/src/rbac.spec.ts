import { expect, test } from '@playwright/test';
import { login } from './support';

test.describe('role based access', () => {
  test('an auditor sees read-only screens and is redirected from create routes', async ({ page }) => {
    await login(page, 'auditor@alyamama.example');
    await page.goto('/accounting/invoices');
    await page.waitForSelector('erp-invoice-list-page tbody tr');
    await expect(page.getByRole('button', { name: /Create/ })).toHaveCount(0);
    await page.goto('/accounting/invoices/new');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('an accounts manager can open the new invoice form', async ({ page }) => {
    await login(page);
    await page.goto('/accounting/invoices/new');
    await expect(page).toHaveURL(/\/accounting\/invoices\/new/);
  });
});
