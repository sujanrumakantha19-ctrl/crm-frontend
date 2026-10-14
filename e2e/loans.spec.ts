import { test, expect } from '@playwright/test';

test.describe('Loans Page Staff Name Display E2E Tests', () => {
  test('Loans table and Customer Details display readable staff name (never raw ObjectId)', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.stack || err.message));

    // 1. Login as Admin
    await page.goto('https://samyandco.in/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"], input[name="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"], input[name="password"]', '12345678');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // 2. Navigate to Loans (/admin/customers)
    await page.goto('https://samyandco.in/admin/customers');
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    // Ensure NO 24-char hex ObjectId appears in table body
    const tableText = await page.locator('table tbody').innerText();
    const hexMatches = tableText.match(/\b[0-9a-fA-F]{24}\b/g);
    expect(hexMatches).toBeNull();

    // Verify "ASSIGNED TO" column (column 4)
    const assignedCells = page.locator('table tbody tr td:nth-child(4)');
    const count = await assignedCells.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = (await assignedCells.nth(i).innerText()).trim();
      expect(/^[0-9a-fA-F]{24}$/.test(text)).toBe(false);
      console.log('Loans Row ' + (i + 1) + ' Assigned Staff:', text.replace(/\n/g, ' '));
    }

    // 3. Click the first customer to navigate to Customer Details
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForURL('**/admin/customers/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify Customer Info Card has Assigned To
    const assignedToSection = page.locator('text=Assigned To').locator('..');
    await expect(assignedToSection).toBeVisible();
    const assignedToText = (await assignedToSection.innerText()).trim();
    console.log('Customer Detail Assigned To:', assignedToText.replace(/\n/g, ' '));

    expect(assignedToText).not.toBe('Assigned To');
    // Ensure no 24-char ObjectId in the detail card
    const hexInDetail = assignedToText.match(/\b[0-9a-fA-F]{24}\b/g);
    expect(hexInDetail).toBeNull();
  });
});
