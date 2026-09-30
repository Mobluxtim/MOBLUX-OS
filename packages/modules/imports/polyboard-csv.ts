import type { CsvFinding, CsvProfile, CsvRecord, CsvResult, ImportedCabinet, ImportedPart } from '../../contracts/imports.js';

// Explicit sample-derived profiles, never guessed from a filename or the number of columns.
export const maxCsvBytes = 1024 * 1024;
export const maxCsvRows = 5000;
export interface StructuredImportAdapter { id: CsvProfile; parse(bytes: Uint8Array): CsvResult; }
export const csvAdapters: Record<CsvProfile, StructuredImportAdapter> = {
  'polyboard-cabinets-7/v1': { id: 'polyboard-cabinets-7/v1', parse: bytes => parsePolyboardCsv(bytes, 'polyboard-cabinets-7/v1') },
  'polyboard-cutting-18/v1': { id: 'polyboard-cutting-18/v1', parse: bytes => parsePolyboardCsv(bytes, 'polyboard-cutting-18/v1') }
};
const maxCell = 4096;
class CsvError extends Error {
  constructor(message: string, readonly row?: number, readonly column?: number) { super(message); }
}

/** Strict semicolon CSV, including escaped quotes, quoted separators and multiline fields. */
function readRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [], value = '', state: 'plain' | 'quoted' | 'closed' = 'plain', line = 1, startLine = 1;
  function cell() { cells.push(value); value = ''; state = 'plain'; if (cells.length > 18) throw new CsvError('More than 18 columns.', records.length + 1); }
  function row() { cell(); records.push({ row: records.length + 1, line: startLine, raw: cells }); cells = []; if (records.length > maxCsvRows) throw new CsvError(`Maximum ${maxCsvRows} records exceeded.`); }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state === 'quoted') {
      if (ch === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else state = 'closed'; }
      else { value += ch; if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++; }
    } else if (ch === ';') cell();
    else if (ch === '\r' || ch === '\n') { row(); if (ch === '\r' && text[i + 1] === '\n') i++; line++; startLine = line; }
    else if (state === 'closed') throw new CsvError('Unexpected text after a closing quote.', records.length + 1, cells.length + 1);
    else if (ch === '"') { if (value) throw new CsvError('Quote inside an unquoted field.', records.length + 1, cells.length + 1); state = 'quoted'; }
    else value += ch;
    if (value.length > maxCell) throw new CsvError(`Cell exceeds ${maxCell} characters.`, records.length + 1, cells.length + 1);
  }
  if (state === 'quoted') throw new CsvError('Unclosed quoted field.', records.length + 1, cells.length + 1);
  if (value || cells.length || state === 'closed') row();
  if (!records.length) throw new CsvError('CSV is empty.');
  return records;
}

export function parsePolyboardCsv(bytes: Uint8Array, profile: CsvProfile): CsvResult {
  const result: CsvResult = { schemaVersion: 1, profile, status: 'NEEDS_REVIEW', manufacturingVerified: false,
    format: { encoding: 'UTF-8', delimiter: ';', header: false, bom: bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 },
    summary: { rows: 0, quantity: 0, cabinetLabels: 0, materials: 0 }, records: [], findings: [] };
  const findings = result.findings;
  try {
    if (!bytes.length || bytes.length > maxCsvBytes) throw new CsvError('CSV parsing accepts non-empty files up to 1 MB. The original remains preserved.');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new CsvError('Only valid UTF-8 is supported by this profile. No encoding substitution was made.'); }
    // Delimiters/newlines are permitted; binary/control content is not parsed.
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new CsvError('Unexpected control or binary content.');
    const rows = readRecords(text);
    result.summary.rows = rows.length;
    const expected = profile === 'polyboard-cabinets-7/v1' ? 7 : 18;
    const identities = new Set<string>(), labels = new Set<string>(), materials = new Set<string>();
    const issue = (code: string, message: string, row: number, column?: number, severity: CsvFinding['severity'] = 'error') => {
      if (findings.length < 100) findings.push({ code, severity, message, row, ...(column ? { column } : {}) });
    };
    let invalid = false;
    for (const record of rows) {
      const r = record.raw;
      if (r.length !== expected) { invalid = true; issue('COLUMN_COUNT', `Expected ${expected} columns; received ${r.length}. Select the matching export profile.`, record.row); continue; }
      const required = (column: number) => { if (!r[column - 1].trim()) { invalid = true; issue('REQUIRED_VALUE', 'Required source text is empty.', record.row, column); } return r[column - 1]; };
      const decimal = (column: number, zero = false) => {
        const raw = r[column - 1];
        if (!/^\d{1,12}(\.\d{1,6})?$/.test(raw) || (!zero && !/[1-9]/.test(raw))) { invalid = true; issue('DECIMAL', 'Expected a positive dot-decimal value without grouping or unit suffix. No conversion was attempted.', record.row, column); }
        return raw; // Decimal text stays exact; no rounding or float conversion.
      };
      const quantity = (column: number) => {
        const raw = r[column - 1];
        if (!/^[1-9]\d{0,8}$/.test(raw)) { invalid = true; issue('QUANTITY', 'Expected a positive whole-number quantity.', record.row, column); return 0; }
        return Number(raw);
      };
      let normalized: ImportedCabinet | ImportedPart;
      if (profile === 'polyboard-cabinets-7/v1') {
        normalized = { ...record, kind: 'cabinet', name: required(1), quantity: quantity(2),
          dimensions: { height: decimal(3), width: decimal(4), depth: decimal(5), unit: 'mm' },
          unmapped: { priceColumn6: decimal(6, true), priceColumn7: decimal(7, true) } };
        labels.add(normalized.name);
      } else {
        normalized = { ...record, kind: 'part', sourceNumber: required(1), projectLabel: required(2), cabinetLabel: required(3), name: required(4),
          dimensions: { first: decimal(5), second: decimal(6), unit: 'mm', axisConvention: null }, quantity: quantity(7),
          material: { description: required(8), thickness: decimal(9), unit: 'mm', catalogId: null },
          unmapped: { column10: r[9], edgeSlots: [] } };
        for (let slot = 0; slot < 4; slot++) {
          const c = 10 + slot * 2;
          if (!!r[c] !== !!r[c + 1]) { invalid = true; issue('EDGE_PAIR', 'Edge description/value must either both be present or both be empty.', record.row, c + 1); }
          if (r[c + 1]) decimal(c + 2, true);
          normalized.unmapped.edgeSlots.push({ slot: slot + 1, material: r[c], thickness: r[c + 1], unit: 'mm', side: null });
        }
        labels.add(normalized.cabinetLabel); materials.add(JSON.stringify([normalized.material.description, normalized.material.thickness]));
      }
      const key = normalized.kind === 'cabinet' ? normalized.name : JSON.stringify([normalized.projectLabel, normalized.cabinetLabel, normalized.sourceNumber]);
      if (identities.has(key)) issue('REPEATED_SOURCE_LABEL', 'Source name/number repeats. Rows remain separate; it is not a stable unique identifier.', record.row, undefined, 'warning');
      identities.add(key); result.summary.quantity += normalized.quantity; result.records.push(normalized);
    }
    if (invalid) { result.status = 'FAILED'; result.records = []; result.summary.quantity = 0; }
    else { result.summary.cabinetLabels = labels.size; result.summary.materials = materials.size; }
    findings.push({ code: 'EXPLICIT_PROFILE', severity: 'warning', message: 'Headerless CSV: interpretation uses the explicitly selected, sample-derived profile, not automatic vendor detection.' });
    findings.push({ code: 'NOT_MANUFACTURING_VALIDATED', severity: 'warning', message: 'Staging only. No version was changed or published; no customer approval or production release was granted.' });
    findings.push(profile === 'polyboard-cabinets-7/v1'
      ? { code: 'PRICE_ORDER_UNCONFIRMED', severity: 'warning', message: 'Columns 6 and 7 are preserved as raw price values. Unit/total order, currency code, tax and commercial meaning are not established.' }
      : { code: 'ORIENTATION_UNCONFIRMED', severity: 'warning', message: 'Dimension axes, column 10, edge slot sides and stable part identities are unresolved. Material descriptions are not catalog matches. Do not use this staging result for cutting or grain calculations.' });
  } catch (error) {
    if (!(error instanceof CsvError)) throw error;
    result.status = 'FAILED'; result.records = [];
    result.findings = [{ code: 'CSV_FORMAT', severity: 'error', message: error.message, ...(error.row ? { row: error.row } : {}), ...(error.column ? { column: error.column } : {}) }];
  }
  return result;
}
