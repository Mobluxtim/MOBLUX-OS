import type { LibraryRecord } from '../../contracts/library.js';
import type { MaterialProfile, PanelType } from '../../contracts/material-profile.js';

export const classificationVersion = 'source-declared-panel/v1';
// Evidence-specific rules, not manufacturer/decor heuristics or a general name classifier.
// The source itself explicitly names these families; density, composition and purchase format
// are not established. See POLYBOARD_LIBRARY_ANALYSIS.md / MATERIAL_CLASSIFICATION.md.
const panelHash = '66ab704b818a96315a46c8d09f65c0e79cd347e2a072331b081e2f8696907cbf';
const declared: Record<string, { name: string; thickness: string; type: PanelType; token: string }> = {
  'fb50ddfb-1cb0-40dd-9530-cb1c3728f109': { name: '--PFL--0110 PE(Alb)', thickness: '3', type: 'FIBREBOARD_PFL_HDF', token: 'PFL' },
  'c79d6d80-8005-4963-9619-912dc4ac4e52': { name: 'zz-Glass 0080 tr nou', thickness: '22', type: 'GLASS', token: 'Glass' }
};
export function classifyMaterial(snapshotId: string, hash: string, row: LibraryRecord): MaterialProfile {
  const evidence = row.category === 'PANEL' && hash === panelHash ? declared[row.candidateUuid] : undefined;
  const supported = evidence && evidence.name === row.name && row.thickness?.confidence === 'CORROBORATED'
    && row.thickness.unit === 'mm' && row.thickness.value === evidence.thickness;
  return {
    policyVersion: classificationVersion,
    panelType: supported ? evidence.type : 'UNKNOWN',
    status: row.category !== 'PANEL' ? 'NOT_APPLICABLE' : supported ? 'SOURCE_DECLARED' : 'REVIEW_REQUIRED',
    reason: row.category !== 'PANEL' ? 'PANEL substrate classification does not apply to this source category.'
      : supported ? `Exact source explicitly declares ${evidence.token}; family only, not a verified grade, composition or purchasing format.`
        : 'No verified substrate declaration for this exact source record. Decor, group, texture and thickness do not establish substrate.',
    source: { snapshotId, hash, recordId: row.id, candidateUuid: row.candidateUuid, name: row.name },
    thickness: row.thickness ? { value: { value: row.thickness.value, unit: row.thickness.unit }, evidence: row.thickness.evidence } : null,
    purchasingBasis: { unit: null, stockSheet: null }, attributes: []
  };
}
