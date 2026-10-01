import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pool} from '../../packages/infrastructure/db.js';
import {readSource} from '../../packages/infrastructure/storage.js';
import {extractMachiningPdf} from '../../packages/modules/imports/opticut-pdf.js';
import {parseMachiningLayout,linkMachining,type MachiningLinkInput} from '../../packages/modules/imports/polyboard-machining.js';
import type {MachiningResult} from '../../packages/contracts/machining.js';

test('read-only real reconciliation preserves conflicting cabinet evidence, repeated through-hole views and truncated coordinate', {skip:!process.env.MOBLUX_REAL_MODEL_ID},async()=>{
 try{
  const tables=['project_versions','parts','cabinets','material_requirement_reports','optimization_requirement_reports','hardware_bom_reports','machining_bom_reports'];
  async function fingerprints(){return Promise.all(tables.map(async table=>(await pool.query(`select md5(coalesce(string_agg(row_to_json(t)::text,'' order by id),'')) fingerprint from ${table} t`)).rows[0].fingerprint));}
  const before=await fingerprints();
  const report=(await pool.query("select r.*,s.object_key,s.object_version,s.size from machining_bom_reports r join source_files s on s.id=r.source_id where r.model_id=$1 and r.status='IMPORTED' and r.parser_version='polyboard-8.02c-ro-machining-pdf/v1'",[process.env.MOBLUX_REAL_MODEL_ID])).rows[0];assert.ok(report);
  const bytes=await readSource(report.object_key,report.object_version);assert.equal(bytes.length,report.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),report.source_hash);
  const inputs:MachiningLinkInput[]=(await pool.query('select * from parts where version_id=$1 order by source_row',[report.version_id])).rows.map(p=>({id:p.id,cabinetId:p.cabinet_id,sourceId:p.source_id,reportId:p.report_id,sourceRow:p.source_row,sourceLine:p.source_line,data:p.data}));
  const layout=await extractMachiningPdf(Buffer.from(bytes)),result=linkMachining(parseMachiningLayout(layout),inputs),stored=report.result as MachiningResult;
  assert.deepEqual(result,stored);assert.equal(result.linkedParts,213);assert.equal(result.unresolvedParts,3);
  for(const p of result.parts.filter(p=>p.linkStatus!=='LINKED')){
   const candidates=inputs.filter(({data:d})=>d.name===p.name&&d.sourceNumber===p.sourceNumber&&d.material.description===p.material&&Number(d.material.thickness)===Number(p.thickness)&&Number(d.dimensions.first)===Number(p.first)&&Number(d.dimensions.second)===Number(p.second)&&d.quantity===p.quantity);
   assert.equal(candidates.length,1);assert.notEqual(candidates[0].data.cabinetLabel,p.cabinetLabel);assert.equal(p.partId,null);assert.equal(p.cabinetId,null);
   assert.ok(layout.pages[6].some(r=>r.cells.length===1&&r.cells[0].text===p.cabinetLabel));
  }
  const through=result.parts.find(p=>p.pages.includes(22))!.drilling.find(d=>d.label==='I')!;
  assert.equal(through.count,3);assert.equal(through.depthRaw,'Strapuns (0)');assert.equal(through.coordinates.length,6);
  const pairs=new Map<string,number>();for(const c of through.coordinates){const key=JSON.stringify([c.first,c.second]);pairs.set(key,(pairs.get(key)??0)+1);assert.equal(c.face,null);}
  assert.deepEqual([...pairs.values()],[2,2,2]); // Source repeats three coordinate pairs; never six manufacturing holes.
  const truncated=result.parts.find(p=>p.pages.includes(249))!;
  assert.equal(truncated.drilling.find(d=>d.label==='A')!.count,1);assert.equal(truncated.drilling.find(d=>d.label==='A')!.coordinates.length,0);
  assert.ok(truncated.diagramEvidence.some(e=>e.page===249&&e.text==='A (52, 265...'));
  assert.ok(result.parts.every(p=>p.drilling.every(d=>d.face===null)));assert.equal(result.parts.flatMap(p=>p.grooves).filter(g=>/^Fata [12]$/.test(g.face)).length,50);
  assert.deepEqual(result.totals,{drillingGroups:555,drawingDrillCount:3467,quantityExtendedDrillCount:3774,grooveOperations:50,grooveLengthMm:50671,quantityExtendedGrooveLengthMm:50671});
  assert.deepEqual(await fingerprints(),before);
  console.log('Reconciliation: 213 -> 213 exact links; three conflicting cabinet labels; three through-hole pairs shown twice; one truncated A annotation; all historical data unchanged.');
 }finally{await pool.end();}
});
