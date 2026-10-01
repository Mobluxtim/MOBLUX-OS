import { createHash } from 'node:crypto';
import { and, eq, or, desc, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db.js';
import { readSource } from '../../infrastructure/storage.js';
import { technicalModels, hardwareReports, sources, parts } from '../../../database/schema.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { extractHardwarePdf, UnsupportedOptimization, OptimizationBusy } from '../imports/opticut-pdf.js';
import { parseHardwareLayout, hardwareParserVersion } from '../imports/polyboard-hardware.js';
import type { HardwareResult } from '../../contracts/hardware.js';
function access(actor: Actor) { authorize(actor,'project.view'); authorize(actor,'project.import'); authorize(actor,'project.files.download'); }
export function hardwareResponse<T extends {result: HardwareResult | null}>(actor: Actor, row: T) {
  const pricesVisible=actor.kind==='staff' && actor.grants.has('project.cost.view') && !actor.denies.has('project.cost.view');
  if(pricesVisible || !row.result) return {...row,pricesVisible};
  const {sourceTotalPriceRaw: _total, ...safe}=row.result;
  void _total;
  return {...row,pricesVisible,result:{...safe,items:safe.items.map(({sourceName,quantity,location})=>({sourceName,quantity,location}))}};
}
export async function ensureHardware(actor: Actor, projectId: string, modelId: string) {
  access(actor);
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hardware:${modelId}`},0))`);
    const model=await tx.query.technicalModels.findFirst({where:and(eq(technicalModels.id,modelId),eq(technicalModels.projectId,projectId))});
    if(!model) throw new DomainError(404,'Project technical version not found.');
    const modelParts=await tx.select({data:parts.data}).from(parts).where(eq(parts.versionId,model.versionId));
    const inputs=(await tx.select().from(sources).where(and(eq(sources.projectId,projectId),or(eq(sources.versionId,model.baseVersionId),eq(sources.versionId,model.versionId))))).filter(s=>s.name.toLowerCase().endsWith('.pdf'));
    for(const source of inputs) {
      if(await tx.query.hardwareReports.findFirst({where:and(eq(hardwareReports.versionId,model.versionId),eq(hardwareReports.sourceId,source.id),eq(hardwareReports.parserVersion,hardwareParserVersion))})) continue;
      const bytes=await readSource(source.objectKey,source.objectVersion);
      if(bytes.length!==source.size || createHash('sha256').update(bytes).digest('hex')!==source.hash) throw new DomainError(409,'Hardware source integrity verification failed.');
      let result: HardwareResult | null=null, status:'IMPORTED'|'FAILED'|'UNSUPPORTED'='IMPORTED', finding:string|null=null;
      try {
        result=parseHardwareLayout(await extractHardwarePdf(Buffer.from(bytes)));
        if(!modelParts.length || modelParts.some(p=>p.data.projectLabel!==result!.projectLabel)) throw new Error('Model mismatch');
      } catch(error) {
        if(error instanceof OptimizationBusy) throw new DomainError(503,error.message);
        status=error instanceof UnsupportedOptimization?'UNSUPPORTED':'FAILED'; result=null;
        finding=status==='UNSUPPORTED'?'Not the supported PolyBoard project report.':'Project Feronerie summary validation failed. No partial hardware BOM published.';
      }
      const [report]=await tx.insert(hardwareReports).values({modelId,versionId:model.versionId,sourceId:source.id,sourceHash:source.hash,parserVersion:hardwareParserVersion,status,result,finding,createdBy:actor.id}).returning();
      await record(tx,actor.id,'hardware_bom.import.assessed',report.id,projectId,{versionId:model.versionId,sourceId:source.id,sourceHash:source.hash,parserVersion:hardwareParserVersion,status,itemCount:result?.itemCount??0});
    }
    const rows=await tx.select().from(hardwareReports).where(eq(hardwareReports.modelId,modelId)).orderBy(desc(hardwareReports.createdAt));
    return rows.map(r=>hardwareResponse(actor,r));
  });
}
export async function hardwareHistory(actor: Actor,projectId:string,modelId:string) {
  access(actor);
  if(!await db.query.technicalModels.findFirst({where:and(eq(technicalModels.id,modelId),eq(technicalModels.projectId,projectId))})) throw new DomainError(404,'Project technical version not found.');
  return (await db.select().from(hardwareReports).where(eq(hardwareReports.modelId,modelId)).orderBy(desc(hardwareReports.createdAt))).map(r=>hardwareResponse(actor,r));
}
