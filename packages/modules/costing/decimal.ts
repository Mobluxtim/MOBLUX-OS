/** Exact non-negative base-10 arithmetic. Money never passes through Number. */
function parse(s:string){if(!/^\d{1,30}(?:\.\d{1,24})?$/.test(s))throw new Error('Invalid bounded decimal.');const [w,f='']=s.split('.');return {n:BigInt(w+f),scale:f.length};}
function text(n:bigint,scale:number){const t=n.toString().padStart(scale+1,'0');if(!scale)return t;const f=t.slice(-scale).replace(/0+$/,'');return t.slice(0,-scale)+(f?'.'+f:'');}
export function add(a:string,b:string){const x=parse(a),y=parse(b),s=Math.max(x.scale,y.scale);return text(x.n*10n**BigInt(s-x.scale)+y.n*10n**BigInt(s-y.scale),s);}
export function multiply(a:string,b:string){const x=parse(a),y=parse(b);return text(x.n*y.n,x.scale+y.scale);}
export function millimetersToMeters(a:string){const x=parse(a);return text(x.n,x.scale+3);}
export function money(a:string){const x=parse(a);let n=x.n;if(x.scale>2){const divisor=10n**BigInt(x.scale-2);n=(n+divisor/2n)/divisor;}else n*=10n**BigInt(2-x.scale);const s=n.toString().padStart(3,'0');return s.slice(0,-2)+'.'+s.slice(-2);}
export function canonical(a:string){const x=parse(a);return text(x.n,x.scale);}
/** Whole rolls, with explicit configured roll length; never converts money to binary float. */
export function ceilDivide(a:string,b:string){const x=parse(a),y=parse(b);if(y.n===0n)throw new Error('Divisor must be positive.');const n=x.n*10n**BigInt(y.scale),d=y.n*10n**BigInt(x.scale);return ((n+d-1n)/d).toString();}
