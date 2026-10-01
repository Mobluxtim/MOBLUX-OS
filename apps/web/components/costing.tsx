'use client';
import {useEffect,useState} from 'react';
import {api} from './api';
import type {CostState,CostResult,CostInputs,CostRules,CostRate} from '../../../packages/contracts/costing';
import {displayQuantity} from '../../../packages/contracts/decimal-display';
const labels:Record<keyof CostInputs,string>={bomId:'Material BOM input',optimizationId:'OptiCut input',hardwareId:'Hardware BOM input',machiningId:'Machining BOM input'};
function Result({result:r}:{result:CostResult}){
 return <><p className="costing-total"><strong>{r.total===null?'NOT COSTED / INCOMPLETE':`${r.total} ${r.currency}`}</strong> · Known subtotal: {r.knownSubtotal===null?'Not available':`${r.knownSubtotal} ${r.currency}`}</p>
 <p>Known subtotal excludes missing lines and is not a complete project cost. Currency: {r.currency??'Not configured'} · Panel basis: {r.panelBasis}</p>
 {r.coverageIssues.map((s,i)=><p key={i} role="note">{s}</p>)}
 <div className="table-wrap"><table><thead><tr><th>Category</th><th>Subtotal</th><th>Missing lines</th></tr></thead><tbody>{r.categories.map(c=><tr key={c.category}><td>{c.category}</td><td>{c.subtotal===null?'NOT COSTED':`${c.subtotal} ${r.currency}`}{c.subtotal===null&&c.knownSubtotal!==null&&<p>Known only: {c.knownSubtotal}</p>}</td><td>{c.missingLines}</td></tr>)}</tbody></table></div>
 <details><summary>Calculated lines and evidence ({r.lines.length})</summary><div className="table-wrap"><table><thead><tr><th>Category / item</th><th>Quantity</th><th>Configured rate</th><th>Calculated subtotal</th><th>Evidence</th></tr></thead><tbody>{r.lines.map(l=><tr key={l.key}><td>{l.category}<br/>{l.label}</td><td>{l.quantity===null?'Unknown':displayQuantity(l.quantity)} {l.unit}</td><td>{l.rate??'MISSING RATE'}</td><td>{l.subtotal??`NOT COSTED / ${l.status}`}{l.reason&&<p>{l.reason}</p>}</td><td><details><summary>Cost line provenance</summary><p>Full quantity: {l.quantity??'unknown'} · Rate: {l.rate??'missing'} · Exact product: {l.exactSubtotal??'not calculated'}</p>{l.evidence.map((e,i)=><p key={i}>Report {e.reportId} · {e.path}{e.sourceId&&<> · Source {e.sourceId} · SHA-256 {e.sourceHash}</>}{e.partId&&<> · Part {e.partId} · Cabinet {e.cabinetId}</>}{e.page&&<> · page {e.page}, row {e.row}</>}</p>)}{l.referencePrices.map((p,i)=><p key={i}>SOURCE / REFERENCE ONLY — unit: {p.unitRaw??'not present'} · total: {p.totalRaw??'not present'}. Not used as a configured rate.</p>)}</details></td></tr>)}</tbody></table></div></details>
 <details><summary>Calculation boundaries</summary>{r.warnings.map((w,i)=><p key={i}>{w}</p>)}<p>Exact decimal products; line amounts round half-up to two currency decimals. Total sums rounded lines. No currency conversion, selling prices, taxes, overhead or purchasing.</p></details></>;
}
export function TechnicalCosting({projectId,modelId}:{projectId:string;modelId:string}){
 const [state,setState]=useState<CostState>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[currency,setCurrency]=useState<CostRules['currency']|''>(''),[basis,setBasis]=useState<CostRules['panelBasis']>('NET_M2'),[reason,setReason]=useState(''),[rates,setRates]=useState<Record<string,string>>({});
 const url=`/projects/${projectId}/technical-models/${modelId}/costing`;
 function accept(s:CostState){setState(s);setCurrency(s.rules?.rules.currency??'');setBasis(s.rules?.rules.panelBasis??'NET_M2');setRates(Object.fromEntries(s.rules?.rules.rates.map(r=>[r.key,r.rate])??[]));setReason('');}
 useEffect(()=>{let alive=true;setState(undefined);setError('');api<CostState>(url).then(s=>{if(alive)accept(s);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[url]);
 async function refresh(selection?:CostInputs){setBusy(true);setError('');try{accept(await api<CostState>(selection?`${url}/preview`:url,selection?{method:'POST',body:JSON.stringify(selection)}:undefined));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function save(){if(!state||!currency)return;setBusy(true);setError('');try{
  const pool=new Map<string,CostRate>((state.rules?.rules.rates??[]).map(r=>[r.key,r]));for(const l of state.preview.lines)pool.set(l.key,{key:l.key,unit:l.unit,category:l.category,rate:''});
  const configured=[...pool.values()].filter(r=>rates[r.key]?.trim()).map(r=>({...r,rate:rates[r.key].trim()}));
  await api(`${url}/rules`,{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),previousId:state.rules?.id??null,rules:{currency,panelBasis:basis,reason,rates:configured}})});
  accept(await api<CostState>(`${url}/preview`,{method:'POST',body:JSON.stringify(state.selection)}));
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function calculate(){if(!state?.rules)return;setBusy(true);setError('');try{await api(`${url}/runs`,{method:'POST',body:JSON.stringify({ruleVersionId:state.rules.id,inputs:state.selection})});accept(await api<CostState>(`${url}/preview`,{method:'POST',body:JSON.stringify(state.selection)}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="bom-review" aria-label="Costing / Technical cost"><h3>Costing / Technical cost</h3><p>Configured MOBLUX rates only. Historical source prices are separate reference evidence. Financial permission is required.</p>{error&&<p role="alert">{error}</p>}
 {!state&&!error&&<p>Loading costing inputs…</p>}
 {state&&<><Result result={state.preview}/><p>Live preview; save a CostingRun to freeze these exact inputs and rates.</p>
 <details><summary>Exact input reports</summary><p>One report per source. Multiple alternatives require selection; they are never added together.</p>{(Object.keys(labels) as (keyof CostInputs)[]).map(k=><label key={k}>{labels[k]}<select disabled={busy} value={state.selection[k]??''} onChange={e=>void refresh({...state.selection,[k]:e.target.value||null})}><option value="">Not selected / missing</option>{state.options[k].map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}</details>
 <button className="button secondary" disabled={busy} onClick={()=>void refresh()}>Refresh costing inputs</button>
 {state.canConfigure&&<details><summary>Configure technical rates</summary><p>Project-scoped versioned rules. Save currency/basis first if changing the panel basis, then set the rates for the resulting lines. Blank means MISSING RATE; an explicit 0 is an intentional zero rate.</p>
 <label>Cost currency<select value={currency} disabled={busy} onChange={e=>{setCurrency(e.target.value as CostRules['currency']);setRates({});}}><option value="">Choose currency</option><option>RON</option><option>EUR</option><option>USD</option></select></label><p>Changing currency clears draft rates; no currency conversion is performed.</p>
 <label>Panel cost basis<select disabled={busy} value={basis} onChange={e=>setBasis(e.target.value as CostRules['panelBasis'])}><option value="NET_M2">Net technical area / m²</option><option value="OPTIMIZED_M2">OptiCut sheet area / m²</option><option value="SHEETS">OptiCut sheet count / sheet size</option></select></label>
 <label>Rate change reason<input disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
 <div className="table-wrap"><table><thead><tr><th>Technical rate selector</th><th>Unit</th><th>MOBLUX configured rate</th></tr></thead><tbody>{state.preview.lines.map((l,i)=><tr key={l.key}><td>{l.category} · {l.label}</td><td>{l.unit}</td><td><input aria-label={`Rate ${i+1}: ${l.category} ${l.label}`} inputMode="decimal" disabled={busy} placeholder="MISSING RATE" value={rates[l.key]??''} onChange={e=>setRates({...rates,[l.key]:e.target.value})}/></td></tr>)}</tbody></table></div>
 <button className="button" disabled={busy||!currency||reason.trim().length<3} onClick={()=>void save()}>Save new cost rule version</button></details>}
 {state.canCalculate&&<button className="button" disabled={busy||!state.rules} onClick={()=>void calculate()}>Save immutable CostingRun</button>}
 {!state.rules&&<p>No cost rule version exists. Configure a currency and basis before saving a run; no rates are seeded.</p>}
 {state.rules&&<p>Current rule version: {state.rules.id} · {new Date(state.rules.createdAt).toLocaleString()}</p>}
 <details><summary>Costing history ({state.history.length})</summary>{state.history.map(r=><details key={r.id}><summary>{new Date(r.createdAt).toLocaleString()} · {r.id} · {r.result.status}</summary><p>ProjectVersion {r.versionId} · rule version {r.ruleVersionId} · {r.algorithmVersion}</p><p>Frozen inputs: {JSON.stringify(r.inputs)}</p><Result result={r.result}/></details>)}</details>
 </>}
 </section>;
}
