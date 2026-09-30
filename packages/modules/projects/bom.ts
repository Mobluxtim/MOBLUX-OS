import type { TechnicalModelDetail } from '../../contracts/technical-model.js';
import type { ResolvedMaterial } from '../../contracts/resolution.js';
import type { BomResult, BomSource, PanelRequirement, EdgeRequirement } from '../../contracts/bom.js';
import { decimalIdentity } from './normalize.js';

export const bomAlgorithmVersion = 'net-export-rectangles/v1';
const scale = 1_000_000n;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function dimension(value: string) {
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(value)) throw new Error('Unsupported BOM dimension.');
  const [whole, fraction = ''] = value.split('.'); const result = BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'));
  if (result <= 0n) throw new Error('BOM dimensions must be positive.');
  return result;
}
// Dimensions are exact millionths of mm; a product divided by 10^18 is m².
function areaText(value: bigint) {
  const text = value.toString().padStart(19, '0'); const fraction = text.slice(-18).replace(/0+$/, '');
  return text.slice(0, -18) + (fraction ? `.${fraction}` : '');
}
type Input = Pick<TechnicalModelDetail, 'cabinets' | 'parts' | 'materials' | 'edges' | 'sources'> & { model: { id: string; versionId: string } };
export function buildBom(input: Input, resolved: ResolvedMaterial[]): BomResult {
  const panels = new Map<string, { line: PanelRequirement; area: bigint }>(), edges = new Map<string, EdgeRequirement>();
  const materials = new Map(input.materials.map(m => [m.id, m])), cabinets = new Map(input.cabinets.map(c => [c.id, c])), sources = new Map(input.sources.map(s => [s.id, s]));
  const parts = new Map<string, BomSource>(), panelLinks = new Map<string, ResolvedMaterial>(), edgeLinks = new Map<string, ResolvedMaterial>();
  for (const match of resolved) for (const ref of match.sourceRefs) {
    const target = match.category === 'PANEL' ? panelLinks : edgeLinks;
    if (target.has(ref)) throw new Error('Duplicate BOM resolution reference.');
    target.set(ref, match);
  }
  let totalArea = 0n, units = 0, edgeOccurrences = 0;
  const issues = new Set<string>();
  for (const p of [...input.parts].sort((a, b) => a.sourceRow - b.sourceRow || compare(a.id, b.id))) {
    if (p.versionId !== input.model.versionId || parts.has(p.id) || !Number.isSafeInteger(p.data.quantity) || p.data.quantity <= 0 || p.data.dimensions.unit !== 'mm') throw new Error('Invalid BOM part/version/quantity/unit.');
    const m = materials.get(p.materialId), source = sources.get(p.sourceId), cabinet = p.cabinetId ? cabinets.get(p.cabinetId) : undefined;
    if (!m || !source || m.versionId !== input.model.versionId || m.unit !== 'mm' || (p.cabinetId && (!cabinet || cabinet.versionId !== input.model.versionId))) throw new Error('Invalid BOM ancestry.');
    const link = panelLinks.get(m.id);
    if (link && (link.name !== m.description || decimalIdentity(link.thickness) !== decimalIdentity(m.thickness) || link.unit !== m.unit)) throw new Error('BOM resolution does not match source material.');
    const master = link?.status === 'EXACT_UNIQUE' ? link.materialMasterId : null;
    const key = JSON.stringify([master ?? `unresolved:${m.id}`, decimalIdentity(m.thickness)]);
    const row: BomSource = { partId: p.id, partName: p.data.name, reference: p.data.sourceNumber, cabinetId: p.cabinetId, cabinetName: cabinet?.name ?? null, cabinetSourceLabel: p.data.cabinetLabel, cabinetLink: p.linkStatus, sourceId: p.sourceId, sourceHash: source.hash, reportId: p.reportId, row: p.sourceRow, line: p.sourceLine, quantity: p.data.quantity, firstMm: p.data.dimensions.first, secondMm: p.data.dimensions.second };
    parts.set(p.id, row);
    const area = dimension(row.firstMm) * dimension(row.secondMm) * BigInt(row.quantity);
    const group = panels.get(key) ?? { line: { key, materialMasterId: master ?? null, name: m.description, thicknessMm: decimalIdentity(m.thickness), partRows: 0, units: 0, areaM2: '0', contributions: [] }, area: 0n };
    group.area += area; group.line.partRows++; group.line.units += row.quantity;
    group.line.contributions.push({ ...row, technicalMaterialId: m.id, areaM2: areaText(area) }); panels.set(key, group);
    totalArea += area; units += row.quantity;
    if (!master) issues.add('UNRESOLVED_PANEL_MATERIAL');
    if (p.linkStatus !== 'LINKED') issues.add('UNRESOLVED_CABINET_LINK');
  }
  const seen = new Set<string>();
  for (const e of [...input.edges].sort((a, b) => compare(a.partId, b.partId) || a.slot - b.slot)) {
    const row = parts.get(e.partId), ref = `${e.partId}:${e.slot}`;
    if (!row || e.versionId !== input.model.versionId || e.unit !== 'mm' || e.side !== null || !Number.isInteger(e.slot) || e.slot < 1 || e.slot > 4 || seen.has(ref)) throw new Error('Unsupported BOM edge data.');
    seen.add(ref);
    if (!e.material && !e.thickness) continue;
    if (!e.material || !e.thickness) throw new Error('Incomplete BOM edge pair.');
    const link = edgeLinks.get(ref);
    if (link && (link.name !== e.material || decimalIdentity(link.thickness) !== decimalIdentity(e.thickness))) throw new Error('BOM edge resolution does not match source.');
    const master = link?.status === 'EXACT_UNIQUE' ? link.materialMasterId : null;
    const key = JSON.stringify([master ?? `unresolved:${e.material}`, decimalIdentity(e.thickness)]);
    const group = edges.get(key) ?? { key, materialMasterId: master ?? null, name: e.material, thicknessMm: decimalIdentity(e.thickness), slotRows: 0, occurrences: 0, lengthM: null, status: 'ORIENTATION_UNVERIFIED' as const, contributions: [] };
    group.slotRows++; group.occurrences += row.quantity; group.contributions.push({ ...row, slot: e.slot, side: null }); edges.set(key, group); edgeOccurrences += row.quantity;
    if (!master) issues.add('UNRESOLVED_EDGE_MATERIAL');
    issues.add('EDGE_LENGTH_UNAVAILABLE_ORIENTATION_UNVERIFIED');
  }
  if (!Number.isSafeInteger(units) || !Number.isSafeInteger(edgeOccurrences)) throw new Error('BOM quantity overflow.');
  return { modelId: input.model.id, versionId: input.model.versionId, status: issues.size ? 'PARTIAL' : 'NET_PANEL_READY',
    totals: { cabinets: input.cabinets.length, partRows: input.parts.length, units, panelAreaM2: areaText(totalArea), populatedEdgeSlots: [...edges.values()].reduce((n, e) => n + e.slotRows, 0), edgeOccurrences },
    panels: [...panels.values()].map(g => ({ ...g.line, areaM2: areaText(g.area) })).sort((a, b) => compare(a.key, b.key)), edges: [...edges.values()].sort((a, b) => compare(a.key, b.key)), issues: [...issues].sort() };
}
