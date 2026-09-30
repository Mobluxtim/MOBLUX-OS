import { and, eq, inArray } from 'drizzle-orm';
import type { Transaction } from '../../infrastructure/db.js';
import { bomReports, technicalModels, materials, parts, cabinets, edgeData, sources, csvImports } from '../../../database/schema.js';
import type { Actor } from '../identity/policy.js';
import type { ResolvedMaterial } from '../../contracts/resolution.js';
import { buildBom, bomAlgorithmVersion } from './bom.js';
import { record } from '../audit/service.js';

/** Internal consequence of the authorized resolution command, under its transaction lock. */
export async function ensureBom(tx: Transaction, actor: Actor, resolution: { id: string; modelId: string; results: ResolvedMaterial[] }) {
  const existing = await tx.query.bomReports.findFirst({ where: and(eq(bomReports.resolutionId, resolution.id), eq(bomReports.algorithmVersion, bomAlgorithmVersion)) });
  if (existing) return existing;
  const model = await tx.query.technicalModels.findFirst({ where: eq(technicalModels.id, resolution.modelId) });
  if (!model) throw new Error('BOM model missing.');
  const refs = await tx.select({ sourceId: csvImports.sourceId }).from(csvImports).where(inArray(csvImports.id, [model.cabinetReportId, model.partReportId]));
  const result = buildBom({ model,
    cabinets: await tx.select().from(cabinets).where(eq(cabinets.versionId, model.versionId)),
    parts: await tx.select().from(parts).where(eq(parts.versionId, model.versionId)),
    materials: await tx.select().from(materials).where(eq(materials.versionId, model.versionId)),
    edges: await tx.select().from(edgeData).where(eq(edgeData.versionId, model.versionId)),
    sources: await tx.select({ id: sources.id, name: sources.name, hash: sources.hash, objectVersion: sources.objectVersion }).from(sources).where(inArray(sources.id, refs.map(r => r.sourceId)))
  }, resolution.results);
  const [report] = await tx.insert(bomReports).values({ resolutionId: resolution.id, algorithmVersion: bomAlgorithmVersion, result, createdBy: actor.id }).returning();
  await record(tx, actor.id, 'material_requirements.derived', report.id, model.projectId, { modelId: model.id, versionId: model.versionId, resolutionId: resolution.id, algorithmVersion: bomAlgorithmVersion, totals: result.totals, manufacturingVerified: false });
  return report;
}
