import {z} from 'zod';
const decimal=z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/);
export const paymentTriggers=['ON_APPROVAL','BEFORE_PRODUCTION_RELEASE','BEFORE_INSTALLATION','AFTER_INSTALLATION','AFTER_CUSTOMER_ACCEPTANCE','MANUAL_CUSTOM'] as const;
export const milestoneSchema=z.object({id:z.uuid(),title:z.string().trim().min(1).max(200),description:z.string().max(2000),basis:z.enum(['PERCENT','FIXED']),value:decimal,trigger:z.enum(paymentTriggers),requiredForProduction:z.boolean(),visible:z.boolean(),internalNotes:z.string().max(2000),customerNotes:z.string().max(2000)}).strict();
export const planSchema=z.object({requestId:z.uuid(),previousId:z.uuid().nullable(),reason:z.string().trim().min(1).max(1000),milestones:z.array(milestoneSchema).min(1).max(50)}).strict().superRefine((p,ctx)=>{if(new Set(p.milestones.map(m=>m.id)).size!==p.milestones.length)ctx.addIssue({code:'custom',message:'Duplicate milestone IDs.'});});
export type Milestone=z.infer<typeof milestoneSchema>&{amountExact:string;amount:string;currency:string};
export const paymentReportSchema=z.object({requestId:z.uuid(),milestoneId:z.uuid(),amount:decimal,paymentDate:z.iso.date(),method:z.string().trim().min(1).max(100),reference:z.string().trim().max(500),evidenceSourceId:z.uuid().nullable(),internalNote:z.string().max(2000)}).strict();
export const paymentEventSchema=z.object({requestId:z.uuid(),action:z.enum(['CONFIRMED','REVERSED']),reason:z.string().trim().min(1).max(1000)}).strict();
export interface MilestoneState extends Milestone {confirmedAmount:string;reportedAmount:string;outstandingAmount:string;status:'PAYMENT_DUE'|'PAYMENT_REPORTED'|'PAYMENT_CONFIRMED';satisfied:boolean;}
export interface ClientPaymentView {planRevision:number;currency:string;milestones:{title:string;description:string;amount:string;confirmedAmount:string;outstandingAmount:string;status:MilestoneState['status'];dueTrigger:typeof paymentTriggers[number];customerNotes:string}[];}
