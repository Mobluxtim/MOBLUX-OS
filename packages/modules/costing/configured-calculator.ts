import type {CostLine,CostResult,CostRules,CostOverride} from '../../contracts/costing.js';
import {calculateCosts,costingAlgorithmVersion,type CostSourceSet} from './calculator.js';
import {add,canonical,ceilDivide,millimetersToMeters,money,multiply} from './decimal.js';
export const configuredAlgorithmVersion='technical-cost/configurable-rules/v1';
export const algorithmFor=(rules:CostRules)=>rules.configuration?configuredAlgorithmVersion:costingAlgorithmVersion;
export function summarize(r:CostResult):CostResult {
 const sum=(ls:CostLine[])=>{const valued=ls.filter(l=>l.subtotal!==null);return valued.length?money(valued.reduce((n,l)=>add(n,l.subtotal!),'0')):null;};
 const missing=(l:CostLine)=>l.status!=='COSTED'&&l.status!=='MANUAL_OVERRIDE';
 r.categories=[...new Set(r.lines.map(l=>l.category))].map(category=>{const lines=r.lines.filter(l=>l.category===category),missingLines=lines.filter(missing).length;return {category,missingLines,knownSubtotal:sum(lines),subtotal:missingLines?null:sum(lines)};});
 r.knownSubtotal=sum(r.lines);r.status=r.currency&&r.coverageIssues.length===0&&!r.lines.some(missing)?'COMPLETE':'PARTIAL';r.total=r.status==='COMPLETE'?r.knownSubtotal:null;return r;
}
export function calculateConfiguredCosts(s:CostSourceSet,rules:CostRules|null):CostResult {
 if(!rules?.configuration)return calculateCosts(s,rules);
 const c=rules.configuration;
 const r=calculateCosts(s,{...rules,panelBasis:'SHEETS',rates:[]});
 const sourceLines=calculateCosts(s,{...rules,panelBasis:'NET_M2',rates:[]}).lines;
 const id=(l:CostLine):unknown=>JSON.parse(l.key)[1];
 const master=(l:CostLine)=>{const v=id(l);return Array.isArray(v)?v[0]:null;};
 const replace=(l:CostLine,identity:unknown,unit:CostLine['unit'],quantity:string|null,reason:string|null=null)=>{l.key=JSON.stringify([l.category,identity,unit]);l.unit=unit;l.quantity=quantity;l.reason=reason;l.status=reason||quantity===null?'MISSING_COST_BASIS':'MISSING_RATE';};
 // Glass consumes net area once. Explicit doubled layers replace the final panel material cost.
 for(const p of s.bom?.result.panels??[]){
  const glass=c.glass.find(x=>x.materialMasterId===p.materialMasterId),doubling=c.doubling.find(x=>x.finalMaterialMasterId===p.materialMasterId);
  if(!glass&&!doubling){if(!r.lines.some(l=>l.category==='PANEL'&&master(l)===p.materialMasterId)){const original=sourceLines.find(l=>l.category==='PANEL'&&master(l)===p.materialMasterId)!;const l=structuredClone(original);replace(l,[p.materialMasterId,p.thicknessMm,'MISSING_SHEETS'],'sheet',null,'No actual sheet requirement for this material.');r.lines.push(l);}continue;}
  const original=sourceLines.find(l=>l.category==='PANEL'&&master(l)===p.materialMasterId)!;
  r.lines=r.lines.filter(l=>l.category!=='PANEL'||master(l)!==p.materialMasterId);
  const l=structuredClone(original);
  if(glass){replace(l,[p.materialMasterId,p.thicknessMm,'GLASS_NET'],'m2',p.areaM2);l.label+=' · configured glass / external material';l.configurationEvidence=[glass.evidence];r.lines.push(l);continue;}
  const d=doubling!;
  const valid=canonical(p.thicknessMm)==='36';
  replace(l,[d.layerMaterialMasterId,'18','DOUBLE_LAYERS',d.finalMaterialMasterId,d.sheetLengthMm,d.sheetWidthMm],'sheet',valid?d.layerSheets:null,valid&&d.layerSheets?null:'Verified allocated 18 mm layer sheet requirement missing, or final thickness is not 36 mm.');
  l.label=`Two 18 mm layers for ${p.name}`;l.configurationEvidence=[d.evidence];l.consumption={layerMaterialMasterId:d.layerMaterialMasterId,layerThicknessMm:'18',layers:2,netAreaM2:multiply(p.areaM2,'2'),finalAreaM2:p.areaM2};r.lines.push(l);
  const bond:CostLine={...structuredClone(original),category:'DOUBLING',label:`Bonding / doubling · ${p.name}`,configurationEvidence:[d.evidence]};
  replace(bond,[d.finalMaterialMasterId,'BOND_ONCE'],'m2',valid?p.areaM2:null,valid?null:'Final thickness does not match explicit 36 mm mapping.');r.lines.push(bond);
 }
 // Do not reuse ordinary layer stock for doubling without an explicit allocation.
 if(c.doubling.length)r.warnings.push('Doubling sheet counts are explicit allocated requirements, additional to ordinary panels; final face bonding area is counted once. Edge demand remains the final-thickness source demand.');
 for(const l of r.lines){
  if(l.category==='EDGE_MATERIAL'){
   const e=c.edges.find(e=>e.materialMasterId===master(l));if(e){l.configurationEvidence=[e.evidence,`width=${e.widthMm??'unverified'} mm; type=${e.type??'unverified'}`];if(e.basis==='roll')replace(l,[id(l),'ROLL',e.rollLengthM],'roll',l.quantity!==null&&e.rollLengthM?ceilDivide(l.quantity,e.rollLengthM):null,l.reason??(e.rollLengthM?null:'Verified roll length missing.'));}
  }
  if(l.category==='CUTTING'&&c.cutting.mode==='EXTERNAL'){const quantity=c.cutting.externalUnit==='m'?l.quantity:c.cutting.externalQuantity;replace(l,['EXTERNAL',c.cutting.externalUnit],c.cutting.externalUnit,quantity,quantity===null?'External cutting basis missing.':null);l.label='External cutting service (replaces internal cutting)';l.configurationEvidence=[c.cutting.evidence];}
 }
 const familyRates=new Map<string,string|null>();
 for(const f of c.families.filter(f=>f.active)){
  const members=r.lines.filter(l=>f.memberKeys.includes(l.key));if(!members.length)continue;
  const quantityFor=(l:CostLine):string|null=>{
   if(l.quantity===null||l.reason)return null;if(f.unit===l.unit)return l.quantity;
   if(f.category==='GROOVE'&&f.unit==='m2'){const identity=id(l);return Array.isArray(identity)?millimetersToMeters(multiply(l.quantity,String(identity[1]))):null;}
   return null; // No width/area in the current project milling total. Never infer it.
  };
  const quantities=members.map(quantityFor),quantity=quantities.some(q=>q===null)?null:quantities.reduce<string>((n,q)=>add(n,q!),'0');
  const line:CostLine={key:JSON.stringify([f.category,['FAMILY',f.id],f.unit]),category:f.category,label:f.name,unit:f.unit,quantity,rate:null,subtotal:null,exactSubtotal:null,status:quantity===null?'MISSING_COST_BASIS':'MISSING_RATE',reason:quantity===null?'MISSING COST BASIS: selected family requires geometry/quantity not explicitly available.':null,evidence:members.flatMap(l=>l.evidence),referencePrices:[],configurationEvidence:[f.evidence,...members.map(l=>`Source selector: ${l.key}`)]};
  r.lines=r.lines.filter(l=>!f.memberKeys.includes(l.key));r.lines.push(line);familyRates.set(line.key,f.rate);
 }
 for(const l of r.lines){
  l.rate=familyRates.has(l.key)?familyRates.get(l.key)!:rules.rates.find(rate=>rate.key===l.key&&rate.category===l.category&&rate.unit===l.unit)?.rate??null;
  l.exactSubtotal=null;l.subtotal=null;
  if(l.quantity===null||l.reason){l.status='MISSING_COST_BASIS';continue;}
  if(l.rate===null){l.status='MISSING_RATE';continue;}
  l.exactSubtotal=multiply(l.quantity,l.rate);l.subtotal=money(l.exactSubtotal);l.status='COSTED';
 }
 r.lines.sort((a,b)=>a.key.localeCompare(b.key,'en'));
 r.workstations=c.workstations.map(w=>{const missing=Object.entries(w).filter(([k,v])=>k!=='name'&&v===null).map(([k])=>k);return {name:w.name,status:missing.length?'INCOMPLETE / MISSING DATA':'CONFIGURED / NOT CALCULATED',missing};});
 r.warnings.push('Supplier/historical prices are reserved future sources, never automatic fallback rates. Workstations and future project cost dimensions are not calculated.');
 return summarize(r);
}
export function applyOverride(result:CostResult,event:CostOverride):CostResult {
 const r=structuredClone(result),l=r.lines.find(l=>l.key===event.lineKey);if(!l)throw new Error('Override line not found');
 l.override=event;l.subtotal=money(event.value);l.exactSubtotal=event.value;l.status='MANUAL_OVERRIDE';r.overrideEvent=event;
 // A manual amount does not supply missing manufacturing geometry or close failed-part coverage.
 if(l.quantity===null||l.reason)r.coverageIssues.push(`Manual amount does not resolve missing technical basis: ${l.label}`);
 return summarize(r);
}
