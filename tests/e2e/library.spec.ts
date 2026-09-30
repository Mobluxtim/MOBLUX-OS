import { test, expect } from '@playwright/test';
import { syntheticLibrary } from '../fixtures/library.js';
import { cabinetCsv, cuttingCsv } from '../fixtures/technical-csv.js';

test('library snapshots, raw review and persisted project proposals on desktop/mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/login'); await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!); await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for good work.' })).toBeVisible();
  await page.getByRole('link', { name: 'Material Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'PolyBoard Material Library' })).toBeVisible();
  for (const [category, label] of [['PANEL', 'Panel'], ['EDGE', 'Edge'], ['BAR', 'Bar / Profile']] as const) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.getByLabel('Original library file').setInputFiles({ name: `${category[0]}${category.slice(1).toLowerCase()}.mat-boole`, mimeType: 'application/octet-stream', buffer: syntheticLibrary(category) });
    await page.getByRole('button', { name: 'Stage library snapshot' }).click();
    await expect(page.getByText('1 records', { exact: true })).toBeVisible();
    await page.getByText('Fields / provenance', { exact: true }).click();
    await expect(page.getByText('synthetic/texture.png', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Inspect raw bytes' }).click(); await expect(page.locator('.library-raw')).not.toBeEmpty();
  }
  await page.getByRole('button', { name: 'Stage library snapshot' }).click();
  await expect(page.getByText('Existing snapshot reused; no duplicate records created.')).toBeVisible();
  const headers = { origin: process.env.APP_ORIGIN! };
  const customer = await page.request.post('/api/customers', { headers, data: { name: '[TEST] Library browser customer', email: '', phone: '', address: '' } }); expect(customer.status()).toBe(201);
  const project = await page.request.post('/api/projects', { headers, data: { customerId: (await customer.json()).id, name: '[TEST] Library browser project', description: 'Synthetic fixtures' } }); const projectId = (await project.json()).id;
  const version = await page.request.post(`/api/projects/${projectId}/versions`, { headers, data: { summary: 'Synthetic library browser version', requestId: crypto.randomUUID() } }); const versionId = (await version.json()).id;
  async function report(name: string, content: string, profile: string) {
    const source = await page.request.post(`/api/projects/${projectId}/versions/${versionId}/sources`, { headers: { ...headers, 'idempotency-key': crypto.randomUUID() }, multipart: { file: { name, mimeType: 'text/csv', buffer: Buffer.from(content) } } }); expect(source.status()).toBe(201);
    const r = await page.request.post(`/api/projects/${projectId}/sources/${(await source.json()).id}/csv-imports`, { headers, data: { profile, requestId: crypto.randomUUID() } }); expect(r.status()).toBe(201); return (await r.json()).id;
  }
  const cabinetReportId = await report('synthetic-cabinets.csv', cabinetCsv, 'polyboard-cabinets-7/v1'), partReportId = await report('synthetic-parts.csv', cuttingCsv, 'polyboard-cutting-18/v1');
  const model = await page.request.post(`/api/projects/${projectId}/technical-models`, { headers, data: { cabinetReportId, partReportId, requestId: crypto.randomUUID() } }); expect(model.status()).toBe(201); const modelId = (await model.json()).id;
  const snapshots = (await (await page.request.get('/api/library')).json()) as { id: string; category: string; recordCount: number; hash: string }[];
  await page.reload();
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(projectId);
  await page.getByLabel('Technical version').selectOption(modelId);
  for (const category of ['PANEL', 'EDGE', 'BAR']) await page.getByLabel(`${category} matching snapshot`).selectOption(snapshots.find(s => s.category === category && s.recordCount === 1)!.id);
  await page.getByRole('button', { name: 'Create matching proposals' }).click();
  await expect(page.getByText('EXACT_UNIQUE: 0 · AMBIGUOUS: 0 · NO_MATCH: 7 · REVIEW_REQUIRED: 2', { exact: true })).toBeVisible();
  await page.getByLabel('Match status').selectOption('NO_MATCH'); await expect(page.locator('.library-matches tbody tr')).toHaveCount(7);
  await page.reload(); await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(projectId); await page.getByLabel('Technical version').selectOption(modelId);
  await expect(page.getByText('EXACT_UNIQUE: 0 · AMBIGUOUS: 0 · NO_MATCH: 7 · REVIEW_REQUIRED: 2', { exact: true })).toBeVisible();
  if (process.env.MOBLUX_REAL_MODEL_ID) {
    const projects = await (await page.request.get('/api/projects')).json();
    let realProject = '';
    for (const p of projects) {
      const models = await (await page.request.get(`/api/projects/${p.id}/technical-models`)).json();
      if (models.some((m: { id: string }) => m.id === process.env.MOBLUX_REAL_MODEL_ID)) { realProject = p.id; break; }
    }
    expect(realProject).not.toBe('');
    await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption(realProject); await page.getByLabel('Technical version').selectOption(process.env.MOBLUX_REAL_MODEL_ID);
    await expect(page.getByText('21 cabinets · 216 part rows · 280 units · 8 materials', { exact: true })).toBeVisible();
    await expect(page.getByText('EXACT_UNIQUE: 13 · AMBIGUOUS: 0 · NO_MATCH: 0 · REVIEW_REQUIRED: 0', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Panel', exact: true }).click(); await page.getByRole('combobox', { name: 'Snapshot', exact: true }).selectOption(snapshots.find(s => s.category === 'PANEL' && s.recordCount === 372)!.id);
    await expect(page.getByText('372 records', { exact: true })).toBeVisible();
    await page.getByLabel('Search library records').fill('H1732 ST9 Mesteacan Nisip'); await page.getByText('Fields / provenance', { exact: true }).click();
    await expect(page.getByText('18 mm · CORROBORATED', { exact: true })).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/library-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/library-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
