import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractMachiningPdf,type PdfLayout} from '../../packages/modules/imports/opticut-pdf.js';
import {parseMachiningLayout,linkMachining,type MachiningLinkInput} from '../../packages/modules/imports/polyboard-machining.js';
function fixture():PdfLayout {
 const page=(n:number,rows:string[][])=>[['PolyBoard 8.02c'],['SYNTHETIC'],[`Pagina ${n}/4`],...rows].map((r,i)=>({y:700-i*10,cells:r.map((text,x)=>({text,x:x*100}))}));
 const header=[['Cabinet'],['1 - Part','Panel','Inaltime: 100','Latime: 200','Grosime: 18','Cantitate: 2']];
 return {pageCount:4,pages:[page(1,[['Lista cabinete']]),page(2,[['Rezumatul costurilor'],['Frezare','Lungime','Pret (lei/m)','Pret'],['Frezare','1.25 m','9.00','11,25 lei'],['Total']]),page(3,[...header,['00000001','1/2'],['Gaurire','A (2)','Diametru: 8','Adancime: 11'],['B (1)','Diametru: 3','Adancime: Strapuns (0)'],['Canelura Vertical','Fata 1','X Pozitie: 10','Y Pozitie: 0','Latime: 3.5','Lungime: 100','Adancime: 6.5']]),page(4,[...header,['00000001','2/2'],['A (10, 20)','A (20, 30)','B (30, 40)','Fata 2']])]};
}
function model():MachiningLinkInput {return {id:'part',cabinetId:'cabinet',sourceId:'csv',reportId:'report',sourceRow:1,sourceLine:1,data:{kind:'part',row:1,line:1,raw:[],sourceNumber:'1',projectLabel:'SYNTHETIC',cabinetLabel:'Cabinet',name:'Part',quantity:2,dimensions:{first:'100.00',second:'200.00',unit:'mm',axisConvention:null},material:{description:'Panel',thickness:'18.00',unit:'mm',catalogId:null},unmapped:{column10:'-1',edgeSlots:[]}}};}
test('continuation pages are one part; literal operations, source coordinates and explicit groove faces retained without prices',()=>{
 const input=fixture(),before=JSON.stringify(input),r=parseMachiningLayout(input);assert.equal(r.parts.length,1);assert.deepEqual(r.parts[0].pages,[3,4]);assert.equal(r.totals.drawingDrillCount,3);assert.equal(r.totals.quantityExtendedDrillCount,6);
 assert.equal(r.parts[0].drilling[1].depthMm,null);assert.equal(r.parts[0].drilling[1].depthRaw,'Strapuns (0)');assert.equal(r.parts[0].drilling[0].coordinates.length,2);assert.equal(r.parts[0].drilling[0].face,null);assert.equal(r.parts[0].grooves[0].face,'Fata 1');assert.equal(r.totals.grooveLengthMm,100);assert.equal(r.totals.quantityExtendedGrooveLengthMm,200);
 assert.equal(r.projectOperations[0].lengthM,'1.25');assert.ok(!JSON.stringify(r).includes('lei'));assert.equal(JSON.stringify(input),before);assert.deepEqual(parseMachiningLayout(input),r);
});
test('exact linkage rejects ambiguous, changed quantity/dimensions/name; immutable inputs preserved',()=>{
 const parsed=parseMachiningLayout(fixture()),m=model(),before=JSON.stringify(parsed);const r=linkMachining(parsed,[m]);assert.equal(r.linkedParts,1);assert.equal(r.cabinets[0].totals.quantityExtendedDrillCount,6);assert.equal(r.parts[0].csvEvidence?.sourceId,'csv');assert.equal(JSON.stringify(parsed),before);
 assert.equal(linkMachining(parsed,[m,{...m,id:'other'}]).parts[0].linkStatus,'AMBIGUOUS');
 for(const patch of [{name:'part'},{quantity:3},{dimensions:{...m.data.dimensions,first:'101'}}]) assert.equal(linkMachining(parsed,[{...m,data:{...m.data,...patch}}]).parts[0].partId,null);
 assert.throws(()=>linkMachining(parsed,[{...m,data:{...m.data,projectLabel:'Other'}}]));
});
test('missing/duplicate continuation, invalid legends and inconsistent pages fail closed; coordinate mismatches stay issues',async()=>{
 for(const mutate of [
  (p:PdfLayout)=>{p.pages.pop();},
  (p:PdfLayout)=>{p.pages[3][5].cells[1].text='1/2';},
  (p:PdfLayout)=>{p.pages[2][6].cells[2].text='Diametru: unknown';},
  (p:PdfLayout)=>{p.pages[2].push(p.pages[2][6]);},
  (p:PdfLayout)=>{p.pages[3][1].cells[0].text='Other';},
 ]){const p=fixture();mutate(p);assert.throws(()=>parseMachiningLayout(p));}
 const p=fixture();p.pages[3][6].cells[0].text='A (99, 99) A (99, 99)';const r=parseMachiningLayout(p);assert.equal(r.parts[0].drilling[0].count,2);assert.ok(r.parts[0].issues.length);
 await assert.rejects(extractMachiningPdf(Buffer.from('not a pdf')));await assert.rejects(extractMachiningPdf(Buffer.from('%PDF-corrupt')));
});
test('real PDF matches independently extracted drilling/groove totals and representative legends',{skip:!process.env.POLYBOARD_REPORT_PATH},async()=>{
 const bytes=await readFile(process.env.POLYBOARD_REPORT_PATH!);assert.equal(createHash('sha256').update(bytes).digest('hex'),'984be25181e595247ece448d3cc487652f2d35e4f25ed43d322498fd7fcda90f');
 const r=parseMachiningLayout(await extractMachiningPdf(bytes));assert.equal(r.parts.length,216);assert.deepEqual(r.totals,{drillingGroups:555,drawingDrillCount:3467,quantityExtendedDrillCount:3774,grooveOperations:50,grooveLengthMm:50671,quantityExtendedGrooveLengthMm:50671});
 const first=r.parts.find(p=>p.pages.includes(11))!;assert.deepEqual(first.drilling.map(d=>[d.label,d.diameterMm,d.depthRaw,d.count]),[['A','8','11',12],['B','5','12',6]]);
 const side=r.parts.find(p=>p.pages.includes(13))!;assert.deepEqual(side.drilling.map(d=>[d.label,d.diameterMm,d.depthRaw,d.count]),[['C','8','21',8],['D','5','14',4],['E','8','30',4],['F','15','13.8',4]]);
 assert.equal(r.parts.filter(p=>p.issues.length).length,2);assert.equal(r.parts.find(p=>p.pages.includes(51))!.pages.length,2);
 assert.deepEqual(r.projectOperations.map(o=>[o.sourceType,o.sourceLabel,o.lengthM]),[['Frezare','Frezare','48.17'],['BiselTeşit','BiselTeşit','7.41'],['Nut si Feder','3.5 mm (6.5 mm)','36.88'],['Nut si Feder','18.5 mm (6.5 mm)','13.79']]);
});
