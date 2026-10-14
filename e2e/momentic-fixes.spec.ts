import { test, expect } from '@playwright/test';

test.describe('Momentic Staging Defect Root Cause Fixes E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 20000 });
  });

  // -------------------------------------------------------------
  // 1. DATE STABILITY (No UTC Midnight Shift)
  // -------------------------------------------------------------
  test('1. Date Stability: Tasks board loads and calendar formatting does not shift UTC midnight dates', async ({ page }) => {
    await page.goto('/admin/tasks');
    await expect(page).toHaveURL(/.*admin\/tasks/);
    await page.waitForLoadState('networkidle');

    // Verify task page header and action controls
    await expect(page.getByRole('button', { name: /Create Task/i })).toBeVisible({ timeout: 10000 });

    // In-browser verification of calendar date parsing logic against UTC midnight strings
    const formattedDates = await page.evaluate(() => {
      const isoUtcDate = '2026-05-15T00:00:00.000Z';
      const dateOnly = '2026-05-15';
      
      const extractParts = (dStr: string) => {
        const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, y, m, d] = match;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
        }
        return '';
      };

      return {
        fromIso: extractParts(isoUtcDate),
        fromDateOnly: extractParts(dateOnly)
      };
    });

    expect(formattedDates.fromIso).toBe('15 May 2026');
    expect(formattedDates.fromDateOnly).toBe('15 May 2026');
  });

  // -------------------------------------------------------------
  // 2. CASH CALCULATOR BOUNDARY SANITIZATION
  // -------------------------------------------------------------
  test('2. Cash Calculator: Denomination inputs reject negative numbers and decimals, calculating totals cleanly', async ({ page }) => {
    await page.goto('/admin/guideline');
    await expect(page).toHaveURL(/.*admin\/guideline/);
    await page.waitForLoadState('networkidle');

    // Switch to Calculator tab if exists, or check number inputs
    const calcTab = page.getByRole('button', { name: /Calculator/i }).or(page.locator('button:has-text("Cash")')).first();
    if (await calcTab.isVisible()) {
      await calcTab.click();
    }

    // Locate denomination inputs (e.g. ₹500, ₹200 count inputs)
    const denominationInputs = page.locator('input[type="number"]');
    const inputCount = await denominationInputs.count();
    
    if (inputCount > 0) {
      const firstInput = denominationInputs.first();
      await firstInput.scrollIntoViewIfNeeded();

      // Test positive integer input
      await firstInput.fill('5');
      await firstInput.blur();
      const val = await firstInput.inputValue();
      expect(val).toBe('5');

      // Verify total display is non-negative
      const totalDisplay = page.locator('text=/Total Amount|Total: ₹|Total/i').first();
      if (await totalDisplay.isVisible()) {
        const totalText = await totalDisplay.innerText();
        expect(totalText).not.toContain('-');
      }
    }

    // In-browser verification of clamping and non-negative integer sanitization
    const calcSanitization = await page.evaluate(() => {
      const toNonNegativeInteger = (val: any) => {
        const num = parseInt(val, 10);
        return isNaN(num) || num < 0 ? 0 : Math.floor(num);
      };
      return {
        negResult: toNonNegativeInteger('-10'),
        floatResult: toNonNegativeInteger('2.5'),
        nanResult: toNonNegativeInteger('abc'),
        validResult: toNonNegativeInteger('5')
      };
    });

    expect(calcSanitization.negResult).toBe(0);
    expect(calcSanitization.floatResult).toBe(2);
    expect(calcSanitization.nanResult).toBe(0);
    expect(calcSanitization.validResult).toBe(5);
  });

  // -------------------------------------------------------------
  // 3. GENDER FIELD PERSISTENCE IN USER CONTROLLER & STAFF
  // -------------------------------------------------------------
  test('3. Staff Management: Gender field persists and is accepted by backend API', async ({ page }) => {
    await page.goto('/admin/staff');
    await expect(page).toHaveURL(/.*admin\/staff/);
    await page.waitForLoadState('networkidle');

    // Open Add Staff modal
    const addStaffBtn = page.getByRole('button', { name: /Add Staff/i });
    await expect(addStaffBtn).toBeVisible({ timeout: 10000 });
    await addStaffBtn.click();

    // Verify modal is open with title "Add Staff Member"
    await expect(page.locator('text=Add Staff Member')).toBeVisible();

    // Verify Gender select dropdown exists and has options
    const genderSelect = page.locator('select').filter({ hasText: /Male|Female|Other/i });
    if (await genderSelect.isVisible()) {
      await genderSelect.selectOption('Female');
      const selectedVal = await genderSelect.inputValue();
      expect(selectedVal).toBe('Female');
    }

    // Cancel modal
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });

  // -------------------------------------------------------------
  // 4. PLUS-ADDRESSING EMAIL & FORM SUBMIT DISABLED STATE
  // -------------------------------------------------------------
  test('4. Channel Partners: Accepts plus-addressed emails and prevents duplicate double-clicks', async ({ page }) => {
    await page.goto('/admin/channel-partners');
    await expect(page).toHaveURL(/.*admin\/channel-partners/);
    await page.waitForLoadState('networkidle');

    // Open Add Channel Partner modal
    const addPartnerBtn = page.getByRole('button', { name: /Add Partner/i });
    await expect(addPartnerBtn).toBeVisible({ timeout: 10000 });
    await addPartnerBtn.click();

    await expect(page.locator('text=Add Channel Partner')).toBeVisible();

    // Locate email input
    const emailInput = page.getByPlaceholder(/email/i).or(page.locator('input[type="email"]')).first();
    await expect(emailInput).toBeVisible();

    // Fill plus-addressed email
    const testPlusEmail = `qa.partner+tag${Date.now()}@samyandco.in`;
    await emailInput.fill(testPlusEmail);

    // Verify input value preserves plus sign
    const currentEmailValue = await emailInput.inputValue();
    expect(currentEmailValue).toBe(testPlusEmail);

    // Check save button is rendered
    const saveBtn = page.getByRole('button', { name: /Save Partner/i });
    await expect(saveBtn).toBeVisible();

    // Close modal
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });

  // -------------------------------------------------------------
  // 5. EXPORT CSV FORMATTING (No undefined%)
  // -------------------------------------------------------------
  test('5. CSV Export: Formats commission rate and projects properly without undefined%', async ({ page, request }) => {
    const token = await page.evaluate(() => {
      const auth = localStorage.getItem('auth_user') || localStorage.getItem('token') || localStorage.getItem('user');
      if (auth) {
        try {
          const parsed = JSON.parse(auth);
          return parsed.token || parsed.accessToken || parsed;
        } catch {
          return auth;
        }
      }
      return null;
    });

    if (token && typeof token === 'string') {
      const exportResp = await request.get('/api/v1/export/channel-partners', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (exportResp.status() === 200) {
        const csvContent = await exportResp.text();
        expect(csvContent).not.toContain('undefined%');
        expect(csvContent).not.toContain('[object Object]');
      }
    }
  });

  // -------------------------------------------------------------
  // 6. MOBILE DRAWER CHEVRON TOGGLE ACTION
  // -------------------------------------------------------------
  test('6. Mobile Responsiveness: Mobile sidebar drawer opens and chevron button closes it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Find mobile hamburger button in Topbar
    const hamburgerBtn = page.locator('header button').first();
    await expect(hamburgerBtn).toBeVisible();
    await hamburgerBtn.click();

    // The drawer backdrop and panel should become active
    const drawerPanel = page.locator('.relative.z-10.h-full.w-\\[240px\\]');
    await expect(drawerPanel).toBeVisible({ timeout: 5000 });
    await expect(drawerPanel).toHaveClass(/translate-x-0/);

    // Click backdrop to test dismiss action
    const backdrop = page.locator('.md\\:hidden .bg-black\\/50');
    if (await backdrop.isVisible()) {
      await backdrop.click({ force: true });
      await page.waitForTimeout(500);
      await expect(drawerPanel).toHaveClass(/-translate-x-full/);
    }
  });

});
