# MOBLUX OS — Configurable Costing Rules v1

Owner-authorized extension of Technical Costing Foundation, 2026-10-02. Existing immutable BOMs, source prices, report histories and legacy rule versions remain unchanged. No new dependency or migration.

## Configuration and calculation

CostRuleVersion optionally embeds `configuration.version = 1`. Such rules dispatch `technical-cost/configurable-rules/v1`; older rules retain the original calculator. The existing JSON columns and database immutable/ancestry guards persist these additions. Configured rules use sheets as the primary panel basis, with explicit exceptions:

| Configuration | Basis and boundary |
| --- | --- |
| Panel | Actual OptiCut sheet count × configured price/sheet, distinguished by material/thickness/stock dimensions. Net and optimized areas are not additional charges. Missing sheet requirements remain missing. |
| Glass | Evidence-backed master mapping replaces its sheet charge with net BOM m². No classification inferred from names. |
| Doubled panel | Explicit final 36 mm master → two identical 18 mm layers. Net layer consumption is twice final face area. One DOUBLING charge uses final face area once. Actual layer sheet counts/dimensions require separately allocated evidence; they are not inferred from area or the 36 mm optimization. |
| Edge material | Explicit meters or whole rolls using a verified roll length and exact ceiling division. This is a costing basis, not inventory or ordering. |
| Edge service | Separate meter-based charge, optionally assigned to a family with evidenced width/thickness/type criteria. Final-thickness source demand remains unchanged after bonding. |
| Cutting | INTERNAL uses reported meters; EXTERNAL replaces that line with reported meters or an explicit service quantity. Separate selectors prevent silent rate reuse. Both modes cannot charge the same work. |
| Drilling family | Exact type/diameter/literal-depth members, per hole. Special Ø35 and through-hole groupings require explicit assignment, not inferred face semantics. |
| Groove family | Meters or width × length in m², multiplied by source part quantity. Original geometry remains in the pinned report. |
| Routing family | Meters where reported. Selecting m² requires sufficient reported geometry; current project Frezare lacks width/area and stays MISSING COST BASIS. |

Active family membership is exclusive per costing category. Families replace their member lines; they do not add another charge. Family rates are configured on the family itself. Unassigned operations retain exact individual selectors. No wildcard identity or undocumented source semantics are inferred. Historical selectors remain stored when absent from current inputs.

Doubling allocation must exclude sheets already charged for ordinary 18 mm demand. Configuration requires evidence, validates material category/thickness, and never changes MaterialMaster or source BOMs. Missing layer allocation stays null. Unconfigured 36 mm materials remain ordinary sheet materials. Missing identity, quantity, geometry or rates never become zero.

## Price sources and overrides

1. PolyBoard/source reference strings remain evidence only.
2. MOBLUX configured rates remain immutable project-scoped rule versions.
3. Supplier/historical price contracts are future placeholders, never automatic fallbacks.
4. A project/version manual override replaces one line amount in a **new** immutable CostingRun.

An override preserves base run, exact project/version/input/rule IDs, replaced rounded and exact values, full override value, actor, timestamp, optional reason and idempotency request/hash. The backend derives the original amount from the owned base run. Configured rates, reference prices and previous runs remain unchanged. Chained overrides retain their base-run chain; overrides never propagate automatically to later input/rule versions. Missing technical basis and failed-part coverage remain unresolved even when a manual amount is supplied.

Every override requires `cost.override` plus existing financial/project/evidence permissions. Retries return the same run; a changed payload with the same request ID fails. Audit and insertion are transactional; generic audit metadata contains IDs/selectors, not monetary values. Development setup uses the existing idempotent seed to grant the new capability. No rates are seeded.

## UI and precision

The existing project Costing section contains configuration, exact input selection, category/line amounts, evidence and immutable history. Enable configurable rules, save the selected bases, then enter rates for the resulting selectors. Families, glass/doubling/edge mappings and cutting mode have form controls in that section. Saved runs expose a one-line override form and clearly show MANUAL OVERRIDE, replaced amount and actor/time/reason. Live preview continues to show configured calculation, not a silently adopted override.

Monetary readouts display at most two decimals. Editable rate/override inputs retain full entered precision. Calculations use decimal strings/BigInt; exact products remain stored, and the established line half-up rounding policy remains unchanged. Unparsed source-price strings are marked unparsed and remain available in the original source.

## Future boundaries

Workstation configuration stores nullable purchase cost, useful life, productive hours, labor, energy, tooling, maintenance and overhead. Missing fields show INCOMPLETE / MISSING DATA; complete configuration shows CONFIGURED / NOT CALCULATED. No amortization or workstation charge is computed. Currency changes clear draft monetary configuration, with no conversion.

Contracts reserve HardwareCostIdentity (item/kit, namespaced codes, component identities), FutureCommercialPrice (supplier product, currency, amount, validity/source), FutureRemnantReference and FutureProjectCostDimension. These do not create a supplier catalog, kit decomposition, stock, orders or remnant optimization. Hardware BOM quantities stay authoritative. Engineering/designer, labor, assembly, installation, transport, external services and overhead are extension points only.

No selling price, margin, VAT, quotation, inventory, purchasing, automatic orders, nesting, time tracking, machine amortization or AI.

## Evidence and verification

Real fixture checks are read-only and save no rates: 25 sheets, 3774 quantity-extended holes and **0.3842135 m²** groove processed area from explicit widths/lengths. Routing area remains missing. The 21 cabinets / 216 part rows / 280 units / 8 materials and source fingerprints remain unchanged. Unplaced requirements still prevent a complete project total.

Targeted tests cover legacy replay, sheet/glass/doubling exclusivity, roll counts, cutting exclusivity, family membership and area bases, missing data, overrides, immutable history, idempotency, permissions and real-source fingerprints. See IMPLEMENTATION_REPORT.md for final browser/check results.
