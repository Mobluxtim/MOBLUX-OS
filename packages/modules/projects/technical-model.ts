import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../infrastructure/db.js';
import { projects, versions, sources, csvImports, technicalModels, cabinets, parts, materials, edgeData } from '../../../database/schema.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { normalizeReports, normalizerVersion } from './normalize.js';
import { resolveInTransaction } from '../catalog/resolution.js';

const inputSchema = z.object({ cabinetReportId: z.string().uuid(), partReportId: z.string().uuid(), requestId: z.string().uuid() }).strict();
function readAccess(actor: Actor) { authorize(actor, 'project.view'); authorize(actor, 'project.import'); authorize(actor, 'project.files.download'); }

export async function createTechnicalModel(actor: Actor, projectId: string, input: unknown) {
  readAccess(actor); authorize(actor, 'project.version.create');
  const values = inputSchema.parse(input);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${projectId}, 0))`);
    const project = await tx.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new DomainError(404, 'Project not found.');
    const selected = await tx.select({ report: csvImports, source: sources }).from(csvImports).innerJoin(sources, eq(csvImports.sourceId, sources.id)).where(and(inArray(csvImports.id, [values.cabinetReportId, values.partReportId]), eq(sources.projectId, projectId)));
    const c = selected.find(r => r.report.id === values.cabinetReportId), p = selected.find(r => r.report.id === values.partReportId);
    if (!c || !p) throw new DomainError(404, 'Selected project import reports not found.');
    if (c.source.versionId !== p.source.versionId) throw new DomainError(409, 'Choose two reports linked to the same source version. Cross-version pairing is not enabled.');
    // The command consumes technical fields only, never copies cabinet prices to its response/snapshot.
    if (c.report.profile !== 'polyboard-cabinets-7/v1' || p.report.profile !== 'polyboard-cutting-18/v1' || c.report.status !== 'NEEDS_REVIEW' || p.report.status !== 'NEEDS_REVIEW') throw new DomainError(400, 'Choose successful cabinet and cutting reports with the matching profiles.');
    const requestVersion = await tx.query.versions.findFirst({ where: and(eq(versions.projectId, projectId), eq(versions.requestId, values.requestId)) });
    if (requestVersion) {
      const ref = requestVersion.snapshot.normalizedData;
      if (!ref || ref.cabinetReportId !== values.cabinetReportId || ref.partReportId !== values.partReportId || ref.normalizer !== normalizerVersion) throw new DomainError(409, 'Request identifier already used for different version content.');
      await resolveInTransaction(tx, actor, projectId, ref.modelId);
      return { id: ref.modelId, versionId: requestVersion.id, reused: true };
    }
    const existing = await tx.query.technicalModels.findFirst({ where: and(eq(technicalModels.projectId, projectId), eq(technicalModels.cabinetReportId, values.cabinetReportId), eq(technicalModels.partReportId, values.partReportId), eq(technicalModels.normalizer, normalizerVersion)) });
    if (existing) { await resolveInTransaction(tx, actor, projectId, existing.id); return { id: existing.id, versionId: existing.versionId, reused: true }; }
    const normalized = normalizeReports(c.report.result, p.report.result);
    const modelId = randomUUID(), versionId = randomUUID();
    const [count] = await tx.select({ value: sql<number>`coalesce(max(${versions.number}), 0)::int` }).from(versions).where(eq(versions.projectId, projectId));
    const summary = 'Normalized technical model — needs review';
    await tx.insert(versions).values({ id: versionId, projectId, number: count.value + 1, summary, createdBy: actor.id, requestId: values.requestId,
      snapshot: { schemaVersion: 1, projectName: project.name, summary, sourceIds: [c.source.id, p.source.id], normalizedData: { modelId, normalizer: normalizerVersion, cabinetReportId: c.report.id, partReportId: p.report.id, baseVersionId: c.source.versionId, status: 'NEEDS_REVIEW', manufacturingVerified: false, summary: normalized.summary } } });
    const cabinetRows = normalized.cabinets.map(row => ({ id: randomUUID(), versionId, reportId: c.report.id, sourceId: c.source.id, sourceRow: row.row, sourceLine: row.line, name: row.name, quantity: row.quantity, dimensions: row.dimensions }));
    const materialRows = normalized.materials.map(row => ({ ...row, id: randomUUID(), versionId }));
    const cabinetIds = new Map(cabinetRows.map(row => [row.sourceRow, row.id])), materialIds = new Map(materialRows.map(row => [row.key, row.id]));
    const partRows = normalized.parts.map(row => ({ id: randomUUID(), versionId, cabinetId: row.cabinetRow === null ? null : cabinetIds.get(row.cabinetRow)!, materialId: materialIds.get(row.materialKey)!, reportId: p.report.id, sourceId: p.source.id, sourceRow: row.data.row, sourceLine: row.data.line, linkStatus: row.linkStatus, data: row.data }));
    const edges = partRows.flatMap(part => part.data.unmapped.edgeSlots.map(edge => ({ ...edge, versionId, partId: part.id })));
    // Bounded batches stay below PostgreSQL's bind-parameter limit for the 5,000-row profile cap.
    for (let i = 0; i < cabinetRows.length; i += 250) await tx.insert(cabinets).values(cabinetRows.slice(i, i + 250));
    for (let i = 0; i < materialRows.length; i += 250) await tx.insert(materials).values(materialRows.slice(i, i + 250));
    for (let i = 0; i < partRows.length; i += 250) await tx.insert(parts).values(partRows.slice(i, i + 250));
    for (let i = 0; i < edges.length; i += 250) await tx.insert(edgeData).values(edges.slice(i, i + 250));
    // Inserting this seal last makes further inserts into this version's technical rows fail.
    await tx.insert(technicalModels).values({ id: modelId, projectId, versionId, baseVersionId: c.source.versionId, cabinetReportId: c.report.id, partReportId: p.report.id, normalizer: normalizerVersion, summary: normalized.summary, issues: normalized.issues, createdBy: actor.id });
    await record(tx, actor.id, 'technical_model.created', modelId, projectId, { versionId, number: count.value + 1, cabinetReportId: c.report.id, partReportId: p.report.id, sourceIds: [c.source.id, p.source.id], sourceHashes: [c.source.hash, p.source.hash], normalizer: normalizerVersion, summary: normalized.summary, manufacturingVerified: false });
    await resolveInTransaction(tx, actor, projectId, modelId);
    return { id: modelId, versionId, reused: false };
  });
}

export async function listTechnicalModels(actor: Actor, projectId: string) {
  readAccess(actor);
  return db.select({ model: technicalModels, versionNumber: versions.number }).from(technicalModels).innerJoin(versions, eq(versions.id, technicalModels.versionId)).where(eq(technicalModels.projectId, projectId)).orderBy(desc(versions.number)).then(rows => rows.map(r => ({ ...r.model, versionNumber: r.versionNumber })));
}
export async function technicalModelDetail(actor: Actor, projectId: string, modelId: string) {
  readAccess(actor);
  const [entry] = await db.select({ model: technicalModels, versionNumber: versions.number }).from(technicalModels).innerJoin(versions, eq(versions.id, technicalModels.versionId)).where(and(eq(technicalModels.id, modelId), eq(technicalModels.projectId, projectId)));
  if (!entry) throw new DomainError(404, 'Project technical model not found.');
  const versionId = entry.model.versionId;
  const refs = await db.select({ sourceId: csvImports.sourceId }).from(csvImports).where(inArray(csvImports.id, [entry.model.cabinetReportId, entry.model.partReportId]));
  return { model: { ...entry.model, versionNumber: entry.versionNumber },
    cabinets: await db.select().from(cabinets).where(eq(cabinets.versionId, versionId)).orderBy(cabinets.sourceRow),
    materials: await db.select().from(materials).where(eq(materials.versionId, versionId)).orderBy(materials.description, materials.thickness),
    parts: await db.select().from(parts).where(eq(parts.versionId, versionId)).orderBy(parts.sourceRow),
    edges: await db.select().from(edgeData).where(eq(edgeData.versionId, versionId)).orderBy(edgeData.partId, edgeData.slot),
    sources: await db.select({ id: sources.id, name: sources.name, hash: sources.hash, objectVersion: sources.objectVersion }).from(sources).where(inArray(sources.id, refs.map(r => r.sourceId))) };
}
