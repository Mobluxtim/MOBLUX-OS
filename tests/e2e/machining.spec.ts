import {test,expect} from '@playwright/test';
test('project automatically displays machining totals, cabinet/part/coordinate evidence and source exceptions',async({page})=>{
 test.skip(!process.env.MOBLUX_REAL_MODEL_ID,'Requires real project PDF fixture.');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!);await page.getByRole('button',{name:'Open workspace'}).click();await expect(page.getByRole('heading',{name:'Make room for good work.'})).toBeVisible();
 const projects=await(await page.request.get('/api/projects')).json();let id='';for(const p of projects){const models=await(await page.request.get(`/api/projects/${p.id}/technical-models`)).json();if(models.some((m:{id:string})=>m.id===process.env.MOBLUX_REAL_MODEL_ID)){id=p.id;break;}}expect(id).not.toBe('');
 await page.goto(`/projects/${id}`);const section=page.getByRole('region',{name:'Machining / Operations BOM',exact:true});
 await expect(section.locator('.machining-totals')).toHaveText('555 drilling groups · 3467 drawing holes · 3774 quantity-extended holes',{timeout:20000});
 await expect(section.getByText('50 explicit grooves · 50.67 m drawing groove length',{exact:true})).toBeVisible();await expect(section.getByText(/213\/216 exact part links · 3 unresolved/)).toBeVisible();await expect(section.getByText(/Frezare \/ Frezare: 48.17 m/)).toBeVisible();
 await section.getByText('Cabinet / Part operations (22 source groups)',{exact:true}).click();
 await section.locator('summary').filter({hasText:/^Acvariu jos ·/}).click();await section.locator('summary').filter({hasText:/^1 - Sus ·/}).first().click();
 await expect(section.getByRole('cell',{name:'Gaurire A',exact:true}).first()).toBeVisible();await section.getByText('Coordinates / source',{exact:true}).first().click();await expect(section.getByText(/^Legend: page 11, row 8\./)).toBeVisible();
 await section.locator('summary').filter({hasText:/^Acvariu sus ·/}).click();await section.locator('summary').filter({hasText:/^4 - Spate ·/}).first().click();await expect(section.getByText('Label I: printed count 3, coordinate annotations 6; printed count retained.',{exact:true})).toBeVisible();
 await section.locator('summary').filter({hasText:/^Paneluri izolate ·/}).click();await expect(section.locator('summary').filter({hasText:/^1 - Blat\[1\].*UNMAPPED/})).toBeVisible();
 await section.getByText('Machining report provenance',{exact:true}).click();await expect(section.getByText(/Parser: polyboard-8.02c-ro-machining-pdf\/v1/)).toBeVisible();
 await expect(page.locator('.hardware-totals')).toContainText('698');await expect(page.locator('.bom-totals')).toContainText('126.46 m²');await expect(page.locator('.optimization-totals')).toContainText('25 required sheets');
 await section.getByText('Cabinet / Part operations (22 source groups)',{exact:true}).click();await section.screenshot({path:'test-results/machining-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.screenshot({path:'test-results/machining-mobile.png'});expect(errors).toEqual([]);
});

