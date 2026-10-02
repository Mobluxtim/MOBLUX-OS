import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {quoteFixture} from '../fixtures/quote.js';
import {quoteContentSchema} from '../../packages/contracts/quote.js';
import {calculateQuote} from '../../packages/modules/quotes/calculation.js';
import {projectQuote} from '../../packages/modules/quotes/projection.js';
test('manual prices, independent service, line/global discounts, configurable VAT and gross deposit use exact decimals',()=>{
 const c=quoteFixture(),r=calculateQuote(c);assert.equal(r.status,'COMPLETE');assert.equal(r.lines[0].grossExact,'246.913578');assert.equal(r.lines[0].netExact,'222.2222202');assert.equal(r.lines[0].total,'222.22');assert.equal(r.lines[1].total,'100.13');assert.deepEqual(r.totals,{subtotal:'347.04',lineDiscount:'24.69',quoteDiscount:'5.00',discount:'29.69',beforeVat:'317.35',vatPercent:'20',vatExact:'63.47',vat:'63.47',withVat:'380.82',depositExact:'114.246',deposit:'114.25',balance:'266.57'});
 c.vatPercent='7.5';c.deposit={kind:'AMOUNT',value:'100.123456'};const changed=calculateQuote(c);assert.equal(changed.totals.vatExact,'23.80125');assert.equal(changed.totals.withVat,'341.15');assert.equal(changed.totals.deposit,'100.12');assert.equal(changed.totals.balance,'241.03');assert.equal(r.totals.withVat,'380.82');
});
test('missing prices/VAT and future engine are incomplete; explicit zero is allowed; no implicit deposit',()=>{
 const c=quoteFixture();c.lines=[{...c.lines[1],offeredLineTotal:'0',discount:{kind:'NONE',value:null}}];c.discount={kind:'NONE',value:null};c.vatPercent='0';c.deposit={kind:'NONE',value:null};let r=calculateQuote(c);assert.equal(r.status,'COMPLETE');assert.equal(r.totals.withVat,'0.00');assert.equal(r.totals.deposit,null);assert.equal(r.totals.balance,null);
 c.lines[0].offeredLineTotal=null;r=calculateQuote(c);assert.equal(r.status,'INCOMPLETE');assert.equal(r.totals.withVat,null);
 c.lines[0].pricingMode='CALCULATED_PRICE';c.lines[0].calculatedPriceReference='INTERNAL_ENGINE_SENTINEL';r=calculateQuote(c);assert.equal(r.lines[0].status,'PRICE_PENDING');
 c.lines[0].pricingMode='MANUAL_PRICE';c.lines[0].offeredLineTotal='1';c.vatPercent=null;r=calculateQuote(c);assert.equal(r.totals.beforeVat,'1.00');assert.equal(r.totals.vat,null);assert.equal(r.totals.withVat,null);
});
test('invalid adjustments, inconsistent inputs and technical payloads are rejected',()=>{
 const c=quoteFixture();assert.equal(quoteContentSchema.safeParse(c).success,true);for(const bad of [{...c,vatPercent:'101'},{...c,vatPercent:'-1'},{...c,internalCost:'5'},{...c,lines:[{...c.lines[0],offeredLineTotal:'3'}]},{...c,lines:[{...c.lines[0],pricingMode:'CALCULATED_PRICE'}]}])assert.equal(quoteContentSchema.safeParse(bad).success,false);
 c.lines[0].discount={kind:'AMOUNT',value:'999999'};assert.throws(()=>calculateQuote(c),/exceeds/);c.lines[0].discount={kind:'NONE',value:null};c.discount={kind:'AMOUNT',value:'999999'};assert.throws(()=>calculateQuote(c),/exceeds/);c.discount={kind:'NONE',value:null};c.deposit={kind:'AMOUNT',value:'999999'};assert.throws(()=>calculateQuote(c),/exceeds/);
});
test('safe projection excludes hidden amounts/sections/internal notes/engine details and preserves independent commercial quantities',()=>{
 const c=quoteFixture(),hidden=randomUUID();c.sections=[{id:hidden,title:'HIDDEN_SECTION_SENTINEL',description:'internal',visible:false}];c.lines[2].visible=true;c.lines[2].sectionId=hidden;
 const r=calculateQuote(c),safe=projectQuote(c,r,1,2,null,new Map()),json=JSON.stringify(safe);
 for(const text of ['SENTINEL','999999','internalNote','calculatedPriceReference','grossExact','lineId','source','cost','margin','rules'])assert.ok(!json.includes(text),text);
 assert.equal(safe.lines.length,2);assert.equal(safe.sections.length,0);assert.equal(safe.lines[0].quantity,'2');assert.equal(safe.totals.withVat,'380.82');assert.equal(safe.presentation,null);assert.equal(c.internalNotes,'INTERNAL_QUOTE_SENTINEL');
 c.lines.forEach(l=>l.visible=false);assert.equal(calculateQuote(c).totals.withVat,null);
});
