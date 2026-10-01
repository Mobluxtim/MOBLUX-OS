import { test, expect } from '@playwright/test';
test('normal project shows OptiCut separately from net BOM with failed units and per-material evidence', async ({page}) => {
  test.skip(!process.env.MOBLUX_REAL_MODEL_ID,'Requires existing real model and uploaded OptiCut report.');
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/login'); await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!); await page.getByRole('button',{name:'Open workspace'}).click();
  await expect(page.getByRole('heading',{name:'Make room for good work.'})).toBeVisible();
  const projects=await(await page.request.get('/api/projects')).json(); let projectId='';
  for(const project of projects) {
    const models=await(await page.request.get(`/api/projects/${project.id}/technical-models`)).json();
    if(models.some((m:{id:string})=>m.id===process.env.MOBLUX_REAL_MODEL_ID)){projectId=project.id;break;}
  }
  expect(projectId).not.toBe(''); await page.goto(`/projects/${projectId}`);
  const section=page.getByRole('region',{name:'Material requirements / Optimization',exact:true});
  await expect(section.locator('.optimization-totals')).toHaveText('25 required sheets · 617.69 m edge · 537.04 m cutting · 18.66% waste/scrap · 259 placed units',{timeout:20000});
  await expect(page.locator('.bom-totals')).toContainText('126.46 m²');
  await expect(section.getByText('137.76 m² reported sheet area · 112.05 m² OptiCut part area · 21 failed/unplaced of 280 requested units')).toBeVisible();
  await section.getByText('Cutting maps (13)',{exact:true}).click(); await expect(section.getByText(/Map 4: 1 sheet/)).toBeVisible();
  await section.getByText('Failed / unplaced: 21 units (17 source rows)',{exact:true}).click();
  await expect(section.getByRole('cell').filter({hasText:'Panourile sunt prea ...'})).toBeVisible();
  await expect(section.locator('tbody tr')).toHaveCount(22);
  await section.getByText('Edge-band requirements (4)',{exact:true}).click(); await expect(section.getByText(/369.96 m/)).toBeVisible();
  await page.screenshot({path:'test-results/opticut-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/opticut-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
