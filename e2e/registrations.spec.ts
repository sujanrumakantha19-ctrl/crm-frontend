import { test, expect } from '@playwright/test';

test.describe('Registrations Tab Fixes (Live Production)', () => {
  test('assigned staff displays readable name/ID (never raw ObjectId) and upcoming tab excludes registered plots', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('https://samyandco.in/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"], input[name="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"], input[name="password"]', '12345678');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // 2. Navigate to Registrations
    await page.goto('https://samyandco.in/admin/registrations');
    await page.waitForLoadState('networkidle');

    // Default tab is Registered
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    // Check table rows in Registered tab:
    // Ensure NO 24-char hexadecimal ObjectId appears anywhere in the table
    const tableTextReg = await page.locator('table tbody').innerText();
    const hexMatchesReg = tableTextReg.match(/\b[0-9a-fA-F]{24}\b/g);
    expect(hexMatchesReg).toBeNull();

    // Verify staff name or displayId is shown in "ASSIGNED TO" column
    const assignedCellsReg = page.locator('table tbody tr td:nth-child(4)');
    const countReg = await assignedCellsReg.count();
    expect(countReg).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(countReg, 5); i++) {
      const text = (await assignedCellsReg.nth(i).innerText()).trim();
      expect(/^[0-9a-fA-F]{24}$/.test(text)).toBe(false);
      console.log(`Registered Row ${i + 1} Assigned Staff:`, text);
    }

    // 3. Click "Upcoming" tab
    await page.click('button:has-text("Upcoming")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify subtitle appears:
    await expect(page.locator('text=Plots that are booked with an expected registration date appear here.')).toBeVisible();

    // Check table rows in Upcoming tab:
    const upcomingRows = page.locator('table tbody tr');
    const upcomingCount = await upcomingRows.count();
    console.log(`Upcoming tab row count: ${upcomingCount}`);

    if (upcomingCount > 0) {
      // Ensure NO 24-char ObjectId
      const tableTextUpcoming = await page.locator('table tbody').innerText();
      const hexMatchesUpcoming = tableTextUpcoming.match(/\b[0-9a-fA-F]{24}\b/g);
      expect(hexMatchesUpcoming).toBeNull();

      // Ensure NO plot in Upcoming tab is 'Registered'
      // Vinayaga Garden Plot 42, 43, 45N must NOT be in Upcoming tab!
      expect(tableTextUpcoming).not.toContain('Plot 43');
      expect(tableTextUpcoming).not.toContain('Plot 42');
      expect(tableTextUpcoming).not.toContain('Plot 45N');

      const assignedCellsUp = page.locator('table tbody tr td:nth-child(4)');
      for (let i = 0; i < Math.min(upcomingCount, 5); i++) {
        const text = (await assignedCellsUp.nth(i).innerText()).trim();
        expect(/^[0-9a-fA-F]{24}$/.test(text)).toBe(false);
        console.log(`Upcoming Row ${i + 1} Assigned Staff:`, text);
      }
    }
  });
});
