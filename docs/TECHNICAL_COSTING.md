# MOBLUX OS — Technical Costing Foundation v1

Completed 2026-10-01. This is a bounded technical costing layer, not a complete business/project cost or selling-price engine. It reads existing immutable Material BOM, OptiCut, Hardware and Machining reports without rewriting, reimporting or duplicating them. No dependencies added.

## Three separate concepts

1. Source/reference prices: existing Hardware BOM raw unit/total strings remain evidence only. The cost line exposes these separately with its source report/page/row. Nothing parses or promotes them into configured rates. Other original source prices remain in their existing protected sources; this increment does not extend those parsers.
2. MOBLUX configured rates: explicit project-scoped, append-only CostRuleVersion records. No price, currency or rate version is seeded for a real project. Exact selectors include category, technical identity/attributes and unit; no supplier, name-based identity inference or wildcard precedence.
3. Calculated project technical cost: immutable CostingRun, referencing exact ProjectVersion, TechnicalModel, rule version and selected input report IDs. Each line freezes quantity/unit, actual configured rate, exact product, rounded subtotal and evidence paths. Source report links preserve full upstream provenance.

## Persistence and rules

Migration 0011 adds `cost_rule_versions` and `costing_runs`. Rules include explicit currency, panel basis, exact-selector rates, change reason, predecessor, request identity/hash, actor/time and an ordering sequence. Editing publishes a new version. Stale predecessors return a conflict. Identical request retries reuse the original version; changed payloads with the same request identity are rejected.

Rates are project-scoped in v1 and can be reused by later technical versions only when their exact selectors still match. Catalog master IDs remain separate from source hardware names. This intentionally avoids introducing global catalog prices, supplier offers or commercial item identities.

A CostingRun pins four nullable input references (Material BOM, OptiCut, Hardware, Machining), rule version and versioned calculation algorithm. Null inputs mean missing coverage, not zero demand. Unique model + rule version + canonical input hash + algorithm makes retries idempotent. Rules/runs are immutable at database level. Guards verify project/model/version/rule ancestry, input ownership/import status and matching Material BOM/OptiCut resolution. Audit commits atomically; audit metadata contains identifiers/counts, not monetary amounts.

The preview is read-only. Saving a run is an explicit authorized action. Changing rates or technical reports never edits a prior run. The UI shows the latest 50 saved runs; older rows remain stored. Historical alternatives are not summed: if more than one report is eligible, the user must explicitly select an exact input. A missing report can be retained in a partial run; it cannot silently produce a complete total.

## Quantity rules

| Category | Basis and exact rate selector |
| --- | --- |
| PANEL | Choose exactly one: net BOM m², OptiCut stock-sheet m², or OptiCut sheet count. Net uses master/thickness/basis; optimized bases additionally distinguish stock dimensions. Never add these alternatives together. |
| EDGE_MATERIAL | OptiCut per-material/thickness meter rows. A net BOM without verified edge orientation has null meters and is NOT COSTED. |
| CUTTING | Explicit OptiCut project cutting length in meters. No allocation or nesting calculation. |
| EDGE_SERVICE | Separately configured service rate on the same explicit edge-length rows; never reuses the material rate implicitly. |
| HARDWARE | Exact source name and literal source-item quantity. No hardware decomposition or supplier identity. |
| DRILLING | Printed legend count × source part quantity, grouped by Gaurire / diameter / literal depth. Labels remain source-local evidence; no face-dependent rates or coordinate-count inference. |
| GROOVE | Explicit Canelura detail length × part quantity, converted exactly from mm to m; source type/width/depth selectors. Do not add project Nut si Feder again. |
| ROUTING | Explicit project Frezare meters only. No allocation to parts or interpretation of contours. BiselTeşit is outside these v1 categories. |

Unresolved material identity blocks a material/edge line even if someone supplies a rate. Machining face/annotation/link uncertainties remain in the pinned source, with a warning; the calculation uses only printed counts and lengths. It does not certify geometry or authorize production.

## Money, missing data and completeness

Decimal strings and BigInt coefficient/scale arithmetic are used for all monetary operations and derived quantities. No floating-point money calculation. Rate input permits non-negative decimals up to six fractional places; explicit zero is accepted as a configured rate. Negative values, exponent notation and malformed rates are rejected.

The versioned rounding policy is half-up to two decimals **per aggregated cost line**; category/project sums use those rounded lines. Exact unrounded products are retained. Supported initial currencies are explicit RON/EUR/USD, all under this two-decimal policy; no conversion. A currency change clears draft UI rates. Adding currencies with other minor-unit policies requires a versioned policy extension.

Missing rates/data retain null rate/product/subtotal as appropriate, with MISSING_RATE or MISSING_DATA. They are never treated as zero. Category totals are null if any of their lines are incomplete. A known subtotal includes only calculated lines and is explicitly labeled partial. Project total is null while any required line or coverage is incomplete. OptiCut failed/unplaced units always prevent a complete project total, even if all reported lines have rates.

## Real fixture quantities and limits

No rules, rates or CostingRun were saved for the real project during verification. Read-only test calculations used explicit synthetic rates in memory.

- Net Material BOM: 8 panel groups, 126.46318129 m², unchanged 21 cabinets / 216 part rows / 280 units.
- OptiCut: 5 panel requirement groups, 25 sheets / 137.76 m². 259 placed units and 21 unplaced units remain distinct; no missing-sheet estimate is invented.
- Four OptiCut edge detail rows sum to **617.70 m**; the independently rounded printed project total is **617.69 m**. Per-material rates use the reported detail lengths, without inventing a rounding allocation. Both upstream values remain unchanged.
- Cutting: 537.04 m.
- Hardware: ten source rows / 698 source quantity, not a claim of 698 purchasable products.
- Drilling: 3774 quantity-extended holes (3467 drawing holes); groups use source type/diameter/depth.
- Grooves: 50 explicit operations / 50.671 m. Routing: project Frezare 48.17 m.
- Three machining Part/Cabinet associations and truncated/face semantics remain source review issues; no reconciliation policy was changed.

Examples below are **test rates only**, never adopted as business rates:

| Calculation | Test result RON |
| --- | ---: |
| 537.04 m cutting × 0.10 | 53.70 |
| 3774 drilling holes × 0.01 across diameter/depth lines | 37.74 |
| 50.671 m groove details × 2.00, rounded per type/width/depth line | 101.35 |
| 48.17 m Frezare × 3.00 | 144.51 |
| Synthetic hardware quantity 3 × 0.125 | 0.38 |

The groove category is 101.35 rather than 101.34 because the specified policy rounds each configured aggregate line before summing. Exact products remain inspectable. No combined full project cost is asserted.

## UI and security

The project displays Costing / Technical cost, category subtotals, known subtotal, missing-rate/data states, line evidence, reference prices and frozen history. Minimal administration in this section lets authorized staff publish a currency/basis/rate version with a reason. When changing the panel basis, save it first so rate fields reflect the new quantity/unit basis. Blank rate means missing; zero must be entered explicitly. Report selection is exposed only as exact technical input configuration, not manufacturing acceptance.

All costing reads/previews/configuration/runs require existing project.cost.view plus project.view, project.import and project.files.download. Changes additionally require cost.configure; saving runs requires cost.calculate. Both are granted to the development administrator by the existing idempotent seed. Explicit denies/customer exclusion/Origin protection remain backend-enforced. UI hiding is not the security boundary. References and rates never reach an unauthorized response.

## Verification and operational notes

- Four focused unit tests passed: exact arithmetic/rounding, missing versus explicit zero, source-price separation, panel alternatives, quantity/provenance selection, unresolved data and failed coverage.
- One focused PostgreSQL/S3 integration scenario passed: isolated synthetic project, rule/run persistence, concurrent idempotency, immutable/ancestry guards, optimistic conflicts, permission/Origin denial, historical preservation, and read-only real-fixture examples/fingerprints. No real project rate was created.
- Typecheck and targeted lint passed. No unrelated suite was repeated.
- Chrome desktop/mobile scenario passed: configure rate, save run, retry without duplication, inspect reference price and prior 0.38 result, and verify no document overflow/page errors. The browser test was made resumable after a laptop restart and a nested history locator was narrowed; no application behavior fix was needed.
- Screenshots were inspected in ignored test-results. Synthetic test projects/rates are clearly marked TEST and persist as immutable test history. Run the costing integration fixture before its browser scenario; the scenario skips if that fixture is absent.
- Existing local application/database/storage processes were reused and left untouched. The prior task-owned alternate API was gone after restart; this continuation launched no application service. Playwright closed its browser/context on completion.

For another computer, use the normal README setup, then `pnpm db:migrate` and `pnpm db:seed` to apply the migration and development capabilities. No package installation beyond the existing lockfile is required.

## Scope and next step

No selling price, markup/margin, VAT, quotation, time tracking, overhead, transport, installation, supplier purchasing, inventory, invoices or AI costing. Next step after owner review: agree and configure real rates, currencies and panel valuation basis, and decide how unplaced requirements are supplied before any total is accepted as complete.

## Configurable Costing Rules extension — 2026-10-02

See CONFIGURABLE_COSTING.md and D49 for the additive owner-authorized configuration, family bases, manual overrides and future-only contracts. These supersede the foundation's limits only for newly configured rule versions. Historical rules/runs and source BOMs remain unchanged. No new migration or dependency.
