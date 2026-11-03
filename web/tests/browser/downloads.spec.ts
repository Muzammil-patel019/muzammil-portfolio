import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resumeFilename } from '../../lib/resume-filename';

test('public PDF endpoint returns a downloadable PDF with the current filename', async ({request}) => {
  const response = await request.get('/api/pdf');
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect(response.headers()['content-disposition']).toContain(resumeFilename());
  expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
});

test('resume download works from the public resume page', async ({page}) => {
  await page.goto('/resume');
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download latest PDF',exact:true}).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(resumeFilename());
  expect((await readFile((await file.path())!)).subarray(0,5).toString()).toBe('%PDF-');
  await expect(page.getByRole('status')).toContainText('PDF ready');
});

test('public download falls back to browser rendering when the API fails', async ({page}) => {
  await page.route('**/api/pdf', route => route.fulfill({status:503,contentType:'text/html',body:'Unavailable'}));
  await page.goto('/');
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download PDF',exact:true}).click();
  const file = await download;
  expect((await readFile((await file.path())!)).subarray(0,5).toString()).toBe('%PDF-');
  await page.goto('/resume/print');
  await expect(page.getByRole('article')).toContainText('Muzammil Patel');
  await expect(page.getByRole('button',{name:'Print / Save as PDF'})).toBeVisible();
});
