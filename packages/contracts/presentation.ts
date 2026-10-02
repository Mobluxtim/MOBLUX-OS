import {z} from 'zod';
export const mediaKinds=['TECHNICAL_PRESENTATION','RENDER','REFERENCE_INSPIRATION'] as const;
export const visibilityModes=['INTERNAL_ONLY','CLIENT_PRESENTATION','DESIGN_DELIVERABLE_FUTURE'] as const;
export const itemKinds=['FURNITURE','MATERIAL','HARDWARE','SERVICE','NOTE'] as const;
const text=z.string().trim().max(4000);
const visibility=z.enum(visibilityModes);
export const presentationContentSchema=z.object({
 title:z.string().trim().min(1).max(200),description:text,
 sections:z.array(z.object({id:z.uuid(),title:z.string().trim().min(1).max(200),description:text,visibility}).strict()).max(50),
 items:z.array(z.object({id:z.uuid(),kind:z.enum(itemKinds),sectionId:z.uuid().nullable(),title:z.string().trim().min(1).max(200),description:text,visibility,reference:z.discriminatedUnion('kind',[
  z.object({kind:z.literal('MATERIAL'),materialMasterId:z.uuid()}).strict(),
  z.object({kind:z.literal('HARDWARE'),reportId:z.uuid(),itemIndex:z.number().int().min(0).max(5000)}).strict()
 ]).nullable()}).strict()).max(200),
 media:z.array(z.object({assetId:z.uuid(),sectionId:z.uuid().nullable(),caption:z.string().trim().max(1000),visibility}).strict()).max(50),
 coverAssetId:z.uuid().nullable()
}).strict().superRefine((c,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 for(const ids of [c.sections.map(s=>s.id),c.items.map(i=>i.id),c.media.map(m=>m.assetId)])if(new Set(ids).size!==ids.length)fail('Duplicate presentation item');
 for(const i of [...c.items,...c.media])if(i.sectionId&&!c.sections.some(s=>s.id===i.sectionId))fail('Section does not exist');
 for(const i of c.items)if(i.reference&&i.reference.kind!==i.kind)fail('Reference does not match item kind');
 if(c.coverAssetId&&!c.media.some(m=>m.assetId===c.coverAssetId&&m.visibility==='CLIENT_PRESENTATION'&&(!m.sectionId||c.sections.some(s=>s.id===m.sectionId&&s.visibility==='CLIENT_PRESENTATION'))))fail('Cover must be a visible presentation image in a visible section');
});
export type PresentationContent=z.infer<typeof presentationContentSchema>;
export type MediaKind=typeof mediaKinds[number];
export interface PresentationRevision {id:string;presentationId:string;number:number;previousId:string|null;content:PresentationContent;contentHash:string;createdAt:string;createdBy:string;}
export interface PresentationAsset {id:string;kind:MediaKind;name:string;hash:string;displayHash:string;mime:string;size:number;width:number;height:number;provenance:string;createdAt:string;}
export interface PresentationState {presentationId:string|null;versionNumber:number;revisions:PresentationRevision[];assets:PresentationAsset[];references:{kind:'MATERIAL'|'HARDWARE';label:string;materialMasterId?:string;reportId?:string;itemIndex?:number}[];canEdit:boolean;canPreview:boolean;}
/** Client-safe DTO: deliberately no technical identity, quantities, provenance, prices or audit. */
export interface ClientPresentationView {
 title:string;description:string;versionNumber:number;
 sections:{key:string;title:string;description:string}[];
 items:{kind:typeof itemKinds[number];sectionKey:string|null;title:string;description:string}[];
 media:{url:string;kind:MediaKind;caption:string;sectionKey:string|null}[];
 coverUrl:string|null;
}
