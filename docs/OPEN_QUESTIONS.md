# MOBLUX OS — Open Questions

Purpose: retain only questions materially affecting architecture or implementation. MASTER_SPEC.md and BUSINESS_FLOW.md remain cumulative authority; owner decisions Q1–Q5 resolve the previously recorded interpretation questions. Architecture baseline v0.1 is approved; implementation is authorized within the current bounded slice.

## BLOCKING architecture questions

None currently identified. No unresolved contradiction between the two specifications blocks the proposed architecture after the owner's clarifications. Technical library choices remain proposals to document before implementation, not questions requiring the owner to select libraries.

## Scoped implementation dependency — real adapter only

Real samples have now been supplied and used to verify the two limited CSV profiles in POLYBOARD_CSV_PROFILE.md. Additional formats and unresolved export semantics still require evidence. This does not block architecture or safe extraction of confirmed fields. Synthetic fixtures validate parser behavior but do not establish compatibility with unobserved vendor formats. See scoped questions Q13–Q15 below.

## Resolved question references

These are history pointers, not open questions; full rationale and consequences are in DECISIONS.md.

| Former question | Resolution |
| --- | --- |
| Q1 | D20: APPROVED is customer approval of one exact immutable ProjectVersion, not production authorization |
| Q2 | D21: Project-level documents allowed; version-sensitive records explicitly reference ProjectVersion; quotation/approval evidence never resolves implicit latest |
| Q3 | D22: samples block only first real adapter implementation/validation, not architecture/framework |
| Q4 | D23: authorized preliminary procurement/reservation may precede release, with permission/audit and no manufacturing authorization |
| Q5 | D24: release payment condition is configured per project through PaymentPlan/PaymentMilestone, never hard-coded 50% |

## NON-BLOCKING architecture questions — resolve at affected implementation phase

| ID | Question | Resolve before |
| --- | --- | --- |
| Q6 | How do PROJECT_PURCHASE and ORDER_PER_PROJECT differ, and how do stock use, pack rounding, waste/minimum-stock policies and unit conversions interact? | Procurement calculations; preliminary procurement is already permitted, but detailed calculation rules are not invented |
| Q7 | Are partial/concurrent releases allowed? How are corrections, cancellation and rework reconciled with releases and preliminary/existing reservations or purchases? What evidence closes a project when acceptance, issues, final payment and warranty activation differ in timing? | Release amendment, allocation reconciliation and completion workflows |
| Q8 | Is initial deployment one company, or must independently isolated companies be supported from the start? | Multi-company schema/auth work if required; single-company deployment remains the initial proposal |
| Q9 | What cloud region, retention/deletion constraints, recovery targets and live-data access expectations apply to files and immutable approval/audit evidence? | Live deployment, recovery and retention controls |
| Q10 | Who may validate/release/override, approve/send purchases and reconcile payments, and must any reviewer be different from the initiator? | Sensitive workflow rollout; capability separation does not itself require different people |
| Q11 | Which invoicing/payment systems and payment evidence sources will be used, and what currency/tax/rounding and target-margin meanings govern commercial calculations? | Financial integrations and costing; project-configured release payment conditions are already decided |
| Q12 | Must shop-floor operation work offline, or is reliable online access available? | Station/timing implementation; offline work changes sync, conflict and authorization design |

## Specification consistency review

The master's broad lifecycle and demo do not define production approval: D20 makes exact-version customer approval explicit, while the addendum supplies ProductionRelease. The master's immutable-version requirement coexists with later commercial records via D21's explicit version references and preserved snapshots. The addendum's typical purchasing-after-release flow does not prohibit the preliminary commitments now explicitly authorized by D23. Its default advance/payment gate and configurable milestones are compatible under D24; an often approximately 50% advance is not a fixed rule. Sample-dependent import mapping remains as stated in the addendum and scoped by D22.

No unresolved direct contradiction was identified after these clarifications. Detailed operational policies in Q6–Q12 remain open implementation choices, not contradictions between the source documents. Preserve the unchanged sources and record future owner interpretations in the decision log.

## Scoped CSV questions — not blockers for safe extraction

| ID | Question | Blocks |
| --- | --- | --- |
| Q13 | What is the official export schema for column 10, dimension-axis/grain conventions and the four edge-pair positions? Owner confirms column 10 remains raw/unmapped, and pairs contain edge material + thickness, with no confirmed LEFT/RIGHT/TOP/BOTTOM mapping. | Grain, rotation, oriented edge or manufacturing calculations; does not block preserving/extracting confirmed fields |
| Q14 | Which of cabinet columns 6/7 is unit versus total price, and what currency/tax/commercial meaning applies? All observed quantities are 1 and both price values match. | Commercial normalization/calculations; raw values remain permission-protected |
| Q15 | Which exported identifier/package convention distinguishes repeated source part numbers and isolated panels, and how should quantities be interpreted when a cabinet quantity exceeds 1? | Cross-file/cross-version identity reconciliation and a complete material requirement set; current row quantities are preserved without deduplication or parent multiplication |

Real samples have now established the two bounded positional profiles in POLYBOARD_CSV_PROFILE.md. The earlier real-adapter dependency remains applicable to additional formats or unverified semantics, not to the implemented partial CSV extraction. No values are inferred for the remaining unknowns.

## Current reconciliation boundary

Q13–Q15 remain unresolved where they affect manufacturing orientation, prices and cross-version identity. The new technical review model can link all 216 real sample rows to 21 uniquely named cabinets using exact source labels. This proves only the selected report pair's links, not a general identifier convention. Other report pairs with repeated/missing names preserve ambiguous/unmapped rows. Parent quantity multiplication and automatic synonym/catalog matching remain unimplemented.

## Library questions — NON-BLOCKING for this completed review increment

- Q16: Which controlled re-export/rename/copy examples or official serialization schema can establish cross-snapshot identifier stability and compatibility beyond the observed grammar? Blocks a general production-quality library importer and automatic cross-snapshot identity merging.
- Q17: Which controlled setting changes establish grain/orientation and Bar profile dimensions/units, including the MDF 060x040 name versus 60/30 numeric conflict? Blocks manufacturing use of those fields. Existing CSV orientation questions Q13 remain separate.
- Q18: What actor/review policy should publish a staged material master or accept a catalog association? Blocks that future publication workflow, not creation of proposals.

BLOCKING questions for the current staging + safe matching increment: none. No new contradiction between the authoritative specifications was introduced or resolved by decoding these files.

## Automatic resolution clarification

Q18 is now resolved for this increment: the owner explicitly permits automatic EXACT_UNIQUE technical associations without per-material approval. No manual exception override or cross-snapshot identity merge was authorized. Q16/Q17 and CSV unknowns remain unchanged. Before implementing future identity reconciliation, establish what evidence permits associating two different source snapshots with one master; before manual exceptions, agree reviewer permissions and acceptable evidence. These are NON-BLOCKING for the current automatic/exception-only flow. Current BLOCKING questions: none.

## BOM scope clarification

Q13 still blocks linear edge-length calculations: the material/thickness pair is confirmed but the four slot-to-dimension mappings are not. The current BOM safely sums exported PANEL rectangles and keeps EDGE lengths null. Finished contour/cut-out allowances and purchasing yield are outside this increment; they are not silently inferred. No new blocking question affects this bounded technical BOM.

## Classification and purchasing basis — NON-BLOCKING for this increment

- Q19: Which verified technical declarations establish the substrate of W960 (18/36 mm), 398 (18 mm), H1732 (18 mm) and H3702 (18/36 mm)? Existing decor/group/thickness evidence does not distinguish PAL, MDF or other construction. These six groups remain UNKNOWN/REVIEW_REQUIRED.
- Q20: Which authoritative evidence establishes purchasing units and available stock-sheet formats? None is confirmed by the analyzed files. These fields stay null; texture dimensions and technical net m² are not substitutes.

No BLOCKING question prevents the bounded classification model and automatic review UI. Evidence collection and any future audited correction workflow must precede filling these unresolved values; no purchasing conversion is implemented.

## OptiCut v1 — NON-BLOCKING limitations

- Q21: Can an untruncated structured OptiCut export provide complete failed material/reference labels and reasons, and stable Part identifiers? This blocks safe failed-item/Part reconciliation; literal PDF rows remain preserved.
- Q22: If multiple optimization runs exist for one technical version, what explicit review policy should designate an accepted run? Current reports are separate alternatives/history and are never summed or manufacturing-authoritative.

No blocking question prevents the current observed-report import. Per-material cutting and aggregate waste are absent in this PDF; do not allocate global values or infer them from names/geometry.

## Machining v1 — NON-BLOCKING source questions

- Q23: What authoritative source resolves page 22 drilling label I (printed count 3 versus 6 coordinate annotations), and pages 247–249 label A (printed count 1 without an extracted coordinate annotation)? Keep printed counts and discrepancies; do not correct by guessing.
- Q24: Which explicit identifiers reconcile the three PDF Paneluri izolate records with normalized CSV cabinet/part records? Exact matching currently leaves them unmapped; do not synthesize a cabinet or use fuzzy matching.
- Q25: What documented export/view convention associates drilling coordinate annotations with faces and machine axes? Diagram labels/coordinates remain source evidence, not executable machining geometry.

No BLOCKING question prevents this bounded report import/review increment. These questions block only future corrected associations or machining execution semantics.

## Machining reconciliation evidence — 2026-10-01

Q23 is partially explained: page 22 label I is three through-hole coordinate pairs displayed on both face drawings, explaining six annotations without changing the three-hole legend. No count correction or general deduplication rule is needed. The original immutable report notice remains historical evidence. Label A remains unresolved: page 249 row 8 is actually truncated as `A (52, 265...` in the PDF; a complete source export is needed for the second coordinate.

Q24 remains unresolved despite three unique non-cabinet candidate tuples: PDF pages 7 and 286–288 group them under Paneluri izolate; CSV rows 177–179 assign Vinuri. No explicit source identifier establishes the cross-group ownership mapping. Q25 remains unresolved for automatic drilling face mapping; explicit groove faces were already captured. See MACHINING_BOM.md reconciliation section for exact evidence and unchanged totals.

## Technical costing foundation — NON-BLOCKING for implementation

- Q26: Which actual currency, panel valuation basis and explicit rates should the owner configure? None is provided or seeded; real project lines remain NOT COSTED / MISSING RATE. Initial calculation policy is documented/versioned in TECHNICAL_COSTING.md.
- Q27: What authoritative additional optimization requirements cover the 21 failed/unplaced fixture units before any complete technical total is accepted? Reported optimized quantities are partial; no guessed sheet/edge/cutting allowance is added.

The eight-category foundation is complete without answering these. They block a complete business-valued result, not the software layer. Selling price, overhead, taxes and the other excluded cost concepts remain future owner-scoped work.

## Payment Conditions v1 — NON-BLOCKING future policy

- Before supporting an explicit no-advance production policy, define the authorized waiver/configuration evidence. v1 returns NOT_CONFIGURED when no production-required milestone is marked, never automatic satisfaction.
- Before carrying money to a revised plan/quote, define the explicit reconciliation/allocation workflow. v1 preserves historical money on its original plan, without invisible transfers.

These do not block the authorized configuration/report/confirm/reversal increment. See PAYMENT_CONDITIONS.md for implemented boundaries.
