import {createHash} from 'node:crypto';
import {and,desc,eq,sql} from 'drizzle-orm';
import {z} from 'zod';
import {db,type Transaction} from '../../infrastructure/db.js';
import {versions,quoteVersions,clientPresentations,presentationRevisions} from '../../../database/schema.js';
import {authorize,DomainError,type Actor} from '../identity/policy.js';
import {record} from '../audit/service.js';
import {previewPresentation} from '../presentations/service.js';
import {quoteContentSchema} from '../../contracts/quote.js';
import {calculateQuote,quoteAlgorithm} from './calculation.js';
import {projectQuote} from './projection.js';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const allowed=(a:Actor,c:string)=>a.kind==='staff'&&a.grants.has(c)&&!a.denies.has(c);
function access(a:Actor,c:'quote.view'|'quote.preview'){authorize(a,'project.view');authorize(a,c);}
async function version(tx:Transaction,projectId:string,versionId:string){const v=await tx.query.versions.findFirst({where:and(eq(versions.id,versionId),eq(versions.projectId,projectId))});if(!v)throw new DomainError(404,'Project version not found.');return v;}
async function presentation(tx:Transaction,projectId:string,versionId:string,id:string){
 const rows=await tx.select({revision:presentationRevisions}).from(presentationRevisions).innerJoin(clientPresentations,eq(clientPresentations.id,presentationRevisions.presentationId)).where(and(eq(presentationRevisions.id,id),eq(clientPresentations.projectId,projectId),eq(clientPresentations.versionId,versionId)));
 if(!rows[0])throw new DomainError(400,'Presentation revision must belong to this exact ProjectVersion.');return rows[0].revision;
}
export async function quoteState(a:Actor,projectId:string,versionId:string){
 access(a,'quote.view');return db.transaction(async tx=>{
  const v=await version(tx,projectId,versionId),history=await tx.select().from(quoteVersions).where(eq(quoteVersions.versionId,versionId)).orderBy(desc(quoteVersions.number)).limit(50);
  const presentations=allowed(a,'presentation.preview')?await tx.select({revision:presentationRevisions}).from(presentationRevisions).innerJoin(clientPresentations,eq(clientPresentations.id,presentationRevisions.presentationId)).where(eq(clientPresentations.versionId,versionId)).orderBy(desc(presentationRevisions.number)):[];
  return {versionNumber:v.number,history,presentations:presentations.map(({revision:r})=>({id:r.id,number:r.number,title:r.content.title,sections:r.content.sections.filter(s=>s.visibility==='CLIENT_PRESENTATION').map(s=>({id:s.id,title:s.title}))})),canEdit:allowed(a,'quote.edit'),canPreview:allowed(a,'quote.preview')};
 });
}
const requestSchema=z.object({requestId:z.uuid(),previousId:z.uuid().nullable(),presentationRevisionId:z.uuid().nullable(),content:quoteContentSchema}).strict();
async function validateContent(a:Actor,tx:Transaction,projectId:string,versionId:string,req:z.infer<typeof requestSchema>){
 if(req.presentationRevisionId){authorize(a,'presentation.preview');const r=await presentation(tx,projectId,versionId,req.presentationRevisionId);for(const l of req.content.lines)if(l.presentationSectionId&&!r.content.sections.some(s=>s.id===l.presentationSectionId&&s.visibility==='CLIENT_PRESENTATION'))throw new DomainError(400,'Referenced presentation room must be visible in the pinned revision.');}
 else if(req.content.lines.some(l=>l.presentationSectionId))throw new DomainError(400,'Select an exact presentation revision before referencing a room.');
 return calculateQuote(req.content);
}
export async function saveQuote(a:Actor,projectId:string,versionId:string,input:unknown){
 access(a,'quote.view');authorize(a,'quote.edit');const req=requestSchema.parse(input),payloadHash=hash(req);
 return db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`quote:${versionId}`},0))`);await version(tx,projectId,versionId);
  const existing=await tx.query.quoteVersions.findFirst({where:and(eq(quoteVersions.versionId,versionId),eq(quoteVersions.requestId,req.requestId))});if(existing){if(existing.payloadHash!==payloadHash)throw new DomainError(409,'Request was used for different quote content.');return existing;}
  const previous=await tx.query.quoteVersions.findFirst({where:eq(quoteVersions.versionId,versionId),orderBy:desc(quoteVersions.number)});if((previous?.id??null)!==req.previousId)throw new DomainError(409,'Quote changed. Reload before saving another revision.');
  const result=await validateContent(a,tx,projectId,versionId,req);
  const [quote]=await tx.insert(quoteVersions).values({projectId,versionId,number:(previous?.number??0)+1,previousId:req.previousId,presentationRevisionId:req.presentationRevisionId,requestId:req.requestId,payloadHash,contentHash:hash({content:req.content,presentationRevisionId:req.presentationRevisionId}),algorithmVersion:quoteAlgorithm,content:req.content,result,createdBy:a.id}).returning();
  await record(tx,a.id,'quote.versioned',quote.id,projectId,{versionId,number:quote.number,previousId:req.previousId,presentationRevisionId:req.presentationRevisionId,contentHash:quote.contentHash});return quote;
 });
}
export async function calculateDraft(a:Actor,projectId:string,versionId:string,input:unknown){
 access(a,'quote.view');authorize(a,'quote.edit');const req=requestSchema.parse(input);return db.transaction(async tx=>{await version(tx,projectId,versionId);return validateContent(a,tx,projectId,versionId,req);});
}
export async function quotePreview(a:Actor,projectId:string,versionId:string,quoteId:string){
 access(a,'quote.preview');
 const {v,q,sectionTitles}=await db.transaction(async tx=>{
  const v=await version(tx,projectId,versionId),q=await tx.query.quoteVersions.findFirst({where:and(eq(quoteVersions.id,quoteId),eq(quoteVersions.projectId,projectId),eq(quoteVersions.versionId,versionId))});if(!q)throw new DomainError(404,'Quote version not found.');
  const sectionTitles=new Map<string,string>();if(q.presentationRevisionId){authorize(a,'presentation.preview');const r=await presentation(tx,projectId,versionId,q.presentationRevisionId);for(const s of r.content.sections)if(s.visibility==='CLIENT_PRESENTATION')sectionTitles.set(s.id,s.title);}
  return {v,q,sectionTitles};
 });
 const p=q.presentationRevisionId?await previewPresentation(a,projectId,versionId,q.presentationRevisionId):null;
 return projectQuote(q.content,q.result,q.number,v.number,p,sectionTitles);
}
