import { expect, test } from '@playwright/test';
import { login } from './support';

test.describe('accounting', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('chart of accounts lists accounts and filters by type', async ({ page }) => {
    await page.goto('/accounting/chart-of-accounts');
    await page.waitForSelector('erp-chart-of-accounts-page tbody tr');
    const all = await page.locator('erp-chart-of-accounts-page tbody tr').count();
    await page.getByRole('button', { name: /Assets/ }).click();
    await expect(page.locator('erp-chart-of-accounts-page tbody tr')).not.toHaveCount(all);
    expect(await page.locator('erp-chart-of-accounts-page tbody tr').count()).toBeLessThan(all);
  });

  test('a balanced journal entry can be posted and then reversed', async ({ page }) => {
    await page.goto('/accounting/journal-entries');
    await page.waitForSelector('erp-journal-entries-page tbody tr');
    const before = await page.locator('erp-journal-entries-page tbody tr').count();
    await page.getByRole('button', { name: /Create Journal Entry/ }).click();
    const dialog = page.locator('erp-journal-entry-dialog');
    await dialog.locator('input[formcontrolname=debit]').nth(0).fill('150');
    await dialog.locator('input[formcontrolname=credit]').nth(1).fill('150');
    await page.getByRole('button', { name: /^Post$/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('erp-journal-entries-page tbody tr')).toHaveCount(before + 1);

    await page.locator('erp-journal-entries-page tbody tr').first().click();
    await page.getByRole('button', { name: /Reverse entry/ }).click();
    await page.locator('erp-confirm-dialog button.erp-btn-danger').click();
    await expect(page.locator('erp-journal-entries-page tbody tr')).toHaveCount(before + 2);
  });

  test('an unbalanced entry cannot be posted', async ({ page }) => {
    await page.goto('/accounting/journal-entries');
    await page.getByRole('button', { name: /Create Journal Entry/ }).click();
    const dialog = page.locator('erp-journal-entry-dialog');
    await dialog.locator('input[formcontrolname=debit]').nth(0).fill('150');
    await page.getByRole('button', { name: /^Post$/ }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('payments, reconciliation and banking pages render data', async ({ page }) => {
    for (const [path, host] of [['payments', 'erp-payments-page'], ['reconciliation', 'erp-reconciliation-page'], ['banking', 'erp-banking-page']]) {
      await page.goto(`/accounting/${path}`);
      await expect(page.locator(host)).toBeVisible();
    }
  });
});
