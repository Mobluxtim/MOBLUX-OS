import {createHash} from 'node:crypto';
import {and,eq,desc,sql} from 'drizzle-orm';
import {z} from 'zod';
import {db,type Transaction} from '../../infrastructure/db.js';
import {technicalModels,bomReports,materialResolutions,optimizationReports,hardwareReports,machiningReports,costRuleVersions,costingRuns} from '../../../database/schema.js';
import {authorize,DomainError,type Actor} from '../identity/policy.js';
import {record} from '../audit/service.js';
import {calculateCosts,costingAlgorithmVersion,type CostSourceSet} from './calculator.js';
import {costCategories,type CostInputs} from '../../contracts/costing.js';
const inputsSchema=z.object({bomId:z.uuid().nullable(),optimizationId:z.uuid().nullable(),hardwareId:z.uuid().nullable(),machiningId:z.uuid().nullable()}).strict();
const rulesSchema=z.object({currency:z.enum(['RON','EUR','USD']),panelBasis:z.enum(['NET_M2','OPTIMIZED_M2','SHEETS']),reason:z.string().trim().min(3).max(500),rates:z.array(z.object({key:z.string().min(3).max(1500),category:z.enum(costCategories),unit:z.enum(['m2','sheet','m','source_item','hole']),rate:z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/)}).strict()).max(1000)}).strict();
function access(a:Actor){authorize(a,'project.view');authorize(a,'project.cost.view');authorize(a,'project.import');authorize(a,'project.files.download');}
function hash(x:unknown){return createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function allowed(a:Actor,c:string){return a.kind==='staff'&&a.grants.has(c)&&!a.denies.has(c);}
async function load(tx:Transaction,projectId:string,modelId:string,chosen?:CostInputs){
 const model=await tx.query.technicalModels.findFirst({where:and(eq(technicalModels.id,modelId),eq(technicalModels.projectId,projectId))});if(!model)throw new DomainError(404,'Project technical version not found.');
 const boms=await tx.select({report:bomReports}).from(bomReports).innerJoin(materialResolutions,eq(bomReports.resolutionId,materialResolutions.id)).where(eq(materialResolutions.modelId,modelId)).orderBy(desc(bomReports.createdAt),desc(bomReports.id));
 const opts=await tx.select().from(optimizationReports).where(and(eq(optimizationReports.modelId,modelId),eq(optimizationReports.status,'IMPORTED'))).orderBy(desc(optimizationReports.createdAt));
 const hardware=await tx.select().from(hardwareReports).where(and(eq(hardwareReports.modelId,modelId),eq(hardwareReports.status,'IMPORTED'))).orderBy(desc(hardwareReports.createdAt));
 const machining=await tx.select().from(machiningReports).where(and(eq(machiningReports.modelId,modelId),eq(machiningReports.status,'IMPORTED'))).orderBy(desc(machiningReports.createdAt));
 const only=(rows:{id:string}[])=>rows.length===1?rows[0].id:null;
 const selection=chosen??{bomId:only(boms.map(b=>b.report)),optimizationId:only(opts),hardwareId:only(hardware),machiningId:only(machining)};
 const choose=<T extends {id:string}>(rows:T[],id:string|null)=>{if(id===null)return null;const r=rows.find(r=>r.id===id);if(!r)throw new DomainError(409,'Selected cost input does not belong to this technical model or is not imported.');return r;};
 const bom=choose(boms.map(b=>b.report),selection.bomId),opt=choose(opts,selection.optimizationId),hw=choose(hardware,selection.hardwareId),mach=choose(machining,selection.machiningId);
 if(bom&&opt&&bom.resolutionId!==opt.resolutionId)throw new DomainError(409,'Material BOM and OptiCut must use the same material resolution. Select compatible reports.');
 const sources:CostSourceSet={bom:bom?{id:bom.id,result:bom.result}:null,optimization:opt?.result?{...opt,result:opt.result}:null,hardware:hw?.result?{...hw,result:hw.result}:null,machining:mach?.result?{...mach,result:mach.result}:null};
 const options={bomId:boms.map(({report:b})=>({id:b.id,label:`Net BOM · ${b.createdAt.toISOString()} · ${b.id}`})),optimizationId:opts.map(o=>({id:o.id,label:`OptiCut · ${o.createdAt.toISOString()} · ${o.id}`})),hardwareId:hardware.map(h=>({id:h.id,label:`Hardware · ${h.createdAt.toISOString()} · ${h.id}`})),machiningId:machining.map(m=>({id:m.id,label:`Machining · ${m.createdAt.toISOString()} · ${m.id}`}))};
 return {model,selection,sources,options};
}
export async function costingState(a:Actor,projectId:string,modelId:string,body?:unknown){
 access(a);const chosen=body===undefined?undefined:inputsSchema.parse(body);
 return db.transaction(async tx=>{
  const context=await load(tx,projectId,modelId,chosen),rules=await tx.query.costRuleVersions.findFirst({where:eq(costRuleVersions.projectId,projectId),orderBy:desc(costRuleVersions.sequence)});
  const history=await tx.select().from(costingRuns).where(eq(costingRuns.modelId,modelId)).orderBy(desc(costingRuns.createdAt)).limit(50);
  return {rules:rules??null,history,selection:context.selection,options:context.options,preview:calculateCosts(context.sources,rules?.rules??null),canConfigure:allowed(a,'cost.configure'),canCalculate:allowed(a,'cost.calculate')};
 });
}
export async function saveCostRules(a:Actor,projectId:string,modelId:string,body:unknown){
 access(a);authorize(a,'cost.configure');const request=z.object({requestId:z.uuid(),previousId:z.uuid().nullable(),rules:rulesSchema}).strict().parse(body);
 if(new Set(request.rules.rates.map(r=>r.key)).size!==request.rules.rates.length)throw new DomainError(400,'Duplicate rate selector.');
 for(const r of request.rules.rates){let key:unknown;try{key=JSON.parse(r.key);}catch{throw new DomainError(400,'Invalid rate selector.');}if(!Array.isArray(key)||key.length!==3||key[0]!==r.category||key[2]!==r.unit)throw new DomainError(400,'Rate selector/category/unit mismatch.');}
 request.rules.rates.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);const payloadHash=hash({previousId:request.previousId,rules:request.rules});
 return db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cost-rules:${projectId}`},0))`);
  await load(tx,projectId,modelId);
  const existing=await tx.query.costRuleVersions.findFirst({where:and(eq(costRuleVersions.projectId,projectId),eq(costRuleVersions.requestId,request.requestId))});
  if(existing){if(existing.payloadHash!==payloadHash)throw new DomainError(409,'Idempotency key was already used for different cost rules.');return existing;}
  const current=await tx.query.costRuleVersions.findFirst({where:eq(costRuleVersions.projectId,projectId),orderBy:desc(costRuleVersions.sequence)});
  if((current?.id??null)!==request.previousId)throw new DomainError(409,'Rates changed. Reload before publishing a new version.');
  const [row]=await tx.insert(costRuleVersions).values({projectId,previousId:request.previousId,requestId:request.requestId,payloadHash,rules:request.rules,createdBy:a.id}).returning();
  await record(tx,a.id,'cost.rules.versioned',row.id,projectId,{previousId:request.previousId,rateCount:request.rules.rates.length});return row;
 });
}
export async function createCostRun(a:Actor,projectId:string,modelId:string,body:unknown){
 access(a);authorize(a,'cost.calculate');const req=z.object({ruleVersionId:z.uuid(),inputs:inputsSchema}).strict().parse(body);
 return db.transaction(async tx=>{
  const context=await load(tx,projectId,modelId,req.inputs);const rules=await tx.query.costRuleVersions.findFirst({where:and(eq(costRuleVersions.id,req.ruleVersionId),eq(costRuleVersions.projectId,projectId))});
  if(!rules)throw new DomainError(404,'Cost rule version not found for this project.');
  const inputKey=hash(req.inputs);await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cost-run:${modelId}:${req.ruleVersionId}:${inputKey}`},0))`);
  const existing=await tx.query.costingRuns.findFirst({where:and(eq(costingRuns.modelId,modelId),eq(costingRuns.ruleVersionId,req.ruleVersionId),eq(costingRuns.inputKey,inputKey),eq(costingRuns.algorithmVersion,costingAlgorithmVersion))});if(existing)return existing;
  const [run]=await tx.insert(costingRuns).values({projectId,modelId,versionId:context.model.versionId,ruleVersionId:rules.id,inputs:req.inputs,inputKey,algorithmVersion:costingAlgorithmVersion,result:calculateCosts(context.sources,rules.rules),createdBy:a.id}).returning();
  await record(tx,a.id,'cost.run.calculated',run.id,projectId,{versionId:context.model.versionId,ruleVersionId:rules.id,inputs:req.inputs,algorithmVersion:costingAlgorithmVersion});return run;
 });
}
