import { pgTable, uuid, text, timestamp, boolean, integer, serial, jsonb, unique, foreignKey, primaryKey } from 'drizzle-orm/pg-core';
import type { ActiveLibrary, ResolvedMaterial } from '../packages/contracts/resolution.js';
import type { BomResult } from '../packages/contracts/bom.js';
import type { MaterialProfile } from '../packages/contracts/material-profile.js';
import type { OptimizationResult } from '../packages/contracts/optimization.js';
import type { HardwareResult } from '../packages/contracts/hardware.js';
import type { MachiningResult } from '../packages/contracts/machining.js';
import type { CostRules, CostInputs, CostResult } from '../packages/contracts/costing.js';
import type {PresentationContent,MediaKind} from '../packages/contracts/presentation.js';
import type {QuoteContent,QuoteCalculation} from '../packages/contracts/quote.js';
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

export const clientPresentations=pgTable('client_presentations',{
 id:id(),projectId:uuid('project_id').notNull(),versionId:uuid('version_id').notNull().unique(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[foreignKey({columns:[t.projectId,t.versionId],foreignColumns:[versions.projectId,versions.id]})]);
export const presentationRevisions=pgTable('presentation_revisions',{
 id:id(),presentationId:uuid('presentation_id').references(()=>clientPresentations.id).notNull(),number:integer('number').notNull(),previousId:uuid('previous_id'),requestId:uuid('request_id').notNull(),payloadHash:text('payload_hash').notNull(),contentHash:text('content_hash').notNull(),content:jsonb('content').$type<PresentationContent>().notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[unique().on(t.presentationId,t.number),unique().on(t.presentationId,t.requestId)]);
export const presentationAssets=pgTable('presentation_assets',{
 id:id(),projectId:uuid('project_id').notNull(),versionId:uuid('version_id').notNull(),requestId:uuid('request_id').notNull(),name:text('name').notNull(),kind:text('kind').$type<MediaKind>().notNull(),provenance:text('provenance').notNull(),hash:text('hash').notNull(),displayHash:text('display_hash').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),width:integer('width').notNull(),height:integer('height').notNull(),objectKey:text('object_key').notNull().unique(),objectVersion:text('object_version'),displayKey:text('display_key').notNull().unique(),displayVersion:text('display_version'),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[foreignKey({columns:[t.projectId,t.versionId],foreignColumns:[versions.projectId,versions.id]}),unique().on(t.versionId,t.requestId)]);

export const quoteVersions=pgTable('quote_versions',{
 id:id(),projectId:uuid('project_id').notNull(),versionId:uuid('version_id').notNull(),number:integer('number').notNull(),previousId:uuid('previous_id'),presentationRevisionId:uuid('presentation_revision_id').references(()=>presentationRevisions.id),requestId:uuid('request_id').notNull(),payloadHash:text('payload_hash').notNull(),contentHash:text('content_hash').notNull(),algorithmVersion:text('algorithm_version').notNull(),content:jsonb('content').$type<QuoteContent>().notNull(),result:jsonb('result').$type<QuoteCalculation>().notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[foreignKey({columns:[t.projectId,t.versionId],foreignColumns:[versions.projectId,versions.id]}),unique().on(t.versionId,t.number),unique().on(t.versionId,t.requestId)]);

export const portalSnapshots=pgTable('portal_snapshots',{
 id:id(),projectId:uuid('project_id').references(()=>projects.id).notNull(),customerId:uuid('customer_id').references(()=>customers.id).notNull(),versionId:uuid('version_id').references(()=>versions.id).notNull(),quoteId:uuid('quote_id').references(()=>quoteVersions.id).notNull(),presentationId:uuid('presentation_id').references(()=>presentationRevisions.id).notNull(),content:jsonb('content').$type<import('../packages/contracts/portal.js').PortalSnapshot>().notNull(),contentHash:text('content_hash').notNull(),evidence:jsonb('evidence').$type<{quoteHash:string;presentationHash:string;media:{id:string;hash:string;objectVersion:string|null}[]}>().notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[unique().on(t.projectId,t.quoteId)]);
export const portalAccesses=pgTable('portal_accesses',{
 id:id(),snapshotId:uuid('snapshot_id').references(()=>portalSnapshots.id).notNull(),requestId:uuid('request_id').notNull().unique(),payloadHash:text('payload_hash').notNull(),tokenHash:text('token_hash').notNull().unique(),contactName:text('contact_name').notNull(),contactEmail:text('contact_email').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
});
export const portalRevocations=pgTable('portal_revocations',{
 accessId:uuid('access_id').primaryKey().references(()=>portalAccesses.id),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
});
export const portalSupersessions=pgTable('portal_supersessions',{
 snapshotId:uuid('snapshot_id').primaryKey().references(()=>portalSnapshots.id),replacementId:uuid('replacement_id').references(()=>portalSnapshots.id).notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
});
export const portalSessions=pgTable('portal_sessions',{
 tokenHash:text('token_hash').primaryKey(),accessId:uuid('access_id').references(()=>portalAccesses.id).notNull().unique(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),createdAt:created()
});
export const portalSessionEnds=pgTable('portal_session_ends',{
 tokenHash:text('token_hash').primaryKey().references(()=>portalSessions.tokenHash),createdAt:created()
});
export const portalActions=pgTable('portal_actions',{
 id:id(),snapshotId:uuid('snapshot_id').references(()=>portalSnapshots.id).notNull(),accessId:uuid('access_id').references(()=>portalAccesses.id).notNull(),requestId:uuid('request_id').notNull(),payloadHash:text('payload_hash').notNull(),action:text('action').$type<'APPROVE'|'REQUEST_CHANGES'>().notNull(),message:text('message'),approvedContent:jsonb('approved_content').$type<import('../packages/contracts/portal.js').PortalSnapshot>(),contentHash:text('content_hash').notNull(),createdAt:created()
},t=>[unique().on(t.accessId,t.requestId)]);

export const paymentPlans=pgTable('payment_plans',{
 id:id(),projectId:uuid('project_id').references(()=>projects.id).notNull(),versionId:uuid('version_id').references(()=>versions.id).notNull(),quoteId:uuid('quote_id').references(()=>quoteVersions.id).notNull(),number:integer('number').notNull(),previousId:uuid('previous_id'),requestId:uuid('request_id').notNull(),payloadHash:text('payload_hash').notNull(),reason:text('reason').notNull(),currency:text('currency').notNull(),quoteTotal:text('quote_total').notNull(),algorithm:text('algorithm').notNull(),milestones:jsonb('milestones').$type<import('../packages/contracts/payments.js').Milestone[]>().notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[unique().on(t.quoteId,t.number),unique().on(t.quoteId,t.requestId)]);
export const paymentReports=pgTable('payment_reports',{
 id:id(),planId:uuid('plan_id').references(()=>paymentPlans.id).notNull(),milestoneId:uuid('milestone_id').notNull(),requestId:uuid('request_id').notNull(),payloadHash:text('payload_hash').notNull(),amount:text('amount').notNull(),currency:text('currency').notNull(),paymentDate:text('payment_date').notNull(),method:text('method').notNull(),reference:text('reference').notNull(),evidenceSourceId:uuid('evidence_source_id').references(()=>sources.id),internalNote:text('internal_note').notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[unique().on(t.planId,t.requestId)]);
export const paymentEvents=pgTable('payment_events',{
 id:id(),paymentId:uuid('payment_id').references(()=>paymentReports.id).notNull(),requestId:uuid('request_id').notNull(),payloadHash:text('payload_hash').notNull(),action:text('action').$type<'CONFIRMED'|'REVERSED'>().notNull(),reason:text('reason').notNull(),createdBy:uuid('created_by').references(()=>users.id).notNull(),createdAt:created()
},t=>[unique().on(t.paymentId,t.action),unique().on(t.paymentId,t.requestId)]);
