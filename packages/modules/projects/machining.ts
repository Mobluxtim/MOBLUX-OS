import { createHash } from 'node:crypto';
import { and, eq, or, desc, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db.js';
import { readSource } from '../../infrastructure/storage.js';
import { technicalModels, machiningReports, sources, parts } from '../../../database/schema.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { extractMachiningPdf, UnsupportedOptimization, OptimizationBusy } from '../imports/opticut-pdf.js';
import { parseMachiningLayout, linkMachining, machiningParserVersion } from '../imports/polyboard-machining.js';
import type { MachiningResult } from '../../contracts/machining.js';
function access(actor: Actor) { authorize(actor,'project.view'); authorize(actor,'project.import'); authorize(actor,'project.files.download'); }
export async function ensureMachining(actor: Actor, projectId: string, modelId: string) {
  access(actor);
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`machining:${modelId}`},0))`);
    const model=await tx.query.technicalModels.findFirst({where:and(eq(technicalModels.id,modelId),eq(technicalModels.projectId,projectId))});
    if(!model) throw new DomainError(404,'Project technical version not found.');
    const modelParts=await tx.select().from(parts).where(eq(parts.versionId,model.versionId));
    const inputs=(await tx.select().from(sources).where(and(eq(sources.projectId,projectId),or(eq(sources.versionId,model.baseVersionId),eq(sources.versionId,model.versionId))))).filter(s=>s.name.toLowerCase().endsWith('.pdf'));
    for(const source of inputs) {
      if(await tx.query.machiningReports.findFirst({where:and(eq(machiningReports.versionId,model.versionId),eq(machiningReports.sourceId,source.id),eq(machiningReports.parserVersion,machiningParserVersion))})) continue;
      const bytes=await readSource(source.objectKey,source.objectVersion);
      if(bytes.length!==source.size || createHash('sha256').update(bytes).digest('hex')!==source.hash) throw new DomainError(409,'Machining source integrity verification failed.');
      let result: MachiningResult | null=null, status:'IMPORTED'|'FAILED'|'UNSUPPORTED'='IMPORTED', finding:string|null=null;
      try { result=linkMachining(parseMachiningLayout(await extractMachiningPdf(Buffer.from(bytes))),modelParts); }
      catch(error) {
        if(error instanceof OptimizationBusy) throw new DomainError(503,error.message);
        status=error instanceof UnsupportedOptimization?'UNSUPPORTED':'FAILED'; result=null;
        finding=status==='UNSUPPORTED'?'Not the supported PolyBoard project report.':'Project machining validation failed. No partial machining BOM published.';
      }
      const [report]=await tx.insert(machiningReports).values({modelId,versionId:model.versionId,sourceId:source.id,sourceHash:source.hash,parserVersion:machiningParserVersion,status,result,finding,createdBy:actor.id}).returning();
      await record(tx,actor.id,'machining_bom.import.assessed',report.id,projectId,{versionId:model.versionId,sourceId:source.id,sourceHash:source.hash,parserVersion:machiningParserVersion,status,drillingGroups:result?.totals.drillingGroups??0});
    }
    return tx.select().from(machiningReports).where(eq(machiningReports.modelId,modelId)).orderBy(desc(machiningReports.createdAt));
  });
}
export async function machiningHistory(actor: Actor,projectId:string,modelId:string) {
  access(actor);
  if(!await db.query.technicalModels.findFirst({where:and(eq(technicalModels.id,modelId),eq(technicalModels.projectId,projectId))})) throw new DomainError(404,'Project technical version not found.');
  return db.select().from(machiningReports).where(eq(machiningReports.modelId,modelId)).orderBy(desc(machiningReports.createdAt));
}
