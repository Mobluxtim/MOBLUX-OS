import type {QuoteContent,Adjustment,QuoteCalculation,QuoteLineCalculation} from '../../contracts/quote.js';
import {add,multiply,money} from '../costing/decimal.js';
import {DomainError} from '../identity/policy.js';
export const quoteAlgorithm='commercial-quote/line-half-up-2/v1';
function scaled(a:string,b:string){const [aw,af='']=a.split('.'),[bw,bf='']=b.split('.'),scale=Math.max(af.length,bf.length);return {x:BigInt(aw+af.padEnd(scale,'0')),y:BigInt(bw+bf.padEnd(scale,'0')),scale};}
function subtract(a:string,b:string){const {x,y,scale}=scaled(a,b);if(y>x)throw new DomainError(400,'Discount or deposit exceeds its applicable amount.');const s=(x-y).toString().padStart(scale+1,'0');return scale?s.slice(0,-scale)+'.'+s.slice(-scale):s;}
function percentOf(amount:string,percent:string){return multiply(multiply(amount,percent),'0.01');}
function adjustment(base:string,a:Adjustment){const value=a.kind==='NONE'?'0':a.kind==='AMOUNT'?a.value:percentOf(base,a.value);subtract(base,value);return value;}
export const quoteLineVisible=(c:QuoteContent,l:QuoteContent['lines'][number])=>l.visible&&(!l.sectionId||c.sections.some(s=>s.id===l.sectionId&&s.visible));
/** No BOM or CostingRun dependency. Offered prices alone determine the commercial totals. */
export function calculateQuote(c:QuoteContent):QuoteCalculation {
 const issues:string[]=[],lines:QuoteLineCalculation[]=c.lines.map(l=>{
  const blank={lineId:l.id,grossExact:null,discountExact:null,netExact:null,gross:null,discount:null,total:null};
  if(!quoteLineVisible(c,l))return {...blank,status:'HIDDEN'};
  const grossExact=l.pricingMode==='CALCULATED_PRICE'?null:l.basis==='LINE_TOTAL'?l.offeredLineTotal:l.quantity!==null&&l.offeredUnitPrice!==null?multiply(l.quantity,l.offeredUnitPrice):null;
  if(grossExact===null){issues.push(`Offered price missing: ${l.title}`);return {...blank,status:'PRICE_PENDING'};}
  const discountExact=adjustment(grossExact,l.discount),netExact=subtract(grossExact,discountExact),gross=money(grossExact),total=money(netExact);
  return {lineId:l.id,grossExact,discountExact,netExact,gross,discount:money(subtract(gross,total)),total,status:'PRICED'};
 });
 const visible=lines.filter(l=>l.status!=='HIDDEN'),ready=visible.length>0&&visible.every(l=>l.status==='PRICED');
 const totals:QuoteCalculation['totals']={subtotal:null,lineDiscount:null,quoteDiscount:null,discount:null,beforeVat:null,vatPercent:c.vatPercent,vatExact:null,vat:null,withVat:null,depositExact:null,deposit:null,balance:null};
 if(!visible.length)issues.push('No visible offered lines.');
 if(ready){
  const sum=(field:'gross'|'discount'|'total')=>money(visible.reduce((n,l)=>add(n,l[field]!), '0'));
  totals.subtotal=sum('gross');totals.lineDiscount=sum('discount');const afterLines=sum('total');totals.quoteDiscount=money(adjustment(afterLines,c.discount));totals.discount=money(add(totals.lineDiscount,totals.quoteDiscount));totals.beforeVat=money(subtract(afterLines,totals.quoteDiscount));
  if(c.vatPercent!==null){totals.vatExact=percentOf(totals.beforeVat,c.vatPercent);totals.vat=money(totals.vatExact);totals.withVat=money(add(totals.beforeVat,totals.vat));
   if(c.deposit.kind!=='NONE'){totals.depositExact=adjustment(totals.withVat,c.deposit);totals.deposit=money(totals.depositExact);totals.balance=money(subtract(totals.withVat,totals.deposit));}
  }
 }
 if(c.vatPercent===null)issues.push('VAT not configured.');
 return {lines,totals,status:ready&&c.vatPercent!==null?'COMPLETE':'INCOMPLETE',issues};
}
