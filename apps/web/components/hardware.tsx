'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { HardwareReport } from '../../../packages/contracts/hardware';
export function HardwareBom({projectId,modelId}:{projectId:string;modelId:string}) {
  const [rows,setRows]=useState<HardwareReport[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let alive=true,running=false;setRows([]);setError('');setLoading(true);
    async function load() {
      if(running)return;running=true;
      try { const r=await api<HardwareReport[]>(`/projects/${projectId}/technical-models/${modelId}/hardware`,{method:'POST'});if(alive){setRows(r);setError('');} }
      catch(e){if(alive)setError((e as Error).message);}finally{running=false;if(alive)setLoading(false);}
    }
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);
    return ()=>{alive=false;window.clearInterval(timer);};
  },[projectId,modelId]);
  const imported=rows.filter(r=>r.status==='IMPORTED');
  return <section className="bom-review" aria-label="Hardware / Feronerie BOM"><h3>Hardware / Feronerie BOM</h3>
    <p>Exact PolyBoard project summary. Names and quantities are source terminology, not supplier products or production operations.</p>
    {error&&<p role="alert">{error}</p>}{loading&&<p>Checking project hardware summary…</p>}
    {!loading&&!imported.length&&<p>No validated project Feronerie summary.</p>}
    {imported.length>1&&<p>Separate source reports / history; quantities are not added across reports.</p>}
    {rows.filter(r=>r.status==='FAILED').map(r=><p key={r.id} role="alert">{r.finding} Source: {r.sourceId}</p>)}
    {imported.map(r=><article key={r.id}><p className="hardware-totals"><strong>{r.result!.itemCount} source items · {r.result!.quantitySum} total source quantity</strong></p>
      <div className="table-wrap"><table><thead><tr><th>Exact source name</th><th>Quantity</th><th>Source evidence</th></tr></thead><tbody>{r.result!.items.map((item,i)=><tr key={i}><td>{item.sourceName}</td><td>{item.quantity}</td><td><details><summary>Source row</summary><p>PDF page {item.location.page}, row {item.location.row}</p>{r.pricesVisible?<><p>Source unit price: {item.sourceUnitPriceRaw??'Not present'}</p><p>Source total price: {item.sourceTotalPriceRaw??'Not present'}</p><p>Reference values only; not current prices or costing.</p></>:<p>Source prices require financial viewing permission.</p>}</details></td></tr>)}</tbody></table></div>
      <details><summary>Hardware report provenance</summary><p>Report: {r.id}<br/>ProjectVersion: {r.versionId}<br/>Model: {r.modelId}<br/>Source: {r.sourceId}<br/>SHA-256: {r.sourceHash}<br/>Parser: {r.parserVersion}<br/>Source date: {r.result!.sourceDate} · summary page {r.result!.summaryPage}/{r.result!.sourcePages}<br/>Imported: {new Date(r.createdAt).toLocaleString()}</p>{r.pricesVisible&&<p>Printed source total: {r.result!.sourceTotalPriceRaw??'Not present'} (reference only)</p>}</details>
    </article>)}
  </section>;
}
