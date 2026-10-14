import { test, expect } from '@playwright/test';

test.describe('Dashboard Operations Metrics & Leads Tab Counts Verification', () => {
  test('Admin dashboard displays distinct Total Customers (1478), Total Bookings (2476), Total Leads (4354), and Leads page tabs match', async ({ page }) => {
    // Navigate to production login page
    await page.goto('https://samyandco.in/login');

    // Fill credentials and log in
    await page.fill('input[type="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Operations Overview')).toBeVisible({ timeout: 15000 });

    // Verify top card "Total Leads" displays 4354
    const totalLeadsCard = page.locator('div:has(> div > p:has-text("Total Leads"))');
    await expect(totalLeadsCard.locator('p.text-2xl, p.text-3xl')).toHaveText('4354', { timeout: 10000 });

    // Locate Operations Overview container
    const opsSection = page.locator('div:has(> h2:has-text("Operations Overview"))');

    // Verify "Total Customers" displays 1478
    const customersCard = opsSection.locator('button:has-text("Total Customers")');
    await expect(customersCard).toBeVisible();
    await expect(customersCard.locator('p.text-2xl, p.text-3xl')).toHaveText('1478', { timeout: 10000 });

    // Verify "Total Bookings" displays 2476
    const bookingsCard = opsSection.locator('button:has-text("Total Bookings")');
    await expect(bookingsCard).toBeVisible();
    await expect(bookingsCard.locator('p.text-2xl, p.text-3xl')).toHaveText('2476', { timeout: 10000 });

    // Verify "Registration Pending" displays 523
    const pendingCard = opsSection.locator('button:has-text("Registration Pending")');
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.locator('p.text-2xl, p.text-3xl')).toHaveText(/52[23]/, { timeout: 10000 });

    // Verify "Total Loans" displays 347
    const loansCard = opsSection.locator('button:has-text("Total Loans")');
    await expect(loansCard).toBeVisible();
    await expect(loansCard.locator('p.text-2xl, p.text-3xl')).toHaveText('347', { timeout: 10000 });

    // Navigate to Leads page
    await page.goto('https://samyandco.in/admin/leads');
    await page.waitForLoadState('networkidle');

    // Verify Leads page tab badges
    const allLeadsTab = page.locator('button:has-text("All Leads")');
    await expect(allLeadsTab).toBeVisible({ timeout: 10000 });
    await expect(allLeadsTab).toContainText('4354');

    const openLeadsTab = page.locator('button:has-text("Open Leads")');
    await expect(openLeadsTab).toContainText('89');

    const reservedTab = page.locator('button:has-text("Reserved")');
    await expect(reservedTab).toContainText('2622');

    const qualifiedTab = page.locator('button:has-text("Qualified Leads")');
    await expect(qualifiedTab).toContainText('98');

    const unqualifiedTab = page.locator('button:has-text("Unqualified")');
    await expect(unqualifiedTab).toContainText('67');

    const customersTab = page.locator('button:has-text("Customers")');
    await expect(customersTab).toContainText('1478');
  });
});
