export interface HardwareItem {
  sourceName: string; quantity: number; location: { page: number; row: number };
  sourceUnitPriceRaw?: string | null; sourceTotalPriceRaw?: string | null;
}
export interface HardwareResult {
  projectLabel: string; sourceDate: string; sourcePages: number; summaryPage: number;
  items: HardwareItem[]; itemCount: number; quantitySum: number;
  sourceTotalPriceRaw?: string | null;
}
export interface HardwareReport {
  id: string; modelId: string; versionId: string; sourceId: string; sourceHash: string; parserVersion: string;
  status: 'IMPORTED' | 'FAILED' | 'UNSUPPORTED'; result: HardwareResult | null; finding: string | null;
  createdBy: string; createdAt: string; pricesVisible: boolean;
}
