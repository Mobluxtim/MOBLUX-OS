export interface BomSource {
  partId: string; partName: string; reference: string; cabinetId: string | null; cabinetName: string | null;
  cabinetSourceLabel: string; cabinetLink: 'LINKED' | 'AMBIGUOUS' | 'UNMAPPED';
  sourceId: string; sourceHash: string; reportId: string; row: number; line: number;
  quantity: number; firstMm: string; secondMm: string;
}
export interface PanelRequirement {
  key: string; materialMasterId: string | null; name: string; thicknessMm: string;
  partRows: number; units: number; areaM2: string;
  contributions: (BomSource & { technicalMaterialId: string; areaM2: string })[];
}
export interface EdgeRequirement {
  key: string; materialMasterId: string | null; name: string; thicknessMm: string;
  slotRows: number; occurrences: number; lengthM: null; status: 'ORIENTATION_UNVERIFIED';
  contributions: (BomSource & { slot: number; side: null })[];
}
export interface BomResult {
  modelId: string; versionId: string; status: 'NET_PANEL_READY' | 'PARTIAL';
  totals: { cabinets: number; partRows: number; units: number; panelAreaM2: string; populatedEdgeSlots: number; edgeOccurrences: number };
  panels: PanelRequirement[]; edges: EdgeRequirement[]; issues: string[];
}
export interface BomReport { id: string; resolutionId: string; algorithmVersion: string; result: BomResult; createdAt: string; createdBy: string; }
