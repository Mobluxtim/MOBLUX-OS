'use client';
import {useEffect,useState} from 'react';
import {api} from './api';
import type {MachiningReport,MachiningPart} from '../../../packages/contracts/machining';
function PartOperations({part:p}:{part:MachiningPart}){
 return <details><summary>{p.sourceNumber} - {p.name} · {p.totals.drawingDrillCount} drilling / drawing × {p.quantity} source quantity · {p.linkStatus}</summary>
  <p>Part: {p.partId??'Unmapped'} · Cabinet: {p.cabinetId??'Unmapped'}<br/>Drawing reference: {p.drawingReference??'Not printed'} · PDF pages: {p.pages.join(', ')}</p>
  {p.csvEvidence&&<p>CSV source: {p.csvEvidence.sourceId} · report: {p.csvEvidence.reportId} · row {p.csvEvidence.row}, line {p.csvEvidence.line}</p>}
  {p.issues.map((x,i)=><p key={i} role="note">{x}</p>)}
  <div className="table-wrap"><table><thead><tr><th>Source operation</th><th>Diameter mm</th><th>Depth (source)</th><th>Count / drawing</th><th>Evidence</th></tr></thead><tbody>{p.drilling.map(d=><tr key={d.label}><td>{d.sourceType} {d.label}</td><td>{d.diameterMm}</td><td>{d.depthRaw}</td><td>{d.count}</td><td><details><summary>Coordinates / source</summary><p>Legend: page {d.location.page}, row {d.location.row}. Face association unconfirmed; coordinates are not machine coordinates.</p>{d.coordinates.map((c,i)=><p key={i}>{c.text} · page {c.page}, row {c.row}</p>)}</details></td></tr>)}</tbody></table></div>
  {p.grooves.map((g,i)=><p key={i}>{g.sourceType} · {g.face} · X {g.x}, Y {g.y} · width {g.widthMm} mm · length {g.lengthMm} mm · depth {g.depthMm} mm · page {g.location.page}, row {g.location.row}</p>)}
  <details><summary>Original diagram text / unresolved geometry</summary><p>PDF text positions retained for source review; no toolpath or face mapping inferred.</p>{p.diagramEvidence.map((e,i)=><p key={i}>{e.text} · page {e.page}, row {e.row}, PDF position ({e.pdfX.toFixed(2)}, {e.pdfY.toFixed(2)})</p>)}</details>
 </details>;
}
export function MachiningBom({projectId,modelId}:{projectId:string;modelId:string}){
 const [rows,setRows]=useState<MachiningReport[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true,running=false;setRows([]);setError('');setLoading(true);
  async function load(){if(running)return;running=true;try{const r=await api<MachiningReport[]>(`/projects/${projectId}/technical-models/${modelId}/machining`,{method:'POST'});if(alive){setRows(r);setError('');}}catch(e){if(alive)setError((e as Error).message);}finally{running=false;if(alive)setLoading(false);}}
  void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);return()=>{alive=false;window.clearInterval(timer);};
 },[projectId,modelId]);
 const imported=rows.filter(r=>r.status==='IMPORTED');
 return <section className="bom-review" aria-label="Machining / Operations BOM"><h3>Machining / Operations BOM</h3><p>Source-reported operations only. Separate from hardware, materials, optimization and costing.</p>
  {loading&&<p>Checking source machining report…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!imported.length&&<p>No validated machining report.</p>}
  {rows.filter(r=>r.status==='FAILED').map(r=><p role="alert" key={r.id}>{r.finding}</p>)}
  {imported.length>1&&<p>Separate source alternatives/history; totals are not added across reports.</p>}
  {imported.map(r=>{const b=r.result!;return <article key={r.id}>
   <p className="machining-totals"><strong>{b.totals.drillingGroups} drilling groups · {b.totals.drawingDrillCount} drawing holes · {b.totals.quantityExtendedDrillCount} quantity-extended holes</strong></p>
   <p>Quantity-extended = printed drawing count × printed part quantity, without a cabinet multiplier. Source discrepancies remain review issues, not corrected counts.</p>
   <p>{b.totals.grooveOperations} explicit grooves · {(b.totals.grooveLengthMm/1000).toFixed(2)} m drawing groove length</p>
   <p>{b.linkedParts}/{b.parts.length} exact part links · {b.unresolvedParts} unresolved · {b.parts.filter(p=>p.issues.length).length} part records needing review</p>
   {b.projectOperations.map((o,i)=><p key={i}>{o.sourceType} / {o.sourceLabel}: {o.lengthM} m · project summary page {o.location.page}, row {o.location.row}</p>)}
   <p>Printed project lengths and drawing lengths are separate views, never added together. Frezare is not allocated to parts.</p>
   {b.issues.map((x,i)=><p key={i}>{x}</p>)}
   <details><summary>Cabinet / Part operations ({b.cabinets.length} source groups)</summary>{b.cabinets.map(c=><details key={c.sourceName}><summary>{c.sourceName} · {c.totals.drawingDrillCount} drawing holes · {c.totals.quantityExtendedDrillCount} quantity-extended</summary><p>Cabinet: {c.cabinetId??'Unmapped source group'}</p>{c.partIndexes.map(i=><PartOperations key={i} part={b.parts[i]}/>)}</details>)}</details>
   <details><summary>Machining report provenance</summary><p>Report: {r.id}<br/>ProjectVersion: {r.versionId}<br/>Model: {r.modelId}<br/>Source: {r.sourceId}<br/>SHA-256: {r.sourceHash}<br/>Parser: {r.parserVersion}<br/>{b.sourcePages} PDF pages · Imported: {new Date(r.createdAt).toLocaleString()}</p></details>
  </article>;})}
 </section>;
}
