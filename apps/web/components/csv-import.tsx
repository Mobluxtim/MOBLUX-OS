'use client';
import { useState } from 'react';
import { api } from './api';
import type { Source } from '../../../packages/contracts/index';
import type { CsvImportReport, CsvProfile } from '../../../packages/contracts/imports';

export function CsvImport({ source, onChanged }: { source: Source; onChanged?: () => void }) {
  const [profile, setProfile] = useState<CsvProfile | ''>('');
  const [report, setReport] = useState<CsvImportReport>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [requestId, setRequestId] = useState('');
  const [page, setPage] = useState(0);
  async function show(id: string) {
    const value = await api<CsvImportReport>(`/projects/${source.projectId}/csv-imports/${id}`);
    setReport(value); setPage(0);
  }
  async function run() {
    if (!profile) return;
    const key = requestId || crypto.randomUUID(); setRequestId(key); setBusy(true); setError('');
    try {
      const attempt = await api<{ id: string }>(`/projects/${source.projectId}/sources/${source.id}/csv-imports`, { method: 'POST', body: JSON.stringify({ profile, requestId: key }) });
      await show(attempt.id); setRequestId(''); onChanged?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!source.name.toLowerCase().endsWith('.csv')) return null;
  return <details className="csv-import"><summary>CSV import &amp; validation</summary>
    <p>Choose the exact export profile. These files have no header: column count alone does not establish their meaning. Parsing stages data for review; it does not change a project version.</p>
    <label>CSV export profile<select value={profile} disabled={busy} onChange={e => { setProfile(e.target.value as CsvProfile | ''); setRequestId(''); }}>
      <option value="">Select a verified layout</option>
      <option value="polyboard-cabinets-7/v1">Cabinet list · 7 columns · dimensions in mm</option>
      <option value="polyboard-cutting-18/v1">Cutting list · 18 columns · dimensions in mm</option>
    </select></label>
    <p className="helper">UTF-8, semicolon-separated, no header · Maximum 1 MB / 5,000 rows. Raw price fields require cost-view permission.</p>
    <button className="button secondary" disabled={busy || !profile || source.size > 1048576} onClick={run}>{busy ? 'Reading CSV…' : 'Analyze CSV'}</button>
    {source.size > 1048576 && <p>Source preserved, but exceeds the 1 MB CSV parsing limit.</p>}
    {source.csvAttempts.length > 0 && <label>Import history<select value={report?.id ?? ''} disabled={busy} onChange={async e => { const id = e.target.value; if (!id) { setReport(undefined); return; } setBusy(true); setError(''); try { await show(id); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <option value="">Choose a saved report</option>{source.csvAttempts.map(a => <option key={a.id} value={a.id}>{new Date(a.createdAt).toLocaleString()} · {a.profile} · {a.status}</option>)}
    </select></label>}
    {error && <div role="alert" className="error">{error}</div>}
    {report && <section className="csv-report" aria-label="CSV validation report">
      <h3>{report.status === 'FAILED' ? 'CSV validation failed' : 'Imported to staging — needs review'}</h3>
      <p><strong>{report.result.summary.rows} rows</strong> · {report.result.summary.quantity} units · {report.result.summary.cabinetLabels} cabinet labels · {report.result.summary.materials} material descriptions/thicknesses</p>
      <p className="helper">This selected report is not approved or validated for manufacturing. Profile: {report.profile}. Source version: {report.source.versionId}.</p>
      <ul className="csv-findings">{report.result.findings.map((f, i) => <li key={i}><strong>{f.severity === 'error' ? 'Error' : 'Review'}{f.row ? ` · row ${f.row}` : ''}{f.column ? ` · column ${f.column}` : ''}:</strong> {f.message}</li>)}</ul>
      {report.result.records.length > 0 && <><div className="table-wrap"><table><thead><tr><th>Row</th><th>Cabinet / part</th><th>Qty</th><th>Dimensions (mm)</th><th>Material / source</th></tr></thead><tbody>
        {report.result.records.slice(page * 25, (page + 1) * 25).map(r => <tr key={r.row}><td>{r.row}<small> · line {r.line}</small></td><td>{r.kind === 'part' && <small>{r.cabinetLabel} · #{r.sourceNumber}<br /></small>}{r.name}</td><td>{r.quantity}</td><td>{r.kind === 'cabinet' ? <>{r.dimensions.height} × {r.dimensions.width} × {r.dimensions.depth}<small><br />Height × width × depth</small></> : <>{r.dimensions.first} × {r.dimensions.second}<small><br />Source order; axes unconfirmed</small></>}</td><td>{r.kind === 'part' && <>{r.material.description}<br />{r.material.thickness} mm<details><summary>Raw edge pairs &amp; unmapped data</summary><p>Source project: {r.projectLabel}<br />Column 10: <code>{r.unmapped.column10 || '(empty)'}</code></p><ul>{r.unmapped.edgeSlots.map(edge => <li key={edge.slot}>Slot {edge.slot}: {edge.material ? <>{edge.material} · {edge.thickness} mm</> : '(empty)'} · side unconfirmed</li>)}</ul></details></>}<details><summary>Original column values</summary><ol>{r.raw.map((v, i) => <li key={i}><code>{v || '(empty)'}</code></li>)}</ol></details></td></tr>)}
      </tbody></table></div><div className="csv-pagination"><button className="button secondary" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous rows</button><span>Page {page + 1} / {Math.ceil(report.result.records.length / 25)}</span><button className="button secondary" disabled={(page + 1) * 25 >= report.result.records.length} onClick={() => setPage(p => p + 1)}>Next rows</button></div></>}
      <details><summary>Import provenance</summary><p>Attempt: {report.id}<br />Actor: {report.createdBy}<br />Imported: {new Date(report.createdAt).toLocaleString()}</p><code className="hash">SHA-256: {report.source.hash}</code></details>
    </section>}
  </details>;
}
