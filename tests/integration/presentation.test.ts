import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import pg from 'pg';
import {buildServer} from '../../apps/api/server.js';
import {pool} from '../../packages/infrastructure/db.js';
import {readSource} from '../../packages/infrastructure/storage.js';
import {previewPresentation} from '../../packages/modules/presentations/service.js';
import {imageFixture,presentationFixture} from '../fixtures/presentation.js';
import type {PresentationState,ClientPresentationView} from '../../packages/contracts/presentation.js';
test('presentation revisions, private S3 media and client projection enforce exact-version boundaries',async()=>{
 const app=buildServer(),owner=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL}),headers:Record<string,string>={origin:process.env.APP_ORIGIN!};
 try{
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{code:process.env.DEV_LOGIN_CODE}});assert.equal(login.statusCode,200);headers.cookie=`${login.cookies[0].name}=${login.cookies[0].value}`;const user=(await app.inject({method:'GET',url:'/api/me',headers})).json();
  async function post(url:string,payload:unknown){const r=await app.inject({method:'POST',url,headers,payload:payload as object});assert.ok(r.statusCode<300,r.body);return r.json();}
  const customer=await post('/api/customers',{name:'[TEST] Presentation review',email:'',phone:'',address:''}),project=await post('/api/projects',{customerId:customer.id,name:'[TEST] Private technical name',description:'INTERNAL_PROJECT_SENTINEL'});
  const version=await post(`/api/projects/${project.id}/versions`,{summary:'INTERNAL_VERSION_SENTINEL',requestId:randomUUID()}),nextVersion=await post(`/api/projects/${project.id}/versions`,{summary:'Later internal version',requestId:randomUUID()});
  const url=`/api/projects/${project.id}/versions/${version.id}/presentations`,nextUrl=url.replace(version.id,nextVersion.id);
  const fingerprint=async()=>(await owner.query('select md5(row_to_json(v)::text) h from project_versions v where id=$1',[version.id])).rows[0].h,before=await fingerprint();
  const initial=(await app.inject({method:'GET',url,headers})).json<PresentationState>();assert.equal(initial.presentationId,null);
  const bytes=imageFixture();
  async function upload(target=url,requestId=randomUUID(),kind='RENDER',body=bytes,name='private-name.png'){
   const boundary='presentation-test-boundary';const response=await app.inject({method:'POST',url:target+`/media?kind=${kind}&provenance=PRIVATE_PROVENANCE_SENTINEL`,headers:{...headers,'idempotency-key':requestId,'content-type':`multipart/form-data; boundary=${boundary}`},payload:Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),body,Buffer.from(`\r\n--${boundary}--\r\n`)] )});return response;
  }
  const requestId=randomUUID(),uploaded=await upload(url,requestId);assert.equal(uploaded.statusCode,201,uploaded.body);const assetId=uploaded.json().id;assert.equal((await upload(url,requestId)).json().id,assetId);assert.equal((await upload(url,requestId,'REFERENCE_INSPIRATION')).statusCode,409);
  assert.equal((await upload(url,randomUUID(),'RENDER',Buffer.from('%PDF-1.4 '+''.padEnd(100)))).statusCode,400);assert.equal((await upload(url,randomUUID(),'RENDER',bytes,'source.dxf')).statusCode,400);
  const inspiration=(await upload(url,randomUUID(),'REFERENCE_INSPIRATION')).json().id,hidden=(await upload(url,randomUUID(),'TECHNICAL_PRESENTATION')).json().id,foreign=(await upload(nextUrl)).json().id;
  const stored=(await owner.query('select * from presentation_assets where id=$1',[assetId])).rows[0];assert.equal(stored.hash,createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(Buffer.from(await readSource(stored.object_key,stored.object_version)),bytes);
  const content=presentationFixture();content.media=[{assetId,sectionId:null,caption:'Project view',visibility:'CLIENT_PRESENTATION'},{assetId:inspiration,sectionId:null,caption:'Mood reference',visibility:'CLIENT_PRESENTATION'},{assetId:hidden,sectionId:null,caption:'PRIVATE_IMAGE_SENTINEL',visibility:'INTERNAL_ONLY'}];content.coverAssetId=assetId;
  const save={requestId:randomUUID(),previousId:null,content},r1=await post(url,save);assert.equal((await post(url,save)).id,r1.id);
  const previewPath=`${url}/${r1.id}/preview`,response=await app.inject({method:'GET',url:previewPath,headers});assert.equal(response.statusCode,200);const safe=response.json<ClientPresentationView>();assert.equal(safe.title,content.title);assert.equal(safe.versionNumber,1);assert.equal(safe.media.length,2);assert.equal(safe.media[1].kind,'REFERENCE_INSPIRATION');
  for(const forbidden of ['SENTINEL','private-name','createdBy','hash','provenance','snapshot','quantity','rate','cost','objectKey','"reference":','audit'])assert.ok(!response.body.includes(forbidden),forbidden);
  const image=await app.inject({method:'GET',url:safe.media[0].url,headers});assert.equal(image.statusCode,200);assert.equal(image.headers['content-type'],'image/png');assert.ok(!image.rawPayload.includes(Buffer.from('INTERNAL_METADATA_SENTINEL')));assert.equal(image.headers['cache-control'],'no-store');
  assert.equal((await app.inject({method:'GET',url:`${url}/${r1.id}/media/${hidden}`,headers})).statusCode,404);assert.equal((await app.inject({method:'GET',url:`${nextUrl}/${r1.id}/preview`,headers})).statusCode,404);
  for(const bad of [{...content,media:[{...content.media[0],assetId:foreign}],coverAssetId:foreign},{...content,bom:{quantity:280}},{...content,items:[{...content.items[0],kind:'MATERIAL',reference:{kind:'MATERIAL',materialMasterId:randomUUID()}}]}])assert.equal((await app.inject({method:'POST',url,headers,payload:{requestId:randomUUID(),previousId:r1.id,content:bad}})).statusCode,400);
  const changed={...content,title:'Revised client title',media:content.media.map(m=>({...m,visibility:'INTERNAL_ONLY'})),coverAssetId:null};const r2=await post(url,{requestId:randomUUID(),previousId:r1.id,content:changed});assert.equal(r2.number,2);assert.equal((await app.inject({method:'GET',url:`${url}/${r2.id}/preview`,headers})).json().media.length,0);assert.deepEqual((await app.inject({method:'GET',url:previewPath,headers})).json(),safe);
  assert.equal((await app.inject({method:'POST',url,headers,payload:{...save,requestId:randomUUID()}})).statusCode,409);assert.equal((await app.inject({method:'GET',url:nextUrl,headers})).json().revisions.length,0);assert.equal(await fingerprint(),before);
  for(const table of ['client_presentations','presentation_revisions','presentation_assets'])await assert.rejects(owner.query(`delete from ${table} where id=$1`,[table==='client_presentations'?r1.presentationId:table==='presentation_revisions'?r1.id:assetId]),/immutable/i);
  for(const cap of ['presentation.edit','presentation.preview','project.view','project.cost.view','project.files.download']){
   await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)',[user.id,cap]);try{const preview=await app.inject({method:'GET',url:previewPath,headers});assert.equal(preview.statusCode,['presentation.preview','project.view'].includes(cap)?403:200);if(cap==='presentation.edit')assert.equal((await app.inject({method:'GET',url,headers})).statusCode,403);}finally{await owner.query('delete from user_overrides where user_id=$1 and capability=$2',[user.id,cap]);}
  }
  assert.equal((await app.inject({method:'GET',url:previewPath})).statusCode,401);assert.equal((await app.inject({method:'POST',url,headers:{cookie:headers.cookie},payload:save})).statusCode,403);
  await assert.rejects(previewPresentation({id:user.id,kind:'customer',grants:new Set(['project.view','presentation.preview']),denies:new Set()},project.id,version.id,r1.id),/permission/i);
  assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='presentation.revised'",[r1.id])).rows[0].n,1);
  await writeFile('.local/presentation-test-project.json',JSON.stringify({projectId:project.id,versionId:version.id,nextVersionId:nextVersion.id,revisionId:r1.id}));
 }finally{await app.close();await owner.end();await pool.end();}
});
