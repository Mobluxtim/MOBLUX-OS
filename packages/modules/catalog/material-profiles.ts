import { and, eq, inArray } from 'drizzle-orm';
import type { Transaction } from '../../infrastructure/db.js';
import { materialProfiles, materialMasters, librarySnapshots } from '../../../database/schema.js';
import type { Actor } from '../identity/policy.js';
import type { ResolvedMaterial } from '../../contracts/resolution.js';
import { record } from '../audit/service.js';
import { classificationVersion, classifyMaterial } from './classification.js';

/** Internal consequence of the authorized resolution command; caller holds its transaction lock. */
export async function ensureMaterialProfiles(tx: Transaction, actor: Actor, results: ResolvedMaterial[]) {
  for (const masterId of new Set(results.flatMap(r => r.materialMasterId ? [r.materialMasterId] : []))) {
    const existing = await tx.query.materialProfiles.findFirst({ where: and(eq(materialProfiles.materialMasterId, masterId), eq(materialProfiles.policyVersion, classificationVersion)) });
    if (existing) continue;
    const master = await tx.query.materialMasters.findFirst({ where: eq(materialMasters.id, masterId) });
    const snapshot = master && await tx.query.librarySnapshots.findFirst({ where: eq(librarySnapshots.id, master.snapshotId) });
    const source = snapshot?.result.records.find(r => r.id === master?.recordId);
    if (!master || !snapshot || !source) throw new Error('Material profile source ancestry is missing.');
    const result = classifyMaterial(snapshot.id, snapshot.hash, source);
    const [profile] = await tx.insert(materialProfiles).values({ materialMasterId: master.id, policyVersion: classificationVersion, result, createdBy: actor.id }).returning();
    await record(tx, actor.id, 'material_profile.derived', profile.id, null, { materialMasterId: master.id, policyVersion: classificationVersion, status: result.status, panelType: result.panelType });
  }
}
export async function readMaterialProfiles(tx: Transaction, results: ResolvedMaterial[]) {
  const ids = results.flatMap(r => r.materialMasterId ? [r.materialMasterId] : []);
  return ids.length ? tx.select().from(materialProfiles).where(and(inArray(materialProfiles.materialMasterId, ids), eq(materialProfiles.policyVersion, classificationVersion))) : [];
}
