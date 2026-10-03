import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {and,desc,eq,sql} from 'drizzle-orm';
import {db,type Transaction} from '../../infrastructure/db.js';
import {readSource} from '../../infrastructure/storage.js';
import * as s from '../../../database/schema.js';
import {authorize,DomainError,type Actor} from '../identity/policy.js';
import {record} from '../audit/service.js';
import {projectQuote} from '../quotes/projection.js';
import {projectPresentation} from '../presentations/projection.js';
import {issueAccessSchema,clientActionSchema,type PortalSnapshot,type PortalStatus} from '../../contracts/portal.js';
import {evidenceHash as hash} from './evidence.js';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const unavailable=()=>new DomainError(401,'Client access is unavailable or expired. Request a new link.');
async function lock(tx:Transaction,projectId:string){await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`portal:${projectId}`},0))`);}
const mediaUrl=(snapshotId:string,id:string)=>`/api/client/media/${snapshotId}/${id}`;
function staff(a:Actor,cap:'portal.view'|'portal.manage'){authorize(a,'project.view');authorize(a,cap);}
async function status(tx:Transaction,snapshotId:string):Promise<PortalStatus>{
 if(await tx.query.portalSupersessions.findFirst({where:eq(s.portalSupersessions.snapshotId,snapshotId)}))return 'SUPERSEDED';
 if(await tx.query.portalActions.findFirst({where:and(eq(s.portalActions.snapshotId,snapshotId),eq(s.portalActions.action,'APPROVE'))}))return 'APPROVED';
 const action=await tx.query.portalActions.findFirst({where:eq(s.portalActions.snapshotId,snapshotId),orderBy:desc(s.portalActions.createdAt)});
 return action?'CHANGES_REQUESTED':'PENDING_CLIENT';
}
export async function issue(a:Actor,projectId:string,input:unknown){
 staff(a,'portal.manage');authorize(a,'quote.preview');authorize(a,'presentation.preview');const req=issueAccessSchema.parse(input);
 return db.transaction(async tx=>{
  await lock(tx,projectId);const project=await tx.query.projects.findFirst({where:eq(s.projects.id,projectId)});if(!project)throw new DomainError(404,'Project not found.');
  const payloadHash=hash({projectId,...req}),old=await tx.query.portalAccesses.findFirst({where:eq(s.portalAccesses.requestId,req.requestId)});
  if(old){if(old.payloadHash!==payloadHash)throw new DomainError(409,'Request already used.');return {accessId:old.id,token:null};}
  const q=await tx.query.quoteVersions.findFirst({where:and(eq(s.quoteVersions.id,req.quoteId),eq(s.quoteVersions.projectId,projectId))});
  if(!q||!q.presentationRevisionId||q.result.status!=='COMPLETE')throw new DomainError(400,'Choose a complete quote with an exact attached presentation.');
  let snapshot=await tx.query.portalSnapshots.findFirst({where:and(eq(s.portalSnapshots.projectId,projectId),eq(s.portalSnapshots.quoteId,q.id))});
  if(snapshot){if(await status(tx,snapshot.id)==='SUPERSEDED')throw new DomainError(409,'A superseded snapshot cannot be reissued.');if(snapshot.content.projectTitle!==req.projectTitle)throw new DomainError(409,'Published project title is frozen. Create a new quote revision to change it.');}
  else{
   const v=await tx.query.versions.findFirst({where:eq(s.versions.id,q.versionId)}),r=await tx.query.presentationRevisions.findFirst({where:eq(s.presentationRevisions.id,q.presentationRevisionId)});
   if(!v||!r)throw new DomainError(400,'Snapshot references are unavailable.');
   const assets=await tx.select().from(s.presentationAssets).where(eq(s.presentationAssets.versionId,q.versionId)),id=randomUUID();
   const p=projectPresentation(r.content,v.number,assets,assetId=>mediaUrl(id,assetId));
   const evidenceMedia=assets.filter(x=>p.media.some(m=>m.url===mediaUrl(id,x.id)));
   const content:PortalSnapshot={projectTitle:req.projectTitle,presentationNumber:r.number,quote:projectQuote(q.content,q.result,q.number,v.number,p,new Map(r.content.sections.filter(x=>x.visibility==='CLIENT_PRESENTATION').map(x=>[x.id,x.title]))),confirmation:`I approve Project V${v.number}, presentation revision ${r.number} and quote ${q.number} displayed here.`};
   [snapshot]=await tx.insert(s.portalSnapshots).values({id,projectId,customerId:project.customerId,versionId:q.versionId,quoteId:q.id,presentationId:r.id,content,contentHash:hash(content),evidence:{quoteHash:q.contentHash,presentationHash:r.contentHash,media:evidenceMedia.map(x=>({id:x.id,hash:x.displayHash,objectVersion:x.displayVersion}))},createdBy:a.id}).returning();
   const older=await tx.select().from(s.portalSnapshots).where(eq(s.portalSnapshots.projectId,projectId));for(const o of older)if(o.id!==id)await tx.insert(s.portalSupersessions).values({snapshotId:o.id,replacementId:id,createdBy:a.id}).onConflictDoNothing();
   await record(tx,a.id,'portal.snapshot.published',id,projectId,{versionId:q.versionId,quoteId:q.id,presentationId:r.id,hash:snapshot.contentHash});
  }
  // Reissue the same recipient's access; other explicitly issued contacts remain independent.
  const previous=await tx.select().from(s.portalAccesses).where(and(eq(s.portalAccesses.snapshotId,snapshot.id),eq(s.portalAccesses.contactEmail,req.contactEmail.toLowerCase())));
  for(const access of previous)await tx.insert(s.portalRevocations).values({accessId:access.id,createdBy:a.id}).onConflictDoNothing();
  const token=secret(),[access]=await tx.insert(s.portalAccesses).values({snapshotId:snapshot.id,requestId:req.requestId,payloadHash,tokenHash:digest(token),contactName:req.contactName,contactEmail:req.contactEmail.toLowerCase(),expiresAt:new Date(Date.now()+req.expiresInHours*3600000),createdBy:a.id}).returning();
  await record(tx,a.id,'portal.access.issued',access.id,projectId,{snapshotId:snapshot.id,reissuedAccessIds:previous.map(p=>p.id)});return {accessId:access.id,token};
 });
}
async function validAccess(tx:Transaction,accessId:string){
 const access=await tx.query.portalAccesses.findFirst({where:eq(s.portalAccesses.id,accessId)});if(!access||access.expiresAt.getTime()<=Date.now()||await tx.query.portalRevocations.findFirst({where:eq(s.portalRevocations.accessId,accessId)}))throw unavailable();
 const snapshot=await tx.query.portalSnapshots.findFirst({where:eq(s.portalSnapshots.id,access.snapshotId)});if(!snapshot)throw unavailable();return {access,snapshot};
}
export async function redeem(token:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw unavailable();
 return db.transaction(async tx=>{
  const a=await tx.query.portalAccesses.findFirst({where:eq(s.portalAccesses.tokenHash,digest(token))});if(!a)throw unavailable();const snap=await tx.query.portalSnapshots.findFirst({where:eq(s.portalSnapshots.id,a.snapshotId)});if(!snap)throw unavailable();await lock(tx,snap.projectId);
  const {access}=await validAccess(tx,a.id);if(await status(tx,snap.id)==='SUPERSEDED'||await tx.query.portalSessions.findFirst({where:eq(s.portalSessions.accessId,a.id)}))throw unavailable();
  const session=secret(),expiresAt=new Date(Math.min(access.expiresAt.getTime(),Date.now()+8*3600000));await tx.insert(s.portalSessions).values({tokenHash:digest(session),accessId:a.id,expiresAt});return {token:session,expiresAt};
 });
}
async function session(tx:Transaction,token:string|undefined){
 if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))throw unavailable();const tokenHash=digest(token),ss=await tx.query.portalSessions.findFirst({where:eq(s.portalSessions.tokenHash,tokenHash)});
 if(!ss||ss.expiresAt.getTime()<=Date.now()||await tx.query.portalSessionEnds.findFirst({where:eq(s.portalSessionEnds.tokenHash,tokenHash)}))throw unavailable();return validAccess(tx,ss.accessId);
}
export async function view(token:string|undefined){return db.transaction(async tx=>{const {snapshot}=await session(tx,token),st=await status(tx,snapshot.id),approval=await tx.query.portalActions.findFirst({where:and(eq(s.portalActions.snapshotId,snapshot.id),eq(s.portalActions.action,'APPROVE'))});return {snapshotId:snapshot.id,hash:snapshot.contentHash,content:snapshot.content,status:st,approvedAt:approval?.createdAt.toISOString()??null};});}
export async function act(token:string|undefined,input:unknown){
 const req=clientActionSchema.parse(input);return db.transaction(async tx=>{
  let context=await session(tx,token);await lock(tx,context.snapshot.projectId);context=await session(tx,token);const {snapshot,access}=context;
  if(req.snapshotId!==snapshot.id||req.hash!==snapshot.contentHash)throw new DomainError(409,'Displayed snapshot does not match this access.');
  const payloadHash=hash(req),old=await tx.query.portalActions.findFirst({where:and(eq(s.portalActions.accessId,access.id),eq(s.portalActions.requestId,req.requestId))});if(old){if(old.payloadHash!==payloadHash)throw new DomainError(409,'Request already used.');return {ok:true};}
  const st=await status(tx,snapshot.id);if(st==='SUPERSEDED'||st==='APPROVED')throw new DomainError(409,'This snapshot no longer accepts actions.');
  await tx.insert(s.portalActions).values({snapshotId:snapshot.id,accessId:access.id,requestId:req.requestId,payloadHash,action:req.action,message:req.action==='REQUEST_CHANGES'?req.message:null,approvedContent:req.action==='APPROVE'?snapshot.content:null,contentHash:snapshot.contentHash});return {ok:true};
 });
}
export async function logout(token:string|undefined){if(!token)return;await db.transaction(async tx=>{const h=digest(token);if(await tx.query.portalSessions.findFirst({where:eq(s.portalSessions.tokenHash,h)}))await tx.insert(s.portalSessionEnds).values({tokenHash:h}).onConflictDoNothing();});}
export async function media(token:string|undefined,snapshotId:string,assetId:string){
 const asset=await db.transaction(async tx=>{const {snapshot}=await session(tx,token);if(snapshot.id!==snapshotId||!snapshot.evidence.media.some(m=>m.id===assetId))throw new DomainError(404,'Image not available.');const a=await tx.query.presentationAssets.findFirst({where:and(eq(s.presentationAssets.id,assetId),eq(s.presentationAssets.versionId,snapshot.versionId))});if(!a)throw new DomainError(404,'Image not available.');return a;});
 const bytes=Buffer.from(await readSource(asset.displayKey,asset.displayVersion));if(createHash('sha256').update(bytes).digest('hex')!==asset.displayHash)throw new DomainError(409,'Image integrity check failed.');return {bytes,mime:asset.mime};
}
export async function revoke(a:Actor,projectId:string,accessId:string){staff(a,'portal.manage');return db.transaction(async tx=>{await lock(tx,projectId);const access=await tx.query.portalAccesses.findFirst({where:eq(s.portalAccesses.id,accessId)}),snapshot=access?await tx.query.portalSnapshots.findFirst({where:and(eq(s.portalSnapshots.id,access.snapshotId),eq(s.portalSnapshots.projectId,projectId))}):null;if(!access||!snapshot)throw new DomainError(404,'Access not found.');const rows=await tx.insert(s.portalRevocations).values({accessId,createdBy:a.id}).onConflictDoNothing().returning();if(rows.length)await record(tx,a.id,'portal.access.revoked',accessId,projectId,{snapshotId:snapshot.id});return {ok:true};});}
export async function internalState(a:Actor,projectId:string){staff(a,'portal.view');return db.transaction(async tx=>{
 const snapshots=await tx.select().from(s.portalSnapshots).where(eq(s.portalSnapshots.projectId,projectId)).orderBy(desc(s.portalSnapshots.createdAt));const entries=[];
 for(const snapshot of snapshots){const accesses=await tx.select().from(s.portalAccesses).where(eq(s.portalAccesses.snapshotId,snapshot.id));const grants=[];for(const g of accesses){const revoked=await tx.query.portalRevocations.findFirst({where:eq(s.portalRevocations.accessId,g.id)});grants.push({id:g.id,contactName:g.contactName,contactEmail:g.contactEmail,issuedAt:g.createdAt,expiresAt:g.expiresAt,state:revoked?'REVOKED':g.expiresAt.getTime()<=Date.now()?'EXPIRED':'ACTIVE'});}const actions=await tx.select().from(s.portalActions).where(eq(s.portalActions.snapshotId,snapshot.id)).orderBy(s.portalActions.createdAt);entries.push({...snapshot,status:await status(tx,snapshot.id),accesses:grants,actions});}
 return {entries,canManage:a.grants.has('portal.manage')&&!a.denies.has('portal.manage')};
});}
