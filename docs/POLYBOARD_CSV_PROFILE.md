# MOBLUX OS — Verified CSV Profiles, Increment 2

Date: 2026-09-29. Scope: the two real CSV layouts uploaded to the owner's test project. This is a sample-derived positional adapter, not a claim that every PolyBoard CSV follows these columns. The accompanying PolyBoard report identifies version 8.02c; the CSV itself has no producer/version declaration.

## Evidence and inspection

Original objects were read by exact object revision and checked against their stored SHA-256. Private working copies stay under ignored .local/sample-review. No customer exports, PDF extracts or real record fixtures were added to Git.

| Source | SHA-256 | Observed structure |
| --- | --- | --- |
| Cabinet CSV | 00807846445ab8a341b942742299ccd8b0e4a0ccec94bc3f83119dfd5ba49398 | 926 bytes; UTF-8 BOM; semicolon; CRLF; no header; 21 rows, 7 columns |
| Cutting CSV | 172c1b97adced57b0843496c10e5437de7e287914f7f0273c49d08fe882bf41b | 38,142 bytes; valid UTF-8 without BOM; semicolon; CRLF; no header; 216 rows, 18 columns |
| Supporting PolyBoard PDF (1.pdf) | 984be25181e595247ece448d3cc487652f2d35e4f25ed43d322498fd7fcda90f | 288 pages; cabinet table p2, cutting tables p2 onward; p2, p6 and p7 visually inspected |
| Supporting OptiCut PDF (2.pdf) | 32c912d2bdceadd1d8c407d1d58d21764d1b0c05e73b7e973d9be1a7b3ad765e | 33 pages; text cross-check of parts/materials/quantities |

PDFs provide evidence for mapping; imported values always come from CSV bytes. DXF and 3DS originals were integrity-checked and remain unparsed. No mesh, machining, room or CNC mapping is claimed.

## Profile: polyboard-cabinets-7/v1

| 1-based column | Mapping | Evidence / limit |
| --- | --- | --- |
| 1 | Cabinet source name | Matches the named cabinet table in PDF p2; not a stable external ID |
| 2 | Quantity | Matches PDF p2; every observed value is 1 |
| 3 | Height, mm | Cabinet table explicitly labels height and mm |
| 4 | Width, mm | Cabinet table explicitly labels width and mm |
| 5 | Depth, mm | Cabinet table explicitly labels depth and mm |
| 6, 7 | Raw price values only | Match the two PDF price values, but all quantities are 1 and both prices match. Unit/total order is therefore not proved. No currency code, tax or pricing policy is inferred |

Result: 21 source cabinet rows / 21 exported units. Price-bearing reports require project.cost.view in addition to import/view/file capabilities. No commercial calculation or quotation is created.

## Profile: polyboard-cutting-18/v1

| 1-based column | Mapping | Evidence / limit |
| --- | --- | --- |
| 1 | Source part/reference number as text | Corresponds to cutting report number; repeats, including within a cabinet group. Not a primary key |
| 2 | Source project label | Owner-confirmed and matches report context; never replaces the canonical Project ID |
| 3 | Source cabinet label | Owner-confirmed; preserved without guessing rooms or merging with another import |
| 4 | Part/reference description | Matches cutting/OptiCut report descriptions |
| 5, 6 | First and second exported dimensions, mm | Values match structured cutting dimensions; order is preserved. Do not universally rename these height/width or length/width: some records are swapped relative to PDF axes |
| 7 | Exported quantity | Whole-number row quantity; retained once per row; no multiplication by a guessed parent quantity |
| 8 | Material description | Matches material group descriptions; exact case/spelling retained; not an automatic catalog match |
| 9 | Material thickness, mm | Matches material/thickness report groups and owner-confirmed field set |
| 10 | Raw unmapped string | All 216 observed values are -1, while PDF p3/p7 has both no/yes grain indications. Never interpret as grain/fiber |
| 11, 12 | Raw edge slot 1: material + thickness, mm | Pair meaning confirmed by owner; side null |
| 13, 14 | Raw edge slot 2: material + thickness, mm | Pair meaning confirmed by owner; side null |
| 15, 16 | Raw edge slot 3: material + thickness, mm | Pair meaning confirmed by owner; side null |
| 17, 18 | Raw edge slot 4: material + thickness, mm | Pair meaning confirmed by owner; side null |

Result: 216 rows, 280 exported units, 21 source cabinet labels and 8 exact material-description/thickness combinations. Repeated source-number warnings occur at rows 178, 179 and 193; every row is retained. Isolated panels and repeated numbers prohibit treating a source number as a canonical/global identity.

Owner clarification: the business uses a 1/0 grain-control convention and the first dimension determines grain direction in that workflow. This is NOT a confirmed mapping of CSV column 10. The owner's final instruction explicitly keeps column 10 and edge side orientation unmapped and excludes them from manufacturing calculations. Do not derive a grain boolean, rotation permission, edge side, net-size correction or machining axis from these exports.

## Implemented lifecycle and controls

Upload remains immutable and pending until an authorized user explicitly selects a profile and chooses Analyze CSV. No filename-based or column-count-only auto-detection. The parser runs through the import module boundary; other domain modules consume canonical fields rather than vendor offsets.

A new csv_import_attempts row stores the selected versioned profile, immutable result, actor, time and request UUID. Its source foreign key leads to exact project/version/object revision/hash; each normalized row carries its source record number, physical start line and original cells. A source may have multiple attempts; the original upload assessment is not rewritten. UI shows the latest assessment and lets staff open every earlier saved report. Retries with the same request UUID return the same attempt; conflicting profile reuse fails. Import and audit are committed together.

The result is NEEDS_REVIEW for successfully extracted data, or FAILED for malformed/unsupported data. A failed parse never exposes a partial normalized dataset. No READY_TO_PUBLISH, approval, manufacturing validation or ProductionRelease is manufactured. No existing ProjectVersion is changed. Later authorized publication must create another immutable version containing its exact source/attempt manifest.

Bounded plain-text parsing uses strict UTF-8, semicolon fields, escaped quotes and multiline fields. Maximum 1 MB, 5,000 records, 18 columns and 4,096 characters/cell; diagnostics are bounded. Invalid decimals, non-integer/non-positive quantities, incomplete edge pairs, mixed column counts, control/binary bytes and malformed quotes fail with row/column context where available. Decimal text remains exact, without float rounding. Empty edge slots remain empty rather than zero.

This small bounded synchronous staging command needs no durable queue yet. It executes no imported code, formulas, URLs, PDFs or CAD converters. Private original upload allowance remains 20 MB, but CSV parsing is capped at 1 MB. Larger sources remain preserved. Malware scanning and isolated converters remain requirements before active rendering/conversion or broader untrusted-file processing; this is not a production security certification.

## Verification

- 14 unit tests passed, including nine new CSV-specific cases for mapping, raw provenance, quoting, encoding, limits, decimals, duplicates, unknown values and wrong profiles.
- Real PostgreSQL/S3 integration: five subtests plus parent passed. New assertions cover immutable attempts, authorization/financial visibility, invalid profiles, wrong-project access, idempotency, history, audit and unchanged version snapshots.
- Both real sources imported through authenticated application services and all parsed original cells compared with the complete CSV contents. All original downloads and every existing project-version snapshot remained identical.
- Browser verification covers explicit profile choice, a successful 26-row synthetic import, row pagination, persisted history after refresh, failed wrong-profile attempt, access to previous report, activity and mobile layout.
- Real samples stay local; automated repository fixtures use invented names/values and are explicitly synthetic. They validate behavior, while the separate real-source run establishes compatibility with the two observed files only.

See OPEN_QUESTIONS.md for unresolved export semantics. No new dependency, supplier-specific domain rule, Git configuration change, commit or push is required.

## Final verification after continuation — 2026-09-30

The final mobile screenshot was reviewed and the saved Playwright run confirms passed/no failed tests. The complete browser suite previously passed two scenarios; the CSV scenario passed again after the mobile-width correction. Final API/Next production build, root/frontend type checks, ESLint and all 14 unit tests passed after continuation. The real-service integration result remains five successful subtests plus the parent. No further implementation increment was started.
