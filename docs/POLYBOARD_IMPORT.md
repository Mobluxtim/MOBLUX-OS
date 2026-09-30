# MOBLUX OS — PolyBoard Import

Purpose: proposed adapter pipeline around PolyBoard as the initial manufacturing geometry authority. Two sample-derived CSV profiles are now verified for bounded review staging; see POLYBOARD_CSV_PROFILE.md. Other mappings and conversion compatibility remain unverified. Owner decision Q3 permits architecture and initial framework work without real exports; real samples block only implementation/validation of the first real PolyBoard adapter.

## Architecture

Adapters detect, parse, normalize and validate a named export profile/version. A registry uses explicit profile selection and content checks; ambiguous detection requires review, not guesses. Record adapter/profile version and configuration per attempt. Domain modules consume canonical data, never vendor column names.

Authorized upload → private raw source preservation → ImportBatch/ImportAttempt → parsing → normalized staging → validation report → authorized publication → immutable ProjectVersion. Geometry conversion runs as a related independent job. Manual re-entry is not the normal import path.

## Raw sources and lifecycle

Preserve original bytes as immutable AssetRevisions with filename, hash, size, type, uploader/time and project association. Package membership connects multiple files describing one version. Every normalized record retains source file/hash, source record locator, original PolyBoard ID where available, parsed values, import timestamp, adapter/attempt, validation state and published version. Preserve unknown raw fields as source metadata without treating them as business rules.

Proposed attempt states: RECEIVED → PARSING → VALIDATING → READY_TO_PUBLISH → PUBLISHED, with FAILED/NEEDS_REVIEW alternatives. Retry creates traceable attempts, never overwrites parse history or versions. The same publication command is idempotent; intentional re-import may produce a new version. Storage deduplication must not reveal other customers' files or reuse approval. Concurrent publication allocates project version numbers transactionally.

Stage all records before atomic publication; partial parse results cannot become an approved dataset. Later design/source corrections produce another version. Additional documents may live at Project level; version-sensitive records identify the applicable ProjectVersion explicitly. Preserve every approved asset reference/snapshot; never change previously approved content through a latest-file pointer.

## Normalized model and unresolved mappings

| Concept | Canonical representation | Sample-dependent mapping |
| --- | --- | --- |
| Project/room/cabinet | Source IDs, names and parent references | UNRESOLVED: grouping, missing parents and ID stability |
| Part | Cabinet link, dimensions with units, quantity, material, grain/orientation | UNRESOLVED: columns, axes, dimension meanings, tolerances and units |
| Material | Source code/description, thickness and catalog mapping evidence | UNRESOLVED: catalog codes and conversion factors |
| Edge | Part/side link, material and dimensions where supplied | UNRESOLVED: side convention and raw/net dimensions |
| Hardware/accessory | Code, description, quantity/unit and supported associations | UNRESOLVED: grouping, codes and quantity semantics |
| MachiningOperation | Source type, target part, coordinates/orientation, parameters/units | UNRESOLVED: tool/depth conventions, coordinate systems and export coverage |
| ManufacturingFile | File revision, purpose, format and exact target mapping | UNRESOLVED: naming/IDs, CNC format and machine/postprocessor metadata |
| ModelArtifact | 3DS/3D DXF source, GLB/glTF derivative, conversion metadata, optional object map | UNRESOLVED: scale, material fidelity and mesh-to-part identity |

Do not infer manufacturing dimensions from sketches or default missing units. Ambiguous catalog matching is a review suggestion, not automatic truth. Preserve historical source values when catalog data changes. CSV/TXT/configurable ERP/part/material/hardware/machining exports are target adapter families; first support one verified profile. PDFs are supporting documents, never canonical manufacturing data when structured data exists.

## Validation and errors

Validate type/size/package contents, encoding/delimiters/locales, required fields, units/numeric ranges, duplicates, parent references, quantities, material resolution, linked files and profile compatibility. Findings include source file/row or record, field, severity, safe original value and remediation. Fatal parse errors and ambiguous required manufacturing values block publication. Warnings may be acknowledged with actor/reason only under an approved adapter profile policy; never silently truncate, round, insert zero or guess machining values.

User-facing summaries remain separate from technical diagnostics. Bound archive expansion, record counts, memory and CPU; reject path traversal and executable uploads. Raw files stay private/quarantined until checks finish. Failed jobs are visible and retryable; retries cannot duplicate versions or approval invitations.

## 3D, DXF and CNC boundaries

Preserve project 3DS/3D DXF originals; an isolated converter adapter produces GLB/glTF with source references, converter version/configuration, logs and output hash. Choose converter through a real-sample spike. A conversion worker is not a new business microservice.

Distinguish individual-part DXF from visualization DXF by explicit role, not extension alone. CNC files remain manufacturing artifacts; MVP does not generate toolpaths, postprocess, recreate CAD or send programs to machines. GLB/glTF is only a preview. Selection/highlighting requires verified mesh-to-part mapping; without it, display the whole model rather than invent IDs. AI renders are separately labeled and excluded from manufacturing manifests.

Structured import can succeed while conversion fails. Failure must be visible; do not claim the complete 3D demo passed without a representative converted model. Approval requiring a preview must wait for it. Never replace source or derived bytes behind a published reference.

## Sample acceptance

Until real samples arrive, define adapter contracts and clearly synthetic canonical fixtures. These fixtures exercise framework behavior, error reporting, provenance and idempotency; they must not claim actual PolyBoard column names, units, encodings or identifier mappings. No real adapter compatibility is inferred from passing fixture tests. The approved first increment implements an unmapped-source assessment adapter and preserves raw source records linked to an exact version; it does not parse or publish a manufacturing dataset. Later normalized import publication remains the target lifecycle described above.

Obtain sanitized structured exports, matching geometry and expected hierarchy/counts/dimensions/units, plus a revised export and malformed fixtures. Tests should prove normalized values, provenance, reproducibility, version separation, validation errors and retry idempotency. Mock data alone cannot establish real PolyBoard support.

## CSV implementation increment — 2026-09-29

The owner authorized the first real CSV adapter after uploading real sources. See POLYBOARD_CSV_PROFILE.md for the evidence, exact positional mappings and verified limits. Two explicitly selected profiles now stage cabinet and cutting records, with immutable attempt history and audit. Real-sample dependence is resolved only for those profiles; no automatic support for arbitrary PolyBoard exports is implied. Existing raw uploads and project versions remain immutable. Successfully parsed records stay NEEDS_REVIEW until unresolved semantics and a separate publication workflow are addressed.

## Using staged reports in the technical model

The next owner-authorized increment now creates normalized review versions from an explicit cabinet/cutting report pair. No adapter changes were needed. The same reports are reused without reparsing; source bytes, reports and earlier versions remain unchanged. See DOMAIN_MODEL.md for row provenance, conservative linking, deduplication and sealed immutable storage. This does not resolve the unknown CSV fields or authorize manufacturing.

## Implemented material library staging

The owner authorized the next bounded library increment. POLYBOARD_LIBRARY_PROFILE.md specifies the sequential Panel/Edge/Bar adapter, decompression limits, safe failure, immutable snapshot/source preservation and separate matching proposals. POLYBOARD_LIBRARY_ANALYSIS.md remains the original evidence; decoding does not upgrade semantic confidence. Only eight Panel and five Edge thicknesses carry independently corroborated evidence. CSV column 10, edge-side orientation and undocumented library fields remain unresolved. No original CSV adapter or immutable project dataset is rewritten.
