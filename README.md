# MOBLUX OS

Furniture manufacturing workspace — first implementation increment, approved architecture baseline v0.1.

Runnable locally: development sign-in → customer → project → immutable version → original source upload → pending/unmapped import → audit history. Production, Purchasing and Inventory show honest “Coming later” screens. Two sample-derived CSV profiles now extract confirmed fields into review staging. Customer approval, production release and import publication are not implemented yet.

## Requirements

- **Node.js 24 LTS**, installed from [nodejs.org](https://nodejs.org/) with PATH enabled. Open a new PowerShell window after installation.
- Install the pinned package manager once: `npm install --global pnpm@11.25.0`.
- Windows 10/11 x64 for the portable setup below. macOS/Linux can use Docker Compose.
- Internet for initial dependencies/storage download. Chrome is needed only for the browser test.
- Free local ports: 3000 (web), 3001 (API), 54329 (PostgreSQL), 9000 (S3 storage).

Use `pnpm.cmd` if PowerShell blocks the script shim; do not disable Windows security settings globally. No global PostgreSQL installation or Windows service is required for the portable path.

## First-time setup — Windows without Docker

Open PowerShell in the repository:

```powershell
cd C:\Moblux-OS
pnpm install --frozen-lockfile
pnpm setup
pnpm infra:download
pnpm infra
```

`setup` creates private `.env` credentials randomly and never overwrites an existing file. `.env.example` describes the variables; its placeholders are not usable credentials. `infra:download` downloads the official RustFS 1.0.0 Windows archive, checks its pinned SHA-256, and extracts it under ignored `.local/bin`. The PostgreSQL dependency provides real PostgreSQL 17 binaries.

Keep this first terminal open. In a **second PowerShell window**:

```powershell
cd C:\Moblux-OS
pnpm db:migrate
pnpm db:seed
pnpm dev
```

If storage is still starting when seed runs, wait a few seconds and rerun `pnpm db:seed`. Migrations and seed can be rerun safely. Seed creates only a development administrator and private versioned bucket, not customers or projects.

Open **[http://localhost:3000](http://localhost:3000)**. Use exactly `localhost`, matching APP_ORIGIN; another browser origin is rejected for writes.

Open `.env` locally in your editor and copy the value after `DEV_LOGIN_CODE=` into the sign-in form. Do not share this file or paste it into Git/chat. The code is not hard-coded in the UI.

## Starting again

Terminal 1:

```powershell
cd C:\Moblux-OS
pnpm infra
```

Terminal 2:

```powershell
cd C:\Moblux-OS
pnpm dev
```

Data persists after shutdown. Do not regenerate credentials or delete local data. After pulling new migrations, run `pnpm db:migrate`; after dependency changes, run `pnpm install --frozen-lockfile`.

## Stopping safely

1. Finish pending uploads/saves.
2. Press **Ctrl+C in the application terminal** and wait for exit.
3. Press **Ctrl+C in the infrastructure terminal** and wait for exit. The helper requests PostgreSQL fast shutdown and preserves `.local/postgres` and `.local/objects`.
4. Do not delete `.local`, interrupt Windows during saves, or run two infrastructure instances on the same ports/data directory.

Storage logs are in `.local/storage.log`. Logs, service data and `.env` are ignored by Git. Moving a checkout to another computer does not copy its local database/files: use proper PostgreSQL and object-storage backups to transfer development records. Do not copy a running database directory. Cloud deployment/recovery remain later work.

## Docker alternative

Install and start Docker Desktop with Compose (Windows may require WSL2 and a restart). Use this **instead of** `pnpm infra`, never simultaneously:

```powershell
pnpm install --frozen-lockfile
pnpm setup
pnpm infra:docker
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Compose provides PostgreSQL and RustFS, with host ports bound to loopback. Docker uses named volumes independently of portable `.local` data. Stop the app with Ctrl+C, then `docker compose stop`. Do **not** run `docker compose down -v` unless intentionally erasing data. The Docker path is supplied but was not runtime-tested on this machine, which lacks Docker/WSL.

## Click-through guide

1. **Customers → New customer**: enter a name and optional contact details.
2. From the customer detail, choose **New project** and enter its name/brief.
3. **Versions → Create initial version**: enter a summary and save V1.
4. **Source files**: select the exact version and upload CSV, TXT, DXF, 3DS or PDF, one file up to 20 MB.
5. The unchanged source appears with a SHA-256 hash and **Pending mapping** status. Download retrieves original bytes. For CSV, open **CSV import & validation**, explicitly select the matching cabinet (7 columns) or cutting (18 columns) profile, then choose **Analyze CSV**.
6. **Activity** shows project/version creation, source preservation and CSV assessments. A CSV report shows mapped rows, unresolved fields and saved attempt history; successful extraction is **Needs review**, not manufacturing validation.
7. Create another version to see that earlier records stay intact.

An initial version freezes a design record with no normalized geometry. Subsequent uploads are separate exact-version source references; they never edit its frozen snapshot. Neither version creation nor upload grants approval or production authorization. Short `MLX-…` labels abbreviate canonical UUIDs for display; official business numbering is not configured.

## Developer commands

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

- Integration tests require running infrastructure, migrations and seed. They use real PostgreSQL/S3.
- Browser tests require the running app at localhost:3000 and Google Chrome. Tests create clearly marked `[TEST]` / `[DEMO]` synthetic records, retained with audit history. Use a development database only; do not run integration tests while someone uses the same development administrator session.
- Screenshots are written to ignored `test-results/`. Tests cover desktop/mobile navigation, upload/download and refresh persistence.
- `pnpm build` compiles API and web. Stop `pnpm dev`, then `pnpm start` serves the build with explicitly enabled local development authentication. This is **not** production deployment authorization.
- Change `database/schema.ts`, run `pnpm db:generate`, review SQL, then `pnpm db:migrate`. The second migration tracks immutable-row triggers. Never rewrite applied migrations to change a live schema.

## Structure

```text
apps/web/                 Next.js responsive staff workspace
apps/api/                 Fastify HTTP entry point
packages/contracts/       Zod inputs and typed responses
packages/configuration/   Validated local configuration
packages/infrastructure/  PostgreSQL and S3 adapters
packages/modules/         Identity, customers, projects, imports, audit
database/                Drizzle schema and versioned migrations
scripts/                 Setup, local services, migrations and seed
tests/                   Unit, real-service integration and browser tests
docs/                    Specifications, decisions and implementation report
compose.yaml             Optional Docker infrastructure
```

Web and API share one domain codebase: a modular monolith. No worker, Redis, broker or microservices are introduced for the present bounded CSV staging parser (1 MB / 5,000 rows). Larger source files can still be preserved up to 20 MB.

## Security and limitations

Local development only. A random local code creates an expiring hashed server session. Backend grants/denies are enforced. This is not a customer portal or production identity provider. Runtime database credentials cannot update/delete immutable versions, sources, import attempts or audit; triggers also protect those rows. No approval/release/purchasing action endpoints exist.

Uploads stay private, bounded and attachment-only. Only explicitly selected CSV layouts are parsed as bounded text; nothing is executed. Full malware scanning, 3D preview/conversion, other PolyBoard layouts, import publication, approval workflows, permission-editing UI, complete production/procurement/inventory, cloud backup/restore and production security hardening are deferred. Lists load all local records and will need pagination for large datasets. Never use production customer data or expose development services publicly.

See [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) for verification, dependency versions and file manifest. Both authoritative specifications remain unchanged. Nothing is automatically committed or pushed.

## Real CSV import profiles

See [POLYBOARD_CSV_PROFILE.md](docs/POLYBOARD_CSV_PROFILE.md) for the two verified positional layouts, evidence and unresolved fields. Column 10 stays raw; edge material/thickness pairs have no assigned sides. Project versions remain frozen. Select only the export profile matching your source configuration. There is no automatic schema detection or manufacturing approval. Existing CSV sources can be analyzed without uploading again.

After updating this checkout, restart the app and run `pnpm db:migrate` and `pnpm db:seed` before `pnpm dev`. Migration adds immutable CSV attempt history; seed grants the local administrator cost-view permission for price-bearing cabinet reports. No new package installation is required for this increment.

## Technical model review

After updating the checkout, stop the app, run `pnpm db:migrate`, then start it again. No new dependencies are required.

Open a project → **Technical model**. The test project already contains its normalized **V2**. Use **Cabinets**, **Parts**, **Materials**, and **Import issues / unmapped data** to inspect the model. Clicking a cabinet filters its parts. Parts retain source/report IDs, original row/line, original cells, column 10 and four raw edge slots. Tables have row pagination; wide tables scroll horizontally on mobile.

To build another model, expand **Create from CSV reports**, choose successful cabinet and cutting reports from the same original version, then select **Create review version**. Repeating the same report pair reopens the existing model. A different report pair is a separate input. Existing versions stay unchanged. Review versions are not technically validated, approved or released for production.

## PolyBoard Material Library review

For this increment stop the application, then run:

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Keep existing PostgreSQL/S3 infrastructure running. Open http://localhost:3000/library after signing in. Select Panel, Edge or Bar / Profile and upload the corresponding original .mat-boole file. Identical files reuse the snapshot. Select a snapshot to inspect records, provenance, confidence, raw indicators and texture paths; raw inspection/download requires its separate permission. No texture path is automatically opened.

Under Project material matching select a project, an immutable technical version and the intended category snapshots, then create matching proposals. Saved reports persist and expose exact, ambiguous, missing and review-required results. Proposals do not change the version or authorize manufacturing. See [the implemented profile](docs/POLYBOARD_LIBRARY_PROFILE.md).

Optional real-fixture checks use local paths/IDs supplied through the environment, never committed reference data:

```powershell
$env:POLYBOARD_LIBRARY_DIR='<local library directory>'
$env:MOBLUX_REAL_MODEL_ID='<existing technical model UUID>'
pnpm test
pnpm test:integration
pnpm test:e2e
```

Integration suites run sequentially because permission tests temporarily override the shared development administrator. Browser tests require the application running. Without these variables, optional real-fixture tests skip; synthetic tests still run. Library staging adds seek-bzip 2.0.0; earlier no-new-dependency notes describe historical increments.

## Automatic project material resolution

Stop the app, run `pnpm db:migrate` and `pnpm db:seed`, then restart with `pnpm dev` (or `pnpm build` followed by `pnpm start`). No new dependency installation is needed for this increment. Keep PostgreSQL/S3 running.

An administrator configures **Material Library → Active project libraries** once per category, selecting a successful snapshot and recording a reason. Upload alone never activates it. Opening/creating a project's technical model then derives and resolves materials automatically: no material entry or per-project snapshot selection. The project shows **Materials resolved: 13/13** for the verified real fixture with its original libraries active. Exceptions alone are listed by default; evidence/history and the detailed admin library remain accessible.

After an administrative library change, reopen the project or use **Refresh material resolution**. Previous reports and project versions stay unchanged. Missing libraries appear as review-required exceptions. See [MATERIAL_RESOLUTION.md](docs/MATERIAL_RESOLUTION.md) for exact semantics and limits.

### Workflow correction

Open a project normally: its Overview now shows automatic material resolution for the latest normalized version. Technical model also opens its latest normalized version automatically. You do not need Material Library or manual matching controls. Administrators still configure active libraries centrally; changing one immediately creates/reuses affected resolution reports, and open project views update automatically. Manual comparison controls are collapsed under Administrative matching diagnostics (optional).

## Automatic material requirements / BOM

After updating, stop the app, run `pnpm db:migrate`, then restart (`pnpm dev`, or `pnpm build` and `pnpm start`). No new dependencies or seed grants are required.

Open a project normally. Material requirements / BOM appears automatically with its current resolved technical model: PANEL units and net exported rectangular m², plus expandable Cabinet/Part/source-row evidence. EDGE rows show traceability counts and **Unknown** length until export orientation is confirmed. These are not sheet purchase quantities or costs. See [MATERIAL_REQUIREMENTS.md](docs/MATERIAL_REQUIREMENTS.md).
