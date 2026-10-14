import { test, expect } from '@playwright/test';

test.describe('Leads Page Staff Name Display, Tab Persistence & Dynamic Search Counts', () => {
  test('Leads page displays rep name + ID, preserves active tab during search, and updates tab badges dynamically', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
    page.on('response', res => {
      if (res.url().includes('/leads')) {
        console.log('RESPONSE:', res.status(), res.url());
      }
    });

    // 1. Log in as Admin
    await page.goto('https://samyandco.in/login');
    await page.fill('input[type="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/admin\/dashboard/, { timeout: 15000 });

    // 2. Navigate to Leads page Reserved tab
    await page.goto('https://samyandco.in/admin/leads?tab=Reserved');
    await page.waitForLoadState('networkidle');

    // Verify initial tab counts
    const reservedTab = page.locator('button:has-text("Reserved")');
    await expect(reservedTab).toBeVisible({ timeout: 10000 });
    await expect(reservedTab).toContainText('2622');

    const allLeadsTab = page.locator('button:has-text("All Leads")');
    await expect(allLeadsTab).toContainText('4354');

    const customersTab = page.locator('button:has-text("Customers")');
    await expect(customersTab).toContainText('1478');

    // 3. Verify that cards show Staff Name as well as Staff ID
    // Look for cards with "Rep: "
    const repBadges = page.locator('span:has-text("Rep:")');
    await expect(repBadges.first()).toBeVisible({ timeout: 10000 });
    const firstRepText = await repBadges.first().innerText();
    console.log('Sample Rep badge text:', firstRepText);
    expect(firstRepText).toContain('Rep:');

    // 4. Perform search while on Reserved tab
    const searchInput = page.locator('input[placeholder*="Search by name, phone"]');
    await searchInput.fill('0928154464');

    // Wait for debounced search and networkidle
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // CRITICAL: User MUST stay on Reserved tab! NOT redirected to All Leads!
    expect(page.url()).toContain('tab=Reserved');
    // Reserved tab should still be visually active (border-brand-green)
    await expect(reservedTab).toHaveClass(/border-brand-green/);

    // Tab counts should have updated dynamically based on search!
    await expect(reservedTab).toContainText('1');
    await expect(allLeadsTab).toContainText('1');
    await expect(customersTab).toContainText('0');

    // Card matching search should be visible in Reserved tab
    await expect(page.locator('text=JOHNSON RUVEN')).toBeVisible({ timeout: 10000 });
    // Check that rep name and display ID are both present
    const johnsonCard = page.locator('div:has(> div > div > div > h3:has-text("JOHNSON RUVEN"))');
    await expect(johnsonCard.locator('span:has-text("Rep:")').first()).toContainText('Madhankumar');
    await expect(johnsonCard.locator('span:has-text("Rep:")').first()).toContainText('STAFF-6');

    // 5. Test search from Customer tab
    await page.goto('https://samyandco.in/admin/leads?tab=Customer');
    await page.waitForLoadState('networkidle');

    const searchInputCust = page.locator('input[placeholder*="Search by name, phone"]');
    await searchInputCust.fill('AKSAI');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // User must stay on Customer tab!
    expect(page.url()).toContain('tab=Customer');
    await expect(customersTab).toHaveClass(/border-brand-green/);

    // Customer count for AKSAI should be 1
    await expect(customersTab).toContainText('1');
    await expect(allLeadsTab).toContainText('1');
    await expect(reservedTab).toContainText('0');

    // 6. Clear search and verify tab counts return to full counts
    await searchInputCust.fill('');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    await expect(allLeadsTab).toContainText('4354');
    await expect(reservedTab).toContainText('2622');
    await expect(customersTab).toContainText('1478');
  });

  test('Searching by phone 8015806510 in Customers tab displays top count 1 and collapses multiple bookings into exactly 1 customer card', async ({ page }) => {
    // 1. Log in as Admin
    await page.goto('https://samyandco.in/login');
    await page.fill('input[type="email"]', 'samyandcopromoters@gmail.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/admin\/dashboard/, { timeout: 15000 });

    // 2. Navigate to Leads page Customer tab
    await page.goto('https://samyandco.in/admin/leads?tab=Customer');
    await page.waitForLoadState('networkidle');

    // 3. Search phone 8015806510
    const searchInput = page.locator('input[placeholder*="Search by name, phone"]');
    await searchInput.fill('8015806510');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // 4. Verify tab count is exactly 1
    const customersTab = page.locator('button:has-text("Customers")');
    await expect(customersTab).toContainText('1');

    // 5. Verify exactly 1 customer card is displayed (NO duplicates!)
    const customerCards = page.locator('div.grid > div.bg-white:has-text("8015806510")');
    await expect(customerCards).toHaveCount(1, { timeout: 10000 });

    // 6. Verify the collapsed card details
    const singleCard = customerCards.first();
    await expect(singleCard).toContainText('ARUNACHALAM');
    await expect(singleCard).toContainText('5 Bookings');
    await expect(singleCard).toContainText('Rep:');
    await expect(singleCard.locator('button:has-text("View Customer Profile")')).toBeVisible();
  });
});

