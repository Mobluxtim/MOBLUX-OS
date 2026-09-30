import { createHash } from 'node:crypto';
import type { CsvResult, ImportedCabinet, ImportedPart } from '../../contracts/imports.js';
import type { ModelIssue, ModelSummary, TechnicalPart } from '../../contracts/technical-model.js';

export const normalizerVersion = 'polyboard-technical/v1';
export function decimalIdentity(value: string) {
  const [integer, fraction = ''] = value.split('.');
  const whole = integer.replace(/^0+(?=\d)/, ''), tail = fraction.replace(/0+$/, '');
  return tail ? `${whole}.${tail}` : whole;
}
/** Consumes existing adapter results only. No parsing, fuzzy names, inferred rooms or grain. */
export function normalizeReports(cabinetReport: CsvResult, partReport: CsvResult) {
  if (cabinetReport.status !== 'NEEDS_REVIEW' || partReport.status !== 'NEEDS_REVIEW' || cabinetReport.profile !== 'polyboard-cabinets-7/v1' || partReport.profile !== 'polyboard-cutting-18/v1') throw new Error('Select successful cabinet and cutting reports.');
  const cabinets = cabinetReport.records as ImportedCabinet[], inputParts = partReport.records as ImportedPart[];
  if (!cabinets.length || !inputParts.length || cabinets.some(c => c.kind !== 'cabinet') || inputParts.some(p => p.kind !== 'part')) throw new Error('Reports do not contain the required cabinet/part records.');
  const names = new Map<string, number[]>();
  const issues: ModelIssue[] = [];
  for (const cabinet of cabinets) names.set(cabinet.name, [...(names.get(cabinet.name) ?? []), cabinet.row]);
  for (const cabinet of cabinets) {
    if (names.get(cabinet.name)!.length > 1) issues.push({ code: 'DUPLICATE_CABINET_NAME', entity: 'cabinet', row: cabinet.row, message: 'Cabinet name is not unique; parts with this label remain ambiguous.' });
    if (cabinet.quantity !== 1) issues.push({ code: 'CABINET_QUANTITY', entity: 'cabinet', row: cabinet.row, message: 'Cabinet quantity differs from 1; exported part quantities are retained, not multiplied.' });
  }
  const projectLabels = new Set(inputParts.map(p => p.projectLabel));
  const materials = new Map<string, { key: string; description: string; thickness: string; unit: 'mm' }>();
  const parts = inputParts.map(data => {
    const matches = names.get(data.cabinetLabel) ?? [];
    const linkStatus = projectLabels.size !== 1 || matches.length > 1 ? 'AMBIGUOUS' : matches.length === 1 ? 'LINKED' : 'UNMAPPED';
    if (linkStatus !== 'LINKED') issues.push({ code: linkStatus === 'AMBIGUOUS' ? 'AMBIGUOUS_CABINET' : 'CABINET_NOT_FOUND', entity: 'part', row: data.row, message: projectLabels.size !== 1 ? 'Cutting report contains multiple project labels; cabinet identity cannot be resolved safely.' : matches.length ? 'More than one cabinet has the exact source label.' : 'No cabinet has the exact source label. No case-folding, trimming or fuzzy matching was applied.' });
    const thickness = decimalIdentity(data.material.thickness);
    const key = createHash('sha256').update(JSON.stringify([data.material.description, thickness, data.material.unit])).digest('hex');
    if (!materials.has(key)) materials.set(key, { key, description: data.material.description, thickness, unit: data.material.unit });
    return { data, cabinetRow: linkStatus === 'LINKED' ? matches[0] : null, materialKey: key, linkStatus: linkStatus as TechnicalPart['linkStatus'] };
  });
  issues.push({ code: 'UNMAPPED_MANUFACTURING_FIELDS', entity: 'model', message: 'Column 10 and edge-side orientation remain raw/unmapped. Dimension order is preserved; no grain, rotation or oriented-edge calculations are authorized.' });
  issues.push({ code: 'NO_CATALOG_MATCH', entity: 'model', message: 'Materials are deduplicated only within this version by exact description, numeric thickness and unit; they are not inventory/catalog identities.' });
  for (const finding of partReport.findings.filter(f => f.code === 'REPEATED_SOURCE_LABEL')) issues.push({ code: finding.code, entity: 'part', row: finding.row, message: finding.message });
  const summary: ModelSummary = { cabinets: cabinets.length, partRows: parts.length, units: parts.reduce((n, p) => n + p.data.quantity, 0), materials: materials.size, linkedRows: parts.filter(p => p.linkStatus === 'LINKED').length, ambiguousRows: parts.filter(p => p.linkStatus === 'AMBIGUOUS').length, unmappedRows: parts.filter(p => p.linkStatus === 'UNMAPPED').length };
  return { cabinets, parts, materials: [...materials.values()], issues, summary };
}
