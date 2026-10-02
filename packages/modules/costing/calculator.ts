import type {BomResult} from '../../contracts/bom.js';
import type {OptimizationResult} from '../../contracts/optimization.js';
import type {HardwareResult} from '../../contracts/hardware.js';
import type {MachiningResult} from '../../contracts/machining.js';
import {costCategories,type CostResult,type CostRules,type CostLine,type CostEvidence,type CostCategory,type CostUnit} from '../../contracts/costing.js';
import {add,multiply,money,millimetersToMeters,canonical} from './decimal.js';
export const costingAlgorithmVersion='technical-cost/exact-decimal-line-half-up-2/v1';
interface Input<T>{id:string;result:T;sourceId?:string;sourceHash?:string;}
export interface CostSourceSet {bom:Input<BomResult>|null;optimization:Input<OptimizationResult>|null;hardware:Input<HardwareResult>|null;machining:Input<MachiningResult>|null;}
export function calculateCosts(inputs:CostSourceSet,rules:CostRules|null):CostResult {
 const lines=new Map<string,CostLine>(),coverageIssues:string[]=[],warnings:string[]=[];const basis=rules?.panelBasis??'NET_M2';
 const evidence=(s:{id:string;sourceId?:string;sourceHash?:string},path:string):CostEvidence=>({reportId:s.id,path,...(s.sourceId?{sourceId:s.sourceId,sourceHash:s.sourceHash}:{})});
 function line(category:CostCategory,identity:unknown,label:string,unit:CostUnit,quantity:string|null,refs:CostEvidence[],reason:string|null=null,referencePrices:CostLine['referencePrices']=[]){
  const key=JSON.stringify([category,identity,unit]);const old=lines.get(key);
  if(old){old.quantity=old.quantity===null||quantity===null?null:add(old.quantity,quantity);old.evidence.push(...refs);old.referencePrices.push(...referencePrices);if(reason)old.reason=reason;return;}
  lines.set(key,{key,category,label,unit,quantity,rate:null,exactSubtotal:null,subtotal:null,status:quantity===null||reason?'MISSING_DATA':'MISSING_RATE',reason,evidence:refs,referencePrices});
 }
 const missing=(category:CostCategory,unit:CostUnit,reason:string)=>line(category,'missing',reason,unit,null,[],reason);
 const bom=inputs.bom,opt=inputs.optimization,hw=inputs.hardware,mach=inputs.machining;
 if(basis==='NET_M2'){
  if(bom)bom.result.panels.forEach((p,i)=>line('PANEL',[p.materialMasterId??p.key,p.thicknessMm,basis],`${p.name} · ${p.thicknessMm} mm · net area`,'m2',p.areaM2,[evidence(bom,`panels/${i}`)],p.materialMasterId?null:'Material identity unresolved.'));
  else missing('PANEL','m2','Material BOM missing or not selected.');
 }else{
  if(opt)opt.result.panels.forEach((p,i)=>line('PANEL',[p.materialMasterId??p.name,p.thicknessMm,basis,p.lengthMm,p.widthMm],`${p.name} · ${p.thicknessMm} mm · ${p.lengthMm} × ${p.widthMm} stock` ,basis==='SHEETS'?'sheet':'m2',basis==='SHEETS'?String(p.sheets):p.sheetAreaM2,[{...evidence(opt,`panels/${i}`),...p.location}],p.materialMasterId?null:'Material identity unresolved.'));
  else missing('PANEL',basis==='SHEETS'?'sheet':'m2','OptiCut report missing or not selected.');
 }
 if(opt){
  opt.result.edges.forEach((e,i)=>{for(const cat of ['EDGE_MATERIAL','EDGE_SERVICE'] as const)line(cat,[e.materialMasterId??e.name,e.thicknessMm],`${e.name} · ${e.thicknessMm} mm`,'m',e.lengthM,[{...evidence(opt,`edges/${i}`),...e.location}],e.materialMasterId?null:'Edge identity unresolved.');});
  if(!opt.result.edges.length){missing('EDGE_MATERIAL','m','No per-material edge lengths reported.');missing('EDGE_SERVICE','m','No edge service quantity reported.');}
  line('CUTTING','reported-total','OptiCut reported cutting length','m',opt.result.totals.cuttingLengthM,[{...evidence(opt,'totals/cuttingLengthM'),...opt.result.totals.location}]);
  if(opt.result.totals.failedUnits)coverageIssues.push(`${opt.result.totals.failedUnits} OptiCut failed/unplaced units: optimized quantities do not cover the entire project.`);
  warnings.push('OptiCut detail lengths and printed totals are independently rounded; detail rates use detail quantities.');
 }else{
  for(const c of ['EDGE_MATERIAL','EDGE_SERVICE'] as const){if(bom?.result.edges.length)bom.result.edges.forEach((e,i)=>line(c,[e.materialMasterId??e.key,e.thicknessMm],`${e.name} · ${e.thicknessMm} mm`,'m',null,[evidence(bom,`edges/${i}`)],'Net edge orientation is unverified; no measured length available.'));else missing(c,'m','Edge quantity source missing or not selected.');}
  missing('CUTTING','m','OptiCut cutting length missing or not selected.');
 }
 if(hw){hw.result.items.forEach((h,i)=>{const ref={...evidence(hw,`items/${i}`),...h.location};line('HARDWARE',h.sourceName,h.sourceName,'source_item',String(h.quantity),[ref],null,[{unitRaw:h.sourceUnitPriceRaw??null,totalRaw:h.sourceTotalPriceRaw??null,evidence:ref}]);});warnings.push('Hardware units are literal source quantities, not decomposed purchasable products. Source prices are reference evidence only.');}
 else missing('HARDWARE','source_item','Hardware report missing or not selected.');
 if(mach){
  mach.result.parts.forEach((p,i)=>{
   p.drilling.forEach((d,j)=>line('DRILLING',[d.sourceType,canonical(d.diameterMm),d.depthRaw],`${d.sourceType} · Ø${d.diameterMm} · depth ${d.depthRaw}`,'hole',multiply(String(d.count),String(p.quantity)),[{...evidence(mach,`parts/${i}/drilling/${j}`),partId:p.partId,cabinetId:p.cabinetId,...d.location}]));
   p.grooves.forEach((g,j)=>line('GROOVE',[g.sourceType,canonical(g.widthMm),canonical(g.depthMm)],`${g.sourceType} · width ${g.widthMm} · depth ${g.depthMm}`,'m',millimetersToMeters(multiply(g.lengthMm,String(p.quantity))),[{...evidence(mach,`parts/${i}/grooves/${j}`),partId:p.partId,cabinetId:p.cabinetId,...g.location}]));
  });
  const routes=mach.result.projectOperations.map((o,i)=>({o,i})).filter(({o})=>o.sourceType==='Frezare');
  for(const {o,i} of routes)line('ROUTING',o.sourceLabel,o.sourceLabel,'m',o.lengthM,[{...evidence(mach,`projectOperations/${i}`),...o.location}]);
  if(!routes.length)missing('ROUTING','m','No explicit project Frezare length.');
  if(![...lines.values()].some(l=>l.category==='DRILLING'))missing('DRILLING','hole','No explicit drilling quantities reported; absence is not a declared zero.');
  if(![...lines.values()].some(l=>l.category==='GROOVE'))missing('GROOVE','m','No explicit groove quantities reported; absence is not a declared zero.');
  warnings.push('Drilling uses printed count × part quantity, not coordinate annotation count or machine cycles. Source face/annotation/link uncertainties remain in the pinned report.');
  warnings.push('Grooves use detail lengths only; project Nut si Feder is not added again. BiselTeşit is outside v1 configured categories.');
 }else{missing('DRILLING','hole','Machining report missing or not selected.');missing('GROOVE','m','Machining report missing or not selected.');missing('ROUTING','m','Machining report missing or not selected.');}
 for(const l of lines.values()){
  const rate=rules?.rates.find(r=>r.key===l.key&&r.category===l.category&&r.unit===l.unit);l.rate=rate?.rate??null;
  if(l.quantity===null||l.reason){l.status='MISSING_DATA';continue;}
  if(!rate){l.status='MISSING_RATE';continue;}
  l.exactSubtotal=multiply(l.quantity,rate.rate);l.subtotal=money(l.exactSubtotal);l.status='COSTED';
 }
 const result=[...lines.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 const subtotal=(ls:CostLine[])=>{const costed=ls.filter(l=>l.subtotal!==null);return costed.length?money(costed.reduce((n,l)=>add(n,l.subtotal!), '0')):null;};
 const categories=costCategories.filter(category=>category!=='DOUBLING').map(category=>{const ls=result.filter(l=>l.category===category),missingLines=ls.filter(l=>l.status!=='COSTED').length;return {category,missingLines,knownSubtotal:subtotal(ls),subtotal:missingLines?null:subtotal(ls)};});
 const knownSubtotal=subtotal(result),complete=!!rules&&coverageIssues.length===0&&result.every(l=>l.status==='COSTED');
 return {currency:rules?.currency??null,panelBasis:basis,lines:result,categories,knownSubtotal,total:complete?knownSubtotal:null,status:complete?'COMPLETE':'PARTIAL',coverageIssues,warnings};
}
