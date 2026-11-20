import { expect, test, type Page } from '@playwright/test';
import { login } from './support';

/** Mock data lives in memory and a full page load restores the seed, so flows that need state stay inside one page load. */
const inApp = (page: Page, url: string) => page.evaluate(u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, url);
const dialog = (page: Page) => page.locator('.erp-panel');
/** A field's label starts with its text; the label also contains its <option> texts, so match the start only. */
const lbl = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

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
    await page.getByPlaceholder(/Search name, /).fill('gear pump');
    await expect(rows.first()).toContainText(/gear pump/i);
    expect(await rows.count()).toBeLessThan(total);
    await page.getByPlaceholder(/Search name, /).fill('');
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
    await expect(page.locator('erp-product-list-page tbody')).toContainText(/Legacy Gear Pump|discontinued/);
  });

  test('a product detail shows every General Information field', async ({ page }) => {
    await page.goto('/product/products/1');
    const d = page.locator('erp-product-detail-page');
    await expect(d.getByRole('heading', { level: 1 })).toContainText('Hydraulic Hose 1SN');
    for (const label of ['General Information', 'Internal Type', 'Sales Price', 'Margin(%)', 'No Discount', 'Product Type', 'Is Teltonika Product', 'Product Category', 'Customer Taxes',
      'Product Code', 'Cost', 'Internal Ref', 'Company', 'Barcode', 'Is Vehicle Subscription Product', 'Product Genre', 'Unit of Measure', 'Purchase Unit of Measure',
      'Quantity On Hand', 'Forecasted Quantity']) {
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
    await form.getByLabel('Product Name').fill('E2E Hydraulic Probe');
    await form.getByLabel('Product Code').fill('E2E-PROBE-1');
    await form.getByLabel('Product Category').selectOption({ label: 'All / Hoses & Pipes / Hydraulic Hoses' });
    await form.getByLabel('Product Type').selectOption({ label: 'Service' });
    await form.getByLabel('Product Type').selectOption({ label: 'Storable Product' });
    await form.getByLabel('Sales Price').fill('250');
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

  test('the units of measure list is a plain Odoo-style list with no action buttons', async ({ page }) => {
    await page.goto('/product/uom');
    const list = page.locator('erp-product-list-page');
    await list.locator('tbody tr').first().waitFor();
    await expect(list.getByRole('heading', { level: 1 })).toHaveText('Units of Measure');
    await expect(list.getByRole('columnheader')).toHaveText(['', 'Unit of Measure', 'Category', 'Type']);
    await expect(list.locator('thead input[type=checkbox]')).toHaveCount(1);
    await expect(list.locator('tbody tr').first().locator('input[type=checkbox]')).toHaveCount(1);
    await expect(list.locator('tbody')).toContainText('Bigger than the reference Unit of Measure');
    await expect(list.locator('tbody')).toContainText('Reference Unit of Measure for this category');
    // no create / import / edit buttons or links on the page
    await expect(page.getByRole('link', { name: /^New / })).toHaveCount(0);
    await expect(list.getByRole('button', { name: /Create|New|Import|Edit|Delete|Archive/ })).toHaveCount(0);
    // search, the Filters toggle and row selection still work
    await list.getByPlaceholder(/Search unit/).fill('dozen');
    await expect(list.locator('tbody tr')).toHaveCount(1);
    await list.locator('tbody tr input[type=checkbox]').check();
    await expect(list.locator('thead input[type=checkbox]')).toBeChecked();
    await list.getByPlaceholder(/Search unit/).fill('');
    await list.getByRole('button', { name: /Filters/ }).click();
    await list.getByLabel('Status').selectOption('archived');
    await expect(list.getByText('No archived units of measure')).toBeVisible();
    await list.getByLabel('Status').selectOption('active');
    // clicking a record opens its detail
    await list.locator('tbody tr', { hasText: 'Dozen(s)' }).click();
    await expect(page).toHaveURL(/\/product\/uom\/\d+$/);
  });

  test('a unit of measure detail is a read-only sheet: Display Name ... Ratio | Active, Rounding Precision', async ({ page }) => {
    await page.goto('/product/uom');
    await page.locator('erp-product-list-page tbody tr', { hasText: 'Dozen(s)' }).click();
    const d = page.locator('erp-product-detail-page');
    await expect(d.getByRole('heading', { level: 1 })).toHaveText('Dozen(s)');
    await expect(d.locator('dt')).toHaveText(['Display Name', 'Unit of Measure', 'Category', 'Type', 'Ratio', 'Active', 'Rounding Precision']);
    const row = (label: string) => d.locator('dt', { hasText: label }).locator('xpath=..');
    await expect(row('Unit of Measure')).toContainText('Dozen(s)');
    await expect(row('Display Name')).toContainText('Dz');
    await expect(row('Category').getByRole('link', { name: 'Unit' })).toBeVisible();
    await expect(row('Type')).toContainText('Bigger than the reference Unit of Measure');
    await expect(row('Ratio')).toContainText('12.00000');
    await expect(row('Ratio')).toContainText('e.g: 1 * (this unit) = ratio * (reference unit)');
    await expect(row('Active').locator('input[type=checkbox]')).toBeDisabled();
    await expect(row('Active').locator('input[type=checkbox]')).toBeChecked();
    await expect(row('Rounding Precision')).toContainText('1.00000');
    // left column left of the right column, same row
    const left = await d.locator('dt', { hasText: 'Display Name' }).boundingBox(), right = await d.locator('dt', { hasText: 'Active' }).boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x + 200); expect(Math.abs(right!.y - left!.y)).toBeLessThan(4);
    // only Edit (a link to the form); no Archive / Delete / Create buttons, no stat cards, no related lists
    await expect(d.getByRole('button')).toHaveCount(0);
    await expect(d.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(d.getByRole('link', { name: /New|Create/ })).toHaveCount(0);
    await expect(d).not.toContainText('Used by products');
    // Edit opens the form on this record
    await d.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/product\/uom\/\d+\/edit$/);
    await expect(page.locator('erp-product-form-page').getByLabel(/^Unit of Measure/).first()).toHaveValue('Dozen(s)');
    // a reference unit has no ratio row
    await page.goto('/product/uom');
    await page.locator('erp-product-list-page tbody tr', { hasText: 'Unit(s)' }).click();
    await expect(page.locator('erp-product-detail-page dt', { hasText: /^Ratio$/ })).toHaveCount(0);
  });

  test('the UoM category and product category lists and details follow the reference', async ({ page }) => {
    await page.goto('/product/uom-categories');
    const list = page.locator('erp-product-list-page');
    await list.locator('tbody tr').first().waitFor();
    await expect(list.getByRole('columnheader')).toHaveText(['', 'Unit of Measure Category']);
    await list.locator('tbody tr', { hasText: 'Weight' }).first().click();
    const d = page.locator('erp-product-detail-page');
    await expect(d.locator('dt')).toHaveText(['Unit of Measure Category', 'Type of Measure']);
    await expect(d).toContainText('Weight');
    await expect(d).not.toContainText('Group Products in POS');
    await expect(d.getByRole('button')).toHaveCount(0);
    await expect(d.getByRole('link', { name: 'Edit' })).toBeVisible();

    await page.goto('/product/categories');
    await list.locator('tbody tr').first().waitFor();
    await expect(list.getByRole('columnheader')).toHaveText(['', 'Product Category']);
    await expect(list.locator('tbody')).toContainText('All / Hoses & Pipes / Hydraulic Hoses');
    await list.locator('tbody tr', { hasText: 'Pumps & Motors' }).first().click();
    const c = page.locator('erp-product-detail-page');
    // the name (and the Arabic name next to it) is the title; the sheet starts with Parent Category and Sequence for Lot, without a heading
    await expect(c.getByRole('heading', { level: 1 })).toHaveText('Pumps & Motors');
    await expect(c.locator('h1 + span')).toHaveText('مضخات ومحركات');
    await expect(c.locator('h3')).toHaveText(['Logistics', 'Inventory Valuation', 'Account Properties', 'Account Stock Properties']);
    await expect(c.locator('dt')).toHaveText(['Parent Category', 'Sequence for Lot', 'Force Removal Strategy', 'Costing Method', 'Inventory Valuation',
      'Price Difference Account', 'Income Account', 'Expense Account', 'Stock Input Account', 'Stock Output Account', 'Stock Valuation Account', 'Stock Journal']);
    await expect(c).not.toContainText('Category name');
    await expect(c).toContainText('Average Cost (AVCO)');
    await expect(c).toContainText('Automated');
    // Logistics above Inventory Valuation; the account groups side by side
    const h = async (t: string) => (await c.getByRole('heading', { name: t, exact: true }).boundingBox())!;
    const [lg, iv, ap, as] = [await h('Logistics'), await h('Inventory Valuation'), await h('Account Properties'), await h('Account Stock Properties')];
    expect(iv.y).toBeGreaterThan(lg.y + 20); expect(Math.abs(iv.x - lg.x)).toBeLessThan(4);
    expect(as.x).toBeGreaterThan(ap.x + 50); expect(Math.abs(as.y - ap.y)).toBeLessThan(4);
    // no buttons at all (no Products stat button, no Create / Delete / Archive); Edit is a link to this record's form
    await expect(c.getByRole('button')).toHaveCount(0);
    await expect(c.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', /\/product\/categories\/\d+\/edit$/);
  });

  test('the unit of measure form has exactly the approved fields, in two columns, with Save and Discard', async ({ page }) => {
    await page.goto('/product/uom/new');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    for (const label of [/^Display Name/, /^Unit of Measure/, /^Category/, /^Type/, /^Active/, /^Rounding Precision/]) await expect(form.getByLabel(label).first()).toBeVisible();
    for (const gone of ['Ratio', 'Bigger Ratio', 'Type of Measure']) await expect(form.getByLabel(gone)).toHaveCount(0);
    await expect(form.getByRole('button', { name: 'Discard' }).first()).toBeVisible();
    await expect(form.getByRole('button', { name: 'Create' })).toHaveCount(0);
    // left column (Display Name ... Type) sits left of the right column (Active, Rounding Precision), on the same row
    const left = await form.getByLabel(/^Display Name/).boundingBox(), right = await form.getByLabel(/^Rounding Precision/).boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x + left!.width - 1);
    const type = form.getByLabel(/^Type/);
    await expect(type.locator('option')).toHaveText(['Bigger than the reference Unit of Measure', 'Reference Unit of Measure for this category', 'Smaller than the reference Unit of Measure']);
    // required fields are enforced; the first UoM category (Unit) already has a reference unit
    await form.getByLabel(/^Rounding Precision/).fill('');
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(form.getByText('Please fix the highlighted fields.').first()).toBeVisible();
    await form.getByLabel(/^Unit of Measure/).first().fill('Dummy');
    await form.getByLabel(/^Rounding Precision/).fill('0.5');
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(form.getByText(/already has the reference unit/)).toBeVisible();
    await type.selectOption({ label: 'Smaller than the reference Unit of Measure' });
    await form.getByLabel(/^Display Name/).fill('Dmy');
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/product\/uom\/\d+$/);
    await expect(page.locator('erp-product-detail-page').getByRole('heading', { level: 1 })).toHaveText('Dummy');
  });

  test('the product category form follows the Odoo layout and rules', async ({ page }) => {
    await page.goto('/product/categories/new');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    for (const title of ['Basic Information', 'Logistics', 'Inventory Valuation', 'Account Properties', 'Account Stock Properties']) await expect(form.getByRole('heading', { name: title, exact: true })).toBeVisible();
    for (const label of ['Category name', 'Arabic Name', 'Parent Category', 'Sequence for Lot', 'Force Removal Strategy', 'Costing Method', 'Inventory Valuation', 'Price Difference Account', 'Income Account',
      'Expense Account', 'Stock Input Account', 'Stock Output Account', 'Stock Valuation Account', 'Stock Journal']) await expect(form.getByLabel(lbl(label)).first()).toBeVisible();
    for (const gone of ['Short Code', 'Routes', 'Total routes', 'Complete Name', 'Active']) await expect(form.getByLabel(lbl(gone))).toHaveCount(0);
    await expect(form.locator('erp-product-smart-button')).toHaveCount(0);
    // Odoo selection strings and defaults
    await expect(form.getByLabel(lbl('Costing Method')).locator('option')).toHaveText(['Standard Price', 'First In First Out (FIFO)', 'Average Cost (AVCO)']);
    await expect(form.getByLabel(lbl('Inventory Valuation')).locator('option')).toHaveText(['Manual', 'Automated']);
    await expect(form.getByLabel(lbl('Costing Method')).locator('option:checked')).toHaveText('Standard Price');
    // the two account groups are side by side; Logistics and Inventory Valuation too
    const box = async (name: string) => (await form.getByRole('heading', { name, exact: true }).boundingBox())!;
    const [ap, as, lg, iv] = [await box('Account Properties'), await box('Account Stock Properties'), await box('Logistics'), await box('Inventory Valuation')];
    expect(as.x).toBeGreaterThan(ap.x + 50); expect(Math.abs(as.y - ap.y)).toBeLessThan(4);
    expect(iv.x).toBeGreaterThan(lg.x + 50); expect(Math.abs(iv.y - lg.y)).toBeLessThan(4);
    // name is required; automated valuation requires the four stock fields
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(form.getByText('Please fix the highlighted fields.').first()).toBeVisible();
    await form.getByLabel(lbl('Category name')).fill('E2E Category');
    await form.getByLabel(lbl('Inventory Valuation')).selectOption({ label: 'Automated' });
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(form.getByText('Please fix the highlighted fields.').first()).toBeVisible();
    await expect(page).toHaveURL(/\/product\/categories\/new$/);
    await form.getByLabel(lbl('Stock Valuation Account')).selectOption({ index: 1 });
    await form.getByLabel(lbl('Stock Input Account')).selectOption({ index: 1 });
    await form.getByLabel(lbl('Stock Output Account')).selectOption({ index: 1 });
    await form.getByLabel(lbl('Stock Journal')).selectOption({ label: 'Inventory Valuation' });
    await form.getByLabel(lbl('Costing Method')).selectOption({ label: 'Average Cost (AVCO)' });
    await form.getByLabel(lbl('Arabic Name')).fill('فئة');
    await form.getByLabel(lbl('Force Removal Strategy')).selectOption({ label: 'First In First Out (FIFO)' });
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/product\/categories\/\d+$/);
    const d = page.locator('erp-product-detail-page');
    await expect(d.getByRole('heading', { level: 1 })).toHaveText('E2E Category');
    await expect(d).toContainText('Average Cost (AVCO)');
    await expect(d).toContainText('Automated');
  });

  test('the UoM category form: one category per measure type, POS flag only in debug mode', async ({ page }) => {
    await page.goto('/product/uom-categories/new');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    for (const label of [/^Unit of Measure Category/, /^Type of Measure/]) await expect(form.getByLabel(label).first()).toBeVisible();
    await expect(form.getByLabel('Group Products in POS')).toHaveCount(0);
    await expect(form.getByLabel(/^Active/)).toHaveCount(0);
    await expect(form.getByLabel(/^Type of Measure/).locator('option')).toHaveText(['', 'Units', 'Weight', 'Time', 'Length', 'Volume']);
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(form.getByText('Please fix the highlighted fields.').first()).toBeVisible();
    await form.getByLabel(/^Unit of Measure Category/).fill('Mass');
    await form.getByLabel(/^Type of Measure/).selectOption({ label: 'Weight' });
    await form.getByRole('button', { name: 'Save' }).first().click();
    await expect(form.getByText('You can have only one category per measurement type.')).toBeVisible();
    await expect(page).toHaveURL(/\/product\/uom-categories\/new$/);
    // the Time category's delete protection is covered by the unit and mock-API specs: the pages have no Delete button for now
  });

  test('debug mode (?debug=1) reveals Group Products in POS', async ({ page }) => {
    await page.goto('/product/uom-categories/new?debug=1');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    await expect(form.getByLabel('Group Products in POS')).toBeVisible();
    // it survives in-app navigation (the session remembers debug mode) and ?debug=0 turns it off again
    await page.goto('/product/uom-categories/new?debug=0');
    await form.locator('erp-metadata-form').waitFor();
    await expect(form.getByLabel('Group Products in POS')).toHaveCount(0);
  });

  test('a new product shows up in the Accounting product picker, and stock comes from qty_available', async ({ page }) => {
    const sku = `E2E-${Date.now()}`;
    await page.goto('/product/products/new');
    const form = page.locator('erp-product-form-page');
    await form.locator('erp-metadata-form').waitFor();
    await form.getByLabel('Product Name').fill('E2E Picker Probe');
    await form.getByLabel('Product Code').fill(sku);
    await form.getByLabel('Product Category').selectOption({ label: 'All / Hoses & Pipes / Hydraulic Hoses' });
    await form.getByLabel('Sales Price').fill('10');
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
