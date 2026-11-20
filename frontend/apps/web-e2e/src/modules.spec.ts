import { expect, test } from '@playwright/test';
import { login } from './support';

test.describe('feature modules render', () => {
  test.beforeEach(async ({ page }) => { await login(page, 'director@alyamama.example'); });

  test('contacts directory opens a contact dialog', async ({ page }) => {
    await page.goto('/contacts/directory/customers');
    await page.waitForSelector('erp-directory-page tbody tr');
    await page.locator('erp-directory-page tbody tr').nth(1).click();
    await expect(page.locator('erp-contact-dialog')).toBeVisible();
  });

  test('contact master lists partners', async ({ page }) => {
    await page.goto('/contacts/master');
    await expect(page.locator('erp-master-list-page tbody tr').first()).toBeVisible();
  });

  test('reports and settings load for the director', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('erp-reports-page')).toBeVisible();
    await page.goto('/administration/settings');
    await expect(page.locator('erp-settings-page')).toBeVisible();
  });

  test('dashboard offers the owner/accountant toggle', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Accountant' }).click();
    await expect(page.locator('erp-dashboard-page h2').first()).toBeVisible();
  });
});
