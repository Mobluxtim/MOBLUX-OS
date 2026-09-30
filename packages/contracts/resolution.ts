import type { LibraryCategory, MaterialMatch } from './library.js';
export interface ActiveLibrary {
  category: LibraryCategory; snapshotId: string; filename: string; hash: string;
  activationId: string; activatedAt: string;
}
export interface ResolvedMaterial extends MaterialMatch { materialMasterId: string | null; }
export interface ResolutionReport {
  id: string; modelId: string; inputKey: string; resolverVersion: string;
  snapshots: ActiveLibrary[]; results: ResolvedMaterial[]; createdAt: string; createdBy: string;
}
export interface ResolutionState {
  current: ResolutionReport | null; history: ResolutionReport[]; stale: boolean;
  active: ActiveLibrary[];
}
