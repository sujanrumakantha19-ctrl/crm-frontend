import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://samyandco.in';

test.describe('Admin Reports End-to-End Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
  });

  test('Reports flow: summary cards, all 7 tabs, filters, operations cards, and export', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/reports`);
    await page.waitForLoadState('networkidle');

    // 1. Verify Header
    await expect(page.getByRole('main').getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 10000 });
    const exportBtn = page.locator('button:has-text("Export CSV")');
    await expect(exportBtn).toBeVisible();

    // 2. Verify Baseline Summary Cards
    const summaryCards = page.locator('.grid.grid-cols-2.lg\\:grid-cols-6');
    await expect(summaryCards).toBeVisible();
    await expect(summaryCards.locator('p:has-text("Projects")')).toBeVisible();
    await expect(summaryCards.locator('p:has-text("Total Leads")')).toBeVisible();
    await expect(summaryCards.locator('p:has-text("Plots Booked")')).toBeVisible();
    await expect(summaryCards.locator('p:has-text("Loan Customers")')).toBeVisible();

    // 3. Tab 1: Project Summary
    const projectsTab = page.locator('button:has-text("Project Summary")');
    await expect(projectsTab).toBeVisible();
    await expect(page.locator('table thead th:has-text("Project")')).toBeVisible();
    await expect(page.locator('table thead th:has-text("Total Sq. Ft.")')).toBeVisible();

    // 4. Tab 2: Staff Performance
    const staffTab = page.locator('button:has-text("Staff Performance")');
    await staffTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table thead th:has-text("Assigned Leads")')).toBeVisible();
    await expect(page.locator('table thead th:has-text("Converted")')).toBeVisible();

    // 5. Tab 3: Attendance
    const attendanceTab = page.locator('button:has-text("Attendance")');
    await attendanceTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table thead th:has-text("Check In")')).toBeVisible();
    await expect(page.locator('table thead th:has-text("Check Out")')).toBeVisible();

    // 6. Tab 4: Channel Partner Performance
    const partnerTab = page.locator('button:has-text("Channel Partner Performance")');
    await partnerTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table thead th:has-text("Channel Partner")')).toBeVisible();
    await expect(page.locator('table thead th:has-text("Conversion %")')).toBeVisible();

    // 7. Tab 5: Leads & Booking Trend
    const trendTab = page.locator('button:has-text("Leads & Booking Trend")');
    await trendTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table thead th:has-text("Open Leads")')).toBeVisible();
    await expect(page.locator('table thead th:has-text("Qualified Leads")')).toBeVisible();

    // 8. Tab 6: Lead Contribution
    const contribTab = page.locator('button:has-text("Lead Contribution")');
    await contribTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('table thead th:has-text("Source / Channel")')).toBeVisible();
    await expect(page.locator('table thead th:has-text("Recent Lead Date")')).toBeVisible();

    // 9. Tab 7: Bookings & Loans (Operations)
    const opsTab = page.locator('button:has-text("Bookings & Loans")');
    await opsTab.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Total Bookings').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Registration Pending').first()).toBeVisible();
    await expect(page.locator('text=Booking Payments')).toBeVisible();

    // 10. Filter interaction
    const yearSelect = page.locator('select').nth(1);
    await yearSelect.selectOption('2026');
    await page.waitForTimeout(1000);
    const clearBtn = page.locator('button:has-text("Clear Filters")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForTimeout(1000);
    await expect(clearBtn).not.toBeVisible();
  });
});
