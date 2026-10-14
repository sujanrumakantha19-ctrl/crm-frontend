import { test, expect } from '@playwright/test';

test.describe('QA Tracker Defect Regression & Validation E2E Tests', () => {

  test('BUG-2 & Login: should validate email and password inputs and rate-limiting resilience', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();

    // Verify rate limit threshold allows successive requests without immediate 429
    for (let i = 0; i < 3; i++) {
      await page.getByPlaceholder('you@example.com').fill('test_user_' + i + '@example.com');
      await page.getByPlaceholder('Enter your password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 5000 });
    }
  });

  test('BUG-4 & BUG-5: Form & input constraints', async ({ page }) => {
    await page.goto('/login');
    // Ensure login page prevents empty submissions with standard HTML5 / validation
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('Project Detail & Follow-ups: should load with no constructor errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/projects');
    const viewDetailsBtn = page.getByRole('button', { name: 'View Details' }).first();
    await expect(viewDetailsBtn).toBeVisible({ timeout: 10000 });
    await viewDetailsBtn.click();

    await expect(page).toHaveURL(/.*\/admin\/projects\/.*/);
    await page.waitForTimeout(2000);

    // Switch to Plot Map tab
    const plotMapTab = page.getByRole('button', { name: 'Plot Map' });
    if (await plotMapTab.isVisible()) {
      await plotMapTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Interactive Plot Availability Grid')).toBeVisible();
    }

    // Open Edit Plots modal if available
    const editPlotsBtn = page.getByRole('button', { name: /Edit Plots/i });
    if (await editPlotsBtn.isVisible()) {
      await editPlotsBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('input[placeholder*="Search by plot number"]')).toBeVisible();
      // Close modal
      const closeBtn = page.locator('button:has-text("Cancel")').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }

    const fatalErrors = consoleErrors.filter(e => e.includes('is not a constructor') || e.includes('TypeError'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Admin Staff Management: Staff ID search and delete confirmation modal', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/staff');
    await page.waitForTimeout(2000);

    // Verify search input is present with updated placeholder
    const searchInput = page.getByPlaceholder(/Search by name, Staff ID/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Test search by staff-28
    await searchInput.fill('staff-28');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=STAFF-28').first()).toBeVisible();
    await expect(page.locator('text=STAFF-18')).not.toBeVisible();
    await expect(page.locator('text=STAFF-14')).not.toBeVisible();
    await expect(page.locator('text=STAFF-13')).not.toBeVisible();
    await expect(page.locator('text=STAFF-12')).not.toBeVisible();

    // Test search with space: staff 28
    await searchInput.fill('staff 28');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=STAFF-28').first()).toBeVisible();
    await expect(page.locator('text=STAFF-18')).not.toBeVisible();

    // Test search with numeric only: 28
    await searchInput.fill('28');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=STAFF-28').first()).toBeVisible();
    await expect(page.locator('text=STAFF-18')).not.toBeVisible();

    // Verify delete button is present on the staff card
    const deleteBtn = page.getByTitle('Delete Staff').first();
    await expect(deleteBtn).toBeVisible();

    // Click delete button to open confirmation modal
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Verify confirmation modal content
    const modalHeading = page.getByRole('heading', { name: 'Delete Staff Member' });
    await expect(modalHeading).toBeVisible();
    await expect(page.locator('text=Warning: This action is permanent')).toBeVisible();
    await expect(page.locator('text=will become Unassigned')).toBeVisible();

    // Cancel deletion (button inside modal)
    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).last();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Verify modal closed
    await expect(modalHeading).not.toBeVisible();
  });

  test('Email Lowercase: typing uppercase in email inputs automatically converts to lowercase', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('AdminTEST@Samyco.IN');
    await expect(emailInput).toHaveValue('admintest@samyco.in');

    // Test Forgot Password page
    await page.goto('/forgot-password');
    const forgotEmailInput = page.getByPlaceholder('you@example.com');
    await forgotEmailInput.fill('UserForgotUPPER@Example.COM');
    await expect(forgotEmailInput).toHaveValue('userforgotupper@example.com');
  });

  test('Profile Password: red asterisks present on password labels and inline error box visible', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    // Open User Dropdown and click Profile
    const userMenuBtn = page.locator('header button:has(.text-sm)').first();
    await userMenuBtn.click();
    const profileBtn = page.getByRole('button', { name: /Profile/i });
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // Verify modal is open
    await expect(page.getByRole('heading', { name: 'My Profile Settings' })).toBeVisible();

    // Verify red asterisks on Current, New, and Confirm password labels
    const currentPassLabel = page.locator('label', { hasText: 'Current Password' });
    await expect(currentPassLabel).toBeVisible();
    await expect(currentPassLabel.locator('.text-red-500')).toHaveText('*');

    const newPassLabel = page.locator('label', { hasText: 'New Password' });
    await expect(newPassLabel).toBeVisible();
    await expect(newPassLabel.locator('.text-red-500')).toHaveText('*');

    const confirmPassLabel = page.locator('label', { hasText: 'Confirm Password' });
    await expect(confirmPassLabel).toBeVisible();
    await expect(confirmPassLabel.locator('.text-red-500')).toHaveText('*');

    // Click Update Password with empty inputs
    const updatePassBtn = page.getByRole('button', { name: 'Update Password' });
    await updatePassBtn.click();

    // Assert that the inline error box is directly visible inside the reset password area
    const inlineError = page.locator('form:has-text("Reset Account Password") .bg-red-50');
    await expect(inlineError).toBeVisible();
    await expect(inlineError).toContainText('All password fields are required');

    // Enter mismatched passwords
    await page.locator('input[placeholder="••••••••"]').first().fill('12345678');
    await page.getByPlaceholder('Min 6 chars').fill('password123');
    await page.locator('input[placeholder="••••••••"]').nth(1).fill('mismatch456');
    await updatePassBtn.click();

    // Assert that the inline error box updates to show mismatch error
    await expect(inlineError).toBeVisible();
    await expect(inlineError).toContainText('New passwords do not match');
  });

  test('Follow-ups: search by lead ID works for Admin and Staff', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/follow-ups');
    await page.waitForLoadState('networkidle');

    // Locate the search input
    const searchInput = page.getByPlaceholder('Search by ID, name, phone, or staff...');
    await expect(searchInput).toBeVisible();

    // Type lead ID "L-7"
    await searchInput.fill('L-7');
    // Wait for debounced search and network response
    await page.waitForTimeout(1500);

    // Assert that lead L-7 is visible in the table
    await expect(page.locator('table').getByText('L-7').first()).toBeVisible();

    // Test lowercase variation "l-7"
    await searchInput.fill('l-7');
    await page.waitForTimeout(1500);
    await expect(page.locator('table').getByText('L-7').first()).toBeVisible();
  });

  test('Follow-ups: Staff persona search by assigned lead ID', async ({ page }) => {
    // Login as staff member
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('dhyanud@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/staff/**', { timeout: 15000 });

    await page.goto('/staff/follow-ups');
    await page.waitForLoadState('networkidle');

    // Locate the search input
    const searchInput = page.getByPlaceholder('Search by ID, name, or phone number...');
    await expect(searchInput).toBeVisible();

    // Type assigned lead ID "L-11"
    await searchInput.fill('L-11');
    await page.waitForTimeout(1500);

    // Assert that lead L-11 is visible in the staff table
    await expect(page.locator('table').getByText('L-11').first()).toBeVisible();

    // Test lowercase variation "l-11"
    await searchInput.fill('l-11');
    await page.waitForTimeout(1500);
    await expect(page.locator('table').getByText('L-11').first()).toBeVisible();
  });

  test('Admin Attendance: Calendar Month/Year dropdown navigation & Export Month/Year buttons', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/attendance');
    await page.waitForLoadState('networkidle');

    // 1. Verify Month & Year dropdowns exist
    const monthSelect = page.locator('select[aria-label="Select Month"]');
    const yearSelect = page.locator('select[aria-label="Select Year"]');
    await expect(monthSelect).toBeVisible();
    await expect(yearSelect).toBeVisible();

    // 2. Select year 2025 and month March (3)
    await yearSelect.selectOption('2025');
    await monthSelect.selectOption('3');
    await page.waitForTimeout(500);

    // Verify values stick
    await expect(yearSelect).toHaveValue('2025');
    await expect(monthSelect).toHaveValue('3');

    // 3. Verify Export Month and Export Year buttons are present
    const exportMonthBtn = page.getByRole('button', { name: /Export Month/i });
    const exportYearBtn = page.getByRole('button', { name: /Export Year/i });
    await expect(exportMonthBtn).toBeVisible();
    await expect(exportYearBtn).toBeVisible();
  });

  test('Admin Attendance: Employee-wise Log shows Not Joined for dates before joining', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/attendance');
    await page.waitForLoadState('networkidle');

    // Switch to Employee-wise Log tab
    const empTabBtn = page.getByRole('button', { name: /Employee-wise Log/i });
    await empTabBtn.click();
    await page.waitForTimeout(500);

    // Select an employee from the dropdown
    const selectTrigger = page.locator('button:has-text("Choose an employee..."), button:has-text("Search employee...")').first();
    await selectTrigger.click();
    await page.waitForTimeout(300);

    // Click first real staff member in dropdown (excluding placeholder)
    const firstStaffOption = page.locator('.shadow-lg button:not(:has-text("Choose an employee..."))').first();
    await firstStaffOption.click();
    await page.waitForTimeout(1000);

    // Verify "Export Log" button is visible
    const exportLogBtn = page.getByRole('button', { name: /Export Log/i });
    await expect(exportLogBtn).toBeVisible();

    // Verify "Not Joined" option exists in Status Filter dropdown
    const statusSelect = page.locator('label:has-text("Status Filter") + select');
    await expect(statusSelect).toBeVisible();
    const notJoinedOption = statusSelect.locator('option[value="Not Joined"]');
    await expect(notJoinedOption).toHaveCount(1);

    // Switch Month to previous month (August or July) where employee was not yet created
    const monthFilter = page.locator('label:has-text("Month") + select');
    await monthFilter.selectOption('8'); // August
    await page.waitForTimeout(500);

    // Verify table has "Not Joined" badge instead of Absent
    const notJoinedBadge = page.locator('span:has-text("Not Joined")').first();
    await expect(notJoinedBadge).toBeVisible({ timeout: 5000 });

    // Verify Absent count in Employee Stats card is 0 for August (since employee had not joined)
    const absentStatCard = page.locator('text=Days Absent').locator('..').locator('span.text-2xl');
    await expect(absentStatCard).toHaveText('0');
  });

  test('Admin Groups: Inactive staff members are excluded when creating groups', async ({ page }) => {
    // Intercept users API to inject an inactive staff member
    await page.route('**/api/v1/users?role=staff*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data && Array.isArray(json.data)) {
        json.data.push({
          _id: 'fake_inactive_staff_999',
          id: 'fake_inactive_staff_999',
          name: 'Inactive Tester Staff',
          displayId: 'STAFF-999',
          role: 'staff',
          designation: 'Sales Executive',
          isActive: false,
        });
      }
      await route.fulfill({ json });
    });

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');

    // Click Create Group
    const createBtn = page.getByRole('button', { name: /Create Group/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(500);

    // Verify Inactive Tester Staff is NOT rendered in the member selection list
    await expect(page.locator('text=Inactive Tester Staff')).not.toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Admin Groups: Create, Edit, and Delete group lifecycle with confirmation modal and toast', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');

    const uniqueGroupName = `QA_Test_Group_${Date.now()}`;
    const updatedGroupName = `${uniqueGroupName}_Edited`;

    // 1. CREATE GROUP
    const createBtn = page.getByRole('button', { name: /Create Group/i });
    await createBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.getByPlaceholder('e.g., Sales Team C');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(uniqueGroupName);

    const descInput = page.getByPlaceholder('Describe the group...');
    await descInput.fill('E2E automation test description');

    const saveBtn = page.getByRole('button', { name: 'Save Group' });
    await saveBtn.click();

    // Verify success toast
    await expect(page.locator('text=created successfully')).toBeVisible({ timeout: 7000 });
    await page.waitForTimeout(1000);

    // Verify row appears in table
    const groupRow = page.locator(`tr:has-text("${uniqueGroupName}")`);
    await expect(groupRow).toBeVisible({ timeout: 5000 });

    // 2. EDIT GROUP
    const editBtn = groupRow.locator('button[title="Edit Group"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await page.waitForTimeout(500);

    // Verify modal title contains group name
    await expect(page.locator(`text=Edit Group — ${uniqueGroupName}`)).toBeVisible();
    await expect(nameInput).toHaveValue(uniqueGroupName);

    // Update name
    await nameInput.fill(updatedGroupName);
    const updateBtn = page.getByRole('button', { name: 'Update Group' });
    await updateBtn.click();

    // Verify update toast
    await expect(page.locator('text=updated successfully')).toBeVisible({ timeout: 7000 });
    await page.waitForTimeout(1000);

    // Verify updated row appears
    const updatedRow = page.locator(`tr:has-text("${updatedGroupName}")`);
    await expect(updatedRow).toBeVisible({ timeout: 5000 });

    // 3. DELETE GROUP
    const deleteBtn = updatedRow.locator('button[title="Delete Group"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Verify Delete Confirmation Modal opens
    await expect(page.locator('text=Confirm Delete Group')).toBeVisible();
    await expect(page.locator(`text=Are you sure you want to delete group "${updatedGroupName}"?`)).toBeVisible();
    await expect(page.locator('text=Warning: This action cannot be undone.')).toBeVisible();

    // Test CANCEL button
    const cancelDeleteBtn = page.locator('button:has-text("Cancel")').first();
    await cancelDeleteBtn.click();
    await page.waitForTimeout(500);
    // Ensure group still exists
    await expect(updatedRow).toBeVisible();

    // Open Delete Modal again and CONFIRM deletion
    await deleteBtn.click();
    await page.waitForTimeout(500);
    const confirmDeleteBtn = page.getByText('Delete Group', { exact: true });
    await confirmDeleteBtn.click();

    // Verify delete toast
    await expect(page.locator('text=deleted successfully')).toBeVisible({ timeout: 7000 });
    await page.waitForTimeout(1000);

    // Verify row is completely removed
    await expect(page.locator(`tr:has-text("${updatedGroupName}")`)).toHaveCount(0);
  });

  test('Leads: Search by Lead ID (e.g. L-3485 and 3485) and consistent Staff ID display', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
    await page.getByPlaceholder('Enter your password').fill('12345678');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/admin/**', { timeout: 15000 });

    await page.goto('/admin/leads');
    await page.waitForTimeout(2000);

    // 1. Search by full lead ID (e.g. L-3485)
    const searchInput = page.getByPlaceholder('Search leads...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('L-3485');
    await page.waitForTimeout(1500);

    // Verify lead card appears with ID: L-3485
    await expect(page.locator('text=ID: L-3485')).toBeVisible({ timeout: 10000 });
    // Verify Rep displays STAFF-1
    await expect(page.locator('text=Rep: STAFF-1')).toBeVisible();

    // 2. Search by numeric-only portion (e.g. 3485)
    await searchInput.fill('3485');
    await page.waitForTimeout(1500);
    await expect(page.locator('text=ID: L-3485')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Rep: STAFF-1')).toBeVisible();
  });

  test('Leads: Inactive staff exclusion from assignment dropdowns and backend assignment rejection', async ({ page, request }) => {
    // Intercept users API to inject an inactive staff member
    await page.route('**/api/v1/users?role=staff*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data && Array.isArray(json.data)) {
        json.data.push({
          _id: 'fake_inactive_staff_999',
          id: 'fake_inactive_staff_999',
          name: 'Inactive Lead Staff Tester',
          displayId: 'STAFF-999',
          role: 'staff',
          designation: 'Sales Executive',
          isActive: false,
        });
      }
      await route.fulfill({ json });
    });

    await page.goto('/login');
    if (!page.url().includes('/admin/')) {
      await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
      await page.getByPlaceholder('Enter your password').fill('12345678');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL('**/admin/**', { timeout: 20000 });
    }

    // 1. Open Leads page and check Assign Lead modal
    await page.goto('/admin/leads?tab=Open');
    await page.waitForTimeout(2000);

    const assignBtn = page.getByRole('button', { name: 'Assign' }).first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await page.waitForTimeout(500);
      const selectOptions = await page.locator('select:has-text("Choose representative...") option').allInnerTexts();
      const hasInactive = selectOptions.some(opt => opt.includes('Inactive Lead Staff Tester'));
      expect(hasInactive).toBe(false);
      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    }

    // 2. Open Create Lead modal
    const addLeadBtn = page.getByRole('button', { name: 'Add New Lead' });
    await addLeadBtn.click();
    await page.waitForTimeout(500);

    // Check Assign Representative dropdown
    const createRepOptions = await page.locator('select:has-text("Choose Staff...") option').allInnerTexts();
    const hasInactiveInCreate = createRepOptions.some(opt => opt.includes('Inactive Lead Staff Tester'));
    expect(hasInactiveInCreate).toBe(false);

    // Select Source Type = Staff and check Source Staff dropdown
    await page.locator('select:has-text("Direct")').selectOption('Staff');
    await page.waitForTimeout(500);
    const sourceStaffOptions = await page.locator('select:has-text("Choose Staff Member...") option').allInnerTexts();
    const hasInactiveInSource = sourceStaffOptions.some(opt => opt.includes('Inactive Lead Staff Tester'));
    expect(hasInactiveInSource).toBe(false);

    await page.getByRole('button', { name: 'Cancel' }).click();

    // 3. Backend rejection test: Ensure backend returns 400 when assigning inactive staff
    const token = await page.evaluate(() => localStorage.getItem('crm_token'));
    const staffRes = await request.get('/api/v1/users?role=staff&limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const staffData = await staffRes.json();
    const allStaff = staffData.data || [];
    let inactiveDbStaff = allStaff.find((s: any) => s.isActive === false);
    let tempDeactivatedId = '';
    if (!inactiveDbStaff && allStaff.length > 0) {
      const target = allStaff[allStaff.length - 1];
      await request.put(`/api/v1/users/${target._id || target.id}`, {
        data: { isActive: false },
        headers: { Authorization: `Bearer ${token}` }
      });
      inactiveDbStaff = { ...target, isActive: false };
      tempDeactivatedId = target._id || target.id;
    }

    if (inactiveDbStaff) {
      try {
        const leadRes = await request.get('/api/v1/leads?limit=1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const leadData = await leadRes.json();
        const testLead = (leadData.data || [])[0];
        if (testLead) {
          const updateRes = await request.put(`/api/v1/leads/${testLead._id || testLead.id}`, {
            data: { assignedTo: inactiveDbStaff._id || inactiveDbStaff.id },
            headers: { Authorization: `Bearer ${token}` }
          });
          expect(updateRes.status()).toBe(400);
          const errJson = await updateRes.json();
          expect(errJson.error || errJson.message).toContain('Cannot assign lead to an inactive staff member');
        }
      } finally {
        if (tempDeactivatedId) {
          await request.put(`/api/v1/users/${tempDeactivatedId}`, {
            data: { isActive: true },
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
    }
  });
});



