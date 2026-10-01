'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { OptimizationReport } from '../../../packages/contracts/optimization';
import { displayQuantity as q } from '../../../packages/contracts/decimal-display';
export function Optimization({ projectId, modelId, resolutionId }: { projectId: string; modelId: string; resolutionId: string }) {
  const [reports, setReports] = useState<OptimizationReport[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true, running = false; setReports([]); setLoading(true); setError('');
    async function load() {
      if (running) return; running = true;
      try {
        const rows = await api<OptimizationReport[]>(`/projects/${projectId}/technical-models/${modelId}/optimization`, { method: 'POST', body: JSON.stringify({ resolutionId }) });
        if (alive) { setReports(rows); setError(''); }
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { running = false; if (alive) setLoading(false); }
    }
    void load(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [projectId, modelId, resolutionId]);
  const imported = reports.filter(r => r.status === 'IMPORTED');
  return <section className="bom-review" aria-label="Material requirements / Optimization"><h3>Material requirements / Optimization</h3>
    <p>Imported OptiCut optimized sheet requirements — separate from BOM net area. No purchasing order or production authorization.</p>
    {error && <p role="alert">{error}</p>}{loading && <p>Checking uploaded OptiCut reports…</p>}
    {!loading && !imported.length && <p>No validated OptiCut requirement report for this model/resolution.</p>}
    {imported.length > 1 && <p>Multiple source reports exist. They are separate alternatives/history, never additive project demand.</p>}
    {reports.filter(r => r.status === 'FAILED').map(r => <p key={r.id} role="alert">Source {r.sourceId}: {r.finding}</p>)}
    {imported.map(report => { const r = report.result!; return <article key={report.id}>
      <p className="optimization-totals"><strong>{r.totals.sheets} required sheets · {q(r.totals.edgeLengthM)} m edge · {q(r.totals.cuttingLengthM)} m cutting · {q(r.totals.wastePercent)}% waste/scrap · {r.totals.placedUnits} placed units</strong></p>
      <p>{q(r.totals.sheetAreaM2)} m² reported sheet area · {q(r.totals.partAreaM2)} m² OptiCut part area · {r.totals.failedUnits} failed/unplaced of {r.totals.requestedUnits} requested units</p>
      <div className="table-wrap"><table><thead><tr><th>Material / thickness</th><th>Stock sheet (mm)</th><th>Sheets / area m²</th><th>Placed units</th><th>Evidence / maps</th></tr></thead><tbody>{r.panels.map((p, i) => <tr key={i}><td>{p.name} · {q(p.thicknessMm)} mm<p>{p.linkStatus}</p></td><td>{q(p.lengthMm)} × {q(p.widthMm)}</td><td>{p.sheets} / {q(p.sheetAreaM2)}</td><td>{p.placedUnits}</td><td><details><summary>Cutting maps ({p.maps.length})</summary><p>MaterialMaster: {p.materialMasterId ?? 'Unresolved'}<br />PDF page {p.location.page}, row {p.location.row}<br />Per-material cutting length: not reported</p>{p.maps.map(m => <p key={m.number}>Map {m.number}: {m.sheets} sheet · {m.placedUnits} placed · {q(m.wastePercent)}% waste/scrap · page {m.location.page}, row {m.location.row}</p>)}</details></td></tr>)}</tbody></table></div>
      <details><summary>Edge-band requirements ({r.edges.length})</summary><p>OptiCut-reported lengths only; no mapping to unresolved PolyBoard edge sides.</p>{r.edges.map((e, i) => <p key={i}>{e.name} · {q(e.thicknessMm)} mm · {q(e.lengthM)} m · {e.linkStatus}<br />MaterialMaster: {e.materialMasterId ?? 'Unresolved'} · page {e.location.page}, row {e.location.row}</p>)}</details>
      <details><summary>Failed / unplaced: {r.totals.failedUnits} units ({r.failed.length} source rows)</summary><p>Source-truncated labels and reasons are preserved exactly. No guessed link to a normalized Part.</p><div className="table-wrap"><table><thead><tr><th>OptiCut row / material</th><th>Cabinet / reference</th><th>Dimensions (source)</th><th>Failed / requested</th><th>Reason (source)</th></tr></thead><tbody>{r.failed.map(f => <tr key={f.sourceNumber}><td>{f.sourceNumber} · {f.materialLabel}</td><td>{f.cabinet} · {f.reference}</td><td>{f.dimensionsRaw}</td><td>{f.failedUnits} / {f.requestedUnits}</td><td>{f.reasonRaw}<p>PDF page {f.location.page}, row {f.location.row}{f.truncated ? ' · truncated' : ''}</p></td></tr>)}</tbody></table></div></details>
      <details><summary>Optimization provenance and limitations</summary><p>Report: {report.id}<br />Source: {report.sourceId}<br />SHA-256: {report.sourceHash}<br />Model: {report.modelId}<br />Resolution: {report.resolutionId}<br />Parser: {report.parserVersion}<br />Imported: {new Date(report.createdAt).toLocaleString()}<br />Source date: {r.sourceDate} · {r.sourcePages} pages · totals page {r.totals.location.page}</p><ul>{r.findings.map(f => <li key={f}>{f}</li>)}</ul></details>
    </article>; })}
  </section>;
}
