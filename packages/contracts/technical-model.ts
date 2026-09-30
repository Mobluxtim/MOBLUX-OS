import type { ImportedCabinet, ImportedPart } from './imports.js';
export interface ModelIssue { code: string; message: string; entity: 'model' | 'cabinet' | 'part'; row?: number; }
export interface ModelSummary { cabinets: number; partRows: number; units: number; materials: number; linkedRows: number; ambiguousRows: number; unmappedRows: number; }
export interface TechnicalCabinet {
  id: string; versionId: string; reportId: string; sourceId: string; sourceRow: number; sourceLine: number;
  name: string; quantity: number; dimensions: ImportedCabinet['dimensions'];
}
export interface TechnicalMaterial { id: string; versionId: string; key: string; description: string; thickness: string; unit: 'mm'; }
export interface TechnicalPart {
  id: string; versionId: string; cabinetId: string | null; materialId: string; reportId: string; sourceId: string;
  sourceRow: number; sourceLine: number; linkStatus: 'LINKED' | 'AMBIGUOUS' | 'UNMAPPED';
  data: ImportedPart;
}
export interface TechnicalEdge { versionId: string; partId: string; slot: number; material: string; thickness: string; unit: 'mm'; side: null; }
export interface TechnicalModel {
  id: string; projectId: string; versionId: string; baseVersionId: string; cabinetReportId: string; partReportId: string;
  normalizer: string; summary: ModelSummary; issues: ModelIssue[]; createdAt: string; createdBy: string; versionNumber: number;
}
export interface TechnicalModelDetail {
  model: TechnicalModel; cabinets: TechnicalCabinet[]; parts: TechnicalPart[]; materials: TechnicalMaterial[]; edges: TechnicalEdge[];
  sources: { id: string; name: string; hash: string; objectVersion: string | null }[];
}
