// Distinct contracts for later workflows. No approval or release command exists in this slice.
export interface ApprovalEvidence { projectId: string; projectVersionId: string; customerId: string; approvedReferences: readonly string[]; occurredAt: string; }
export interface ProductionReleaseSnapshot { projectId: string; projectVersionId: string; manufacturingSourceIds: readonly string[]; gateEvidenceIds: readonly string[]; releasedBy: string; releasedAt: string; }
