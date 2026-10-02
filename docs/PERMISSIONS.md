# MOBLUX OS — Permissions

Purpose: required RBAC plus granular authorization architecture with PROPOSED role templates. Backend enforcement and customer isolation are confirmed requirements; the matrix is not a statement of current staff authority.

## Model and scopes

Roles are editable templates; users may have multiple roles plus explicit allow/deny overrides. Propose default deny, union of scoped role grants and explicit user deny precedence. Grants cannot widen customer or assignment boundaries. Stable semantic keys are configuration identifiers; do not hard-code user, supplier or database permission IDs.

Scopes: organization-wide staff; assigned project; assigned release/job/workstation; own customer account with explicit project access. The proposal assumes a single-company initial deployment, not a speculative SaaS platform (Q8). Capability, scope and state must all permit an action. project.cost.view and project.margin.view are separate from project.view. project.approve means customer approval of exact presented content, not production.release.

## Initial permission matrix

All grants are PROPOSED. O = organization; A = assigned projects/jobs and operation type; C = own explicitly shared projects, safe fields only; — = denied. A role grant never bypasses release gates.

| Role | Project view | Design edit/import | Cost / margin | Purchase create / approve | Stock adjust | Execute production | QC approve | Installation complete | Customer approve | Access admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin | O | O | O / O | O / O | O | O | O | O | — | O |
| Administrator | O | O | — / — | — / — | — | — | — | — | — | O |
| Management | O | — | O / O | — / O | — | — | — | — | — | — |
| Project Designer | A | A | — / — | — / — | — | — | — | — | — | — |
| Sales | A | — | — / — | — / — | — | — | — | — | — | — |
| Accounting | O | — | O / — | — / — | — | — | — | — | — | — |
| Purchasing | A | — | O / — | O / — | — | — | — | — | — | — |
| Warehouse | A | — | — / — | — / — | O | — | — | — | — | — |
| Production Manager | A | — | — / — | — / — | — | A | — | — | — | — |
| Cutting Operator | A | — | — / — | — / — | — | A | — | — | — | — |
| CNC Operator | A | — | — / — | — / — | — | A | — | — | — | — |
| Edgebander Operator | A | — | — / — | — / — | — | A | — | — | — | — |
| Drilling Operator | A | — | — / — | — / — | — | A | — | — | — | — |
| Assembler | A | — | — / — | — / — | — | A | — | — | — | — |
| Quality Control | A | — | — / — | — / — | — | — | A | — | — | — |
| Installer | A | — | — / — | — / — | — | — | — | A | — | — |
| External Contractor | A | — | — / — | — / — | — | — | — | — | — | — |
| Customer | C | — | — / — | — / — | — | — | — | — | C | — |

Contractors receive individually configured task grants. Operators execute only their assigned operation type. Super Admin cannot impersonate customer consent. Whether QC/release approval requires a different individual remains Q10; capability separation alone does not decide this.

| Capability group | Proposed assignment / constraint |
| --- | --- |
| customer.manage, project.create | Sales assigned scope; Administrator organizational scope |
| project.edit, project.import, project.delete | Designer/Administrator edit/import; never mutate published versions; no ordinary delete grant before retention policy |
| project.files.download, project.purchase_list.view, project.production.view | Separate scoped grants; file audience also checked |
| quotation.draft, quotation.publish | Explicit Sales/commercial grants; publication separately authorized |
| approval.request, project.approve | Staff request; customer approves exact version/category |
| technical.validate, production.release | Proposed Designer validation and Production Manager release; gate evidence still required |
| production.release.override | Explicitly authorized administrator only; reason, bypassed checks, actor/time, audit |
| inventory.view, inventory.reserve, inventory.adjust | Explicit Warehouse/production allocation grants; adjustment distinct from routine edit |
| purchase.create, purchase.approve, purchase.send, purchase.automation.configure | Separate capabilities; human approval initially; auto-send needs explicit audited configuration |
| production.start/pause/resume/complete | Assigned operation type; individual actor recorded |
| quality.approve/reject/recheck | QC assignments, not assembly completion |
| installation.complete, installation.accept, issue.create | Installer completion; customer acceptance/issues on own shared installation |
| invoice.view/create, payment.record/reconcile | Accounting; customer sees own shared invoice/status but cannot assert reconciled payment |
| users.manage, permissions.manage, audit.view | Explicit administration; changes audited and audit content scoped |
| ai.use, ai.action.approve | Filtered inputs; approval also requires underlying financial/purchasing/manufacturing capability |

Owner decision Q4 permits authorized preliminary procurement/reservation before ProductionRelease. Apply the same scoped purchase/reservation capabilities and financial audit controls to those actions; absence of a release is not a blanket prohibition or an authorization bypass. Record project/source basis and actor. Procurement grants do not grant production.release or production.start. Detailed purchasing rules remain deferred. SECURITY.md specifies the shared enforcement and integration boundaries.

## Backend enforcement and customer isolation

Enforce at application commands and queries so HTTP, jobs and integrations share checks. Verify project/customer and version/release ancestry. Filter list/search/count/export and nested relations; never send unrestricted data to the browser for filtering. Safe portal DTOs omit supplier prices, margins, production costs, employee information, internal notes and purchase lists unless explicitly authorized.

Private file downloads/previews require resource and audience checks before short-lived signed access. Object keys and QR codes are not permissions. Revocation prevents new sessions/access; signed links have bounded expiry. Prefer email magic links for first slice as a proposal consistent with email/phone + magic-link/OTP requirements. Links expire, are single-use where applicable, rate-limited and excluded from logs; never send reusable plaintext passwords.

Workers have least-privilege service identities and initiating-actor correlation. Recheck authorization/state before delayed sensitive effects. Authenticate and deduplicate provider callbacks. AI cannot manufacture an actor or bypass ordinary commands. Sensitive state changes and required audit persist transactionally; record safe before/after evidence without secrets.

The visual administration matrix shows checkboxes, scopes, effective grants and explicit denies. Prevent delegating privileges beyond the actor's authority. Account recovery is documented, not a hidden universal bypass.

## Verification

Test direct API access as well as UI: cross-customer reads/writes/search/downloads, cost-field leakage, forged version references, deny precedence, expired/replayed magic links, revoked access, station restrictions and unauthorized payment/purchase/release/AI actions. Test an administrator cannot create an event claiming to be customer consent. Review role templates before live rollout.

## Implemented CSV capabilities

project.import + project.view + project.files.download are required for CSV staging commands and reports. Cabinet CSV reports contain raw price fields and additionally require project.cost.view, including direct API reads. The development administrator receives this capability through the idempotent seed. This is data visibility only: it does not authorize purchasing, quotation publication or any other financial action.

## Normalized model access

Model reads require project.view + project.import + project.files.download; creation also requires project.version.create. Technical cabinet responses exclude all price cells. project.cost.view remains required for opening the original cabinet CSV report. Model creation does not grant approval, technical validation or production.release.

## Material library capabilities

| Capability | Backend scope |
| --- | --- |
| library.view | Staff-only snapshot metadata and safe decoded fields; matching-report reads also require existing model read permissions and exact project ancestry |
| library.import | Stage bounded sources; additionally requires library.view; audited |
| library.raw.view | Raw byte inspection and preserved-original downloads; additionally requires library.view; separate because undocumented bytes may contain financial information |
| library.match | Persist proposals; additionally requires library.view and project.view + project.import + project.files.download for the model; audited |

The development seed grants these to the local administrator. Explicit denies prevail; customer actors remain denied even if given staff grants. No capability grants catalog publication, financial action, approval or production release. Ordinary library responses never include raw record/header bytes; UI visibility is not the enforcement boundary.

## Automatic resolution access

library.activate + library.view authorizes explicit activation/deactivation with reason and audit. Default local administrator receives the capability via db:seed. Project resolution instead uses project.view + project.import + project.files.download and exact ancestry; it does not need library.match, library.activate or raw/financial permissions. Thus normal project processing requires no per-material manual approval. Customer actors remain denied. No capability grants purchasing/manufacturing authority.

## Activation propagation authorization

An authorized library.activate command now recomputes affected technical material reports internally in its transaction, attributed to the initiating administrator. The internal resolver is private and cannot bypass permissions through an HTTP endpoint. Normal project processing still requires the existing project permissions and no library/admin capabilities. Manual matching diagnostics are optional and retain their original authorization.

## Technical classification access

Safe classification projections use library.view; project profiles inherit the existing project model/processing permissions. Profile creation is an internal audited consequence of authorized resolution/activation. No raw, supplier, financial or manufacturing privileges are granted. No manual override endpoint is introduced.

## Hardware reference prices

Hardware import/read uses project.view + project.import + project.files.download. Both command and query responses omit item unit/total and report price fields unless project.cost.view is granted without explicit deny. Quantity/name/provenance access does not grant financial visibility. No price appears in audit. This does not grant purchasing or costing authority.

## Technical costing capabilities

All cost read/preview/rule/run endpoints require project.cost.view plus the existing project.view/import/files.download technical evidence permissions. cost.configure separately authorizes new rate versions; cost.calculate authorizes immutable run creation. Development seed grants these explicit capabilities; customer actors and explicit denies remain blocked. A cost-view grant alone does not permit rate edits or run creation. Source reference prices, configured rates and calculated values never appear in unauthorized responses. See TECHNICAL_COSTING.md.

## Manual project cost overrides

POST costing/overrides additionally requires cost.override plus existing project.cost.view and project/evidence access. It grants no rate-edit permission. Backend derives original values from the owned immutable run; foreign project/model references, denied permissions and missing Origin fail. Audit contains identifiers, not amounts. Existing development seed grants the new capability without seeding rates.

## Client presentation preparation

New staff capabilities: presentation.edit (editor, save, upload/attach and internal image review) and presentation.preview (safe exact-revision preview and visible media). Both require project.view and honor explicit denies; neither grants costing/source-file access. Customer actors remain denied. Backend validates all project/version/reference/media ancestry. Hidden or future-deliverable content is absent from the preview DTO and image route. Existing development seed grants these capabilities to the local administrator.
