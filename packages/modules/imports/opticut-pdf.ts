import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
export interface PdfRow { y: number; cells: { x: number; text: string }[]; }
export interface PdfLayout { pageCount: number; pages: PdfRow[][]; }
export class UnsupportedOptimization extends Error {}
let active = 0;
export class OptimizationBusy extends Error {}
/** Installed parser only; no application credentials, imported scripts, URLs or embedded assets executed. */
export async function extractOpticutPdf(bytes: Buffer): Promise<PdfLayout> {
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || bytes.length > 10 * 1024 * 1024) throw new UnsupportedOptimization('Not a supported PDF (maximum 10 MiB).');
  if (active >= 2) throw new OptimizationBusy('PDF parser busy. Retry shortly.');
  active++;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        (async () => {
          const { getDocument } = await import(workerData.parser);
          const loading = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, verbosity: 0 });
          try {
            const doc = await loading.promise;
            if(doc.numPages > 64) { parentPort.postMessage({unsupported: true}); return; }
            const pages=[]; let characters=0;
            for(let n=1;n<=doc.numPages;n++) {
              const page=await doc.getPage(n), data=await page.getTextContent();
              if(data.items.length>20000) throw Error('Text limit');
              const rows=[];
              for(const item of data.items) {
                if(!('str' in item)||!item.str.trim()) continue;
                characters+=item.str.length; if(characters>1000000) throw Error('Text limit');
                const y=item.transform[5],x=item.transform[4];
                let row=rows.find(r=>Math.abs(r.y-y)<2);
                if(!row){row={y,cells:[]};rows.push(row);}
                row.cells.push({x,text:item.str});
              }
              rows.sort((a,b)=>b.y-a.y); rows.forEach(r=>r.cells.sort((a,b)=>a.x-b.x));
              if(n===1 && !rows.some(r=>r.cells.some(c=>c.text==='OptiCut 6.09'))) {parentPort.postMessage({unsupported:true});return;}
              pages.push(rows);
              if(rows.some(r=>r.cells[0]?.text==='Lungime cant')) break;
            }
            parentPort.postMessage({layout:{pageCount:doc.numPages,pages}});
          } finally { await loading.destroy(); }
        })().catch(()=>parentPort.postMessage({error:true}));
      `, { eval: true, env: {}, resourceLimits: { maxOldGenerationSizeMb: 192, stackSizeMb: 4 }, workerData: { bytes, parser: pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href } });
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error('PDF parsing timed out.')); }, 15000);
      worker.once('message', (m: { layout?: PdfLayout; unsupported?: boolean }) => {
        clearTimeout(timer); void worker.terminate();
        if (m.layout) resolve(m.layout); else reject(m.unsupported ? new UnsupportedOptimization('Not the supported OptiCut 6.09 report.') : new Error('Invalid or corrupt optimization PDF.'));
      });
      worker.once('error', () => { clearTimeout(timer); reject(new Error('PDF parser failed safely.')); });
      worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('PDF parser stopped.')); });
    });
  } finally { active--; }
}
