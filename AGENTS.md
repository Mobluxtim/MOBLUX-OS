# MOBLUX OS — Agent Guidance

This document defines how Codex and other coding agents should preserve project context and maintain the repository during long-term development across multiple computers.

- Before making significant changes, read `AGENTS.md` and the relevant files in `docs/`.
- Document important architectural and business decisions in `docs/DECISIONS.md`, including their context and rationale, and update the affected documents.
- Do not invent business requirements when information is missing. Ask for clarification or record the unresolved issue in `docs/OPEN_QUESTIONS.md`; do not treat an assumption as an approved requirement.
- Develop the software incrementally, using small, reviewable changes and keeping documentation aligned with agreed behavior.
- Do not perform large architectural rewrites without documenting the reason, alternatives, and implications in `docs/DECISIONS.md`.
- Keep the repository portable between computers. Prefer repository-relative paths and avoid hard-coded machine-specific paths or undocumented local setup requirements.
- Never commit secrets, passwords, API keys, credentials, or production customer data. Keep sensitive information out of code, documentation, examples, fixtures, and version history.

## Current project stage

Architecture baseline v0.1 is approved. The owner authorized the first implementation increment: local development authentication, customers, projects, immutable initial versions, preserved pending/unmapped source uploads and audit history. Follow the bounded scope and implementation decisions in docs/DECISIONS.md. The owner additionally authorized the real CSV profiles documented in docs/POLYBOARD_CSV_PROFILE.md. Keep column 10 unmapped and edge pairs without side orientation until confirmed. Do not implement later ERP modules or invent additional PolyBoard mappings. Do not modify the two authoritative specifications or existing Git configuration without explicit instruction. Do not commit or push automatically.

## Project context

- `docs/MASTER_SPEC.md`: agreed scope and requirements.
- `docs/ARCHITECTURE.md`: system structure and technical boundaries.
- `docs/BUSINESS_FLOW.md`: agreed business workflows.
- `docs/DOMAIN_MODEL.md`: business concepts and relationships.
- `docs/PERMISSIONS.md`: roles and access rules.
- `docs/POLYBOARD_IMPORT.md`: Polyboard import requirements and mapping.
- `docs/ROADMAP.md`: incremental development plan.
- `docs/DECISIONS.md`: important decisions and their rationale.
- `docs/OPEN_QUESTIONS.md`: unresolved questions needing clarification.
- `docs/PROJECT_LIFECYCLE.md`: version, approval and production-release distinctions.
- `docs/SECURITY.md`: security boundaries and controls.
- `docs/IMPLEMENTATION_REPORT.md`: current increment, verification and file manifest.

- `docs/POLYBOARD_CSV_PROFILE.md`: evidence, verified CSV profiles and current extraction limits.

## Current authorized increment

The owner additionally authorized PolyBoard Material Library Staging + Safe Material Matching. Preserve the confidence boundaries in docs/POLYBOARD_LIBRARY_ANALYSIS.md and docs/POLYBOARD_LIBRARY_PROFILE.md. Library snapshots and matching proposals are immutable review evidence, not published material masters or manufacturing authorization. Do not infer prices, grain, edge sides, profile dimensions or supplier identity. Existing project versions must remain unchanged. Stop after verification of this bounded increment for owner review.

The owner authorized normalized technical review from existing CSV reports. Follow DOMAIN_MODEL.md and D33–D35: create a new immutable review version, exact-name cabinet links only, version-scoped material deduplication, raw column 10 and edge slots, explicit ambiguous/unmapped states, audit and idempotent reuse of the exact report pair. Later ERP, rendering, portal and release work remains outside scope.

## Automatic material resolution — current owner-authorized increment

The owner authorized EXACT_UNIQUE auto-linking and exception-only project review. Follow docs/MATERIAL_RESOLUTION.md: use explicitly active snapshots, derive requirements from the immutable normalized model, retain separate append-only reports and internal MaterialMaster IDs, and never merge identities across source snapshots without evidence. library.activate controls administrative activation. No manual material re-entry, supplier concepts or manufacturing authorization is included. Earlier proposal-only restrictions are superseded only for this bounded technical-resolution scope. Do not commit/push or begin the next increment.

## Current authorized BOM increment

The owner authorizes automatic technical Material Requirements / BOM from the normalized model and existing master links. Follow docs/MATERIAL_REQUIREMENTS.md: exact exported rectangular PANEL area and units only; EDGE material/thickness traceability counts with null length until orientation is confirmed. Preserve immutable reports and drill-down. No supplier, price, stock, purchasing, waste, optimization, sheet purchasing quantity or costing scope. Stop after this increment for review.

## Material Classification & Purchasing Basis

The owner authorized technical classification and nullable evidence-backed purchasing metadata only. Follow docs/MATERIAL_CLASSIFICATION.md and D44. Preserve historical masters/resolutions/BOMs; derive separate immutable profiles automatically. Only exact-source PFL/Glass declarations are classified in the current fixture; other substrates and all purchase formats remain unverified. No suppliers, prices, stock, purchasing calculations or orders. Stop for review.

## OptiCut result import v1

The owner authorizes importing the existing OptiCut optimization report, not running an optimizer. Follow docs/OPTICUT_IMPORT.md and D45: immutable source/model/resolution reports, separate net BOM and optimized/failed requirements, exact-only material links, truncated failure text preserved, no supplier/pricing/order/costing/nesting scope. Stop after verification for review.
