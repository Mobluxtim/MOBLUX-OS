# MOBLUX OS — First Increment Implementation Report

Architecture baseline v0.1; initial verification completed 2026-09-29. The later owner-authorized CSV increment and final verification are recorded at the end of this report (2026-09-30). This delivers the owner-authorized beginning of the first vertical slice, not every capability in the longer-term Phase 1 roadmap.

## Implemented

Responsive staff workspace with sidebar, top bar, dashboard, customers, projects, documents and read-only settings. Production, Purchasing and Inventory show Coming later. Development administrator authentication supports customer creation/list/detail, project creation/list/detail, immutable numbered versions, exact-version source upload/download, pending/unmapped adapter assessments and project activity history. Counts and records come from persistence, not UI fixtures.

Project, immutable ProjectVersion, customer approval and ProductionRelease remain distinct. Creating a version or uploading a file never approves a design or authorizes manufacturing. Approval and release action endpoints are intentionally absent. Uploads reference an exact version without modifying its frozen snapshot.

## Structure and persistence

- apps/web: Next.js, React, TypeScript staff UI.
- apps/api: Fastify HTTP application.
- packages/modules: identity, customers, projects, imports and audit boundaries within one modular monolith.
- packages/contracts, configuration and infrastructure: validated inputs/configuration, PostgreSQL and S3 adapters.
- database: Drizzle schema, migration metadata and two SQL migrations, including immutable-row triggers.
- scripts: private environment generation, infrastructure download/start/stop, migration, seed and application runners.
- tests: unit, real-service integration and browser coverage.

Twelve tables: users, roles, role_grants, user_roles, user_overrides, sessions, customers, projects, project_versions, source_files, import_attempts and audit_events. Foreign keys preserve customer/project/version ancestry. Transaction locks serialize version numbering; request identifiers support retries. Restricted application credentials and database triggers protect immutable records. Mutation metadata and audit records share transactions.

Real PostgreSQL 17 and private, versioned S3-compatible RustFS storage run locally. The Windows helper persists data under ignored .local. Docker Compose is an alternative. No microservices, message broker or worker are needed for the present synchronous pending assessment. Source bytes, hashes and object versions are preserved; no PolyBoard fields are inferred.

## Dependencies installed

Runtime: Next 16.3.7, React/React DOM 19.3.0, Fastify 5.12.5, cookie 11.1.2, multipart 10.1.2, rate-limit 11.2.0, Drizzle ORM 0.45.3, pg 8.23.0, AWS S3 SDK 3.1141.0, Zod 4.6.5 and lucide-react 1.48.0.

Development: TypeScript 5.9.3, tsx 4.23.15, ESLint/@eslint/js 9.39.5, typescript-eslint 8.70.1, Drizzle Kit 0.31.11, Playwright 1.63.0, embedded-postgres 17.6.0-beta.15 and Node/React/pg type packages. Exact versions and transitive dependencies are in package.json and pnpm-lock.yaml; pnpm is pinned to 11.25.0. RustFS 1.0.0 is downloaded separately with a pinned archive checksum. No credentials are committed.

## Verification results

| Check | Result |
| --- | --- |
| Root/API and frontend TypeScript checks | Passed |
| ESLint | Passed |
| Unit suite | 5 tests passed |
| PostgreSQL/S3 integration suite | 4 subtests plus parent passed (5 reported) |
| API and Next production build | Passed, including final build after UI/configuration cleanup |
| Chrome browser workflow | 1 end-to-end scenario passed |
| Frozen lockfile installation | Passed |
| Git whitespace check | Passed; only Windows line-ending conversion warnings |
| Private local artifacts ignored | Confirmed |
| Authoritative source specifications | Unchanged, SHA-256 checked |

Integration verified authentication/origin rejection, cookie protection, permission denies, expired sessions, concurrent/idempotent versions, immutable-row protection, ancestry checks, upload retry behavior, original download bytes and audit linkage. Browser verification covered sign-in, customer creation/detail, project creation/detail, initial version, upload status, download, activity, refresh persistence, mobile navigation at 390px and logout. No page JavaScript errors occurred; mobile horizontal overflow assertion passed. Desktop/mobile screenshots were inspected. A subsequent sidebar scrolling fix and removal of the development indicator were included in the final successful build; the already-passed browser scenario was not rerun.

Docker Compose and public production deployment were not runtime-tested. Screenshots and synthetic [TEST]/[DEMO] records are local verification artifacts, not business seed data.

## Exact local commands

Install Node.js 24 with PATH enabled. In PowerShell, install the package manager once:

```powershell
npm install --global pnpm@11.25.0
```

First terminal, first-time setup:

```powershell
cd C:\Moblux-OS
pnpm install --frozen-lockfile
pnpm setup
pnpm infra:download
pnpm infra
```

Keep it open. Second terminal:

```powershell
cd C:\Moblux-OS
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 and enter DEV_LOGIN_CODE from your private .env file. Setup preserves an existing .env. On later starts only pnpm infra and pnpm dev are necessary, in separate terminals. If PowerShell blocks shims, use pnpm.cmd. Finish saves/uploads, stop the application with Ctrl+C, then stop infrastructure with Ctrl+C. Data remains on disk. See README for Docker and troubleshooting details.

## Known limitations and next step

Development authentication only: no production identity provider, customer portal or permission-editing UI. Customer actors are denied access until explicit customer isolation/portal implementation. Private uploads are bounded and attachment-only; malware scanning, preview and geometry processing are deferred. Lists need pagination before large datasets. An object written before a failed database transaction may remain private and unreferenced; reconciliation is future work.

No real PolyBoard mappings, manufacturing validation, customer approval workflow, ProductionRelease workflow, complete procurement/inventory/production, invoicing, warranty or AI functionality. Real export samples block only the real adapter. Backups, restore validation and production hardening remain future deployment work.

Recommended next increment after owner review: secure customer access and approval bound to exact immutable version references, preserving its separation from production authorization. Obtain real PolyBoard export samples in parallel before implementing or validating that adapter.

## Files changed

The complete repository-relative manifest follows. Local .env, dependencies, service binaries/data, build output and test screenshots are ignored and excluded. No Git configuration was modified; no commit or push was performed.

### Modified existing files

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/POLYBOARD_IMPORT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

### Created files

- `.env.example`
- `apps/api/main.ts`
- `apps/api/server.ts`
- `apps/api/tsconfig.build.json`
- `apps/web/app/[[...route]]/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/components/api.ts`
- `apps/web/components/workspace.tsx`
- `apps/web/next-env.d.ts`
- `apps/web/next.config.mjs`
- `apps/web/tsconfig.json`
- `compose.yaml`
- `database/migrations/0000_flippant_mentallo.sql`
- `database/migrations/0001_immutable_records.sql`
- `database/migrations/meta/0000_snapshot.json`
- `database/migrations/meta/0001_snapshot.json`
- `database/migrations/meta/_journal.json`
- `database/schema.ts`
- `docs/IMPLEMENTATION_REPORT.md`
- `drizzle.config.ts`
- `eslint.config.mjs`
- `package.json`
- `packages/configuration/env.ts`
- `packages/contracts/index.ts`
- `packages/infrastructure/db.ts`
- `packages/infrastructure/storage.ts`
- `packages/modules/audit/service.ts`
- `packages/modules/customers/service.ts`
- `packages/modules/identity/policy.ts`
- `packages/modules/identity/session.ts`
- `packages/modules/imports/adapter.ts`
- `packages/modules/imports/service.ts`
- `packages/modules/projects/lifecycle.ts`
- `packages/modules/projects/service.ts`
- `playwright.config.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/download-storage.mjs`
- `scripts/local-infra.mjs`
- `scripts/migrate.ts`
- `scripts/run.mjs`
- `scripts/seed.ts`
- `scripts/setup.mjs`
- `tests/e2e/workflow.spec.ts`
- `tests/integration/workflow.test.ts`
- `tests/unit/invariants.test.ts`
- `tsconfig.json`


## Completed CSV increment — 2026-09-30

The first sample-derived real CSV adapter is complete within the owner's clarified scope: confirmed fields are extracted, column 10 stays raw/unmapped, and edge pairs retain material/thickness without assigned sides. Profiles cover the 7-column cabinet and 18-column cutting layouts only. Real-source results: 21 cabinet rows; 216 cutting rows totaling 280 exported units and 8 material/thickness combinations. Both real imports are saved in the existing test project with NEEDS_REVIEW status. Every original cell, downloaded byte and previous version snapshot was verified unchanged.

Implemented immutable CSV attempt staging with migration 0002, explicit profile selection, structured diagnostics, request deduplication, actor/source/row provenance, audit, cost-view enforcement, saved report history and paginated desktop/mobile review. No application dependency was added. No publication, grain/edge-orientation calculation, approval or production authorization was implemented. See POLYBOARD_CSV_PROFILE.md for evidence and OPEN_QUESTIONS.md Q13–Q15 for unresolved semantics.

Before interruption, implementation, migration, real imports, unit/integration tests and browser tests were complete. After resuming, existing uncommitted state and saved browser results were inspected, the final mobile screenshot was reviewed, final build/type/lint/unit checks passed and documentation was finalized. No passed workflow was rebuilt or duplicated.

Verification: 14 unit tests; five integration subtests plus parent; two browser scenarios, with CSV rerun passing after the mobile correction; final API/Next build; root/frontend TypeScript; ESLint; git diff --check. Source specifications retain their original hashes. Local real exports and secrets remain ignored. No commit or push.

### Files created for this CSV increment

- `packages/contracts/imports.ts`
- `packages/modules/imports/polyboard-csv.ts`
- `apps/web/components/csv-import.tsx`
- `database/migrations/0002_steep_zaladane.sql`
- `database/migrations/meta/0002_snapshot.json`
- `tests/unit/polyboard-csv.test.ts`
- `tests/e2e/csv-import.spec.ts`
- `docs/POLYBOARD_CSV_PROFILE.md`

### Existing first-increment files updated for CSV

- `database/schema.ts`
- `database/migrations/meta/_journal.json`
- `packages/contracts/index.ts`
- `packages/modules/identity/policy.ts`
- `packages/modules/imports/service.ts`
- `packages/modules/projects/service.ts`
- `apps/api/server.ts`
- `apps/web/components/workspace.tsx`
- `apps/web/app/globals.css`
- `tests/integration/workflow.test.ts`
- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/PERMISSIONS.md`
- `docs/POLYBOARD_IMPORT.md`
- `docs/SECURITY.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/IMPLEMENTATION_REPORT.md`

The preceding initial-increment manifest is historical; both increments are still uncommitted for owner review. Recommended next increment, not started: confirm the remaining export schema and implement authorized publication of reviewed import data into a new immutable ProjectVersion with an exact source/attempt manifest.

## Completed normalized technical model increment — 2026-09-30

Scope: consume existing successful CSV staging reports and build ProjectVersion → Cabinet → Part → Material → raw EdgeData. No adapter was rewritten and no CSV was reparsed for the real project. Migration 0003 adds technical_models, cabinets, parts, technical_materials and edge_data (18 total application tables). Model ownership, conservative match rules and ER relationships are in DOMAIN_MODEL.md; D33–D35 record the decisions.

The selected real reports created review V2: 21 cabinets, 216 part rows / 280 units, 8 deduplicated material-description/thickness/unit identities, and 864 raw edge slots including empty pairs. All 216 rows link to exactly one cabinet by identical source name. Ambiguous/unmapped cabinet links: zero in this pair. All part source records were compared in full with the existing cutting report; old project versions, source records and staging assessments remained unchanged. Repeating the same report pair returned the same model/version.

Column 10 stays raw on every part; every edge side is null. Dimension axes/grain conventions, commercial price meanings, catalog resolution and globally stable part numbering are not inferred. Repeated part-number warnings remain visible; they never merge rows. A part with no unique exact cabinet match retains a null cabinet ID plus explicit AMBIGUOUS/UNMAPPED status. Material deduplication is local to the immutable version and preserves original source values through part/report provenance.

UI: Project → Technical model → Cabinets / Parts / Materials / Import issues & unmapped data. Users select exact successful source reports, inspect prior normalized versions, filter parts by cabinet, paginate tables, inspect source/row/line/report/hash provenance, and inspect raw values and issues. Creating a normalized model allocates a new immutable review version; it is not customer approval, technical validation or production release. Model rows seal further child inserts; all child updates/deletes are rejected. Permissions and source-version ancestry are checked in the backend; technical responses exclude cabinet price cells.

Verification completed:

- TypeScript root/frontend: passed.
- ESLint: passed.
- Unit: 20 tests passed (six new normalizer tests).
- Real PostgreSQL/S3 integration: six subtests plus parent passed (7 reported); includes real relational constraints, sealed inserts, preservation of earlier versions, concurrent/repeated command reuse, authorization and persisted ambiguous/unmapped cases.
- Browser: three scenarios passed against the built app, including all four technical views, filtering, raw data, reload persistence, same-pair reuse and mobile no-overflow assertion. Desktop/mobile screenshots inspected.
- API/Next production build: passed.
- Real staged-report normalization: 21/216/280/8 verified; 864 edge slots retained; previous versions and all part source fields unchanged.
- git diff --check: passed; Windows line-ending notices only. Authoritative specification hashes unchanged.

No dependencies were added. No Git configuration changes, commit or push. No 3D/viewer, client portal, purchasing or production release was implemented. The increment is complete within the requested technical-review scope. Recommended next increment, not started: confirm unresolved export schema semantics and add an explicit technical-validation workflow over exact immutable versions before manufacturing calculations.

### Files created in this increment

- `apps/web/components/technical-model.tsx`
- `packages/contracts/technical-model.ts`
- `packages/modules/projects/normalize.ts`
- `packages/modules/projects/technical-model.ts`
- `database/migrations/0003_fresh_red_skull.sql`
- `database/migrations/meta/0003_snapshot.json`
- `tests/fixtures/technical-csv.ts`
- `tests/unit/technical-model.test.ts`
- `tests/e2e/technical-model.spec.ts`

### Files updated in this increment

- `apps/api/server.ts`
- `apps/web/components/workspace.tsx`
- `apps/web/app/globals.css`
- `packages/contracts/index.ts`
- `database/schema.ts`
- `database/migrations/meta/_journal.json`
- `tests/integration/workflow.test.ts`
- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/DECISIONS.md`
- `docs/SECURITY.md`
- `docs/PERMISSIONS.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/POLYBOARD_IMPORT.md`
- `docs/ROADMAP.md`
- `docs/IMPLEMENTATION_REPORT.md`

## Completed material library staging + safe matching increment — 2026-09-30

The interrupted implementation was resumed from its existing working tree. Already present: the sequential observed-format parser reproducing 372/84/43, private source snapshots, catalog contracts, separate proposal persistence, protected raw responses and the initial passing type/lint/24-unit checks. The continuation completed real PostgreSQL/S3 and permission verification, idempotent retry/audit checks, real persisted matching reports and immutable-fixture comparison, the internal review UI/browser checks, final resource-limit coverage and documentation. Existing CSV adapters and prior project versions were not rebuilt or rewritten.

### Domain and persistence

Migration 0004 adds library_snapshots and library_match_reports (20 application tables total), foreign keys, idempotency constraints and immutable triggers. Snapshot-owned records and report results are bounded immutable JSONB. Exact original bytes are private versioned S3 objects. Snapshot identity is category/hash/parser; report identity is exact model/sorted snapshot set/matcher. MaterialMaster with PanelMaterial, EdgeMaterial and BarProfileMaterial is a typed boundary, not an automatically published master catalog. Supplier products/prices remain separate and unimplemented.

Parser architecture, limits and field confidence are specified in POLYBOARD_LIBRARY_PROFILE.md. New runtime dependency: seek-bzip 2.0.0, lockfile pinned. No source files or real private data were added to tracked fixtures; tests use synthetic fixtures plus optional environment-selected local evidence.

### Actual persisted results

| Verification | Result |
| --- | --- |
| Panel records | 372 |
| Edge records | 84 |
| Bar/Profile records | 43 |
| Candidate source UUIDs | 499 distinct within these supplied files; stability across snapshots unproven |
| Panel material/thickness requests | 8/8 EXACT_UNIQUE |
| Edge material/thickness requests | 5/5 EXACT_UNIQUE |
| Real report ambiguous / missing / review-required requests | 0 / 0 / 0 |
| Existing real model | 21 cabinets / 216 part rows / 280 units / 8 normalized materials, unchanged |

Every real report candidate references its exact snapshot/record and every request retains technical-model provenance. Downloaded S3 originals equal the local input bytes; real-file SHA-256 values match the original analysis. Concurrent/repeated imports reuse snapshots; repeated/reordered matching requests reuse the same report. Full technical-model responses and existing project-version rows were compared before/after and remain unchanged.

### UI and access

Material Library at /library provides snapshots; Panel, Edge and Bar/Profile tabs; upload/reuse status; record search/pagination; provenance; corroborated/candidate fields; raw indicators; permission-gated raw inspection and original download; texture path text; immutable model selection; saved matching reports and four-status filtering. Mobile tables scroll horizontally. No texture is downloaded or fabricated. Backend checks library.view/import/raw.view/match, project/model permissions and ancestry; customer actors cannot enter staff services. Raw bytes and undocumented financial-looking fields are absent from ordinary review responses.

### Final verification

- Typecheck: passed for root/API and web.
- Lint: passed.
- Unit tests: 24 passed, zero skipped with the real library directory supplied. Coverage includes recognition/decompression, malformed/truncated/count-mismatched/trailing/oversized data, deterministic enumeration, exact hashes/IDs, full raw coverage, confidence preservation, category/deduplication boundaries and all four matching statuses.
- PostgreSQL/S3 integration: 12 reported tests passed (10 subtests + two parents), zero skipped with the existing real model supplied. Includes direct permission denies, customer denial, raw/download protection, atomic audit, immutable triggers, concurrent idempotency, persistent reports, exact ancestry and actual 499-record/13-match verification.
- Browser: all four scenarios passed across the complete run and targeted library reruns. The first library attempts exposed two overly strict test-label selectors; corrected to accessible combobox selectors. The final library scenario passed after a mobile table readability adjustment. Existing CSV, technical-model and first-slice scenarios already passed and were not needlessly rerun.
- Chrome desktop/mobile library workflow: uploads in all three categories, raw/provenance/texture inspection, duplicate reuse, synthetic REVIEW_REQUIRED/NO_MATCH, report reload persistence, actual 13 EXACT_UNIQUE results and actual model totals. No JavaScript errors; no document overflow at 390 px. Screenshots inspected. AMBIGUOUS behavior is covered by unit tests; no real ambiguous match is fabricated for the UI.
- API and Next production build: passed after final UI adjustment.
- Git whitespace check: passed; Windows line-ending notices only. MASTER_SPEC.md and BUSINESS_FLOW.md hashes unchanged. Original library hashes unchanged.

### Limits and completion

Every requirement of this bounded staging/review increment is complete. No remaining implementation blocker. This is not a general production-quality PolyBoard importer: the grammar is bounded to the observed structure, UUID persistence is unproven and only 13 thickness entries have independent corroboration. Other thicknesses remain candidates; flags, financial-looking values, grain/orientation, profile dimensions/properties and extensions remain raw. CSV column 10 and edge-side orientation remain unmapped. Matching is a proposal, not catalog publication or manufacturing authorization. No excluded supplier/ERP/costing/Methods/hardware/rendering work was started.

Recommended next increment, only after owner review: agree Q18 and add explicit authorized material-match review/acceptance with preserved audit/evidence, without changing immutable project snapshots. Gather controlled source variations for Q16/Q17 independently. No commit, push or Git configuration change was performed.

### Current increment file manifest

Created:

- apps/web/components/material-library.tsx
- packages/contracts/library.ts
- packages/modules/catalog/model.ts
- packages/modules/catalog/matching.ts
- packages/modules/catalog/service.ts
- packages/modules/imports/library-decompress.ts
- packages/modules/imports/library-evidence.ts
- packages/modules/imports/polyboard-library.ts
- database/migrations/0004_worthless_sprite.sql
- database/migrations/meta/0004_snapshot.json
- tests/fixtures/library.ts
- tests/unit/polyboard-library.test.ts
- tests/integration/library.test.ts
- tests/e2e/library.spec.ts
- docs/POLYBOARD_LIBRARY_PROFILE.md

Updated:

- AGENTS.md
- README.md
- apps/api/server.ts
- apps/web/components/workspace.tsx
- apps/web/app/globals.css
- database/schema.ts
- database/migrations/meta/_journal.json
- packages/modules/identity/policy.ts
- package.json
- pnpm-lock.yaml
- docs/ARCHITECTURE.md
- docs/DOMAIN_MODEL.md
- docs/PERMISSIONS.md
- docs/SECURITY.md
- docs/POLYBOARD_IMPORT.md
- docs/POLYBOARD_LIBRARY_ANALYSIS.md (implementation follow-up; original evidence retained)
- docs/DECISIONS.md
- docs/OPEN_QUESTIONS.md
- docs/ROADMAP.md
- docs/IMPLEMENTATION_REPORT.md

Private .env, .local evidence/service data, original reference files, generated build output and browser screenshots remain outside the tracked deliverable.

## Completed Automatic Material Resolution + Exception-Only Review — 2026-09-30

The repository was clean at the start of this increment; the prior technical model and library staging work was already committed by the owner. This increment adds automatic processing without rewriting the CSV/binary adapters or changing source confidence. All implementation changes remain uncommitted for review.

### Domain/database and flow

Migration 0005 adds three tables (23 application tables total): library_activations, material_masters and material_resolution_reports. Activations are append-only category selections/deactivations with a monotonic sequence, actor, reason and audit. Masters use MOBLUX UUIDs with corroborated source snapshot/record evidence. Resolution reports reference exact immutable models, relevant active snapshots, resolver version and complete request/candidate/link provenance. Immutable triggers protect all three tables; insert validation enforces valid active snapshots and corroborated master evidence. Runtime gains sequence usage, not update/delete access.

Creating/reusing a normalized model now resolves its materials transactionally. Opening or refreshing its project technical view automatically ensures current resolution; no manual material input or project-specific library selection exists. A shared derivation function also keeps administrative proposals consistent. Only EXACT_UNIQUE auto-links to a master; other statuses have null links and remain exceptions. Existing immutable design/version rows, customer approval and ProductionRelease semantics remain unchanged.

Masters are reused across projects for the same corroborated snapshot/record. Different source snapshots are not automatically merged by PolyBoard UUID/name because continuity is not proven. This may create distinct masters for new snapshots; it avoids inventing equivalence. Supplier/product/price/stock concepts remain absent. Detailed behavior, idempotency and permission boundaries are in MATERIAL_RESOLUTION.md and D39–D41.

### Active configuration and historical behavior

An explicit authorized administrative action selects the current snapshot per category. Uploading alone has no effect. The original verified Panel/Edge/Bar snapshots are now configured as active locally through the administrative UI. Historical snapshots stay reviewable.

New technical versions get their own reports and may reuse existing masters. New active sources take effect on the next project create/open/refresh command; there is no background mass rewrite. Relevant snapshot changes produce new reports and the read API detects stale configuration. If an exact result becomes ambiguous it loses its current automatic link; history stays intact. Repeating identical inputs reuses the report. A→B→A reuses A's original report while retaining all activation events. Bar changes do not affect projects without Bar requirements.

### UI

Project → Technical model now shows resolved/total, unresolved, ambiguous, unmatched and review-required counts, status and timestamp. Only exceptions are listed by default. Successful links, snapshot identities/hashes and historical reports remain under Resolution evidence and history. Refresh material resolution needs no material entry or library selection. The administrative Material Library screen retains detailed records/proposals and adds active selection, activation reason and history. Normal project users need project permissions, not library.activate or manual approval per exact result.

### Real data and verification

- Existing real model unchanged: 21 cabinets, 216 part rows, 280 units, 8 version-owned project materials.
- Existing library unchanged: 372 Panel / 84 Edge / 43 Bar.
- Automatic resolution: 13/13 linked, comprising 8 Panel + 5 Edge identities; 0 ambiguous, 0 unmatched, 0 review required. Thirteen includes edges; the original eight project panel materials remain eight.
- Full before/after model responses and immutable version rows compared in integration tests. Same source masters reused across separate synthetic projects. Concurrent reruns create one report/audit; historical report content unchanged across activation changes.
- Typecheck: passed (root/API and web).
- Lint: passed.
- Unit tests: 25 passed, zero skipped with real-library environment enabled. Adds deterministic automatic derivation/deduplication/source references; retains all parser confidence and matcher status tests.
- PostgreSQL/S3 integration: 18 reported tests passed (15 subtests + three parents), zero skipped with real-model environment enabled. New coverage: transactional automatic creation, active configuration, exact links, ambiguous/no-match/review-required non-links, persistent cross-project master reuse, concurrent idempotency, changed-source reports, immutable history, activation permission/category checks, project ancestry/permission and Origin checks. Existing source storage/permissions remain verified.
- API and Next production build: passed. Browser verification ran against that production build on local PostgreSQL/S3.
- Browser: all five scenarios passed across the full run and targeted reruns. Initial failures were test scoping: the library selector included new synthetic evidence fixtures, the old technical-table count included the new exception table, and the new test omitted opening the Technical model tab. Corrected selectors/navigation; all three affected scenarios passed. CSV and original first-slice scenarios had already passed.
- New browser scenario verifies administrative active selection, automatic 13/13 without project material input, no success table in the default view, same-report refresh, eight exceptions after a Panel change, restoration/reload to 13/13, history/provenance and mobile no-overflow. No JavaScript errors. Desktop/mobile screenshots inspected.
- Authoritative MASTER_SPEC.md and BUSINESS_FLOW.md retain their original hashes. Real library hashes/counts remain verified by the unchanged parser tests. Git whitespace check passed with Windows line-ending notices only.

### Completion and limits

The requested bounded increment is complete with no implementation blocker. Unknown flags, grain/orientation, financial fields, Bar profile semantics, CSV column 10 and edge sides remain raw/unmapped. No confidence upgrade was introduced. Active changes are picked up on project processing/refresh, not pushed live into already-open browser views. No manual exception override or cross-snapshot master merge is provided without an agreed evidence policy. Development authentication/production-hardening limitations remain as previously documented.

No dependencies added, no supplier integration, prices, stock, purchasing, costing, Methods/SubMethods, hardware, construction rules or rendering implemented. No commit/push or Git configuration changes. Recommended next increment after owner review: define and implement evidence-based exception resolution and cross-snapshot material identity reconciliation, preserving history and confidence boundaries.

### File manifest for automatic resolution

Created:

- apps/web/components/active-library.tsx
- apps/web/components/material-resolution.tsx
- packages/contracts/resolution.ts
- packages/modules/catalog/requests.ts
- packages/modules/catalog/resolution.ts
- database/migrations/0005_colossal_major_mapleleaf.sql
- database/migrations/meta/0005_snapshot.json
- tests/unit/material-resolution.test.ts
- tests/integration/material-resolution.test.ts
- tests/e2e/material-resolution.spec.ts
- docs/MATERIAL_RESOLUTION.md

Updated:

- AGENTS.md
- README.md
- apps/api/server.ts
- apps/web/components/material-library.tsx
- apps/web/components/technical-model.tsx
- database/schema.ts
- database/migrations/meta/_journal.json
- packages/modules/catalog/model.ts
- packages/modules/catalog/service.ts
- packages/modules/identity/policy.ts
- packages/modules/projects/technical-model.ts
- scripts/migrate.ts
- tests/e2e/library.spec.ts
- tests/e2e/technical-model.spec.ts
- docs/ARCHITECTURE.md
- docs/DOMAIN_MODEL.md
- docs/PERMISSIONS.md
- docs/SECURITY.md
- docs/POLYBOARD_IMPORT.md
- docs/POLYBOARD_LIBRARY_PROFILE.md
- docs/PROJECT_LIFECYCLE.md
- docs/DECISIONS.md
- docs/OPEN_QUESTIONS.md
- docs/ROADMAP.md
- docs/IMPLEMENTATION_REPORT.md

## Workflow-gap correction — 2026-09-30

Owner correctly identified that the previous completion report did not demonstrate a normal-user path independent of library administration, and active changes were deferred until project processing. This correction preserves the existing uncommitted increment rather than replacing it.

Automatic triggers now live in:

- Projects createTechnicalModel → resolveInTransaction: creates/reuses the immutable model and resolves its materials transactionally.
- Normal Project Overview → MaterialResolution: automatically picks the latest normalized version from the project's existing version manifest, ensures resolution and displays the result without opening another screen. Technical model retains automatic latest-model selection; changing the selector is optional historical inspection.
- Catalog activateLibrary → private resolveCore: an audited administrative activation immediately recomputes all affected existing technical models in the same transaction, including closed projects. New configurations produce immutable reports; identical configurations reuse history. No ProjectVersion is modified.
- Open project views synchronize automatically every five seconds while visible and on window focus. The refresh button is optional recovery, never a required workflow step.

The manual matcher is now collapsed under Administrative matching diagnostics (optional). Normal users never select Project, technical version, category snapshots, saved matching report or Create matching proposals. Their project shows resolved/total, actual exceptions only, active snapshot abbreviations, status and timestamp, with complete provenance/history expandable.

Verification after correction:

- 25 unit tests passed, including real source confidence/hash checks.
- 18 PostgreSQL/S3 integration results passed, zero skipped. Activation tests now assert a current persisted report exists before any subsequent project command. Normal resolution succeeds with library.view/match/activate/raw.view explicitly denied. Existing authorization, audit, immutable history and idempotency checks remain green.
- All five Chrome browser scenarios passed. The corrected automatic scenario never navigates to /library, does not select the normalized version or snapshots, and asserts no browser request to the manual library-matches or activation endpoints. It sees 13/13 directly on Project Overview, then the automatically selected Technical model. A separately simulated administrative source change produces only eight actual exceptions and the open view updates without a refresh click. Restoring the source returns to 13/13 and preserves report history.
- Actual fixture remains 8 Panel + 5 Edge auto-links, 21 cabinets / 216 rows / 280 units / 8 version-owned materials. No source mapping changed.
- Typecheck, lint, API/web production build passed. Browser tests ran against the rebuilt application. Desktop/mobile captures retained; mobile capture visually inspected and no document overflow or JavaScript errors reported.

Additional files changed by this correction: apps/web/components/workspace.tsx, apps/web/components/material-resolution.tsx, apps/web/components/material-library.tsx, packages/modules/catalog/resolution.ts, tests/e2e/material-resolution.spec.ts, tests/e2e/library.spec.ts, tests/integration/material-resolution.test.ts, docs/MATERIAL_RESOLUTION.md, docs/ARCHITECTURE.md, docs/PERMISSIONS.md, docs/DECISIONS.md, README.md and this report. No new migration/dependency required for the correction.

Workflow gap is fixed within the requested scope. Active-source propagation is synchronous and atomic for the current dataset; its duration scales with affected models. No supplier, costing, manufacturing/CAD feature or subsequent increment was started. No commit or push.

## Completed Automatic Material Requirements / BOM — 2026-09-30

This increment started from a clean repository containing the completed automatic resolution workflow. It reuses the normalized model, resolved internal master links, permissions, transaction lock and existing automatic project entry points. No adapter was re-analyzed or rewritten.

### Implemented model and automation

Migration 0006 adds immutable material_requirement_reports (24 application tables total), pinned to an exact resolution report + algorithm version. The resolution fixes model/version and complete library evidence. Database ancestry validation and immutable triggers preserve history. Calculation and audit commit in the existing transaction. Model creation, project open and active-library propagation automatically create/reuse the BOM; there is no manual BOM command/input in the UI.

The pure calculator uses exact BigInt decimal arithmetic and deterministic ordering. PANEL groups by MaterialMaster + thickness; unresolved identities remain separate with visible issues. Each source row contributes first dimension × second dimension × exported quantity / 1,000,000 m² exactly once, without multiplying cabinet quantities. Quantities and area are net exported rectangles, not validated finished contours or sheet purchase requirements. EDGE groups confirmed material/thickness pairs, retaining raw slot counts and quantity-weighted occurrences; all linear lengths remain null because orientation is unconfirmed. Full cabinet/part/source-report/row/line/hash drill-down is preserved.

### Actual real-fixture totals

Unchanged model: 21 cabinets / 216 part rows / 280 exported units / 8 normalized panel materials. Existing resolution: 8 PANEL + 5 EDGE exact internal master links.

| PANEL material (exact source name) | Thickness mm | Units | Net exported rectangular m² |
| --- | ---: | ---: | ---: |
| --W960 st7-- | 36 | 7 | 2.6176 |
| H3702 ST10 Nuc Pacific Tbac | 36 | 12 | 1.092 |
| 398 | 18 | 6 | 5.61877323 |
| zz-Glass 0080 tr nou | 22 | 1 | 0.935165 |
| H3702 ST10 Nuc Pacific Tabac | 18 | 43 | 22.30425672 |
| --W960 ST7-- | 18 | 159 | 67.219211 |
| --PFL--0110 PE(Alb) | 3 | 18 | 22.21447334 |
| H1732 ST9 Mesteacan Nisip | 18 | 34 | 4.461702 |
| **Total** | | **280** | **126.46318129** |

EDGE: 5 material/thickness groups, 744 populated source slots, 996 quantity-weighted occurrences. These counts are not metres. Linear requirements are unknown, not zero.

| EDGE material | Thickness mm | Source slots | Weighted occurrences |
| --- | ---: | ---: | ---: |
| --W960 ST7--23mm | 0.8 | 412 | 476 |
| H3702 ST10 Nuc Pacific Tabac | 0.8 | 92 | 152 |
| H1732 ST9 Mesteacan Nisip | 0.8 | 80 | 132 |
| 398 | 1 | 132 | 196 |
| H3702 ST10 Nuc Pacific Tabac DUBLAT | 0.8 | 28 | 40 |

BOM status is PARTIAL because edge lengths remain unavailable. All real material identities resolve; this does not resolve grain, slot orientation, cut-out geometry or authorize manufacturing.

### UI and verification

Normal Project Overview / Technical model automatically shows Material requirements / BOM beneath material resolution. Tables display PANEL row/unit/area aggregates, EDGE unknown-length indicators and expandable source drill-down. No library visit, snapshot selection, material entry or generation button is required. Exact version, resolution, algorithm and creation time are visible under evidence.

Checks completed:

- 10 focused unit tests passed: three new BOM tests plus upstream technical-model/derivation tests. Covers decimal precision down to 10^-18 m², exported quantities without parent multiplication, grouping, unresolved preservation, deterministic reruns, ancestry and invalid dimensions/edge data.
- Seven integration results passed (six subtests + parent) in the resolution/BOM suite against real PostgreSQL/S3, including the actual local fixture. BOM is present automatically after model creation; concurrent reruns reuse its ID/audit; separate versions and changed resolution evidence receive separate reports; old content remains unchanged. Direct UPDATE is rejected. Every real PANEL group was independently cross-checked with PostgreSQL numeric multiplication/aggregation; EDGE counts independently checked with SQL joins.
- Two relevant Chrome browser scenarios passed: automatic resolution/BOM and technical model workflow. Real BOM appears without manual trigger, contains 8 PANEL + 5 EDGE groups, exposes contribution evidence, and keeps all EDGE lengths null. Existing exception handling still works. Desktop/mobile screenshots inspected; no page errors or document overflow.
- Typecheck, lint and API/Next production build passed. No dependency added. Whitespace check passed after removing a trailing blank line. Authoritative source specifications unchanged.

Increment complete within the requested bounded technical scope. No supplier, price, stock, purchasing, waste/optimization, sheet purchase quantity, costing, margin or profit implementation. No commit/push. Recommended next increment, after owner review: confirm edge-slot-to-dimension mapping using controlled export evidence, then add exact linear EDGE requirements without guessed orientation.

### File manifest

Created: apps/web/components/material-requirements.tsx; packages/contracts/bom.ts; packages/modules/projects/bom.ts; packages/modules/projects/bom-service.ts; database/migrations/0006_wakeful_meggan.sql; database/migrations/meta/0006_snapshot.json; tests/unit/bom.test.ts; docs/MATERIAL_REQUIREMENTS.md.

Updated: AGENTS.md; README.md; apps/web/app/globals.css; apps/web/components/material-resolution.tsx; database/schema.ts; database/migrations/meta/_journal.json; packages/contracts/resolution.ts; packages/modules/catalog/resolution.ts; tests/e2e/material-resolution.spec.ts; tests/integration/material-resolution.test.ts; docs/ARCHITECTURE.md; docs/DOMAIN_MODEL.md; docs/DECISIONS.md; docs/MATERIAL_RESOLUTION.md; docs/POLYBOARD_IMPORT.md; docs/OPEN_QUESTIONS.md; docs/IMPLEMENTATION_REPORT.md.

## Material Classification & Purchasing Basis — completed 2026-10-01

Migration 0007 adds material_technical_profiles (25 application tables), unique by MaterialMaster + policy version, with append-only and source-ancestry triggers. The automatic resolver ensures profiles for new and reused reports, with one atomic audit event per profile. Existing masters, project versions, historical resolutions and BOMs are unchanged. No dependency was installed.

The PANEL taxonomy supports PAL/chipboard, MDF, PFL/HDF, plywood/multilayer, glass, other and unknown. The exact analyzed source explicitly declares PFL and Glass for two of eight real groups; status SOURCE_DECLARED is family-level evidence, not independently certified construction. Six groups remain UNKNOWN/REVIEW_REQUIRED: W960 18/36, 398 18, H1732 18, H3702 18/36. See MATERIAL_CLASSIFICATION.md for exact spellings and rationale.

The contract supports nullable evidence-bearing purchasing units, stock-sheet dimensions, thickness and technical attributes. No verified purchase unit or sheet format exists for this fixture, so none is populated. No supplier/product/price/stock/order/costing feature or metadata editing workflow was added. Unknown binary fields and edge orientations retain their prior boundaries.

UI: Material Library shows classification, reasons/provenance and explicit unverified purchase fields. The project BOM automatically shows 2/8 source-declared, 6 needing evidence review. Identity resolution remains 13/13 (8 PANEL + 5 EDGE). Existing fixture remains 21 cabinets / 216 rows / 280 units / 8 materials. Exact area remains 126.46318129 m²; display is 126.46 m². Presentation rounding never alters calculations.

Verification before interruption: typecheck, lint and API/web production build passed; migration applied; 19 focused test results passed with zero skips (11 unit results and 7 integration subtests plus their parent). These cover source/hash/identifier confidence boundaries, no name/texture inference, precision, automatic/idempotent profiles, audit, immutable history, invalid ancestry, permissions, real fixture and PostgreSQL/S3 flows.

Continuation: completed the two pending Chrome scenarios against the built local app. Library classification and the automatic project workflow both pass; no page errors or mobile document overflow. The initial project test failed only because its expected middle-dot characters had been corrupted during file encoding; corrected that test text and reran successfully. No application-code correction was needed. Desktop/mobile screenshots were generated and the project mobile capture inspected. Updated architecture/domain/decision/import/permissions/open-question documentation and this report. Prior successful integration/build work was not repeated unnecessarily.

The bounded increment is complete. Remaining limitations are evidence-related: six unresolved substrates, all purchase units/formats unknown, no classification override editor, and no certification of source-declared material construction. Recommended next increment after review: collect verified substrate/purchase-format evidence and define an audited exception-correction workflow; do not start suppliers or purchasing calculations yet. No commit or push.

New files: packages/contracts/material-profile.ts; packages/contracts/decimal-display.ts; packages/modules/catalog/classification.ts; packages/modules/catalog/material-profiles.ts; apps/web/components/material-profile.tsx; database/migrations/0007_high_wendell_rand.sql; database/migrations/meta/0007_snapshot.json; tests/unit/material-classification.test.ts; tests/e2e/material-classification.spec.ts; docs/MATERIAL_CLASSIFICATION.md.

Updated files: database/schema.ts; database/migrations/meta/_journal.json; packages/contracts/library.ts; packages/contracts/resolution.ts; packages/modules/catalog/resolution.ts; packages/modules/catalog/service.ts; apps/web/components/material-library.tsx; apps/web/components/material-requirements.tsx; apps/web/components/material-resolution.tsx; tests/integration/material-resolution.test.ts; tests/e2e/material-resolution.spec.ts; AGENTS.md; docs/ARCHITECTURE.md; docs/DOMAIN_MODEL.md; docs/DECISIONS.md; docs/OPEN_QUESTIONS.md; docs/POLYBOARD_IMPORT.md; docs/MATERIAL_REQUIREMENTS.md; docs/PERMISSIONS.md; docs/IMPLEMENTATION_REPORT.md.

## OptiCut Material Requirements Import v1 — completed 2026-10-01

Added the observed OptiCut 6.09 Romanian PDF importer, a bounded pdfjs-dist 6.3.289 extraction worker and migration 0008 (optimization_requirement_reports; 26 application tables). Reports preserve private source/hash, model/resolution, parser, actor/time, page/row provenance, status and immutable history. Normal project Overview/Technical model automatically imports eligible existing PDF sources without a manual trigger. No BOM/master/version mutation or optimization algorithm.

Real fixture persisted: 25 sheets; 137.76 m² reported sheet area; 112.05 m² OptiCut part area; 617.69 m edge; 537.04 m cutting; 18.66% waste; 259 placed; 21 failed of 280 units in 17 failed rows. Five PANEL and four EDGE groups link exactly to existing resolved masters. Per-material formats/sheets/areas/placed counts and per-map waste are available; per-material cutting is null. Failed reasons/labels remain source-truncated with null Part links. Rounded detail totals differ by 0.01 from printed project totals and are retained independently.

Verification: four focused unit tests and one real PostgreSQL/S3 integration scenario passed, zero skips. Covers safe parsing, real source hash/totals, rejection of corrupt/unsupported/inconsistent inputs, failed rows, exact/unresolved/ambiguous links, persistent import, concurrent idempotency, audit uniqueness, permissions/Origin, immutable triggers/ancestry and unchanged 21/216/280/8 model and exact BOM. Typecheck, lint and API/web production build passed. The Chrome scenario passed against the rebuilt app: automatic project display, separate net BOM, totals and material/map/edge/failure drill-down; desktop/mobile screenshots generated, desktop inspected, no page errors/mobile document overflow. Initial test failures were test setup issues (malformed fixture index, login wait and exact text locator), corrected before final successful runs.

No authoritative specification, original source or Git configuration changed; no commit/push. No supplier, price, stock, purchase order, costing, hardware/machining costing or nesting feature. Full evidence, per-material table, limits and next recommendation: OPTICUT_IMPORT.md. Bounded increment complete; next recommended work is untruncated export evidence for failed Part reconciliation, after review.

New files: packages/contracts/optimization.ts; packages/modules/imports/opticut-pdf.ts; packages/modules/imports/opticut.ts; packages/modules/projects/optimization.ts; apps/web/components/optimization.tsx; database/migrations/0008_brave_shiva.sql; database/migrations/meta/0008_snapshot.json; tests/unit/opticut.test.ts; tests/integration/opticut.test.ts; tests/e2e/opticut.spec.ts; docs/OPTICUT_IMPORT.md.

Updated: apps/api/server.ts; apps/web/components/material-resolution.tsx; database/schema.ts; database/migrations/meta/_journal.json; package.json; pnpm-lock.yaml; AGENTS.md; docs/ARCHITECTURE.md; docs/DOMAIN_MODEL.md; docs/DECISIONS.md; docs/SECURITY.md; docs/POLYBOARD_IMPORT.md; docs/MATERIAL_REQUIREMENTS.md; docs/OPEN_QUESTIONS.md; docs/IMPLEMENTATION_REPORT.md. Next.js also regenerated next-env.d.ts during production build.

## PolyBoard Hardware BOM v1 — completed 2026-10-01

Imported all ten project Feronerie rows from page 9 of the existing 288-page PolyBoard report. Sum of source quantities: 698. Verified exact examples: Hettich/Cam-DU232/Rastex15/p18/2-dowel/interior 334; Hettich/hing.Sensys-Inset/TH 52x5.5 mm 12; Hettich/hing.Sensys-Overlay/TH 52x5.5 mm 35; hole/03 78; peg-05/32-5/below/3D 144. Other five rows are retained. Names are not interpreted as suppliers, SKUs, categories or operations.

Migration 0009 adds hardware_bom_reports (27 tables), immutable and source/version-ancestry validated, idempotent by exact version/source/parser, with transactional audit. Source unit/total prices and printed total are preserved verbatim as reference-only strings and omitted from API output without project.cost.view. No existing project/version, material identity, BOM or OptiCut result changed. Shared PDF worker gained a fixed hardware profile without changing OptiCut limits; no new dependency.

Normal project Overview / Technical model automatically displays Hardware / Feronerie BOM with item count, quantities and source/reference drill-down. No manual selection/import is required. Source IDs/hashes, exact target version, parser, actor/time and PDF page/row preserve provenance. No supplier/catalog, current price, inventory, purchasing, costing or machining feature.

Passed: three hardware unit tests, one real PostgreSQL/S3 integration scenario, four OptiCut regression tests (eight results, zero skips); typecheck, lint, API/web build; Chrome automatic workflow on desktop/mobile. Tests prove retry/audit deduplication, immutable and invalid-version rejection, financial redaction on GET/POST, permission/Origin/project boundaries and unchanged model/other reports. Browser verifies all five examples, ten rows, 698 quantity, reference-price and version provenance, and coexisting Material/OptiCut sections without page errors or document overflow.

Continuation completed screenshot review and documentation only. The mobile image initially caught the sidebar animation; added a test wait for sidebar closure and repeated only that browser scenario successfully. Final desktop/mobile captures inspected. No application fix or repeated successful build/integration runs were needed. Scope complete; no blockers for the supported report profile. No commit/push. Next recommendation: evidence-led interpretation of source hardware constructs and purchase units before catalog mapping.

Created: packages/contracts/hardware.ts; packages/modules/imports/polyboard-hardware.ts; packages/modules/projects/hardware.ts; apps/web/components/hardware.tsx; database/migrations/0009_demonic_skreet.sql; database/migrations/meta/0009_snapshot.json; tests/unit/hardware.test.ts; tests/integration/hardware.test.ts; tests/e2e/hardware.spec.ts; docs/HARDWARE_BOM.md.

Updated: packages/modules/imports/opticut-pdf.ts; apps/api/server.ts; apps/web/components/material-resolution.tsx; database/schema.ts; database/migrations/meta/_journal.json; AGENTS.md; docs/ARCHITECTURE.md; docs/DOMAIN_MODEL.md; docs/DECISIONS.md; docs/PERMISSIONS.md; docs/POLYBOARD_IMPORT.md; docs/IMPLEMENTATION_REPORT.md. Next.js regenerated next-env.d.ts during build. Authoritative specifications and original source files unchanged.

## PolyBoard Machining BOM v1 — completed 2026-10-01

Added separate immutable machining reports and automatic project review (D47; full evidence in MACHINING_BOM.md). No existing application feature was restarted or rewritten. New migration 0010 was applied to local PostgreSQL; original private S3 sources remain hash verified and untouched. No dependency added, no commit/push.

Real fixture: 216 part records across 258 drawing pages; 555 drilling groups, 3467 printed drawing holes, 3774 after explicit source-quantity extension. Fifty explicit groove rows / 50671 mm. Project Frezare 48.17 m, BiselTeşit 7.41 m, Nut si Feder 36.88 m and 13.79 m retained separately. Exactly 213 Part/Cabinet links; three isolated panels unmapped. Twenty-one actual cabinets plus one unmapped PDF source group. Two coordinate/legend discrepancies remain visible. Existing model remains 21 cabinets / 216 rows / 280 units / 8 materials; previous BOM/optimization/hardware responses unchanged.

Verification: four machining unit scenarios and seven shared-PDF regression scenarios passed; one real PostgreSQL/S3 integration scenario passed; one Chrome browser scenario passed with desktop/mobile visual review. No skipped real checks. Coverage includes exact examples, continuations, raw geometry, through-depth strings, ambiguous/unmapped links, corrupt input, source hash, persistent/concurrent idempotency, unique audit, immutable/version/Part ancestry, permission/Origin denial and existing-data preservation. Typecheck, lint and API/web build passed. Test-only corrections: distinguish 22 PDF groups from 21 cabinets; narrow a page-11 locator that also matched pages 110–119. No feature expanded during verification.

Files: AGENTS.md; docs/MACHINING_BOM.md, ARCHITECTURE.md, DOMAIN_MODEL.md, POLYBOARD_IMPORT.md, SECURITY.md, DECISIONS.md, OPEN_QUESTIONS.md, IMPLEMENTATION_REPORT.md; packages/contracts/machining.ts; packages/modules/imports/polyboard-machining.ts and opticut-pdf.ts; packages/modules/projects/machining.ts; database/schema.ts, migrations/0010_moaning_lyja.sql, migrations/meta/0010_snapshot.json and _journal.json; apps/api/server.ts; apps/web/components/machining.tsx and material-resolution.tsx; tests/unit/machining.test.ts, integration/machining.test.ts and e2e/machining.spec.ts. Generated Next environment references may follow the production build; no source specifications or Git settings changed.

Increment complete within the documented observed-format scope. Remaining source discrepancies are explicit review items, not implementation blockers. Recommended next increment only after owner approval: reconcile isolated-panel IDs and the two drilling discrepancies using authoritative evidence; no CNC/costing work is authorized.

## Machining reconciliation pass — 2026-10-01

Read-only source/normalized-model reconciliation completed. Exact Part/Cabinet associations remain 213/216: three unique candidates conflict on PDF/CSV cabinet grouping, so none were force-linked. Page 22's three through-hole coordinate pairs appear on both faces, explaining six annotations; the saved count 3 remains correct. Page 249's A annotation is truncated in the source itself, so its full coordinate remains unresolved. No generic drilling face mapping was inferred; explicit groove faces remain unchanged.

No application implementation, database data, historical result, importer policy or UI changed. All totals unchanged; full result regenerated in memory equals the stored MachiningResult. One targeted PostgreSQL/S3 read-only test passed with no skip, including source integrity and before/after fingerprints of versions, parts, cabinets and all four BOM/report tables. Targeted lint passed. No browser check required because behavior is unchanged; no browser was launched. Development application listeners were stopped at completion as requested; database/storage infrastructure retained.

Changes only: docs/MACHINING_BOM.md, docs/OPEN_QUESTIONS.md, docs/IMPLEMENTATION_REPORT.md and tests/integration/machining-reconciliation.test.ts. Pre-existing apps/web/next-env.d.ts working-tree change preserved. No commit or push. Stop for owner review; complete export evidence is needed before resolving the remaining ownership/coordinate questions.

## Technical Costing Foundation v1 — completed 2026-10-01

Implemented separate project-scoped cost rule versions and immutable CostingRuns (migration 0011), exact-decimal arithmetic, input/report ancestry/idempotency/audit, financial authorization and the project costing/configuration/history section. Source BOMs and source reference prices retain their original meaning; no real rate, currency configuration or calculation run was created on the real fixture. See TECHNICAL_COSTING.md for quantity bases, rounding and scope.

Four costing unit scenarios, one focused PostgreSQL/S3 integration scenario and one Chrome desktop/mobile scenario passed. Typecheck/targeted lint passed. Prior successful unit/integration checks were retained across interruptions rather than repeated. Real source/report fingerprints remained identical. Browser continuation found previously saved test state after laptop restart; its initial-value and nested-history locator assumptions were corrected, then verification passed. No production application behavior change was needed during that continuation.

Read-only real quantities: net 126.46318129 m²; 25 optimized sheets / 137.76 m²; four edge detail rows 617.70 m versus independently rounded printed 617.69 m; cutting 537.04 m; hardware source quantity 698; drilling 3774; grooves 50.671 m; Frezare 48.17 m. Test-only examples: cutting 53.70 RON at 0.10/m, drilling 37.74 at 0.01/hole, grooves 101.35 at 2/m with per-line rounding, routing 144.51 at 3/m. These rates were never saved on the real project. All real rates remain absent; 21 OptiCut failed units prevent a complete total.

Changed/created: AGENTS.md; docs/TECHNICAL_COSTING.md, DECISIONS.md, ARCHITECTURE.md, DOMAIN_MODEL.md, PERMISSIONS.md, SECURITY.md, OPEN_QUESTIONS.md, IMPLEMENTATION_REPORT.md; packages/contracts/costing.ts; packages/modules/costing/calculator.ts, decimal.ts, service.ts; packages/modules/identity/policy.ts; database/schema.ts, migrations/0011_chubby_avengers.sql, migrations/meta/0011_snapshot.json and _journal.json; apps/api/server.ts; apps/web/components/costing.tsx and material-resolution.tsx; tests/fixtures/costing.ts, unit/costing.test.ts, integration/costing.test.ts and e2e/costing.spec.ts.

No dependency, authoritative specification or Git configuration change. No commit/push. Synthetic test records remain clearly TEST-labeled immutable history. Existing local services were left running; task browser processes closed, and the earlier task-owned alternate API is no longer present after restart. Next proposed increment only after review: configure owner-approved real rates/basis and resolve missing optimization coverage. No implementation blocker remains for this bounded foundation.

## Configurable Costing Rules v1 — completed 2026-10-02

Before continuation: additive contracts/configuration, configured calculator, rule/override service, financial capability, project forms and tests were saved. Ten costing unit tests, typecheck, targeted lint and the first integration pass had succeeded. Browser verification and final documentation remained unfinished.

Continuation completed:

- Corrected the new synthetic machining test fixture to use its actual Part/Cabinet/source ancestry; production guards were unchanged.
- Corrected Windows file encoding affecting browser compilation and finished two-decimal monetary readouts. Full stored rates/products and editable inputs retain precision.
- Fixed browser test select locators and the history locator that became stale when its count changed. No unrelated UI/BOM redesign.
- Completed D49, CONFIGURABLE_COSTING.md and relevant architecture/domain/security/permission/agent guidance. Includes ADOPT → ADAPT → BUILD and explicit future-only boundaries.

Verification:

- Existing evidence retained: 10/10 focused unit tests (six new configurable cases plus four foundation cases), including legacy replay, sheets/glass/doubling, rolls, mutually exclusive cutting, exclusive families, groove area, missing routing geometry, override immutability and workstation placeholders.
- PostgreSQL integration passed after fixture correction: configuration/run persistence, overrides with exact original and replacement values, concurrent retry reuse, changed-payload rejection, foreign/missing-line rejection, financial/override/Origin denial, DB immutability, audit and history preservation. Synthetic rates stay on the clearly marked TEST project.
- Read-only real fixture: 21 cabinets / 216 part rows / 280 units / 8 materials; 25 sheets; 3774 holes; 0.3842135 m² groove area. Current routing area lacks evidence and stays MISSING COST BASIS. Source fingerprints unchanged; no real rates/runs created.
- Chrome project browser scenario passed on desktop and 390px mobile: explicit drilling family, external cutting replacing internal, saved immutable run, audited manual amount, unchanged configured preview/rate and previous run, no page errors/document overflow. Screenshots inspected in ignored test-results. Test-only examples: known subtotal 28.38 RON; changing the synthetic hardware line from 0.38 to 5.50 produces a separate 33.50 RON known subtotal, not a complete project total.
- Typecheck, affected-file lint and git diff whitespace check passed. No unrelated suite or production build repeated; affected web compilation was exercised by browser verification.
- Task-owned alternate API PID 4468 on port 3101 was stopped after verification. Playwright closed its browser. Existing web/API/PostgreSQL/storage services were preserved.

Persistence uses existing immutable rules/runs JSON, no migration or dependency. The development seed grants cost.override; it seeds no rates. Intentionally deferred: supplier/history catalogs, hardware kit processing, remnant inventory, purchasing/orders, selling prices/margin/tax, nesting, time tracking, machine amortization and AI. Real rate definitions, layer sheet allocations and missing routing geometry need owner/source evidence; none are invented.

Files changed: AGENTS.md; apps/api/server.ts; apps/web/components/costing.tsx and cost-configuration.tsx; packages/contracts/costing.ts; packages/modules/identity/policy.ts; packages/modules/costing/{calculator,decimal,service,configuration,configured-calculator}.ts; tests/unit/configured-costing.test.ts; tests/integration/configured-costing.test.ts; tests/e2e/configured-costing.spec.ts; docs/{ARCHITECTURE,DECISIONS,DOMAIN_MODEL,PERMISSIONS,SECURITY,TECHNICAL_COSTING,CONFIGURABLE_COSTING,IMPLEMENTATION_REPORT}.md. No commit or push. Stop for owner review.

## Client Presentation Builder v1 — completed 2026-10-02

Implemented only admin-side preparation, per the owner request. Technical truth, curated presentation and future design-deliverable access remain separate. No changes to PolyBoard/BOM/optimization/hardware/machining/costing algorithms or data.

- Migration 0012: client_presentations, presentation_revisions, presentation_assets, exact version ownership, predecessor/media/reference guards, immutable UPDATE/DELETE protection. Revision content/hash/request identity, actor/time and transactional audit preserve history; stale saves fail.
- Version-specific authored title/description, rooms/sections, furniture/materials/hardware/services/notes, internal technical references, per-item visibility. No source names or quantities automatically become customer content.
- PNG/JPEG private original/display objects reuse existing S3 bucket/adapter. Bounded structural validation, CRC/markers, metadata stripping, hash-verified display, ordered image attachments, cover/caption/visibility and explicit inspiration labels. No CAD/PDF/technical-source attachment or external image fetch.
- Admin editor is Project → Client presentation. Standalone exact-revision View-as-client loads only allowlisted text/media DTO and revision-authorized images. Hidden/future-deliverable content, source references, filenames, provenance, technical quantities/geometry and financial/internal fields are absent. New versions start without a presentation.
- Staff capabilities presentation.edit and presentation.preview were added to the existing development seed; no customer login, payment/legal policy, quotation, approval, PDF or ProductionRelease implemented.

Verification completed:

1. Three focused unit/security tests passed: client DTO allowlisting/hidden parent suppression, strict input validation and image structure/metadata safety.
2. Focused PostgreSQL/S3 integration passed: originals preserved byte-for-byte, display metadata removed, upload/save idempotency, stale-write conflict, hidden image denial, cross-version/reference rejection, exact historical preview preservation, version fingerprint unchanged, immutable guards, atomic audit, Origin/session/staff/deny enforcement. No financial or source-file permission is required to see the safe projection. Synthetic TEST project only.
3. Chrome browser workflow passed on desktop and 390px mobile: edit/save, material description, included service, image reordering/cover/visibility, JPEG upload and successful private display, PNG gallery display, inspiration labels, popup preview, safe-only preview network requests, no hidden/internal text, no page errors/document overflow, empty later-version presentation. Screenshots inspected in ignored test-results/presentation-preview-{desktop,mobile}.png.
4. Typecheck, affected-file lint and git diff whitespace checks passed. No unrelated suite or expensive production build was run; browser exercised affected Next compilation. Browser-test locators were corrected for accessible textarea controls and editor re-entry after the development reload.
5. Additive migration and development seed applied successfully. No dependencies installed. Temporary API PID 18472 on port 3101 was stopped; Playwright closed its contexts. Pre-existing web/API/PostgreSQL/storage services were preserved. Restart the normal API to load new routes before manual review.

Limitations are explicit, not hidden blockers: staff preview only; raster structural checking is not full decoding/malware scanning; editors must curate prose/pixels; no future entitlement or approval decision is inferred. Older exact revision URLs remain valid to authorized staff; editor lists latest 50 revisions. Orphan private storage reconciliation remains the pre-existing upload operational limitation.

Files changed: AGENTS.md; apps/api/server.ts; apps/web/components/workspace.tsx; apps/web/components/presentation-editor.tsx; apps/web/components/presentation-preview.tsx; apps/web/app/globals.css; apps/web/app/presentation-preview/[projectId]/[versionId]/[revisionId]/page.tsx; database/schema.ts; database/migrations/0012_dark_sabra.sql and meta/{0012_snapshot,_journal}.json; packages/contracts/presentation.ts; packages/modules/identity/policy.ts; packages/modules/presentations/{service,projection,media}.ts; tests/fixtures/presentation.ts; tests/unit/presentation.test.ts; tests/integration/presentation.test.ts; tests/e2e/presentation.spec.ts; docs/{CLIENT_PRESENTATION,ARCHITECTURE,DOMAIN_MODEL,DECISIONS,PERMISSIONS,SECURITY,PROJECT_LIFECYCLE,IMPLEMENTATION_REPORT}.md.

No commit or push. Increment complete for owner review.
