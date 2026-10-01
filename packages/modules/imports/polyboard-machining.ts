import type {PdfLayout} from './opticut-pdf.js';
import type {MachiningResult,MachiningPart,MachiningTotals} from '../../contracts/machining.js';
import type {ImportedPart} from '../../contracts/imports.js';
export const machiningParserVersion='polyboard-8.02c-ro-machining-pdf/v1';
function check(v:unknown):asserts v {if(!v)throw new Error('Unsupported or inconsistent machining report.');}
const decimal=/^\d{1,7}(?:\.\d{1,4})?$/;
function value(text:string,prefix:string){check(text?.startsWith(prefix));const n=text.slice(prefix.length);check(decimal.test(n));return n;}
function empty():MachiningTotals{return {drillingGroups:0,drawingDrillCount:0,quantityExtendedDrillCount:0,grooveOperations:0,grooveLengthMm:0,quantityExtendedGrooveLengthMm:0};}
function sum(parts:MachiningPart[]):MachiningTotals {const t=empty();for(const p of parts)for(const k of Object.keys(t) as (keyof MachiningTotals)[])t[k]+=p.totals[k];return t;}
/** Observed fixed page/header grammar. Diagram coordinates remain source coordinates, never machine coordinates. */
export function parseMachiningLayout(layout:PdfLayout):MachiningResult {
 check(layout.pageCount===layout.pages.length && layout.pageCount<=512);
 const projectLabel=layout.pages[0]?.[1]?.cells[0]?.text;check(projectLabel);
 const summary=layout.pages.findIndex(p=>p.some(r=>r.cells[0]?.text==='Rezumatul costurilor'));check(summary>0);
 check(layout.pages.slice(0,summary).some(p=>p.some(r=>r.cells[0]?.text==='Lista cabinete')));
 const projectOperations:MachiningResult['projectOperations']=[];
 let section:string|null=null;
 for(const [i,r] of layout.pages[summary].entries()){
  const c=r.cells.map(c=>c.text);
  if(['Frezare','BiselTeşit','Nut si Feder'].includes(c[0])&&c[1]==='Lungime'){check(section===null);section=c[0];continue;}
  if(section){if(c[0]==='Total'){section=null;continue;}check(c.length===4&&/^\d+(?:\.\d+)? m$/.test(c[1]));projectOperations.push({sourceType:section,sourceLabel:c[0],lengthM:c[1].slice(0,-2),location:{page:summary+1,row:i+1}});}
 }
 check(section===null);
 const parts:MachiningPart[]=[];let previous:MachiningPart|undefined,expectedPage=0,expectedCount=0;
 for(const [pi,rows] of layout.pages.entries()){
  check(rows[0]?.cells[0]?.text==='PolyBoard 8.02c'&&rows[1]?.cells[0]?.text===projectLabel);
  check(rows.some(r=>r.cells.some(c=>c.text===`Pagina ${pi+1}/${layout.pageCount}`)));
  if(pi<=summary)continue;
  const headers=rows.flatMap((r,i)=>r.cells.some(c=>c.text.startsWith('Cantitate:'))?[i]:[]);check(headers.length<=1);
  if(!headers.length){check(expectedPage===expectedCount);check(rows.some(r=>r.cells.some(c=>/^(?:Inaltime|Latime|Left Width)$/.test(c.text))));continue;}
  const hi=headers[0],h=rows[hi].cells.map(c=>c.text);check(h.length===6);
  const label=/^(\d+) - (.+)$/.exec(h[0]);check(label);const cab=rows[hi-1]?.cells;check(cab?.length===1);
  const first=value(h[2],'Inaltime: '),second=value(h[3],'Latime: '),thickness=value(h[4],'Grosime: '),quantity=Number(value(h[5],'Cantitate: '));check(Number.isSafeInteger(quantity)&&quantity>0);
  const ref=rows[hi+1]?.cells.map(c=>c.text)??[];const reference=/^\d{8}$/.test(ref[0])?ref[0]:null;
  const continuation=reference&&ref.length===2?/^(\d+)\/(\d+)$/.exec(ref[1]):null;
  if(reference)check(ref.length===1||continuation);
  const page=continuation?Number(continuation[1]):1,total=continuation?Number(continuation[2]):1;check(total<=10&&page>=1&&page<=total);
  let part:MachiningPart;
  if(page===1){check(expectedPage===expectedCount);part={cabinetLabel:cab[0].text,sourceNumber:label[1],name:label[2],material:h[1],first,second,thickness,quantity,drawingReference:reference,pages:[],header:h,drilling:[],grooves:[],diagramEvidence:[],partId:null,cabinetId:null,linkStatus:'UNMAPPED',csvEvidence:null,issues:[],totals:empty()};parts.push(part);previous=part;expectedCount=total;}
  else {check(previous&&expectedPage+1===page&&expectedCount===total&&previous.drawingReference===reference&&previous.cabinetLabel===cab[0].text&&JSON.stringify(previous.header)===JSON.stringify(h));part=previous;}
  expectedPage=page;part.pages.push(pi+1);
  for(let ri=hi+1+(reference?1:0);ri<rows.length;ri++){
   const r=rows[ri],c=r.cells.map(c=>c.text),location={page:pi+1,row:ri+1};
   if(c.some(t=>t.startsWith('Diametru:'))){
    const start=c[0]==='Gaurire'?1:0;check(c.length>=start+3);
    const m=/^([A-Z]) \((\d{1,6})\)$/.exec(c[start]);check(m);check(!part.drilling.some(d=>d.label===m[1]));
    const diameterMm=value(c[start+1],'Diametru: ');check(Number(diameterMm)>0&&c[start+2].startsWith('Adancime: '));const depthRaw=c[start+2].slice(10);check(decimal.test(depthRaw)||depthRaw==='Strapuns (0)');
    part.drilling.push({sourceType:'Gaurire',label:m[1],count:Number(m[2]),diameterMm,depthRaw,depthMm:decimal.test(depthRaw)?depthRaw:null,face:null,location,coordinates:[]});
   } else if(c[0]?.startsWith('Canelura')){
    check(c.length===7&&['Canelura Orizontal','Canelura Vertical'].includes(c[0])&&/^Fata [12]$/.test(c[1]));
    part.grooves.push({sourceType:c[0],face:c[1],x:value(c[2],'X Pozitie: '),y:value(c[3],'Y Pozitie: '),widthMm:value(c[4],'Latime: '),lengthMm:value(c[5],'Lungime: '),depthMm:value(c[6],'Adancime: '),raw:c,location});continue;
   } else {check(!c.some(t=>/^(?:Gaurire|Frezare|Nut si Feder|Diametru:)/.test(t)));}
   // Preserve all diagram text with its PDF position; it is not a vector/toolpath reconstruction.
   for(const cell of r.cells){
    if(/^(Gaurire|[A-Z] \(\d+\)$|Diametru:|Adancime:)/.test(cell.text))continue;
    part.diagramEvidence.push({...location,text:cell.text,pdfX:cell.x,pdfY:r.y});
   }
  }
 }
 check(expectedPage===expectedCount&&parts.length>0&&parts.length<=5000);
 check(new Set(parts.map(p=>JSON.stringify([p.cabinetLabel,p.sourceNumber,p.name]))).size===parts.length);
 for(const p of parts){
  for(const e of p.diagramEvidence)for(const m of e.text.matchAll(/([A-Z]) \((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/g)){
   const op=p.drilling.find(d=>d.label===m[1]);if(op)op.coordinates.push({...e,text:m[0],first:m[2],second:m[3],face:null});else p.issues.push(`Coordinate label ${m[1]} has no drilling legend (page ${e.page}).`);
  }
  for(const d of p.drilling)if(d.count!==d.coordinates.length)p.issues.push(`Label ${d.label}: printed count ${d.count}, coordinate annotations ${d.coordinates.length}; printed count retained.`);
  p.totals={drillingGroups:p.drilling.length,drawingDrillCount:p.drilling.reduce((n,d)=>n+d.count,0),quantityExtendedDrillCount:p.drilling.reduce((n,d)=>n+d.count*p.quantity,0),grooveOperations:p.grooves.length,grooveLengthMm:p.grooves.reduce((n,g)=>n+Number(g.lengthMm),0),quantityExtendedGrooveLengthMm:p.grooves.reduce((n,g)=>n+Number(g.lengthMm)*p.quantity,0)};
 }
 return {projectLabel,sourcePages:layout.pageCount,parts,projectOperations,cabinets:[],totals:sum(parts),linkedParts:0,unresolvedParts:parts.length,issues:[]};
}
export interface MachiningLinkInput {id:string;cabinetId:string|null;sourceId:string;reportId:string;sourceRow:number;sourceLine:number;data:ImportedPart;}
export function linkMachining(parsed:MachiningResult,modelParts:MachiningLinkInput[]):MachiningResult {
 const result=structuredClone(parsed);check(modelParts.length&&modelParts.every(p=>p.data.projectLabel===result.projectLabel));
 for(const p of result.parts){
  const matches=modelParts.filter(({data:d})=>d.cabinetLabel===p.cabinetLabel&&d.sourceNumber===p.sourceNumber&&d.name===p.name&&d.material.description===p.material&&Number(d.dimensions.first)===Number(p.first)&&Number(d.dimensions.second)===Number(p.second)&&Number(d.material.thickness)===Number(p.thickness)&&d.quantity===p.quantity);
  const m=matches.length===1?matches[0]:null;p.linkStatus=matches.length>1?'AMBIGUOUS':m?.cabinetId?'LINKED':'UNMAPPED';
  if(m){p.partId=m.id;p.cabinetId=m.cabinetId;p.csvEvidence={sourceId:m.sourceId,reportId:m.reportId,row:m.sourceRow,line:m.sourceLine};}
  if(p.linkStatus!=='LINKED')p.issues.push('No unique exact Part/Cabinet association; no fuzzy match applied.');
 }
 for(const name of new Set(result.parts.map(p=>p.cabinetLabel))){const ps=result.parts.filter(p=>p.cabinetLabel===name),ids=new Set(ps.map(p=>p.cabinetId));result.cabinets.push({sourceName:name,cabinetId:ids.size===1?ps[0].cabinetId:null,partIndexes:result.parts.flatMap((p,i)=>p.cabinetLabel===name?[i]:[]),totals:sum(ps)});}
 result.linkedParts=result.parts.filter(p=>p.linkStatus==='LINKED').length;result.unresolvedParts=result.parts.length-result.linkedParts;
 const missing=modelParts.filter(p=>!result.parts.some(r=>r.partId===p.id));if(missing.length)result.issues.push(`${missing.length} normalized part rows have no exact report association.`);
 return result;
}
