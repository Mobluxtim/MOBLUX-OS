import { pgTable, uuid, text, timestamp, boolean, integer, serial, jsonb, unique, foreignKey, primaryKey } from 'drizzle-orm/pg-core';
import type { ActiveLibrary, ResolvedMaterial } from '../packages/contracts/resolution.js';
import type { BomResult } from '../packages/contracts/bom.js';
import type { MaterialProfile } from '../packages/contracts/material-profile.js';
import type { OptimizationResult } from '../packages/contracts/optimization.js';
import type { HardwareResult } from '../packages/contracts/hardware.js';
import type { MachiningResult } from '../packages/contracts/machining.js';
import type { CostRules, CostInputs, CostResult } from '../packages/contracts/costing.js';
import type { CsvProfile, CsvResult, ImportedCabinet, ImportedPart } from '../packages/contracts/imports.js';
import type { ModelSummary, ModelIssue } from '../packages/contracts/technical-model.js';
import type { LibraryCategory, LibraryResult, MaterialMatch } from '../packages/contracts/library.js';
const id = () => uuid('id').defaultRandom().primaryKey();
const created = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
export const users = pgTable('users', { id: id(), email: text('email').notNull().unique(), name: text('name').notNull(), active: boolean('active').default(true).notNull(), kind: text('kind', { enum: ['staff', 'customer'] }).notNull(), createdAt: created() });
export const roles = pgTable('roles', { id: id(), name: text('name').notNull().unique() });
export const roleGrants = pgTable('role_grants', { roleId: uuid('role_id').references(() => roles.id).notNull(), capability: text('capability').notNull() }, t => [primaryKey({ columns: [t.roleId, t.capability] })]);
export const userRoles = pgTable('user_roles', { userId: uuid('user_id').references(() => users.id).notNull(), roleId: uuid('role_id').references(() => roles.id).notNull() }, t => [primaryKey({ columns: [t.userId, t.roleId] })]);
export const userOverrides = pgTable('user_overrides', { userId: uuid('user_id').references(() => users.id).notNull(), capability: text('capability').notNull(), allowed: boolean('allowed').notNull() }, t => [primaryKey({ columns: [t.userId, t.capability] })]);
export const sessions = pgTable('sessions', { tokenHash: text('token_hash').primaryKey(), userId: uuid('user_id').references(() => users.id).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull() });
export const customers = pgTable('customers', { id: id(), name: text('name').notNull(), email: text('email').notNull(), phone: text('phone').notNull(), address: text('address').notNull(), createdAt: created() });
export const projects = pgTable('projects', { id: id(), customerId: uuid('customer_id').references(() => customers.id).notNull(), name: text('name').notNull(), description: text('description').notNull(), createdAt: created() });
export interface VersionSnapshot { schemaVersion: 1; projectName: string; summary: string; sourceIds: string[]; normalizedData: null | { modelId: string; normalizer: string; cabinetReportId: string; partReportId: string; baseVersionId: string; status: 'NEEDS_REVIEW'; manufacturingVerified: false; summary: ModelSummary; }; }
export const versions = pgTable('project_versions', { id: id(), projectId: uuid('project_id').references(() => projects.id).notNull(), number: integer('number').notNull(), summary: text('summary').notNull(), snapshot: jsonb('snapshot').$type<VersionSnapshot>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), requestId: uuid('request_id').notNull(), createdAt: created() }, t => [unique().on(t.projectId, t.number), unique().on(t.projectId, t.requestId), unique().on(t.projectId, t.id)]);
export const sources = pgTable('source_files', { id: id(), projectId: uuid('project_id').references(() => projects.id).notNull(), versionId: uuid('version_id').notNull(), name: text('name').notNull(), size: integer('size').notNull(), hash: text('hash').notNull(), objectKey: text('object_key').notNull().unique(), objectVersion: text('object_version'), createdBy: uuid('created_by').references(() => users.id).notNull(), requestId: uuid('request_id').notNull(), createdAt: created() }, t => [foreignKey({ columns: [t.projectId, t.versionId], foreignColumns: [versions.projectId, versions.id] }), unique().on(t.projectId, t.requestId)]);
export const imports = pgTable('import_attempts', { id: id(), sourceId: uuid('source_id').references(() => sources.id).notNull().unique(), adapter: text('adapter').notNull(), status: text('status', { enum: ['PENDING_MAPPING'] }).notNull(), findings: jsonb('findings').$type<string[]>().notNull(), createdAt: created() });
// Follow-up CSV attempts are append-only staging, separate from the original upload assessment.
export const csvImports = pgTable('csv_import_attempts', {
  id: id(), sourceId: uuid('source_id').references(() => sources.id).notNull(), requestId: uuid('request_id').notNull(),
  profile: text('profile').$type<CsvProfile>().notNull(), status: text('status').$type<CsvResult['status']>().notNull(),
  result: jsonb('result').$type<CsvResult>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.sourceId, t.requestId)]);
export const audit = pgTable('audit_events', { id: id(), actorId: uuid('actor_id').references(() => users.id).notNull(), projectId: uuid('project_id').references(() => projects.id), entityId: uuid('entity_id').notNull(), event: text('event').notNull(), details: jsonb('details').$type<Record<string, unknown>>().notNull(), createdAt: created() });

export const technicalModels = pgTable('technical_models', {
  id: id(), projectId: uuid('project_id').notNull(), versionId: uuid('version_id').notNull().unique(), baseVersionId: uuid('base_version_id').notNull(),
  cabinetReportId: uuid('cabinet_report_id').references(() => csvImports.id).notNull(), partReportId: uuid('part_report_id').references(() => csvImports.id).notNull(),
  normalizer: text('normalizer').notNull(), summary: jsonb('summary').$type<ModelSummary>().notNull(), issues: jsonb('issues').$type<ModelIssue[]>().notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [foreignKey({ columns: [t.projectId, t.versionId], foreignColumns: [versions.projectId, versions.id] }), foreignKey({ columns: [t.projectId, t.baseVersionId], foreignColumns: [versions.projectId, versions.id] }), unique().on(t.projectId, t.cabinetReportId, t.partReportId, t.normalizer)]);
export const cabinets = pgTable('cabinets', {
  id: id(), versionId: uuid('version_id').references(() => versions.id).notNull(), reportId: uuid('report_id').references(() => csvImports.id).notNull(), sourceId: uuid('source_id').references(() => sources.id).notNull(),
  sourceRow: integer('source_row').notNull(), sourceLine: integer('source_line').notNull(), name: text('name').notNull(), quantity: integer('quantity').notNull(), dimensions: jsonb('dimensions').$type<ImportedCabinet['dimensions']>().notNull()
}, t => [unique().on(t.versionId, t.id), unique().on(t.versionId, t.reportId, t.sourceRow)]);
export const materials = pgTable('technical_materials', {
  id: id(), versionId: uuid('version_id').references(() => versions.id).notNull(), key: text('key').notNull(), description: text('description').notNull(), thickness: text('thickness').notNull(), unit: text('unit').$type<'mm'>().notNull()
}, t => [unique().on(t.versionId, t.id), unique().on(t.versionId, t.key)]);
export const parts = pgTable('parts', {
  id: id(), versionId: uuid('version_id').references(() => versions.id).notNull(), cabinetId: uuid('cabinet_id'), materialId: uuid('material_id').notNull(),
  reportId: uuid('report_id').references(() => csvImports.id).notNull(), sourceId: uuid('source_id').references(() => sources.id).notNull(), sourceRow: integer('source_row').notNull(), sourceLine: integer('source_line').notNull(),
  linkStatus: text('link_status').$type<'LINKED' | 'AMBIGUOUS' | 'UNMAPPED'>().notNull(), data: jsonb('data').$type<ImportedPart>().notNull()
}, t => [unique().on(t.versionId, t.id), unique().on(t.versionId, t.reportId, t.sourceRow), foreignKey({ columns: [t.versionId, t.cabinetId], foreignColumns: [cabinets.versionId, cabinets.id] }), foreignKey({ columns: [t.versionId, t.materialId], foreignColumns: [materials.versionId, materials.id] })]);
export const edgeData = pgTable('edge_data', {
  versionId: uuid('version_id').notNull(), partId: uuid('part_id').notNull(), slot: integer('slot').notNull(), material: text('material').notNull(), thickness: text('thickness').notNull(), unit: text('unit').$type<'mm'>().notNull(), side: text('side').$type<null>()
}, t => [primaryKey({ columns: [t.partId, t.slot] }), foreignKey({ columns: [t.versionId, t.partId], foreignColumns: [parts.versionId, parts.id] })]);

// One immutable document per source revision. Nested staging records are inserted atomically;
// no partially populated snapshot or catalog master is exposed.
export const librarySnapshots = pgTable('library_snapshots', {
  id: id(), category: text('category').$type<LibraryCategory>().notNull(), filename: text('filename').notNull(),
  hash: text('hash').notNull(), size: integer('size').notNull(), parserVersion: text('parser_version').notNull(),
  objectKey: text('object_key').notNull().unique(), objectVersion: text('object_version'),
  status: text('status').$type<LibraryResult['status']>().notNull(), recordCount: integer('record_count').notNull(),
  result: jsonb('result').$type<LibraryResult>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.category, t.hash, t.parserVersion)]);
export const libraryMatches = pgTable('library_match_reports', {
  id: id(), modelId: uuid('model_id').references(() => technicalModels.id).notNull(),
  snapshotIds: jsonb('snapshot_ids').$type<string[]>().notNull(), matcherVersion: text('matcher_version').notNull(),
  inputKey: text('input_key').notNull(), results: jsonb('results').$type<MaterialMatch[]>().notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.modelId, t.inputKey, t.matcherVersion)]);

export const libraryActivations = pgTable('library_activations', {
  id: id(), sequence: serial('sequence').notNull().unique(), category: text('category').$type<LibraryCategory>().notNull(),
  snapshotId: uuid('snapshot_id').references(() => librarySnapshots.id), reason: text('reason').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
});
export const materialMasters = pgTable('material_masters', {
  id: id(), category: text('category').$type<LibraryCategory>().notNull(), name: text('name').notNull(), thickness: text('thickness').notNull(), unit: text('unit').$type<'mm'>().notNull(),
  snapshotId: uuid('snapshot_id').references(() => librarySnapshots.id).notNull(), recordId: uuid('record_id').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.snapshotId, t.recordId)]);
export const materialResolutions = pgTable('material_resolution_reports', {
  id: id(), modelId: uuid('model_id').references(() => technicalModels.id).notNull(), inputKey: text('input_key').notNull(), resolverVersion: text('resolver_version').notNull(),
  snapshots: jsonb('snapshots').$type<ActiveLibrary[]>().notNull(), results: jsonb('results').$type<ResolvedMaterial[]>().notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.modelId, t.inputKey, t.resolverVersion)]);
export const bomReports = pgTable('material_requirement_reports', {
  id: id(), resolutionId: uuid('resolution_id').references(() => materialResolutions.id).notNull(), algorithmVersion: text('algorithm_version').notNull(),
  result: jsonb('result').$type<BomResult>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.resolutionId, t.algorithmVersion)]);
export const materialProfiles = pgTable('material_technical_profiles', {
  id: id(), materialMasterId: uuid('material_master_id').references(() => materialMasters.id).notNull(), policyVersion: text('policy_version').notNull(),
  result: jsonb('result').$type<MaterialProfile>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.materialMasterId, t.policyVersion)]);
export const optimizationReports = pgTable('optimization_requirement_reports', {
  id: id(), modelId: uuid('model_id').references(() => technicalModels.id).notNull(), sourceId: uuid('source_id').references(() => sources.id).notNull(),
  resolutionId: uuid('resolution_id').references(() => materialResolutions.id).notNull(), sourceHash: text('source_hash').notNull(), parserVersion: text('parser_version').notNull(),
  status: text('status').$type<'IMPORTED' | 'FAILED' | 'UNSUPPORTED'>().notNull(), result: jsonb('result').$type<OptimizationResult>(), finding: text('finding'),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.modelId, t.sourceId, t.resolutionId, t.parserVersion)]);
export const hardwareReports = pgTable('hardware_bom_reports', {
  id: id(), modelId: uuid('model_id').references(() => technicalModels.id).notNull(), versionId: uuid('version_id').references(() => versions.id).notNull(),
  sourceId: uuid('source_id').references(() => sources.id).notNull(), sourceHash: text('source_hash').notNull(), parserVersion: text('parser_version').notNull(),
  status: text('status').$type<'IMPORTED' | 'FAILED' | 'UNSUPPORTED'>().notNull(), result: jsonb('result').$type<HardwareResult>(), finding: text('finding'),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.versionId, t.sourceId, t.parserVersion)]);

export const machiningReports = pgTable('machining_bom_reports', {
  id: id(), modelId: uuid('model_id').references(() => technicalModels.id).notNull(), versionId: uuid('version_id').references(() => versions.id).notNull(),
  sourceId: uuid('source_id').references(() => sources.id).notNull(), sourceHash: text('source_hash').notNull(), parserVersion: text('parser_version').notNull(),
  status: text('status').$type<'IMPORTED' | 'FAILED' | 'UNSUPPORTED'>().notNull(), result: jsonb('result').$type<MachiningResult>(), finding: text('finding'),
  createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.versionId, t.sourceId, t.parserVersion)]);

export const costRuleVersions = pgTable('cost_rule_versions', {
  id: id(), projectId: uuid('project_id').references(() => projects.id).notNull(), sequence: serial('sequence').notNull().unique(),
  previousId: uuid('previous_id'), requestId: uuid('request_id').notNull(), payloadHash: text('payload_hash').notNull(),
  rules: jsonb('rules').$type<CostRules>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.projectId, t.requestId)]);
export const costingRuns = pgTable('costing_runs', {
  id: id(), projectId: uuid('project_id').references(() => projects.id).notNull(), modelId: uuid('model_id').references(() => technicalModels.id).notNull(),
  versionId: uuid('version_id').references(() => versions.id).notNull(), ruleVersionId: uuid('rule_version_id').references(() => costRuleVersions.id).notNull(),
  inputs: jsonb('inputs').$type<CostInputs>().notNull(), inputKey: text('input_key').notNull(), algorithmVersion: text('algorithm_version').notNull(),
  result: jsonb('result').$type<CostResult>().notNull(), createdBy: uuid('created_by').references(() => users.id).notNull(), createdAt: created()
}, t => [unique().on(t.modelId, t.ruleVersionId, t.inputKey, t.algorithmVersion)]);
