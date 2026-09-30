import { z } from 'zod';
export const uuid = z.string().uuid();
export const customerInput = z.object({ name: z.string().trim().min(2).max(160), email: z.union([z.literal(''), z.string().trim().email().max(254)]), phone: z.string().trim().max(60), address: z.string().trim().max(500) }).strict();
export const projectInput = z.object({ customerId: uuid, name: z.string().trim().min(2).max(160), description: z.string().trim().max(2000) }).strict();
export const versionInput = z.object({ summary: z.string().trim().min(3).max(2000), requestId: uuid }).strict();
export interface Customer { id: string; name: string; email: string; phone: string; address: string; createdAt: string; }
export interface Project { id: string; customerId: string; name: string; description: string; createdAt: string; }
export interface Version { id: string; projectId: string; number: number; summary: string; createdAt: string; snapshot?: { normalizedData: { modelId: string } | null }; }
export interface Source { id: string; projectId: string; versionId: string; name: string; size: number; hash: string; createdAt: string; status: 'PENDING_MAPPING' | 'NEEDS_REVIEW' | 'FAILED'; findings: string[]; csvAttempts: { id: string; profile: string; status: string; createdAt: string }[]; }
export interface Activity { id: string; event: string; entityId: string; actor: string; createdAt: string; details: Record<string, unknown>; }
export interface ProjectDetail { project: Project; customer: Customer; versions: Version[]; sources: Source[]; activity: Activity[]; }
export interface Identity { id: string; name: string; email: string; capabilities: string[]; }
