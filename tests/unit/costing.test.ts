import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateCosts} from '../../packages/modules/costing/calculator.js';
import {add,multiply,money} from '../../packages/modules/costing/decimal.js';
import type {CostRules} from '../../packages/contracts/costing.js';
import {costSources} from '../fixtures/costing.js';
const rules=(rate:string):CostRules=>({currency:'RON',panelBasis:'NET_M2',reason:'SYNTHETIC TEST ONLY',rates:calculateCosts(costSources(),null).lines.map(l=>({key:l.key,category:l.category,unit:l.unit,rate}))});
test('decimal money is exact, bounded and rounds half-up per line',()=>{
 assert.equal(multiply('0.1','0.2'),'0.02');assert.equal(add('9007199254740993.01','0.09'),'9007199254740993.1');assert.equal(money('0.105'),'0.11');assert.equal(money('0.104999'),'0.10');assert.equal(money('1'),'1.00');assert.throws(()=>multiply('-1','2'));assert.throws(()=>money('NaN'));assert.throws(()=>money('1e3'));
});
test('missing rates never use reference prices or become zero; explicit zero is configured',()=>{
 const s=costSources(),before=JSON.stringify(s),r=calculateCosts(s,null);assert.equal(r.lines.length,8);assert.equal(r.total,null);assert.equal(r.knownSubtotal,null);assert.ok(r.lines.every(l=>l.status==='MISSING_RATE'&&l.subtotal===null));assert.equal(r.lines.find(l=>l.category==='HARDWARE')!.referencePrices[0].unitRaw,'999.00');
 const zero=calculateCosts(s,rules('0'));assert.equal(zero.total,'0.00');assert.equal(zero.status,'COMPLETE');assert.equal(JSON.stringify(s),before);
});
test('exact quantities, selectors, provenance and mutually exclusive panel bases',()=>{
 const s=costSources(),r=calculateCosts(s,rules('1'));assert.equal(r.lines.find(l=>l.category==='DRILLING')!.quantity,'4');assert.equal(r.lines.find(l=>l.category==='GROOVE')!.quantity,'0.201');assert.equal(r.lines.find(l=>l.category==='ROUTING')!.subtotal,'0.11');assert.equal(r.lines.filter(l=>l.category==='PANEL').length,1);assert.equal(r.lines.find(l=>l.category==='PANEL')!.quantity,'0.3');assert.equal(r.total,'8.11');
 for(const [panelBasis,unit,q] of [['OPTIMIZED_M2','m2','6'],['SHEETS','sheet','1']] as const){const x=calculateCosts(s,{...rules('1'),panelBasis});const p=x.lines.find(l=>l.category==='PANEL')!;assert.equal(p.quantity,q);assert.equal(p.unit,unit);assert.equal(p.status,'MISSING_RATE');assert.equal(x.lines.filter(l=>l.category==='PANEL').length,1);}
 assert.equal(r.lines.find(l=>l.category==='GROOVE')!.evidence[0].partId,'part');assert.deepEqual(calculateCosts(s,rules('1')),r);
});
test('missing reports, unresolved identities, mismatched rate units and failed coverage stay incomplete',()=>{
 const s=costSources();s.optimization!.result.totals.failedUnits=1;assert.equal(calculateCosts(s,rules('1')).total,null);
 const missing=calculateCosts({...s,optimization:null},rules('1'));assert.equal(missing.lines.find(l=>l.category==='EDGE_MATERIAL')!.quantity,null);assert.equal(missing.total,null);
 const bad=rules('1');bad.rates[0].unit='sheet';assert.equal(calculateCosts(costSources(),bad).total,null);
 s.bom!.result.panels[0].materialMasterId=null;assert.equal(calculateCosts(s,rules('1')).lines.find(l=>l.category==='PANEL')!.status,'MISSING_DATA');
});
