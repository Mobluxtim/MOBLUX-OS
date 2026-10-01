import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {buildServer} from '../../apps/api/server.js';
import {pool} from '../../packages/infrastructure/db.js';
import type {MachiningReport} from '../../packages/contracts/machining.js';
test('real machining import: S3 integrity, immutable/idempotent reports, exact links, permissions and unchanged previous BOMs',{skip:!process.env.MOBLUX_REAL_MODEL_ID},async()=>{
 const app=buildServer(),owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
 try{
  const model=(await owner.query('select * from technical_models where id=$1',[process.env.MOBLUX_REAL_MODEL_ID])).rows[0];assert.ok(model);
  const headers:Record<string,string>={origin:process.env.APP_ORIGIN!};const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}});assert.equal(login.statusCode,200);headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;
  const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();const base=`/api/projects/${model.project_id}/technical-models/${model.id}`;
  const before=(await app.inject({method:'GET',url:base,headers})).json();const histories=await Promise.all(['material-resolution','optimization','hardware'].map(async s=>(await app.inject({method:'GET',url:`${base}/${s}`,headers})).json()));
  const run=()=>app.inject({method:'POST',url:`${base}/machining`,headers});const first=await run();assert.equal(first.statusCode,200,first.body);
  const rows=first.json<MachiningReport[]>(),report=rows.find(r=>r.status==='IMPORTED')!;assert.ok(report,JSON.stringify(rows));const r=report.result!;
  assert.equal(report.versionId,model.version_id);assert.equal(r.totals.drillingGroups,555);assert.equal(r.totals.drawingDrillCount,3467);assert.equal(r.totals.quantityExtendedDrillCount,3774);assert.equal(r.parts.length,216);assert.equal(r.linkedParts,213);assert.equal(r.unresolvedParts,3);assert.equal(r.cabinets.length,22);assert.equal(r.cabinets.filter(c=>c.cabinetId).length,21);assert.equal(r.cabinets.reduce((n,c)=>n+c.totals.drawingDrillCount,0),3467);
  assert.ok(r.parts.filter(p=>p.linkStatus==='LINKED').every(p=>p.csvEvidence&&p.partId&&p.cabinetId));assert.equal(r.parts.filter(p=>p.issues.length).length,5);
  assert.ok(!first.body.includes('lei')&&!first.body.includes('sourceUnitPrice'));assert.ok(rows.some(r=>r.status==='UNSUPPORTED'));
  for(const response of await Promise.all([run(),run()]))assert.deepEqual(response.json(),rows);
  assert.deepEqual((await app.inject({method:'GET',url:`${base}/machining`,headers})).json(),rows);
  assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='machining_bom.import.assessed'",[report.id])).rows[0].n,1);
  await assert.rejects(owner.query('update machining_bom_reports set finding=$1 where id=$2',['edit',report.id]),/immutable/i);
  await assert.rejects(owner.query('insert into machining_bom_reports(model_id,version_id,source_id,source_hash,parser_version,status,created_by) values($1,$2,$3,$4,$5,$6,$7)',[model.id,model.base_version_id,report.sourceId,report.sourceHash,'bad-ancestry','FAILED',user.id]),/ancestry/i);
  const corrupt=structuredClone(r);corrupt.parts.find(p=>p.partId)!.partId=randomUUID();
  await assert.rejects(owner.query('insert into machining_bom_reports(model_id,version_id,source_id,source_hash,parser_version,status,result,created_by) values($1,$2,$3,$4,$5,$6,$7,$8)',[model.id,model.version_id,report.sourceId,report.sourceHash,'bad-part','IMPORTED',JSON.stringify(corrupt),user.id]),/ancestry/i);
  for(const capability of ['project.import','project.files.download']){
   await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,capability]);try{assert.equal((await run()).statusCode,403);assert.equal((await app.inject({method:'GET',url:`${base}/machining`,headers})).statusCode,403);}finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,capability]);}
  }
  assert.equal((await app.inject({method:'POST',url:`${base}/machining`,headers:{cookie:headers.cookie}})).statusCode,403);assert.equal((await app.inject({method:'GET',url:`${base.replace(model.project_id,randomUUID())}/machining`,headers})).statusCode,404);
  assert.deepEqual((await app.inject({method:'GET',url:base,headers})).json(),before);assert.deepEqual(await Promise.all(['material-resolution','optimization','hardware'].map(async s=>(await app.inject({method:'GET',url:`${base}/${s}`,headers})).json())),histories);
  const counts=(await owner.query('select (select count(*)::int from cabinets where version_id=$1) cabinets,count(*)::int rows,sum((data->>\'quantity\')::int)::int units,count(distinct material_id)::int materials from parts where version_id=$1',[model.version_id])).rows[0];assert.deepEqual(counts,{cabinets:21,rows:216,units:280,materials:8});
  console.log('Machining real fixture: 555 groups, 3467 drawing / 3774 quantity-extended holes; 50 grooves; 213 exact links, 3 unmapped; 2 coordinate discrepancies.');
 }finally{await app.close();await owner.end();await pool.end();}
});
