import type { OptimizationResult, OptimizationPanel } from '../../contracts/optimization.js';
import type { PdfLayout } from './opticut-pdf.js';
export const opticutParserVersion = 'opticut-6.09-ro-pdf/v1';
const unlinked = { materialMasterId: null, linkStatus: 'UNRESOLVED' as const };
function check(value: unknown, message = 'Unsupported or inconsistent OptiCut table structure.'): asserts value { if (!value) throw new Error(message); }
function num(s: string, unit = '') { const m = s?.match(new RegExp(`^(\\d+(?:\\.\\d{1,2})?)${unit ? ` ${unit}` : ''}$`)); check(m); check(Number(m[1]) <= 100000000); return m[1]; }
function count(s: string) { check(/^\d{1,6}$/.test(s)); return Number(s); }
function percent(s: string) { const n = num(s, '%'); check(Number(n) <= 100); return n; }
function material(s: string) { const m = s.match(/^(.+), (\d+\.\d{2})$/); check(m && !m[1].includes('...')); return { name: m[1], thicknessMm: m[2] }; }
function size(s: string) { const m = s.match(/^(\d+\.\d{2}) × (\d+\.\d{2})$/); check(m && Number(m[1]) > 0 && Number(m[2]) > 0); return { lengthMm: num(m[1]), widthMm: num(m[2]) }; }
/** Parses only labeled observed summary tables; never diagrams, prices or guessed truncated names. */
export function parseOpticutLayout(layout: PdfLayout): OptimizationResult {
  const result: OptimizationResult = { projectLabel: '', sourceDate: '', sourcePages: layout.pageCount, cuttingRows: 0,
    totals: { sheets: 0, placedUnits: 0, requestedUnits: 0, failedUnits: 0, sheetAreaM2: '', partAreaM2: '', wastePercent: '', edgeLengthM: '', cuttingLengthM: '', location: { page: 0, row: 0 } }, panels: [], edges: [], failed: [], findings: [] };
  let section = '', header = false, cuttingTotal: number[] = [], mapTotal: string[] = [], edgeTotal = '';
  const cutRows = new Map<number, number>(), summary = new Map<string, string>();
  const sectionHeaders: Record<string, string[]> = {
    cut: ['Material', 'Referinţă', 'Cabinet', 'Dimensiuni', 'Cantitate', 'Plasate'],
    panels: ['Material', 'Dimensiuni', 'Cantitate', 'Suprafata'], edges: ['Material', 'Grosime', 'Lungime', 'Cost'],
    maps: ['Material', 'Dimensiuni', 'Cantitate', 'Piese', 'Rata pierderi/resturi', 'Cost net'],
    failed: ['Material', 'Referinţă', 'Cabinet', 'Dimensiuni', 'Cantitate', 'Motiv pentru a nu pl...'], summary: ['Date tehnice', 'Costuri']
  };
  const headings: Record<string, string> = { 'Lista de tăiere': 'cut', 'Panouri necesare': 'panels', 'Lista canturi': 'edges', 'Lista hărţi de tăiere': 'maps', 'Piese eşuate': 'failed', 'Rezumat': 'summary' };
  for (let page = 0; page < layout.pages.length; page++) {
    const rows = layout.pages[page]; check(rows[0]?.cells[0]?.text === 'OptiCut 6.09');
    const label = rows[1]?.cells[0]?.text; check(label);
    if (!page) { result.projectLabel = label; result.sourceDate = rows[0].cells[1]?.text ?? ''; } else check(label === result.projectLabel);
    check(rows.some(r => r.cells.some(c => c.text === `Pagina ${page + 1}/${layout.pageCount}`)));
    section = ''; header = false;
    for (let row = 0; row < rows.length; row++) {
      const c = rows[row].cells.map(v => v.text), location = { page: page + 1, row: row + 1 };
      const heading = c[0].replace(/ \(Next\)$/, '');
      if (headings[heading]) { section = headings[heading]; header = false; continue; }
      if (!section) continue;
      if (!header) { check(JSON.stringify(c) === JSON.stringify(sectionHeaders[section])); header = true; continue; }
      if (section === 'cut') {
        if (c[0] === 'TOTAL') { check(!cuttingTotal.length && c.length === 3); cuttingTotal = [count(c[1]), count(c[2])]; continue; }
        check(c.length === 6 || c.length === 7); const id = count(c[0]); check(!cutRows.has(id)); cutRows.set(id, count(c[5]));
      } else if (section === 'panels') {
        check(c.length === 4); result.panels.push({ ...unlinked, ...material(c[0]), ...size(c[1]), sheets: count(c[2]), sheetAreaM2: num(c[3], 'm²'), placedUnits: 0, cuttingLengthM: null, maps: [], location });
      } else if (section === 'edges') {
        if (c[0] === 'TOTAL') { check(!edgeTotal && c.length === 3); edgeTotal = num(c[1], 'm'); continue; }
        check(c.length === 4 && !c[0].includes('...')); result.edges.push({ ...unlinked, name: c[0], thicknessMm: num(c[1], 'mm'), lengthM: num(c[2], 'm'), location });
      } else if (section === 'maps') {
        if (c[0] === 'TOTAL') { check(!mapTotal.length && c.length === 5); mapTotal = c; continue; }
        check(c.length === 7); const m = material(c[1]), d = size(c[2]);
        const matches = result.panels.filter(p => p.name === m.name && p.thicknessMm === m.thicknessMm && p.lengthMm === d.lengthMm && p.widthMm === d.widthMm);
        check(matches.length === 1); const p: OptimizationPanel = matches[0];
        p.maps.push({ number: count(c[0]), sheets: count(c[3]), placedUnits: count(c[4]), wastePercent: percent(c[5]), location });
      } else if (section === 'failed') {
        check(c.length === 7); const q = c[5].match(/^(\d+) \/ (\d+)$/); check(q); const failedUnits = count(q[1]), requestedUnits = count(q[2]);
        check(failedUnits > 0 && failedUnits <= requestedUnits);
        result.failed.push({ sourceNumber: count(c[0]), materialLabel: c[1], reference: c[2], cabinet: c[3], dimensionsRaw: c[4], failedUnits, requestedUnits, reasonRaw: c[6], truncated: c.some(v => v.includes('...')), partId: null, location });
      } else if (section === 'summary') {
        check(c.length === 2 || c.length === 4); check(!summary.has(c[0])); summary.set(c[0], c[1]); result.totals.location = location;
      }
    }
  }
  const get = (key: string) => { const v = summary.get(key); check(v); return v; };
  const total = result.totals;
  total.sheets = count(get('Număr necesar de panouri')); total.sheetAreaM2 = num(get('Suprafaţă totală panouri'), 'm²'); total.partAreaM2 = num(get('Suprafaţa totală piese'), 'm²');
  total.wastePercent = percent(get('Rata pierderi/resturi')); total.cuttingLengthM = num(get('Lungime tăieri'), 'm'); total.edgeLengthM = num(get('Lungime cant'), 'm');
  check(cuttingTotal.length === 2 && mapTotal.length === 5 && edgeTotal === total.edgeLengthM);
  total.requestedUnits = cuttingTotal[0]; total.placedUnits = cuttingTotal[1]; total.failedUnits = result.failed.reduce((n, r) => n + r.failedUnits, 0);
  result.cuttingRows = cutRows.size;
  check([...cutRows.keys()].every((n, i) => n === i + 1) && [...cutRows.values()].reduce((n, q) => n + q, 0) === total.requestedUnits);
  check(new Set(result.failed.map(f => f.sourceNumber)).size === result.failed.length);
  check(result.failed.every(f => cutRows.get(f.sourceNumber) === f.requestedUnits));
  check(total.placedUnits + total.failedUnits === total.requestedUnits);
  check(count(mapTotal[1]) === total.sheets && count(mapTotal[2]) === total.placedUnits && percent(mapTotal[3]) === total.wastePercent);
  const maps = result.panels.flatMap(p => p.maps);
  check(maps.length === count(get('Număr hărţi de tăiere')) && maps.every((m, i) => m.number === i + 1));
  // v1 supports the observed one-sheet-per-map layout; multiplicities require separately verified semantics.
  check(maps.every(m => m.sheets === 1));
  check(maps.length === total.sheets && maps.reduce((n, m) => n + m.placedUnits, 0) === total.placedUnits);
  for (const p of result.panels) { check(p.sheets === p.maps.length); p.placedUnits = p.maps.reduce((n, m) => n + m.placedUnits, 0); }
  check(result.panels.length && result.edges.length);
  result.findings.push('Printed values retain report precision; rounded material/edge lines may differ from printed project totals.', 'Per-material cutting lengths and aggregate waste percentages are not printed. Cutting is project-level; waste is preserved per cutting map.', 'Failed labels/reasons may be truncated in the source. No fuzzy part/material links or expanded reasons are inferred.', 'OptiCut part area and placed quantities are separate from the normalized BOM; no geometry equivalence is asserted.');
  return result;
}
