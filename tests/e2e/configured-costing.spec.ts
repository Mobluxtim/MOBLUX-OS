import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('configured family, exclusive external cutting, workstation and audited project override in the normal project UI',async({page})=>{
 const fixture=JSON.parse(await readFile('.local/costing-test-project.json','utf8')) as {projectId:string;modelId:string};
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.MOBLUX_TEST_API_ORIGIN)await page.route('**/api/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:process.env.MOBLUX_TEST_API_ORIGIN+u.pathname+u.search});await route.fulfill({response});});
 await page.goto('/login');await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!);await page.getByRole('button',{name:'Open workspace'}).click();await expect(page.getByRole('heading',{name:'Make room for good work.'})).toBeVisible();
 await page.goto(`/projects/${fixture.projectId}`);const section=page.getByRole('region',{name:'Costing / Technical cost',exact:true});
 await expect(section.locator('.costing-total').first()).toContainText('NOT COSTED / INCOMPLETE');
 const apiPath=`/api/projects/${fixture.projectId}/technical-models/${fixture.modelId}/costing`;
 const initial=await page.evaluate(async u=>(await fetch(u)).json(),apiPath);
 await section.getByText('Configure technical rates',{exact:true}).click();
 await section.getByRole('combobox',{name:'Cutting mode',exact:true}).selectOption('EXTERNAL');await section.getByLabel('External cutting service quantity',{exact:true}).fill('2');await section.getByLabel('External cutting evidence',{exact:true}).fill('TEST ONLY external service scope');
 await section.getByText('Operation price families',{exact:true}).click();
 // Integration resets configuration to no families before this scenario.
 await section.getByRole('button',{name:'Add price family',exact:true}).click();
 await section.getByLabel('Family name',{exact:true}).fill('TEST explicit drilling');await section.getByLabel('Family configured rate',{exact:true}).fill('2');await section.getByLabel('Family assignment evidence',{exact:true}).fill('TEST source selector, no face inference');await section.getByLabel('Gaurire · Ø8 · depth 11',{exact:true}).check();
 await section.getByLabel('Rate change reason').fill('TEST ONLY browser family and service configuration');await section.getByRole('button',{name:'Save new cost rule version',exact:true}).click();await expect(section.locator('.costing-total').first()).toContainText('Known subtotal: 8.38 RON');
 await section.getByRole('textbox',{name:/^Rate \d+: CUTTING /}).fill('10');await section.getByLabel('Rate change reason').fill('TEST ONLY configured external rate');await section.getByRole('button',{name:'Save new cost rule version',exact:true}).click();await expect(section.locator('.costing-total').first()).toContainText('Known subtotal: 28.38 RON');
 await section.getByRole('button',{name:'Save immutable CostingRun',exact:true}).click();await expect(section.getByText(`Costing history (${initial.history.length+1})`,{exact:true})).toBeVisible();
 await section.getByText(`Costing history (${initial.history.length+1})`,{exact:true}).click();const history=section.locator('summary').filter({hasText:/^Costing history \(/}).locator('..');const run=history.locator(':scope > details').first();await run.locator(':scope > summary').click();
 await run.getByText('Override one project/version line',{exact:true}).click();const key=initial.preview.lines.find((l:{category:string})=>l.category==='HARDWARE').key;
 await run.getByRole('combobox',{name:'Override line',exact:true}).selectOption(key);await run.getByLabel('Manual line amount',{exact:true}).fill('5.5');await run.getByLabel('Override reason (optional)').fill('TEST ONLY project override');await run.getByRole('button',{name:'Save manual override as new run',exact:true}).click();
 await expect(section.getByText(`Costing history (${initial.history.length+2})`,{exact:true})).toBeVisible();const latest=history.locator(':scope > details').first();await latest.locator(':scope > summary').click();await expect(latest.locator('.costing-total')).toContainText('Known subtotal: 33.50 RON');await latest.locator('summary').filter({hasText:/^Calculated lines and evidence/}).click();await expect(latest.getByText(/MANUAL OVERRIDE: 5.50 · replaced 0.38/)).toBeVisible();
 const after=await page.evaluate(async u=>(await fetch(u)).json(),apiPath);expect(after.history[0].result.lines.find((l:{category:string})=>l.category==='HARDWARE').rate).toBe('0.125');expect(after.history[1].result.knownSubtotal).toBe('28.38');expect(after.preview.knownSubtotal).toBe('28.38');expect(after.history[0].result.lines.filter((l:{category:string})=>l.category==='CUTTING')).toHaveLength(1);
 await section.screenshot({path:'test-results/configured-costing-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await section.screenshot({path:'test-results/configured-costing-mobile.png'});expect(errors).toEqual([]);
});
