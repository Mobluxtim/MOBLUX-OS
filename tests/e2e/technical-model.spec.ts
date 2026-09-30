import { test, expect } from '@playwright/test';
import { cabinetCsv, cuttingCsv } from '../fixtures/technical-csv.js';

test('technical model review links reports, exposes four views and reuses the same import', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/login'); await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!); await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for good work.' })).toBeVisible();
  const headers = { origin: process.env.APP_ORIGIN! };
  const customer = await page.request.post('/api/customers', { headers, data: { name: '[TEST] Technical model customer', email: '', phone: '', address: '' } }); expect(customer.status()).toBe(201);
  const project = await page.request.post('/api/projects', { headers, data: { customerId: (await customer.json()).id, name: '[TEST] Technical review', description: 'Synthetic fixtures' } }); expect(project.status()).toBe(201); const id = (await project.json()).id;
  const version = await page.request.post(`/api/projects/${id}/versions`, { headers, data: { summary: 'Synthetic source version', requestId: crypto.randomUUID() } }); expect(version.status()).toBe(201); const versionId = (await version.json()).id;
  async function report(name: string, content: string, profile: string) {
    const file = await page.request.post(`/api/projects/${id}/versions/${versionId}/sources`, { headers: { ...headers, 'idempotency-key': crypto.randomUUID() }, multipart: { file: { name, mimeType: 'text/csv', buffer: Buffer.from(content) } } }); expect(file.status()).toBe(201);
    const result = await page.request.post(`/api/projects/${id}/sources/${(await file.json()).id}/csv-imports`, { headers, data: { profile, requestId: crypto.randomUUID() } }); expect(result.status()).toBe(201); return (await result.json()).id as string;
  }
  const c = await report('synthetic-cabinets.csv', cabinetCsv, 'polyboard-cabinets-7/v1');
  const p = await report('synthetic-parts.csv', cuttingCsv, 'polyboard-cutting-18/v1');
  await page.goto(`/projects/${id}`); await page.getByRole('tab', { name: 'Technical model', exact: true }).click();
  await page.getByText('Create from CSV reports', { exact: true }).click();
  await page.getByLabel('Cabinet import report').selectOption(c); await page.getByLabel('Cutting import report').selectOption(p);
  await page.getByRole('button', { name: 'Create review version' }).click();
  await expect(page.getByText('21 cabinets · 216 part rows · 280 units · 8 materials', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Synthetic cabinet 1', exact: true }).click();
  await expect(page.getByLabel('Filter parts by cabinet')).not.toHaveValue('');
  await page.getByText('Raw / provenance', { exact: true }).first().click(); await expect(page.getByText('Column 10 (unmapped): -1', { exact: false }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Materials', exact: true }).click(); await expect(page.locator('.technical-review > .table-wrap tbody tr')).toHaveCount(8);
  await page.getByRole('tab', { name: 'Import issues / unmapped data', exact: true }).click(); await expect(page.getByText('UNMAPPED_MANUFACTURING_FIELDS', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show ambiguous / unmapped parts' }).click(); await expect(page.getByText('No parts in this selection.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create review version' }).click(); await expect(page.getByLabel('Normalized version').locator('option')).toHaveCount(2);
  await page.reload(); await page.getByRole('tab', { name: 'Technical model', exact: true }).click(); await expect(page.getByText('21 cabinets · 216 part rows · 280 units · 8 materials', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Materials', exact: true }).click(); await page.screenshot({ path: 'test-results/technical-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await expect.poll(async () => { const b = await page.locator('.sidebar').boundingBox(); return Math.round((b?.x ?? 0) + (b?.width ?? 0)); }).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/technical-mobile.png', fullPage: true });
  const detail = await page.request.get(`/api/projects/${id}`); expect((await detail.json()).versions).toHaveLength(2);
  expect(errors).toEqual([]);
});
