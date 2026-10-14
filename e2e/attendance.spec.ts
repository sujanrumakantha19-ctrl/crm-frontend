import { test, expect } from '@playwright/test';

test.describe('Staff Attendance & Persistence E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('staff check-in persists across route navigation and does NOT auto-disable', async ({ page }) => {
    // 1. Login as staff
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('tamilmurugan2014@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify redirected to staff dashboard
    await expect(page).toHaveURL(/.*staff\/dashboard/, { timeout: 15000 });

    // 2. Navigate to Staff Attendance page
    await page.goto('/staff/attendance');
    await expect(page).toHaveURL(/.*staff\/attendance/);
    await page.waitForLoadState('networkidle');

    // 3. Ensure a fresh check-in state: if already checked in, check out first
    const toggleCheckout = page.locator('text=TAP TO CHECK OUT');
    if (await toggleCheckout.isVisible()) {
      await toggleCheckout.click();
      await expect(page.locator('text=TAP TO CHECK IN')).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }

    // 4. Select Activity Type
    const activityBtn = page.locator('button:has-text("Select activity type"), button:has-text("Office"), button:has-text("On Duty")').first();
    await activityBtn.click();
    await page.locator('.absolute.z-20 button:has-text("Office")').click();

    // 5. Toggle Check In
    const checkInBtn = page.locator('text=TAP TO CHECK IN');
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();

    // 6. Verify Check In became active
    await expect(page.locator('text=TAP TO CHECK OUT')).toBeVisible({ timeout: 7000 });
    await expect(page.locator('text=Checked in at').first()).toBeVisible();

    // 7. NAVIGATE TO DASHBOARD
    await page.goto('/staff/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*staff\/dashboard/);

    // Verify working time indicator is active in Topbar
    const timerBadge = page.locator('header').locator('text=/\\d+m|\\d+h/');
    await expect(timerBadge).toBeVisible({ timeout: 5000 });

    // 8. NAVIGATE TO MY LEADS
    await page.goto('/staff/my-leads');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*staff\/my-leads/);
    await expect(timerBadge).toBeVisible({ timeout: 5000 });

    // 9. NAVIGATE TO TASKS
    await page.goto('/staff/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*staff\/tasks/);
    await expect(timerBadge).toBeVisible({ timeout: 5000 });

    // 10. NAVIGATE BACK TO ATTENDANCE PAGE
    await page.goto('/staff/attendance');
    await page.waitForLoadState('networkidle');

    // CRITICAL ASSERTION: Check-in MUST STILL BE ACTIVE and NOT disabled!
    await expect(page.locator('text=TAP TO CHECK OUT')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Checked in at').first()).toBeVisible();
    await expect(page.locator('text=TAP TO CHECK IN')).not.toBeVisible();
  });

  test('staff check-in persists across LOGOUT and RE-LOGIN until explicit checkout', async ({ page }) => {
    // 1. Login as staff
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('tamilmurugan2014@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*staff\/dashboard/, { timeout: 15000 });

    // 2. Go to attendance and ensure checked in
    await page.goto('/staff/attendance');
    await page.waitForLoadState('networkidle');

    const toggleCheckout = page.locator('text=TAP TO CHECK OUT');
    if (!await toggleCheckout.isVisible()) {
      const activityBtn = page.locator('button:has-text("Select activity type"), button:has-text("Office"), button:has-text("On Duty")').first();
      await activityBtn.click();
      await page.locator('.absolute.z-20 button:has-text("Office")').click();
      await page.locator('text=TAP TO CHECK IN').click();
      await expect(page.locator('text=TAP TO CHECK OUT')).toBeVisible({ timeout: 7000 });
    }

    // 3. LOG OUT: Click Logout button in the sidebar
    const logoutBtn = page.getByRole('button', { name: 'Logout' }).first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*login/, { timeout: 7000 });

    // 4. RE-LOGIN as the same staff
    await page.getByPlaceholder('you@example.com').fill('tamilmurugan2014@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*staff\/dashboard/, { timeout: 15000 });

    // 5. Verify active session was restored from database on Dashboard
    const timerBadge = page.locator('header').locator('text=/\\d+m|\\d+h/');
    await expect(timerBadge).toBeVisible({ timeout: 7000 });

    // 6. Navigate to attendance: MUST STILL BE CHECKED IN
    await page.goto('/staff/attendance');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=TAP TO CHECK OUT')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Checked in at').first()).toBeVisible();

    // 7. Explicit Checkout: staff explicitly clicks TAP TO CHECK OUT
    await page.locator('text=TAP TO CHECK OUT').click();
    await expect(page.locator('text=TAP TO CHECK IN')).toBeVisible({ timeout: 7000 });

    // Verify after explicit checkout, timer is gone
    await page.goto('/staff/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(timerBadge).not.toBeVisible();
  });

  test('admin attendance calendar displays attendance records and modal opens with details', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });

    // 2. Navigate to Admin Attendance
    await page.goto('/admin/attendance');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*admin\/attendance/);

    // 3. Verify calendar day cells are rendered
    const dayCells = page.locator('button.min-h-\\[110px\\]');
    await expect(dayCells.first()).toBeVisible({ timeout: 7000 });
    const count = await dayCells.count();
    expect(count).toBeGreaterThanOrEqual(28);

    // 4. Click current day cell
    const todayCell = page.locator('button.min-h-\\[110px\\]').filter({ has: page.locator('.rounded-full.bg-blue-100, .ring-blue-600') }).first();
    if (await todayCell.isVisible()) {
      await todayCell.click();
    } else {
      await dayCells.first().click();
    }

    // 5. Verify Daily Details Modal opens with employee table
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('th:has-text("Employee")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });
});
