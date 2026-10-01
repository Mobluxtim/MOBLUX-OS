# MOBLUX OS — OptiCut Material Requirements Import v1

Implemented 2026-10-01. This increment imports the uploaded OptiCut result; it does not optimize, nest, price or place orders. The normalized net BOM, imported optimization requirement and failed/unresolved requirement remain separate.

## Supported evidence and parser

Profile opticut-6.09-ro-pdf/v1 reads the observed Romanian OptiCut 6.09 PDF. The real source is the existing uploaded 33-page report (SHA-256 32c912d2bdceadd1d8c407d1d58d21764d1b0c05e73b7e973d9be1a7b3ad765e). Summary tables are on pages 6–8; their headings, column order, units, numbering and totals were checked against rendered pages. Original private source bytes are unchanged.

pdfjs-dist 6.3.289 extracts text positions in a worker with empty application environment, 192 MiB old-generation limit, 15-second timeout and at most two concurrent decoders. Input is at most 10 MiB/64 pages; text limits are one million characters and 20,000 items/page. Extraction stops after the technical summary; no cutting diagrams, attached programs or imported URLs are executed. Text rows group baseline positions within two PDF points and sort by x; the parser then requires the observed explicit table headers/cell counts. Unsupported layouts fail closed. This worker is not a production OS security sandbox.

Required panels, edge list, cutting-map list, failed list and technical summary are parsed. Full cutting-list row numbering and quantities reconcile with printed requested totals. Maps reconcile sheet and placed counts; failed quantities reconcile requested minus placed. V1 supports the observed one-sheet-per-map form only. PDF financial columns are skipped and never copied into requirement responses. Scans/OCR, other languages/versions and different layouts are unsupported.

## Immutable persistence and normal project flow

Projects owns optimization_requirement_reports (migration 0008). Each append-only report pins TechnicalModel, the exact MaterialResolutionReport, SourceFile/hash, parser version, actor/time, status and structured result or safe validation failure. The source must belong to the same project and the model's source/base version or exact normalized version. Project label, cutting-row count and requested-unit count must match the normalized model. This checks the associated source dataset, not manufacturing equivalence of every contour.

Unique model + source + resolution + parser makes repeated/concurrent imports idempotent. Insert/audit share a transaction; database triggers enforce source/model/resolution ancestry and reject updates/deletes. Another source/resolution/profile produces separate history. BOM, MaterialMaster, ProjectVersion and approval/release content are never updated.

Normal Project Overview and Technical model automatically ensure these reports once a resolution exists, then refresh while visible. The command examines PDF sources in the permitted version scope, preserves UNSUPPORTED/FAILED outcomes and imports matching reports. Unrelated PolyBoard PDFs are unsupported, not mistaken for OptiCut. No manual report generation, material entry or library selection is needed. Existing source upload handles new PDFs. Multiple imported sources appear as separate alternatives/history, never summed into a single demand. GET history is read-only; switching resolution produces separately pinned report evidence.

Safe model/processing permissions (project.view, project.import, project.files.download), staff-only authorization, Origin checks and exact ancestry apply. Source bytes come from private S3 and are hash/size checked. Storage/integrity/busy failures remain command failures rather than cached successful imports.

## Actual project result

| Measure | OptiCut-reported value |
| --- | ---: |
| Required sheets | 25 |
| Sheet area | 137.76 m² |
| Part area | 112.05 m² |
| Placed units | 259 |
| Requested units | 280 |
| Failed/unplaced | 21 units / 17 rows |
| Waste/scrap | 18.66% |
| Edge-band length | 617.69 m |
| Cutting length | 537.04 m |

| Panel material | Thickness mm | Stock sheet mm | Sheets | Reported area m² | Placed units |
| --- | ---: | --- | ---: | ---: | ---: |
| --PFL--0110 PE(Alb) | 3 | 2800 × 2070 | 3 | 17.39 | 17 |
| --W960 ST7-- | 18 | 2800 × 2070 | 13 | 75.35 | 159 |
| 398 | 18 | 2800 × 1220 | 3 | 10.25 | 6 |
| H1732 ST9 Mesteacan Nisip | 18 | 2800 × 2070 | 1 | 5.80 | 34 |
| H3702 ST10 Nuc Pacific Tabac | 18 | 2800 × 2070 | 5 | 28.98 | 43 |

Four EDGE rows: W960 ST7 23mm / 0.8 mm → 369.96 m; 398 / 1 mm → 102.48 m; H1732 / 0.8 mm → 52.00 m; H3702 Tabac / 0.8 mm → 93.26 m. Exact source names are retained in persistence. Five PANEL and four EDGE groups link by exact category/name/decimal thickness to the pinned resolved masters. Missing or multiple matches remain UNRESOLVED; no synonym or prefix matching.

The printed material areas sum to 137.77 m² and printed edge rows to 617.70 m, while printed project totals are 137.76 m² and 617.69 m. Keep both levels and disclose rounding; do not overwrite totals with line sums. Values retain source precision as strings. No new waste or purchasing calculation is performed. Per-material cutting lengths and aggregate waste percentages are not printed: cutting remains a project total, while waste is retained per material's individual cutting maps.

## Failed items and boundaries

All 17 failed source rows preserve OptiCut row number, literal material/reference/cabinet text, dimension text, failed/requested quantity, literal reason and PDF page/row. Their total is 21 units. Labels/reasons are visibly truncated in the source, including `Panoul nu este disp...` and `Panourile sunt prea ...`; no full reason or normalized Part link is invented. Dimension brackets are preserved, not interpreted as grain/geometry instructions.

The net BOM remains 126.46318129 m² / 280 units / 216 rows / 21 cabinets / 8 materials. OptiCut's 112.05 m² part area is a separate source metric, not a recalculation or correction of that BOM. Stock formats are evidence for this optimization report only, not updates to catalog classification/purchasing metadata. OptiCut edge lengths do not establish PolyBoard edge-slot orientation. No supplier, price, stock, order, costing, hardware, machining or nesting implementation.

## Verification and next step

Four unit tests cover extraction, real totals/hash, safe field selection, malformed/corrupt inputs, consistency, immutability of inputs and failed rows. The real PostgreSQL/S3 integration scenario covers exact links/unresolved/ambiguous linking, persisted results, concurrent retry/audit deduplication, source integrity, denied access, database immutability/ancestry and unchanged model/BOM. Chrome verifies automatic project totals, material/map/edge/failed drill-down on desktop/mobile with no page errors or document overflow. Typecheck, lint and API/web build pass.

Next recommended increment after review: obtain an untruncated structured OptiCut result/export to reconcile failed items to exact Parts and confirm complete failure reasons. Do not infer these from truncated PDF text.
