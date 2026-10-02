import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import pg from 'pg';
import {buildServer} from '../../apps/api/server.js';
import {pool} from '../../packages/infrastructure/db.js';
import {quotePreview} from '../../packages/modules/quotes/service.js';
import {quoteFixture} from '../fixtures/quote.js';
import {presentationFixture} from '../fixtures/presentation.js';
import type {QuoteVersion,ClientQuoteView} from '../../packages/contracts/quote.js';
test('quote revisions preserve exact project/presentation, manual prices without costing, permissions and safe client history',async()=>{
 const app=buildServer(),owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL}),headers:Record<string,string>={origin:process.env.APP_ORIGIN!};
 try{
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}});assert.equal(login.statusCode,200);headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();
  async function post(url:string,payload:unknown){const r=await app.inject({method:'POST',url,headers,payload:payload as object});assert.ok(r.statusCode<300,r.body);return r.json();}
  const customer=await post('/api/customers',{name:'[TEST] Commercial quote',email:'',phone:'',address:''}),project=await post('/api/projects',{customerId:customer.id,name:'[TEST] Quote without costing',description:'INTERNAL_PROJECT_SENTINEL'});
  const v=await post(`/api/projects/${project.id}/versions`,{summary:'INTERNAL_VERSION_SENTINEL',requestId:randomUUID()}),v2=await post(`/api/projects/${project.id}/versions`,{summary:'Later version',requestId:randomUUID()});const base=`/api/projects/${project.id}/versions/${v.id}`,url=base+'/quotes';
  const fingerprint=async()=>(await owner.query('select md5(row_to_json(v)::text) h from project_versions v where id=$1',[v.id])).rows[0].h,before=await fingerprint();
  const pc=presentationFixture(),p1=await post(base+'/presentations',{requestId:randomUUID(),previousId:null,content:pc});
  const content=quoteFixture();content.lines[0].presentationSectionId=pc.sections[0].id;
  const payload={requestId:randomUUID(),previousId:null,presentationRevisionId:p1.id,content},q1=await post(url,payload) as QuoteVersion;assert.equal(q1.result.totals.withVat,'380.82');assert.equal(q1.versionId,v.id);assert.equal((await post(url,payload)).id,q1.id);
  for(const q of await Promise.all([post(url,payload),post(url,payload)]))assert.equal(q.id,q1.id);
  assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,content:{...content,title:'changed'}}})).statusCode,409);
  const path=`${url}/${q1.id}/preview`,response=await app.inject({method:'GET',url:path,headers}),safe=response.json<ClientQuoteView>();assert.equal(response.statusCode,200);assert.equal(safe.presentation!.title,pc.title);assert.equal(safe.lines[0].presentationSection,'Living room');assert.equal(safe.lines.length,2);
  for(const marker of ['SENTINEL','internalNotes','internalNote','calculatedPriceReference','contentHash','algorithmVersion','createdBy','source','snapshot','margin','cost'])assert.ok(!response.body.includes(marker),marker);
  const p2=await post(base+'/presentations',{requestId:randomUUID(),previousId:p1.id,content:{...pc,title:'Later presentation'}});assert.equal((await app.inject({method:'GET',url:path,headers})).json().presentation.title,pc.title);
  const q2=await post(url,{...payload,requestId:randomUUID(),previousId:q1.id,presentationRevisionId:p2.id,content:{...content,vatPercent:'7.5'}}) as QuoteVersion;assert.equal(q2.number,2);assert.equal(q2.result.totals.withVat,'341.15');assert.deepEqual((await app.inject({method:'GET',url:path,headers})).json(),safe);
  const foreignP=await post(base.replace(v.id,v2.id)+'/presentations',{requestId:randomUUID(),previousId:null,content:pc});assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,requestId:randomUUID(),previousId:q2.id,presentationRevisionId:foreignP.id}})).statusCode,400);
  assert.equal((await app.inject({method:'GET',url:path.replace(v.id,v2.id),headers})).statusCode,404);assert.equal((await app.inject({method:'GET',url:path.replace(project.id,randomUUID()),headers})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,requestId:randomUUID(),previousId:q2.id,content:{...content,lines:[{...content.lines[0],presentationSectionId:pc.sections[1].id}]}}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,requestId:randomUUID()}})).statusCode,409);
  await assert.rejects(owner.query('update quote_versions set content=$1 where id=$2',['{}',q1.id]),/immutable/i);await assert.rejects(owner.query('delete from quote_versions where id=$1',[q1.id]),/immutable/i);
  await assert.rejects(owner.query('insert into quote_versions(project_id,version_id,number,previous_id,presentation_revision_id,request_id,payload_hash,content_hash,algorithm_version,content,result,created_by) values($1,$2,3,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[project.id,v.id,q2.id,foreignP.id,randomUUID(),'bad','bad','test',JSON.stringify(content),JSON.stringify(q1.result),user.id]),/ancestry/i);
  for(const cap of ['quote.view','quote.edit','quote.preview','project.cost.view','presentation.preview']){
   await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,cap]);try{const get=await app.inject({method:'GET',url,headers});assert.equal(get.statusCode,cap==='quote.view'?403:200);const preview=await app.inject({method:'GET',url:path,headers});assert.equal(preview.statusCode,['quote.preview','presentation.preview'].includes(cap)?403:200);if(cap==='quote.edit')assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,requestId:randomUUID(),previousId:q2.id}})).statusCode,403);}finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,cap]);}
  }
  assert.equal((await app.inject({method:'GET',url:path})).statusCode,401);assert.equal((await app.inject({method:'POST',url,headers:{cookie:headers.cookie},payload})).statusCode,403);await assert.rejects(quotePreview({id:user.id,kind:'customer',grants:new Set(['project.view','quote.preview']),denies:new Set()},project.id,v.id,q1.id),/permission/i);
  assert.equal(await fingerprint(),before);assert.equal((await owner.query('select count(*)::int n from costing_runs where project_id=$1',[project.id])).rows[0].n,0);assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='quote.versioned'",[q1.id])).rows[0].n,1);
  await writeFile('.local/quote-test-project.json',JSON.stringify({projectId:project.id,versionId:v.id,nextVersionId:v2.id,presentationId:p1.id,quoteId:q1.id}));
 }finally{await app.close();await owner.end();await pool.end();}
});
