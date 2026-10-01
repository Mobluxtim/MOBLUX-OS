import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../apps/api/server.js';
import { pool } from '../../packages/infrastructure/db.js';
import type { OptimizationReport } from '../../packages/contracts/optimization.js';
import { linkOptimization } from '../../packages/modules/projects/optimization.js';
import type { ResolutionReport } from '../../packages/contracts/resolution.js';
test('real OptiCut reports: automatic persistence, source integrity, exact links, idempotency, permissions and immutable history', {skip: !process.env.MOBLUX_REAL_MODEL_ID}, async () => {
  const app=buildServer(), owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
  try {
    const model=(await owner.query('select * from technical_models where id=$1',[process.env.MOBLUX_REAL_MODEL_ID])).rows[0]; assert.ok(model);
    const headers: Record<string,string>={origin:process.env.APP_ORIGIN!};
    const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}}); assert.equal(login.statusCode,200); headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;
    const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();
    const base=`/api/projects/${model.project_id}/technical-models/${model.id}`;
    const resolution=(await app.inject({method:'POST',url:`${base}/material-resolution`,headers})).json<ResolutionReport>();
    const before=(await app.inject({method:'GET',url:base,headers})).json();
    const bomBefore=(await app.inject({method:'GET',url:`${base}/material-resolution`,headers})).json().bom;
    const run=()=>app.inject({method:'POST',url:`${base}/optimization`,headers,payload:{resolutionId:resolution.id}});
    const response=await run(); assert.equal(response.statusCode,200,response.body);
    const reports=response.json<OptimizationReport[]>(), report=reports.find(r=>r.status==='IMPORTED')!; assert.ok(report,JSON.stringify(reports));
    assert.equal(report.sourceHash,'32c912d2bdceadd1d8c407d1d58d21764d1b0c05e73b7e973d9be1a7b3ad765e');
    assert.deepEqual([report.result!.totals.sheets,report.result!.totals.edgeLengthM,report.result!.totals.cuttingLengthM,report.result!.totals.wastePercent,report.result!.totals.placedUnits],[25,'617.69','537.04','18.66',259]);
    assert.equal(report.result!.failed.length,17); assert.equal(report.result!.totals.failedUnits,21);
    assert.ok([...report.result!.panels,...report.result!.edges].every(p=>p.materialMasterId && p.linkStatus==='EXACT_UNIQUE'));
    assert.ok(linkOptimization(report.result!,[]).panels.every(p=>p.materialMasterId===null && p.linkStatus==='UNRESOLVED'));
    assert.ok(linkOptimization(report.result!,[...resolution.results,...resolution.results]).panels.every(p=>p.materialMasterId===null));
    for(const retry of await Promise.all([run(),run()])) assert.deepEqual(retry.json(),reports);
    assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='optimization.import.assessed'",[report.id])).rows[0].n,1);
    assert.deepEqual((await app.inject({method:'GET',url:base,headers})).json(),before);
    assert.deepEqual((await app.inject({method:'GET',url:`${base}/material-resolution`,headers})).json().bom,bomBefore);
    assert.deepEqual([before.cabinets.length,before.parts.length,before.parts.reduce((n:number,p:{data:{quantity:number}})=>n+p.data.quantity,0),before.materials.length],[21,216,280,8]);
    await assert.rejects(owner.query('update optimization_requirement_reports set finding=$1 where id=$2',['changed',report.id]),/immutable/i);
    await assert.rejects(owner.query('insert into optimization_requirement_reports(model_id,source_id,resolution_id,source_hash,parser_version,status,created_by) values($1,$2,$3,$4,$5,$6,$7)',[model.id,report.sourceId,resolution.id,'wrong','invalid-test','FAILED',user.id]),/ancestry/i);
    assert.equal((await app.inject({method:'POST',url:`${base}/optimization`,headers:{cookie:headers.cookie},payload:{resolutionId:resolution.id}})).statusCode,403);
    assert.equal((await app.inject({method:'POST',url:`${base}/optimization`,headers,payload:{resolutionId:randomUUID()}})).statusCode,404);
    assert.equal((await app.inject({method:'GET',url:`${base.replace(model.project_id,randomUUID())}/optimization`,headers})).statusCode,404);
    await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,'project.import']);
    try { assert.equal((await run()).statusCode,403); assert.equal((await app.inject({method:'GET',url:`${base}/optimization`,headers})).statusCode,403); }
    finally { await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,'project.import']); }
    console.log('Real OptiCut: 25 sheets, 617.69 m edge, 537.04 m cutting, 18.66% waste, 259 placed, 21 failed; five panel and four edge links.');
  } finally { await app.close(); await owner.end(); await pool.end(); }
});
