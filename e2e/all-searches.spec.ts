import { test, expect } from '@playwright/test';

test.describe('Exhaustive E2E Tests for All Search Pages', () => {

  // -------------------------------------------------------------
  // ADMIN SEARCHES
  // -------------------------------------------------------------
  test.describe('Admin Role Searches', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
      await page.getByPlaceholder('Enter your password').fill('12345678');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });
    });

    test('1. Admin Leads (/admin/leads): Search by Staff ID, Customer ID, digits, and name', async ({ page }) => {
      await page.goto('/admin/leads');
      await expect(page).toHaveURL(/.*admin\/leads/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, phone, Lead ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // A. Search by Staff ID STAFF-12 -> matches Tamil Murugan leads
      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.url().includes('STAFF-12') && res.status() === 200);
      await searchInput.fill('STAFF-12');
      await respPromise;
      await expect(page.locator('text=STAFF-12').first()).toBeVisible({ timeout: 10000 });

      // B. Search by Customer ID C-1216 -> matches AJEE NASEEF (L-1216)
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.url().includes('C-1216') && res.status() === 200);
      await searchInput.fill('C-1216');
      await respPromise;
      await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=L-1216').first()).toBeVisible({ timeout: 10000 });

      // C. Search by pure digits 1216
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.url().includes('1216') && res.status() === 200);
      await searchInput.fill('1216');
      await respPromise;
      await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });

      // D. Clear search -> restores all leads list
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
      await expect(page.locator('button:has-text("All Leads")')).toBeVisible();
    });

    test('2. Admin Staff (/admin/staff): Backend-driven search by Staff ID, digits, and name', async ({ page }) => {
      await page.goto('/admin/staff');
      await expect(page).toHaveURL(/.*admin\/staff/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, Staff ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // A. Search by STAFF-28 -> matches Ramesh
      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/users') && res.url().includes('STAFF-28') && res.status() === 200);
      await searchInput.fill('STAFF-28');
      await respPromise;
      await expect(page.locator('text=Ramesh').first()).toBeVisible({ timeout: 10000 });

      // B. Search by pure digits 28 -> matches STAFF-28
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/users') && res.url().includes('28') && res.status() === 200);
      await searchInput.fill('28');
      await respPromise;
      await expect(page.locator('text=Ramesh').first()).toBeVisible({ timeout: 10000 });

      // C. Search by staff name Ramesh
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/users') && res.url().includes('Ramesh') && res.status() === 200);
      await searchInput.fill('Ramesh');
      await respPromise;
      await expect(page.locator('text=Ramesh').first()).toBeVisible({ timeout: 10000 });

      // D. Clear search
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/users') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
      await expect(page.locator('button:has-text("Add Staff")')).toBeVisible();
    });

    test('3. Admin Customers / Loans (/admin/customers): Search by Customer ID, digits, and name', async ({ page }) => {
      await page.goto('/admin/customers');
      await expect(page).toHaveURL(/.*admin\/customers/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, phone, Customer ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // A. Search by C-1216 -> AJEE NASEEF
      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.url().includes('C-1216') && res.status() === 200);
      await searchInput.fill('C-1216');
      await respPromise;
      await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });

      // B. Search by 1216
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.url().includes('1216') && res.status() === 200);
      await searchInput.fill('1216');
      await respPromise;
      await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });

      // C. Search by customer name
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.url().includes('AJEE') && res.status() === 200);
      await searchInput.fill('AJEE');
      await respPromise;
      await expect(page.locator('text=AJEE NASEEF').first()).toBeVisible({ timeout: 10000 });

      // D. Clear search
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('4. Admin Registrations (/admin/registrations): Search by Customer ID, Staff ID, and name', async ({ page }) => {
      await page.goto('/admin/registrations');
      await expect(page).toHaveURL(/.*admin\/registrations/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by customer name, Customer ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // A. Search by Staff ID STAFF-12 -> Tamil Murugan registered/upcoming plots
      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/plots') && res.status() === 200);
      await searchInput.fill('STAFF-12');
      await respPromise;
      const rowCount = await page.locator('table tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(1);

      // B. Clear search
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/plots') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('5. Admin Follow-ups (/admin/follow-ups): Search follow-ups by customer name or phone', async ({ page }) => {
      await page.goto('/admin/follow-ups');
      await expect(page).toHaveURL(/.*admin\/follow-ups/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by ID, name, phone, or staff/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      await expect(page.locator('text=Total Follow Ups')).toBeVisible();

      // Search by phone or name
      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads/follow-ups') && res.status() === 200);
      await searchInput.fill('98');
      await respPromise;

      // Clear search
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads/follow-ups') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('6. Admin Activity Logs (/admin/activity-logs): Search logs by name or action', async ({ page }) => {
      await page.goto('/admin/activity-logs');
      await expect(page).toHaveURL(/.*admin\/activity-logs/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, role, or action/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/activity-logs') && res.status() === 200);
      await searchInput.fill('Admin');
      await respPromise;

      // Clear
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/activity-logs') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('7. Admin Projects (/admin/projects): Search projects by name', async ({ page }) => {
      await page.goto('/admin/projects');
      await expect(page).toHaveURL(/.*admin\/projects/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/projects') && res.status() === 200);
      await searchInput.fill('a');
      await respPromise;

      // Clear
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/projects') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });
  });

  // -------------------------------------------------------------
  // STAFF SEARCHES
  // -------------------------------------------------------------
  test.describe('Staff Role Searches', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.getByPlaceholder('you@example.com').fill('tamilmurugan2014@gmail.com');
      await page.getByPlaceholder('Enter your password').fill('12345678');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/.*staff\/dashboard/, { timeout: 15000 });
    });

    test('8. Staff My Leads (/staff/my-leads): Search switches to All tab and matches customer', async ({ page }) => {
      await page.goto('/staff/my-leads');
      await expect(page).toHaveURL(/.*staff\/my-leads/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, phone, or Lead ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // Typing a query switches to All tab
      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.status() === 200);
      await searchInput.fill('12');
      await respPromise;
      await expect(page).toHaveURL(/.*tab=All/);

      // Clear search
      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('9. Staff Follow-ups (/staff/follow-ups): Search follow-ups by ID or phone', async ({ page }) => {
      await page.goto('/staff/follow-ups');
      await expect(page).toHaveURL(/.*staff\/follow-ups/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by ID, name, or phone number/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads/follow-ups') && res.status() === 200);
      await searchInput.fill('9');
      await respPromise;

      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads/follow-ups') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('10. Staff Leads Pool (/staff/leads-pool): Search leads in the common pool', async ({ page }) => {
      await page.goto('/staff/leads-pool');
      await expect(page).toHaveURL(/.*staff\/leads-pool/);
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search by name, phone, or Lead ID/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.status() === 200);
      await searchInput.fill('a');
      await respPromise;

      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/leads') && res.status() === 200);
      await searchInput.fill('');
      await respPromise;
    });

    test('11. Staff Reports (/staff/reports): Lead search on My Leads Report tab', async ({ page }) => {
      await page.goto('/staff/reports');
      await expect(page).toHaveURL(/.*staff\/reports/);
      await page.waitForLoadState('networkidle');

      const leadsTabBtn = page.getByRole('button', { name: 'My Leads Report' });
      await leadsTabBtn.click();
      await page.waitForTimeout(1000);

      const searchInput = page.getByPlaceholder(/Search by customer name, phone/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      let respPromise = page.waitForResponse(res => res.url().includes('/api/v1/reports') || res.url().includes('/api/v1/leads'));
      await searchInput.fill('9');
      await respPromise;

      respPromise = page.waitForResponse(res => res.url().includes('/api/v1/reports') || res.url().includes('/api/v1/leads'));
      await searchInput.fill('');
      await respPromise;
    });
  });
});
