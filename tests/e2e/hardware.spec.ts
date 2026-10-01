import {test,expect} from '@playwright/test';
test('project automatically shows exact Feronerie rows and version/source evidence separately from other BOMs',async({page})=>{
  test.skip(!process.env.MOBLUX_REAL_MODEL_ID,'Requires the existing project report fixture.');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/login');await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!);await page.getByRole('button',{name:'Open workspace'}).click();
  await expect(page.getByRole('heading',{name:'Make room for good work.'})).toBeVisible();
  const projects=await(await page.request.get('/api/projects')).json();let id='';
  for(const p of projects){const models=await(await page.request.get(`/api/projects/${p.id}/technical-models`)).json();if(models.some((m:{id:string})=>m.id===process.env.MOBLUX_REAL_MODEL_ID)){id=p.id;break;}}
  expect(id).not.toBe('');await page.goto(`/projects/${id}`);
  const section=page.getByRole('region',{name:'Hardware / Feronerie BOM',exact:true});
  await expect(section.locator('.hardware-totals')).toHaveText('10 source items · 698 total source quantity',{timeout:20000});
  await expect(section.locator('tbody tr')).toHaveCount(10);
  for(const [name,quantity] of [['Hettich/Cam-DU232/Rastex15/p18/2-dowel/interior','334'],['Hettich/hing.Sensys-Inset/TH 52x5.5 mm','12'],['Hettich/hing.Sensys-Overlay/TH 52x5.5 mm','35'],['hole/03','78'],['peg-05/32-5/below/3D','144']]){
    const row=section.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})});await expect(row.getByRole('cell',{name:quantity,exact:true})).toBeVisible();
  }
  await section.getByText('Source row',{exact:true}).first().click();await expect(section.getByText('Source unit price: 1.30',{exact:true})).toBeVisible();
  await section.getByText('Hardware report provenance',{exact:true}).click();await expect(section.getByText(/summary page 9\/288/)).toBeVisible();
  await expect(page.locator('.bom-totals')).toContainText('126.46 m²');await expect(page.locator('.optimization-totals')).toContainText('25 required sheets');
  await section.screenshot({path:'test-results/hardware-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await section.screenshot({path:'test-results/hardware-mobile.png'});expect(errors).toEqual([]);
});
