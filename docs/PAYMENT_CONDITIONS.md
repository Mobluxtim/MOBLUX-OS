# MOBLUX OS — Payment Conditions / Milestones v1

Versioned internal payment obligations for exactly one ProjectVersion + QuoteVersion. Approval, reported payment, confirmed payment and the payment prerequisite for a future release are independent. No payment gateway, accounting ledger, invoice or ProductionRelease is created.

## Model and immutable history

Migration 0015 adds three append-only tables. `payment_plans` owns ordered milestone snapshots, exact quote/version, currency, quote gross total, algorithm, predecessor/sequence, revision reason, request/hash, author/time. `payment_reports` allocates one recorded amount to one milestone of one exact plan; it preserves payment date, method, reference, optional same-version SourceFile ID, internal note, reporter/time and idempotency hash. `payment_events` appends explicit CONFIRMED or REVERSED, reason, actor/time and idempotency identity. Source document metadata/object versions remain in the existing immutable private SourceFile/storage records.

Plan configuration requires a complete exact quote. It may be prepared before approval (for example design obligations); the separate client approval flag remains false until actual exact-snapshot approval. Configuring a plan is not evidence of customer agreement to new terms and cannot amend a signed/approved quote. No plan is generated from the quote deposit automatically.

Each revision contains title, customer description, ordered fixed/percentage milestones, original input, exact calculated amount, currency settlement amount, due-trigger metadata, release-required flag, visibility and internal/customer notes. Design is an independent fixed or percentage milestone; no furniture multipliers or employee costs are queried. There are no default rates or schedules.

Saving changes creates a new plan revision, requires the current predecessor and a reason, and preserves the old plan/payments. The latest plan for this exact quote supplies its current payment gate. No payments move between revisions or quotes. A new revision starts unpaid; the UI states this explicitly. Reporting/confirming on a historical plan is rejected, but historical confirmed payments can still be reversed with audit. This is not reconciliation or a transfer tool. A future explicit reconciliation workflow is needed to carry balances forward.

## Decimal policy

Percentages explicitly use the pinned quote total including VAT. Fixed values are independent. The existing BigInt decimal helpers calculate exact products without floating-point money. Positive inputs accept up to six decimal places; original inputs and exact milestone products are preserved. Algorithm `payment-plan/quote-gross/half-up-2/v1` settles each milestone half-up to two decimals; a positive value rounding to zero is rejected. Reported/confirmed amounts retain their full input precision, and confirmed sums/outstanding are calculated at full precision. UI readouts show at most two decimals; status uses exact comparison, not displayed rounding.

Partial confirmations accumulate only for the exact milestone. Overpayment is retained as confirmed evidence, outstanding is clamped to zero, and nothing is automatically allocated elsewhere or refunded. Configured schedule total and quote total are both displayed; no residual is silently assigned and no assumption that a partial schedule must equal 100% is imposed. No currency conversion; report currency is derived from the plan and cannot be supplied by a client.

## Reporting, confirmation and corrections

Recording creates PAYMENT_REPORTED evidence only. Confirm requires a separate authorized command and a reason. Same-user report/confirm is possible when the actor has both permissions; no unspecified separation-of-duties rule is invented. Unique event constraints plus per-quote transaction locking prevent duplicate confirmation/reversal and serialize plan edits against payment actions. Idempotent retries reuse the original result; changed payloads conflict.

A full reversal removes that confirmation from the derived valid sum while preserving both original report and confirmation. Correct by reversing and reporting a replacement, not editing the amount/date/reference. Unconfirmed erroneous reports contribute nothing; cancellation of unconfirmed reports, partial reversal, refunds and cross-plan allocation are deferred. Repeated identical reversal requests are idempotent. A reversed payment cannot be reconfirmed.

All financial mutations and staff audit events commit atomically. Database ancestry/currency/milestone/evidence and transition guards supplement backend checks; UPDATE/DELETE are forbidden on the new records, including for historical evidence. Report/confirm/reversal actor IDs and timestamps are visible internally.

## Status and future release prerequisite

- CLIENT_APPROVED: exact quote's portal approval exists and its sent snapshot is not superseded. Historical approval reference is separately retained.
- PAYMENT_DUE: milestone remains outstanding without an unconfirmed report. This means an unpaid obligation, not a calendar overdue determination.
- PAYMENT_REPORTED: there is unconfirmed evidence and confirmed funds do not yet satisfy the milestone.
- PAYMENT_CONFIRMED: the milestone's valid confirmed sum reaches its settled amount; individual payments also show confirmation independently of milestone completion.
- PAYMENT_CONDITION_SATISFIED: every required production milestone is satisfied, with at least one explicitly configured requirement.

Missing plan or zero marked prerequisites fails closed with a specific NOT_CONFIGURED/MISSING reason. An explicit no-advance/waiver policy is not implemented. Non-required unpaid design/installation milestones do not block the payment prerequisite. Reversal can make a previously satisfied prerequisite false. Old plan gates remain inspectable but only the selected quote's latest plan supplies its current gate.

Due types are ON_APPROVAL, BEFORE_PRODUCTION_RELEASE, BEFORE_INSTALLATION, AFTER_INSTALLATION, AFTER_CUSTOMER_ACCEPTANCE and MANUAL_CUSTOM. They are metadata, not an implemented event scheduler or proof that an installation occurred. Later installation/acceptance triggers cannot also be configured as production prerequisites, avoiding circular sequencing. No overdue dates or reminders are inferred.

The payment read service returns CLIENT_APPROVED and PAYMENT_CONDITION_SATISFIED separately. It deliberately does not create ELIGIBLE_FOR_PRODUCTION_RELEASE or a release. A future release command must recheck exact current approvals/payment evidence atomically together with all other gates; neither flag alone is manufacturing authorization.

## Permissions and client boundary

`project.view` + `payment.view` gates every internal read/command. Separate capabilities: payment.configure, payment.record, payment.confirm, payment.reverse. Explicit denies and existing staff session/Origin enforcement apply. Payment state does not grant cost/source-file access. Linking or downloading an existing evidence document additionally requires project.files.download and exact project/version ancestry. No upload framework or speculative external dependency was added.

The allowlisted client payment contract contains only plan revision/currency and visible milestone title/description/amount, due-trigger/status, confirmed/outstanding amount and customer notes. Hidden milestones, staff IDs, notes, bank references, evidence documents, audit, cost/supplier data and gate internals are excluded. A staff-only client-preview endpoint verifies this projection. Live portal payment publication/UI and customer proof upload are intentionally deferred, as allowed by scope: dynamic payment information must not be inserted into previously approved frozen portal snapshots without a separate publication contract.

## UI and operation

Project → Payments selects exact quote context. Authorized staff configure/add/reorder milestones, see quote/schedule totals and statuses, report payments, confirm or reverse with reasons, select history and inspect/download authorized existing evidence. Monetary readouts have at most two decimals; editing retains exact input. No approvals or payments are fabricated from examples.

Apply existing migration/seed commands and restart the API for these routes/capabilities. No package installation. Verification uses synthetic test records and existing local PostgreSQL/private storage, not actual customer banking records. See IMPLEMENTATION_REPORT.md.

Future-only: customer proof upload, bank/gateway reconciliation, invoices, accounting, automatic matching, notifications, explicit balance migration, no-payment waiver, ProductionRelease and installation/acceptance automation.
