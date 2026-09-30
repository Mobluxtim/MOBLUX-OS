# MOBLUX OS — Architecture

Status: architecture baseline v0.1 APPROVED by the owner, 2026-09-29. MASTER_SPEC.md v0.1 and BUSINESS_FLOW.md v0.2 are cumulative authority. The owner authorized the bounded first implementation increment recorded in DECISIONS.md D26–D29; later roadmap features remain deferred.

## Specification review

Reviewed both specifications before editing. The addendum explicitly adds a separate ProductionRelease and gate; it does not replace the master. External cutting/edge banding is an initial provider configuration. PostgreSQL and S3-compatible storage are explicit in the addendum and consistent with the master's preferred direction.

Owner decisions Q1–Q5 clarify the earlier tensions; see D20–D24 in DECISIONS.md. APPROVED means customer approval of one exact immutable ProjectVersion, never production authorization. Version-sensitive commercial/approval evidence uses explicit references. Authorized preliminary procurement is permitted before release. Release payment conditions are project-configured. Real exports block only implementation/validation of the first real adapter, not architecture or the initial framework. No genuinely blocking architecture question remains; later implementation questions remain in OPEN_QUESTIONS.md.

## Proposed repository architecture

Target structure; create runtime entry points only when used. The first increment creates web and API plus shared contracts/configuration/infrastructure/domain modules. A worker is deferred until real parsing/conversion or delivery jobs exist; pending/unmapped assessment is immediate and does not pretend to parse sources.

```text
apps/
  web/                 Next.js/React staff, customer and station interfaces
  api/                 TypeScript HTTP entry point and composition root
  worker/              Background entry point using the same domain modules
packages/
  modules/             Domain/application modules with explicit ownership
  contracts/           Validated API schemas and public event contracts
  infrastructure/      Database, storage, queue and provider adapters
  ui/                  Shared accessible controls
  configuration/       Typed environment configuration
database/              Migrations and synthetic seeds
tests/                 Integration and critical end-to-end workflows
infra/                 Portable Docker/deployment definitions
docs/                  Requirements, decisions and operating guidance
```

One repository, one domain codebase and one PostgreSQL database form a modular monolith. API and worker are entry points, not independent business microservices. Follow the preferred strict TypeScript, React/Next.js, typed API and Docker direction. Backend framework, strongly typed ORM, authentication library and queue library remain technical proposals to select through ADRs before scaffolding. Three.js/React Three Fiber is the preferred viewer direction. Redis is optional when justified; no broker cluster, service mesh, Kubernetes or general workflow engine is proposed for MVP.

## Module boundaries

| Owner | Responsibilities and master modules covered |
| --- | --- |
| Identity/access | Identity & Security, Users, Roles & Permissions; sessions, role templates, overrides and scope |
| Customers | Customers, contacts and explicit project/customer access associations |
| Projects/approvals | Project identity, immutable versions, design inputs, technical validation, Project Approvals |
| Import | PolyBoard Import Engine, attempts, staging, adapters and provenance |
| Catalog | Product/Material Master Data, units, suppliers, supplier offers and procurement modes |
| Assets/documents | Documents, 3D Model Management, CNC/Manufacturing Files; immutable bytes and manifests |
| Commercial | Quotations, commercial Orders, costing comparisons and agreed payment-plan terms |
| Inventory | Stock movements, availability, authorized preliminary reservations and release-linked allocations |
| Purchasing | Requirements planning, purchase approvals/orders and receipts |
| Production | ProductionRelease gate/snapshot, production orders, operations, providers, external processing and timing |
| Assembly/quality | Cabinet assembly evidence; independent Quality Control, defects, rework/recheck |
| Installation/after-sales | Installation orders, site QC, acceptance/issues, feedback and Warranty |
| Finance integrations | Payments, allocations, reconciliation and Invoicing Integration references |
| Communications | Notifications and provider delivery attempts |
| Audit/automation | Audit & Event Log; AI Assistant invokes ordinary authorized commands |
| Portal/administration | Client Portal composes restricted views; Administration configures owning modules; neither duplicates domain records |

These can be module folders initially. Only an owner writes its tables. Consumers call application services or use public contracts. Shared-database foreign keys are permitted. An application use case coordinates explicit cross-module transactions, especially release creation. Avoid a shared package containing all business logic.

## Frontend/backend and initial UI structure

Frontend owns presentation, forms, progress, accessible validation and viewer interactions. Backend owns authoritative validation, authorization, transitions, calculations and snapshots. Hiding controls is not enforcement.

Initial staff wireframe: project list → header (ID, customer, version, status) → Overview, Imported data, Files/3D, Approvals, Audit. Upload shows progress and actionable validation before publication. Customer view shows only explicitly published version data and approval actions. Later Production Board is separate from Projects. Station screens show assigned work, large start/complete/issue controls and relevant cabinet/part files, with minimal text and clicks. ERP administration and costs stay outside station screens. QR/barcode identifiers resolve through authorization and never confer access.

## Database, object storage and jobs

PostgreSQL holds structured relationships and state; use migrations, constraints, transactional commands, unit-aware quantities and exact decimal money with currency. S3-compatible cloud storage holds private immutable file revisions, with database metadata for hash, size, type, ownership and source. Date/project folders are views, not database identities. Enable object versioning and coordinated database/object backups; retention, region and recovery targets require Q9 before live data.

Upload: authorize intent → bounded private upload → checksum/type/security validation → finalized metadata → queued import/conversion. Database commits cannot atomically upload bytes; publish only after required source objects are verified. Abandoned objects require an explicit cleanup policy. Never replace bytes behind an approved reference.

Propose a durable PostgreSQL-backed queue initially to limit infrastructure, subject to library evaluation. Imports, conversion, notifications and document generation have bounded concurrency, resource/time limits, retries, deduplication and visible terminal failure. Conversion runs in an isolated subprocess/container without application credentials or unnecessary network access; this is not a new business service. Structured import may succeed while conversion fails, but required preview-dependent approval remains unavailable until its preview exists.

## Internal events

Use synchronous transactional application services for immediate authorization and invariants. Persist domain changes, required audit and outbox events in one database transaction. Dispatch asynchronously with at-least-once delivery; consumers track event IDs and make effects idempotent. Provider timeouts require reconciliation instead of blind resending.

Proposed events: ProjectVersionPublished, ApprovalRecorded, ProductionReleased, PurchaseApproved, QCRecorded, InstallationCompleted, CustomerAcceptanceRecorded, PaymentRecorded. Envelope includes ID, type/schema version, occurrence time, actor/service, project/version/release references, correlation ID and minimal safe payload. Event names do not establish unapproved business transitions. Audit is durable evidence; outbox and job records track delivery. This is not full event sourcing. Release gates never rely on stale dashboard projections.

## Integration boundaries

- PolyBoard remains manufacturing geometry authority. Adapters normalize exports; no CAD recreation, nesting engine, postprocessor or direct CNC execution in MVP.
- 3DS/3D DXF conversion creates derived GLB/glTF with source/converter provenance. Verify scale, fidelity and object mapping with samples. AI renders are separate assets, never manufacturing inputs.
- Suppliers and ProductionProviders are data. Holver/Hettich must not appear as branches in domain rules. Internal/external operation routing can change without redesigning project geometry.
- Email, SMS, WhatsApp, payment and accounting providers use adapters. Authenticate callbacks, deduplicate, reconcile and audit effects. External accounting owns statutory invoice behavior; core owns customers, commercial values and external references.
- AI proposals use access-filtered inputs and ordinary command authorization. Money, purchasing, approval and manufacturing actions require validation/approval controls; model output grants no authority.

## Lifecycle and immutable boundaries

Project is enduring identity. Import staging may change before publication; a published ProjectVersion freezes design data and asset references. Design corrections create another version. Documents may belong to Project; version-sensitive commercial and approval records explicitly identify ProjectVersion. QuotationRevision identifies the version for which it was prepared. Later records can reference that version without rewriting its frozen design or earlier evidence. ApprovalEvent preserves exact approved references/snapshots, never an implicit latest version. APPROVED in the first slice means this exact-version customer approval only.

Authorized preliminary procurement/reservation may occur before ProductionRelease. Keep its project/source references, authorizing actor and audit evidence explicit; a release reference may be absent until a later authorized allocation. Neither a purchase nor a reservation authorizes production. Later allocation must preserve the original preliminary history, not silently relabel it. Detailed procurement/amendment rules remain deferred (Q6/Q7).

ProductionRelease separately freezes one source version, manufacturing manifest, requirement revision and gate evidence. Default gate: design approved, proposal approved, project-configured payment condition satisfied, technical validation complete, material requirements generated, authorized releaser. PaymentPlan/PaymentMilestone define the project's payment condition; never hard-code 50%. An advance often approximately 50% is current practice, not a required default: 70/30, 40/40/20 and custom milestones remain supported. Gate evidence records the exact plan/milestone configuration and satisfaction evidence. Reject circular configuration that makes a release-triggered milestone a prerequisite for that same release. Controlled administrator override requires reason, actor, timestamp, each bypassed check and audit. It cannot waive identity, authorization, referential integrity or immutability. Release creation must remain correct under concurrent revisions.

Keep design approval, commercial approval, payment, material and execution states distinct. Validate transitions rather than accepting arbitrary strings. Assembly completion is not QC approval; installation completion, installation QC, acceptance and commercial completion remain separate. Customer issues keep the project open. Exact release replacement/closure policy remains Q7.

## Portable development and deployment

Propose Docker-managed local PostgreSQL/S3-compatible development storage and shared API/worker builds. Cloud deployment uses TLS and private database/storage access. After implementation approval, commit reproducible setup, lockfiles, migrations and sanitized environment templates; secrets and production customer data never enter Git. Production state lives in cloud services, not a developer checkout. No machine-specific paths or Git configuration changes are needed.

CI should enforce types, focused module boundaries, migrations and tests for critical invariants. Structured logs carry request/job correlation and redact secrets. Monitor failed jobs, integration discrepancies and backup failures. Test database/object restoration together before live production use.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Unknown exports/units/IDs | Real samples, explicit profiles, preserved source and blocking ambiguous manufacturing validation |
| Wrong revision manufactured | Immutable release manifests, exact references and transactional gate evidence |
| Customer/cost leakage | Safe response schemas, scoped queries/downloads and negative authorization tests |
| Duplicate purchases/payments | Idempotency, approval evidence, delivery tracking and reconciliation |
| Stock over-allocation | Transactional reservations and concurrency tests |
| Malicious/large files | Private quarantine, limits and isolated conversion; no uploaded executable runs |
| Conversion loses identity/scale | Sample validation and mapping-quality flags; preview never replaces source |
| Invented costing rules | Versioned configurable assumptions; defer calculations until agreed |
| Lost history/files | Versioned objects, coordinated recovery testing and retention decisions |
| Coupled monolith | Single-writer ownership and narrow contracts |
| Overcomplicated shop floor | Role-specific task screens and operator walkthroughs |

PROJECT_LIFECYCLE.md details lifecycle distinctions and transition evidence. SECURITY.md defines security architecture alongside PERMISSIONS.md. These fulfill MASTER §31. Implementation is approved for the current bounded increment; see IMPLEMENTATION_REPORT.md for actual coverage and limitations.

## CSV staging implementation

The owner subsequently authorized real CSV adapters. The imports module now stores append-only csv_import_attempts with a source foreign key, profile version, actor/time, request UUID and normalized review result. See POLYBOARD_CSV_PROFILE.md and D30–D32. This is bounded synchronous text extraction, not conversion or publication: no durable background effect exists yet. The next publishing increment must create a new ProjectVersion, never alter one of the current snapshots.
