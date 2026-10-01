/** Technical metadata only: never supplier SKU, offer, price or stock availability. */
export const panelTypes = ['CHIPBOARD', 'MDF', 'FIBREBOARD_PFL_HDF', 'PLYWOOD_MULTILAYER', 'GLASS', 'OTHER', 'UNKNOWN'] as const;
export type PanelType = typeof panelTypes[number];
export interface VerifiedTechnicalValue<T> { value: T; evidence: string; }
export interface MaterialProfile {
  policyVersion: string;
  panelType: PanelType;
  status: 'SOURCE_DECLARED' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';
  reason: string;
  source: { snapshotId: string; hash: string; recordId: string; candidateUuid: string; name: string };
  thickness: VerifiedTechnicalValue<{ value: string; unit: 'mm' }> | null;
  purchasingBasis: {
    unit: VerifiedTechnicalValue<'SHEET' | 'M2' | 'LINEAR_M' | 'PIECE' | 'ROLL'> | null;
    stockSheet: VerifiedTechnicalValue<{ lengthMm: string; widthMm: string }> | null;
  };
  // Only verified values belong here; appearance/flags/binary numbers are not attributes.
  attributes: { key: 'SUBSTRATE' | 'FINISH' | 'GRADE'; value: string; evidence: string }[];
}
export interface StoredMaterialProfile {
  id: string; materialMasterId: string; policyVersion: string; result: MaterialProfile;
  createdAt: string; createdBy: string;
}
