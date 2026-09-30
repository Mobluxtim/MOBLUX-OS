import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildServer } from '../../apps/api/server.js';
import { pool } from '../../packages/infrastructure/db.js';
import { cabinetCsv, cuttingCsv } from '../fixtures/technical-csv.js';
import { syntheticLibrary } from '../fixtures/library.js';
import { parseLibrary } from '../../packages/modules/imports/polyboard-library.js';
import type { LibraryCategory, LibraryRecord } from '../../packages/contracts/library.js';
import type { ResolutionReport, ResolutionState, ActiveLibrary } from '../../packages/contracts/resolution.js';

test('automatic resolution, active libraries, persistent identity and immutable history', async t => {
  const app = buildServer(), owner = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const headers: Record<string, string> = { origin: process.env.APP_ORIGIN! }; await app.ready();
  let original: ActiveLibrary[] = [];
  async function activate(category: LibraryCategory, snapshotId: string | null) {
    const r = await app.inject({ method: 'POST', url: '/api/library/active', headers, payload: { category, snapshotId, reason: '[TEST] Controlled resolution verification' } }); assert.equal(r.statusCode, 200, r.body); return r.json();
  }
  try {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { code: process.env.DEV_LOGIN_CODE } }); assert.equal(login.statusCode, 200); headers.cookie = `${login.cookies[0].name}=${login.cookies[0].value}`;
    const user = (await app.inject({ method: 'GET', url: '/api/me', headers })).json();
    original = (await app.inject({ method: 'GET', url: '/api/library/active', headers })).json().active;
    // Controlled synthetic evidence bypasses only the parser in this persistence test.
    // No production corroboration rule, real source or parsed snapshot is modified.
    async function fixture(category: LibraryCategory, mode: 'exact' | 'ambiguous' | 'review' | 'missing') {
      const result = await parseLibrary(category, syntheticLibrary(category));
      let rows: LibraryRecord[] = result.records.map(r => ({ ...r, id: randomUUID(), thickness: { value: category === 'PANEL' ? '18' : '0.8', unit: 'mm', confidence: 'CORROBORATED', evidence: 'Synthetic integration evidence only' } }));
      if (mode === 'ambiguous') rows.push({ ...rows[0], id: randomUUID(), candidateUuid: randomUUID() });
      if (mode === 'review') rows = rows.map(r => ({ ...r, thickness: null }));
      if (mode === 'missing') rows = rows.map(r => ({ ...r, name: '[TEST] Different material' }));
      const id = randomUUID();
      await owner.query('insert into library_snapshots(id,category,filename,hash,size,parser_version,object_key,status,record_count,result,created_by) values($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10)', [id, category, `${category}.synthetic-test`, id.replaceAll('-', '').repeat(2), 'synthetic-resolution-test/v1', `test-resolution/${id}`, 'NEEDS_REVIEW', rows.length, JSON.stringify({ ...result, recordCount: rows.length, storedCount: rows.length, records: rows }), user.id]);
      return id;
    }
    const exact = await fixture('PANEL', 'exact'), edge = await fixture('EDGE', 'exact');
    await activate('PANEL', exact); await activate('EDGE', edge);
    async function createModel() {
      const c = (await app.inject({ method: 'POST', url: '/api/customers', headers, payload: { name: '[TEST] Auto resolution', email: '', phone: '', address: '' } })).json();
      const p = (await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { customerId: c.id, name: '[TEST] Auto resolution', description: 'Synthetic fixtures only' } })).json();
      const v = (await app.inject({ method: 'POST', url: `/api/projects/${p.id}/versions`, headers, payload: { summary: 'Synthetic source', requestId: randomUUID() } })).json();
      async function csv(name: string, data: string, profile: string) {
        const boundary = 'resolution-fixture';
        const source = await app.inject({ method: 'POST', url: `/api/projects/${p.id}/versions/${v.id}/sources`, headers: { ...headers, 'idempotency-key': randomUUID(), 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${data}\r\n--${boundary}--\r\n`) }); assert.equal(source.statusCode, 201, source.body);
        const report = await app.inject({ method: 'POST', url: `/api/projects/${p.id}/sources/${source.json().id}/csv-imports`, headers, payload: { profile, requestId: randomUUID() } }); assert.equal(report.statusCode, 201); return report.json().id;
      }
      const cabinetReportId = await csv('synthetic-cabinets.csv', cabinetCsv, 'polyboard-cabinets-7/v1'), partReportId = await csv('synthetic-parts.csv', cuttingCsv, 'polyboard-cutting-18/v1');
      const response = await app.inject({ method: 'POST', url: `/api/projects/${p.id}/technical-models`, headers, payload: { cabinetReportId, partReportId, requestId: randomUUID() } }); assert.equal(response.statusCode, 201, response.body);
      return { projectId: p.id, modelId: response.json().id, url: `/api/projects/${p.id}/technical-models/${response.json().id}/material-resolution` };
    }
    const first = await createModel();
    const get = async () => (await app.inject({ method: 'GET', url: first.url, headers })).json<ResolutionState>();
    const run = async () => { const r = await app.inject({ method: 'POST', url: first.url, headers }); assert.equal(r.statusCode, 200, r.body); return r.json<ResolutionReport>(); };
    const initial = (await get()).current!;
    const versions = (await owner.query('select * from project_versions where project_id=$1 order by id', [first.projectId])).rows;
    await t.test('creation derives materials automatically; exact results link and other results do not', async () => {
      assert.equal(initial.results.length, 9); assert.equal(initial.results.filter(r => r.materialMasterId).length, 2);
      assert.equal(initial.results.filter(r => r.status === 'NO_MATCH').length, 7);
      assert.ok(initial.results.filter(r => r.status !== 'EXACT_UNIQUE').every(r => !r.materialMasterId));
      assert.deepEqual(initial.snapshots.map(s => s.snapshotId).sort(), [exact, edge].sort());
      assert.equal(initial.results.find(r => r.category === 'EDGE')!.sourceRefs.length, 216);
      const repeated = await Promise.all([run(), run()]); assert.ok(repeated.every(r => r.id === initial.id));
      assert.equal((await get()).history.length, 1);
    });
    await t.test('same corroborated source reuses stable internal master across projects', async () => {
      const second = await createModel(); const state = (await app.inject({ method: 'GET', url: second.url, headers })).json<ResolutionState>();
      assert.deepEqual(state.current!.results.filter(r => r.materialMasterId).map(r => r.materialMasterId), initial.results.filter(r => r.materialMasterId).map(r => r.materialMasterId));
      assert.ok(initial.results.filter(r => r.materialMasterId).every(r => r.materialMasterId !== r.candidates[0].candidateUuid));
    });
    await t.test('active change creates separate reports; ambiguity/review/missing are never linked; old exact report unchanged', async () => {
      for (const mode of ['ambiguous', 'review', 'missing'] as const) {
        await activate('PANEL', await fixture('PANEL', mode));
        assert.equal((await get()).stale, false); assert.ok((await get()).current); // Activation persists the report without a project command.
        const r = await run(), result = r.results.find(m => m.category === 'PANEL' && m.name === 'Synthetic material 0')!;
        assert.notEqual(r.id, initial.id); assert.equal(result.materialMasterId, null);
        assert.equal(result.status, { ambiguous: 'AMBIGUOUS', review: 'REVIEW_REQUIRED', missing: 'NO_MATCH' }[mode]);
      }
      await activate('PANEL', null); assert.equal((await run()).results.find(r => r.category === 'PANEL')?.status, 'REVIEW_REQUIRED');
      await activate('PANEL', exact); assert.equal((await run()).id, initial.id);
      assert.deepEqual((await get()).history.find(r => r.id === initial.id), initial);
      assert.deepEqual((await owner.query('select * from project_versions where project_id=$1 order by id', [first.projectId])).rows, versions);
      await assert.rejects(owner.query('update material_resolution_reports set results=$1 where id=$2', ['[]', initial.id]));
      await assert.rejects(owner.query('delete from material_masters where id=$1', [initial.results.find(r => r.materialMasterId)!.materialMasterId]));
    });
    await t.test('activation permission, invalid category, origin and project access are enforced', async () => {
      // Normal processing has no dependency on any library/admin/proposal capability.
      const adminOnly = ['library.view', 'library.match', 'library.activate', 'library.raw.view'];
      for (const capability of adminOnly) await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)', [user.id, capability]);
      try { assert.equal((await run()).id, initial.id); }
      finally { for (const capability of adminOnly) await owner.query('delete from user_overrides where user_id=$1 and capability=$2', [user.id, capability]); }
      await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)', [user.id, 'library.activate']);
      try { assert.equal((await app.inject({ method: 'POST', url: '/api/library/active', headers, payload: { category: 'PANEL', snapshotId: exact, reason: 'denied' } })).statusCode, 403); }
      finally { await owner.query('delete from user_overrides where user_id=$1 and capability=$2', [user.id, 'library.activate']); }
      assert.equal((await app.inject({ method: 'POST', url: '/api/library/active', headers, payload: { category: 'EDGE', snapshotId: exact, reason: 'wrong category' } })).statusCode, 400);
      assert.equal((await app.inject({ method: 'POST', url: first.url, headers: { cookie: headers.cookie } })).statusCode, 403);
      assert.equal((await app.inject({ method: 'POST', url: first.url.replace(first.projectId, randomUUID()), headers })).statusCode, 404);
      await owner.query('insert into user_overrides(user_id,capability,allowed) values($1,$2,false)', [user.id, 'project.import']);
      try { assert.equal((await app.inject({ method: 'POST', url: first.url, headers })).statusCode, 403); }
      finally { await owner.query('delete from user_overrides where user_id=$1 and capability=$2', [user.id, 'project.import']); }
      assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='materials.automatically_resolved'", [initial.id])).rows[0].n, 1);
    });
    await t.test('real model remains 21/216/280/8 with thirteen automatically linked materials', { skip: !process.env.MOBLUX_REAL_MODEL_ID }, async () => {
      const model = (await owner.query('select * from technical_models where id=$1', [process.env.MOBLUX_REAL_MODEL_ID])).rows[0]; assert.ok(model);
      for (const [category, count] of [['PANEL', 372], ['EDGE', 84], ['BAR', 43]] as const) {
        const s = (await owner.query('select id from library_snapshots where category=$1 and record_count=$2 and parser_version=$3 order by created_at desc', [category, count, 'polyboard-library-observed/v1'])).rows[0]; assert.ok(s); await activate(category, s.id);
      }
      const base = `/api/projects/${model.project_id}/technical-models/${model.id}`;
      const before = (await app.inject({ method: 'GET', url: base, headers })).json();
      const response = await app.inject({ method: 'POST', url: `${base}/material-resolution`, headers }); assert.equal(response.statusCode, 200, response.body);
      const r = response.json<ResolutionReport>(); assert.equal(r.results.length, 13); assert.ok(r.results.every(m => m.status === 'EXACT_UNIQUE' && m.materialMasterId));
      assert.equal(r.results.filter(m => m.category === 'PANEL').length, 8); assert.equal(r.results.filter(m => m.category === 'EDGE').length, 5);
      assert.deepEqual((await app.inject({ method: 'GET', url: base, headers })).json(), before);
      assert.deepEqual([before.cabinets.length, before.parts.length, before.parts.reduce((n: number, p: { data: { quantity: number } }) => n + p.data.quantity, 0), before.materials.length], [21,216,280,8]);
      console.log('Real automatic resolution: 13/13 linked; 8 Panel + 5 Edge; 21/216/280/8 unchanged.');
    });
  } finally {
    if (headers.cookie) for (const category of ['PANEL', 'EDGE', 'BAR'] as const) await activate(category, original.find(a => a.category === category)?.snapshotId ?? null);
    await app.close(); await owner.end(); await pool.end();
  }
});
