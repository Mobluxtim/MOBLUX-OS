import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractHardwarePdf,type PdfLayout} from '../../packages/modules/imports/opticut-pdf.js';
import {parseHardwareLayout} from '../../packages/modules/imports/polyboard-hardware.js';
function fixture():PdfLayout {
  const page=(n:number,rows:string[][])=>[['PolyBoard 8.02c','01.10.2026'],['SYNTHETIC'],[`Pagina ${n}/2`],...rows].map((r,i)=>({y:700-i*10,cells:r.map((text,x)=>({text,x:x*100}))}));
  return {pageCount:2,pages:[page(1,[['Latime','1000 mm'],['Lista cabinete']]),page(2,[['Rezumatul costurilor'],['Feronerie','Cantitate','Pret unitar','Pret'],['hole/synthetic','2','1.25','2,50 lei'],['peg/synthetic','3'],['Total','2,50 lei'],['Frezare','Excluded operation']])]};
}
test('hardware imports exact summary terminology/reference prices, missing prices and source locations only',()=>{
  const input=fixture(),before=JSON.stringify(input),result=parseHardwareLayout(input);
  assert.equal(result.itemCount,2);assert.equal(result.quantitySum,5);assert.equal(result.items[0].sourceName,'hole/synthetic');
  assert.equal(result.items[0].sourceUnitPriceRaw,'1.25');assert.equal(result.items[0].sourceTotalPriceRaw,'2,50 lei');assert.equal(result.items[1].sourceUnitPriceRaw,null);
  assert.equal(result.items[0].location.page,2);assert.ok(!JSON.stringify(result).includes('Excluded operation'));
  assert.equal(JSON.stringify(input),before);assert.deepEqual(parseHardwareLayout(input),result);
});
test('hardware rejects missing project preamble, truncated/duplicate rows, missing total and changed columns',()=>{
  for(const mutate of [
    (p:PdfLayout)=>{p.pages[0]=p.pages[0].filter(r=>r.cells[0].text!=='Lista cabinete');},
    (p:PdfLayout)=>{p.pages[1][5].cells[0].text='truncated...';},
    (p:PdfLayout)=>{p.pages[1][6].cells[0].text='hole/synthetic';},
    (p:PdfLayout)=>{p.pages[1]=p.pages[1].filter(r=>r.cells[0].text!=='Total');},
    (p:PdfLayout)=>{p.pages[1][4].cells[2].text='Unknown';}
  ]){const p=fixture();mutate(p);assert.throws(()=>parseHardwareLayout(p));}
});
test('real project Feronerie is ten rows, 698 source quantity, with exact requested examples', {skip:!process.env.POLYBOARD_REPORT_PATH},async()=>{
  const bytes=await readFile(process.env.POLYBOARD_REPORT_PATH!);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'984be25181e595247ece448d3cc487652f2d35e4f25ed43d322498fd7fcda90f');
  const p=await extractHardwarePdf(bytes),r=parseHardwareLayout(p);
  assert.equal(p.pages.length,9);assert.equal(r.sourcePages,288);assert.equal(r.itemCount,10);assert.equal(r.quantitySum,698);
  for(const [name,quantity] of [['Hettich/Cam-DU232/Rastex15/p18/2-dowel/interior',334],['Hettich/hing.Sensys-Inset/TH 52x5.5 mm',12],['Hettich/hing.Sensys-Overlay/TH 52x5.5 mm',35],['hole/03',78],['peg-05/32-5/below/3D',144]] as const) assert.equal(r.items.find(i=>i.sourceName===name)?.quantity,quantity);
  assert.deepEqual(r.items.map(i=>i.quantity),[8,8,24,51,4,334,12,35,78,144]);
  assert.equal(r.sourceTotalPriceRaw,'3.229,10 lei');assert.ok(r.items.every(i=>i.location.page===9&&i.sourceUnitPriceRaw&&i.sourceTotalPriceRaw));
});
