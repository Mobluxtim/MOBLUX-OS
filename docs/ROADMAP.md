# MOBLUX OS — Roadmap

Purpose: incremental delivery plan based on both specifications. Architecture baseline v0.1 is approved. The owner has authorized the beginning of Phase 1: local authentication through customers, projects, immutable versions, pending/unmapped uploads and audit. The full Phase 1 below remains the longer-term target; customer approval and real adapters are not claimed complete by this increment.

## Phase 0 — Architecture/documentation

Review the planning documents, including PROJECT_LIFECYCLE.md and SECURITY.md, ER model, permission matrix, import contract and initial UI structure. Q1–Q5 are now owner-confirmed decisions (D20–D24). No real PolyBoard exports are required for architecture or the initial framework. Record explicit architecture approval; before substantial implementation refine wireframes and make technical ADRs for framework/ORM/auth/queue. The owner need not choose low-level library brands.

Exit: architectural approval and no silently adopted first-slice business assumptions.

## Phase 1 — First vertical slice

Authentication, users, roles/granular permissions and visual administration; customers/projects; immutable versions; private file upload; one real structured PolyBoard adapter; basic conversion/viewer; customer portal foundation; exact-version approval; append-only audit; responsive staff/customer UI. Include thin Inventory, Purchasing, Production, Invoicing and Warranty placeholders without fake business behavior.

Initial framework work may define adapter contracts and synthetic canonical fixtures without inventing PolyBoard field mappings. Real samples are a dependency only for implementation/validation of the first real adapter; distinguish a fixture demonstration from verified PolyBoard support.

Demo: admin logs in → creates customer/project → uploads exports → reviews validation → publishes V1 → inspects normalized information and representative 3D preview → shares exact approval package → customer securely authenticates → views and approves V1 → APPROVED identifies customer approval of that exact immutable version → complete audit history is visible. Publish V2 to show V1 approval is preserved. Customer approval alone never creates a ProductionRelease.

### First demonstration acceptance criteria

1. A clean checkout on another computer starts from documented setup and synthetic seed data without committed secrets or production customer data.
2. Admin creates customer/project with stable project ID; backend checks roles, granular overrides and scopes even for direct API requests.
3. A sanitized real export yields expected counts, dimensions, units and relationships through a named adapter. Raw files/hashes and record provenance remain available. Invalid inputs show actionable errors with no partial published version.
4. Publication retry is idempotent; deliberate re-import creates V2 without changing V1 data/files/approval. Concurrent version publication is safe.
5. Representative supported geometry converts and displays with orbit/zoom/pan. Source/output links remain intact; failed conversion is visible/retryable. Selection, annotations and dimensions can follow later.
6. Customer receives expiring secure access, sees only published content and records immutable approval with exact version/category/content reference, customer, time and audit metadata. Repeated submission does not duplicate the same approval operation.
7. A second customer cannot enumerate/read/approve/download the first customer's data. Supplier costs, margin, employee details and internal notes are absent from customer responses; expired/revoked access fails.
8. Audit traces creation, upload/import, version publication, sharing and approval to actor/time/project/version. Ordinary application identities cannot alter published snapshots or audit records.
9. APPROVED means customer approval of the exact immutable ProjectVersion, without implying price paid, technical validation or production release. No purchases, invoices or manufacturing commands are sent in this first demonstration.
10. Strict typing and focused unit/integration/end-to-end tests cover critical invariants, retries and denied access; staff/customer screens work on desktop and mobile with clear failure/progress states.

Mock-only imports and missing geometry may support an interim walkthrough, but do not satisfy the complete real-export/3D demonstration.

## Phase 2 — Commercial agreement and release readiness

Versioned quotations, configurable checkpoints, commercial orders, project-configured PaymentPlan/PaymentMilestone release conditions and verified payment evidence, technical validation, material requirements, release gate/snapshot and controlled override. Never hard-code a 50% advance; support 70/30, 40/40/20 and custom milestones. Apply owner decisions Q4/Q5 and resolve relevant Q7/Q10 implementation rules before these commands ship.

Exit: authorized release checks exact evidence transactionally; concurrent revisions cannot change its snapshot; missing conditions fail visibly and overrides are audited. Design approval alone cannot authorize production.

## Phase 3 — Procurement, inventory and external processing

Catalog/supplier offers and procurement modes; stock ledger/availability, authorized preliminary procurement/reservations and later release-linked allocations, purchase suggestions/drafts/approval, external processing orders and receipts. Preliminary commitments require permission/audit and never authorize manufacturing. Preserve their source history when allocating to a release; detailed rules remain deferred. Configure current provider as data. Human review is proposed initially; automatic sending needs explicit authorization/configuration. Resolve Q6 calculation semantics.

Exit: requirements trace through reservation/purchase allocation to processing and receipt; no double reservations or duplicate sends; changing external/internal routing does not redesign version geometry.

## Phase 4 — Production through warranty

Production Board and validated transitions; station jobs and CNC file access; cabinet assembly/checklists/photos; independent factory QC/defects/rework/recheck; packaging/transport; installation orders and site QC; immutable acceptance/issues; configured payment-trigger activation; feedback and warranty documents. Add QR/barcodes and timing incrementally.

Exit: release-to-installation traceability is complete; assembly is not QC, installation completion is not acceptance, and issues keep projects open. Public reviews never control warranty rights. Operators work in simple task screens.

## Phase 5 — Costing and broader ERP

Compare configurable markup pricing with actual costs using versioned assumptions and authorized margin visibility. Add labour, external processing, transport, waste, overhead and other specified cost categories as reliable inputs become available. Agree calculation semantics before automation. Expand invoicing/payment/notification integrations, reconciliation and reporting. Add access-scoped AI suggestions only after underlying commands and controls are dependable.

Exit: cost comparisons explain inputs without double-counting external operations; provider retries reconcile safely; country-specific accounting remains at its boundary; AI cannot bypass financial/purchasing/manufacturing authorization.

## Live readiness

Before live data, review grants, hosting/retention/recovery, harden auth/uploads, test coordinated database/object restore and migrations, and document incidents/reconciliation. Later operational assumptions require real examples, not invented rules to complete screens. Microservices require an evidence-backed decision.

## CSV adapter increment

The first real CSV profiles now extract the confirmed fields described in POLYBOARD_CSV_PROFILE.md. This completes partial structured staging only, not the full Phase 1 publication/3D/approval workflow. Resolve the scoped export questions before manufacturing calculations; implement authorized publication into a new immutable version before presenting staging as published design data.
