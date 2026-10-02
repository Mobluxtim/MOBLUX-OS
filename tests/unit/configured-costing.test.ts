import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {CostConfiguration,CostRules,CostOverride} from '../../packages/contracts/costing.js';
import {calculateConfiguredCosts,applyOverride,algorithmFor} from '../../packages/modules/costing/configured-calculator.js';
import {calculateCosts,costingAlgorithmVersion} from '../../packages/modules/costing/calculator.js';
import {configurationSchema} from '../../packages/modules/costing/configuration.js';
import {costSources} from '../fixtures/costing.js';
const config=():CostConfiguration=>({version:1,glass:[],doubling:[],edges:[],cutting:{mode:'INTERNAL',externalUnit:'service',externalQuantity:null,evidence:''},families:[],workstations:[]});
const rules=(c=config()):CostRules=>({currency:'RON',panelBasis:'SHEETS',reason:'TEST ONLY',rates:[],configuration:c});
test('legacy replay unchanged; sheets replace net area and source prices never become rates',()=>{
 const s=costSources(),old:CostRules={currency:'RON',panelBasis:'NET_M2',reason:'legacy',rates:[]};assert.deepEqual(calculateConfiguredCosts(s,old),calculateCosts(s,old));assert.equal(algorithmFor(old),costingAlgorithmVersion);
 const r=calculateConfiguredCosts(s,rules()),panel=r.lines.filter(l=>l.category==='PANEL');assert.equal(panel.length,1);assert.equal(panel[0].quantity,'1');assert.equal(panel[0].unit,'sheet');assert.equal(r.knownSubtotal,null);assert.equal(r.lines.find(l=>l.category==='HARDWARE')!.referencePrices[0].unitRaw,'999.00');
});
test('explicit glass and doubling: two layers, one bonding area, no inferred 36mm policy',()=>{
 const s=costSources();s.bom!.result.panels[0].thicknessMm='36';s.optimization!.result.panels[0].thicknessMm='36';
 assert.equal(calculateConfiguredCosts(s,rules()).lines.some(l=>l.category==='DOUBLING'),false);
 const c=config();c.doubling=[{finalMaterialMasterId:'panel-master',layerMaterialMasterId:'layer-master',finalThicknessMm:'36',layerThicknessMm:'18',evidence:'TEST explicit layer allocation',layerSheets:null,sheetLengthMm:null,sheetWidthMm:null}];
 let r=calculateConfiguredCosts(s,rules(c)),p=r.lines.find(l=>l.category==='PANEL')!;assert.equal(p.consumption!.netAreaM2,'0.6');assert.equal(p.status,'MISSING_COST_BASIS');assert.equal(r.lines.find(l=>l.category==='DOUBLING')!.quantity,'0.3');assert.equal(r.lines.find(l=>l.category==='EDGE_SERVICE')!.quantity,'0.2');
 c.doubling[0]={...c.doubling[0],layerSheets:'2',sheetLengthMm:'3000',sheetWidthMm:'2000'};const cr=rules(c);r=calculateConfiguredCosts(s,cr);cr.rates=r.lines.filter(l=>['PANEL','DOUBLING'].includes(l.category)).map(l=>({key:l.key,category:l.category,unit:l.unit,rate:l.category==='PANEL'?'10':'2'}));r=calculateConfiguredCosts(s,cr);assert.equal(r.categories.find(x=>x.category==='PANEL')!.subtotal,'20.00');assert.equal(r.categories.find(x=>x.category==='DOUBLING')!.subtotal,'0.60');assert.equal(s.bom!.result.panels[0].areaM2,'0.3');
 const glass=config();glass.glass=[{materialMasterId:'panel-master',evidence:'TEST confirmed glass'}];p=calculateConfiguredCosts(s,rules(glass)).lines.find(l=>l.category==='PANEL')!;assert.equal(p.unit,'m2');assert.equal(p.quantity,'0.3');
});
test('edge rolls and external cutting are explicit, separate, mutually exclusive and decimal-safe',()=>{
 const s=costSources();s.optimization!.result.edges[0].lengthM='100.000001';const c=config();c.edges=[{materialMasterId:'edge-master',basis:'roll',rollLengthM:'100',widthMm:'40',type:'TEST type',evidence:'TEST verified roll'}];c.cutting={mode:'EXTERNAL',externalUnit:'service',externalQuantity:'1',evidence:'TEST service scope'};
 let r=calculateConfiguredCosts(s,rules(c));assert.equal(r.lines.find(l=>l.category==='EDGE_MATERIAL')!.quantity,'2');assert.equal(r.lines.find(l=>l.category==='EDGE_SERVICE')!.quantity,'100.000001');assert.equal(r.lines.filter(l=>l.category==='CUTTING').length,1);assert.equal(r.lines.find(l=>l.category==='CUTTING')!.unit,'service');
 c.edges[0].rollLengthM=null;c.cutting.externalQuantity=null;r=calculateConfiguredCosts(s,rules(c));assert.equal(r.lines.find(l=>l.category==='EDGE_MATERIAL')!.status,'MISSING_COST_BASIS');assert.equal(r.lines.find(l=>l.category==='CUTTING')!.status,'MISSING_COST_BASIS');
});
test('families replace members, exact groove area, missing routing area, no double assignment',()=>{
 const s=costSources(),base=calculateCosts(s,null),c=config();for(const category of ['DRILLING','GROOVE','ROUTING'] as const)c.families.push({id:category,name:`TEST ${category}`,active:true,category,unit:category==='DRILLING'?'hole':'m2',memberKeys:base.lines.filter(l=>l.category===category).map(l=>l.key),rate:'10',evidence:'TEST explicit selectors'});
 const r=calculateConfiguredCosts(s,rules(c));assert.equal(r.lines.filter(l=>l.category==='DRILLING').length,1);assert.equal(r.lines.find(l=>l.category==='DRILLING')!.subtotal,'40.00');assert.equal(r.lines.find(l=>l.category==='GROOVE')!.quantity,'0.0007035');assert.equal(r.lines.find(l=>l.category==='ROUTING')!.status,'MISSING_COST_BASIS');assert.equal(r.lines.find(l=>l.category==='ROUTING')!.subtotal,null);assert.ok(r.lines.find(l=>l.category==='GROOVE')!.evidence[0].partId);
 assert.equal(configurationSchema.safeParse(c).success,true);c.families.push({...c.families[0],id:'duplicate'});assert.equal(configurationSchema.safeParse(c).success,false);c.families[3].active=false;assert.equal(configurationSchema.safeParse(c).success,true);
});
test('manual amount records original value, preserves rate/history/reference, and cannot close missing coverage',()=>{
 const s=costSources(),cr=rules(),p=calculateConfiguredCosts(s,cr),l=p.lines.find(l=>l.category==='HARDWARE')!;cr.rates=[{key:l.key,category:l.category,unit:l.unit,rate:'0.125'}];const original=calculateConfiguredCosts(s,cr),snapshot=JSON.stringify(original);
 const event:CostOverride={baseRunId:'base',requestId:'request',payloadHash:'hash',lineKey:l.key,originalValue:'0.38',originalExactValue:'0.375',value:'1.234567',actor:'actor',timestamp:'time',reason:null};const result=applyOverride(original,event),line=result.lines.find(l=>l.category==='HARDWARE')!;
 assert.equal(line.subtotal,'1.23');assert.equal(line.rate,'0.125');assert.equal(line.status,'MANUAL_OVERRIDE');assert.equal(line.referencePrices[0].unitRaw,'999.00');assert.equal(JSON.stringify(original),snapshot);assert.equal(result.total,null);
 const missing=original.lines.find(l=>l.category==='PANEL')!;missing.quantity=null;missing.reason='Missing basis';assert.ok(applyOverride(original,{...event,lineKey:missing.key}).coverageIssues.some(i=>i.includes('missing technical basis')));
});
test('workstation placeholders are incomplete and never charged; unknown bases stay null',()=>{
 const c=config();c.workstations=[{name:'TEST future machine',purchaseCost:'100',usefulLifeYears:null,productiveHoursPerYear:null,laborPerHour:null,energyPerHour:null,toolingPerHour:null,maintenancePerYear:null,allocatedOverheadPerYear:null}];const s=costSources();s.optimization=null;const r=calculateConfiguredCosts(s,rules(c));assert.equal(r.workstations![0].status,'INCOMPLETE / MISSING DATA');assert.equal(r.knownSubtotal,null);assert.equal(r.lines.find(l=>l.category==='PANEL')!.status,'MISSING_COST_BASIS');
});
