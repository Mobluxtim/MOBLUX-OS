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
