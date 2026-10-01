import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
test('technical costing separates reference prices, versions configured rates and preserves immutable partial history',async({page})=>{
 test.skip(!existsSync('.local/costing-test-project.json'),'Run the isolated costing integration fixture first.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // Optional isolated API lets this test reuse an existing web dev server without restarting it.
 if(process.env.MOBLUX_TEST_API_ORIGIN)await page.route('**/api/**',async route=>{const original=new URL(route.request().url());const response=await route.fetch({url:process.env.MOBLUX_TEST_API_ORIGIN+original.pathname+original.search});await route.fulfill({response});});
 const fixture=JSON.parse(await readFile('.local/costing-test-project.json','utf8')) as {projectId:string;modelId:string};
 await page.goto('/login');await page.getByLabel('Development access code').fill(process.env.DEV_LOGIN_CODE!);await page.getByRole('button',{name:'Open workspace'}).click();await expect(page.getByRole('heading',{name:'Make room for good work.'})).toBeVisible();
 await page.goto(`/projects/${fixture.projectId}`);const section=page.getByRole('region',{name:'Costing / Technical cost',exact:true});
 await expect(section.locator('.costing-total').first()).toContainText('NOT COSTED / INCOMPLETE');
 const state=await page.evaluate(async url=>(await fetch(url)).json(),`/api/projects/${fixture.projectId}/technical-models/${fixture.modelId}/costing`);
 const historyCount=state.history.length+1;const nextRate=state.rules.rules.rates.find((r:{category:string})=>r.category==='HARDWARE').rate==='0.50'?'0.75':'0.50';const expectedSubtotal=nextRate==='0.75'?'2.25':'1.50';
 await expect(section.locator('.costing-total').first()).toContainText(`Known subtotal: ${state.preview.knownSubtotal} RON`);
 await section.getByText('Configure technical rates',{exact:true}).click();await section.getByRole('textbox',{name:/^Rate \d+: HARDWARE /}).fill(nextRate);await section.getByLabel('Rate change reason').fill('[TEST ONLY] Browser verification synthetic rate');
 await section.getByRole('button',{name:'Save new cost rule version',exact:true}).click();await expect(section.locator('.costing-total').first()).toContainText(`Known subtotal: ${expectedSubtotal} RON`);
 await section.getByRole('button',{name:'Save immutable CostingRun',exact:true}).click();await expect(section.getByText(`Costing history (${historyCount})`,{exact:true})).toBeVisible();
 await section.getByRole('button',{name:'Save immutable CostingRun',exact:true}).click();await expect(section.getByText(`Costing history (${historyCount})`,{exact:true})).toBeVisible();
 await section.locator('summary').filter({hasText:/^Calculated lines and evidence/}).first().click();
 const hardware=section.getByRole('row').filter({hasText:'SYNTHETIC hardware'}).first();await hardware.getByText('Cost line provenance',{exact:true}).click();await expect(hardware.getByText(/SOURCE \/ REFERENCE ONLY — unit: 999.00/)).toBeVisible();
 await section.getByText(`Costing history (${historyCount})`,{exact:true}).click();const history=section.getByText(`Costing history (${historyCount})`,{exact:true}).locator('..');await history.locator(':scope > details > summary').last().click();await expect(history.getByText(/Known subtotal: 0.38 RON/)).toBeVisible();
 await section.getByText(`Costing history (${historyCount})`,{exact:true}).click();await section.locator('summary').filter({hasText:/^Calculated lines and evidence/}).first().click();await section.getByText('Configure technical rates',{exact:true}).click();
 await section.screenshot({path:'test-results/costing-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await section.screenshot({path:'test-results/costing-mobile.png'});
 expect(errors).toEqual([]);
});
