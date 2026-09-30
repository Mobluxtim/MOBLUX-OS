'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { ResolutionState } from '../../../packages/contracts/resolution';
export function MaterialResolution({ projectId, modelId }: { projectId: string; modelId: string }) {
  const [state, setState] = useState<ResolutionState>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const url = `/projects/${projectId}/technical-models/${modelId}/material-resolution`;
  useEffect(() => {
    let active = true; setState(undefined); setError(''); setBusy(true);
    async function load() {
      try { await api(url, { method: 'POST' }); const s = await api<ResolutionState>(url); if (active) { setState(s); setError(''); } }
      catch (e) { if (active) setError((e as Error).message); } finally { if (active) setBusy(false); }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 5000);
    window.addEventListener('focus', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [url]);
  async function refresh() {
    setBusy(true); setError('');
    try { await api(url, { method: 'POST' }); setState(await api<ResolutionState>(url)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const report = state?.current, exceptions = report?.results.filter(r => !r.materialMasterId) ?? [], resolved = report ? report.results.length - exceptions.length : 0;
  return <section className="material-resolution inset-form" aria-label="Automatic material resolution">
    <h3>{report ? `Materials resolved: ${resolved}/${report.results.length}` : 'Material resolution'}</h3>
    <p>Automatic technical catalog links only. No supplier, price, approval or production authorization.</p>
    {error && <p role="alert" className="error">{error}</p>}{busy && <p role="status">Resolving from the current libraries…</p>}
    {report && <><p>{exceptions.length} unresolved · {exceptions.filter(r => r.status === 'AMBIGUOUS').length} ambiguous · {exceptions.filter(r => r.status === 'NO_MATCH').length} unmatched · {exceptions.filter(r => r.status === 'REVIEW_REQUIRED').length} review required</p>
      <p>Status: {exceptions.length ? 'EXCEPTIONS' : 'RESOLVED'} · {new Date(report.createdAt).toLocaleString()}</p>
      {!exceptions.length && <p>No material exceptions require attention.</p>}
      {exceptions.length > 0 && <div className="table-wrap"><table><thead><tr><th>Exception</th><th>Status / next step</th></tr></thead><tbody>{exceptions.map((r, i) => <tr key={i}><td>{r.name}<p>{r.category} · {r.thickness} {r.unit}</p></td><td>{r.status}<p>{r.reason}</p><details><summary>Candidate / source evidence</summary>{r.candidates.map(c => <p key={c.recordId}>{c.snapshotId} · #{c.index} · {c.candidateUuid}</p>)}{r.sourceRefs.map(ref => <p key={ref}>{ref}</p>)}</details></td></tr>)}</tbody></table></div>}
      <p>Active libraries: {report.snapshots.map(s => `${s.category} ${s.hash.slice(0, 8)}`).join(' · ') || 'None configured'}</p><details><summary>Resolution evidence and history</summary><p>Current report: {report.id} · {report.resolverVersion}</p><p>Active snapshots used at resolution:</p>{report.snapshots.map(s => <p key={s.category}>{s.category} · {s.filename}<br />{s.snapshotId}<br />{s.hash}</p>)}{!report.snapshots.length && <p>No relevant library is active.</p>}
        <details><summary>All material links ({report.results.length})</summary>{report.results.map((r, i) => <p key={i}>{r.category} · {r.name} · {r.thickness} {r.unit}<br />{r.materialMasterId ?? r.status}<br />{r.candidates.map(c => `${c.snapshotId} / ${c.recordId}`).join(', ')}</p>)}</details>
        {state?.history.map(h => <details key={h.id}><summary>{new Date(h.createdAt).toLocaleString()} · {h.id} {h.id === report.id ? '(current)' : '(historical)'}</summary><p>{h.results.filter(r => r.materialMasterId).length}/{h.results.length} resolved · {h.resolverVersion}</p>{h.snapshots.map(s => <p key={s.category}>{s.category}: {s.snapshotId}</p>)}</details>)}
      </details>
    </>}
    <button className="button secondary" disabled={busy} onClick={() => void refresh()}>Refresh material resolution</button>
    <p className="helper">Uses current libraries automatically and updates when they change. Earlier reports stay unchanged.</p>
  </section>;
}
