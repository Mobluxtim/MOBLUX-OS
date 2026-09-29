# MOBLUX OS — Security

Purpose: initial security architecture for the cumulative specifications and owner decisions. Backend enforcement, granular permissions, customer isolation and audit are confirmed requirements. Technical controls below are proposed implementation direction pending architecture approval; no authentication provider or library is selected here. PERMISSIONS.md contains proposed role templates; PROJECT_LIFECYCLE.md defines command invariants.

## Authentication and sessions

Use a maintained authentication component, not custom cryptography. Staff use individual identities; shared station devices must still attribute sensitive actions to an authenticated operator. Propose MFA for privileged accounts and reauthentication for sensitive access/permission changes. Provider/library and session lifetimes are technical decisions before implementation.

Customer access follows the specified email/phone plus magic-link and/or OTP direction; propose email magic links initially. Issue unpredictable short-lived credentials with single-use redemption, rate limits, bounded OTP attempts and non-enumerating responses. Store token verifiers rather than reusable plaintext credentials, redact tokens from logs, and restrict redirects. Link delivery is not approval: approval requires an explicit authenticated confirmation of exact content. Never send reusable plaintext passwords.

Use TLS and protected server-managed sessions with Secure/HttpOnly cookies and appropriate SameSite policy, CSRF protection on state-changing requests, expiration, rotation and revocation. Logout, account disablement and removed project access must invalidate relevant access. Recovery must verify identity without granting a customer broader project access; audit account/security changes.

## Authorization and backend enforcement

RBAC provides configurable templates plus granular capabilities and user overrides. Proposed evaluation is default deny, scoped role grants and explicit user-deny precedence. Evaluate capability, resource scope and lifecycle preconditions on every command/query, including worker and integration entry points. Never rely on UI visibility.

Distinguish project.approve, technical.validate, production.release, production.release.override, purchase.create/approve/send, inventory.reserve/adjust, payment.record/reconcile and quality.approve. Administrative access is not customer consent. Permissions administration must prevent delegation beyond the actor's authorized scope and log changes. Whether separate people must approve particular actions remains Q10; do not invent that business rule.

## Customer/project isolation

Bind identities to explicit customer contacts and project grants. Check every resource's project/customer and version/release ancestry, including nested records, search/count/export, previews, downloads, notifications and audit views. IDs, filenames and QR codes confer no authorization. Use portal-specific response allowlists; internal supplier prices, margin, staff information, notes, purchasing and production costs are excluded unless explicitly authorized.

Requests identify exact versions and artifact revisions; never resolve an approval's target through latest. A customer's access to Project A cannot authorize references belonging to Project B. Cache keys and shared read models must preserve audience and scope; never cache privileged output for customer reuse. Initial single-company deployment is a proposal, not a substitute for customer isolation or an approved multi-company design.

## Audit and integrity

Append-only AuditEvent records actor/service identity, timestamp, command/event, entity, project/version/release where applicable, correlation, and appropriate safe before/after evidence. Record imports/publication, approval, commercial changes, preliminary procurement/reservation, purchases/approvals/sends, release/override, production/QC, installation acceptance, invoice/payment and permission changes.

Persist important state changes and required audit atomically; if audit persistence fails, the sensitive command must not silently succeed. Restrict update/delete on audit and immutable business records for ordinary runtime identities; use separate controlled migration/maintenance access. Backups and infrastructure logging support recovery/investigation. Append-only application controls are not a claim of cryptographic tamper-proofness against database administrators.

Do not log secrets, authentication tokens or unnecessary customer data. Security-denial/abuse telemetry is access-controlled and distinct from immutable customer consent evidence. Retention/deletion/recovery policies remain Q9 before live data.

## Secrets and environments

Never commit secrets, passwords, API keys, credentials or production customer data. Use runtime secret injection or a managed secret store, separate development/test/production credentials, least privilege and rotation/revocation. Commit only sanitized configuration templates and synthetic fixtures after implementation approval. Do not expose server secrets through frontend bundles, diagnostics, notification payloads or AI context. Avoid machine-specific paths; keep setup portable and Git configuration unchanged.

## Files and secure portal access

Use private object storage with immutable revisions/hashes and database ownership/audience metadata. Authorize upload intents with bounded type/size, validate content and quarantine untrusted files. Reject path traversal, unsafe archives and unexpected executable content; bound parsing and conversion resources. Isolate converters without production credentials or unnecessary network access. Uploaded files are data, not commands.

Authorize each preview/download before issuing short-lived signed access or an authenticated stream. URLs must not be public permanent bypasses; revoked access prevents new grants, and already issued signed URLs expire within a bounded period. Active content requires safe rendering or download disposition and browser isolation. Preserve source/derived provenance; never replace approved bytes. Cloud storage encryption and encrypted transport are proposed baseline controls.

Portal invitations grant only intended project access, not organization membership or role escalation. Approval submissions bind actor, exact version and saved presented references, with idempotency and concurrency checks. A link to a newer version cannot silently change historical consent.

## Sensitive financial and manufacturing actions

Authorized preliminary procurement/reservation is permitted before ProductionRelease. Require scoped capabilities, source/project references and audit, including financially consequential commitments. This is neither production authorization nor permission to bypass purchase controls. Auto-send needs explicit authorized configuration; service retries cannot duplicate financial commitments.

Release gate evaluates exact version/approval, commercial, technical, material and project-configured PaymentPlan/PaymentMilestone evidence. No fixed 50% payment rule. Validate configuration to prevent circular prerequisites. Override requires separate permission, reason, actor/time and each bypassed condition; it never fabricates consent or edits snapshots. Verify payment evidence through authorized recording/reconciliation, not a client-supplied paid flag.

Production file access and operation transitions are scoped to assigned release/jobs. Assembly completion does not approve QC. Preserve all immutable release/approval/acceptance evidence. AI-originated proposals require the same underlying permissions, validation, approval and audit as human actions; AI never supplies authoritative manufacturing geometry.

## Integration trust boundaries

Treat imports, webhook payloads, supplier replies, document content and AI output as untrusted data. Validate schema, size and identifiers; authenticate callbacks with supported signatures/credentials, prevent replay, deduplicate and reconcile discrepancies. A provider callback has only its constrained reconciliation authority, never staff/customer privileges.

Adapters isolate provider credentials, contracts and failures from domain logic. Use least-privilege service identities and configured endpoints; do not let imported URLs or AI output cause unrestricted network fetches. Outbox/job payloads carry minimal references and actor/correlation context. Recheck permission and current state before delayed sensitive effects; provider delivery success is not proof of business approval.

PolyBoard remains the geometry source; real adapter mappings await samples. Conversion output is visualization only. Notification providers receive only intended recipients/content; payment/accounting integration does not spread country-specific rules through the domain. Suppliers are configurable identities, never hard-coded authorization shortcuts. AI data retrieval follows user scope, and embedded document instructions cannot authorize actions.

## Verification before live use

Verify cross-customer denial, safe field serialization, direct API and file-access enforcement, token replay/expiry/revocation, permission escalation prevention, immutable approval/release history, audited preliminary commitments, malicious upload isolation, callback replay, duplicate-job behavior and denied AI actions. Test backups/restoration and credential rotation with synthetic data. No security test or deployment is performed by creating this planning document.
