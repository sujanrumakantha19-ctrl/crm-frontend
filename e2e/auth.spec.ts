import { test, expect } from '@playwright/test';

test.describe('Authentication & Session E2E Tests', () => {
  test('should display login page elements properly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should reject invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('invalid_user_test@domain.com');
    await page.getByPlaceholder('Enter your password').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify error notification or inline error banner appears
    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 7000 });
  });

  test('should navigate to forgot-password flow', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/.*forgot-password.*/);
  });
});
