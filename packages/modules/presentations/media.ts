import {DomainError} from '../identity/policy.js';
export const maxPresentationBytes=10*1024*1024;
const invalid=()=>new DomainError(400,'Use a valid PNG or JPEG image, at most 10 MB and 20 million pixels. SVG, PDF and manufacturing files are not presentation media.');
function dimensions(w:number,h:number){if(!w||!h||w*h>20_000_000)throw invalid();}
function crc(bytes:Buffer){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
/** Structural validation and metadata removal. Originals stay private; preview never serves them. */
export function presentationImage(bytes:Buffer){
 if(bytes.length<24||bytes.length>maxPresentationBytes)throw invalid();
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  let pos=8,width=0,height=0,idat=false,end=false;const chunks=[bytes.subarray(0,8)];
  while(pos<bytes.length){if(pos+12>bytes.length)throw invalid();const n=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8);if(n>maxPresentationBytes||pos+12+n>bytes.length)throw invalid();if(crc(bytes.subarray(pos+4,pos+8+n))!==bytes.readUInt32BE(pos+8+n))throw invalid();
   if(pos===8&&type!=='IHDR')throw invalid();
   if(type==='IHDR'){if(width||n!==13)throw invalid();width=bytes.readUInt32BE(pos+8);height=bytes.readUInt32BE(pos+12);dimensions(width,height);}
   if(type==='IDAT')idat=true;if(type==='IEND'){if(n!==0||pos+12!==bytes.length)throw invalid();end=true;}
   if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(type))chunks.push(bytes.subarray(pos,pos+12+n));
   else if(type[0]===type[0].toUpperCase())throw invalid();
   pos+=12+n;
  }
  if(!end||!idat)throw invalid();return {mime:'image/png',width,height,display:Buffer.concat(chunks)};
 }
 if(bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217){
  let pos=2,width=0,height=0,scans=0,segments=0;const chunks=[bytes.subarray(0,2)];
  while(pos+2<=bytes.length){if(++segments>4096)throw invalid();const start=pos;if(bytes[pos++]!==255)throw invalid();while(bytes[pos]===255)pos++;const marker=bytes[pos++];
   if(marker===0xd9){if(pos!==bytes.length||!scans)throw invalid();chunks.push(Buffer.from([255,217]));return {mime:'image/jpeg',width,height,display:Buffer.concat(chunks)};}
   if(pos+2>bytes.length)throw invalid();const n=bytes.readUInt16BE(pos);if(n<2||pos+n>bytes.length)throw invalid();
   if([0xc0,0xc1,0xc2].includes(marker)){if(n<8)throw invalid();height=bytes.readUInt16BE(pos+3);width=bytes.readUInt16BE(pos+5);dimensions(width,height);}
   if(marker===0xda){if(!width)throw invalid();scans++;pos+=n;while(pos<bytes.length){if(bytes[pos]!==255){pos++;continue;}const next=bytes[pos+1];if(next===0||next>=0xd0&&next<=0xd7){pos+=2;continue;}break;}chunks.push(bytes.subarray(start,pos));continue;}
   // Strip APP/EXIF/IPTC/comments, including markers between progressive scans.
   // Retain only the fixed Adobe color transform header; never arbitrary APP payload.
   if(!(marker>=0xe0&&marker<=0xef)&&marker!==0xfe||marker===0xee&&n===14&&bytes.toString('ascii',pos+2,pos+7)==='Adobe')chunks.push(bytes.subarray(start,pos+n));
   pos+=n;
  }
 }
 throw invalid();
}
