import type { MaterialProfile } from '../../../packages/contracts/material-profile';
import { displayQuantity } from '../../../packages/contracts/decimal-display';
const labels = { CHIPBOARD: 'PAL / chipboard', MDF: 'MDF', FIBREBOARD_PFL_HDF: 'PFL / HDF fibreboard', PLYWOOD_MULTILAYER: 'Plywood / multilayer', GLASS: 'Glass', OTHER: 'Other', UNKNOWN: 'Unknown' };
export function MaterialProfileView({ profile }: { profile?: MaterialProfile }) {
  if (!profile) return <p>Classification: UNKNOWN / REVIEW_REQUIRED — resolved source evidence unavailable.</p>;
  return <div className="material-profile"><strong>{profile.status === 'NOT_APPLICABLE' ? 'PANEL type not applicable' : labels[profile.panelType]}</strong><p>{profile.status}</p>
    <p>Purchasing unit: {profile.purchasingBasis.unit?.value ?? 'Unverified'}</p>
    <p>Stock sheet: {profile.purchasingBasis.stockSheet ? `${displayQuantity(profile.purchasingBasis.stockSheet.value.lengthMm)} × ${displayQuantity(profile.purchasingBasis.stockSheet.value.widthMm)} mm` : 'Unverified'}</p>
    <details><summary>Classification evidence</summary><p>{profile.reason}</p><p>{profile.policyVersion}</p><p>Source record: {profile.source.recordId}<br />Snapshot: {profile.source.snapshotId}<br />SHA-256: {profile.source.hash}</p><p>Family classification does not establish purchasing quantities or manufacturing authorization.</p></details>
  </div>;
}
