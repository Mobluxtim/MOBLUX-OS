export const csvProfiles = ['polyboard-cabinets-7/v1', 'polyboard-cutting-18/v1'] as const;
export type CsvProfile = typeof csvProfiles[number];
export interface CsvFinding { code: string; severity: 'error' | 'warning'; message: string; row?: number; column?: number; }
export interface CsvRecord { row: number; line: number; raw: string[]; }
export interface ImportedCabinet extends CsvRecord {
  kind: 'cabinet'; name: string; quantity: number;
  dimensions: { height: string; width: string; depth: string; unit: 'mm' };
  // Quantity is one in every observed cabinet. The two price positions cannot be distinguished.
  unmapped: { priceColumn6: string; priceColumn7: string };
}
export interface ImportedPart extends CsvRecord {
  kind: 'part'; sourceNumber: string; projectLabel: string; cabinetLabel: string; name: string; quantity: number;
  dimensions: { first: string; second: string; unit: 'mm'; axisConvention: null };
  material: { description: string; thickness: string; unit: 'mm'; catalogId: null };
  unmapped: { column10: string; edgeSlots: { slot: number; material: string; thickness: string; unit: 'mm'; side: null }[] };
}
export interface CsvResult {
  schemaVersion: 1; profile: CsvProfile; status: 'NEEDS_REVIEW' | 'FAILED'; manufacturingVerified: false;
  format: { encoding: 'UTF-8'; delimiter: ';'; header: false; bom: boolean };
  summary: { rows: number; quantity: number; cabinetLabels: number; materials: number };
  records: (ImportedCabinet | ImportedPart)[]; findings: CsvFinding[];
}
export interface CsvImportReport {
  id: string; sourceId: string; requestId: string; profile: CsvProfile; status: CsvResult['status'];
  result: CsvResult; createdAt: string; createdBy: string;
  source: { name: string; hash: string; projectId: string; versionId: string };
}
