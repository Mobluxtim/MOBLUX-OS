# MOBLUX OS — Decision Log

Purpose: preserve important decisions across sessions/computers. CONFIRMED means explicitly required by the owner or cumulative specifications, not implemented. PROPOSED means recommended for review. All entries dated 2026-09-29. Preserve superseded entries and rationale in future updates.

| ID / status | Decision/source | Rationale | Consequences and alternatives |
| --- | --- | --- | --- |
| D01 CONFIRMED | Documentation before implementation; owner requires explicit architecture approval | Review and preserve context before coding | No code/dependencies now. Initial scaffold deferred stack selection; specifications supply preferred direction but library choices remain proposed |
| D02 CONFIRMED | Modular monolith with boundaries (MASTER §3) | Broad workflow without premature distributed operations | One domain codebase; microservices require documented necessity |
| D03 CONFIRMED | Canonical Project ID (MASTER §2) | Lifecycle traceability | No disconnected project copies or filesystem identity |
| D04 CONFIRMED | Immutable versions/exact approvals and separate ProductionRelease (MASTER §6/9; BUSINESS §3–4) | Prevent later changes modifying approved manufacturing | Release gate/evidence mandatory; controlled override needs reason/actor/time/audit |
| D05 CONFIRMED | PolyBoard geometry authority, adapters and source provenance (MASTER §4–5/32; BUSINESS §5) | Avoid CAD recreation/manual re-entry | Real mappings require samples; PDF/AI output cannot replace structured manufacturing geometry |
| D06 CONFIRMED | PostgreSQL and S3-compatible cloud storage with access/versioning/backups (BUSINESS §19–20) | Separate data relationships from files and preserve history | Virtual folders are views; recovery must coordinate database and objects |
| D07 CONFIRMED | RBAC/granular user permissions, backend enforcement, customer isolation (MASTER §7–8) | Different actors need different capabilities and fields | Roles are configurable templates; signed downloads also require scope checks |
| D08 CONFIRMED | Generic suppliers/providers/adapters and procurement modes (MASTER §13/17/19–20; BUSINESS §6–9) | Suppliers and routing change | No supplier-specific branches or single forced stock strategy; auto-send explicitly configured |
| D09 CONFIRMED | Separate assembly, QC, installation and acceptance (BUSINESS §12–15) | Independent evidence and defect traceability | Customer issues keep project open; different-person requirement remains Q10 |
| D10 CONFIRMED | Configurable payment milestones and two costing models (BUSINESS §10/16) | Avoid fixed payment/markup assumptions | Version assumptions; defer undefined formulas/gates; warranty independent of reviews |
| D11 CONFIRMED | Append-only audit and controlled AI actions (MASTER §21–22) | Trace high-impact changes | AI invokes ordinary authorized commands and cannot generate authoritative manufacturing geometry |
| D12 CONFIRMED | Simple station UX and separate Production Board (MASTER §15; BUSINESS §21/24) | Operators need task context | Administrative complexity stays in administrative screens |
| D13 PROPOSED | React/Next.js with TypeScript API/worker in one repository (MASTER §27 preferred direction) | Follow established technical preference with clear ownership | Entry points are not microservices; ORM/framework/auth still require technical ADR |
| D14 PROPOSED | Transactional outbox and idempotent consumers; PostgreSQL-backed durable jobs | Avoid lost effects with modest infrastructure | At-least-once delivery needs deduplication/reconciliation; no full event sourcing; Redis only if justified |
| D15 PROPOSED | Immutable file revisions/manifests and isolated GLB/glTF conversion | Protect provenance and contain untrusted processing | Converter selected after sample spike; preview remains distinct from manufacturing source |
| D16 PROPOSED | Scoped default-deny grants and explicit user-deny precedence | Explainable restrictive effective access | Matrix needs owner review; admin does not impersonate customer consent |
| D17 PROPOSED mechanics; owner semantics CONFIRMED in D20–D24 | Separate design, commercial, payment and execution state projections | Represent cumulative workflow without one misleading status | Originally flagged Q1/Q2/Q4/Q5 as unresolved. That assessment is superseded by D20–D24; implementation mechanics remain proposed |
| D18 PROPOSED | Portable Docker development and cloud web/API/worker deployment | Reproducible work on multiple computers | No provider commitment; secrets external to Git; recovery/region remains Q9 |
| D19 PROPOSED mechanics; artifact references CONFIRMED in D21 | Versioned commercial evidence, requirement allocations and stock movements | Preserve history as current master data changes | Original Q2 deferral is superseded by D21. Implement incrementally; amendment policy Q7 remains deferred. Mandatory release linkage for every reservation is superseded by D23 |

## Owner clarification — 2026-09-29

These decisions resolve Q1–Q5 without modifying the authoritative source files. They supersede earlier planning interpretations, not the cumulative product requirements.

| ID / status | Owner decision | Rationale | Consequences |
| --- | --- | --- | --- |
| D20 CONFIRMED (Q1) | First-slice APPROVED means customer approval of one exact immutable ProjectVersion; ProductionRelease is separate production authorization | Prevent customer approval being mistaken for manufacturing permission | Preserve exact version consent; no automatic release or inherited approval of newer versions |
| D21 CONFIRMED (Q2) | Documents may exist at Project level; version-sensitive commercial/approval records explicitly reference ProjectVersion; QuotationRevision references the version it prices; ApprovalEvent preserves exact references/snapshots, never implicit latest | Permit evolving project records while retaining immutable design and evidence | Later linked records do not rewrite frozen design or previous consent; historical approvals remain reconstructable |
| D22 CONFIRMED (Q3) | Real exports do not block architecture or initial framework; they block implementation/validation of the first real PolyBoard adapter | Separate framework progress from unverified vendor compatibility | Define contracts and explicitly synthetic fixtures without inventing PolyBoard mappings; mappings remain unresolved until samples |
| D23 CONFIRMED (Q4) | Authorized preliminary procurement/reservation may precede ProductionRelease; financially consequential actions require permission and audit | Permit early commitments without conflating them with production authorization | Release reference may be absent; retain project/source basis, authorization and audit; later allocation preserves preliminary history. Detailed procurement rules remain deferred |
| D24 CONFIRMED (Q5) | Release payment condition is project-configured through PaymentPlan/PaymentMilestone; never fixed at 50% | Support common advance practice and differing commercial agreements | Approximately 50% is descriptive only; support 70/30, 40/40/20 and custom milestones. Freeze gate configuration/evidence and validate against circular prerequisites |
| D25 PROPOSED technical controls | SECURITY.md defines sessions, least privilege, private files, integration isolation and security verification; PROJECT_LIFECYCLE.md consolidates confirmed distinctions and proposed transition mechanics | Complete MASTER §31 documentation and make trust boundaries reviewable | No provider/library selection or implementation authorization is implied; business invariants remain as confirmed above |

No architecture approval is inferred from these updates. Q1–Q5 are resolved decisions; real adapter samples remain a scoped implementation dependency. Remaining questions concern later implementation or deployment, not a genuinely blocking architecture conflict.
