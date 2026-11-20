import { expect, test, type Page } from '@playwright/test';
import { login } from './support';

/** Mock data lives in memory and a full page load restores the seed, so flows that need state stay inside one page load. */
const inApp = (page: Page, url: string) => page.evaluate(u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, url);
const dialog = (page: Page) => page.locator('.erp-panel');

test.describe('product master data', () => {
  test.beforeEach(async ({ page }) => { await login(page, 'director@alyamama.example'); });

  test('sidebar offers Overview and the four Product screens only', async ({ page }) => {
    await page.goto('/product');
    await expect(page).toHaveURL(/\/product\/overview$/);
    const nav = page.locator('nav');
    for (const label of ['Overview', 'Products', 'Product Categories', 'Units of Measure', 'UoM Categories']) {
      await expect(nav.getByText(label, { exact: true }).first()).toBeVisible();
    }
    for (const gone of ['Warehouses', 'Locations', 'Operation Types', 'Transfers', 'Receipts', 'Delivery Orders', 'Inventory Adjustments', 'Stock Moves']) {
      await expect(nav.getByText(gone, { exact: true })).toHaveCount(0);
    }
  });

  test('the overview shows KPIs, breakdowns, attention checks and the stock snapshot', async ({ page }) => {
    await page.goto('/product/overview');
    const ov = page.locator('erp-product-overview-page');
    await expect(ov.getByRole('heading', { name: 'Product Overview' })).toBeVisible();
    await expect(ov).toContainText('Active products');
    await expect(ov).toContainText('Products by type');
    await expect(ov).toContainText('Tracking of storable products');
    await expect(ov).toContainText('Largest categories');
    await expect(ov).toContainText('Needs attention');
    await expect(ov).toContainText('Stock snapshot');
    await ov.getByRole('link', { name: /Units of measure/ }).first().click();
    await expect(page).toHaveURL(/\/product\/uom$/);
  });

  test('every Product screen opens and lists records', async ({ page }) => {
    for (const [path, rows] of [['/product/products', 10], ['/product/categories', 10], ['/product/uom-categories', 5], ['/product/uom', 10]] as const) {
      await page.goto(path);
      await expect(page.locator('erp-product-list-page tbody tr').first()).toBeVisible();
      expect(await page.locator('erp-product-list-page tbody tr').count()).toBeGreaterThanOrEqual(Math.min(rows, 5));
    }
  });

  test('removed Inventory routes fall through to not-found', async ({ page }) => {
    for (const path of ['/inventory/overview', '/product/warehouses', '/product/transfers', '/product/stock']) {
      await page.goto(path);
      await expect(page.locator('erp-product-list-page, erp-product-form-page, erp-product-detail-page')).toHaveCount(0);
    }
  });

  test('products list: search, filters, sorting and the archived tab', async ({ page }) => {
    await page.goto('/product/products');
    const rows = page.locator('erp-product-list-page tbody tr');
    await rows.first().waitFor();
    const total = await rows.count();
    await page.getByPlaceholder(/Search name, Arabic name/).fill('gear pump');
    await expect(rows.first()).toContainText(/gear pump/i);
    expect(await rows.count()).toBeLessThan(total);
    await page.getByPlaceholder(/Search name, Arabic name/).fill('');
    // eight filters: the panel starts collapsed (as in the React module) and opens with the Filters button
    await expect(page.getByLabel('Type', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Filters/ }).click();
    await page.getByLabel('Type', { exact: true }).selectOption('service');
    await expect(rows.first()).toContainText('Service');
    await expect(page.getByText(/result\(s\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Clear search & filters' }).click();
    const header = page.getByRole('columnheader', { name: /Sales Price/ });
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await page.getByRole('tab', { name: /Archived/ }).click();
    await expect(rows.first()).toContainText('Archived');
    await expect(page.locator('erp-product-list-page tbody')).toContainText(/Legacy Gear Pump|discontinued/);
  });

  test('a product detail shows stats, every section and the related Odoo fields', async ({ page }) => {
    await page.goto('/product/products/1');
    const d = page.locator('erp-product-detail-page');
    await expect(d.getByRole('heading', { level: 1 })).toContainText('Hydraulic Hose 1SN');
    await expect(d).toContainText('product.template');
    for (const label of ['Sales Price (SAR)', 'Cost (SAR)', 'On Hand', 'Forecasted', 'General Information', 'Units & Tracking', 'Sales & Purchase',
      'Internal Reference', 'Barcode', 'Arabic Name', 'Internal Short Code', 'Internal Type', 'Company', 'Responsible', 'Tracking', 'Quantity On Hand', 'Forecasted Quantity', 'No Discount', 'Margin (%)']) {
      await expect(d.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await d.getByRole('link', { name: 'Hose' }).first().waitFor();
  });

  test('create, edit, archive, restore and delete a product', async ({ page }) => {
    await page.goto('/product/products');
    await page.getByRole('link', { name: 'New Product' }).click();
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    // required fields are enforced
    await form.getByRole('button', { name: 'Create' }).first().click();
    await expect(form.getByText('Please fix the highlighted fields.').first()).toBeVisible();
    await expect(page).toHaveURL(/\/product\/products\/new$/);
    // non-storable products cannot be tracked: the field is locked when the type changes
    await form.getByLabel('Product Name').fill('E2E Hydraulic Probe');
    await form.getByLabel('Internal Reference').fill('E2E-PROBE-1');
    await form.getByLabel('Product Category').selectOption({ label: 'All / Hoses & Pipes / Hydraulic Hoses' });
    await form.getByLabel('Tracking').selectOption({ label: 'By Lots' });
    await form.getByLabel('Product Type').selectOption({ label: 'Service' });
    await expect(form.getByLabel('Tracking')).toBeDisabled();
    await form.getByLabel('Product Type').selectOption({ label: 'Storable Product' });
    await form.getByLabel('Sales Price (SAR)').fill('250');
    await form.getByRole('button', { name: 'Create' }).first().click();
    await expect(page).toHaveURL(/\/product\/products\/\d+$/);
    const d = page.locator('erp-product-detail-page');
    await expect(d.getByRole('heading', { level: 1 })).toHaveText('E2E Hydraulic Probe');
    await expect(d).toContainText('250.00');

    // edit
    await d.getByRole('link', { name: 'Edit' }).click();
    await form.getByLabel('Product Name').fill('E2E Hydraulic Probe v2');
    await form.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(d.getByRole('heading', { level: 1 })).toHaveText('E2E Hydraulic Probe v2');

    // archive -> restore -> delete (a new product has no stock, so nothing blocks it)
    await d.getByRole('button', { name: 'Archive' }).click();
    await dialog(page).getByRole('button', { name: 'Archive' }).click();
    await expect(d.getByRole('status')).toContainText('archived');
    await d.getByRole('button', { name: 'Restore' }).click();
    await expect(d.getByRole('status')).toHaveCount(0);
    await d.getByRole('button', { name: 'Delete' }).click();
    await dialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/product\/products$/);
    await expect(page.locator('erp-product-list-page tbody')).not.toContainText('E2E-PROBE-1');
  });

  test('a category that is still used cannot be archived or deleted', async ({ page }) => {
    await page.goto('/product/categories');
    await page.getByRole('link', { name: 'Hoses & Pipes / Hydraulic Hoses' }).first().click();
    const d = page.locator('erp-product-detail-page');
    await expect(d).toContainText('product.category');
    await expect(d).toContainText('Products (direct)');
    await d.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog(page)).toContainText('Cannot delete category');
    await dialog(page).getByRole('button', { name: 'OK' }).click();
    await d.getByRole('button', { name: 'Archive' }).click();
    await expect(dialog(page)).toContainText('Cannot archive category');
  });

  test('a unit of measure shows the ratio field that matches its type', async ({ page }) => {
    await page.goto('/product/uom/new');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    const type = form.getByLabel(/^Type/);
    await expect(form.getByLabel('Bigger Ratio')).toHaveCount(0);
    await type.selectOption({ label: 'Smaller than the reference Unit of Measure' });
    await expect(form.getByLabel('Ratio', { exact: true })).toBeVisible();
    await type.selectOption({ label: 'Bigger than the reference Unit of Measure' });
    await expect(form.getByLabel('Bigger Ratio')).toBeVisible();
    await expect(form.getByLabel('Ratio', { exact: true })).toHaveCount(0);
    await type.selectOption({ label: 'Reference Unit of Measure for this category' });
    await form.getByLabel(/^Unit of Measure/).first().fill('Dummy');
    // the first UoM category (Unit) already has a reference unit
    await form.getByRole('button', { name: 'Create' }).first().click();
    await expect(form.getByText(/already has the reference unit/)).toBeVisible();
  });

  test('a new product shows up in the Accounting product picker, and stock comes from qty_available', async ({ page }) => {
    const sku = `E2E-${Date.now()}`;
    await page.goto('/product/products/new');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    await form.getByLabel('Product Name').fill('E2E Picker Probe');
    await form.getByLabel('Internal Reference').fill(sku);
    await form.getByLabel('Product Category').selectOption({ label: 'All / Hoses & Pipes / Hydraulic Hoses' });
    await form.getByLabel('Sales Price (SAR)').fill('10');
    await form.getByRole('button', { name: 'Create' }).first().click();
    await expect(page).toHaveURL(/\/product\/products\/\d+$/);

    // move there with the in-app router so the in-memory data survives
    await inApp(page, '/accounting/invoices/new?category=credit');
    await page.locator('erp-invoice-lines-editor').waitFor();
    await expect(page.locator(`datalist#erp-catalog option[value="${sku}"]`)).toHaveCount(1);
    const line = page.locator('erp-invoice-lines-editor tbody tr').first();
    await line.locator('input[list="erp-catalog"]').fill('HH1-014');
    await line.locator('input[list="erp-catalog"]').blur();
    await expect(line).toContainText('37.000');
  });
});
