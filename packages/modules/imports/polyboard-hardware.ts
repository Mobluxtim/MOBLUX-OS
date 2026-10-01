import type { PdfLayout } from './opticut-pdf.js';
import type { HardwareResult, HardwareItem } from '../../contracts/hardware.js';
export const hardwareParserVersion = 'polyboard-8.02c-ro-hardware-pdf/v1';
function check(v: unknown): asserts v { if (!v) throw new Error('Unsupported or inconsistent project Feronerie summary.'); }
const unitPrice = /^\d{1,12}\.\d{2}$/;
const totalPrice = /^(?:\d{1,12}|\d{1,3}(?:\.\d{3})+),\d{2} lei$/;
/** Only the first project summary, before cabinet chapters; no interpretation of names. */
export function parseHardwareLayout(layout: PdfLayout): HardwareResult {
  let summaryPage = -1;
  for (let i = 0; i < layout.pages.length; i++) {
    const rows = layout.pages[i]; check(rows[0]?.cells[0]?.text === 'PolyBoard 8.02c');
    check(rows.some(r => r.cells.some(c => c.text === `Pagina ${i+1}/${layout.pageCount}`)));
    const summaries = rows.filter(r => r.cells[0]?.text === 'Rezumatul costurilor');
    if (summaries.length) { check(summaries.length === 1); summaryPage = i; break; }
  }
  check(summaryPage >= 0);
  // Require the known project overview/cabinet-list preamble, not a cabinet report.
  check(layout.pages[0].some(r => r.cells[0]?.text === 'Latime' && / mm$/.test(r.cells[1]?.text ?? '')));
  check(layout.pages.slice(0, summaryPage).some(p => p.some(r => r.cells[0]?.text === 'Lista cabinete')));
  const rows = layout.pages[summaryPage], projectLabel = rows[1]?.cells[0]?.text;
  check(projectLabel && layout.pages.slice(0, summaryPage+1).every(p => p[1]?.cells[0]?.text === projectLabel));
  const headers = rows.flatMap((r,i) => r.cells[0]?.text === 'Feronerie' ? [i] : []); check(headers.length === 1);
  const start = headers[0]; check(JSON.stringify(rows[start].cells.map(c=>c.text)) === JSON.stringify(['Feronerie','Cantitate','Pret unitar','Pret']));
  const items: HardwareItem[] = []; let total: string | null = null, ended = false;
  for (let i=start+1; i<rows.length; i++) {
    const c=rows[i].cells.map(v=>v.text);
    if(c[0]==='Total') { check(c.length===1 || (c.length===2 && totalPrice.test(c[1]))); total=c[1]??null; ended=true; break; }
    check(c.length>=2 && c.length<=4 && c[0].length<=1000 && !c[0].includes('...') && /^\d{1,6}$/.test(c[1]));
    let sourceUnitPriceRaw: string | null = null, sourceTotalPriceRaw: string | null = null;
    if(c.length===4) { check(unitPrice.test(c[2]) && totalPrice.test(c[3])); sourceUnitPriceRaw=c[2]; sourceTotalPriceRaw=c[3]; }
    else if(c.length===3) { if(unitPrice.test(c[2])) sourceUnitPriceRaw=c[2]; else { check(totalPrice.test(c[2])); sourceTotalPriceRaw=c[2]; } }
    items.push({sourceName:c[0],quantity:Number(c[1]),sourceUnitPriceRaw,sourceTotalPriceRaw,location:{page:summaryPage+1,row:i+1}});
  }
  check(ended && items.length>0 && items.length<=1000);
  check(new Set(items.map(i=>i.sourceName)).size===items.length);
  return {projectLabel,sourceDate:rows[0].cells[1]?.text??'',sourcePages:layout.pageCount,summaryPage:summaryPage+1,items,itemCount:items.length,quantitySum:items.reduce((n,i)=>n+i.quantity,0),sourceTotalPriceRaw:total};
}
