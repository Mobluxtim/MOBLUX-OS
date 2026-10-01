import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseOpticutLayout } from '../../packages/modules/imports/opticut.js';
import { extractOpticutPdf, type PdfLayout } from '../../packages/modules/imports/opticut-pdf.js';

function synthetic(): PdfLayout {
  const rows = [
    ['OptiCut 6.09', '01.10.2026'], ['SYNTHETIC'], ['Pagina 1/1'], ['Lista de tăiere'], ['Material','Referinţă','Cabinet','Dimensiuni','Cantitate','Plasate'],
    ['1','TEST, 18.00','Shelf','Cab','200.00 × 100.00','3'], ['TOTAL','3','2'],
    ['Panouri necesare'], ['Material','Dimensiuni','Cantitate','Suprafata'], ['TEST, 18.00','1000.00 × 500.00','1','0.50 m²'],
    ['Lista canturi'], ['Material','Grosime','Lungime','Cost'], ['EDGE','0.80 mm','1.00 m','PRIVATE'], ['TOTAL','1.00 m','PRIVATE'],
    ['Lista hărţi de tăiere'], ['Material','Dimensiuni','Cantitate','Piese','Rata pierderi/resturi','Cost net'], ['1','TEST, 18.00','1000.00 × 500.00','1','2','50.00 %','PRIVATE'], ['TOTAL','1','2','50.00 %','PRIVATE'],
    ['Piese eşuate'], ['Material','Referinţă','Cabinet','Dimensiuni','Cantitate','Motiv pentru a nu pl...'], ['1','TEST, 18.00','Shelf','Cab','200.00 × 100.00','1 / 3','Source reason...'],
    ['Rezumat'], ['Date tehnice','Costuri'], ['Număr necesar de panouri','1'], ['Număr hărţi de tăiere','1'], ['Suprafaţă totală panouri','0.50 m²'], ['Suprafaţa totală piese','0.25 m²'], ['Rata pierderi/resturi','50.00 %'], ['Lungime tăieri','2.00 m'], ['Lungime cant','1.00 m']
  ];
  return { pageCount: 1, pages: [rows.map((r,i) => ({ y: 700-i*10, cells: r.map((text,x) => ({ text,x: x*50 })) }))] };
}
test('OptiCut labeled tables preserve units, failed reasons, provenance and precision without prices or guessed links', () => {
  const input = synthetic(), original = JSON.stringify(input), r = parseOpticutLayout(input);
  assert.equal(r.totals.sheets,1); assert.equal(r.totals.failedUnits,1); assert.equal(r.panels[0].placedUnits,2);
  assert.equal(r.panels[0].cuttingLengthM,null); assert.equal(r.failed[0].reasonRaw,'Source reason...'); assert.equal(r.failed[0].partId,null);
  assert.equal(r.edges[0].materialMasterId,null); assert.equal(r.totals.edgeLengthM,'1.00');
  assert.ok(r.panels[0].maps[0].location.row); assert.ok(!JSON.stringify(r).includes('PRIVATE'));
  assert.deepEqual(parseOpticutLayout(input),r); assert.equal(JSON.stringify(input),original);
});
test('OptiCut fails closed on mismatched totals, missing headers, duplicate rows/maps and unsupported map multiplicities', () => {
  for (const mutate of [
    (p: PdfLayout) => { p.pages[0].find(r=>r.cells[0].text==='Lungime cant')!.cells[1].text='3.00 m'; },
    (p: PdfLayout) => { p.pages[0].find(r=>r.cells[0].text==='Date tehnice')!.cells[0].text='Unknown'; },
    (p: PdfLayout) => { p.pages[0].splice(6,0,structuredClone(p.pages[0][6])); },
    (p: PdfLayout) => { p.pages[0].find(r=>r.cells.length===7 && r.cells[1].text==='TEST, 18.00')!.cells[3].text='2'; },
    (p: PdfLayout) => { p.pages[0].find(r=>r.cells.length===7 && r.cells[1].text==='TEST, 18.00')!.cells[5].text='101.00 %'; },
    (p: PdfLayout) => { p.pages[0].find(r=>r.cells[6]?.text==='Source reason...')!.cells[5].text='4 / 3'; }
  ]) { const input=synthetic(); mutate(input); assert.throws(()=>parseOpticutLayout(input)); }
});
test('PDF recognition rejects non-PDF, oversized and corrupt input safely', async () => {
  await assert.rejects(extractOpticutPdf(Buffer.from('not pdf')));
  await assert.rejects(extractOpticutPdf(Buffer.alloc(11*1024*1024)));
  await assert.rejects(extractOpticutPdf(Buffer.from('%PDF-1.4\ninvalid')));
});
test('real OptiCut PDF reproduces declared totals and preserves 17 failed rows/21 units', {skip: !process.env.OPTICUT_FIXTURE_PATH}, async () => {
  const bytes=await readFile(process.env.OPTICUT_FIXTURE_PATH!); const hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,'32c912d2bdceadd1d8c407d1d58d21764d1b0c05e73b7e973d9be1a7b3ad765e');
  const r=parseOpticutLayout(await extractOpticutPdf(bytes));
  assert.deepEqual([r.totals.sheets,r.totals.edgeLengthM,r.totals.cuttingLengthM,r.totals.wastePercent,r.totals.placedUnits],[25,'617.69','537.04','18.66',259]);
  assert.deepEqual(r.panels.map(p=>[p.sheets,p.placedUnits]),[[3,17],[13,159],[3,6],[1,34],[5,43]]);
  assert.equal(r.totals.sheetAreaM2,'137.76'); assert.equal(r.cuttingRows,216); assert.equal(r.failed.length,17); assert.equal(r.totals.failedUnits,21);
  assert.ok(r.failed.every(f=>f.truncated && f.partId===null)); assert.equal(r.edges.length,4);
  assert.ok(!JSON.stringify(r).includes('lei')); assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
});
