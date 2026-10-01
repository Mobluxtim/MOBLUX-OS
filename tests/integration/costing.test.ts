import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import pg from 'pg';
import {buildServer} from '../../apps/api/server.js';
import {pool} from '../../packages/infrastructure/db.js';
import {costSources} from '../fixtures/costing.js';
import type {CostState,CostRuleVersion,CostRun} from '../../packages/contracts/costing.js';
import {calculateCosts} from '../../packages/modules/costing/calculator.js';
import {add} from '../../packages/modules/costing/decimal.js';

test('costing persistence, exact inputs, immutable history, authorization and read-only real fixture',async()=>{
 const app=buildServer(),owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
 const headers:Record<string,string>={origin:process.env.APP_ORIGIN!};
 try{
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}});assert.equal(login.statusCode,200);headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;
  const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();
  async function post(url:string,payload:unknown){const r=await app.inject({method:'POST',url,headers,payload:payload as object});assert.ok(r.statusCode<300,r.body);return r.json();}
  const c=await post('/api/customers',{name:'[TEST] Costing foundation',email:'',phone:'',address:''}),p=await post('/api/projects',{customerId:c.id,name:'[TEST] Costing foundation',description:'Synthetic quantities and test rates; not business data'}),v=await post(`/api/projects/${p.id}/versions`,{summary:'SYNTHETIC costing source',requestId:randomUUID()});
  async function csv(name:string,data:string,profile:string){const boundary='cost-test';const r=await app.inject({method:'POST',url:`/api/projects/${p.id}/versions/${v.id}/sources`,headers:{...headers,'idempotency-key':randomUUID(),'content-type':`multipart/form-data; boundary=${boundary}`},payload:Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${data}\r\n--${boundary}--\r\n`)});assert.equal(r.statusCode,201,r.body);return {source:r.json(),report:await post(`/api/projects/${p.id}/sources/${r.json().id}/csv-imports`,{profile,requestId:randomUUID()})};}
  const cab=await csv('test-cabinets.csv','SYNTHETIC;1;700;500;400;0;0','polyboard-cabinets-7/v1');
  const part=await csv('test-parts.csv','1;SYNTHETIC;SYNTHETIC;part;100;200;1;SYNTHETIC panel;18;-1;;;;;;;;','polyboard-cutting-18/v1');
  const m=await post(`/api/projects/${p.id}/technical-models`,{cabinetReportId:cab.report.id,partReportId:part.report.id,requestId:randomUUID()});
  const model=(await owner.query('select * from technical_models where id=$1',[m.id])).rows[0];
  // Controlled synthetic report bypasses parsing only in this isolated persistence fixture.
  // It is explicitly marked synthetic; no real BOM or project receives test rates.
  const sourceHash=(await owner.query('select hash from source_files where id=$1',[part.source.id])).rows[0].hash;
  await owner.query('insert into hardware_bom_reports(model_id,version_id,source_id,source_hash,parser_version,status,result,created_by) values($1,$2,$3,$4,$5,$6,$7,$8)',[m.id,model.version_id,part.source.id,sourceHash,'synthetic-costing-test/v1','IMPORTED',JSON.stringify(costSources().hardware!.result),user.id]);
  const url=`/api/projects/${p.id}/technical-models/${m.id}/costing`;
  const state=async()=>{const r=await app.inject({method:'GET',url,headers});assert.equal(r.statusCode,200,r.body);return r.json<CostState>();};
  const initial=await state();assert.equal(initial.rules,null);assert.equal(initial.preview.total,null);assert.equal(initial.preview.knownSubtotal,null);
  const line=initial.preview.lines.find(l=>l.category==='HARDWARE')!;
  const payload={requestId:randomUUID(),previousId:null as string|null,rules:{currency:'RON',panelBasis:'NET_M2',reason:'[TEST ONLY] Synthetic rate',rates:[{key:line.key,category:line.category,unit:line.unit,rate:'0.125'}]}};
  const rule=await post(`${url}/rules`,payload) as CostRuleVersion;assert.equal((await post(`${url}/rules`,payload)).id,rule.id);
  assert.equal((await app.inject({method:'POST',url:`${url}/rules`,headers,payload:{...payload,rules:{...payload.rules,reason:'different payload'}}})).statusCode,409);
  const inputs=initial.selection,run=await post(`${url}/runs`,{ruleVersionId:rule.id,inputs}) as CostRun;
  assert.equal(run.result.lines.find(l=>l.category==='HARDWARE')!.subtotal,'0.38');assert.equal(run.result.total,null);assert.equal(run.result.knownSubtotal,'0.38');assert.equal(run.versionId,model.version_id);assert.deepEqual(run.inputs,inputs);
  for(const r of await Promise.all([post(`${url}/runs`,{ruleVersionId:rule.id,inputs}),post(`${url}/runs`,{ruleVersionId:rule.id,inputs})]))assert.equal(r.id,run.id);
  const rule2=await post(`${url}/rules`,{...payload,requestId:randomUUID(),previousId:rule.id,rules:{...payload.rules,rates:[{...payload.rules.rates[0],rate:'0.25'}]}}) as CostRuleVersion;
  const run2=await post(`${url}/runs`,{ruleVersionId:rule2.id,inputs}) as CostRun;assert.equal(run2.result.knownSubtotal,'0.75');assert.notEqual(run.id,run2.id);
  assert.deepEqual((await state()).history.find(r=>r.id===run.id),run);
  assert.equal((await app.inject({method:'POST',url:`${url}/rules`,headers,payload:{...payload,requestId:randomUUID()}})).statusCode,409);
  await assert.rejects(owner.query('update costing_runs set result=$1 where id=$2',['{}',run.id]),/immutable/i);await assert.rejects(owner.query('delete from cost_rule_versions where id=$1',[rule.id]),/immutable/i);
  await assert.rejects(owner.query('insert into costing_runs(project_id,model_id,version_id,rule_version_id,inputs,input_key,algorithm_version,result,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[p.id,m.id,v.id,rule.id,JSON.stringify(inputs),'bad','test','{}',user.id]),/ancestry/i);
  assert.equal((await app.inject({method:'POST',url:`${url}/runs`,headers,payload:{ruleVersionId:rule.id,inputs:{...inputs,hardwareId:randomUUID()}}})).statusCode,409);
  for(const cap of ['project.cost.view','cost.configure','cost.calculate']){
   await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,cap]);
   try{const target=cap==='project.cost.view'?'':cap==='cost.configure'?'/rules':'/runs';const r=await app.inject({method:target?'POST':'GET',url:url+target,headers,...(target?{payload:target==='/rules'?{...payload,requestId:randomUUID(),previousId:rule2.id}:{ruleVersionId:rule2.id,inputs}}:{})});assert.equal(r.statusCode,403);assert.ok(!r.body.includes('0.125')&&!r.body.includes('999.00'));}
   finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,cap]);}
  }
  assert.equal((await app.inject({method:'POST',url:`${url}/runs`,headers:{cookie:headers.cookie},payload:{ruleVersionId:rule2.id,inputs}})).statusCode,403);
  assert.equal((await app.inject({method:'GET',url:url.replace(p.id,randomUUID()),headers})).statusCode,404);
  assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='cost.run.calculated'",[run.id])).rows[0].n,1);
  await writeFile('.local/costing-test-project.json',JSON.stringify({projectId:p.id,modelId:m.id}));
  if(process.env.MOBLUX_REAL_MODEL_ID){
   const real=(await owner.query('select * from technical_models where id=$1',[process.env.MOBLUX_REAL_MODEL_ID])).rows[0];
   const tables=['project_versions','parts','material_requirement_reports','optimization_requirement_reports','hardware_bom_reports','machining_bom_reports'];
   const fingerprint=()=>Promise.all(tables.map(async t=>(await owner.query(`select md5(string_agg(row_to_json(t)::text,'' order by id)) h from ${t} t`)).rows[0].h));const before=await fingerprint();
   const bom=(await owner.query('select b.* from material_requirement_reports b join material_resolution_reports r on r.id=b.resolution_id where r.model_id=$1 order by b.created_at desc limit 1',[real.id])).rows[0];
   const report=async(t:string)=>(await owner.query(`select * from ${t} where model_id=$1 and status='IMPORTED' limit 1`,[real.id])).rows[0];
   const sources={bom,optimization:await report('optimization_requirement_reports'),hardware:await report('hardware_bom_reports'),machining:await report('machining_bom_reports')};
   const missing=calculateCosts(sources,null);assert.equal(missing.knownSubtotal,null);assert.ok(missing.lines.every(l=>l.rate===null));
   const testRates=missing.lines.filter(l=>['CUTTING','DRILLING','GROOVE','ROUTING'].includes(l.category)).map(l=>({key:l.key,category:l.category,unit:l.unit,rate:l.category==='CUTTING'?'0.1':l.category==='DRILLING'?'0.01':l.category==='GROOVE'?'2':'3'}));
   const computed=calculateCosts(sources,{currency:'RON',panelBasis:'NET_M2',reason:'TEST ONLY — not stored',rates:testRates});
   const sums=(c:string)=>computed.lines.filter(l=>l.category===c).reduce((n,l)=>add(n,l.quantity!), '0');
   assert.equal(sums('PANEL'),'126.46318129');assert.equal(sums('DRILLING'),'3774');assert.equal(sums('GROOVE'),'50.671');assert.equal(sums('ROUTING'),'48.17');assert.equal(sums('CUTTING'),'537.04');
   assert.equal(computed.categories.find(c=>c.category==='CUTTING')!.subtotal,'53.70');assert.equal(computed.categories.find(c=>c.category==='DRILLING')!.subtotal,'37.74');assert.equal(computed.total,null);assert.ok(computed.coverageIssues.some(i=>i.includes('21')));
   assert.deepEqual(await fingerprint(),before);console.log('Real fixture (test rates only, not saved): cutting 53.70; drilling 37.74; groove',computed.categories.find(c=>c.category==='GROOVE')!.subtotal,'routing 144.51. All real rates remain absent.');
  }
 }finally{await app.close();await owner.end();await pool.end();}
});
