import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBom } from '../../packages/modules/projects/bom.js';
import { parsePolyboardCsv } from '../../packages/modules/imports/polyboard-csv.js';
import type { ImportedPart } from '../../packages/contracts/imports.js';
import type { ResolvedMaterial } from '../../packages/contracts/resolution.js';
import type { TechnicalModelDetail } from '../../packages/contracts/technical-model.js';
function fixture() {
  const data = parsePolyboardCsv(Buffer.from('1;Project;Cabinet;Part;100.1;200.2;3;Material;18;-1;Edge;0.8;;;;;;'), 'polyboard-cutting-18/v1').records[0] as ImportedPart;
  const input: Pick<TechnicalModelDetail, 'cabinets' | 'parts' | 'materials' | 'edges' | 'sources'> & { model: { id: string; versionId: string } } = {
    model: { id: 'model', versionId: 'version' },
    cabinets: [{ id: 'cabinet', versionId: 'version', name: 'Cabinet', quantity: 9, reportId: 'c-report', sourceId: 'c-source', sourceRow: 1, sourceLine: 1, dimensions: { height: '1000', width: '800', depth: '500', unit: 'mm' } }],
    materials: [{ id: 'material', versionId: 'version', key: 'material', description: 'Material', thickness: '18', unit: 'mm' }],
    parts: [{ id: 'part', versionId: 'version', cabinetId: 'cabinet', materialId: 'material', sourceId: 'source', reportId: 'report', sourceRow: 1, sourceLine: 2, linkStatus: 'LINKED', data }],
    edges: data.unmapped.edgeSlots.map(e => ({ ...e, partId: 'part', versionId: 'version' })), sources: [{ id: 'source', name: 'synthetic.csv', hash: 'synthetic-hash', objectVersion: null }]
  };
  const matches: ResolvedMaterial[] = [{ category: 'PANEL', name: 'Material', thickness: '18', unit: 'mm', sourceRefs: ['material'], status: 'EXACT_UNIQUE', reason: 'Synthetic', candidates: [], materialMasterId: 'panel-master' }, { category: 'EDGE', name: 'Edge', thickness: '0.8', unit: 'mm', sourceRefs: ['part:1'], status: 'EXACT_UNIQUE', reason: 'Synthetic', candidates: [], materialMasterId: 'edge-master' }];
  return { input, matches };
}
test('BOM calculates exact exported area once, preserves drill-down and never infers edge lengths', () => {
  const { input, matches } = fixture(), original = structuredClone(input);
  const result = buildBom(input, matches);
  assert.equal(result.totals.panelAreaM2, '0.06012006'); assert.equal(result.totals.units, 3); // not 3 × cabinet quantity 9
  assert.equal(result.panels[0].materialMasterId, 'panel-master'); assert.equal(result.panels[0].contributions[0].sourceHash, 'synthetic-hash');
  assert.equal(result.panels[0].contributions[0].line, 2); assert.equal(result.edges[0].lengthM, null); assert.equal(result.edges[0].occurrences, 3);
  assert.equal(result.edges[0].slotRows, 1); assert.equal(result.status, 'PARTIAL'); assert.deepEqual(input, original);
  input.parts[0].data.dimensions.first = '0.000001'; input.parts[0].data.dimensions.second = '0.000001';
  assert.equal(buildBom(input, matches).totals.panelAreaM2, '0.000000000000000003');
});
test('BOM groups masters/thickness, does not lose unresolved rows, and is deterministic', () => {
  const { input, matches } = fixture();
  input.parts.push({ ...structuredClone(input.parts[0]), id: 'part2', sourceRow: 2, cabinetId: null, linkStatus: 'AMBIGUOUS' });
  const result = buildBom(input, matches); assert.equal(result.panels.length, 1); assert.equal(result.panels[0].units, 6); assert.equal(result.panels[0].partRows, 2);
  assert.ok(result.issues.includes('UNRESOLVED_CABINET_LINK'));
  input.parts.reverse(); assert.deepEqual(buildBom(input, matches), result);
  const unmatched = buildBom(input, []); assert.equal(unmatched.totals.panelAreaM2, result.totals.panelAreaM2); assert.equal(unmatched.panels[0].materialMasterId, null);
  assert.ok(unmatched.issues.includes('UNRESOLVED_PANEL_MATERIAL'));
  input.materials.push({ ...input.materials[0], id: 'thick', thickness: '36' }); input.parts[0].materialId = 'thick';
  assert.equal(buildBom(input, []).panels.length, 2);
});
test('BOM fails closed on invalid dimensions, unsupported edge semantics and broken ancestry', () => {
  const { input, matches } = fixture();
  input.parts[0].data.dimensions.first = 'NaN'; assert.throws(() => buildBom(input, matches), /dimension/);
  input.parts[0].data.dimensions.first = '100'; input.parts[0].versionId = 'wrong'; assert.throws(() => buildBom(input, matches), /version/);
  input.parts[0].versionId = 'version'; input.edges.push(input.edges[0]); assert.throws(() => buildBom(input, matches), /edge/);
});
