import type { LibraryCategory, MaterialMatch } from './library.js';
import type { BomReport } from './bom.js';
import type { StoredMaterialProfile } from './material-profile.js';
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
  profiles: StoredMaterialProfile[];
  bom: BomReport | null;
  current: ResolutionReport | null; history: ResolutionReport[]; stale: boolean;
  active: ActiveLibrary[];
}
