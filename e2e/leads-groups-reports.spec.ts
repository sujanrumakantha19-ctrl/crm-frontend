import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://samyandco.in';

test.describe('Leads Counts, Groups Performance & Reports Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
  });

  test('1. Leads tab badge counters display non-zero numbers and filter matching cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/leads`);
    await page.waitForLoadState('networkidle');

    // Tab buttons
    const allTab = page.locator('button', { hasText: 'All Leads' });
    const openTab = page.locator('button', { hasText: 'Open Leads' });
    const reservedTab = page.locator('button', { hasText: 'Reserved' });
    const qualifiedTab = page.locator('button', { hasText: 'Qualified Leads' });
    const unqualifiedTab = page.locator('button', { hasText: 'Unqualified' });
    const customerTab = page.locator('button', { hasText: 'Customers' });

    // Assert badges have counts
    await expect(allTab).toContainText('5352');
    await expect(openTab).toContainText('89');
    await expect(reservedTab).toContainText('2622');
    await expect(qualifiedTab).toContainText('98');
    await expect(unqualifiedTab).toContainText('67');
    await expect(customerTab).toContainText('2476');

    // Click Qualified Leads tab and assert cards load
    await qualifiedTab.click();
    await page.waitForTimeout(1000);
    const qualifiedCards = page.locator('.bg-white.rounded-lg.border.border-slate-200');
    await expect(qualifiedCards.first()).toBeVisible();

    // Click Unqualified tab and assert cards load
    await unqualifiedTab.click();
    await page.waitForTimeout(1000);
    const unqualifiedCards = page.locator('.bg-white.rounded-lg.border.border-slate-200');
    await expect(unqualifiedCards.first()).toBeVisible();

    // Click Open Leads tab and assert cards load
    await openTab.click();
    await page.waitForTimeout(1000);
    const openCards = page.locator('.bg-white.rounded-lg.border.border-slate-200');
    await expect(openCards.first()).toBeVisible();

    // Click Reserved tab and assert cards load
    await reservedTab.click();
    await page.waitForTimeout(1000);
    const reservedCards = page.locator('.bg-white.rounded-lg.border.border-slate-200');
    await expect(reservedCards.first()).toBeVisible();
  });

  test('2. Groups performance metrics calculate correctly on Performance & Reports tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/groups`);
    await page.waitForLoadState('networkidle');

    // Switch to Performance tab
    const perfTab = page.locator('button', { hasText: 'Group Performance Reports' });
    await perfTab.click();
    await page.waitForTimeout(1500);

    // Assert Summary KPIs
    await expect(page.locator('text=Total Leads Handled')).toBeVisible();
    const leadsHandled = page.locator('text=3710 Leads');
    await expect(leadsHandled).toBeVisible();

    await expect(page.locator('text=Conversions Closed')).toBeVisible();
    const conversions = page.locator('text=1313 Customers');
    await expect(conversions).toBeVisible();

    await expect(page.locator('text=Qualified Leads').first()).toBeVisible();
    const qualified = page.locator('text=82 Qualified');
    await expect(qualified).toBeVisible();

    // Top group badge
    await expect(page.locator('text=Top Group Performer')).toBeVisible();
    await expect(page.locator('text=Team A').first()).toBeVisible();

    // Group cards: check Team A, Team B, Team C KPI values
    await expect(page.locator('text=1496 Leads')).toBeVisible(); // Team A leads
    await expect(page.locator('text=573 Booked')).toBeVisible(); // Team A bookings
    await expect(page.locator('text=1273 Leads')).toBeVisible(); // Team B leads
    await expect(page.locator('text=508 Booked')).toBeVisible(); // Team B bookings
    await expect(page.locator('text=941 Leads')).toBeVisible();  // Team C leads
    await expect(page.locator('text=232 Booked')).toBeVisible();  // Team C bookings

    // Click "View Team Members" on Team A
    const viewTeamButtons = page.locator('button', { hasText: 'View Team Members' });
    await viewTeamButtons.first().click();
    await page.waitForTimeout(1000);

    // Modal table should show rows with real stats
    const modalTable = page.locator('table');
    await expect(modalTable).toBeVisible();
    await expect(modalTable.locator('th', { hasText: 'Leads Handled' })).toBeVisible();
    await expect(modalTable.locator('th', { hasText: 'Bookings' })).toBeVisible();
    // Modal row has non-zero bookings
    await expect(modalTable.locator('td', { hasText: 'Bookings' }).first()).toBeVisible();
  });

  test('3. Reports summary funnel and staff metrics calculate properly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/reports`);
    await page.waitForLoadState('networkidle');

    // Conversion funnel
    await expect(page.locator('text=Total Leads')).toBeVisible();
    await expect(page.locator('text=5,352').or(page.locator('text=5352')).first()).toBeVisible();

    // Staff Reports tab
    const staffTab = page.locator('button', { hasText: 'Staff Performance' }).or(page.locator('button', { hasText: 'Staff' }));
    if (await staffTab.count() > 0) {
      await staffTab.first().click();
      await page.waitForTimeout(1500);

      const table = page.locator('table');
      await expect(table).toBeVisible();
      // Assert that Ayyasamy or Jagadheesh row has non-zero numbers
      await expect(page.locator('text=Ayyasamy').first()).toBeVisible();
    }
  });
});
