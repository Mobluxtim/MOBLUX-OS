# MOBLUX OS — PolyBoard Hardware BOM v1

Completed 2026-10-01. Import only the project-level Feronerie summary in the observed PolyBoard 8.02c Romanian PDF. Do not reinterpret source terminology or infer manufacturer, supplier, SKU, category, commercial identity or production operations. Material BOM, OptiCut requirements and MaterialMaster remain unchanged.

## Evidence and extraction

The real 288-page source has SHA-256 984be25181e595247ece448d3cc487652f2d35e4f25ed43d322498fd7fcda90f. Its project summary is on page 9. Rendered inspection and PDF text-cell extraction confirm the Feronerie / Cantitate / Pret unitar / Pret columns. All ten rows are imported exactly once; cabinet chapters and adjacent Frezare/BiselTeşit/Nut si Feder/Forma sections are excluded.

The shared PDF worker retains its existing two-worker, 15-second, 192 MiB old-generation, 10 MiB input and text/item limits. The hardware profile permits documents up to 512 pages but scans at most the first 32 pages, stopping at the first project cost-summary page. It requires the PolyBoard signature, consistent project/page headers, project overview and cabinet-list preamble, exact hardware header and terminating Total. Changed/truncated/duplicate rows, missing totals and unsupported layouts fail closed. Multi-page hardware summaries are not supported by v1. OptiCut's existing limits remain unchanged. No new dependency.

## Persistence, automatic workflow and security

Migration 0009 creates append-only hardware_bom_reports. Each report pins an exact normalized ProjectVersion, TechnicalModel, SourceFile/hash, parser version, actor/time and status. Source ancestry must be the same project's exact model or base/source version. The parsed project label must match the model. Unique version + source + parser makes retries idempotent; a new version/source/parser has separate history. Immutable and ancestry triggers protect storage; audit commits atomically.

Normal project Overview and Technical model automatically ensure reports without a manual import action or material-library visit. Hardware does not depend on catalog matching success and does not use material resolution as its identity. Multiple source reports remain separate alternatives/history, not additive quantities. GET history is read-only. Original bytes remain private and hash/size verified; unsupported PDFs are recorded separately, not treated as hardware.

Existing project.view + project.import + project.files.download, staff-only authorization and Origin checks apply. Source prices are stored exactly as reference strings, without conversion to current prices, costing or supplier offers. The API omits every unit/row/report price field unless project.cost.view is granted and not explicitly denied. Audit contains no source prices. Safe quantities/provenance remain available without financial permission. Missing source prices remain null; no price is calculated.

## Real result

| Exact PolyBoard source name | Quantity |
| --- | ---: |
| dowel/8-30/21-11 | 8 |
| dowel/8-30/x2/space-50/screw-05 | 8 |
| dowel/8-30/x2/space-64 | 24 |
| dowel/8-30/x2/space-64/screw-03 | 51 |
| dowel/8-30/x2/space-64/screw-05 | 4 |
| Hettich/Cam-DU232/Rastex15/p18/2-dowel/interior | 334 |
| Hettich/hing.Sensys-Inset/TH 52x5.5 mm | 12 |
| Hettich/hing.Sensys-Overlay/TH 52x5.5 mm | 35 |
| hole/03 | 78 |
| peg-05/32-5/below/3D | 144 |

Ten rows, sum of source quantities 698. This sum is not a claim of 698 purchasable physical products: source names may describe compound constructs or holes. No decomposition or multiplication is inferred. Each item retains its PDF page/row and exact source name. All source unit/total prices and the printed summary total are retained behind financial access, solely as historical reference values.

## Verification and next step

Three hardware unit tests, one real PostgreSQL/S3 integration scenario and four OptiCut regression tests passed (eight results, zero skips). Coverage includes exact names/quantities, missing prices, malformed summary rejection, source hash, provenance, concurrent reuse, audit uniqueness, immutable/version ancestry, financial redaction and denied access. The existing technical model, Material BOM and OptiCut history remained unchanged.

Typecheck, lint and API/web build passed. Chrome verified automatic project display, all requested example quantities, source-price/provenance drill-down, coexistence with the other BOMs, and desktop/mobile rendering without page errors or document overflow. Final screenshot review required only waiting for the mobile sidebar animation in the test; no application fix. No blockers within the bounded observed-format scope.

Next recommended increment after review: confirm the meaning and purchase-unit relationship of source hardware constructs using authoritative evidence before introducing any hardware catalog mapping. No supplier, current-price, inventory, purchasing, costing or machining feature is included.
