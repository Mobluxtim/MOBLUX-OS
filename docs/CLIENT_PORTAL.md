# MOBLUX OS — Client Portal + Approval v1

Bounded client review of an exact ProjectVersion + PresentationRevision + QuoteVersion. This increment enables separate customer access while keeping all existing internal APIs staff-only. It is not payment confirmation, CustomerAcceptance after installation, e-signature or ProductionRelease.

## Published snapshot

Authorized staff selects a complete QuoteVersion with an attached presentation, enters an explicit customer-facing project title and recipient name/email, and chooses an access lifetime of 1–168 hours. No internal project title/brief is automatically published. The quote's pinned presentation supplies the exact third reference. A missing/incomplete quote or missing presentation cannot be issued.

`portal_snapshots` freezes the existing allowlisted quote and presentation projections, the customer-facing title, neutral confirmation text, exact source IDs/hashes and visible image IDs/display hashes/object versions. Its canonical SHA-256 sorts JSON object keys but preserves array order, so PostgreSQL JSONB key ordering cannot invalidate the evidence. Snapshot uniqueness is project + quote; reissuing cannot change its content/title. Publishing different commercial content requires a new quote revision. Existing project, presentation, quote and BOM/costing rows are untouched.

The portal shows the safe project title, exact version/revision numbers, presentation cover/gallery/sections/material/accessory/service descriptions, offered lines, VAT, totals, deposit/balance and commercial notes. It does not query or expose the internal ProjectVersion object, technical source files, BOMs, costing, supplier data or internal audit. Existing editorial responsibility for authored prose/pixels still applies.

## Access and identity

`portal_accesses` stores one random 256-bit invitation verifier (SHA-256), recipient name/email, immutable snapshot, expiry and issuing staff identity. Plaintext invitation secrets are returned once only and never persisted. Idempotent retry returns the access ID with no secret; if the response was lost, explicitly reissue.

The private link places the secret in a URL fragment (`/client#access=...`), not a server-request URL/query. The page removes the fragment before redemption and sends the token in a POST body. Single-use redemption creates a distinct random server-managed session whose verifier is in `portal_sessions`. HttpOnly, SameSite=Strict, path `/api/client`, and Secure for HTTPS isolate it from the internal staff cookie. Session lifetime is at most eight hours and never exceeds access expiry. Expiration/revocation is checked on every portal read, action and media request. Logout appends `portal_session_ends`; invitation replay cannot restore a logged-out/expired session.

Staff reissue to the same normalized recipient email on the same snapshot appends revocations of that recipient's previous grants/sessions. Other explicitly issued contacts remain independent. Separate immutable grant rows support multiple contacts and future account linkage; no verified email/account identity is claimed. Approval evidence identifies possession of an issued access link attributed to the named recipient, not independent identity verification or a qualified signature. Deliver links privately to the intended recipient. v1 supplies a copyable link; it does not send email/SMS or integrate a delivery provider.

Revocation is explicit, audited and permanent for a grant. It does not erase earlier approval. Link redemption is rate-limited, mutation Origin is checked, and credentials never confer staff API access. Snapshot/asset IDs alone confer no access. Revoked/expired/invalid invitations fail with a common response. No customer project listing/search endpoint exists.

## State and immutable decisions

Status is derived from append-only records:

- PENDING_CLIENT: snapshot published, no client decision.
- CHANGES_REQUESTED: feedback recorded, no approval. More feedback or subsequent explicit approval is allowed for this same snapshot.
- APPROVED: one immutable approval exists; further actions cannot edit or retract it.
- SUPERSEDED: staff explicitly publishes a different quote snapshot for this project. Prior actions/approval remain historical. Existing authorized sessions may read their old snapshot, clearly labeled SUPERSEDED, but cannot act; unused old invitations cannot be redeemed.

Creating a later draft ProjectVersion, presentation or quote does not silently replace the sent snapshot. Issuing a different snapshot explicitly supersedes prior sent snapshots atomically. A superseded snapshot cannot be reissued; there is no implicit rollback or transfer of approval. New snapshots start pending. Database guards validate ancestry; per-project transaction locking serializes publish/reissue/revoke/approve, and a partial unique index enforces one approval per snapshot.

`portal_actions` is the immutable customer audit/decision ledger. REQUEST_CHANGES stores the message, exact snapshot/hash, access identity, request hash/ID and time. It never edits source content. APPROVE additionally freezes the full visible snapshot including all approved totals/currency/VAT/deposit; exact source references and media evidence remain in its immutable parent snapshot. The backend requires the exact displayed snapshot ID/hash and an explicit confirmation flag. The UI shows the pinned neutral confirmation before final submission. Confirmation text is snapshot data suitable for later versioned configuration; no legal/IP/penalty/payment-obligation wording is invented.

Customer actions are attributed to their real access record in this ledger, never falsely attributed to the issuing staff user in the staff-only audit table. Staff publish/issue/revoke operations use existing atomic audit events. Session creation/end records preserve access provenance. All seven new tables have immutable update/delete guards; runtime grants remain SELECT/INSERT only. Staff can read but cannot edit approval evidence.

## Internal UI and permissions

Project → Client approval shows exact sent versions, states, contact grants/expiry/revocation, feedback and approval evidence/time. `project.view` + `portal.view` allows internal review. `project.view` + `portal.manage` issues/reissues/revokes; issue additionally requires quote.preview and presentation.preview. The editor's quote selector uses quote.view. No new general customer permission is added to internal policy.

`/api/client/*` is a separately scoped API; it consumes only its own cookie. Media authorizes snapshot and visible asset membership on every request and streams the existing hash-verified private display object. No original or manufacturing file route is exposed. There are no reusable public storage URLs, and no internal debug/audit fields in the client response.

## Local setup and future gates

Apply migration 0014 and run the existing seed command to grant new capabilities to the development admin; restart the API. No new dependency. Existing development configuration still requires loopback APP_ORIGIN and binds locally. This increment was verified locally in isolated customer browser sessions, not deployed publicly. Public customer delivery requires the separate production authentication/TLS/hosting/retention readiness already described in SECURITY.md; do not expose the development staff login through a public proxy.

CLIENT_APPROVED, PAYMENT_CONDITION_SATISFIED and production authorization remain distinct. The immutable exact-version approval evidence can later be a release prerequisite; it does not satisfy a payment plan or technical validation gate. Deferred: payment processing/reconciliation, invoices, portal account upgrades, automated invitation delivery, PDF, e-sign provider, approval retraction policies and ProductionRelease.

## Payment contracts (D53)

Payment Conditions provides a dedicated allowlisted customer contract, but live portal payment UI/publication remains deferred. Approved portal content stays frozen; reported/confirmed payments do not alter it. A later separate authenticated payment read projection must maintain this exact-snapshot boundary. No proof upload or gateway added.
