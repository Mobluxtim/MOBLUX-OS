import type {QuoteContent,QuoteCalculation,ClientQuoteView} from '../../contracts/quote.js';
import type {ClientPresentationView} from '../../contracts/presentation.js';
import {quoteLineVisible} from './calculation.js';
/** Customer response is explicitly constructed; no internal quote/rule/model object is spread. */
export function projectQuote(c:QuoteContent,r:QuoteCalculation,quoteNumber:number,projectVersionNumber:number,presentation:ClientPresentationView|null,sectionTitles:Map<string,string>):ClientQuoteView {
 const sections=c.sections.filter(s=>s.visible),t=r.totals;
 return {title:c.title,quoteNumber,projectVersionNumber,currency:c.currency,customerNotes:c.customerNotes,status:r.status,
  sections:sections.map((s,i)=>({key:String(i),title:s.title,description:s.description})),
  lines:c.lines.filter(l=>quoteLineVisible(c,l)).map(l=>{const amount=r.lines.find(x=>x.lineId===l.id)!;return {kind:l.kind,sectionKey:l.sectionId?String(sections.findIndex(s=>s.id===l.sectionId)):null,presentationSection:l.presentationSectionId?sectionTitles.get(l.presentationSectionId)??null:null,title:l.title,description:l.description,note:l.customerNote,quantity:l.quantity,unit:l.unit,offeredUnitPrice:l.pricingMode==='MANUAL_PRICE'?l.offeredUnitPrice:null,gross:amount.gross,discount:amount.discount,total:amount.total,status:amount.status==='PRICED'?'PRICED':'PRICE_PENDING'};}),
  totals:{subtotal:t.subtotal,discount:t.discount,beforeVat:t.beforeVat,vatPercent:t.vatPercent,vat:t.vat,withVat:t.withVat,deposit:t.deposit,balance:t.balance},
  depositTerms:{kind:c.deposit.kind,value:c.deposit.value} as ClientQuoteView['depositTerms'],presentation
 };
}
