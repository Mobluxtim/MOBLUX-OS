'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { ActiveLibraryAdmin } from './active-library';
import { MaterialProfileView } from './material-profile';
import type { LibraryCategory, LibrarySnapshot, LibrarySnapshotDetail, LibraryRecord, MatchReport, MatchStatus } from '../../../packages/contracts/library';
import type { Project } from '../../../packages/contracts/index';
import type { TechnicalModel } from '../../../packages/contracts/technical-model';

export function MaterialLibrary() {
  const [snapshots, setSnapshots] = useState<LibrarySnapshot[]>([]), [detail, setDetail] = useState<LibrarySnapshotDetail>();
  const [category, setCategory] = useState<LibraryCategory>('PANEL'), [selected, setSelected] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  async function refresh() { setSnapshots(await api<LibrarySnapshot[]>('/library')); }
  useEffect(() => { api<LibrarySnapshot[]>('/library').then(setSnapshots).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    let active = true; setDetail(undefined);
    if (selected) api<LibrarySnapshotDetail>(`/library/${selected}`).then(d => { if (active) setDetail(d); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [selected]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData(event.currentTarget);
      const result = await api<{ id: string; reused: boolean; status: string }>(`/library/${category}`, { method: 'POST', body });
      await refresh(); setSelected(result.id); setPage(0);
      setNotice(result.reused ? 'Existing snapshot reused; no duplicate records created.' : `Snapshot saved: ${result.status}.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const records = detail?.result.records.filter(r => `${r.name} ${r.group} ${r.candidateUuid}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="library-review technical-review">
    <div className="page-heading"><div><span className="eyebrow">INTERNAL REVIEW</span><h1>PolyBoard Material Library</h1><p>Preserved snapshots and matching proposals. No production authorization or supplier pricing.</p></div></div>
    {error && <div role="alert" className="error">{error}</div>}{notice && <p role="status">{notice}</p>}
    <section className="panel padded">
      <h2>Library snapshots</h2>
      <div className="tabs" role="tablist" aria-label="Library category">{(['PANEL', 'EDGE', 'BAR'] as const).map(c => <button key={c} role="tab" aria-selected={category === c} className={category === c ? 'active' : ''} onClick={() => { setCategory(c); setSelected(''); setSearch(''); setPage(0); }}>{c === 'BAR' ? 'Bar / Profile' : c === 'PANEL' ? 'Panel' : 'Edge'}</button>)}</div>
      <form className="inset-form" onSubmit={upload}><label>Original library file<input key={category} type="file" name="file" accept=".mat-boole" required /></label><p className="helper">{category[0] + category.slice(1).toLowerCase()}.mat-boole · 256 KiB maximum · Original remains unchanged.</p><button className="button" disabled={busy}>{busy ? 'Parsing…' : 'Stage library snapshot'}</button></form>
      <label>Snapshot<select value={selected} onChange={e => { setSelected(e.target.value); setPage(0); }}><option value="">Choose a snapshot</option>{snapshots.filter(s => s.category === category).map(s => <option key={s.id} value={s.id}>{s.filename} · {s.recordCount} records · {s.status} · {new Date(s.createdAt).toLocaleString()} · {s.hash.slice(0, 8)}</option>)}</select></label>
      {!snapshots.some(s => s.category === category) && <p>No snapshots for this category yet.</p>}
      {detail && <>
        <p><strong>{detail.recordCount} records</strong> · {detail.status} · {detail.parserVersion}</p>
        <details><summary>Snapshot provenance</summary><p>Snapshot: {detail.id}</p><p>Imported by: {detail.createdBy} · {new Date(detail.createdAt).toLocaleString()}</p><code className="hash">SHA-256: {detail.hash}</code><p>{detail.size} original bytes · decoded hash: {detail.result.decodedHash ?? 'Unavailable'}</p><a href={`/api/library/${detail.id}/download`}>Download preserved original (raw permission required)</a></details>
        <ul>{detail.result.findings.map(f => <li key={f}>{f}</li>)}</ul>
        <label>Search library records<input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Exact source names, grouping or UUID" /></label>
        <div className="table-wrap"><table><thead><tr><th>Source record</th><th>Grouping text</th><th>Thickness</th><th>Technical classification / purchasing basis</th><th>Evidence / unmapped</th></tr></thead><tbody>{records.slice(page * 25, page * 25 + 25).map(r => <tr key={r.id}><td><strong>{r.name}</strong><p>#{r.index} · {r.category}</p></td><td>{r.group || '—'}</td><td>{r.thickness ? `${r.thickness.value} mm · CORROBORATED` : r.thicknessCandidate !== null ? `${r.thicknessCandidate} · candidate only; unit unconfirmed` : 'Raw / unmapped'}</td><td><MaterialProfileView profile={detail.profiles.find(p => p.source.recordId === r.id)} /></td><td><RecordEvidence row={r} snapshotId={detail.id} /></td></tr>)}</tbody></table></div>
        <div className="csv-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous records</button><span>{records.length} matching records · page {page + 1}</span><button className="button secondary" disabled={(page + 1) * 25 >= records.length} onClick={() => setPage(p => p + 1)}>Next records</button></div>
      </>}
    </section>
    <ActiveLibraryAdmin snapshots={snapshots} /><details className="panel padded"><summary>Administrative matching diagnostics (optional)</summary><p>Projects resolve materials automatically. These manual controls are only for comparing historical snapshots.</p><MatchingReview snapshots={snapshots} /></details>
  </div>;
}
function RecordEvidence({ row, snapshotId }: { row: LibraryRecord; snapshotId: string }) {
  const [raw, setRaw] = useState(''), [error, setError] = useState('');
  return <details><summary>Fields / provenance</summary><p>MOBLUX record: {row.id}</p><p>Candidate source UUID: {row.candidateUuid}</p><p>Identifier bytes: {row.candidateIdHex}</p><p>Decompressed bytes [{row.offset}, {row.endOffset})</p>{row.thickness && <p>{row.thickness.evidence}</p>}
    <strong>Texture references only</strong>{row.textures.length ? row.textures.map(t => <p key={t.offset}><code>{t.reference}</code> · role UNKNOWN</p>) : <p>No decoded texture reference.</p>}
    <strong>Raw / unmapped</strong><ul>{row.unmapped.map(v => <li key={v}>{v}</li>)}</ul>
    <button className="button secondary" onClick={async () => { try { const r = await api<{ record: LibraryRecord }>(`/library/${snapshotId}/records/${row.index}/raw`); setRaw(r.record.rawHex); setError(''); } catch (e) { setError((e as Error).message); } }}>Inspect raw bytes</button>{error && <p role="alert">{error}</p>}{raw && <pre className="library-raw">{raw}</pre>}
  </details>;
}
function MatchingReview({ snapshots }: { snapshots: LibrarySnapshot[] }) {
  const [projects, setProjects] = useState<Project[]>([]), [project, setProject] = useState(''), [models, setModels] = useState<TechnicalModel[]>([]), [model, setModel] = useState('');
  const [choices, setChoices] = useState<Record<string, string>>({}), [reports, setReports] = useState<MatchReport[]>([]), [reportId, setReportId] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [filter, setFilter] = useState<MatchStatus | ''>('');
  useEffect(() => { api<Project[]>('/projects').then(setProjects).catch(e => setError(e.message)); }, []);
  useEffect(() => { let active = true; setModels([]); setModel(''); if (project) api<TechnicalModel[]>(`/projects/${project}/technical-models`).then(r => { if (active) setModels(r); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [project]);
  useEffect(() => { let active = true; setReports([]); setReportId(''); if (project && model) api<MatchReport[]>(`/projects/${project}/technical-models/${model}/library-matches`).then(r => { if (active) { setReports(r); setReportId(r[0]?.id ?? ''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [project, model]);
  const report = reports.find(r => r.id === reportId), currentModel = models.find(m => m.id === model);
  return <section className="panel padded library-matches"><h2>Project material matching</h2><p>Exact name + corroborated thickness/unit. Results are proposals; existing versions remain unchanged.</p>{error && <p role="alert" className="error">{error}</p>}
    <label>Project<select value={project} onChange={e => setProject(e.target.value)} disabled={busy}><option value="">Choose project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Technical version<select value={model} onChange={e => setModel(e.target.value)} disabled={busy}><option value="">Choose immutable technical model</option>{models.map(m => <option key={m.id} value={m.id}>V{m.versionNumber} · {m.summary.cabinets} cabinets · {m.summary.partRows} rows</option>)}</select></label>
    {currentModel && <p>{currentModel.summary.cabinets} cabinets · {currentModel.summary.partRows} part rows · {currentModel.summary.units} units · {currentModel.summary.materials} materials</p>}
    {(['PANEL', 'EDGE', 'BAR'] as const).map(category => <label key={category}>{category} matching snapshot<select value={choices[category] ?? ''} onChange={e => setChoices(c => ({ ...c, [category]: e.target.value }))} disabled={busy}><option value="">Not selected</option>{snapshots.filter(s => s.category === category && s.status === 'NEEDS_REVIEW').map(s => <option key={s.id} value={s.id}>{s.filename} · {s.recordCount} · {s.hash.slice(0, 8)} · {new Date(s.createdAt).toLocaleString()}</option>)}</select></label>)}
    <button className="button" disabled={busy || !model || !Object.values(choices).some(Boolean)} onClick={async () => {
      setBusy(true); setError(''); try { const r = await api<MatchReport>(`/projects/${project}/technical-models/${model}/library-matches`, { method: 'POST', body: JSON.stringify({ snapshotIds: Object.values(choices).filter(Boolean) }) }); setReports(old => [r, ...old.filter(o => o.id !== r.id)]); setReportId(r.id); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? 'Comparing…' : 'Create matching proposals'}</button>
    <label>Saved matching report<select value={reportId} onChange={e => setReportId(e.target.value)}><option value="">No report selected</option>{reports.map(r => <option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleString()} · {r.id.slice(0, 8)}</option>)}</select></label>
    {report && <><p>{report.matcherVersion} · Version {report.versionId}</p><details><summary>Compared snapshots</summary>{report.snapshotIds.map(id => <p key={id}>{snapshots.find(s => s.id === id)?.filename} · {id} · {snapshots.find(s => s.id === id)?.hash}</p>)}</details>
      <p>{(['EXACT_UNIQUE', 'AMBIGUOUS', 'NO_MATCH', 'REVIEW_REQUIRED'] as const).map(s => `${s}: ${report.results.filter(r => r.status === s).length}`).join(' · ')}</p>
      <label>Match status<select value={filter} onChange={e => setFilter(e.target.value as MatchStatus | '')}><option value="">All results</option>{['EXACT_UNIQUE', 'AMBIGUOUS', 'NO_MATCH', 'REVIEW_REQUIRED'].map(s => <option key={s}>{s}</option>)}</select></label>
      <div className="table-wrap"><table><thead><tr><th>Project material</th><th>Result</th><th>Candidate evidence</th></tr></thead><tbody>{report.results.filter(r => !filter || r.status === filter).map((r, i) => <tr key={i}><td>{r.name}<p>{r.category} · {r.thickness} {r.unit}</p></td><td>{r.status}<p>{r.reason}</p></td><td>{r.candidates.map(c => <p key={`${c.snapshotId}:${c.recordId}`}>Record #{c.index} · {c.candidateUuid}<br />Snapshot {c.snapshotId}</p>)}<details><summary>Project source references</summary>{r.sourceRefs.map(ref => <p key={ref}>{ref}</p>)}</details></td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
