import type { LibraryRecord, MaterialMatch } from '../../contracts/library.js';
import { decimalIdentity } from '../projects/normalize.js';
export const libraryMatcherVersion = 'exact-corroborated-library/v1';
export interface MaterialRequest { category: 'PANEL' | 'EDGE'; name: string; thickness: string; unit: 'mm'; sourceRefs: string[]; }
export function proposeMatches(requests: MaterialRequest[], libraries: { id: string; records: LibraryRecord[] }[]): MaterialMatch[] {
  return requests.map(request => {
    const named = libraries.flatMap(s => s.records.filter(r => r.category === request.category && r.name === request.name).map(record => ({ snapshotId: s.id, record })));
    const exact = named.filter(({ record: r }) => r.thickness?.confidence === 'CORROBORATED' && r.thickness.unit === request.unit && decimalIdentity(r.thickness.value) === decimalIdentity(request.thickness));
    // A numeric candidate never becomes corroborated just because it compares equal.
    const uncertain = named.filter(({ record: r }) => !r.thickness && (r.thicknessCandidate === null || decimalIdentity(r.thicknessCandidate) === decimalIdentity(request.thickness)));
    const status = exact.length > 1 ? 'AMBIGUOUS' : uncertain.length ? 'REVIEW_REQUIRED' : exact.length === 1 ? 'EXACT_UNIQUE' : named.some(({ record: r }) => !r.thickness) ? 'REVIEW_REQUIRED' : 'NO_MATCH';
    const candidates = status === 'EXACT_UNIQUE' || status === 'AMBIGUOUS' ? exact : named;
    return { ...request, status, reason: status === 'EXACT_UNIQUE' ? 'Exact name and independently corroborated thickness/unit; proposal only.' : status === 'AMBIGUOUS' ? 'Multiple candidates satisfy the corroborated criteria. None selected.' : status === 'REVIEW_REQUIRED' ? 'Source-name candidates exist, but thickness semantics are not sufficiently corroborated.' : 'No candidate satisfies the confirmed criteria. No fuzzy matching applied.',
      candidates: candidates.map(({ snapshotId, record: r }) => ({ snapshotId, recordId: r.id, index: r.index, candidateUuid: r.candidateUuid })) };
  });
}
