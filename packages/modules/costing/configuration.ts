import {z} from 'zod';
export const decimal=z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/);
const positive=decimal.refine(v=>/[1-9]/.test(v),'Must be greater than zero');
const evidence=z.string().trim().min(3).max(1000);
export const configurationSchema=z.object({
 version:z.literal(1),
 glass:z.array(z.object({materialMasterId:z.string().min(1).max(100),evidence}).strict()).max(100),
 doubling:z.array(z.object({finalMaterialMasterId:z.string().min(1).max(100),layerMaterialMasterId:z.string().min(1).max(100),finalThicknessMm:z.literal('36'),layerThicknessMm:z.literal('18'),evidence,layerSheets:z.string().regex(/^[1-9]\d{0,6}$/).nullable(),sheetLengthMm:positive.nullable(),sheetWidthMm:positive.nullable()}).strict()).max(100),
 edges:z.array(z.object({materialMasterId:z.string().min(1).max(100),basis:z.enum(['m','roll']),rollLengthM:positive.nullable(),widthMm:positive.nullable(),type:z.string().trim().min(1).max(100).nullable(),evidence}).strict()).max(100),
 cutting:z.object({mode:z.enum(['INTERNAL','EXTERNAL']),externalUnit:z.enum(['m','service']),externalQuantity:decimal.nullable(),evidence:z.string().max(1000)}).strict(),
 families:z.array(z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(150),active:z.boolean(),category:z.enum(['DRILLING','GROOVE','ROUTING','EDGE_SERVICE']),unit:z.enum(['hole','m','m2']),memberKeys:z.array(z.string().min(3).max(1500)).min(1).max(1000),rate:decimal.nullable(),evidence}).strict()).max(100),
 workstations:z.array(z.object({name:z.string().trim().min(1).max(150),purchaseCost:decimal.nullable(),usefulLifeYears:positive.nullable(),productiveHoursPerYear:positive.nullable(),laborPerHour:decimal.nullable(),energyPerHour:decimal.nullable(),toolingPerHour:decimal.nullable(),maintenancePerYear:decimal.nullable(),allocatedOverheadPerYear:decimal.nullable()}).strict()).max(50)
}).strict().superRefine((c,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 for(const [label,keys] of [['glass',c.glass.map(x=>x.materialMasterId)],['doubling',c.doubling.map(x=>x.finalMaterialMasterId)],['edges',c.edges.map(x=>x.materialMasterId)],['families',c.families.map(x=>x.id)],['workstations',c.workstations.map(x=>x.name)]] as const)if(new Set(keys).size!==keys.length)fail(`Duplicate ${label} identity`);
 for(const d of c.doubling){if(d.finalMaterialMasterId===d.layerMaterialMasterId||c.glass.some(g=>g.materialMasterId===d.finalMaterialMasterId))fail('Conflicting panel mappings');if(d.layerSheets!==null&&(!d.sheetLengthMm||!d.sheetWidthMm))fail('Verified layer sheets require sheet dimensions');}
 const assigned=new Set<string>();
 for(const f of c.families){
  if((f.category==='DRILLING'&&f.unit!=='hole')||(f.category==='EDGE_SERVICE'&&f.unit!=='m')||(['GROOVE','ROUTING'].includes(f.category)&&f.unit==='hole'))fail('Family basis is incompatible with operation');
  for(const key of f.memberKeys){let k:unknown;try{k=JSON.parse(key);}catch{fail('Invalid family selector');continue;}if(!Array.isArray(k)||k.length!==3||k[0]!==f.category)fail('Family selector category mismatch');if(f.active){if(assigned.has(key))fail('An active operation can belong to only one family per costing dimension');assigned.add(key);}}
 }
 if(c.cutting.mode==='EXTERNAL'&&c.cutting.evidence.trim().length<3)fail('External cutting needs configuration evidence');
});
