import { randomUUID, createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../infrastructure/db.js';
import { librarySnapshots, libraryMatches } from '../../../database/schema.js';
import { preserveSource, readSource } from '../../infrastructure/storage.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { libraryCategories } from '../../contracts/library.js';
import type { LibraryCategory } from '../../contracts/library.js';
import { libraryFilenames, libraryParserVersion, parseLibrary, sha256 } from '../imports/polyboard-library.js';
import { libraryInputLimit, LibraryBusyError } from '../imports/library-decompress.js';
import { libraryMatcherVersion, proposeMatches } from './matching.js';
import { deriveMaterialRequests } from './requests.js';
import { technicalModelDetail } from '../projects/technical-model.js';
import { classifyMaterial } from './classification.js';


const metadata = { id: librarySnapshots.id, category: librarySnapshots.category, filename: librarySnapshots.filename, hash: librarySnapshots.hash,
  size: librarySnapshots.size, parserVersion: librarySnapshots.parserVersion, status: librarySnapshots.status, recordCount: librarySnapshots.recordCount,
  createdAt: librarySnapshots.createdAt, createdBy: librarySnapshots.createdBy };
export async function stageLibrary(actor: Actor, category: LibraryCategory, filename: string, bytes: Buffer) {
  authorize(actor, 'library.import'); authorize(actor, 'library.view');
  z.enum(libraryCategories).parse(category);
  if (filename !== libraryFilenames[category]) throw new DomainError(400, 'Choose the original Panel.mat-boole, Edge.mat-boole or Bar.mat-boole for this category.');
  if (!bytes.length || bytes.length > libraryInputLimit) throw new DomainError(400, 'Library must be nonempty and at most 256 KiB.');
  const hash = sha256(bytes);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`library:${category}:${hash}:${libraryParserVersion}`}, 0))`);
    const existing = await tx.query.librarySnapshots.findFirst({ where: and(eq(librarySnapshots.category, category), eq(librarySnapshots.hash, hash), eq(librarySnapshots.parserVersion, libraryParserVersion)) });
    if (existing) return { id: existing.id, status: existing.status, recordCount: existing.recordCount, reused: true };
    const result = await parseLibrary(category, bytes).catch(error => {
      if (error instanceof LibraryBusyError) throw new DomainError(503, error.message);
      throw error;
    });
    const id = randomUUID(), objectKey = `library/${id}`;
    const objectVersion = await preserveSource(objectKey, bytes);
    await tx.insert(librarySnapshots).values({ id, category, filename, hash, size: bytes.length, parserVersion: libraryParserVersion, objectKey, objectVersion,
      status: result.status, recordCount: result.recordCount, result, createdBy: actor.id });
    await record(tx, actor.id, 'library.snapshot.staged', id, null, { category, hash, parserVersion: libraryParserVersion, status: result.status, recordCount: result.recordCount, manufacturingVerified: false });
    return { id, status: result.status, recordCount: result.recordCount, reused: false };
  });
}
export async function listLibrary(actor: Actor) { authorize(actor, 'library.view'); return db.select(metadata).from(librarySnapshots).orderBy(desc(librarySnapshots.createdAt)); }
export async function libraryDetail(actor: Actor, id: string) {
  authorize(actor, 'library.view'); const source = await db.query.librarySnapshots.findFirst({ where: eq(librarySnapshots.id, id) });
  if (!source) throw new DomainError(404, 'Library snapshot not found.');
  // Raw binary may contain financial data; never include it in normal review responses.
  return { id: source.id, category: source.category, filename: source.filename, hash: source.hash, size: source.size, parserVersion: source.parserVersion,
    status: source.status, recordCount: source.recordCount, createdAt: source.createdAt, createdBy: source.createdBy,
    profiles: source.result.records.map(r => classifyMaterial(source.id, source.hash, r)),
    result: { ...source.result, headerHex: '', payloadPrefixHex: '', records: source.result.records.map(r => ({ ...r, rawHex: '' })) } };
}
export async function rawLibraryRecord(actor: Actor, id: string, index: number) {
  authorize(actor, 'library.view'); authorize(actor, 'library.raw.view');
  const source = await db.query.librarySnapshots.findFirst({ where: eq(librarySnapshots.id, id) });
  const row = source?.result.records.find(r => r.index === index); if (!row) throw new DomainError(404, 'Library record not found.');
  return { hash: source!.hash, parserVersion: source!.parserVersion, record: row };
}
export async function downloadLibrary(actor: Actor, id: string) {
  authorize(actor, 'library.view'); authorize(actor, 'library.raw.view');
  const source = await db.query.librarySnapshots.findFirst({ where: eq(librarySnapshots.id, id) });
  if (!source) throw new DomainError(404, 'Library snapshot not found.');
  const bytes = await readSource(source.objectKey, source.objectVersion);
  if (bytes.length !== source.size || sha256(bytes) !== source.hash) throw new DomainError(409, 'Library source integrity check failed.');
  return { bytes, name: source.filename };
}
export async function matchLibrary(actor: Actor, projectId: string, modelId: string, input: unknown) {
  authorize(actor, 'library.view'); authorize(actor, 'library.match');
  const { snapshotIds } = z.object({ snapshotIds: z.array(z.string().uuid()).min(1).max(3) }).strict().parse(input);
  if (new Set(snapshotIds).size !== snapshotIds.length) throw new DomainError(400, 'Select each snapshot once.');
  const detail = await technicalModelDetail(actor, projectId, modelId);
  const selected = await db.select().from(librarySnapshots).where(inArray(librarySnapshots.id, snapshotIds));
  if (selected.length !== snapshotIds.length) throw new DomainError(404, 'Library snapshot not found.');
  if (selected.some(s => s.status !== 'NEEDS_REVIEW') || new Set(selected.map(s => s.category)).size !== selected.length) throw new DomainError(400, 'Select one successfully parsed snapshot per category.');
  const ids = [...snapshotIds].sort(), inputKey = createHash('sha256').update(JSON.stringify(ids)).digest('hex');
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`library-match:${modelId}:${inputKey}`}, 0))`);
    const previous = await tx.query.libraryMatches.findFirst({ where: and(eq(libraryMatches.modelId, modelId), eq(libraryMatches.inputKey, inputKey), eq(libraryMatches.matcherVersion, libraryMatcherVersion)) });
    if (previous) return { ...previous, projectId, versionId: detail.model.versionId, reused: true };
    const requests = deriveMaterialRequests(detail.materials, detail.edges);
    // Missing category is review-required, not evidence that its material does not exist.
    const results = proposeMatches(requests, selected.map(s => ({ id: s.id, records: s.result.records }))).map(r => selected.some(s => s.category === r.category) ? r : { ...r, status: 'REVIEW_REQUIRED' as const, reason: 'No snapshot selected for this category.' });
    const [report] = await tx.insert(libraryMatches).values({ modelId, snapshotIds: ids, matcherVersion: libraryMatcherVersion, inputKey, results, createdBy: actor.id }).returning();
    await record(tx, actor.id, 'library.matches.proposed', report.id, projectId, { modelId, versionId: detail.model.versionId, snapshotIds: ids, matcherVersion: libraryMatcherVersion, manufacturingVerified: false });
    return { ...report, projectId, versionId: detail.model.versionId, reused: false };
  });
}
export async function listMatches(actor: Actor, projectId: string, modelId: string) {
  authorize(actor, 'library.view');
  const detail = await technicalModelDetail(actor, projectId, modelId);
  return db.select().from(libraryMatches).where(eq(libraryMatches.modelId, modelId)).orderBy(desc(libraryMatches.createdAt)).then(rows => rows.map(r => ({ ...r, projectId, versionId: detail.model.versionId })));
}
