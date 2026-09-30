import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMaterialRequests } from '../../packages/modules/catalog/requests.js';
test('automatic request derivation deduplicates exact technical identities and preserves every source reference', () => {
  const materials = [{ id: 'm1', description: 'Exact', thickness: '18.00', unit: 'mm' as const }, { id: 'm2', description: 'Exact', thickness: '18', unit: 'mm' as const }, { id: 'm3', description: 'exact', thickness: '18', unit: 'mm' as const }];
  const edges = [{ partId: 'p1', slot: 1, material: 'Exact', thickness: '0.80', unit: 'mm' as const }, { partId: 'p2', slot: 3, material: 'Exact', thickness: '0.8', unit: 'mm' as const }, { partId: 'p2', slot: 4, material: '', thickness: '', unit: 'mm' as const }];
  const requests = deriveMaterialRequests(materials, edges);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.find(r => r.category === 'PANEL' && r.name === 'Exact')?.sourceRefs, ['m1', 'm2']);
  assert.deepEqual(requests.find(r => r.category === 'EDGE')?.sourceRefs, ['p1:1', 'p2:3']);
  assert.deepEqual(deriveMaterialRequests([...materials].reverse(), [...edges].reverse()), requests);
});
