import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {presentationContentSchema} from '../../packages/contracts/presentation.js';
import {projectPresentation} from '../../packages/modules/presentations/projection.js';
import {presentationImage} from '../../packages/modules/presentations/media.js';
import {imageFixture,presentationFixture} from '../fixtures/presentation.js';
test('safe client projection has only explicit curated fields, never technical references, internals or hidden/future content',()=>{
 const c=presentationFixture(),master=randomUUID(),assetId=randomUUID(),hidden=randomUUID();c.items.push({id:randomUUID(),kind:'MATERIAL',sectionId:null,title:'Warm oak finish',description:'Matte finish',visibility:'CLIENT_PRESENTATION',reference:{kind:'MATERIAL',materialMasterId:master}});c.media=[{assetId,sectionId:null,caption:'Inspiration only',visibility:'CLIENT_PRESENTATION'},{assetId:hidden,sectionId:null,caption:'HIDDEN_IMAGE_SENTINEL',visibility:'INTERNAL_ONLY'}];c.coverAssetId=assetId;
 const before=JSON.stringify(c),safe=projectPresentation({...c,...{costs:'COST_SENTINEL',bom:'BOM_SENTINEL',audit:'AUDIT_SENTINEL',snapshot:'SNAPSHOT_SENTINEL'}},2,[{id:assetId,kind:'REFERENCE_INSPIRATION'},{id:hidden,kind:'RENDER'}],id=>`/safe/${id}`),json=JSON.stringify(safe);
 assert.deepEqual(Object.keys(safe).sort(),['title','description','versionNumber','sections','items','media','coverUrl'].sort());
 for(const forbidden of [master,'SENTINEL','reference','materialMasterId','quantity','cost','source','snapshot','audit'])assert.ok(!json.includes(forbidden),forbidden);
 assert.equal(safe.sections.length,1);assert.equal(safe.media.length,1);assert.equal(safe.media[0].kind,'REFERENCE_INSPIRATION');assert.equal(safe.items.length,3);assert.equal(JSON.stringify(c),before);
});
test('content validation rejects technical payloads, invalid cover, duplicate identities and broken references',()=>{
 const c=presentationFixture();assert.equal(presentationContentSchema.safeParse(c).success,true);assert.equal(presentationContentSchema.safeParse({...c,bom:{quantity:1}}).success,false);assert.equal(presentationContentSchema.safeParse({...c,coverAssetId:randomUUID()}).success,false);assert.equal(presentationContentSchema.safeParse({...c,items:[c.items[0],c.items[0]]}).success,false);assert.equal(presentationContentSchema.safeParse({...c,items:[{...c.items[0],sectionId:randomUUID()}]}).success,false);assert.equal(presentationContentSchema.safeParse({...c,items:[{...c.items[0],reference:{kind:'MATERIAL',materialMasterId:randomUUID()}}]}).success,false);
});
test('presentation PNG validation bounds bytes, verifies structure/CRC and strips private metadata',()=>{
 const bytes=imageFixture(),image=presentationImage(bytes);assert.equal(image.mime,'image/png');assert.equal(image.width,600);assert.equal(image.height,360);assert.ok(bytes.includes(Buffer.from('INTERNAL_METADATA_SENTINEL')));assert.ok(!image.display.includes(Buffer.from('INTERNAL_METADATA_SENTINEL')));assert.deepEqual(presentationImage(image.display).display,image.display);
 const bad=Buffer.from(bytes);bad[20]^=1;assert.throws(()=>presentationImage(bad));assert.throws(()=>presentationImage(bytes.subarray(0,bytes.length-1)));assert.throws(()=>presentationImage(Buffer.from('<svg onload="alert(1)">'+''.padEnd(30)+' </svg>')));assert.throws(()=>presentationImage(Buffer.alloc(10*1024*1024+1)));assert.throws(()=>presentationImage(Buffer.from('%PDF-1.4 '+''.padEnd(40))));
});
