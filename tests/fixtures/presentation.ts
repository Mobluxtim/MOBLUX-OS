import {deflateSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import type {PresentationContent} from '../../packages/contracts/presentation.js';
export function imageFixture(){
 function chunk(type:string,data:Buffer){const body=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;for(const b of body){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([header,body,tail]);}
 const width=600,height=360,header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const pixels=Buffer.alloc(height*(width*3+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=y*(width*3+1)+1+x*3;const cabinet=x>100&&x<500&&y>60&&y<300;pixels[p]=cabinet?172:233;pixels[p+1]=cabinet?184:238;pixels[p+2]=cabinet?160:229;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('Comment\0INTERNAL_METADATA_SENTINEL')),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export function presentationFixture():PresentationContent {
 const room=randomUUID(),hidden=randomUUID();return {title:'TEST client presentation',description:'A calm, practical interior.',sections:[{id:room,title:'Living room',description:'A place to relax.',visibility:'CLIENT_PRESENTATION'},{id:hidden,title:'HIDDEN_ROOM_SENTINEL',description:'internal',visibility:'INTERNAL_ONLY'}],items:[
 {id:randomUUID(),kind:'FURNITURE',sectionId:room,title:'Wall storage',description:'Clean fronts and a warm finish.',visibility:'CLIENT_PRESENTATION',reference:null},
 {id:randomUUID(),kind:'NOTE',sectionId:hidden,title:'HIDDEN_CHILD_SENTINEL',description:'private',visibility:'CLIENT_PRESENTATION',reference:null},
 {id:randomUUID(),kind:'SERVICE',sectionId:null,title:'Installation',description:'Installation is included.',visibility:'CLIENT_PRESENTATION',reference:null},
 {id:randomUUID(),kind:'NOTE',sectionId:null,title:'FUTURE_DELIVERABLE_SENTINEL',description:'Not released',visibility:'DESIGN_DELIVERABLE_FUTURE',reference:null}
 ],media:[],coverAssetId:null};
}
