import {createHash} from 'node:crypto';
/** Canonical JSON keys survive PostgreSQL JSONB reordering; array order remains meaningful. */
export function evidenceHash(value:unknown):string {
 function canonical(v:unknown):unknown {if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)]));return v;}
 return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
