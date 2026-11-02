import { test, expect } from '@playwright/test';

test('learning progress, drafts, filtering and reset', async ({ page }) => {
  await page.goto('/learning/index.html');
  await expect(page.getByRole('heading', { name: 'Collections and mutability' })).toBeVisible();
  await page.getByLabel('I can explain this concept').check();
  await page.getByLabel('b = a', { exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('#feedback')).toContainText('Try again');
  await expect(page.locator('#quiz-count')).toHaveText('0 / 9');
  await page.getByLabel('b = a.copy()', { exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('#quiz-count')).toHaveText('1 / 9');
  await page.getByLabel('Your code or approach').fill('<script>alert("draft")</script>');
  await page.getByLabel('I tested my solution locally and reviewed the edge cases').check();
  await page.reload();
  await expect(page.locator('#overall')).toHaveText('11%');
  await expect(page.getByLabel('Your code or approach')).toHaveValue('<script>alert("draft")</script>');
  await page.getByRole('button', { name: 'pytest', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assertions and exceptions' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue learning' }).click();
  await expect(page.getByRole('heading', { name: 'Functions and exceptions' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset learning progress and drafts' }).click();
  await expect(page.locator('#overall')).toHaveText('0%');
  await page.reload();
  await expect(page.getByLabel('Your code or approach')).toHaveValue('');
});

test('learning still works when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await page.goto('/learning/index.html');
  await page.getByLabel('I can explain this concept').check();
  await expect(page.locator('#read-count')).toHaveText('1 / 9');
  await expect(page.locator('#storage-note')).toContainText('unavailable');
});

test('streak counts once daily, continues, and resets after a missed day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T10:00:00Z') });
  await page.goto('/learning/index.html');
  await page.getByLabel('I can explain this concept').check();
  await expect(page.locator('#streak')).toHaveText('1 day');
  await page.getByLabel('I tested my solution locally and reviewed the edge cases').check();
  await expect(page.locator('#streak')).toHaveText('1 day');
  await page.reload();
  await expect(page.locator('#streak')).toHaveText('1 day');
  await page.clock.setSystemTime(new Date('2026-11-03T10:00:00Z'));
  await page.getByLabel('b = a.copy()', { exact: true }).check();
  await page.getByRole('button', {name:'Check answer'}).click();
  await expect(page.locator('#streak')).toHaveText('2 days');
  await page.clock.setSystemTime(new Date('2026-11-05T10:00:00Z'));
  await page.getByRole('button', {name:'Check answer'}).click();
  await expect(page.locator('#streak')).toHaveText('1 day');
  await expect(page.locator('#best-streak')).toHaveText('Best: 2 days');
});

test('visual explanations advance and replay', async ({ page }) => {
  await page.goto('/learning/index.html');
  await expect(page.locator('.visual-step')).toContainText('Start with a list');
  for (let i=0;i<3;i++) await page.getByRole('button',{name:'Next step'}).click();
  await expect(page.locator('.visual-step')).toContainText('original list stays unchanged');
  await page.getByRole('button',{name:'Replay'}).click();
  await expect(page.locator('.step-counter')).toHaveText('Step 1 of 4');
});

test('anonymous learning API access is rejected', async ({ request }) => {
  expect((await request.get('/api/learning')).status()).toBe(401);
  expect((await request.post('/api/learning',{data:{document:{},revision:0}})).status()).toBe(401);
});

test('learning lessons load inside the sync page', async ({ page, request }) => {
  const response = await request.get('/learning/lab.html');
  expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  expect((await request.get('/login')).headers()['x-frame-options']).toBe('DENY');
  await page.goto('/learning');
  const lab = page.frameLocator('iframe[title="Interactive learning lab"]');
  await expect(lab.getByRole('heading', {name:'Collections and mutability'})).toBeVisible();
  await lab.getByRole('button', {name:'Next step'}).click();
  await expect(lab.locator('.step-counter')).toHaveText('Step 2 of 4');
});
