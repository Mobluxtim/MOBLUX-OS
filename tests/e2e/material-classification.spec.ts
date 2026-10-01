import { test, expect } from '@playwright/test';

test('library review shows evidence-backed families and genuine unknowns without purchasing guesses', async ({ page }) => {
  test.skip(!process.env.MOBLUX_REAL_MODEL_ID, 'Requires the existing real library.');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/login'); await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!);
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await page.getByRole('link', { name: 'Material Library', exact: true }).click();
  const sources = await (await page.request.get('/api/library')).json() as { id: string; category: string; hash: string }[];
  const panel = sources.find(s => s.category === 'PANEL' && s.hash === '66ab704b818a96315a46c8d09f65c0e79cd347e2a072331b081e2f8696907cbf')!;
  await page.getByRole('combobox', { name: 'Snapshot', exact: true }).selectOption(panel.id);
  const search = page.getByLabel('Search library records');
  for (const [name, label] of [['--PFL--0110 PE(Alb)', 'PFL / HDF fibreboard'], ['zz-Glass 0080 tr nou', 'Glass'], ['H1732 ST9 Mesteacan Nisip', 'Unknown']]) {
    await search.fill(name);
    await expect(page.locator('.material-profile strong')).toHaveText(label);
    await expect(page.getByText('Purchasing unit: Unverified', { exact: true })).toBeVisible();
    await expect(page.getByText('Stock sheet: Unverified', { exact: true })).toBeVisible();
  }
  await page.getByText('Classification evidence', { exact: true }).click();
  await expect(page.getByText('No verified substrate declaration for this exact source record. Decor, group, texture and thickness do not establish substrate.')).toBeVisible();
  await page.screenshot({ path: 'test-results/material-classification-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/material-classification-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
