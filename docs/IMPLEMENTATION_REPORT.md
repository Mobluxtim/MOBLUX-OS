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
