import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db.js';
import { projects, customers, versions, sources, imports, csvImports, audit, users } from '../../../database/schema.js';
import { projectInput, versionInput } from '../../contracts/index.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
export async function listProjects(actor: Actor) { authorize(actor, 'project.view'); return db.select().from(projects).orderBy(desc(projects.createdAt)); }
export async function createProject(actor: Actor, input: unknown) {
  authorize(actor, 'project.create'); const values = projectInput.parse(input);
  return db.transaction(async tx => { if (!await tx.query.customers.findFirst({ where: eq(customers.id, values.customerId) })) throw new DomainError(404, 'Customer not found.'); const [project] = await tx.insert(projects).values(values).returning(); await record(tx, actor.id, 'project.created', project.id, project.id, { name: project.name, customerId: project.customerId }); return project; });
}
export async function createVersion(actor: Actor, projectId: string, input: unknown) {
  authorize(actor, 'project.version.create'); const values = versionInput.parse(input);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${projectId}, 0))`);
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new DomainError(404, 'Project not found.');
    const existing = await tx.query.versions.findFirst({ where: and(eq(versions.projectId, projectId), eq(versions.requestId, values.requestId)) });
    if (existing) { if (existing.summary !== values.summary) throw new DomainError(409, 'This request was already used for different version content.'); return existing; }
    const [count] = await tx.select({ value: sql<number>`coalesce(max(${versions.number}), 0)::int` }).from(versions).where(eq(versions.projectId, projectId));
    const [version] = await tx.insert(versions).values({ ...values, projectId, number: count.value + 1, createdBy: actor.id, snapshot: { schemaVersion: 1, projectName: project.name, summary: values.summary, sourceIds: [], normalizedData: null } }).returning();
    await record(tx, actor.id, 'version.created', version.id, projectId, { number: version.number, summary: version.summary, manufacturingVerified: false }); return version;
  });
}
export async function listSources(actor: Actor, projectId?: string) {
  authorize(actor, 'project.view'); authorize(actor, 'project.files.download');
  const items = await db.select({ id: sources.id, projectId: sources.projectId, versionId: sources.versionId, name: sources.name, size: sources.size, hash: sources.hash, createdAt: sources.createdAt, status: imports.status, findings: imports.findings }).from(sources).innerJoin(imports, eq(imports.sourceId, sources.id)).where(projectId ? eq(sources.projectId, projectId) : undefined).orderBy(desc(sources.createdAt));
  if (!items.length) return [];
  // List only safe assessment metadata here, never raw commercial columns or full datasets.
  const attempts = await db.select({ id: csvImports.id, sourceId: csvImports.sourceId, profile: csvImports.profile, status: csvImports.status, createdAt: csvImports.createdAt }).from(csvImports).where(inArray(csvImports.sourceId, items.map(s => s.id))).orderBy(desc(csvImports.createdAt), desc(csvImports.id));
  return items.map(item => { const history = attempts.filter(a => a.sourceId === item.id); return { ...item, csvAttempts: history, status: history[0]?.status ?? item.status, findings: history.length ? [history[0].status === 'FAILED' ? 'CSV validation failed. Open the report for row/column diagnostics.' : 'CSV extracted to staging. Review unresolved fields; not validated for manufacturing.'] : item.findings }; });
}
export async function projectDetail(actor: Actor, id: string) {
  authorize(actor, 'project.view'); authorize(actor, 'customer.view'); authorize(actor, 'audit.view');
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) }); if (!project) throw new DomainError(404, 'Project not found.');
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, project.customerId) });
  return { project, customer, versions: await db.select().from(versions).where(eq(versions.projectId, id)).orderBy(desc(versions.number)), sources: await listSources(actor, id), activity: await db.select({ id: audit.id, event: audit.event, entityId: audit.entityId, details: audit.details, createdAt: audit.createdAt, actor: users.name }).from(audit).innerJoin(users, eq(users.id, audit.actorId)).where(eq(audit.projectId, id)).orderBy(desc(audit.createdAt)) };
}
