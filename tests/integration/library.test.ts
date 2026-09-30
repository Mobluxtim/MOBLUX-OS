import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { buildServer } from '../../apps/api/server.js';
import { pool } from '../../packages/infrastructure/db.js';
import { syntheticLibrary } from '../fixtures/library.js';
import { cabinetCsv, cuttingCsv } from '../fixtures/technical-csv.js';
import { libraryCategories, type LibraryCategory, type LibrarySnapshotDetail, type MatchReport } from '../../packages/contracts/library.js';
import { libraryFilenames, sha256 } from '../../packages/modules/imports/polyboard-library.js';

test('library PostgreSQL/S3 staging, proposals and immutable project boundary', async t => {
  const app = buildServer(), owner = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const headers: Record<string, string> = { origin: process.env.APP_ORIGIN! }; await app.ready();
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/library' })).statusCode, 401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { code: process.env.DEV_LOGIN_CODE } }); assert.equal(login.statusCode, 200);
    headers.cookie = `${login.cookies[0].name}=${login.cookies[0].value}`;
    const user = (await app.inject({ method: 'GET', url: '/api/me', headers })).json();
    async function upload(url: string, filename: string, bytes: Buffer, extra = {}) {
      const boundary = 'moblux-library-test';
      return app.inject({ method: 'POST', url, headers: { ...headers, ...extra, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]) });
    }
    const ids: string[] = [];
    await t.test('source preservation, idempotency, safe responses, failed imports and audit', async () => {
      for (const category of libraryCategories) {
        const response = await upload(`/api/library/${category}`, libraryFilenames[category], syntheticLibrary(category)); assert.equal(response.statusCode, 201, response.body); ids.push(response.json().id);
        const detail = (await app.inject({ method: 'GET', url: `/api/library/${response.json().id}`, headers })).json<LibrarySnapshotDetail>();
        assert.equal(detail.recordCount, 1); assert.equal(detail.hash, sha256(syntheticLibrary(category))); assert.equal(detail.result.records[0].rawHex, '');
        const original = await app.inject({ method: 'GET', url: `/api/library/${detail.id}/download`, headers }); assert.deepEqual(original.rawPayload, syntheticLibrary(category));
        const raw = (await app.inject({ method: 'GET', url: `/api/library/${detail.id}/records/1/raw`, headers })).json(); assert.ok(raw.record.rawHex.length);
        await assert.rejects(owner.query('UPDATE library_snapshots SET record_count=0 WHERE id=$1', [detail.id]));
        await assert.rejects(pool.query('DELETE FROM library_snapshots WHERE id=$1', [detail.id]));
      }
      const repeats = await Promise.all([1, 2].map(() => upload('/api/library/PANEL', 'Panel.mat-boole', syntheticLibrary('PANEL'))));
      assert.ok(repeats.every(r => r.statusCode === 201 && r.json().id === ids[0] && r.json().reused));
      assert.equal((await owner.query("select count(*)::int n from audit_events where entity_id=$1 and event='library.snapshot.staged'", [ids[0]])).rows[0].n, 1);
      const broken = await upload('/api/library/PANEL', 'Panel.mat-boole', Buffer.from('corrupt synthetic library')); assert.equal(broken.statusCode, 201);
      const failure = (await app.inject({ method: 'GET', url: `/api/library/${broken.json().id}`, headers })).json<LibrarySnapshotDetail>();
      assert.equal(failure.status, 'FAILED'); assert.equal(failure.recordCount, 0); assert.deepEqual(failure.result.records, []);
    });
    await t.test('new capabilities deny direct API access, raw access and customer access', async () => {
      for (const capability of ['library.view', 'library.raw.view', 'library.import']) {
        await owner.query('INSERT INTO user_overrides(user_id,capability,allowed) VALUES ($1,$2,false)', [user.id, capability]);
        try {
          const res = capability === 'library.import' ? await upload('/api/library/PANEL', 'Panel.mat-boole', syntheticLibrary('PANEL')) : await app.inject({ method: 'GET', url: capability === 'library.view' ? '/api/library' : `/api/library/${ids[0]}/records/1/raw`, headers });
          assert.equal(res.statusCode, 403);
          if (capability === 'library.raw.view') assert.equal((await app.inject({ method: 'GET', url: `/api/library/${ids[0]}/download`, headers })).statusCode, 403);
        } finally { await owner.query('DELETE FROM user_overrides WHERE user_id=$1 AND capability=$2', [user.id, capability]); }
      }
      // Customer identities cannot use staff library services even when handed a grant.
      const { stageLibrary } = await import('../../packages/modules/catalog/service.js');
      await assert.rejects(stageLibrary({ id: user.id, kind: 'customer', grants: new Set(['library.import', 'library.view']), denies: new Set() }, 'PANEL', 'Panel.mat-boole', syntheticLibrary('PANEL')), /permission/);
    });
    const customer = (await app.inject({ method: 'POST', url: '/api/customers', headers, payload: { name: '[TEST] Library customer', email: '', phone: '', address: '' } })).json();
    const project = (await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { name: '[TEST] Library project', customerId: customer.id, description: 'Synthetic only' } })).json();
    const version = (await app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions`, headers, payload: { summary: 'Synthetic library source', requestId: randomUUID() } })).json();
    async function csv(name: string, bytes: string, profile: string) {
      const source = await upload(`/api/projects/${project.id}/versions/${version.id}/sources`, name, Buffer.from(bytes), { 'idempotency-key': randomUUID() }); assert.equal(source.statusCode, 201, source.body);
      const report = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/sources/${source.json().id}/csv-imports`, headers, payload: { profile, requestId: randomUUID() } }); assert.equal(report.statusCode, 201); return report.json().id;
    }
    const cabinetReportId = await csv('synthetic-cabinets.csv', cabinetCsv, 'polyboard-cabinets-7/v1'), partReportId = await csv('synthetic-parts.csv', cuttingCsv, 'polyboard-cutting-18/v1');
    const modelResponse = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/technical-models`, headers, payload: { cabinetReportId, partReportId, requestId: randomUUID() } }); assert.equal(modelResponse.statusCode, 201, modelResponse.body); const model = modelResponse.json();
    await t.test('matching persists review/no-match results, deduplicates edge pairs and never writes project versions', async () => {
      const before = (await owner.query('select * from project_versions where project_id=$1 order by id', [project.id])).rows;
      const url = `/api/projects/${project.id}/technical-models/${model.id}/library-matches`;
      const responses = await Promise.all([ids, [...ids].reverse()].map(snapshotIds => app.inject({ method: 'POST', url, headers, payload: { snapshotIds } })));
      assert.ok(responses.every(r => r.statusCode === 201)); assert.equal(responses[0].json().id, responses[1].json().id);
      const result = responses[0].json<MatchReport>(); assert.equal(result.results.length, 9);
      assert.equal(result.results.filter(r => r.status === 'REVIEW_REQUIRED').length, 2); assert.equal(result.results.filter(r => r.status === 'NO_MATCH').length, 7);
      assert.equal(result.results.find(r => r.category === 'EDGE')!.sourceRefs.length, 216);
      await assert.rejects(owner.query('UPDATE library_match_reports SET results=$1 WHERE id=$2', ['[]', result.id]));
      assert.equal((await app.inject({ method: 'GET', url, headers })).json().length, 1);
      assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${randomUUID()}/technical-models/${model.id}/library-matches`, headers, payload: { snapshotIds: ids } })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url, headers, payload: { snapshotIds: [ids[0], ids[0]] } })).statusCode, 400);
      await owner.query('INSERT INTO user_overrides(user_id,capability,allowed) VALUES ($1,$2,false)', [user.id, 'library.match']);
      try { assert.equal((await app.inject({ method: 'POST', url, headers, payload: { snapshotIds: ids } })).statusCode, 403); } finally { await owner.query('DELETE FROM user_overrides WHERE user_id=$1 AND capability=$2', [user.id, 'library.match']); }
      assert.deepEqual((await owner.query('select * from project_versions where project_id=$1 order by id', [project.id])).rows, before);
    });
    await t.test('real library/project evidence: 499 staged; 8 panel + 5 edge proposals; unchanged 21/216/280/8', { skip: !process.env.POLYBOARD_LIBRARY_DIR || !process.env.MOBLUX_REAL_MODEL_ID }, async () => {
      const existing = (await owner.query('select * from technical_models where id=$1', [process.env.MOBLUX_REAL_MODEL_ID])).rows[0]; assert.ok(existing);
      const base = `/api/projects/${existing.project_id}/technical-models/${existing.id}`;
      const before = (await app.inject({ method: 'GET', url: base, headers })).json();
      const versionsBefore = (await owner.query('select * from project_versions where project_id=$1 order by id', [existing.project_id])).rows;
      const selected: string[] = [];
      for (const category of libraryCategories) {
        const bytes = await readFile(join(process.env.POLYBOARD_LIBRARY_DIR!, libraryFilenames[category as LibraryCategory]));
        const res = await upload(`/api/library/${category}`, libraryFilenames[category], bytes); assert.equal(res.statusCode, 201, res.body); assert.equal(res.json().status, 'NEEDS_REVIEW');
        assert.equal(res.json().recordCount, { PANEL: 372, EDGE: 84, BAR: 43 }[category]); selected.push(res.json().id);
        const retry = await upload(`/api/library/${category}`, libraryFilenames[category], bytes); assert.equal(retry.json().id, res.json().id);
        const download = await app.inject({ method: 'GET', url: `/api/library/${res.json().id}/download`, headers }); assert.deepEqual(download.rawPayload, bytes);
      }
      const response = await app.inject({ method: 'POST', url: `${base}/library-matches`, headers, payload: { snapshotIds: selected } }); assert.equal(response.statusCode, 201, response.body);
      const report = response.json<MatchReport>(); assert.equal(report.results.length, 13); assert.ok(report.results.every(r => r.status === 'EXACT_UNIQUE' && r.candidates.length === 1));
      assert.equal(report.results.filter(r => r.category === 'PANEL').length, 8); assert.equal(report.results.filter(r => r.category === 'EDGE').length, 5);
      assert.deepEqual((await app.inject({ method: 'GET', url: base, headers })).json(), before);
      assert.deepEqual((await owner.query('select * from project_versions where project_id=$1 order by id', [existing.project_id])).rows, versionsBefore);
      assert.deepEqual([before.cabinets.length, before.parts.length, before.parts.reduce((n: number, p: { data: { quantity: number } }) => n + p.data.quantity, 0), before.materials.length], [21, 216, 280, 8]);
      console.log(`Real library verification: 372/84/43; EXACT_UNIQUE 8 panels + 5 edges; model ${existing.id} unchanged.`);
    });
  } finally { await app.close(); await owner.end(); await pool.end(); }
});
