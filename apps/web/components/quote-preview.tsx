'use client';
import {useEffect,useState} from 'react';
import type {ClientQuoteView,Adjustment} from '../../../packages/contracts/quote';
import {money} from '../../../packages/modules/costing/decimal';
import {displayQuantity} from '../../../packages/contracts/decimal-display';
import {PresentationView} from './presentation-preview';
import {api} from './api';
export const quoteMoney=(value:string|null)=>value===null?'Not specified':money(value);
export function QuoteTotalsView({totals:t,currency,deposit}:{totals:ClientQuoteView['totals'];currency:string;deposit:Adjustment}){
 return <div className="quote-totals"><dl>{[['Subtotal',t.subtotal],['Discount',t.discount],['Total before VAT',t.beforeVat],[`VAT${t.vatPercent===null?' — not configured':` (${displayQuantity(t.vatPercent)}%)`}`,t.vat],['Total with VAT',t.withVat],['Requested deposit',t.deposit],['Remaining balance',t.balance]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value===null?'Not specified':`${quoteMoney(value)} ${currency}`}</dd></div>)}</dl><p>{deposit.kind==='NONE'?'Deposit not specified.':deposit.kind==='PERCENT'?`Requested advance: ${displayQuantity(deposit.value)}% of total with VAT.`:`Requested advance: ${quoteMoney(deposit.value)} ${currency}.`} This is an offer, not a payment confirmation.</p></div>;
}
export function QuoteView({data:q}:{data:ClientQuoteView}){
 function lines(key:string|null){const lines=q.lines.filter(l=>l.sectionKey===key);return lines.length?<div className="quote-lines">{lines.map((l,i)=><article key={i}><div><h3>{l.title}</h3>{l.presentationSection&&<p>{l.presentationSection}</p>}<p className="preserve">{l.description}</p>{l.note&&<p className="preserve">{l.note}</p>}</div><div><p>{l.quantity!==null?`${displayQuantity(l.quantity)} ${l.unit}`:l.unit}{l.offeredUnitPrice!==null&&<> × {quoteMoney(l.offeredUnitPrice)} {q.currency}</>}</p>{l.discount!==null&&l.discount!=='0.00'&&<p>Discount: {quoteMoney(l.discount)} {q.currency}</p>}<strong>{l.status==='PRICE_PENDING'?'Price pending':`${quoteMoney(l.total)} ${q.currency}`}</strong></div></article>)}</div>:null;}
 return <><article className="client-presentation quote-presentation"><header><span className="eyebrow">MOBLUX · PROJECT V{q.projectVersionNumber} · QUOTE {q.quoteNumber}</span><h1>{q.title}</h1>{q.status==='INCOMPLETE'&&<p role="note">Incomplete offer — pricing or VAT is still being prepared.</p>}</header>{lines(null)}{q.sections.map(s=><section key={s.key} className="presentation-room"><h2>{s.title}</h2><p className="preserve">{s.description}</p>{lines(s.key)}</section>)}<QuoteTotalsView totals={q.totals} currency={q.currency} deposit={q.depositTerms}/>{q.customerNotes&&<section><h2>Commercial notes</h2><p className="preserve">{q.customerNotes}</p></section>}</article>{q.presentation&&<PresentationView data={q.presentation}/>}</>;
}
export function QuotePreview({projectId,versionId,quoteId}:{projectId:string;versionId:string;quoteId:string}){
 const [data,setData]=useState<ClientQuoteView>(),[error,setError]=useState('');useEffect(()=>{let active=true;api<ClientQuoteView>(`/projects/${projectId}/versions/${versionId}/quotes/${quoteId}/preview`).then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[projectId,versionId,quoteId]);
 return <main className="presentation-preview"><p className="preview-mode">Client quote preview · internal preparation only</p>{error?<p role="alert">{error}</p>:data?<QuoteView data={data}/>:<p>Loading quote…</p>}</main>;
}
