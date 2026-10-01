import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {buildServer} from '../../apps/api/server.js';
import {pool} from '../../packages/infrastructure/db.js';
import type {HardwareReport} from '../../packages/contracts/hardware.js';
test('real Hardware BOM persists separately, is idempotent/immutable and hides reference prices without permission',{skip:!process.env.MOBLUX_REAL_MODEL_ID},async()=>{
  const app=buildServer(),owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
  try{
    const model=(await owner.query('select * from technical_models where id=$1',[process.env.MOBLUX_REAL_MODEL_ID])).rows[0];assert.ok(model);
    const headers:Record<string,string>={origin:process.env.APP_ORIGIN!};const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}});assert.equal(login.statusCode,200);headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;
    const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();const base=`/api/projects/${model.project_id}/technical-models/${model.id}`;
    const before=(await app.inject({method:'GET',url:base,headers})).json();
    const bom=(await app.inject({method:'GET',url:`${base}/material-resolution`,headers})).json().bom;
    const opt=(await app.inject({method:'GET',url:`${base}/optimization`,headers})).json();
    const run=()=>app.inject({method:'POST',url:`${base}/hardware`,headers});const first=await run();assert.equal(first.statusCode,200,first.body);
    const rows=first.json<HardwareReport[]>(),report=rows.find(r=>r.status==='IMPORTED')!;assert.ok(report,JSON.stringify(rows));
    assert.equal(report.versionId,model.version_id);assert.equal(report.result!.itemCount,10);assert.equal(report.result!.quantitySum,698);assert.equal(report.result!.sourceTotalPriceRaw,'3.229,10 lei');
    for(const r of await Promise.all([run(),run()]))assert.deepEqual(r.json(),rows);
    assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='hardware_bom.import.assessed'",[report.id])).rows[0].n,1);
    await assert.rejects(owner.query('update hardware_bom_reports set finding=$1 where id=$2',['edit',report.id]),/immutable/i);
    await assert.rejects(owner.query('insert into hardware_bom_reports(model_id,version_id,source_id,source_hash,parser_version,status,created_by) values($1,$2,$3,$4,$5,$6,$7)',[model.id,model.base_version_id,report.sourceId,report.sourceHash,'bad-ancestry','FAILED',user.id]),/ancestry/i);
    await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,'project.cost.view']);
    try{for(const response of [await run(),await app.inject({method:'GET',url:`${base}/hardware`,headers})]){assert.equal(response.statusCode,200);const r=response.json<HardwareReport[]>().find(r=>r.status==='IMPORTED')!;assert.equal(r.pricesVisible,false);assert.equal(r.result!.quantitySum,698);assert.ok(!response.body.includes('sourceUnitPriceRaw')&&!response.body.includes('sourceTotalPriceRaw')&&!response.body.includes('lei'));}}
    finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,'project.cost.view']);}
    await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,'project.import']);
    try{assert.equal((await run()).statusCode,403);}finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,'project.import']);}
    assert.equal((await app.inject({method:'POST',url:`${base}/hardware`,headers:{cookie:headers.cookie}})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:`${base.replace(model.project_id,randomUUID())}/hardware`,headers})).statusCode,404);
    assert.deepEqual((await app.inject({method:'GET',url:base,headers})).json(),before);
    assert.deepEqual((await app.inject({method:'GET',url:`${base}/material-resolution`,headers})).json().bom,bom);
    assert.deepEqual((await app.inject({method:'GET',url:`${base}/optimization`,headers})).json(),opt);
    console.log('Hardware fixture: 10 exact source rows / 698 quantity; project summary page 9; reference prices protected.');
  }finally{await app.close();await owner.end();await pool.end();}
});
