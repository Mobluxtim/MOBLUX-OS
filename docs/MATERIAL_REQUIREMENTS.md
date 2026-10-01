# MOBLUX OS — Automatic Technical Material Requirements / BOM

Owner-authorized bounded increment, 2026-09-30. Derive requirements from the existing normalized model and its exact material-resolution report. This is a technical review BOM, not a purchase list, costing model or manufacturing authorization.

## Calculation boundary

PANEL lines group by resolved internal MaterialMaster + confirmed thickness. If resolution is missing, keep the version-specific technical material identity and quantity visible with an unresolved issue; never drop parts or invent a master. Every exported part row contributes exactly once, with its exported quantity. Cabinet quantities do not multiply part quantities. Ambiguous/unmapped cabinet links remain explicit and do not suppress otherwise confirmed dimensions/materials.

Net exported rectangular area = first dimension (mm) × second dimension (mm) × exported quantity / 1,000,000, in m². Axis orientation is unnecessary for this symmetric product. This is the net sum of the exported rectangles before waste: it does not establish finished contour area, cut-out deductions, edge allowances, machining dimensions, grain/rotation rules, sheet yield or purchasing quantities. It must not be presented as an optimized or production-validated material requirement.

Dimensions retain the CSV profile's exact decimal bounds (12 integer digits, up to six fractional digits). Arithmetic uses integer millionths of mm and BigInt products, then exact decimal strings in m²; no binary floating-point rounding. Results and contribution ordering are deterministic for the same frozen inputs. Positive dimensions, units, row quantities, version ancestry and duplicate source references are validated.

EDGE only groups confirmed material/thickness pairs and records source-slot counts plus quantity-weighted occurrences. These are traceability counts, not metres or a purchasing unit. All current edge sides remain null, so lengthM is null and each group explicitly reports ORIENTATION_UNVERIFIED. No slot is assigned to either dimension, including on square parts. Empty slots are excluded from demand but remain preserved in the original technical model. Column 10, orientation flags, library financial-looking values and profile properties do not enter any formula.

## Immutable persistence and automatic flow

material_requirement_reports belongs to Projects. Each row references one exact immutable material_resolution_reports row; that row fixes TechnicalModel and ProjectVersion. Unique (resolutionId, algorithmVersion) gives idempotency; ancestry and immutable triggers protect storage. No ProjectVersion/Part/Material row is modified. Algorithm version: net-export-rectangles/v1.

BOM creation is an internal consequence of the existing authorized resolution transaction. It runs when a new model is created, on automatic project open/refresh, and during active-library change propagation. Reusing an older resolution creates a missing BOM once or reuses its existing BOM. A new resolution gets its own BOM, preserving previous reports even when material links change. Quantities can remain identical while association evidence changes. Audit is inserted in the same transaction.

Each PANEL contribution stores Cabinet ID/name or unresolved source label, Part ID/name/reference, technical material ID, both source dimensions, quantity, exact contribution area, source file ID/hash, import report ID and original row/line. Each EDGE contribution retains the same lineage plus raw slot and null side. The pinned resolution holds exact library/candidate evidence. Real source content remains private; ordinary BOM responses contain no prices or unrelated raw binary values.

## UI and permissions

Normal Project Overview and Technical model show Material requirements / BOM automatically as part of existing resolution, without a new button, manual material input, snapshot selection or admin-library visit. PANEL tables show rows/units/net exported area; EDGE tables explicitly show unknown lengths. Per-line expandable drill-down shows source provenance. Status PARTIAL indicates unresolved links or unavailable edge lengths even when all material identities resolve safely.

The existing project.view + project.import + project.files.download checks and exact project/model ancestry protect the response. Customer actors remain denied. Existing activation permissions authorize automatic downstream BOM derivation. No additional capability or dependency is added.

## Exclusions and next dependency

No suppliers, prices, stock, purchasing, waste factors, optimization, sheet counts, costs, margins, profit, CAD or release actions. Official/controlled export evidence must confirm edge-slot orientation before a linear EDGE requirement calculation can be implemented. This does not block the current PANEL calculation and edge traceability review.

## Classification display

The project now shows current-policy MaterialTechnicalProfile enrichment beside each resolved PANEL BOM line. Profiles are stored separately; historical BOM contents and algorithm remain unchanged. Two real groups are source-declared and six require substrate evidence. Purchasing unit and stock-sheet size remain unverified for all groups. The UI rounds displayed PANEL quantities to at most two decimals while exact stored decimal strings and calculations are preserved. See MATERIAL_CLASSIFICATION.md.

## Imported optimization alongside net requirements

The owner authorized external OptiCut result import in a separate report/UI section. The exact net BOM remains unchanged. OptiCut sheets/area/edge/cutting/waste values and failed requirements retain their own source/model/resolution provenance; they are never merged into net calculations or used as purchasing orders. See OPTICUT_IMPORT.md.
