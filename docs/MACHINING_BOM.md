# MOBLUX OS — PolyBoard Machining BOM v1

Implemented and verified 2026-10-01. Bounded import of the observed PolyBoard 8.02c Romanian project PDF; no machining generation, CNC execution, tool selection, scheduling, rates, supplier data or costing.

## Source evidence and confidence

The preserved 288-page fixture has SHA-256 `984be25181e595247ece448d3cc487652f2d35e4f25ed43d322498fd7fcda90f`. Independent extraction of the existing PDF text, PDF-cell inspection and rendered pages 50/51/240 corroborate the fields below. Private source and screenshots stay in ignored local storage.

- Confirmed: literal Gaurire labels, printed counts, Diametru and Adancime strings; numeric diameter/depth in the report's mm convention. `Strapuns (0)` stays literal, with numeric depth null rather than zero.
- Confirmed: Canelura Orizontal/Vertical rows explicitly report Fata, X Pozitie, Y Pozitie, Latime, Lungime and Adancime. These are retained under their source convention; no machine-axis conversion.
- Confirmed: project summary Frezare, BiselTeşit and Nut si Feder labels and printed meter values. Prices are not extracted. The two numbers in a Nut si Feder label remain a literal label, not a newly inferred schema.
- Source geometry: exact private PDF remains authoritative. Diagram text, coordinate annotations, face labels, page/row and PDF text positions are retained. Repeated annotations are not deduplicated. There is no vector contour, toolpath or CAD reconstruction.
- Unresolved: drilling coordinate-to-face/view association and machine coordinate transformation. A nearby Fata label is not assigned to all drilling operations, because a sheet may show multiple face/edge views. Drilling face remains null; diagram face labels stay evidence.

## Enumeration and aggregates

The parser requires a complete, bounded document and consistent producer/project/page headers. There are 258 part drawing pages, grouped into 216 part records by explicit drawing continuation counters, reference and exact headers. Missing/duplicate/inconsistent continuations fail closed; legends are counted once, never once per drawing page. Duplicate operation labels in one part fail rather than guessing.

Part counts are the printed drawing-legend counts. Quantity-extended counts explicitly multiply each drawing count by its printed part quantity, with no cabinet multiplier. This is a reproducible technical derivation, not machine cycles or a production authorization. Quantity-two drawing page 240 independently shows four A and eight B holes per drawing, corroborating the distinction. Both count bases remain visible. Unknown source geometry is never used to add/subtract holes.

Cabinet and project totals sum these part aggregates. Grouping uses exact PDF cabinet labels; source groups with no unique normalized association remain identifiable and unlinked. Source project lengths and detailed groove lengths are separate views and are never added together. Rounded summary lengths are not reconciled by altering detail values.

| Real result | Value |
| --- | ---: |
| Part records / drawing pages | 216 / 258 |
| Drilling legend groups | 555 |
| Printed drawing holes | 3467 |
| Drawing holes × source part quantity | 3774 |
| Explicit groove operations | 50 |
| Detailed groove length | 50671 mm |
| Frezare, project summary | 48.17 m |
| BiselTeşit, project summary | 7.41 m |
| Nut si Feder, `3.5 mm (6.5 mm)` | 36.88 m |
| Nut si Feder, `18.5 mm (6.5 mm)` | 13.79 m |
| Exact Part/Cabinet links | 213 |
| Unmapped part records | 3 |

Representative drilling legends: page 11 A (12), diameter 8, depth 11; B (6), diameter 5, depth 12. Page 13 C (8), diameter 8, depth 21; D (4), diameter 5, depth 14; E (4), diameter 8, depth 30; F (4), diameter 15, depth 13.8. These are source-local labels, not global operation identities.

Two source discrepancies remain visible: page 22 label I prints 3 but has 6 coordinate annotations; pages 247–249 label A prints 1 but has no extracted coordinate annotation. Printed counts are retained; no correction is inferred. There are 22 PDF source groups: 21 linked cabinets plus Paneluri izolate. Three isolated panels lack exact CSV cabinet/name associations and remain unmapped, with their complete source record. Together these produce five part records needing review. This does not change the existing 21 cabinets / 216 rows / 280 units / 8 normalized materials.

## Persistence and automatic workflow

Migration 0010 adds immutable machining_bom_reports, separate from every previous BOM and MaterialMaster. A report fixes TechnicalModel, ProjectVersion, SourceFile/hash, parser version, actor/time/status and nested part operations, links, evidence and aggregates. Unique version/source/parser and a transaction lock make concurrent retries idempotent. Database guards enforce immutability, exact model/source ancestry and linked Part/Cabinet/CSV ancestry; import and audit commit together.

Exact matching requires cabinet label, source part number, exact part name/material, both dimensions, thickness and quantity. Numeric formatting differences are compared numerically, without changing axes or fuzzy text matching. Multiple candidates are AMBIGUOUS; absent exact evidence is UNMAPPED. Existing versions and technical rows are never updated. Alternative source reports remain separate history, not additive quantities.

Normal project Overview and Technical model invoke the idempotent command automatically and refresh while visible. The UI offers cabinet → part → operation/coordinates/source evidence and report provenance, independently of catalog resolution success. GET history is read-only. No manual import/report selection is required.

## Safety and bounded parser

Same staff-only project.view, project.import and project.files.download capabilities, Origin protection, private object/hash/size verification and atomic audit as existing source imports. Safe responses include no source prices. Unrelated PDFs are UNSUPPORTED; invalid known reports publish no partial result. Storage/integrity failures and parser-busy responses are not cached as permanent results.

The shared PDF worker gains one fixed machining profile scanning at most 512 pages, required for this 288-page source. The existing 10 MiB input, 1 million characters, 20,000 items/page, two workers, 15-second and 192 MiB old-generation limits remain. Hardware and OptiCut scan limits remain unchanged. No dependency added. This observed-format parser is not certification for arbitrary PDFs or a production OS sandbox.

## Verification

Four machining unit scenarios passed, including real source/hash/counts, representative depths/counts, continuations, exact/ambiguous/unmapped linkage, coordinate discrepancies and corrupt/unsupported rejection. Seven affected shared-parser Hardware/OptiCut regression scenarios passed. One real PostgreSQL/S3 integration scenario passed: persistent history, concurrent reuse, unique audit, immutable/ancestry guards, access/Origin denial and unchanged previous model/BOMs. All real-fixture checks ran without skips.

Typecheck, lint and API/web build passed. Chrome desktop/mobile verified automatic project display, cabinet/part/coordinate drill-down, real exceptions, report evidence and coexistence with Hardware/Material/OptiCut; no page errors or document overflow. An initially broad browser test locator was narrowed; no UI defect was found. An integration expectation was corrected to distinguish 22 PDF source groups from 21 actual cabinets.

Next proposed increment, subject to owner review: evidence-backed reconciliation of the isolated-panel identifiers and the two drilling annotation discrepancies. Face/coordinate mapping requires authoritative export evidence before any CNC or manufacturing use.
