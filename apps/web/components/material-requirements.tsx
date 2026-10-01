'use client';
import type { BomReport, BomSource } from '../../../packages/contracts/bom';
import type { StoredMaterialProfile } from '../../../packages/contracts/material-profile';
import { displayQuantity } from '../../../packages/contracts/decimal-display';
import { MaterialProfileView } from './material-profile';
function SourceRow({ row }: { row: BomSource }) {
  return <p>{row.cabinetName ?? `${row.cabinetSourceLabel} (${row.cabinetLink})`} → {row.partName} · ref {row.reference}<br />
    {displayQuantity(row.firstMm)} × {displayQuantity(row.secondMm)} mm · {row.quantity} units<br />
    Cabinet: {row.cabinetId ?? 'Unmapped'} · Part: {row.partId}<br />
    Source: {row.sourceId} · row {row.row} · line {row.line}<br />Report: {row.reportId}<br /><code>{row.sourceHash}</code></p>;
}
export function MaterialRequirements({ bom, profiles }: { bom: BomReport; profiles: StoredMaterialProfile[] }) {
  const { result } = bom;
  return <section className="bom-review" aria-label="Automatic material requirements">
    <h3>Material requirements / BOM</h3>
    <p className="bom-totals" title={`Exact stored total: ${result.totals.panelAreaM2} m²`}>{result.totals.units} panel units · {displayQuantity(result.totals.panelAreaM2)} m² net exported rectangular area</p>
    <p className="classification-totals">PANEL classifications: {result.panels.filter(p => profiles.some(c => c.materialMasterId === p.materialMasterId && c.result.status === 'SOURCE_DECLARED')).length}/{result.panels.length} source-declared · {result.panels.filter(p => !profiles.some(c => c.materialMasterId === p.materialMasterId && c.result.status === 'SOURCE_DECLARED')).length} require evidence review</p>
    <p>Current technical classification is separate from the immutable BOM below. Display rounded to at most 2 decimals; calculations retain full precision. Purchasing basis remains unverified.</p>
    <p>Calculated from exported dimensions × quantity. No waste, cut-out deductions, optimization or purchasing quantities.</p>
    <div className="table-wrap"><table><thead><tr><th>PANEL / thickness</th><th>Classification / purchasing basis</th><th>Rows / units</th><th>Net area (m²)</th><th>Drill-down</th></tr></thead><tbody>{result.panels.map(p => <tr key={p.key}><td>{p.name}<p>{displayQuantity(p.thicknessMm)} mm</p><small>{p.materialMasterId ? 'Resolved material' : 'Material resolution required'}</small></td><td><MaterialProfileView profile={profiles.find(c => c.materialMasterId === p.materialMasterId)?.result} /></td><td>{p.partRows} / {p.units}</td><td title={`Exact: ${p.areaM2}`}>{displayQuantity(p.areaM2)}</td><td><details><summary>Panel sources ({p.partRows})</summary><p>MaterialMaster: {p.materialMasterId ?? 'Unresolved'}</p>{p.contributions.map(c => <div key={c.partId}><SourceRow row={c} /><p title={`Exact: ${c.areaM2}`}>Contribution: {displayQuantity(c.areaM2)} m² · Version material: {c.technicalMaterialId}</p></div>)}</details></td></tr>)}</tbody></table></div>
    {result.edges.length > 0 && <><h4>EDGE — length unresolved</h4><p>Material/thickness pairs are confirmed. Slot counts are traceability counts, not linear metres. Edge orientation is unverified; no length is inferred.</p>
      <div className="table-wrap"><table><thead><tr><th>EDGE / thickness</th><th>Source slots / quantity-weighted occurrences</th><th>Length</th><th>Drill-down</th></tr></thead><tbody>{result.edges.map(e => <tr key={e.key}><td>{e.name}<p>{e.thicknessMm} mm · {e.materialMasterId ? 'Resolved material' : 'Unresolved material'}</p></td><td>{e.slotRows} / {e.occurrences}</td><td>Unknown</td><td><details><summary>Edge sources ({e.slotRows})</summary><p>MaterialMaster: {e.materialMasterId ?? 'Unresolved'}</p>{e.contributions.map(c => <div key={`${c.partId}:${c.slot}`}><p>Raw slot {c.slot} · side unmapped</p><SourceRow row={c} /></div>)}</details></td></tr>)}</tbody></table></div></>}
    <p>Status: {result.status} · {new Date(bom.createdAt).toLocaleString()}</p>
    <details><summary>BOM evidence and limitations</summary><p>Report: {bom.id}<br />Version: {result.versionId}<br />Model: {result.modelId}<br />Resolution: {bom.resolutionId}<br />Algorithm: {bom.algorithmVersion}</p><ul>{result.issues.map(i => <li key={i}>{i}</li>)}</ul><p>Exported row quantities are counted once. Cabinet quantities do not multiply them. Grain, column 10 and edge sides are not used. This is technical review, not production authorization.</p></details>
  </section>;
}
