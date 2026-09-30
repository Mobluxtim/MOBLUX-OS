import type { TechnicalMaterial, TechnicalEdge } from '../../contracts/technical-model.js';
import type { MaterialRequest } from './matching.js';
import { decimalIdentity } from '../projects/normalize.js';

/** Inputs come only from the frozen technical model, never a manually entered material list. */
export function deriveMaterialRequests(materials: Pick<TechnicalMaterial, 'id' | 'description' | 'thickness' | 'unit'>[], edges: Pick<TechnicalEdge, 'material' | 'thickness' | 'unit' | 'partId' | 'slot'>[]): MaterialRequest[] {
  const unique = new Map<string, MaterialRequest>();
  function add(category: 'PANEL' | 'EDGE', name: string, thickness: string, unit: 'mm', ref: string) {
    const value = decimalIdentity(thickness), key = JSON.stringify([category, name, value, unit]);
    const item = unique.get(key) ?? { category, name, thickness: value, unit, sourceRefs: [] };
    item.sourceRefs.push(ref); unique.set(key, item);
  }
  for (const m of materials) add('PANEL', m.description, m.thickness, m.unit, m.id);
  for (const e of edges) if (e.material || e.thickness) add('EDGE', e.material, e.thickness, e.unit, `${e.partId}:${e.slot}`);
  return [...unique.values()].sort((a, b) => JSON.stringify([a.category, a.name, a.thickness]).localeCompare(JSON.stringify([b.category, b.name, b.thickness]))).map(r => ({ ...r, sourceRefs: r.sourceRefs.sort() }));
}
