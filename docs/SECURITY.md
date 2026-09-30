# MOBLUX OS — Security

Purpose: security architecture for the cumulative specifications and owner decisions. Baseline v0.1 is approved. The sections below describe the target controls; this bounded development increment implements the subset documented at the end. PERMISSIONS.md contains role templates; PROJECT_LIFECYCLE.md defines command invariants.

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

Verify cross-customer denial, safe field serialization, direct API and file-access enforcement, token replay/expiry/revocation, permission escalation prevention, immutable approval/release history, audited preliminary commitments, malicious upload isolation, callback replay, duplicate-job behavior and denied AI actions as their features are implemented. Test backups/restoration and credential rotation before live use.

## Current implementation boundary

The owner permits local development authentication for this increment. A random local access code from ignored .env signs into a seeded development staff identity; there is no password registration or customer authentication endpoint. The maintained Fastify cookie/rate-limit components provide transport handling; opaque random session tokens are stored only as SHA-256 verifiers in PostgreSQL with an eight-hour expiry. This bounded development mechanism is not the production authentication-provider implementation. DEV_AUTH_ENABLED must be true and APP_ORIGIN must be loopback; the API/web runner binds to loopback. Do not expose it through a public proxy or use production/customer data.

Backend domain services enforce explicit capabilities and user-deny precedence. All customer-kind actors are denied, even with staff grants: a customer portal is deliberately not enabled. All mutation requests require exact configured Origin. Uploads are bounded to 20 MB with an extension allowlist, path/control-character and executable-signature rejection. Original bytes stay private, are never executed or rendered inline, and download as attachments through authenticated API checks. Full malware scanning/conversion isolation is a future prerequisite for parsing/viewing untrusted files.

Versions, source records, import attempts and audit rows are append-only through triggers; runtime credentials additionally lack UPDATE/DELETE grants on these tables. Setup/migrations use a separate owner credential. Local object storage uses generated development credentials and bucket versioning; production IAM, TLS, backup/restore drills, retention and MFA are not implemented or certified by this slice. See IMPLEMENTATION_REPORT.md for tests actually run.

## CSV adapter security boundary

Authenticated staff require project.import, project.view and project.files.download to parse or read CSV reports. Cabinet reports additionally require project.cost.view because original cells include price values. Project lists return safe report metadata only, never parsed commercial cells. Customer actors remain denied. Source/project ancestry, exact source size/hash and profile allowlist are checked in the backend; attempts and their audit events commit atomically. Database triggers and runtime grants keep attempts immutable.

Only a bounded UTF-8 CSV text parser is enabled (1 MB, 5,000 rows, 18 columns, 4,096 characters/cell). It does not evaluate spreadsheet formulas, execute files, fetch imported links, or invoke PDF/CAD converters. The earlier broad parsing deferral is narrowed for this explicitly authorized plain-text path; malware scanning and isolated conversion remain unimplemented for wider file processing. CSV values are rendered as escaped React text, and no parsed CSV spreadsheet export is offered. Profile selection never grants manufacturing authorization.

## Normalized review version security

Reading normalized technical models requires project.view, project.import and project.files.download. Creation additionally requires project.version.create. Both selected reports must belong to the requested project and one exact source version and have successful compatible profiles. Cross-project references and cross-version pairing fail in the backend. Customer actors remain denied.

The normalizer selects only confirmed cabinet technical fields, omitting raw cabinet cells/prices from model responses. Financial access is still required by the existing cabinet-report API; technical-only model access does not grant it. Part raw fields come only from the cutting profile. No purchasing or financial action is added. Models and their child records are immutable; insert guards reject additions to sealed or old non-normalized versions. Concurrent retries serialize per project; audit and model creation are atomic.

## PolyBoard library security boundary

Library uploads accept only the three exact supported category/filename pairs and are limited to 256 KiB. The sequential parser validates container length, BZip2 integrity/end-of-stream, grammar, counts, identifiers and exact payload consumption; structural failure stores zero records, never a recovered partial catalog. Resource limits and confidence rules are specified in POLYBOARD_LIBRARY_PROFILE.md. The decompression worker receives no application environment; it is not a substitute for a production OS sandbox or broader malware controls.

Originals remain private versioned objects and downloads verify byte count/hash. No imported texture path is followed, downloaded or rendered as an image. Normal responses omit raw blocks; library.raw.view separately gates bytes and original download because undecoded fields may be financial. Staff-only authorization, mutation Origin checking, rate limits, immutable rows, transactional audit and project ancestry checks apply. Matching proposals cannot alter project versions or authorize manufacturing. Tests cover direct API denial, customer denial, retries and immutable storage.
