# MOBLUX OS — Implemented PolyBoard Library Staging Profile

This documents the bounded review importer implemented after the structural investigation in POLYBOARD_LIBRARY_ANALYSIS.md. It is not a general PolyBoard format specification or production manufacturing certification.

## Supported structure and limits

`polyboard-library-observed/v1` supports only Panel.mat-boole, Edge.mat-boole and Bar.mat-boole with the observed category signature, container discriminator, length, BZh9 stream and sequential serialization grammar. It consumes every record and the complete payload; it does not scan for UUIDs or recover guessed boundaries. Unsupported extensions, duplicate candidate identifiers within a file, invalid strings/counts, truncation, CRC failure and trailing data fail without partial records.

Limits: 256 KiB compressed input; 1 MiB decompressed output; 2,000 records; 4,096 UTF-16 code units per string. The installed seek-bzip 2.0.0 decoder runs in a worker thread with an empty environment, five-second timeout, 64 MiB old-generation limit, bounded output and at most two concurrent decoders. Worker isolation is a resource boundary, not a general hostile-code sandbox. No uploaded code executes. Saturation returns a retryable error, not a permanently failed snapshot.

## Evidence and confidence

| Field | Confidence and permitted use |
| --- | --- |
| Original bytes, SHA-256, category signature, stored count, sequential ordinal/offsets | Confirmed structural evidence; exact source/provenance and deterministic enumeration |
| Exact name, grouping string, texture strings | Confirmed text extraction; group is not automatically a manufacturer/family and paths are not physical dimensions |
| Candidate identifier bytes / UUID rendering | Confirmed bytes, candidate external identity; cross-snapshot stability unproven; never the MOBLUX material primary key |
| Eight Panel and five Edge thicknesses | Corroborated against the prior real CSV analysis, including mm; explicit source-hash + candidate-ID evidence manifest only |
| Other Panel/Edge tail numeric candidates | Medium-confidence candidates, never automatically promoted merely by equality with a project value |
| Grain/orientation flags, financial-looking values, extensions, counters, Bar dimensions/properties | Raw/unmapped; no manufacturing, financial or supplier interpretation |

The original analysis hashes reproduce 372 Panel / 84 Edge / 43 Bar records. Only the 13 independently corroborated entries carry a thickness value usable for exact proposals. Other records remain inspectable without acquiring that confidence. A new source hash requires new corroboration; matching names do not inherit it. All raw record bytes and payload/container prefixes remain preserved for reprocessing. Normal review responses omit these byte blocks because they may contain sensitive financial data; explicit raw access has a separate permission.

## Persistence and identity

Each immutable `library_snapshots` row represents one source category/file, with a MOBLUX snapshot UUID, filename, source hash/size, parser version, actor/time, status, count, private versioned S3 object reference and bounded JSONB result. Records have MOBLUX-generated deterministic IDs scoped by parser/source hash/ordinal, plus separate candidate source bytes/UUID. Category, hash and parser version form the idempotency key. Concurrent retries serialize and reuse the same snapshot and audit event; names alone never deduplicate records. Failed recognized upload requests preserve the original with FAILED status and zero staged records. Oversized or invalid upload envelopes are rejected before staging.

The catalog type boundary distinguishes MaterialMaster, PanelMaterial, EdgeMaterial and BarProfileMaterial. This increment does not publish material masters or create supplier products. Project technical materials remain version-scoped identities. Supplier products, prices, inventory and purchasing remain separate future concepts.

## Matching proposals

`exact-corroborated-library/v1` compares category, exact case-sensitive name, decimal-normalized thickness and corroborated mm. It accepts one explicit successful snapshot per selected category. There is no fuzzy alias correction or cross-category substitution.

- EXACT_UNIQUE: one corroborated candidate and no competing unresolved candidate at the requested thickness.
- AMBIGUOUS: multiple corroborated candidates satisfy the criteria; none selected.
- REVIEW_REQUIRED: a same-name candidate lacks sufficient thickness evidence, or the relevant category was not supplied.
- NO_MATCH: no candidate satisfies the confirmed criteria.

Immutable `library_match_reports` reference an exact technical model, selected snapshot IDs, matcher version, actor/time and every request/candidate/source reference. Model + sorted snapshot-set hash + matcher version deduplicates retry commands. Edge requests deduplicate exact material/thickness/unit pairs while retaining every part/slot reference. Reports and audit commit together. No project/version/material row is updated and a proposal does not approve, technically validate or release production.

## Review and future compatibility

The internal Material Library screen provides category tabs, upload/reuse, snapshot metadata, search/pagination, safe decoded fields, provenance, raw indicators, permission-gated raw inspection/download and text-only texture references. Matching results persist and can be filtered by all four statuses. No path is fetched, opened or rendered as an image.

Future general-format support requires additional/controlled snapshots, documented or experimentally verified extension semantics, cross-snapshot identity evidence and a separately reviewed parser version. Confidence changes require evidence, not merely successful decoding. See OPEN_QUESTIONS.md; no unresolved question blocks the current review-only increment.

## Current automatic resolution extension

The owner now permits EXACT_UNIQUE to create/reuse internal MaterialMaster identities and automatic technical links in separate resolution reports. All parser/confidence limits above remain unchanged. Explicit active snapshots remove per-project manual selection; historical manual proposal reports remain available for diagnostics. MATERIAL_RESOLUTION.md defines the authoritative implemented flow and source-scoped identity reuse. Automatic links are not supplier assignments, prices, stock, approvals or releases.
