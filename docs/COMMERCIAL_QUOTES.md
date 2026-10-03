# MOBLUX OS — Commercial Proposal / Quote Builder v1

Internal authoring of offered commercial prices for an exact ProjectVersion, independently of technical costing. No customer portal, approval, payment collection, PDF or production authorization is implemented.

## Model and history

Migration 0013 adds append-only `quote_versions`: project/version ancestry, sequence, predecessor, optional exact PresentationRevision, request/payload/content hashes, algorithm version, frozen content/calculation, actor and timestamp. Database guards reject updates/deletes and invalid predecessor/presentation ancestry. Per-version locking and expected predecessor prevent lost updates; identical request IDs/payloads reuse the result, changed payloads conflict. Saving edited content creates a revision. The editor lists the latest 50 revisions; older exact URLs remain available to authorized staff.

Ordered sections and lines contain authored descriptions, notes, visibility and optional visible room references from the pinned presentation revision. Commercial quantities are independent of BOM quantities. Furniture, accessories, design, measurement, travel, delivery, installation and other services use the same explicit offered-price mechanics. No costing report is needed or queried. Internal technical cost, future calculated selling price and manual offered price remain separate concepts. CALCULATED_PRICE is an incomplete placeholder with an internal reference, never a fallback to technical cost.

## Decimal calculation policy

Inputs are decimal strings (up to six fractional places); arithmetic uses BigInt-backed decimal helpers, not floating-point money. Original inputs and exact line products/discounts/net values are frozen alongside rounded results. Algorithm `commercial-quote/line-half-up-2/v1` rounds each offered line net half-up to two currency decimals, then sums. Displayed effective line discounts reconcile rounded gross and net. Quote discount applies after line discounts; configurable VAT applies to the resulting total before VAT. VAT is explicit and frozen per revision, with no default rate or tax-policy inference. Missing visible prices or VAT yield incomplete totals, not zero. Explicit zero is accepted. Hidden sections/lines contribute nothing to any offered total.

Deposit can be a fixed amount or percentage of total including VAT; remaining balance is total minus the rounded requested deposit. An unspecified deposit leaves deposit/balance null. Excess discounts/deposits are rejected. An offer is not evidence of payment. RON/EUR/USD are supported with no conversion; changing currency requires reviewing entered amounts. Readouts use at most two decimals; editing preserves the precise input strings. Synthetic test rates/VAT/deposits are not business defaults.

## Security and preview

`project.view` plus `quote.view` reads internal quote state; `quote.edit` additionally protects calculation/save. `quote.preview` plus `project.view` protects the dedicated customer-safe response. A linked presentation also requires `presentation.preview`. Explicit denies and existing session/Origin protections apply; customer actors remain excluded from this internal tool. Internal cost permissions are neither bypassed nor required: no cost data is fetched.

The allowlisted preview DTO contains only quote/project version numbers, title, visible authored sections/lines, offered amounts/totals, commercial notes, deposit terms and the existing safe exact-presentation projection. Internal notes, hidden lines, calculated references, costs, margins, BOM quantities, supplier/production data and source provenance are absent. The standalone preview mounts no internal workspace and requests only its dedicated preview API (plus authorized presentation media when present). Authored text/images still require responsible editorial review; there is no claim of automatic redaction of user-authored prose.

## UI and future boundary

Project → Quote selects an exact technical version, supports sections/line ordering, independent services, manual unit or flat prices, discounts, VAT, deposit, internal/customer notes, revision history and View quote as client. Preview always uses the last saved quote and its pinned presentation, never implicit latest content. A new ProjectVersion starts empty.

Future approval must pin ProjectVersion + QuoteVersion, and the exact presentation/media evidence when relevant. Selling-price engines, markup/margin, payment confirmation, design-service stages, portal grants, PDF, e-signature and ProductionRelease require separate authorization/increments. None is implied by saving a quote.

Apply existing migration/seed commands (`pnpm db:migrate`, `pnpm db:seed`) and restart the API after updating. No new dependency is required. Targeted unit, PostgreSQL/API and desktop/mobile browser evidence is recorded in IMPLEMENTATION_REPORT.md.

## Published client review (D52)

CLIENT_PORTAL.md now permits exact quote/presentation snapshots through a separate scoped customer session. It reuses these allowlisted offered totals and never exposes internal quote content. Existing staff preview remains unchanged; portal approval is separate immutable evidence rather than a quote mutation. Payment/PDF/release remain deferred.

## Payment-plan boundary (D53)

Versioned internal payment plans now reference the exact quote without altering offered totals, deposit terms or approval. Plan percentages explicitly use total with VAT. No payment data transfers to a newer quote. See PAYMENT_CONDITIONS.md; plan configuration is not customer consent to changed terms.
