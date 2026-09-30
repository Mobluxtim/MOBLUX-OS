import { audit } from '../../../database/schema.js';
import type { Transaction } from '../../infrastructure/db.js';
export async function record(tx: Transaction, actorId: string, event: string, entityId: string, projectId: string | null, details: Record<string, unknown>) { await tx.insert(audit).values({ actorId, event, entityId, projectId, details }); }
