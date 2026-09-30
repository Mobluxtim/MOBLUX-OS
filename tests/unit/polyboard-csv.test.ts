import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePolyboardCsv, maxCsvBytes, maxCsvRows } from '../../packages/modules/imports/polyboard-csv.js';

// Synthetic values exercising the observed positional layouts; no customer exports in Git.
const part = ['5', 'Synthetic project', 'Synthetic cabinet', 'Back panel', '326.00', '1276.00', '2', 'Synthetic board', '3.00', '-1', '', '', 'Synthetic edge', '0.80', '', '', '', ''];
const parse = (text: string) => parsePolyboardCsv(Buffer.from(text), 'polyboard-cutting-18/v1');

test('sample-derived cutting layout preserves exact decimals, provenance and unresolved fields', () => {
  const result = parse(part.join(';') + '\r\n');
  assert.equal(result.status, 'NEEDS_REVIEW'); assert.equal(result.manufacturingVerified, false);
  assert.equal(result.summary.quantity, 2); assert.equal(result.summary.materials, 1);
  const p = result.records[0]; assert.equal(p.kind, 'part'); if (p.kind !== 'part') return;
  assert.deepEqual(p.dimensions, { first: '326.00', second: '1276.00', unit: 'mm', axisConvention: null });
  assert.equal(p.unmapped.column10, '-1'); assert.equal('grain' in p, false);
  assert.deepEqual(p.unmapped.edgeSlots[1], { slot: 2, material: 'Synthetic edge', thickness: '0.80', unit: 'mm', side: null });
  assert.deepEqual(p.raw, part); assert.equal(p.row, 1); assert.equal(p.line, 1);
});
test('cabinet profile handles BOM but never assigns uncertain unit/total price positions', () => {
  const result = parsePolyboardCsv(Buffer.from('\ufeffSynthetic cabinet;1;650;800;400;123.40;123.40\r\n'), 'polyboard-cabinets-7/v1');
  assert.equal(result.status, 'NEEDS_REVIEW'); assert.equal(result.format.bom, true);
  const r = result.records[0]; assert.equal(r.kind, 'cabinet'); if (r.kind !== 'cabinet') return;
  assert.equal(r.dimensions.height, '650'); assert.equal(r.unmapped.priceColumn6, '123.40');
  assert.equal('currency' in r, false); assert.equal('unitPrice' in r, false);
});
test('CSV quoting preserves separators, escaped quotes, diacritics and embedded newline locators', () => {
  const a = [...part]; a[3] = '"Piesă; ""A""\r\ncontinuare"';
  const result = parse(a.join(';') + '\r\n' + part.join(';'));
  assert.equal(result.records[0].name, 'Piesă; "A"\r\ncontinuare'); assert.equal(result.records[1].line, 3);
});
test('bad column counts, syntax, encoding and control bytes fail without partial normalized data', () => {
  for (const text of [part.join(';') + '\r\n1;wrong', part.join(';') + ';extra', '"unclosed', '"x"garbage', 'a"b', part.join(';') + '\n\n']) {
    const result = parse(text); assert.equal(result.status, 'FAILED', text); assert.deepEqual(result.records, []);
  }
  for (const bytes of [Buffer.from([0xff]), Buffer.from('abc\0')]) assert.equal(parsePolyboardCsv(bytes, 'polyboard-cutting-18/v1').status, 'FAILED');
});
test('invalid quantities and decimals are not rounded, truncated or replaced by zero', () => {
  for (const [column, value] of [[4, '1,23'], [4, '-5'], [4, '0.00'], [4, '1e3'], [6, '1.5'], [6, '0'], [6, '99999999999999999999'], [8, 'NaN']] as const) {
    const row = [...part]; row[column] = value; const result = parse(row.join(';'));
    assert.equal(result.status, 'FAILED'); assert.deepEqual(result.records, []); assert.ok(result.findings.some(f => f.row === 1 && f.column === column + 1));
  }
});
test('repeated source numbers are retained, never deduplicated or treated as global part IDs', () => {
  const result = parse([part.join(';'), part.join(';')].join('\n'));
  assert.equal(result.records.length, 2); assert.equal(result.summary.quantity, 4);
  assert.ok(result.findings.some(f => f.code === 'REPEATED_SOURCE_LABEL'));
});
test('unknown column10 values remain unmapped, edge pairs must be complete', () => {
  const row = [...part]; row[9] = 'future-value';
  const result = parse(row.join(';')); const r = result.records[0];
  assert.equal(r.kind, 'part'); if (r.kind === 'part') assert.equal(r.unmapped.column10, 'future-value');
  row[13] = ''; assert.equal(parse(row.join(';')).status, 'FAILED');
});
test('all parser resource limits fail closed', () => {
  assert.equal(parsePolyboardCsv(Buffer.alloc(maxCsvBytes + 1), 'polyboard-cutting-18/v1').status, 'FAILED');
  assert.equal(parse(Array(maxCsvRows + 1).fill(part.join(';')).join('\n')).status, 'FAILED');
  const row = [...part]; row[3] = 'x'.repeat(4097); assert.equal(parse(row.join(';')).status, 'FAILED');
  assert.equal(parse('').status, 'FAILED');
});
test('profile mismatch fails and material names are not case-folded or catalog-matched', () => {
  assert.equal(parse('Synthetic cabinet;1;650;800;400;123.40;123.40').status, 'FAILED');
  const b = [...part]; b[7] = part[7].toUpperCase(); b[0] = '6';
  const result = parse([part.join(';'), b.join(';')].join('\n'));
  assert.equal(result.summary.materials, 2);
});
