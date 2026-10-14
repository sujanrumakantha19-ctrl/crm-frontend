import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log('API RESPONSE:', res.status(), res.url());
    }
  });

  console.log('Navigating to https://samyandco.in/login ...');
  await page.goto('https://samyandco.in/login');
  await page.waitForLoadState('networkidle');

  console.log('Filling form...');
  await page.getByPlaceholder('you@example.com').fill('samyandcopromoters@gmail.com');
  await page.getByPlaceholder('Enter your password').fill('12345678');

  console.log('Clicking Sign In...');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForTimeout(4000);
  console.log('Current URL:', page.url());

  const errEl = page.locator('.text-red-600');
  if (await errEl.isVisible()) {
    console.log('Error banner text:', await errEl.textContent());
  }

  await browser.close();
})();