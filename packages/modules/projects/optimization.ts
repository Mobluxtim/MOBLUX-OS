import { createHash } from 'node:crypto';
import { and, eq, or, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../infrastructure/db.js';
import { readSource } from '../../infrastructure/storage.js';
import { technicalModels, materialResolutions, optimizationReports, sources, parts } from '../../../database/schema.js';
import { authorize, DomainError, type Actor } from '../identity/policy.js';
import { record } from '../audit/service.js';
import { extractOpticutPdf, UnsupportedOptimization, OptimizationBusy } from '../imports/opticut-pdf.js';
import { parseOpticutLayout, opticutParserVersion } from '../imports/opticut.js';
import { decimalIdentity } from './normalize.js';
import type { OptimizationResult } from '../../contracts/optimization.js';
import type { ResolvedMaterial } from '../../contracts/resolution.js';
function access(actor: Actor) { authorize(actor, 'project.view'); authorize(actor, 'project.import'); authorize(actor, 'project.files.download'); }
export function linkOptimization(result: OptimizationResult, materials: ResolvedMaterial[]): OptimizationResult {
  const link = (category: 'PANEL' | 'EDGE', name: string, thickness: string) => {
    const matches = materials.filter(m => m.category === category && m.name === name && decimalIdentity(m.thickness) === decimalIdentity(thickness) && m.status === 'EXACT_UNIQUE' && m.materialMasterId);
    return matches.length === 1 ? { materialMasterId: matches[0].materialMasterId, linkStatus: 'EXACT_UNIQUE' as const } : { materialMasterId: null, linkStatus: 'UNRESOLVED' as const };
  };
  return { ...result, panels: result.panels.map(p => ({ ...p, ...link('PANEL', p.name, p.thicknessMm) })), edges: result.edges.map(e => ({ ...e, ...link('EDGE', e.name, e.thicknessMm) })) };
}
export async function ensureOptimization(actor: Actor, projectId: string, modelId: string, input: unknown) {
  access(actor);
  const { resolutionId } = z.object({ resolutionId: z.string().uuid() }).strict().parse(input);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`optimization:${modelId}`}, 0))`);
    const model = await tx.query.technicalModels.findFirst({ where: and(eq(technicalModels.id, modelId), eq(technicalModels.projectId, projectId)) });
    const resolution = await tx.query.materialResolutions.findFirst({ where: and(eq(materialResolutions.id, resolutionId), eq(materialResolutions.modelId, modelId)) });
    if (!model || !resolution) throw new DomainError(404, 'Exact project model/resolution not found.');
    const inputs = (await tx.select().from(sources).where(and(eq(sources.projectId, projectId), or(eq(sources.versionId, model.baseVersionId), eq(sources.versionId, model.versionId))))).filter(s => s.name.toLowerCase().endsWith('.pdf'));
    const modelParts = await tx.select({ data: parts.data }).from(parts).where(eq(parts.versionId, model.versionId));
    for (const source of inputs) {
      const existing = await tx.query.optimizationReports.findFirst({ where: and(eq(optimizationReports.modelId, modelId), eq(optimizationReports.sourceId, source.id), eq(optimizationReports.resolutionId, resolutionId), eq(optimizationReports.parserVersion, opticutParserVersion)) });
      if (existing) continue;
      // Storage/integrity errors are retryable command failures, never cached as parser verdicts.
      const bytes = await readSource(source.objectKey, source.objectVersion);
      if (bytes.length !== source.size || createHash('sha256').update(bytes).digest('hex') !== source.hash) throw new DomainError(409, 'Optimization source integrity check failed.');
      let result: OptimizationResult | null = null, status: 'IMPORTED' | 'FAILED' | 'UNSUPPORTED' = 'IMPORTED', finding: string | null = null;
      try {
        const parsed = parseOpticutLayout(await extractOpticutPdf(Buffer.from(bytes)));
        if (!modelParts.length || modelParts.some(p => p.data.projectLabel !== parsed.projectLabel) || modelParts.length !== parsed.cuttingRows || modelParts.reduce((n, p) => n + p.data.quantity, 0) !== parsed.totals.requestedUnits) throw new Error('Source model mismatch');
        result = linkOptimization(parsed, resolution.results);
      } catch (error) {
        if (error instanceof OptimizationBusy) throw new DomainError(503, error.message);
        status = error instanceof UnsupportedOptimization ? 'UNSUPPORTED' : 'FAILED';
        finding = status === 'UNSUPPORTED' ? 'Not the supported OptiCut 6.09 PDF profile.' : 'OptiCut validation failed: unsupported/corrupt tables or model mismatch. No partial requirements published.';
      }
      const [report] = await tx.insert(optimizationReports).values({ modelId, sourceId: source.id, resolutionId, sourceHash: source.hash, parserVersion: opticutParserVersion, status, result, finding, createdBy: actor.id }).returning();
      await record(tx, actor.id, 'optimization.import.assessed', report.id, projectId, { modelId, resolutionId, sourceId: source.id, sourceHash: source.hash, parserVersion: opticutParserVersion, status });
    }
    return tx.select().from(optimizationReports).where(and(eq(optimizationReports.modelId, modelId), eq(optimizationReports.resolutionId, resolutionId))).orderBy(desc(optimizationReports.createdAt));
  });
}
export async function optimizationHistory(actor: Actor, projectId: string, modelId: string) {
  access(actor);
  if (!await db.query.technicalModels.findFirst({ where: and(eq(technicalModels.id, modelId), eq(technicalModels.projectId, projectId)) })) throw new DomainError(404, 'Project model not found.');
  return db.select().from(optimizationReports).where(eq(optimizationReports.modelId, modelId)).orderBy(desc(optimizationReports.createdAt));
}
