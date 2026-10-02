import {createHash,randomUUID} from 'node:crypto';
import {and,desc,eq,sql} from 'drizzle-orm';
import {z} from 'zod';
import {db,type Transaction} from '../../infrastructure/db.js';
import {versions,clientPresentations,presentationRevisions,presentationAssets,technicalModels,materialResolutions,materialMasters,hardwareReports} from '../../../database/schema.js';
import {authorize,DomainError,type Actor} from '../identity/policy.js';
import {record} from '../audit/service.js';
import {preserveSource,readSource} from '../../infrastructure/storage.js';
import {presentationContentSchema,mediaKinds,type PresentationState} from '../../contracts/presentation.js';
import {presentationImage} from './media.js';
import {projectPresentation} from './projection.js';
const hash=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
function access(a:Actor,cap:'presentation.edit'|'presentation.preview'){authorize(a,'project.view');authorize(a,cap);}
async function version(tx:Transaction,projectId:string,versionId:string){const v=await tx.query.versions.findFirst({where:and(eq(versions.id,versionId),eq(versions.projectId,projectId))});if(!v)throw new DomainError(404,'Project version not found.');return v;}
async function references(tx:Transaction,versionId:string){
 const model=await tx.query.technicalModels.findFirst({where:eq(technicalModels.versionId,versionId)});const result:PresentationState['references']=[];if(!model)return result;
 const resolutions=await tx.select().from(materialResolutions).where(eq(materialResolutions.modelId,model.id));
 const ids=new Set(resolutions.flatMap(r=>r.results.map(m=>m.materialMasterId).filter((id):id is string=>!!id)));
 for(const id of ids){const m=await tx.query.materialMasters.findFirst({where:eq(materialMasters.id,id)});if(m)result.push({kind:'MATERIAL',materialMasterId:m.id,label:m.name});}
 const hardware=await tx.select().from(hardwareReports).where(and(eq(hardwareReports.versionId,versionId),eq(hardwareReports.status,'IMPORTED')));
 for(const h of hardware)h.result?.items.forEach((i,itemIndex)=>result.push({kind:'HARDWARE',reportId:h.id,itemIndex,label:i.sourceName}));return result;
}
export async function presentationState(a:Actor,projectId:string,versionId:string){
 access(a,'presentation.edit');return db.transaction(async tx=>{
  const v=await version(tx,projectId,versionId),p=await tx.query.clientPresentations.findFirst({where:eq(clientPresentations.versionId,versionId)});
  const revisions=p?await tx.select().from(presentationRevisions).where(eq(presentationRevisions.presentationId,p.id)).orderBy(desc(presentationRevisions.number)).limit(50):[];
  const assets=await tx.select({id:presentationAssets.id,kind:presentationAssets.kind,name:presentationAssets.name,hash:presentationAssets.hash,displayHash:presentationAssets.displayHash,mime:presentationAssets.mime,size:presentationAssets.size,width:presentationAssets.width,height:presentationAssets.height,provenance:presentationAssets.provenance,createdAt:presentationAssets.createdAt}).from(presentationAssets).where(eq(presentationAssets.versionId,versionId));
  return {presentationId:p?.id??null,versionNumber:v.number,revisions,assets,references:await references(tx,versionId),canEdit:true,canPreview:a.grants.has('presentation.preview')&&!a.denies.has('presentation.preview')};
 });
}
export async function savePresentation(a:Actor,projectId:string,versionId:string,input:unknown){
 access(a,'presentation.edit');const req=z.object({requestId:z.uuid(),previousId:z.uuid().nullable(),content:presentationContentSchema}).strict().parse(input),payloadHash=hash(JSON.stringify({previousId:req.previousId,content:req.content}));
 return db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`presentation:${versionId}`},0))`);await version(tx,projectId,versionId);
  let p=await tx.query.clientPresentations.findFirst({where:eq(clientPresentations.versionId,versionId)});
  if(!p)[p]=await tx.insert(clientPresentations).values({projectId,versionId,createdBy:a.id}).returning();
  const existing=await tx.query.presentationRevisions.findFirst({where:and(eq(presentationRevisions.presentationId,p.id),eq(presentationRevisions.requestId,req.requestId))});if(existing){if(existing.payloadHash!==payloadHash)throw new DomainError(409,'Request was used for different presentation content.');return existing;}
  const previous=await tx.query.presentationRevisions.findFirst({where:eq(presentationRevisions.presentationId,p.id),orderBy:desc(presentationRevisions.number)});if((previous?.id??null)!==req.previousId)throw new DomainError(409,'Presentation changed. Reload before saving another revision.');
  const refs=await references(tx,versionId);
  for(const i of req.content.items){const ref=i.reference;if(ref&&!refs.some(r=>ref.kind==='MATERIAL'?r.kind==='MATERIAL'&&r.materialMasterId===ref.materialMasterId:r.kind==='HARDWARE'&&r.reportId===ref.reportId&&r.itemIndex===ref.itemIndex))throw new DomainError(400,'Technical reference does not belong to this exact version.');}
  for(const m of req.content.media)if(!await tx.query.presentationAssets.findFirst({where:and(eq(presentationAssets.id,m.assetId),eq(presentationAssets.versionId,versionId),eq(presentationAssets.projectId,projectId))}))throw new DomainError(400,'Only presentation media uploaded for this exact version can be attached.');
  const [revision]=await tx.insert(presentationRevisions).values({presentationId:p.id,number:(previous?.number??0)+1,previousId:req.previousId,requestId:req.requestId,payloadHash,contentHash:hash(JSON.stringify(req.content)),content:req.content,createdBy:a.id}).returning();
  await record(tx,a.id,'presentation.revised',revision.id,projectId,{versionId,presentationId:p.id,revisionNumber:revision.number,previousId:req.previousId,contentHash:revision.contentHash});return revision;
 });
}
export async function uploadPresentationMedia(a:Actor,projectId:string,versionId:string,input:unknown,name:string,bytes:Buffer){
 access(a,'presentation.edit');const req=z.object({requestId:z.uuid(),kind:z.enum(mediaKinds),provenance:z.string().trim().max(1000)}).strict().parse(input);
 if(!name||name.length>200||(/[\\/]/.test(name)||[...name].some(c=>c.charCodeAt(0)<32)))throw new DomainError(400,'Invalid image filename.');
 const image=presentationImage(bytes),sourceHash=hash(bytes),displayHash=hash(image.display);
 if(!(image.mime==='image/png'?/\.png$/i:/\.jpe?g$/i).test(name))throw new DomainError(400,'Image extension must match PNG or JPEG content.');
 return db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`presentation-media:${versionId}:${req.requestId}`},0))`);await version(tx,projectId,versionId);
  const old=await tx.query.presentationAssets.findFirst({where:and(eq(presentationAssets.versionId,versionId),eq(presentationAssets.requestId,req.requestId))});
  if(old){if(old.hash!==sourceHash||old.kind!==req.kind||old.provenance!==req.provenance||old.name!==name)throw new DomainError(409,'Upload request was used for different media.');return {id:old.id};}
  const id=randomUUID(),objectKey=`${projectId}/presentation/${id}/original`,displayKey=`${projectId}/presentation/${id}/display`;
  const objectVersion=await preserveSource(objectKey,bytes),displayVersion=await preserveSource(displayKey,image.display);
  await tx.insert(presentationAssets).values({id,projectId,versionId,...req,name,hash:sourceHash,displayHash,mime:image.mime,size:bytes.length,width:image.width,height:image.height,objectKey,objectVersion,displayKey,displayVersion,createdBy:a.id});
  await record(tx,a.id,'presentation.media.preserved',id,projectId,{versionId,kind:req.kind,hash:sourceHash,displayHash});return {id};
 });
}
async function exactRevision(tx:Transaction,projectId:string,versionId:string,revisionId:string){
 const v=await version(tx,projectId,versionId),p=await tx.query.clientPresentations.findFirst({where:eq(clientPresentations.versionId,versionId)});
 const r=p?await tx.query.presentationRevisions.findFirst({where:and(eq(presentationRevisions.id,revisionId),eq(presentationRevisions.presentationId,p.id))}):null;
 if(!r)throw new DomainError(404,'Presentation revision not found.');return {v,r};
}
const mediaUrl=(p:string,v:string,r:string,id:string)=>`/api/projects/${p}/versions/${v}/presentations/${r}/media/${id}`;
export async function previewPresentation(a:Actor,projectId:string,versionId:string,revisionId:string){
 access(a,'presentation.preview');return db.transaction(async tx=>{
  const {v,r}=await exactRevision(tx,projectId,versionId,revisionId);
  const assets=await tx.select({id:presentationAssets.id,kind:presentationAssets.kind}).from(presentationAssets).where(eq(presentationAssets.versionId,versionId));
  return projectPresentation(r.content,v.number,assets,id=>mediaUrl(projectId,versionId,revisionId,id));
 });
}
export async function presentationMedia(a:Actor,projectId:string,versionId:string,assetId:string,revisionId?:string){
 access(a,revisionId?'presentation.preview':'presentation.edit');
 const asset=await db.transaction(async tx=>{
  await version(tx,projectId,versionId);
  const asset=await tx.query.presentationAssets.findFirst({where:and(eq(presentationAssets.id,assetId),eq(presentationAssets.projectId,projectId),eq(presentationAssets.versionId,versionId))});if(!asset)throw new DomainError(404,'Presentation image not found.');
  if(revisionId){const {v,r}=await exactRevision(tx,projectId,versionId,revisionId),safe=projectPresentation(r.content,v.number,[asset],id=>id);if(!safe.media.some(m=>m.url===assetId))throw new DomainError(404,'Image is not visible in this presentation revision.');}
  return asset;
 });
 const bytes=Buffer.from(await readSource(asset.displayKey,asset.displayVersion));if(hash(bytes)!==asset.displayHash)throw new DomainError(409,'Presentation image integrity check failed.');return {mime:asset.mime,bytes};
}
