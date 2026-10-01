export interface OptimizationLocation { page: number; row: number; }
export interface OptimizationLink { materialMasterId: string | null; linkStatus: 'EXACT_UNIQUE' | 'UNRESOLVED'; }
export interface OptimizationPanel extends OptimizationLink {
  name: string; thicknessMm: string; lengthMm: string; widthMm: string; sheets: number;
  sheetAreaM2: string; placedUnits: number; cuttingLengthM: null; location: OptimizationLocation;
  maps: { number: number; sheets: number; placedUnits: number; wastePercent: string; location: OptimizationLocation }[];
}
export interface OptimizationResult {
  projectLabel: string; sourceDate: string; sourcePages: number; cuttingRows: number;
  totals: { sheets: number; placedUnits: number; requestedUnits: number; failedUnits: number; sheetAreaM2: string; partAreaM2: string; wastePercent: string; edgeLengthM: string; cuttingLengthM: string; location: OptimizationLocation };
  panels: OptimizationPanel[];
  edges: (OptimizationLink & { name: string; thicknessMm: string; lengthM: string; location: OptimizationLocation })[];
  failed: { sourceNumber: number; materialLabel: string; reference: string; cabinet: string; dimensionsRaw: string; failedUnits: number; requestedUnits: number; reasonRaw: string; truncated: boolean; partId: null; location: OptimizationLocation }[];
  findings: string[];
}
export interface OptimizationReport {
  id: string; modelId: string; sourceId: string; resolutionId: string; sourceHash: string; parserVersion: string;
  status: 'IMPORTED' | 'FAILED' | 'UNSUPPORTED'; result: OptimizationResult | null; finding: string | null;
  createdAt: string; createdBy: string;
}
