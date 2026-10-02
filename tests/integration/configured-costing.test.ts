import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {buildServer} from '../../apps/api/server.js';
import {pool} from '../../packages/infrastructure/db.js';
import type {CostConfiguration,CostState,CostRuleVersion,CostRun} from '../../packages/contracts/costing.js';
import {calculateConfiguredCosts} from '../../packages/modules/costing/configured-calculator.js';
import {calculateCosts} from '../../packages/modules/costing/calculator.js';
import {add} from '../../packages/modules/costing/decimal.js';
import {costSources} from '../fixtures/costing.js';
test('configured rules and overrides persist with ancestry, immutable history, idempotency and permissions',async()=>{
 const app=buildServer(),owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
 const headers:Record<string,string>={origin:process.env.APP_ORIGIN!};
 try{
  const fixture=JSON.parse(await readFile('.local/costing-test-project.json','utf8')) as {projectId:string;modelId:string};
  const project=(await owner.query('select name from projects where id=$1',[fixture.projectId])).rows[0];assert.ok(project.name.startsWith('[TEST]'),'Never apply test rates to a real project');
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}});assert.equal(login.statusCode,200);headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;
  const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();
  // Existing isolated synthetic project only; the source remains explicitly TEST evidence.
  const hw=(await owner.query('select * from hardware_bom_reports where model_id=$1 limit 1',[fixture.modelId])).rows[0];
  const testMachining=costSources().machining!.result;const part=(await owner.query('select * from parts where version_id=$1 limit 1',[hw.version_id])).rows[0];
  testMachining.parts[0].partId=part.id;testMachining.parts[0].cabinetId=part.cabinet_id;testMachining.parts[0].csvEvidence={sourceId:part.source_id,reportId:part.report_id,row:part.source_row,line:part.source_line};
  await owner.query('insert into machining_bom_reports(model_id,version_id,source_id,source_hash,parser_version,status,result,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing',[fixture.modelId,hw.version_id,hw.source_id,hw.source_hash,'synthetic-configured-costing-test/v1','IMPORTED',JSON.stringify(testMachining),user.id]);
  const url=`/api/projects/${fixture.projectId}/technical-models/${fixture.modelId}/costing`;
  async function post(path:string,payload:unknown){const r=await app.inject({method:'POST',url:url+path,headers,payload:payload as object});assert.ok(r.statusCode<300,r.body);return r.json();}
  const state=async()=>{const r=await app.inject({method:'GET',url,headers});assert.equal(r.statusCode,200,r.body);return r.json<CostState>();};
  const initial=await state(),history=structuredClone(initial.history);
  const hardware=initial.preview.lines.find(l=>l.category==='HARDWARE')!;
  const configuration:CostConfiguration={version:1,glass:[],doubling:[],edges:[],cutting:{mode:'EXTERNAL',externalUnit:'service',externalQuantity:null,evidence:'TEST external scope; quantity intentionally missing'},families:[],workstations:[{name:'TEST future workstation',purchaseCost:null,usefulLifeYears:null,productiveHoursPerYear:null,laborPerHour:null,energyPerHour:null,toolingPerHour:null,maintenancePerYear:null,allocatedOverheadPerYear:null}]};
  const payload={requestId:randomUUID(),previousId:initial.rules?.id??null,rules:{currency:'RON',panelBasis:'SHEETS',reason:'TEST configurable rules verification',rates:[{key:hardware.key,category:hardware.category,unit:hardware.unit,rate:'0.125'}],configuration}};
  const rule=await post('/rules',payload) as CostRuleVersion;assert.equal((await post('/rules',payload)).id,rule.id);
  const run=await post('/runs',{ruleVersionId:rule.id,inputs:initial.selection}) as CostRun;
  assert.equal(run.result.lines.find(l=>l.category==='HARDWARE')!.subtotal,'0.38');assert.equal(run.result.lines.find(l=>l.category==='CUTTING')!.status,'MISSING_COST_BASIS');assert.equal(run.result.workstations![0].status,'INCOMPLETE / MISSING DATA');
  const override={requestId:randomUUID(),baseRunId:run.id,lineKey:hardware.key,value:'1.234567',reason:'TEST project-only override'};
  const overridden=await post('/overrides',override) as CostRun;const line=overridden.result.lines.find(l=>l.key===hardware.key)!;
  assert.equal(line.status,'MANUAL_OVERRIDE');assert.equal(line.subtotal,'1.23');assert.equal(line.rate,'0.125');assert.equal(line.override!.originalValue,'0.38');assert.equal(line.override!.originalExactValue,'0.375');assert.equal(line.override!.actor,user.id);assert.equal(line.override!.value,'1.234567');assert.deepEqual(overridden.inputs,run.inputs);assert.equal(overridden.versionId,run.versionId);assert.equal(overridden.ruleVersionId,rule.id);
  for(const r of await Promise.all([post('/overrides',override),post('/overrides',override)]))assert.equal(r.id,overridden.id);
  assert.equal((await app.inject({method:'POST',url:url+'/overrides',headers,payload:{...override,value:'9'}})).statusCode,409);
  assert.equal((await app.inject({method:'POST',url:url+'/overrides',headers,payload:{...override,requestId:randomUUID(),baseRunId:randomUUID()}})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url:url+'/overrides',headers,payload:{...override,requestId:randomUUID(),lineKey:'not a line'}})).statusCode,400);
  for(const cap of ['cost.override','project.cost.view']){
   await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,cap]);
   try{const response=await app.inject({method:'POST',url:url+'/overrides',headers,payload:{...override,requestId:randomUUID()}});assert.equal(response.statusCode,403);assert.ok(!response.body.includes('1.234567'));}finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,cap]);}
  }
  assert.equal((await app.inject({method:'POST',url:url+'/overrides',headers:{cookie:headers.cookie},payload:{...override,requestId:randomUUID()}})).statusCode,403);
  await assert.rejects(owner.query('update costing_runs set result=$1 where id=$2',['{}',overridden.id]),/immutable/i);
  const after=await state();assert.deepEqual(after.history.find(r=>r.id===run.id),run);for(const old of history)if(after.history.some(r=>r.id===old.id))assert.deepEqual(after.history.find(r=>r.id===old.id),old);
  assert.equal(after.rules!.rules.rates[0].rate,'0.125');assert.equal((await post('/runs',{ruleVersionId:rule.id,inputs:initial.selection})).id,run.id);
  assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='cost.line.overridden'",[overridden.id])).rows[0].n,1);
  const key=JSON.stringify(['DRILLING',['Gaurire','35','Through'],'hole']);const family={id:'a',name:'TEST',active:true,category:'DRILLING',unit:'hole',memberKeys:[key],rate:null,evidence:'TEST assignment'};
  assert.equal((await app.inject({method:'POST',url:url+'/rules',headers,payload:{...payload,requestId:randomUUID(),previousId:rule.id,rules:{...payload.rules,configuration:{...configuration,families:[family,{...family,id:'b'}]}}}})).statusCode,400);
  if(process.env.MOBLUX_REAL_MODEL_ID){
   const modelId=process.env.MOBLUX_REAL_MODEL_ID;
   const tables=['project_versions','parts','material_requirement_reports','optimization_requirement_reports','hardware_bom_reports','machining_bom_reports'];
   const fingerprint=()=>Promise.all(tables.map(async t=>(await owner.query(`select md5(string_agg(row_to_json(t)::text,'' order by id)) h from ${t} t`)).rows[0].h));const before=await fingerprint();
   const bom=(await owner.query('select b.* from material_requirement_reports b join material_resolution_reports r on r.id=b.resolution_id where r.model_id=$1 order by b.created_at desc limit 1',[modelId])).rows[0];
   const report=async(t:string)=>(await owner.query(`select * from ${t} where model_id=$1 and status='IMPORTED' order by created_at desc limit 1`,[modelId])).rows[0];
   const sources={bom,optimization:await report('optimization_requirement_reports'),hardware:await report('hardware_bom_reports'),machining:await report('machining_bom_reports')};
   const c:CostConfiguration={...configuration,workstations:[],cutting:{mode:'INTERNAL',externalUnit:'service',externalQuantity:null,evidence:''}};
   const targets=calculateCosts(sources,null);for(const category of ['DRILLING','GROOVE','ROUTING'] as const)c.families.push({id:category,name:`TEST ${category}`,category,active:true,unit:category==='DRILLING'?'hole':'m2',memberKeys:targets.lines.filter(l=>l.category===category&&l.quantity!==null).map(l=>l.key),rate:null,evidence:'TEST only, not persisted'});
   const result=calculateConfiguredCosts(sources,{currency:'RON',panelBasis:'SHEETS',reason:'READ ONLY TEST',rates:[],configuration:c});
   assert.equal(bom.result.totals.cabinets,21);assert.equal(bom.result.totals.partRows,216);assert.equal(bom.result.totals.units,280);assert.equal(bom.result.panels.length,8);
   assert.equal(result.lines.filter(l=>l.category==='PANEL'&&l.quantity!==null).reduce((n,l)=>add(n,l.quantity!),'0'),'25');assert.equal(result.lines.find(l=>l.category==='DRILLING')!.quantity,'3774');assert.equal(result.lines.find(l=>l.category==='ROUTING')!.status,'MISSING_COST_BASIS');assert.equal(result.knownSubtotal,null);assert.equal(result.total,null);assert.deepEqual(await fingerprint(),before);
   console.log('Read-only real fixture: 25 sheets; 3774 holes; groove area',result.lines.find(l=>l.category==='GROOVE')!.quantity,'m2; routing area missing; all source fingerprints unchanged.');
  }
 }finally{await app.close();await owner.end();await pool.end();}
});
