import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {evidenceHash} from '../../packages/modules/portal/evidence.js';
import {issueAccessSchema,clientActionSchema} from '../../packages/contracts/portal.js';
test('approval evidence hash survives JSONB key order but detects amounts and order changes',()=>{
 assert.equal(evidenceHash({b:{x:1,a:2},a:['1.00','2.00']}),evidenceHash({a:['1.00','2.00'],b:{a:2,x:1}}));assert.notEqual(evidenceHash(['1.00','2.00']),evidenceHash(['2.00','1.00']));assert.notEqual(evidenceHash('1.00'),evidenceHash('1.01'));
});
test('client actions require exact snapshot, explicit confirmation and bounded feedback',()=>{
 const base={requestId:randomUUID(),snapshotId:randomUUID(),hash:'a'.repeat(64)};assert.ok(clientActionSchema.safeParse({...base,action:'APPROVE',confirmed:true}).success);for(const extra of [{confirmed:false},{confirmed:true,paid:true},{confirmed:true,versionId:randomUUID()}])assert.ok(!clientActionSchema.safeParse({...base,action:'APPROVE',...extra}).success);assert.ok(!clientActionSchema.safeParse({...base,action:'REQUEST_CHANGES',message:' '}).success);assert.ok(!issueAccessSchema.safeParse({requestId:randomUUID(),quoteId:randomUUID(),projectTitle:'Test',contactName:'Test',contactEmail:'test@example.com',expiresInHours:169}).success);
});
