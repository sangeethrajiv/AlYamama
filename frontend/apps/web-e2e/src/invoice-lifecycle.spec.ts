import { expect, test } from '@playwright/test';
import { login } from './support';

test('invoice lifecycle: draft, validate, partial payment, then a credit note', async ({ page }) => {
  await login(page);
  await page.goto('/accounting/invoices/new?category=credit');
  await page.waitForSelector('erp-invoice-form-page erp-metadata-form');
  await page.locator('erp-invoice-form-page input[list="dl-partner"]').fill('E2E Test Customer');
  const line = page.locator('erp-invoice-lines-editor tbody tr').first();
  await line.locator('input').nth(1).fill('Cylinder repair');
  const price = line.locator('input[inputmode=decimal]').nth(1);
  await price.fill('1000');
  await price.blur();

  // Totals are exact: 1000.00 + 15% VAT
  await expect(page.locator('erp-invoice-form-page .max-w-xs').first()).toContainText('1,150.00');

  await page.getByRole('button', { name: /^Validate$/ }).last().click();
  await expect(page).toHaveURL(/\/accounting\/invoices\/inv_/);
  await expect(page.locator('erp-invoice-next-steps')).toBeVisible();

  await page.getByRole('button', { name: /Register payment/ }).click();
  await page.locator('erp-payment-dialog input[formcontrolname=amount]').fill('500');
  await page.getByRole('button', { name: /Confirm payment/ }).click();
  await expect(page.locator('erp-invoice-next-steps')).toContainText('650.00');

  await page.getByRole('button', { name: /Add credit note/ }).click();
  await page.locator('erp-credit-note-dialog input').first().fill('Returned goods');
  await page.getByRole('button', { name: /Create credit note/ }).click();
  await expect(page.locator('erp-credit-note-dialog')).toHaveCount(0);
});

test('ZATCA submission needs an explicit acknowledgement', async ({ page }) => {
  await login(page);
  await page.goto('/accounting/invoices/new?category=credit');
  await page.waitForSelector('erp-invoice-form-page erp-metadata-form');
  await page.locator('erp-invoice-form-page input[list="dl-partner"]').fill('E2E ZATCA Customer');
  const line = page.locator('erp-invoice-lines-editor tbody tr').first();
  await line.locator('input').nth(1).fill('Seal kit');
  const price = line.locator('input[inputmode=decimal]').nth(1);
  await price.fill('200');
  await price.blur();
  await page.getByRole('button', { name: /^Validate$/ }).last().click();
  await page.getByRole('button', { name: /Submit to ZATCA/ }).click();
  await expect(page.locator('erp-zatca-dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: /Submit invoice/ })).toBeDisabled();
});
