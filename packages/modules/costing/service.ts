import {createHash} from 'node:crypto';
import {and,eq,desc,sql} from 'drizzle-orm';
import {z} from 'zod';
import {db,type Transaction} from '../../infrastructure/db.js';
import {technicalModels,bomReports,materialResolutions,optimizationReports,hardwareReports,machiningReports,costRuleVersions,costingRuns,materialMasters} from '../../../database/schema.js';
import {authorize,DomainError,type Actor} from '../identity/policy.js';
import {record} from '../audit/service.js';
import {calculateCosts,type CostSourceSet} from './calculator.js';
import {costCategories,type CostInputs,type CostOverride} from '../../contracts/costing.js';
import {configurationSchema,decimal} from './configuration.js';
import {calculateConfiguredCosts,algorithmFor,applyOverride} from './configured-calculator.js';
const inputsSchema=z.object({bomId:z.uuid().nullable(),optimizationId:z.uuid().nullable(),hardwareId:z.uuid().nullable(),machiningId:z.uuid().nullable()}).strict();
const rulesSchema=z.object({currency:z.enum(['RON','EUR','USD']),panelBasis:z.enum(['NET_M2','OPTIMIZED_M2','SHEETS']),reason:z.string().trim().min(3).max(500),rates:z.array(z.object({key:z.string().min(3).max(1500),category:z.enum(costCategories),unit:z.enum(['m2','sheet','m','source_item','hole','roll','service']),rate:z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/)}).strict()).max(1000),configuration:configurationSchema.optional()}).strict();
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
  const materialOptions=await tx.select({id:materialMasters.id,name:materialMasters.name,category:materialMasters.category,thickness:materialMasters.thickness}).from(materialMasters);
  return {materialOptions,rules:rules??null,history,selection:context.selection,options:context.options,preview:calculateConfiguredCosts(context.sources,rules?.rules??null),configurationTargets:calculateCosts(context.sources,{currency:rules?.rules.currency??'RON',panelBasis:'NET_M2',reason:'Selectors only',rates:[]}).lines.filter(l=>['DRILLING','GROOVE','ROUTING','EDGE_SERVICE'].includes(l.category)&&l.quantity!==null),canOverride:allowed(a,'cost.override'),canConfigure:allowed(a,'cost.configure'),canCalculate:allowed(a,'cost.calculate')};
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
  if(request.rules.configuration){
   const c=request.rules.configuration;
   if(request.rules.panelBasis!=='SHEETS')throw new DomainError(400,'Configured rules use sheet requirements; glass is an explicit net-area exception.');
   const verify=async(id:string,category:string,thickness?:string)=>{const m=await tx.query.materialMasters.findFirst({where:eq(materialMasters.id,z.uuid().parse(id))});if(!m||m.category!==category||(thickness&&Number(m.thickness)!==Number(thickness)))throw new DomainError(400,'Configuration must reference an existing material master with the declared category/thickness.');};
   for(const g of c.glass)await verify(g.materialMasterId,'PANEL');
   for(const d of c.doubling){await verify(d.finalMaterialMasterId,'PANEL','36');await verify(d.layerMaterialMasterId,'PANEL','18');}
   for(const e of c.edges)await verify(e.materialMasterId,'EDGE');
  }
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
  const costingAlgorithmVersion=algorithmFor(rules.rules);
  const inputKey=hash(req.inputs);await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cost-run:${modelId}:${req.ruleVersionId}:${inputKey}`},0))`);
  const existing=await tx.query.costingRuns.findFirst({where:and(eq(costingRuns.modelId,modelId),eq(costingRuns.ruleVersionId,req.ruleVersionId),eq(costingRuns.inputKey,inputKey),eq(costingRuns.algorithmVersion,costingAlgorithmVersion))});if(existing)return existing;
  const [run]=await tx.insert(costingRuns).values({projectId,modelId,versionId:context.model.versionId,ruleVersionId:rules.id,inputs:req.inputs,inputKey,algorithmVersion:costingAlgorithmVersion,result:calculateConfiguredCosts(context.sources,rules.rules),createdBy:a.id}).returning();
  await record(tx,a.id,'cost.run.calculated',run.id,projectId,{versionId:context.model.versionId,ruleVersionId:rules.id,inputs:req.inputs,algorithmVersion:costingAlgorithmVersion});return run;
 });
}

/** Append a new run; source run, rule version and all technical inputs remain unchanged. */
export async function overrideCostLine(a:Actor,projectId:string,modelId:string,body:unknown){
 access(a);authorize(a,'cost.override');
 const req=z.object({requestId:z.uuid(),baseRunId:z.uuid(),lineKey:z.string().min(3).max(1500),value:decimal,reason:z.string().trim().max(500).nullable()}).strict().parse(body);
 return db.transaction(async tx=>{
  await load(tx,projectId,modelId);
  const inputKey=`override:${req.requestId}`,payloadHash=hash(req);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cost-override:${modelId}:${req.requestId}`},0))`);
  const previous=await tx.query.costingRuns.findFirst({where:and(eq(costingRuns.modelId,modelId),eq(costingRuns.inputKey,inputKey))});
  if(previous){if(previous.result.overrideEvent?.payloadHash!==payloadHash)throw new DomainError(409,'Override request identity already used for a different payload.');return previous;}
  const base=await tx.query.costingRuns.findFirst({where:and(eq(costingRuns.id,req.baseRunId),eq(costingRuns.projectId,projectId),eq(costingRuns.modelId,modelId))});
  if(!base)throw new DomainError(404,'Base CostingRun not found for this project/version.');
  const line=base.result.lines.find(l=>l.key===req.lineKey);if(!line)throw new DomainError(400,'Line does not exist in the selected CostingRun.');
  const event:CostOverride={baseRunId:base.id,requestId:req.requestId,payloadHash,lineKey:line.key,originalValue:line.subtotal,originalExactValue:line.exactSubtotal,value:req.value,actor:a.id,timestamp:new Date().toISOString(),reason:req.reason};
  const [run]=await tx.insert(costingRuns).values({projectId,modelId,versionId:base.versionId,ruleVersionId:base.ruleVersionId,inputs:base.inputs,inputKey,algorithmVersion:'technical-cost/manual-override/v1',result:applyOverride(base.result,event),createdBy:a.id}).returning();
  await record(tx,a.id,'cost.line.overridden',run.id,projectId,{baseRunId:base.id,versionId:base.versionId,lineKey:line.key});return run;
 });
}
