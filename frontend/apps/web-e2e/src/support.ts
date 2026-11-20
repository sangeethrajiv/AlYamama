import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'Yamama@2026';

/** Signs in through the real login form (the mock identity API accepts the demo accounts). */
export async function login(page: Page, email = 'sangeeth@alyamama.example'): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type=email]', email);
  await page.fill('input[formcontrolname=password]', DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/dashboard/);
}
