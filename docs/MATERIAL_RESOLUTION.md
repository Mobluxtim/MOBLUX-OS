# MOBLUX OS — Automatic Material Resolution

Owner-authorized bounded increment, 2026-09-30. This supersedes proposal-only behavior for EXACT_UNIQUE technical resolution, not for manufacturing authorization. Existing library staging and manual diagnostic matching remain available.

## Normal project flow

ProjectVersion → immutable TechnicalModel → normalized Materials and Part EdgeData → unique category/name/decimal-thickness/unit requests → active category snapshots → safe matcher → immutable resolution report. Users never re-enter a material list or choose snapshots per project. Panel requests retain technical material IDs; Edge requests retain every part/slot reference. No Bar requirement is invented because the current project model contains none.

Model creation performs resolution in the same PostgreSQL transaction as the normalized model and audit. Reusing the exact report pair also ensures resolution against current libraries. Opening the normal project Overview automatically selects its latest normalized version and ensures resolution; the Technical model view does the same without requiring version selection. Open views update automatically every five seconds and on window focus. GET report/history requests remain read-only. A failed command is visible and retryable; UI does not claim success from stale data.

## Active libraries

An administrator with library.activate and library.view explicitly activates or deactivates one successful snapshot per category, with a reason and audit. Uploading never activates implicitly. The append-only library_activations journal has a monotonic sequence; the last event per category determines current state. No initial snapshot is guessed by filename/count/date. Original snapshots and activations cannot be edited or deleted. Repeating the same active selection is a no-op.

Activation and resolution share a transaction advisory lock so each report sees one consistent active configuration. Current small, bounded local workloads use synchronous transactions; this is not a new worker service. Relevant categories only affect a model's resolution identity: a Bar-only change does not invalidate a model with only Panel/Edge requests.

Changing an active library now recomputes every affected existing technical model in the activation transaction, including projects that are not open. A new relevant snapshot set creates a separate immutable report; no design row is rewritten. Activation and all affected reports succeed or roll back together. The read API explicitly reports stale/current state against the current configuration, never labels the most recent historical report current merely by timestamp. A new library record only participates once its immutable snapshot is explicitly activated. If a former exact match becomes ambiguous, the new report has no material link; the earlier report and master remain historical evidence.

## Automatic links and stable identity

EXACT_UNIQUE is the only auto-linkable result. All existing exact name/category/corroborated thickness/mm rules remain unchanged. MaterialMaster uses a generated MOBLUX UUID, with category, safe source name, corroborated thickness/unit and exact snapshot/record provenance. Database insertion validates that corroborated source evidence exists. The catalog subtype boundary remains PanelMaterial / EdgeMaterial / BarProfileMaterial; no Bar master is created without a confirmed project requirement and verified matching criteria.

A unique snapshot + source-record key reuses the same internal master across projects and versions, with no repeated human approval. Candidate PolyBoard UUIDs are external evidence only. Different snapshots are not automatically merged by UUID, name or decor because continuity is unproven. A new snapshot may therefore create a new master even for similar text. Cross-snapshot equivalence needs a separately reviewed evidence policy. This deliberate boundary prevents false merges; it is not supplier identity.

Supplier, supplier SKU, price, stock, purchasing and manufacturing authority are absent. No material link changes ProjectVersion, technical_materials, approval or ProductionRelease. Links live in material_resolution_reports alongside source references and candidate evidence.

## Reports, exceptions and idempotency

Report identity: exact model (one per immutable ProjectVersion) + sorted relevant active snapshot IDs + resolver/matcher version. Missing categories are part of the effective configuration and produce REVIEW_REQUIRED. Repeated/concurrent commands reuse the report and its original timestamp/audit. Returning from A → B → A reuses the original A report; activation history still records every administrative change. A new version/model gets a separate report but can reuse material masters.

AMBIGUOUS, NO_MATCH and REVIEW_REQUIRED never receive a materialMasterId. The project displays resolved/total counts, unresolved/ambiguous/unmatched/review-required counts, status and timestamp. Only exceptions expand into the default table; successful links, snapshot hashes and historical reports remain available under evidence/history. The admin library retains full snapshot and proposal diagnostics. This increment supplies exception triage/evidence, not a manual override that weakens matching confidence. Correct evidence/library activation or a later approved resolution policy is required to resolve an exception.

## Permissions and audit

Normal resolution requires existing project.view + project.import + project.files.download; it does not require library administration or per-material human approval. Exact model/project ancestry is enforced, and customer actors remain denied. Active-library changes require the new administrative capability. Origin enforcement applies to commands. Raw-library permission boundaries are unchanged. Activations, master creation and resolution are audited transactionally. Reports, masters and activations are append-only; runtime has SELECT/INSERT plus sequence usage, not UPDATE/DELETE.

See IMPLEMENTATION_REPORT.md for actual verification and OPEN_QUESTIONS.md for future identity/exception policies. No new dependencies, suppliers, costing, production or CAD functionality are included.

## Workflow correction

The normal project entry point is Overview (and Technical model), not Material Library. No project/version/snapshot/report selection or Create matching proposals command is required. The manual matcher is collapsed under Administrative matching diagnostics (optional). Active snapshot abbreviations and resolution time are visible with the result; full evidence remains expandable.

Activation-triggered recomputation runs as an internal consequence of the authorized library.activate command, attributed to its administrator in audit. It does not require granting that administrator project-processing capabilities or returning project contents through the activation response. Normal project resolution continues to require project access and works without library.view/match/activate/raw.view.

Synchronous recomputation is suitable for the present local dataset; activation duration grows with affected models. A future durable batching design would require explicit work and equivalent atomic/current-status guarantees. No new job infrastructure is introduced in this correction.