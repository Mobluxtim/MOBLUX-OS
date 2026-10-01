import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Transaction } from '../../infrastructure/db.js';
import { libraryActivations, librarySnapshots, materialMasters, materialResolutions, technicalModels, materials, edgeData, bomReports } from '../../../database/schema.js';
import { ensureBom } from '../projects/bom-service.js';
import { bomAlgorithmVersion } from '../projects/bom.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { libraryCategories } from '../../contracts/library.js';
import type { ActiveLibrary, ResolvedMaterial } from '../../contracts/resolution.js';
import { deriveMaterialRequests } from './requests.js';
import { proposeMatches, libraryMatcherVersion } from './matching.js';
import { ensureMaterialProfiles, readMaterialProfiles } from './material-profiles.js';

export const resolverVersion = `automatic-material/v1:${libraryMatcherVersion}`;
const lock = sql`select pg_advisory_xact_lock(hashtextextended('material-resolution-active-library', 0))`;
function access(actor: Actor) { authorize(actor, 'project.view'); authorize(actor, 'project.import'); authorize(actor, 'project.files.download'); }
async function activeLibraries(tx: Transaction): Promise<ActiveLibrary[]> {
  const events = await tx.select().from(libraryActivations).orderBy(desc(libraryActivations.sequence));
  const current = libraryCategories.map(c => events.find(e => e.category === c)).filter(e => e?.snapshotId);
  const result: ActiveLibrary[] = [];
  for (const event of current) {
    const snapshot = await tx.query.librarySnapshots.findFirst({ where: eq(librarySnapshots.id, event!.snapshotId!) });
    if (!snapshot || snapshot.status !== 'NEEDS_REVIEW' || snapshot.category !== event!.category) throw new DomainError(409, 'Active library configuration is invalid.');
    result.push({ category: snapshot.category, snapshotId: snapshot.id, filename: snapshot.filename, hash: snapshot.hash, activationId: event!.id, activatedAt: event!.createdAt.toISOString() });
  }
  return result;
}
export async function activeLibraryState(actor: Actor) {
  authorize(actor, 'library.view');
  return db.transaction(async tx => { await tx.execute(lock); return { active: await activeLibraries(tx), history: await tx.select().from(libraryActivations).orderBy(desc(libraryActivations.sequence)) }; });
}
export async function activateLibrary(actor: Actor, input: unknown) {
  authorize(actor, 'library.activate'); authorize(actor, 'library.view');
  const value = z.object({ category: z.enum(libraryCategories), snapshotId: z.string().uuid().nullable(), reason: z.string().trim().min(1).max(500) }).strict().parse(input);
  return db.transaction(async tx => {
    await tx.execute(lock);
    if (value.snapshotId) {
      const source = await tx.query.librarySnapshots.findFirst({ where: eq(librarySnapshots.id, value.snapshotId) });
      if (!source || source.category !== value.category || source.status !== 'NEEDS_REVIEW') throw new DomainError(400, 'Choose a successfully parsed snapshot of the same category.');
    }
    const previous = await tx.query.libraryActivations.findFirst({ where: eq(libraryActivations.category, value.category), orderBy: desc(libraryActivations.sequence) });
    if ((previous?.snapshotId ?? null) === value.snapshotId) return { reused: true, active: await activeLibraries(tx) };
    const [event] = await tx.insert(libraryActivations).values({ ...value, createdBy: actor.id }).returning();
    await record(tx, actor.id, 'library.active.changed', event.id, null, { ...value, previousSnapshotId: previous?.snapshotId ?? null });
    // Activation is the authorized administrative trigger, including projects not open in a browser.
    // Keep configuration and all affected reports atomic; never leave a partially applied activation.
    for (const model of await tx.select().from(technicalModels)) {
      const relevant = value.category === 'PANEL'
        ? (await tx.select({ id: materials.id }).from(materials).where(eq(materials.versionId, model.versionId)).limit(1)).length > 0
        : value.category === 'EDGE' && (await tx.select().from(edgeData).where(eq(edgeData.versionId, model.versionId))).some(e => e.material || e.thickness);
      if (relevant) await resolveCore(tx, actor, model.projectId, model.id);
    }
    return { reused: false, active: await activeLibraries(tx) };
  });
}
async function context(tx: Transaction, projectId: string, modelId: string) {
  const model = await tx.query.technicalModels.findFirst({ where: and(eq(technicalModels.id, modelId), eq(technicalModels.projectId, projectId)) });
  if (!model) throw new DomainError(404, 'Project technical model not found.');
  const requests = deriveMaterialRequests(await tx.select().from(materials).where(eq(materials.versionId, model.versionId)), await tx.select().from(edgeData).where(eq(edgeData.versionId, model.versionId)));
  const active = (await activeLibraries(tx)).filter(a => requests.some(r => r.category === a.category));
  const inputKey = createHash('sha256').update(JSON.stringify(active.map(a => [a.category, a.snapshotId]).sort())).digest('hex');
  return { model, requests, active, inputKey };
}
/** Called within model creation's transaction and on authorized project refresh. */
export async function resolveInTransaction(tx: Transaction, actor: Actor, projectId: string, modelId: string) {
  access(actor); return resolveCore(tx, actor, projectId, modelId);
}
// Private: reached only after project authorization or the audited library.activate command.
async function resolveCore(tx: Transaction, actor: Actor, projectId: string, modelId: string) {
  await tx.execute(lock);
  const { requests, active, inputKey } = await context(tx, projectId, modelId);
  const previous = await tx.query.materialResolutions.findFirst({ where: and(eq(materialResolutions.modelId, modelId), eq(materialResolutions.inputKey, inputKey), eq(materialResolutions.resolverVersion, resolverVersion)) });
  if (previous) { await ensureMaterialProfiles(tx, actor, previous.results); await ensureBom(tx, actor, previous); return previous; }
  const selected = active.length ? await tx.select().from(librarySnapshots).where(inArray(librarySnapshots.id, active.map(a => a.snapshotId))) : [];
  const matches = proposeMatches(requests, selected.map(s => ({ id: s.id, records: s.result.records })));
  const results: ResolvedMaterial[] = [];
  for (const match of matches) {
    if (!active.some(a => a.category === match.category)) { results.push({ ...match, status: 'REVIEW_REQUIRED', reason: 'No active library snapshot for this category. Ask an administrator to activate one.', materialMasterId: null }); continue; }
    let materialMasterId: string | null = null;
    if (match.status === 'EXACT_UNIQUE') {
      const candidate = match.candidates[0];
      const existing = await tx.query.materialMasters.findFirst({ where: and(eq(materialMasters.snapshotId, candidate.snapshotId), eq(materialMasters.recordId, candidate.recordId)) });
      if (existing) materialMasterId = existing.id;
      else {
        const [master] = await tx.insert(materialMasters).values({ category: match.category, name: match.name, thickness: match.thickness, unit: match.unit, snapshotId: candidate.snapshotId, recordId: candidate.recordId, createdBy: actor.id }).returning();
        materialMasterId = master.id;
        await record(tx, actor.id, 'material_master.created', master.id, null, { snapshotId: candidate.snapshotId, recordId: candidate.recordId, confidence: 'CORROBORATED' });
      }
    }
    results.push({ ...match, materialMasterId });
  }
  const [report] = await tx.insert(materialResolutions).values({ modelId, inputKey, resolverVersion, snapshots: active, results, createdBy: actor.id }).returning();
  await record(tx, actor.id, 'materials.automatically_resolved', report.id, projectId, { modelId, snapshotIds: active.map(a => a.snapshotId), resolverVersion, resolved: results.filter(r => r.materialMasterId).length, total: results.length, manufacturingVerified: false });
  await ensureBom(tx, actor, report);
  await ensureMaterialProfiles(tx, actor, report.results);
  return report;
}
export async function resolveMaterials(actor: Actor, projectId: string, modelId: string) {
  access(actor); return db.transaction(tx => resolveInTransaction(tx, actor, projectId, modelId));
}
export async function resolutionState(actor: Actor, projectId: string, modelId: string) {
  access(actor);
  return db.transaction(async tx => {
    await tx.execute(lock); const { active, inputKey } = await context(tx, projectId, modelId);
    const history = await tx.select().from(materialResolutions).where(eq(materialResolutions.modelId, modelId)).orderBy(desc(materialResolutions.createdAt));
    const current = history.find(r => r.inputKey === inputKey && r.resolverVersion === resolverVersion) ?? null;
    const bom = current ? await tx.query.bomReports.findFirst({ where: and(eq(bomReports.resolutionId, current.id), eq(bomReports.algorithmVersion, bomAlgorithmVersion)) }) : null;
    const profiles = current ? await readMaterialProfiles(tx, current.results) : [];
    return { current, history, active, stale: !current, bom: bom ?? null, profiles };
  });
}
