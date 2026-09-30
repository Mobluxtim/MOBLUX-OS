import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePolyboardCsv } from '../../packages/modules/imports/polyboard-csv.js';
import { normalizeReports, decimalIdentity } from '../../packages/modules/projects/normalize.js';
import { cabinetCsv, cuttingCsv } from '../fixtures/technical-csv.js';
import type { ImportedCabinet, ImportedPart } from '../../packages/contracts/imports.js';

function reports() { return [parsePolyboardCsv(Buffer.from(cabinetCsv), 'polyboard-cabinets-7/v1'), parsePolyboardCsv(Buffer.from(cuttingCsv), 'polyboard-cutting-18/v1')] as const; }
test('normalization preserves 21 cabinets / 216 rows / 280 units and exact links', () => {
  const [c, p] = reports(), before = JSON.stringify([c, p]); const model = normalizeReports(c, p);
  assert.deepEqual(model.summary, { cabinets: 21, partRows: 216, units: 280, materials: 8, linkedRows: 216, ambiguousRows: 0, unmappedRows: 0 });
  for (const part of model.parts) assert.equal(model.cabinets.find(cab => cab.row === part.cabinetRow)?.name, part.data.cabinetLabel);
  assert.equal(JSON.stringify([c, p]), before); assert.deepEqual(normalizeReports(c, p), model);
});
test('material identity canonicalizes only decimal thickness, preserving case, names and raw values', () => {
  const [c, p] = reports(); const first = p.records[0] as ImportedPart, second = p.records[1] as ImportedPart;
  second.material = { ...first.material, thickness: '018.0000' };
  const model = normalizeReports(c, p); assert.equal(model.parts[0].materialKey, model.parts[1].materialKey);
  assert.equal(model.parts[1].data.material.thickness, '018.0000');
  second.material.description = first.material.description.toUpperCase(); assert.notEqual(normalizeReports(c, p).parts[0].materialKey, normalizeReports(c, p).parts[1].materialKey);
  assert.equal(decimalIdentity('000.8000'), '0.8');
});
test('duplicate cabinet labels stay ambiguous and unknown/case-changed labels are unmapped', () => {
  const [c, p] = reports(); (c.records[1] as ImportedCabinet).name = (c.records[0] as ImportedCabinet).name;
  (p.records[2] as ImportedPart).cabinetLabel = 'synthetic cabinet 3';
  const model = normalizeReports(c, p);
  assert.equal(model.parts[0].linkStatus, 'AMBIGUOUS'); assert.equal(model.parts[0].cabinetRow, null);
  assert.equal(model.parts[1].linkStatus, 'UNMAPPED'); assert.equal(model.parts[2].linkStatus, 'UNMAPPED');
  assert.equal(model.summary.partRows, 216); assert.equal(model.summary.units, 280);
});
test('mixed project labels are never guessed and parent quantity never multiplies parts', () => {
  const [c, p] = reports(); (p.records[0] as ImportedPart).projectLabel = 'Other source project'; (c.records[0] as ImportedCabinet).quantity = 4;
  const model = normalizeReports(c, p); assert.equal(model.summary.ambiguousRows, 216); assert.equal(model.summary.units, 280);
  assert.ok(model.issues.some(i => i.code === 'CABINET_QUANTITY'));
});
test('column10, edge slots, original row and every source cell are retained with no side inference', () => {
  const [c, p] = reports(); const part = normalizeReports(c, p).parts[0]; const original = p.records[0] as ImportedPart;
  assert.deepEqual(part.data, original); assert.equal(part.data.unmapped.column10, '-1');
  assert.equal(part.data.unmapped.edgeSlots.length, 4); assert.ok(part.data.unmapped.edgeSlots.every(e => e.side === null));
  assert.equal('grain' in part.data, false); assert.equal(part.data.dimensions.axisConvention, null);
});
test('failed reports and reversed profiles cannot create a normalized model', () => {
  const [c, p] = reports(); assert.throws(() => normalizeReports(p, c)); c.status = 'FAILED'; assert.throws(() => normalizeReports(c, p));
});
