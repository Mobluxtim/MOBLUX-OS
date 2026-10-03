# MOBLUX OS — Project Lifecycle

Purpose: document lifecycle boundaries and transitions under MASTER_SPEC.md, BUSINESS_FLOW.md and owner decisions Q1–Q5 (DECISIONS.md D20–D24). Product invariants below are confirmed; suggested state names and implementation mechanics remain proposals. This document does not authorize implementation.

## Distinct lifecycle concepts

Project is the enduring business identity. Its overview summarizes several separate workflows; one status must not imply all other approvals. ProjectVersion is an immutable design/manufacturing dataset. Customer approval is an immutable event about exact version/content, not permission to manufacture. Commercial approval concerns an exact QuotationRevision and its ProjectVersion. Payment conditions come from the project's PaymentPlan/PaymentMilestone. Technical validation independently establishes manufacturing readiness. ProductionRelease alone represents authorized release of a frozen manufacturing source.

Documents may be Project-level. Version-sensitive commercial/approval records explicitly reference the relevant ProjectVersion. Adding separately referenced records does not rewrite frozen design data or previously approved evidence. QuotationRevision identifies the version it prices; ApprovalEvent stores exact approved references/snapshots, never implicit latest. Changes to design require another version, without transferring previous approval automatically.

## Transitions and evidence

| Stage / transition | Required distinction and recorded evidence |
| --- | --- |
| Inquiry/input → Project | Create canonical project/customer relationship; retain measurements, sketches and architect/designer input as design input, not automatically verified manufacturing dimensions |
| Design/import staging → ProjectVersion | Validate supported input and publish immutable design/source manifest; preserve import provenance and actor/time; technical staging states do not equal business approval |
| Published version → approval requested | Present exact version and artifact revisions through scoped customer access; preserve the package being presented |
| Customer approval → APPROVED | Immutable ApprovalEvent with customer, project, exact version, category/state, timestamp and approved references/snapshots. For the first slice APPROVED means only this customer approval; no production authorization |
| Later revision → new version | Preserve old version and approval; new content requires its own applicable approval evidence. Do not redirect old approvals to current/latest |
| Final proposal → commercial approval | QuotationRevision explicitly references its ProjectVersion; approval freezes the exact commercial evidence. Customer design approval alone does not approve a later price |
| Payment condition evaluation | Evaluate the project-configured PaymentPlan/PaymentMilestone condition using explicit recorded evidence; retain configuration revision. No universal 50% advance. Approximately 50% is common practice, not a hard-coded requirement; 70/30, 40/40/20 and custom milestones remain valid structures |
| Technical validation | Authorized validation identifies exact version, manufacturing verification evidence and actor/time; design input is not manufacturing proof |
| Ready checks → ProductionRelease | Authorized atomic gate check and creation of immutable release snapshot; record source version, manufacturing files, requirement revision and gate evidence |
| Release → production work | Release-scoped operations and assignments consume the frozen source; operator progress never edits release contents. Provider routing supports external cutting/edge banding and later internal execution |
| Assembly → factory QC | Cabinet assembly completion/checklist/photos establish operator completion only. Separate QC records inspection result and defects |
| QC pass → downstream packing/transport | QC pass is distinct evidence. Detailed routing/dispatch guards remain subject to operational rules; no implicit bypass from assembly completion |
| Delivery → installation | InstallationOrder links Project and ProductionRelease, with project/room/cabinet checklists and photos; station interface remains simple |
| Installation completion → site QC/customer acceptance workflow | Installer completion and installation QC are distinct from customer acceptance; record each separately |
| Customer reports issue | Create CustomerIssue with description/photos and project/installation references; project remains open, with resolution history |
| Customer accepts installation | Create immutable CustomerAcceptance with customer, project, exact version, release, installation, date/time, acceptance reference and audit metadata |
| Acceptance → configured payment/feedback | Trigger only milestones configured for CUSTOMER_ACCEPTED; request feedback/review independently. Other payment triggers remain supported |
| Completion → warranty | Activate WarrantyRecord/documents referencing accepted version, installation, acceptance date, start and duration. Public reviews never condition warranty rights. Exact closure/payment/issue timing and warranty duration remain later policy decisions (Q7), not invented here |

## ProductionRelease gate

Default checks are: customer design approval, commercial proposal approval, configured project payment condition satisfied, technical validation completed, material requirements generated, and an authorized release actor. All evidence must identify the relevant version/proposal/configuration; a dashboard status is not sufficient.

Payment milestone triggers and release prerequisites are different concepts. Configuration must not create a cycle where a milestone triggered by this release must be satisfied to create the same release. A future milestone is not automatically an advance condition. Do not infer satisfaction from a generic project APPROVED flag or an unverified customer payment claim.

Controlled administrator override requires explicit permission, reason, actor, timestamp, identification of bypassed checks and append-only audit. It is not fabricated customer consent and cannot waive identity, authorization, reference consistency or immutability. Later project revisions cannot alter a release. Partial releases, replacement/cancellation and reconciliation of active commitments remain Q7.

## Preliminary procurement is a separate path

Authorized preliminary purchasing/reservation may occur before ProductionRelease. Record project/source basis, capability check, actor and audit; financially consequential actions require appropriate permission and audit. A preliminary reservation has no required release reference. Purchasing or reserving never creates manufacturing authorization.

Later release allocation must preserve original preliminary evidence and avoid double commitment. Detailed sizing, thresholds, approval routing, cancellation and allocation policy are not specified here (Q6/Q7/Q10). Supplier/provider identities remain configurable data.

## Validated workflow states

Use enumerated states with validated transitions, not uncontrolled strings. Proposed version approval projection: awaiting approval → approved, based on immutable evidence for that exact version. Publishing a new version leaves the earlier projection/evidence intact; it does not copy approval to the new version.

Factory QC uses the specified states: WAITING_FOR_QC → QC_PASSED or QC_FAILED; failure/remediation can progress through REWORK → RECHECK_REQUIRED → a fresh inspection result. Preserve all inspections and defect/resolution evidence rather than overwriting the failure. Authorization applies to QC decisions independently of assembly completion.

The addendum's suggested production indicators (WAITING_PAYMENT, WAITING_TECHNICAL_APPROVAL, WAITING_MATERIAL, EXTERNAL_PROCESSING, CNC, ASSEMBLY, QC, PACKING, DELIVERY, INSTALLATION, CUSTOMER_ACCEPTANCE and COMPLETED) inform views across separate workflows. They are not an unconditional linear state machine. NOT_RELEASED or waiting indicators may describe candidates on the Production Board; they are not mutable states of an already created immutable release snapshot. Exact operation sequencing and closure rules remain later implementation details.

## First slice and traceability

First slice ends at exact-version customer approval and audit; it does not implement purchasing or release commands. Framework fixtures may be synthetic and clearly labeled until samples validate a real PolyBoard adapter.

Every later stage retains the canonical Project ID and applicable version/release references. Record actor, time, source evidence and correlation for transitions. Repeated commands must be idempotent; concurrent commands cannot change which version was approved or released. Full path: customer → project → version → release → requirements/allocations/purchases → processing/assembly/QC → installation/acceptance → invoice/payment → warranty. Preliminary commitments join this history without pretending they were originally release-authorized.

## Material resolution is a separate technical association

Creating or refreshing a technical review model now automatically resolves its unique Panel/Edge requests against current libraries. Reports and MaterialMaster associations are external to the frozen ProjectVersion. RESOLVED means all catalog requests have safe exact technical links only: it does not mean customer approval, commercial/payment satisfaction, technical manufacturing validation or ProductionRelease. Changing active libraries creates new evidence on next processing without rewriting earlier design or approval history. See MATERIAL_RESOLUTION.md.

## Presentation preparation is not approval

An internal user may prepare a separate ClientPresentation for an exact ProjectVersion and append immutable content revisions. View-as-client previews saved curated content only. Neither save nor preview approves the design, quote, payment or production. Later ProjectVersions do not mutate or inherit presentation approval. A future approval snapshot must explicitly pin the exact presentation revision/assets and applicable quote; design-deliverable access remains an unimplemented policy.

## Commercial offer revisions (D51)

Saving a QuoteVersion freezes offered terms for exactly one ProjectVersion and optional presentation revision. It does not approve the project, confirm a deposit, satisfy payment conditions or authorize ProductionRelease. Future approval must pin exact ProjectVersion + QuoteVersion; later edits append revisions and cannot rewrite accepted historical evidence.

## Sent commercial snapshot lifecycle (D52)

Explicit issuance publishes exact version/presentation/quote as PENDING_CLIENT. Feedback makes it CHANGES_REQUESTED without changing content. Explicit confirmed approval creates immutable evidence and APPROVED for this exact tuple only. Sending a different quote snapshot appends SUPERSEDED to previous sent snapshots; later drafts alone do not replace what the customer is reviewing. New versions never inherit consent. Historical approved evidence survives supersession/revocation. CLIENT_APPROVED is independent of PAYMENT_CONDITION_SATISFIED, technical validation, ProductionRelease and installation CustomerAcceptance. See CLIENT_PORTAL.md.

## Implemented payment prerequisite (D53)

CLIENT_APPROVED and PAYMENT_CONDITION_SATISFIED are separately derived for an exact quote/version. Current plan configuration plus valid confirmed milestone allocations determine only the payment prerequisite. Missing configuration fails closed; partial/reported payments do not imply satisfaction; reversal can invalidate it. New plans/quotes do not inherit allocations. Due triggers remain metadata and no installation/acceptance event is fabricated. Future combined release eligibility/ProductionRelease is not implemented. See PAYMENT_CONDITIONS.md.
