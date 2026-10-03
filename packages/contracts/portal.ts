import {z} from 'zod';
import type {ClientQuoteView} from './quote.js';
export interface PortalSnapshot {projectTitle:string;presentationNumber:number;quote:ClientQuoteView;confirmation:string;}
export type PortalStatus='PENDING_CLIENT'|'CHANGES_REQUESTED'|'APPROVED'|'SUPERSEDED';
export interface PortalView {snapshotId:string;hash:string;content:PortalSnapshot;status:PortalStatus;approvedAt:string|null;}
export const issueAccessSchema=z.object({requestId:z.uuid(),quoteId:z.uuid(),projectTitle:z.string().trim().min(1).max(200),contactName:z.string().trim().min(1).max(200),contactEmail:z.email().max(254),expiresInHours:z.number().int().min(1).max(168)}).strict();
export const clientActionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('APPROVE'),requestId:z.uuid(),snapshotId:z.uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('REQUEST_CHANGES'),requestId:z.uuid(),snapshotId:z.uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/),message:z.string().trim().min(1).max(4000)}).strict()
]);
