# MOBLUX OS — PolyBoard Material Library Structural Analysis

Date: 2026-09-30. Status: evidence-based investigation, not an implemented importer or an approved catalog schema.

Only Panel.mat-boole, Edge.mat-boole and Bar.mat-boole from the owner's PolyBoard_Library_2026-09-30 directory were examined. The existing, previously analyzed cutting CSV was read solely to compare its material names and thicknesses. No other reference-library files, images or PolyBoard installation were inspected. Originals, application code, database, UI and existing project versions were not changed.

## Conclusion

These snapshots are sufficiently structured for a bounded, read-only extraction prototype and catalog review. They do **not yet establish a production-quality general PolyBoard library importer**. All 499 candidate records can be deterministically enumerated in these files, matching their stored counts; variable serialization blocks and undocumented semantics still need validation against controlled exports and additional library versions.

All eight panel name/thickness combinations and all five edge name/thickness combinations already encountered in the real project have unique matching library candidates. This is evidence of correspondence, not a published catalog link or manufacturing authorization.

## Files and integrity

| File | Original bytes | BZip2 stream offset, zero-based | Decompressed bytes | Stored count / extracted records |
| --- | ---: | ---: | ---: | ---: |
| Panel.mat-boole | 16,330 | 30 | 83,759 | 372 / 372 |
| Edge.mat-boole | 4,539 | 29 | 19,882 | 84 / 84 |
| Bar.mat-boole | 2,422 | 28 | 8,971 | 43 / 43 |

SHA-256 values, identical before and after inspection:

```text
Panel 66ab704b818a96315a46c8d09f65c0e79cd347e2a072331b081e2f8696907cbf
Edge  eb3d91d4cf1271e4bf4e4c6f300b272c7d99590c0de1177dcd694088d593de50
Bar   68755b5f71add0940107355a01f32033f4f0b3a671516a4f33d5cc0800190bd1
```

Each file contains one valid BZip2 stream with no trailing compressed-stream data. Standard-library decompression completed, including its integrity checks. No original file was rewritten or recompressed.

## Repeatable binary structure

### Container

1. ASCII signature: `bo:materials:panel`, `bo:materials:edge` or `bo:materials:bar`.
2. Four opaque bytes: respectively `a5 60 f6 61`, `b5 ff ab 8c`, `4a f0 30 e6`. Their meaning is unknown; do not call them a checksum or library ID without evidence.
3. Little-endian uint32 value `4`, common to all three files. Possibly a format discriminator, but its meaning is unconfirmed.
4. Little-endian uint32 equal to the remaining compressed byte length: 16,300 / 4,510 / 2,394.
5. `BZh9` compressed stream containing a binary object sequence, not CSV, XML or JSON.

### Decompressed payload

- At byte offset 5, a little-endian uint32 equals the observed record count: 372 / 84 / 43. The surrounding prefix remains opaque.
- The first record name length occurs at byte offset 27 in every payload.
- Names use a uint32 UTF-16 code-unit count followed by UTF-16LE text, without a required terminating NUL.
- Immediately after each name is a 16-byte value. All 499 have UUID version-4/variant-compatible bit patterns when rendered in byte order as UUIDs; all are distinct across these three files.
- Next comes another length-prefixed UTF-16LE string: a free-text grouping label, often empty.
- Repeated numeric/object-reference-like prefixes lead into a primary appearance block with a length-prefixed image path, or an empty string. Ordinary records place the path length at group-end +21 bytes; the first record in each file uses +36 bytes. This exception matters.
- After a primary path, ordinary records share a 40-byte block that can be decoded mechanically as uint32, four raw bytes, float64, float64, uint32, uint32, eight raw bytes. **These are storage types, not verified business meanings.** Positive infinity occurs in float fields.
- Variable extension data follows. Panel records contain tags with raw bytes `siv\0`, `tsoc`, and `ecaf`, with differing payload lengths and nested appearance data. Reversed tag spellings are not proof of semantics.
- Panel records end with an observed float64 / one byte / float64 pattern. Edge records end with two float64 values. Bar records contain two dimension-like float64 values followed by additional serialization data and another float64.
- First-record initialization blocks differ from subsequent records; nested Panel blocks also prevent treating this as one universal fixed-width format.

Offsets above refer to decompressed bytes, not the original compressed file. Full raw record bytes, ordinal, offsets, source hash and opaque spans should accompany any future extraction.

### Enumeration confidence and limits

The investigation located length-prefixed printable names followed by UUID-compatible 16-byte values and valid grouping strings. It obtained exactly the stored record counts, in source order, with coherent appearance paths and numerical tails. Repeated runs gave identical results. This is a deterministic enumeration of **these snapshots**, not a fully specified sequential deserializer for arbitrary versions. UUID-pattern scanning alone must not be accepted as the future production parser: it could miss another identifier format or mistake nested data for a record.

## Panel.mat-boole

### High confidence

- 372 records, 372 distinct candidate UUIDs, exact display names and grouping strings.
- Primary image references: 282 nonempty and 90 empty. Two further nonempty references occur in nested blocks, for 284 occurrences / 227 distinct paths overall. A blank primary path does not mean the material has no texture.
- Names and paths preserve reference/decor tokens such as `H1732`, `ST9`, `H3702`, `ST10`, `W960`, `0110 PE` verbatim.
- The float at record-end minus 17 bytes matches all eight confirmed project panel thicknesses exactly: 3, 18, 22 and 36 mm. Its use as thickness is strongly corroborated for those matching entries.
- The following single byte is always 0 or 1: 183 zero / 189 one. Its byte value is reliably extractable; its meaning is not established.

### Medium confidence

- The same numeric position is the thickness candidate for the rest of this snapshot. Most values are plausible, but one is positive infinity and some entries represent preview/room/accessory objects rather than ordinary stock panels. Do not silently accept every entry as purchasable panel stock.
- Labels such as `Egger LEMN`, `Egger UNI(Cadre)`, `Krono`, `AGT` and matching path prefixes provide manufacturer/family **candidates**. The field is not split into verified manufacturer and family columns: 151 records have an empty grouping label, and capitalization/spelling varies.
- The terminal 0/1 byte is a possible grain-related field, but this cannot be established by the file alone. Keep it as an opaque byte until a controlled PolyBoard setting change proves its function. Appearance flags must not be substituted for manufacturing grain rules.

### Unknown / raw

- No verified stock-sheet length/width fields. `1300x2800` in a texture filename is text in an image reference, not proof of sheet dimensions.
- No verified orientation convention, rotation permission, face assignment, machining axis or relation to CSV column 10.
- Terminal float values such as 66, 80, 165 and infinity have no confirmed financial meaning, currency, unit or tax basis. They must not become prices or costs.
- Appearance flags, packed bytes, scaling-like numbers, infinities, extension payloads and object-reference-like integers remain raw.
- Manufacturer identity, standardized decor/finish fields, supplier codes and stable cross-export ID behavior are not proven.

### Decoded examples

| Exact name | Group text | Thickness candidate, corroborated by CSV | Opaque terminal byte | Opaque terminal float |
| --- | --- | ---: | ---: | ---: |
| H1732 ST9 Mesteacan Nisip | Egger LEMN | 18 | 1 | 66 |
| H3702 ST10 Nuc Pacific Tabac | Egger LEMN | 18 | 1 | 80 |
| H3702 ST10 Nuc Pacific Tbac | Egger LEMN | 36 | 1 | +infinity |
| --W960 ST7-- | Egger UNI(Cadre) | 18 | 0 | 37 |
| --W960 st7-- | empty | 36 | 0 | 74 |
| --PFL--0110 PE(Alb) | Krono | 3 | 0 | 12 |

H1732 has candidate UUID `b6accaeb-0f93-4061-b062-b6df11d5a275`, name-length offset 52,606, and path `Egger\Lemn\H1732_1300x2800_10DE_fur.jpg`. The PFL example has an empty primary texture reference. Material `398` also has an empty primary path, but a nested block contains `AGT\Trendy Elegan Renk ve Dokular\398 Süper Mat Açık Krem-Super Mat Light Cream.png`; the block's face semantics are unconfirmed.

Risks: name collisions (five duplicated names), case-sensitive variants, nested appearance records, non-stock entries, nonfinite numbers, and confusing texture information with physical/manufacturing properties. The duplicate names are `F187 ST9`, `H3730 ST10`, `U699 ST9 Verde Brad`, `U702 ST9`, and `W1000 ST76`.

## Edge.mat-boole

### High confidence

- 84 records and distinct candidate UUIDs; exact names/grouping text.
- 83 nonempty primary image references / 72 distinct paths; one empty reference.
- Penultimate float64 values are 0.8 (65 records), 1 (16) or 2 (3). These match every one of the five confirmed project edge material/thickness combinations.
- Duplicate `--W960 ST7--23mm` entries have different candidate UUIDs and different thickness candidates, 0.8 and 2. The same is true of `--W960 ST7--43mm`.

### Medium confidence

- Thickness interpretation across all records is strongly suggested by the pattern and project comparison; units are corroborated by the matching CSV, not declared by a decoded file unit field.
- `23mm` / `43mm` are explicit text in names and suggest edge-band width. They are not a verified independent numeric width field, and are not available for every record.
- Manufacturer/family/decor candidates come from labels and paths, with the same limitations as Panel. Seventeen group labels are empty.

### Unknown / raw

Final float64 values, financial units, adhesive/material composition, roll length, packaging, stock width where absent from text, grain/rotation behavior and appearance parameters. `DUBLAT` remains part of the exact name, not an invented width or manufacturing rule. No LEFT/RIGHT/TOP/BOTTOM semantics are established by this library.

### Decoded examples

| Exact name | Candidate UUID | Thickness candidate | Opaque final float |
| --- | --- | ---: | ---: |
| --W960 ST7--23mm | 93ef91ca-31fc-4635-ba36-79736eba7329 | 0.8 | 5.3 |
| --W960 ST7--23mm | f9c082c5-3b20-4867-893b-92cd6b20d980 | 2 | 2.6 |
| H1732 ST9 Mesteacan Nisip | 9c160af6-4bc4-4f41-8494-a395b55cb26b | 0.8 | 6 |
| H3702 ST10 Nuc Pacific Tabac DUBLAT | 856fef20-bd5e-46c4-b5c7-96eb89c0b21a | 0.8 | 20 |

The W960 examples use group `Egger UNI` and path `Egger\Uni\W960_A3_10DE_fur.png`. H1732 and H3702 use `Egger LEMN` and their corresponding `Egger\Lemn\...jpg` references.

Risks: name-only matching selects the wrong thickness; width embedded in a name may be stale; financial-looking values are undocumented; an edge and panel sharing a decor or path are still different material variants.

## Bar.mat-boole

### High confidence

- 43 records, 43 unique names and 43 distinct candidate UUIDs.
- Forty grouping strings are empty. The others are `metal tube`, `metal tube 40x80`, and `face frame`; these are labels, not manufacturer identities.
- 28 nonempty image references / 14 distinct paths, all ending in `.jpg`; 15 are empty.
- A repeatable pair of float64 values is extractable. In ordinary records the pair starts 52 bytes after the primary path; the first record uses 67 bytes because of initialization data.
- Of 37 names containing a numeric `AxB` expression, 36 agree with that pair. One conflicts: `MDF 060x040 Off-wihite` contains **60 and 30**, not 60 and 40. Six names do not supply a comparable dimension expression.

### Medium confidence

The two numbers are cross-section dimension candidates. Which is width/height, their formally declared unit, and whether they define a bounding rectangle or another profile parameter require confirmation. Wood species, metal type and accessory family can be extracted as source-name tokens, not verified structured classifications.

### Unknown / raw

Profile topology, wall thickness, hollow/solid status, stock length, orientation, routing/cutting rules, end treatments, composition and any supplier/manufacturer identity not explicitly established. Additional integers/bytes and the terminal float must remain raw. A label containing `metal tube` does not prove a decoded wall-thickness or tube geometry field.

### Decoded examples

| Exact name | Numeric pair | Group | Image reference |
| --- | --- | --- | --- |
| Wood 060x022 Walnut | 60, 22 | empty | wood\walnut 02.jpg |
| Metal 080x040 Steel | 80, 40 | metal tube 40x80 | metal\Steel.jpg |
| MDF 060x040 Off-wihite | 60, 30 | empty | empty |
| PVC 050x030 | 50, 30 | empty | empty |

The first record's candidate UUID is `eddfd743-f21e-437e-ac3f-f34c0883cc46`. The MDF conflict record is `81cd3c69-d146-4795-b90d-ca3856cfa45d`. Preserve both the name and numeric evidence; do not resolve their conflict automatically.

Risks: actual name/numeric disagreement, accessory representations mixed with stock profiles, initialization exceptions and incomplete section geometry. Do not derive CNC or purchasing geometry from these candidates.

## Identity and actual-project comparison

There are 499 distinct UUID-compatible identifiers across these files. This strongly supports a source-record identifier interpretation, but **one snapshot cannot prove persistence** through rename, copy, library merge or re-export. Integer object counters also occur and must not become material IDs. Duplicate names demonstrate why names cannot be primary keys.

MOBLUX OS should generate its own IDs and retain candidate external IDs with a source-library namespace, immutable source revision/hash and original bytes. A file hash + record offset/ordinal identifies evidence in one snapshot, not a stable material across edits. Do not merge panel, edge and bar records merely because they share a label, reference or texture.

### Panel matches

Every row below has exactly one exact-name + thickness candidate in Panel:

| Actual imported name | CSV thickness, mm | Library candidate UUID |
| --- | ---: | --- |
| --PFL--0110 PE(Alb) | 3 | fb50ddfb-1cb0-40dd-9530-cb1c3728f109 |
| --W960 ST7-- | 18 | 98585c0b-3494-4b9e-bc75-f0c88a2e9e02 |
| --W960 st7-- | 36 | d94fe8f8-2025-4045-a21f-489cc0945a96 |
| 398 | 18 | 3b46f658-2cba-41a4-ae5d-67cf8d4dbff1 |
| H1732 ST9 Mesteacan Nisip | 18 | b6accaeb-0f93-4061-b062-b6df11d5a275 |
| H3702 ST10 Nuc Pacific Tabac | 18 | ad84ca69-58ea-4e5c-bca1-8b6f9c71ed2a |
| H3702 ST10 Nuc Pacific Tbac | 36 | 0458ef1c-d18d-4002-973f-2c3802f54420 |
| zz-Glass 0080 tr nou | 22 | c79d6d80-8005-4963-9619-912dc4ac4e52 |

The user's short examples `W960 ST7` and `PFL 0110 PE(Alb)` correspond to the decorated source names above; they are not literal exact names themselves. Case and the `Tbac` spelling must be preserved. No automatic alias correction is justified.

### Edge matches

All five actual imported pairs also have one exact-name + thickness candidate:

- `--W960 ST7--23mm` / 0.8 mm → `93ef91ca-31fc-4635-ba36-79736eba7329`.
- `398` / 1 mm → `876fdc8f-bf63-4ae5-a480-8a2de888ba19`.
- `H1732 ST9 Mesteacan Nisip` / 0.8 mm → `9c160af6-4bc4-4f41-8494-a395b55cb26b`.
- `H3702 ST10 Nuc Pacific Tabac` / 0.8 mm → `8e5968cf-bf52-4343-ac19-9009c4d59ec2`.
- `H3702 ST10 Nuc Pacific Tabac DUBLAT` / 0.8 mm → `856fef20-bd5e-46c4-b5c7-96eb89c0b21a`.

There is no exact name correspondence between these project material names and Bar. No bar requirement or cross-category substitution is inferred.

## Proposed future normalized catalog — not implemented

| Concept | Responsibility |
| --- | --- |
| MaterialMaster | MOBLUX-owned identity, kind PANEL / EDGE / BAR_PROFILE, display name and lifecycle status. Names are not uniqueness keys. |
| MaterialVariant | Physical variant linked to its master; verified thickness/dimensions carry explicit units. Preserve uncertainty rather than filling defaults. |
| PanelMaterial | Panel-specific variant properties; thickness, optional verified stock formats, optional confirmed grain policy. No texture-filename dimensions. |
| EdgeMaterial | Edge thickness and optional verified band width; composition/adhesive only when known. No part-edge side assignment. |
| BarProfileMaterial | Verified section dimensions and optional independently validated profile description; wall thickness/stock length remain nullable. No CAD reconstruction. |
| Manufacturer / MaterialReference | Optional verified manufacturer, manufacturer reference, decor code, finish and family. Keep original grouping/name tokens as separate source evidence; aliases require reviewed mappings. |
| MaterialDimension / StockFormat | Confirmed dimension role, value and unit, with provenance. Stock sheet formats and supplied lengths must be distinguished from texture size and cross-section dimensions. |
| TextureReference | Original reference string, source revision and optional separately resolved asset/hash. Allow multiple references with UNKNOWN role until face/orientation is proven. |
| LibrarySnapshot / SourceMaterialRecord | Original file hash, category, source candidate ID, ordinal, offsets, raw bytes, parser profile/version, decoded candidates and validation findings. |
| MaterialSourceMapping | Reviewed link between source record and MOBLUX material variant, with evidence, confidence, actor and history. Duplicate/ambiguous matches stay unresolved. |
| Supplier / SupplierProduct / SupplierOffer | Separate supplier identity, supplier SKU, linked material variant, packaging/order units, availability and price history. Prices need currency, unit, effective date and tax basis. |

A manufacturer can also be a supplier in business, but that relationship is explicit; the two identities must not be equated. A material can have several supplier products/offers. Shared decor is an optional relationship, not a reason to collapse physical panel and edge variants.

Existing immutable ProjectVersion material snapshots retain their historical description/thickness/raw evidence. Future reviewed catalog links must not rewrite them or manufacture approval. Unmapped library numbers must not populate SupplierOffer prices or financial calculations.

## Safe-use boundary and next increment

Safe now for read-only staging: exact strings, category established by signature, source hash, candidate UUID bytes, offsets, raw records, texture reference strings, mechanically decoded scalar values explicitly labeled by confidence, and the corroborated thickness matches listed above. Paths are references only; their existence and images were not verified. Never automatically follow arbitrary local/network paths from imported data.

Must remain raw/unmapped: wrapper opaque fields, serialization counters/initialization bytes, undocumented appearance fields/extensions, financial-looking numbers, unconfirmed grain/orientation flags, bar section semantics, unverified units and profile topology. CSV column 10 remains raw; CSV edge-slot side orientation remains unknown. This investigation changes neither constraint.

Recommended next increment, only after review: implement a **read-only, versioned library staging adapter** for a bounded supported format, preserving source bytes and unknown blocks, with explicit rejection of unsupported structure and reviewed matching proposals. Do not immediately publish catalog records, change project snapshots, import prices or enable manufacturing calculations. Before production use, validate sequential record boundaries and extension handling, resource limits, malformed/truncated data, duplicate IDs/names, infinity handling, and repeat imports. Obtain controlled PolyBoard before/after exports for thickness, grain, appearance, profile dimensions and rename/copy/re-export ID behavior. Confirm the MDF dimension conflict in PolyBoard rather than choosing a value.

Verification performed for this analysis: all three decompressions completed without trailing data; enumerated counts equal all three stored counts; all 499 candidate IDs are unique; all eight panel and five edge pairs were compared with the existing real CSV; all 37 dimension-bearing bar names were compared with their numeric pairs (36 agree, one conflict); original hashes remained unchanged. No application test/build was necessary because application code was untouched. Full local extraction evidence is retained under ignored `.local/library-analysis/`, not committed fixtures.

## Implementation follow-up — 2026-09-30

The historical investigation above is unchanged in meaning. The subsequently authorized staging increment now implements a sequential, fail-closed parser for this observed structure, replacing the investigation's enumeration technique for application use. It reproduces 372/84/43, preserves complete source bytes and enforces bounded decompression. This does not establish arbitrary-version compatibility or resolve undocumented semantics. See POLYBOARD_LIBRARY_PROFILE.md for the exact implemented confidence boundary and IMPLEMENTATION_REPORT.md for verification. Only the 8 Panel / 5 Edge corroborations above are usable for automatic exact proposals; all other numeric candidates retain their previous confidence.
