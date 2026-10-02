'use client';
import {useEffect,useState} from 'react';
import type {ClientPresentationView} from '../../../packages/contracts/presentation';
import {api} from './api';
export const mediaLabel={TECHNICAL_PRESENTATION:'Technical presentation',RENDER:'Project render',REFERENCE_INSPIRATION:'Reference / inspiration'};
const itemLabels={FURNITURE:'Furniture',MATERIAL:'Materials & finishes',HARDWARE:'Hardware & accessories',SERVICE:'Included services',NOTE:'Notes'};
export function PresentationView({data:d}:{data:ClientPresentationView}){
 function entries(sectionKey:string|null){return Object.entries(itemLabels).map(([kind,label])=>{const entries=d.items.filter(i=>i.sectionKey===sectionKey&&i.kind===kind);return entries.length?<section key={kind} className="presentation-category"><h3>{label}</h3><div className="presentation-cards">{entries.map((i,n)=><article key={n}><h4>{i.title}</h4><p className="preserve">{i.description}</p></article>)}</div></section>:null;});}
 function gallery(sectionKey:string|null){const images=d.media.filter(m=>m.sectionKey===sectionKey);return images.length?<div className="presentation-gallery">{images.map(m=><figure key={m.url}><img src={m.url} alt={m.caption||mediaLabel[m.kind]} loading="lazy"/><figcaption><span className={`badge ${m.kind==='REFERENCE_INSPIRATION'?'amber':''}`}>{mediaLabel[m.kind]}</span>{m.caption&&<p>{m.caption}</p>}</figcaption></figure>)}</div>:null;}
 return <article className="client-presentation"><header><span className="eyebrow">MOBLUX · PROJECT V{d.versionNumber}</span><h1>{d.title}</h1><p className="preserve">{d.description}</p>{d.coverUrl&&<figure className="presentation-cover-figure"><img className="presentation-cover" src={d.coverUrl} alt={d.media.find(m=>m.url===d.coverUrl)?.caption||'Project cover'}/><figcaption>{mediaLabel[d.media.find(m=>m.url===d.coverUrl)!.kind]}</figcaption></figure>}</header>{gallery(null)}{entries(null)}{d.sections.map(s=><section className="presentation-room" key={s.key}><h2>{s.title}</h2><p className="preserve">{s.description}</p>{gallery(s.key)}{entries(s.key)}</section>)}</article>;
}
export function PresentationPreview({projectId,versionId,revisionId}:{projectId:string;versionId:string;revisionId:string}){
 const [data,setData]=useState<ClientPresentationView>(),[error,setError]=useState('');
 useEffect(()=>{let active=true;api<ClientPresentationView>(`/projects/${projectId}/versions/${versionId}/presentations/${revisionId}/preview`).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[projectId,versionId,revisionId]);
 return <main className="presentation-preview"><p className="preview-mode">Client preview · internal preparation only</p>{error?<p role="alert">{error}</p>:data?<PresentationView data={data}/>:<p>Loading presentation…</p>}</main>;
}
