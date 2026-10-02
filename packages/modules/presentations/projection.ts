import type {PresentationContent,MediaKind,ClientPresentationView} from '../../contracts/presentation.js';
/** Construct an allowlist; never spread internal records or join technical objects here. */
export function projectPresentation(content:PresentationContent,versionNumber:number,assets:{id:string;kind:MediaKind}[],url:(id:string)=>string):ClientPresentationView {
 const sections=content.sections.filter(s=>s.visibility==='CLIENT_PRESENTATION');
 const sectionKey=(id:string|null)=>id===null?null:String(sections.findIndex(s=>s.id===id));
 const visible=(i:{visibility:string;sectionId:string|null})=>i.visibility==='CLIENT_PRESENTATION'&&(!i.sectionId||sections.some(s=>s.id===i.sectionId));
 const media=content.media.filter(visible).flatMap(m=>{const a=assets.find(a=>a.id===m.assetId);return a?[{url:url(a.id),kind:a.kind,caption:m.caption,sectionKey:sectionKey(m.sectionId)}]:[];});
 return {title:content.title,description:content.description,versionNumber,sections:sections.map((s,i)=>({key:String(i),title:s.title,description:s.description})),items:content.items.filter(visible).map(i=>({kind:i.kind,sectionKey:sectionKey(i.sectionId),title:i.title,description:i.description})),media,coverUrl:content.coverAssetId&&media.some(m=>m.url===url(content.coverAssetId!))?url(content.coverAssetId):null};
}
