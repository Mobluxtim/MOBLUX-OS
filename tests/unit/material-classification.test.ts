import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyMaterial } from '../../packages/modules/catalog/classification.js';
import { parseLibrary, sha256 } from '../../packages/modules/imports/polyboard-library.js';
import { syntheticLibrary } from '../fixtures/library.js';
import { displayQuantity } from '../../packages/contracts/decimal-display.js';

test('unconfirmed names, manufacturers, texture dimensions, thickness and cross-category names never establish substrate or purchasing basis', async () => {
  const row = (await parseLibrary('PANEL', syntheticLibrary('PANEL'))).records[0];
  for (const name of ['MDF 18', 'PAL', 'PFL', 'Glass', '--W960 ST7--', '398']) {
    const result = classifyMaterial('synthetic', 'unverified', { ...row, name, group: 'Egger MDF', textures: [{ reference: '1300x2800.jpg', offset: 0, role: 'UNKNOWN' }] });
    assert.equal(result.panelType, 'UNKNOWN'); assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.deepEqual(result.purchasingBasis, { unit: null, stockSheet: null }); assert.deepEqual(result.attributes, []);
  }
  assert.equal(classifyMaterial('s', 'h', { ...row, category: 'EDGE', name: 'Glass' }).status, 'NOT_APPLICABLE');
});
test('UI rounding retains exact precision outside presentation and handles carries and large values', () => {
  assert.equal(displayQuantity('126.46318129'), '126.46'); assert.equal(displayQuantity('1.995'), '2');
  assert.equal(displayQuantity('0.000000000000000001'), '0'); assert.equal(displayQuantity('18.00'), '18');
  assert.equal(displayQuantity('999999999999999999.999'), '1000000000000000000');
  assert.equal(displayQuantity('2.615'), '2.62');
});
test('real Panel evidence classifies only two of eight matched groups, preserving all source boundaries', { skip: !process.env.POLYBOARD_LIBRARY_DIR }, async () => {
  const bytes = await readFile(join(process.env.POLYBOARD_LIBRARY_DIR!, 'Panel.mat-boole'));
  const parsed = await parseLibrary('PANEL', bytes), hash = sha256(bytes), before = JSON.stringify(parsed);
  const rows = parsed.records.filter(r => r.thickness);
  assert.equal(rows.length, 8);
  const profiles = rows.map(r => classifyMaterial('original', hash, r));
  assert.deepEqual(profiles.filter(p => p.status === 'SOURCE_DECLARED').map(p => p.panelType).sort(), ['FIBREBOARD_PFL_HDF', 'GLASS']);
  assert.equal(profiles.filter(p => p.status === 'REVIEW_REQUIRED').length, 6);
  for (const row of rows) {
    const result = classifyMaterial('original', hash, row);
    assert.deepEqual(result, classifyMaterial('original', hash, row));
    assert.equal(result.source.recordId, row.id); assert.equal(result.source.candidateUuid, row.candidateUuid);
    assert.equal(result.thickness?.value.value, row.thickness!.value);
    assert.equal(result.purchasingBasis.unit, null); assert.equal(result.purchasingBasis.stockSheet, null);
    assert.equal(classifyMaterial('new', 'different-hash', row).status, 'REVIEW_REQUIRED');
    assert.equal(classifyMaterial('original', hash, { ...row, candidateUuid: 'different-id' }).status, 'REVIEW_REQUIRED');
    assert.equal(classifyMaterial('original', hash, { ...row, name: `${row.name} changed` }).status, 'REVIEW_REQUIRED');
  }
  assert.equal(JSON.stringify(parsed), before);
});
