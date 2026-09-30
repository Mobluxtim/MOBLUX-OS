import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildServer } from '../../apps/api/server.js';
import { pool } from '../../packages/infrastructure/db.js';
import { cabinetCsv, cuttingCsv } from '../fixtures/technical-csv.js';

test('real PostgreSQL and S3 first-slice workflow', async t => {
  const app = buildServer(); const owner = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const origin = process.env.APP_ORIGIN!;
  const headers: Record<string, string> = { origin };
  await app.ready();
  try {
    await t.test('authentication and cross-origin requests fail closed', async () => {
      assert.equal((await app.inject({ method: 'GET', url: '/api/customers' })).statusCode, 401);
      assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://other.example' }, payload: { code: process.env.DEV_LOGIN_CODE } })).statusCode, 403);
      assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { code: 'invalid' } })).statusCode, 401);
      const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { code: process.env.DEV_LOGIN_CODE } }); assert.equal(login.statusCode, 200); headers.cookie = login.cookies[0].name + '=' + login.cookies[0].value;
      assert.ok(login.headers['set-cookie']?.toString().includes('HttpOnly'));
    });
    const customer = (await app.inject({ method: 'POST', url: '/api/customers', headers, payload: { name: '[TEST] Synthetic customer', email: '', phone: '', address: '' } })).json();
    assert.ok(customer.id);
    const projectResult = await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { customerId: customer.id, name: '[TEST] Synthetic kitchen', description: 'Automated verification only' } }); assert.equal(projectResult.statusCode, 201); const project = projectResult.json();
    let versionId = '';
    await t.test('version publication is immutable, idempotent and concurrency-safe', async () => {
      const payload = { summary: 'Synthetic initial version', requestId: randomUUID() };
      const responses = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions`, headers, payload })));
      assert.equal(responses[0].statusCode, 201); assert.equal(responses[1].statusCode, 201); assert.equal(responses[0].json().id, responses[1].json().id); versionId = responses[0].json().id;
      const concurrent = await Promise.all([1, 2].map(n => app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions`, headers, payload: { summary: `Synthetic revision ${n}`, requestId: randomUUID() } })));
      assert.deepEqual(concurrent.map(r => r.json().number).sort(), [2, 3]);
      await assert.rejects(pool.query('UPDATE project_versions SET summary=$1 WHERE id=$2', ['changed', versionId]));
      await assert.rejects(owner.query('UPDATE project_versions SET summary=$1 WHERE id=$2', ['changed', versionId]));
      await assert.rejects(owner.query('DELETE FROM audit_events WHERE project_id=$1', [project.id]));
      assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions`, headers, payload: { ...payload, summary: 'different' } })).statusCode, 409);
    });
    await t.test('source bytes survive S3 round trip without changing version snapshot', async () => {
      const bytes = Buffer.from('Clearly synthetic test data; no PolyBoard mapping.\r\n'); const boundary = 'moblux-test-boundary';
      const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.txt"\r\nContent-Type: text/plain\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const uploadHeaders = { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}`, 'idempotency-key': randomUUID() };
      const url = `/api/projects/${project.id}/versions/${versionId}/sources`;
      const result = await app.inject({ method: 'POST', url, headers: uploadHeaders, payload }); assert.equal(result.statusCode, 201, result.body);
      const retry = await app.inject({ method: 'POST', url, headers: uploadHeaders, payload }); assert.equal(result.json().id, retry.json().id);
      const download = await app.inject({ method: 'GET', url: `/api/documents/${result.json().id}/download`, headers }); assert.equal(download.statusCode, 200); assert.deepEqual(download.rawPayload, bytes);
      const detail = (await app.inject({ method: 'GET', url: `/api/projects/${project.id}`, headers })).json();
      assert.equal(detail.sources.length, 1); assert.equal(detail.sources[0].hash, createHash('sha256').update(bytes).digest('hex')); assert.equal(detail.sources[0].status, 'PENDING_MAPPING');
      assert.equal(detail.activity.filter((a: { event: string }) => a.event === 'source.preserved').length, 1); assert.deepEqual(detail.versions.find((v: { id: string }) => v.id === versionId).snapshot.sourceIds, []);
      const other = (await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { customerId: customer.id, name: '[TEST] Other project', description: '' } })).json();
      assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${other.id}/versions/${versionId}/sources`, headers: { ...uploadHeaders, 'idempotency-key': randomUUID() }, payload })).statusCode, 404);
    });
    await t.test('CSV staging is audited, immutable, authorized and safely retryable', async () => {
      async function source(name: string, content: string) {
        const boundary = 'csv-test-boundary';
        const payload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${content}\r\n--${boundary}--\r\n`);
        const response = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions/${versionId}/sources`, headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}`, 'idempotency-key': randomUUID() }, payload });
        assert.equal(response.statusCode, 201, response.body); return response.json().id as string;
      }
      const content = '5;Synthetic;Cabinet;Back;326.00;1276.00;2;Synthetic panel;3.00;-1;;;;;;;;';
      const sourceId = await source('synthetic-cutting.csv', content);
      const url = `/api/projects/${project.id}/sources/${sourceId}/csv-imports`;
      const payload = { profile: 'polyboard-cutting-18/v1', requestId: randomUUID() };
      assert.equal((await app.inject({ method: 'POST', url, headers: { origin }, payload })).statusCode, 401);
      const attempts = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url, headers, payload })));
      assert.equal(attempts[0].statusCode, 201, attempts[0].body); assert.equal(attempts[0].json().id, attempts[1].json().id);
      const attemptId = attempts[0].json().id;
      const reportUrl = `/api/projects/${project.id}/csv-imports/${attemptId}`;
      const report = (await app.inject({ method: 'GET', url: reportUrl, headers })).json();
      assert.equal(report.status, 'NEEDS_REVIEW'); assert.equal(report.result.summary.quantity, 2);
      assert.equal(report.result.records[0].unmapped.column10, '-1'); assert.equal(report.source.versionId, versionId);
      assert.equal(report.source.hash, createHash('sha256').update(content).digest('hex'));
      assert.equal((await app.inject({ method: 'POST', url, headers, payload: { ...payload, profile: 'polyboard-cabinets-7/v1' } })).statusCode, 409);
      assert.equal((await app.inject({ method: 'GET', url: `/api/projects/${randomUUID()}/csv-imports/${attemptId}`, headers })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${randomUUID()}/sources/${sourceId}/csv-imports`, headers, payload })).statusCode, 404);
      await assert.rejects(owner.query('UPDATE csv_import_attempts SET status=$1 WHERE id=$2', ['FAILED', attemptId]));
      await assert.rejects(pool.query('DELETE FROM csv_import_attempts WHERE id=$1', [attemptId]));
      const retry = await app.inject({ method: 'POST', url, headers, payload: { ...payload, requestId: randomUUID() } }); assert.equal(retry.statusCode, 201); assert.notEqual(retry.json().id, attemptId);
      const detail = (await app.inject({ method: 'GET', url: `/api/projects/${project.id}`, headers })).json();
      const item = detail.sources.find((s: { id: string }) => s.id === sourceId);
      assert.equal(item.csvAttempts.length, 2); assert.equal('result' in item.csvAttempts[0], false);
      assert.equal(detail.activity.filter((a: { event: string }) => a.event === 'import.csv.assessed').length, 2);
      assert.equal(detail.versions.find((v: { id: string }) => v.id === versionId).snapshot.normalizedData, null);
      const brokenId = await source('synthetic-invalid.csv', 'wrong;columns');
      const broken = (await app.inject({ method: 'POST', url: `/api/projects/${project.id}/sources/${brokenId}/csv-imports`, headers, payload })).json();
      const failed = (await app.inject({ method: 'GET', url: `/api/projects/${project.id}/csv-imports/${broken.id}`, headers })).json();
      assert.equal(failed.status, 'FAILED'); assert.deepEqual(failed.result.records, []);
      const cabinetId = await source('synthetic-cabinets.csv', 'Synthetic cabinet;1;650;800;400;987.65;987.65');
      const cabinetUrl = `/api/projects/${project.id}/sources/${cabinetId}/csv-imports`;
      const cabinet = await app.inject({ method: 'POST', url: cabinetUrl, headers, payload: { ...payload, profile: 'polyboard-cabinets-7/v1' } }); assert.equal(cabinet.statusCode, 201, cabinet.body);
      const user = (await app.inject({ method: 'GET', url: '/api/me', headers })).json();
      for (const capability of ['project.import', 'project.cost.view']) {
        await owner.query('INSERT INTO user_overrides(user_id,capability,allowed) VALUES ($1,$2,false)', [user.id, capability]);
        try {
          assert.equal((await app.inject({ method: 'POST', url: cabinetUrl, headers, payload: { ...payload, profile: 'polyboard-cabinets-7/v1', requestId: randomUUID() } })).statusCode, 403);
          assert.equal((await app.inject({ method: 'GET', url: `/api/projects/${project.id}/csv-imports/${cabinet.json().id}`, headers })).statusCode, 403);
        } finally { await owner.query('DELETE FROM user_overrides WHERE user_id=$1 AND capability=$2', [user.id, capability]); }
      }
    });
    await t.test('normalized technical model seals new version, links full fixture and deduplicates retries', async () => {
      async function report(name: string, content: string, profile: string, sourceVersion = versionId) {
        const boundary = 'technical-model-fixture';
        const upload = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions/${sourceVersion}/sources`, headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}`, 'idempotency-key': randomUUID() }, payload: Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${content}\r\n--${boundary}--\r\n`) }); assert.equal(upload.statusCode, 201, upload.body);
        const result = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/sources/${upload.json().id}/csv-imports`, headers, payload: { profile, requestId: randomUUID() } }); assert.equal(result.statusCode, 201, result.body); return result.json().id as string;
      }
      const cabinetReportId = await report('synthetic-21.csv', cabinetCsv, 'polyboard-cabinets-7/v1');
      const partReportId = await report('synthetic-216.csv', cuttingCsv, 'polyboard-cutting-18/v1');
      const before = (await owner.query('select id,snapshot from project_versions where project_id=$1 order by id', [project.id])).rows;
      const url = `/api/projects/${project.id}/technical-models`, payload = { cabinetReportId, partReportId, requestId: randomUUID() };
      assert.equal((await app.inject({ method: 'POST', url, headers: { origin }, payload })).statusCode, 401);
      const results = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url, headers, payload })));
      assert.equal(results[0].statusCode, 201, results[0].body); assert.equal(results[1].statusCode, 201, results[1].body); assert.equal(results[0].json().id, results[1].json().id);
      const result = results[0].json(), readUrl = `${url}/${result.id}`;
      const detail = (await app.inject({ method: 'GET', url: readUrl, headers })).json();
      assert.deepEqual(detail.model.summary, { cabinets: 21, partRows: 216, units: 280, materials: 8, linkedRows: 216, ambiguousRows: 0, unmappedRows: 0 });
      assert.equal(detail.cabinets.length, 21); assert.equal(detail.parts.length, 216); assert.equal(detail.materials.length, 8); assert.equal(detail.edges.length, 864);
      for (const part of detail.parts) { assert.equal(detail.cabinets.find((c: { id: string }) => c.id === part.cabinetId).name, part.data.cabinetLabel); assert.equal(part.data.unmapped.column10, '-1'); assert.equal(part.reportId, partReportId); }
      assert.ok(detail.edges.every((e: { side: unknown }) => e.side === null)); assert.ok(!JSON.stringify(detail).includes('999.99'));
      const again = await app.inject({ method: 'POST', url, headers, payload: { ...payload, requestId: randomUUID() } }); assert.equal(again.json().id, result.id);
      assert.equal((await app.inject({ method: 'POST', url, headers, payload: { ...payload, cabinetReportId: partReportId, partReportId: cabinetReportId } })).statusCode, 400);
      assert.equal((await app.inject({ method: 'GET', url: `/api/projects/${randomUUID()}/technical-models/${result.id}`, headers })).statusCode, 404);
      const after = (await owner.query('select id,snapshot from project_versions where project_id=$1 order by id', [project.id])).rows;
      assert.equal(after.length, before.length + 1); assert.deepEqual(after.filter(r => r.id !== result.versionId), before);
      assert.equal(after.find(r => r.id === result.versionId).snapshot.normalizedData.manufacturingVerified, false);
      assert.equal((await owner.query("select count(*)::int as n from audit_events where project_id=$1 and event='technical_model.created'", [project.id])).rows[0].n, 1);
      await assert.rejects(owner.query('UPDATE parts SET cabinet_id=NULL WHERE version_id=$1', [result.versionId]));
      await assert.rejects(owner.query('DELETE FROM edge_data WHERE version_id=$1', [result.versionId]));
      await assert.rejects(owner.query('INSERT INTO technical_materials (version_id,key,description,thickness,unit) VALUES ($1,$2,$3,$4,$5)', [result.versionId, 'new', 'forbidden appended material', '18', 'mm']));
      await assert.rejects(owner.query('INSERT INTO technical_materials (version_id,key,description,thickness,unit) VALUES ($1,$2,$3,$4,$5)', [versionId, 'new', 'forbidden old version material', '18', 'mm']));
      const otherVersion = (await app.inject({ method: 'POST', url: `/api/projects/${project.id}/versions`, headers, payload: { summary: 'Synthetic mismatched source version', requestId: randomUUID() } })).json();
      const otherReport = await report('synthetic-other.csv', cuttingCsv, 'polyboard-cutting-18/v1', otherVersion.id);
      assert.equal((await app.inject({ method: 'POST', url, headers, payload: { ...payload, partReportId: otherReport, requestId: randomUUID() } })).statusCode, 409);
      const user = (await app.inject({ method: 'GET', url: '/api/me', headers })).json();
      await owner.query('INSERT INTO user_overrides(user_id,capability,allowed) VALUES ($1,$2,false)', [user.id, 'project.version.create']);
      try { assert.equal((await app.inject({ method: 'POST', url, headers, payload })).statusCode, 403); } finally { await owner.query('DELETE FROM user_overrides WHERE user_id=$1 AND capability=$2', [user.id, 'project.version.create']); }
      const duplicateReport = await report('synthetic-ambiguous.csv', cabinetCsv.replace('Synthetic cabinet 2;', 'Synthetic cabinet 1;'), 'polyboard-cabinets-7/v1');
      const ambiguous = await app.inject({ method: 'POST', url, headers, payload: { ...payload, cabinetReportId: duplicateReport, requestId: randomUUID() } }); assert.equal(ambiguous.statusCode, 201, ambiguous.body);
      const review = (await app.inject({ method: 'GET', url: `${url}/${ambiguous.json().id}`, headers })).json();
      assert.equal(review.model.summary.ambiguousRows, 11); assert.equal(review.model.summary.unmappedRows, 11); assert.equal(review.model.summary.units, 280);
      assert.ok(review.parts.filter((p: { linkStatus: string }) => p.linkStatus !== 'LINKED').every((p: { cabinetId: unknown }) => p.cabinetId === null));
    });
    await t.test('user denial and expired sessions are enforced by backend', async () => {
      const user = (await app.inject({ method: 'GET', url: '/api/me', headers })).json();
      await owner.query('INSERT INTO user_overrides(user_id,capability,allowed) VALUES ($1,$2,false)', [user.id, 'project.create']);
      try { assert.equal((await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { customerId: customer.id, name: 'Denied project', description: '' } })).statusCode, 403); } finally { await owner.query('DELETE FROM user_overrides WHERE user_id=$1 AND capability=$2', [user.id, 'project.create']); }
      const token = headers.cookie.split('=')[1]; await owner.query('UPDATE sessions SET expires_at=now() - interval \'1 minute\' WHERE token_hash=$1', [createHash('sha256').update(token).digest('hex')]);
      assert.equal((await app.inject({ method: 'GET', url: '/api/projects', headers })).statusCode, 401);
    });
  } finally { await app.close(); await owner.end(); await pool.end(); }
});
