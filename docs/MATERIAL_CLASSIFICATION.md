# MOBLUX OS — Material Classification & Purchasing Basis

Implemented bounded increment; verification completed 2026-10-01. Technical metadata enriches resolved material identities without changing the source, immutable design, resolution reports or BOM calculations.

## Model and automatic flow

Catalog owns append-only material_technical_profiles. Each profile references an existing MaterialMaster and a classification policy version; this pair is unique. Its JSON result preserves the exact snapshot ID/hash, record ID, external candidate UUID, source name, classification, reason and corroborated thickness. Database triggers reject updates/deletes and invalid source ancestry. Profile creation and audit commit in the existing resolution transaction.

The existing automatic resolution command ensures profiles for both new and reused resolutions. Project opening/refresh, model creation and active-library propagation need no additional user steps. GET remains read-only. The project response exposes current-policy profiles separately from immutable BOM/resolution content; historical reports are not retrospectively classified or rewritten. Repeated commands reuse the same profile and audit event.

PANEL types: CHIPBOARD (PAL), MDF, FIBREBOARD_PFL_HDF, PLYWOOD_MULTILAYER, GLASS, OTHER and UNKNOWN. UNKNOWN means insufficient evidence, not OTHER. EDGE/BAR receive NOT_APPLICABLE for this PANEL-specific taxonomy.

## Evidence and real fixture

Policy source-declared-panel/v1 accepts only two explicit family declarations in the previously analyzed exact Panel snapshot. Rules require its hash, candidate UUID, exact name, category and corroborated thickness. This is a bounded evidence manifest, not a generic name/manufacturer classifier. SOURCE_DECLARED establishes the declared family only; it is not certification of composition, grade, density, glazing construction or commercial format.

| Exact project material | mm | Classification | Evidence / limitation |
| --- | ---: | --- | --- |
| --PFL--0110 PE(Alb) | 3 | FIBREBOARD_PFL_HDF / SOURCE_DECLARED | Explicit PFL source declaration; no specific density/grade inferred |
| zz-Glass 0080 tr nou | 22 | GLASS / SOURCE_DECLARED | Explicit Glass declaration; no glazing construction inferred |
| --W960 ST7-- | 18 | UNKNOWN / REVIEW_REQUIRED | Decor/group/thickness does not identify substrate |
| --W960 st7-- | 36 | UNKNOWN / REVIEW_REQUIRED | Thickness does not prove substrate or layered construction |
| 398 | 18 | UNKNOWN / REVIEW_REQUIRED | Reference/texture is not verified composition evidence |
| H1732 ST9 Mesteacan Nisip | 18 | UNKNOWN / REVIEW_REQUIRED | Decor/wood appearance does not establish core material |
| H3702 ST10 Nuc Pacific Tabac | 18 | UNKNOWN / REVIEW_REQUIRED | Decor/wood appearance does not establish core material |
| H3702 ST10 Nuc Pacific Tbac | 36 | UNKNOWN / REVIEW_REQUIRED | Preserve spelling; no substrate or layer inference |

All eight identities still resolve, as do five EDGE identities. Classification review is separate from identity-match exceptions. No repeated approval is required for the two supported family declarations. The other six expose reasons/evidence for review; no manual override editor or unsupported evidence promotion is introduced in this increment.

## Purchasing-basis boundary

The contract structurally supports nullable purchasing unit (SHEET, M2, LINEAR_M, PIECE, ROLL), stock-sheet length/width in mm, corroborated thickness, and technical SUBSTRATE/FINISH/GRADE attributes. Each populated metadata value must carry evidence. All purchasing units and sheet formats remain null for this fixture; technical attributes remain empty. No write workflow for unverified metadata is supplied.

Net technical m² is not evidence of the purchasing unit. Texture filenames, part dimensions, names and undocumented binary numbers never establish stock-sheet sizes. Supplier identities, supplier products/codes, offers, prices, stock levels and purchasing orders remain separate and absent.

## UI, precision and security

Material Library shows the same deterministic source classification and evidence as a review projection for staged records, without publishing masters merely by viewing a snapshot. Project BOM shows stored current-policy profiles linked by MaterialMaster ID, with a 2/8 source-declared and 6 review summary. Both views expose unknown purchasing fields explicitly.

PANEL area/dimension display rounds to at most two decimals with exact decimal string arithmetic; stored calculations retain full precision. Exact area is also available in the display tooltip. The real total remains 126.46318129 m², displayed as 126.46 m². No BOM algorithm or purchasing conversion changed.

Existing library.view and project read/processing capabilities apply. Profile derivation is an internal effect of authorized resolution/activation, not a public bypass or new financial permission. Source raw bytes, unknown financial values, grain, edge orientation and profile dimensions remain protected/unmapped. No new dependencies or services.
