'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { LibrarySnapshot, LibraryCategory } from '../../../packages/contracts/library';
import type { ActiveLibrary } from '../../../packages/contracts/resolution';
interface State { active: ActiveLibrary[]; history: { id: string; category: LibraryCategory; snapshotId: string | null; reason: string; createdAt: string; createdBy: string }[]; }
export function ActiveLibraryAdmin({ snapshots }: { snapshots: LibrarySnapshot[] }) {
  const [state, setState] = useState<State>(), [category, setCategory] = useState<LibraryCategory>('PANEL'), [snapshotId, setSnapshotId] = useState(''), [reason, setReason] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [allowed, setAllowed] = useState(false);
  useEffect(() => { api<State>('/library/active').then(setState).catch(e => setError(e.message)); api<{ capabilities: string[] }>('/me').then(m => setAllowed(m.capabilities.includes('library.activate'))).catch(e => setError(e.message)); }, []);
  return <section className="panel padded"><h2>Active project libraries</h2><p>Normal project processing uses these snapshots automatically. Uploading alone never activates a library.</p>
    {(['PANEL', 'EDGE', 'BAR'] as const).map(c => <p key={c}>{c}: {state?.active.find(a => a.category === c)?.snapshotId ?? 'Not active'}</p>)}
    {error && <p role="alert" className="error">{error}</p>}
    {allowed && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api('/library/active', { method: 'POST', body: JSON.stringify({ category, snapshotId: snapshotId || null, reason }) }); setState(await api<State>('/library/active')); setReason(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <label>Active category<select value={category} disabled={busy} onChange={e => { setCategory(e.target.value as LibraryCategory); setSnapshotId(''); }}>{['PANEL', 'EDGE', 'BAR'].map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Activate snapshot<select value={snapshotId} disabled={busy} onChange={e => setSnapshotId(e.target.value)}><option value="">Deactivate category</option>{snapshots.filter(s => s.category === category && s.status === 'NEEDS_REVIEW').map(s => <option key={s.id} value={s.id}>{s.filename} · {s.recordCount} records · {s.hash.slice(0, 8)}</option>)}</select></label>
      <label>Activation reason<input required maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label><button className="button" disabled={busy}>Apply active library</button>
    </form>}
    <details><summary>Activation history</summary>{state?.history.map(h => <p key={h.id}>{new Date(h.createdAt).toLocaleString()} · {h.category}: {h.snapshotId ?? 'deactivated'}<br />{h.reason}<br />Actor: {h.createdBy}</p>)}</details>
  </section>;
}
