import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db.js';
import { sources, versions, imports, projects, csvImports } from '../../../database/schema.js';
import { preserveSource, readSource } from '../../infrastructure/storage.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { unmappedAdapter, validSource } from './adapter.js';
import { z } from 'zod';
import { csvProfiles } from '../../contracts/imports.js';
import { csvAdapters } from './polyboard-csv.js';
export async function upload(actor: Actor, projectId: string, versionId: string, requestId: string, name: string, bytes: Buffer) {
  authorize(actor, 'project.import'); const problem = validSource(name, bytes); if (problem) throw new DomainError(400, problem);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return db.transaction(async tx => {
    // Serialize retries for this project and validate ancestry before external storage.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${projectId}, 0))`);
    if (!await tx.query.projects.findFirst({ where: eq(projects.id, projectId) })) throw new DomainError(404, 'Project not found.');
    if (!await tx.query.versions.findFirst({ where: and(eq(versions.id, versionId), eq(versions.projectId, projectId)) })) throw new DomainError(404, 'Project version not found.');
    const existing = await tx.query.sources.findFirst({ where: and(eq(sources.projectId, projectId), eq(sources.requestId, requestId)) });
    if (existing) { if (existing.hash !== hash || existing.versionId !== versionId || existing.name !== name) throw new DomainError(409, 'Upload request already used for different content.'); return { id: existing.id }; }
    const sourceId = randomUUID(); const objectKey = `${projectId}/${sourceId}`;
    const objectVersion = await preserveSource(objectKey, bytes);
    // A DB failure can leave an unreferenced private object, never a published partial record.
    await tx.insert(sources).values({ id: sourceId, projectId, versionId, requestId, name, size: bytes.length, hash, objectKey, objectVersion, createdBy: actor.id });
    await tx.insert(imports).values({ sourceId, ...unmappedAdapter.assess({ name, hash, size: bytes.length }) });
    await record(tx, actor.id, 'source.preserved', sourceId, projectId, { versionId, name, hash, size: bytes.length, status: 'PENDING_MAPPING' }); return { id: sourceId };
  });
}
export async function download(actor: Actor, id: string) { authorize(actor, 'project.files.download'); authorize(actor, 'project.view'); const source = await db.query.sources.findFirst({ where: eq(sources.id, id) }); if (!source) throw new DomainError(404, 'Source not found.'); return { name: source.name, bytes: await readSource(source.objectKey, source.objectVersion) }; }

export async function importCsv(actor: Actor, projectId: string, sourceId: string, input: unknown) {
  authorize(actor, 'project.import'); authorize(actor, 'project.view'); authorize(actor, 'project.files.download');
  const { profile, requestId } = z.object({ profile: z.enum(csvProfiles), requestId: z.string().uuid() }).strict().parse(input);
  if (profile === 'polyboard-cabinets-7/v1') authorize(actor, 'project.cost.view');
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sourceId}, 0))`);
    const source = await tx.query.sources.findFirst({ where: and(eq(sources.id, sourceId), eq(sources.projectId, projectId)) });
    if (!source) throw new DomainError(404, 'Project source not found.');
    if (!source.name.toLowerCase().endsWith('.csv')) throw new DomainError(400, 'Choose an original CSV source. Other file types are not parsed.');
    const existing = await tx.query.csvImports.findFirst({ where: and(eq(csvImports.sourceId, sourceId), eq(csvImports.requestId, requestId)) });
    if (existing) { if (existing.profile !== profile) throw new DomainError(409, 'Import request already used for another profile.'); return { id: existing.id }; }
    const bytes = await readSource(source.objectKey, source.objectVersion);
    if (bytes.length !== source.size || createHash('sha256').update(bytes).digest('hex') !== source.hash) throw new DomainError(409, 'Source integrity verification failed. No import was created.');
    const result = csvAdapters[profile].parse(bytes);
    const [attempt] = await tx.insert(csvImports).values({ sourceId, requestId, profile, status: result.status, result, createdBy: actor.id }).returning({ id: csvImports.id });
    await record(tx, actor.id, 'import.csv.assessed', attempt.id, projectId, { sourceId, versionId: source.versionId, sourceHash: source.hash, profile, status: result.status, rows: result.summary.rows, manufacturingVerified: false });
    return attempt;
  });
}

export async function csvReport(actor: Actor, projectId: string, attemptId: string) {
  authorize(actor, 'project.view'); authorize(actor, 'project.files.download'); authorize(actor, 'project.import');
  const attempt = await db.query.csvImports.findFirst({ where: eq(csvImports.id, attemptId) });
  if (!attempt) throw new DomainError(404, 'Import not found.');
  const source = await db.query.sources.findFirst({ where: and(eq(sources.id, attempt.sourceId), eq(sources.projectId, projectId)) });
  if (!source) throw new DomainError(404, 'Project import not found.');
  if (attempt.profile === 'polyboard-cabinets-7/v1') authorize(actor, 'project.cost.view');
  return { ...attempt, source: { name: source.name, hash: source.hash, projectId: source.projectId, versionId: source.versionId } };
}
