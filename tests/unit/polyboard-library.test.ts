import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { libraryCategories, type LibraryRecord } from '../../packages/contracts/library.js';
import { parseLibrary, parseLibraryPayload, sha256, libraryFilenames } from '../../packages/modules/imports/polyboard-library.js';
import { decompressLibrary } from '../../packages/modules/imports/library-decompress.js';
import { proposeMatches } from '../../packages/modules/catalog/matching.js';
import { syntheticLibrary, oversizedLibraryStream } from '../fixtures/library.js';

test('three observed signatures decode sequentially, preserving identifiers, source bytes and candidate confidence', async () => {
  for (const category of libraryCategories) {
    const bytes = syntheticLibrary(category), a = await parseLibrary(category, bytes), b = await parseLibrary(category, bytes);
    assert.equal(a.status, 'NEEDS_REVIEW', a.findings.join()); assert.deepEqual(a, b); assert.equal(a.storedCount, 1);
    const r = a.records[0]; assert.equal(r.candidateUuid, '10000000-0000-4000-8000-000000000001'); assert.notEqual(r.id, r.candidateUuid);
    assert.equal(r.candidateIdHex, '10000000000040008000000000000001'); assert.equal(r.thickness, null);
    assert.equal(r.thicknessCandidate, category === 'BAR' ? null : category === 'EDGE' ? '0.8' : '18');
    assert.equal(r.textures[0].reference, 'synthetic/texture.png'); assert.ok(r.unmapped.includes('Flags / grain / orientation'));
    const data = await decompressLibrary(bytes.subarray(Buffer.byteLength(`bo:materials:${category.toLowerCase()}`) + 12));
    assert.equal(a.payloadPrefixHex + r.rawHex, data.toString('hex')); assert.equal(a.decodedHash, sha256(data));
  }
});
test('corrupt, unsupported, truncated, concatenated, oversized and count-mismatched inputs fail closed', async () => {
  const good = syntheticLibrary('PANEL');
  for (const bytes of [Buffer.from('not a library'), good.subarray(0, good.length - 1), Buffer.alloc(262145), Buffer.concat([good, Buffer.from([1])]), Buffer.from(good)]) {
    if (bytes.equals(good)) bytes[bytes.length - 8] ^= 255;
    const result = await parseLibrary('PANEL', bytes); assert.equal(result.status, 'FAILED'); assert.deepEqual(result.records, []);
  }
  assert.equal((await parseLibrary('EDGE', good)).status, 'FAILED');
  const v = Buffer.from(good); v.writeUInt32LE(99, 22); assert.equal((await parseLibrary('PANEL', v)).status, 'FAILED');
  const payload = await decompressLibrary(good.subarray(30));
  for (const count of [0, 2, 2001]) { const broken = Buffer.from(payload); broken.writeUInt32LE(count, 5); assert.throws(() => parseLibraryPayload('PANEL', broken, sha256(good))); }
  assert.throws(() => parseLibraryPayload('PANEL', Buffer.concat([payload, Buffer.alloc(1)]), sha256(good)));
  // End-marker removal with a corrected wrapper length must still fail CRC/EOF checks.
  const missingEnd = good.subarray(0, good.length - 10); missingEnd.writeUInt32LE(missingEnd.length - 30, 26);
  assert.equal((await parseLibrary('PANEL', missingEnd)).status, 'FAILED');
  await assert.rejects(decompressLibrary(oversizedLibraryStream), /Invalid, unsupported or oversized/);
});
test('matching requires corroborated fields, preserves ambiguity and keeps category/identity boundaries', async () => {
  const parsed = (await parseLibrary('PANEL', syntheticLibrary('PANEL'))).records[0];
  const r: LibraryRecord = { ...parsed, thickness: { value: '18', unit: 'mm', confidence: 'CORROBORATED', evidence: 'Synthetic unit-test evidence only' } };
  const request = { category: 'PANEL' as const, name: r.name, thickness: '18.00', unit: 'mm' as const, sourceRefs: ['synthetic'] };
  const match = (records: LibraryRecord[]) => proposeMatches([request], [{ id: 'test', records }])[0];
  assert.equal(match([r]).status, 'EXACT_UNIQUE');
  const ambiguous = match([r, { ...r, id: 'different-record', candidateUuid: 'different-external-id' }]);
  assert.equal(ambiguous.status, 'AMBIGUOUS'); assert.equal(ambiguous.candidates.length, 2);
  assert.equal(match([parsed]).status, 'REVIEW_REQUIRED'); assert.equal(match([]).status, 'NO_MATCH');
  assert.equal(match([{ ...r, name: r.name.toUpperCase() }]).status, 'NO_MATCH');
  assert.equal(match([{ ...r, category: 'EDGE' }]).status, 'NO_MATCH');
  assert.equal(match([{ ...r, thickness: { ...r.thickness!, value: '36' } }]).status, 'NO_MATCH');
  assert.equal(match([r, parsed]).status, 'REVIEW_REQUIRED');
  assert.equal(proposeMatches([request], [{ id: 'revision1', records: [r] }, { id: 'revision2', records: [r] }])[0].status, 'AMBIGUOUS');
});
test('real library fixtures: exact hashes, counts, UUIDs, raw coverage and evidence boundaries', { skip: !process.env.POLYBOARD_LIBRARY_DIR }, async () => {
  const expected = { PANEL: [372, '66ab704b818a96315a46c8d09f65c0e79cd347e2a072331b081e2f8696907cbf', 8], EDGE: [84, 'eb3d91d4cf1271e4bf4e4c6f300b272c7d99590c0de1177dcd694088d593de50', 5], BAR: [43, '68755b5f71add0940107355a01f32033f4f0b3a671516a4f33d5cc0800190bd1', 0] } as const;
  const ids = new Set<string>();
  for (const category of libraryCategories) {
    const bytes = await readFile(join(process.env.POLYBOARD_LIBRARY_DIR!, libraryFilenames[category])); assert.equal(sha256(bytes), expected[category][1]);
    const result = await parseLibrary(category, bytes); assert.equal(result.status, 'NEEDS_REVIEW', result.findings.join()); assert.equal(result.recordCount, expected[category][0]); assert.equal(result.storedCount, expected[category][0]);
    assert.equal(result.records.filter(r => r.thickness).length, expected[category][2]);
    for (const r of result.records) { assert.ok(!ids.has(r.candidateUuid)); ids.add(r.candidateUuid); }
    assert.equal(sha256(Buffer.from(result.payloadPrefixHex + result.records.map(r => r.rawHex).join(''), 'hex')), result.decodedHash);
    assert.deepEqual(await parseLibrary(category, bytes), result);
    assert.equal(sha256(await readFile(join(process.env.POLYBOARD_LIBRARY_DIR!, libraryFilenames[category]))), expected[category][1]);
  }
  assert.equal(ids.size, 499);
});
