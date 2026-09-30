import { test, expect } from '@playwright/test';

test('project automatically resolves current materials and shows only exceptions', async ({ page }) => {
  test.skip(!process.env.MOBLUX_REAL_MODEL_ID, 'Requires the existing real technical model and staged libraries.');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/login'); await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!); await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for good work.' })).toBeVisible();
  const snapshots = await (await page.request.get('/api/library')).json() as { id: string; category: string; recordCount: number; parserVersion: string }[];
  const selected: Record<string, string> = {};
  // Administrative configuration already exists; normal project use never visits library UI.
  const active = (await (await page.request.get('/api/library/active')).json()).active as { category: string; snapshotId: string }[];
  for (const category of ['PANEL', 'EDGE', 'BAR']) selected[category] = active.find(a => a.category === category)!.snapshotId;
  const visited: string[] = [], commands: string[] = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname); });
  page.on('request', request => { if (request.method() === 'POST') commands.push(new URL(request.url()).pathname); });
  const projects = await (await page.request.get('/api/projects')).json(); let projectId = '';
  for (const p of projects) {
    const models = await (await page.request.get(`/api/projects/${p.id}/technical-models`)).json();
    if (models.some((m: { id: string }) => m.id === process.env.MOBLUX_REAL_MODEL_ID)) { projectId = p.id; break; }
  }
  expect(projectId).not.toBe('');
  await page.goto(`/projects/${projectId}`); await page.getByRole('tab', { name: 'Technical model', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Normalized version', exact: true })).toHaveValue(process.env.MOBLUX_REAL_MODEL_ID!);
  await expect(page.getByRole('heading', { name: 'Materials resolved: 13/13', exact: true })).toBeVisible();
  const area = page.getByRole('region', { name: 'Automatic material resolution' });
  await expect(area.getByText('No material exceptions require attention.')).toBeVisible();
  await expect(area.locator('.material-exceptions table')).toHaveCount(0);
  await expect(page.locator('.model-totals')).toHaveText('21 cabinets · 216 part rows · 280 units · 8 materials');
  const endpoint = `/api/projects/${projectId}/technical-models/${process.env.MOBLUX_REAL_MODEL_ID}/material-resolution`;
  const initial = await (await page.request.get(endpoint)).json();
  const bom = page.getByRole('region', { name: 'Automatic material requirements' });
  await expect(bom.getByRole('heading', { name: 'Material requirements / BOM' })).toBeVisible();
  await expect(bom.locator('.bom-totals')).toContainText('280 panel units');
  await expect(bom.locator('tbody tr')).toHaveCount(13);
  expect(initial.bom.result.panels).toHaveLength(8); expect(initial.bom.result.edges).toHaveLength(5);
  expect(initial.bom.result.edges.every((e: { lengthM: null }) => e.lengthM === null)).toBe(true);
  await bom.getByText(/^Panel sources/).first().click();
  await expect(bom.getByText(/Contribution:/).first()).toBeVisible();
  await bom.getByText(/^Panel sources/).first().click();

  await expect(area.getByRole('button', { name: 'Refresh material resolution' })).toBeEnabled();
  expect((await (await page.request.get(endpoint)).json()).current.id).toBe(initial.current.id);
  // Change only active configuration; original project and previous reports stay untouched.
  const synthetic = snapshots.find(s => s.category === 'PANEL' && s.recordCount === 1 && s.parserVersion === 'polyboard-library-observed/v1')!;
  const headers = { origin: process.env.APP_ORIGIN! };
  const change = await page.request.post('/api/library/active', { headers, data: { category: 'PANEL', snapshotId: synthetic.id, reason: '[TEST] Exercise project exceptions' } }); expect(change.status()).toBe(200);
  try {
  
    await expect(page.getByRole('heading', { name: 'Materials resolved: 5/13', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(area.locator('.material-exceptions tbody tr')).toHaveCount(8);
    await expect(area.getByText('8 unresolved · 0 ambiguous · 8 unmatched · 0 review required', { exact: true })).toBeVisible();
  } finally {
    await page.request.post('/api/library/active', { headers, data: { category: 'PANEL', snapshotId: selected.PANEL, reason: 'Restore verified current Panel library after browser check' } });
  }
  await page.reload(); await page.getByRole('tab', { name: 'Technical model', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Materials resolved: 13/13', exact: true })).toBeVisible();
  expect((await (await page.request.get(endpoint)).json()).current.id).toBe(initial.current.id);
  await area.getByText('Resolution evidence and history', { exact: true }).click(); await expect(area.getByText('Active snapshots used at resolution:')).toBeVisible();
  await page.screenshot({ path: 'test-results/material-resolution-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/material-resolution-mobile.png', fullPage: true });
  expect(visited).not.toContain('/library');
  expect(commands.some(p => p.includes('library-matches') || p === '/api/library/active')).toBe(false);
  expect(errors).toEqual([]);
});
