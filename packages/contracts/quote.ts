import {z} from 'zod';
import type {ClientPresentationView} from './presentation.js';
export const quoteLineKinds=['FURNITURE','ACCESSORY','DESIGN','MEASUREMENT','TRAVEL','DELIVERY','INSTALLATION','OTHER_SERVICE'] as const;
const decimal=z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/);
const percent=decimal.refine(v=>{const [w,f='']=v.split('.');return BigInt(w+f)<=100n*10n**BigInt(f.length);},'Percentage must be between 0 and 100');
export const adjustmentSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('NONE'),value:z.null()}).strict(),
 z.object({kind:z.literal('AMOUNT'),value:decimal}).strict(),
 z.object({kind:z.literal('PERCENT'),value:percent}).strict()
]);
export const quoteContentSchema=z.object({
 title:z.string().trim().min(1).max(200),currency:z.enum(['RON','EUR','USD']),customerNotes:z.string().max(4000),internalNotes:z.string().max(4000),
 sections:z.array(z.object({id:z.uuid(),title:z.string().trim().min(1).max(200),description:z.string().max(2000),visible:z.boolean()}).strict()).max(50),
 lines:z.array(z.object({id:z.uuid(),kind:z.enum(quoteLineKinds),sectionId:z.uuid().nullable(),presentationSectionId:z.uuid().nullable(),title:z.string().trim().min(1).max(200),description:z.string().max(2000),customerNote:z.string().max(2000),internalNote:z.string().max(2000),visible:z.boolean(),pricingMode:z.enum(['MANUAL_PRICE','CALCULATED_PRICE']),calculatedPriceReference:z.string().max(200).nullable(),basis:z.enum(['UNIT_PRICE','LINE_TOTAL']),quantity:decimal.nullable(),unit:z.string().trim().max(40),offeredUnitPrice:decimal.nullable(),offeredLineTotal:decimal.nullable(),discount:adjustmentSchema}).strict()).max(200),
 discount:adjustmentSchema,vatPercent:percent.nullable(),deposit:adjustmentSchema
}).strict().superRefine((c,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 for(const ids of [c.sections.map(s=>s.id),c.lines.map(l=>l.id)])if(new Set(ids).size!==ids.length)fail('Duplicate quote item');
 for(const l of c.lines){if(l.sectionId&&!c.sections.some(s=>s.id===l.sectionId))fail('Quote section does not exist');if(l.basis==='UNIT_PRICE'&&l.offeredLineTotal!==null||l.basis==='LINE_TOTAL'&&l.offeredUnitPrice!==null)fail('Enter either a unit price or a line total, not both');if(l.pricingMode==='CALCULATED_PRICE'&&(l.offeredUnitPrice!==null||l.offeredLineTotal!==null))fail('Calculated pricing is a placeholder; choose manual mode to offer a price');}
});
export type QuoteContent=z.infer<typeof quoteContentSchema>;
export type Adjustment=z.infer<typeof adjustmentSchema>;
export interface QuoteLineCalculation {lineId:string;grossExact:string|null;discountExact:string|null;netExact:string|null;gross:string|null;discount:string|null;total:string|null;status:'PRICED'|'PRICE_PENDING'|'HIDDEN';}
export interface QuoteTotals {subtotal:string|null;lineDiscount:string|null;quoteDiscount:string|null;discount:string|null;beforeVat:string|null;vatPercent:string|null;vatExact:string|null;vat:string|null;withVat:string|null;depositExact:string|null;deposit:string|null;balance:string|null;}
export interface QuoteCalculation {lines:QuoteLineCalculation[];totals:QuoteTotals;status:'COMPLETE'|'INCOMPLETE';issues:string[];}
export interface QuoteVersion {id:string;projectId:string;versionId:string;number:number;previousId:string|null;presentationRevisionId:string|null;content:QuoteContent;result:QuoteCalculation;contentHash:string;algorithmVersion:string;createdAt:string;createdBy:string;}
export interface QuoteState {versionNumber:number;history:QuoteVersion[];presentations:{id:string;number:number;title:string;sections:{id:string;title:string}[]}[];canEdit:boolean;canPreview:boolean;}
export interface ClientQuoteView {
 title:string;quoteNumber:number;projectVersionNumber:number;currency:QuoteContent['currency'];customerNotes:string;status:QuoteCalculation['status'];
 sections:{key:string;title:string;description:string}[];
 lines:{kind:typeof quoteLineKinds[number];sectionKey:string|null;presentationSection:string|null;title:string;description:string;note:string;quantity:string|null;unit:string;offeredUnitPrice:string|null;gross:string|null;discount:string|null;total:string|null;status:'PRICED'|'PRICE_PENDING'}[];
 totals:{subtotal:string|null;discount:string|null;beforeVat:string|null;vatPercent:string|null;vat:string|null;withVat:string|null;deposit:string|null;balance:string|null};
 depositTerms:Adjustment;presentation:ClientPresentationView|null;
}
