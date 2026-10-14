import { test, expect } from '@playwright/test';

test.describe('Search by Staff ID & Customer ID Across Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Admin Leads Page: Search by STAFF-12, C-1216, 1216', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });

    await page.goto('/admin/leads');
    await expect(page).toHaveURL(/.*admin\/leads/);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/Search by name, phone, Lead ID/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 1. Search by STAFF-12
    await searchInput.fill('STAFF-12');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=STAFF-12').first()).toBeVisible({ timeout: 10000 });

    // 2. Search by Customer ID C-1216
    await searchInput.fill('C-1216');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });

    // 3. Search by pure digits 1216
    await searchInput.fill('1216');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });
  });

  test('Admin Staff Page: Backend-driven search by STAFF-28, 28, Ramesh', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });

    await page.goto('/admin/staff');
    await expect(page).toHaveURL(/.*admin\/staff/);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/Search by name, Staff ID/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 1. Search by STAFF-28
    await searchInput.fill('STAFF-28');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Ramesh').first()).toBeVisible({ timeout: 10000 });

    // 2. Search by 28
    await searchInput.fill('28');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Ramesh').first()).toBeVisible({ timeout: 10000 });

    // 3. Search by Ramesh
    await searchInput.fill('Ramesh');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Ramesh').first()).toBeVisible({ timeout: 10000 });
  });

  test('Admin Customers Page: Search by Customer ID C-1216, 1216', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });

    await page.goto('/admin/customers');
    await expect(page).toHaveURL(/.*admin\/customers/);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/Search by name, phone, Customer ID/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill('C-1216');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });

    await searchInput.fill('1216');
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });
  });

  test('Staff My Leads: Search triggers All tab switch and matches', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('tamilmurugan2014@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*staff\/dashboard/, { timeout: 15000 });

    await page.goto('/staff/my-leads');
    await expect(page).toHaveURL(/.*staff\/my-leads/);
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/Search by name, phone, or Lead ID/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type search query
    await searchInput.fill('12');
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/.*tab=All/);
  });
});
