export const libraryCategories = ['PANEL', 'EDGE', 'BAR'] as const;
export type LibraryCategory = typeof libraryCategories[number];
export type ThicknessEvidence = { value: string; unit: 'mm'; confidence: 'CORROBORATED'; evidence: string };
export interface LibraryRecord {
  id: string; index: number; offset: number; endOffset: number;
  category: LibraryCategory; name: string; group: string; candidateUuid: string; candidateIdHex: string;
  thickness: ThicknessEvidence | null;
  thicknessCandidate: string | null;
  textures: { reference: string; role: 'UNKNOWN'; offset: number }[];
  rawHex: string; unmapped: string[];
}
export interface LibraryResult {
  status: 'NEEDS_REVIEW' | 'FAILED'; storedCount: number | null; recordCount: number;
  decodedHash: string | null; headerHex: string; payloadPrefixHex: string;
  findings: string[]; records: LibraryRecord[];
}
export interface LibrarySnapshot {
  id: string; category: LibraryCategory; filename: string; hash: string; size: number;
  parserVersion: string; status: LibraryResult['status']; recordCount: number;
  createdAt: string; createdBy: string;
}
export interface LibrarySnapshotDetail extends LibrarySnapshot { result: LibraryResult; profiles: import('./material-profile.js').MaterialProfile[]; }
export type MatchStatus = 'EXACT_UNIQUE' | 'AMBIGUOUS' | 'NO_MATCH' | 'REVIEW_REQUIRED';
export interface MaterialMatch {
  category: 'PANEL' | 'EDGE'; name: string; thickness: string; unit: 'mm';
  sourceRefs: string[]; status: MatchStatus; reason: string;
  candidates: { snapshotId: string; recordId: string; index: number; candidateUuid: string }[];
}
export interface MatchReport {
  id: string; projectId: string; modelId: string; versionId: string; snapshotIds: string[];
  matcherVersion: string; results: MaterialMatch[]; createdAt: string; createdBy: string;
}
