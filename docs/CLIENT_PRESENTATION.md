# MOBLUX OS — Client Presentation Builder v1

Admin-side preparation of curated customer-facing content for one exact ProjectVersion. This is neither a customer portal nor customer approval, quotation, payment, PDF proposal or ProductionRelease.

## Three separate concepts

1. Technical truth remains in existing immutable versions, imports, Material/Hardware/Machining BOMs, optimization and costing reports.
2. ClientPresentation contains deliberately authored descriptions and selected presentation images. Nothing becomes visible simply because technical data exists.
3. Design deliverables remain a separate future access concern. No payment gates, document release policies, legal notices or intellectual-property terms are invented here.

## Data and ownership

Migration 0012 adds `client_presentations` (one identity per exact ProjectVersion), `presentation_revisions` and `presentation_assets`. All three have immutable update/delete guards. Composite project/version foreign keys preserve ownership; revision guards validate predecessor, media and technical-reference ancestry. Existing versions/BOMs are not modified.

Each revision freezes ordered sections, ordered items, image placement/caption/visibility and cover selection in validated JSON, with sequence, predecessor, request/payload hash, content hash, actor and time. Saving checks the current predecessor; stale edits fail rather than silently overwriting another editor. Identical requests reuse the revision; changed payloads conflict. The editor shows the latest 50 revisions; older exact revision URLs remain valid for authorized staff. Creating a new ProjectVersion starts with no presentation; no silent copy or approval transfer occurs.

Item kinds are FURNITURE, MATERIAL, HARDWARE, SERVICE and NOTE. Materials can reference a resolved MaterialMaster evidenced by this version's resolution history; hardware can reference an exact HardwareBomReport item index from this version. These references are internal provenance only, never customer-facing source names or quantities. Authored commercial descriptions remain separate and frozen. Service entries are descriptive (for example design, measurement, travel, delivery, installation), without prices, distances or cost formulas.

Visibility is explicit: INTERNAL_ONLY, CLIENT_PRESENTATION or DESIGN_DELIVERABLE_FUTURE. The last is a reserved, non-visible access classification, not a granted entitlement. Hidden sections suppress their child items/images even if the child is individually marked visible. Cover selection must identify a visible image in a visible section. New items/sections/media start internal-only in the editor. Title and project description are explicitly customer-facing fields; the editor does not prefill the internal project brief.

## Safe projection and permissions

`presentation.edit` plus `project.view` protects the editor, reference options, revision commands, media upload and internal media review. `presentation.preview` plus `project.view` protects the safe preview and its image streams independently. Explicit deny wins; customer actors remain denied in this staff-only increment. Existing session, Origin and no-store/nosniff protections apply.

The standalone `/presentation-preview/{project}/{version}/{revision}` page requests only the dedicated exact-revision preview API and its permitted image streams. It does not mount the internal workspace or fetch the ProjectVersion, audit, source files or costing response. Client DTO allowlists only title, description, version number, visible section labels, commercial item text/kind, image kind/caption and authorized image URLs. It contains no technical references, object keys, original filenames, hashes, provenance, author/time, BOM quantities, sheet/edge/hardware counts, machining geometry, rates or financial values. Raw internal records are never spread into this DTO. Text renders as plain React text, not HTML.

No automatic redaction of deliberately authored prose or image pixels is claimed: authorized editors are responsible for selecting customer-appropriate text/images. The system prevents automatic technical/financial projection, not human disclosure through authored content. Preview is an internal preparation tool, not a public share link.

## Media

PNG/JPEG only, up to 10 MiB and 20 million pixels; no SVG, PDF, CAD, CNC, DXF or generic source-file attachment. Structural validation checks bounds/container markers (and PNG chunk CRCs), rejects unsupported input and removes ancillary metadata from display copies. It is not a full image-codec decoder, malware scanner or production quarantine service. Browser rendering is confined to raster image responses with explicit MIME, nosniff and sandbox headers.

Reuse the existing private versioned S3 storage adapter and bucket. Preserve original bytes/hash/version and a distinct metadata-stripped display object/hash/version. Display reads verify hashes. No second storage system, external image fetch, texture download or image-generation dependency is added. A failed database transaction may leave unreferenced private objects, consistent with the existing upload boundary; storage reconciliation remains future operational work.

Asset kind is immutable: TECHNICAL_PRESENTATION (curated illustration, not manufacturing source), RENDER, or REFERENCE_INSPIRATION. The editor selects kind on upload. Captions/order/cover/visibility live in presentation revisions. Inspiration remains explicitly labeled in the preview gallery. Internal provenance and filenames stay in the editor, never preview DTOs or filenames in response headers. Previously uploaded presentation assets from the same exact version can be reattached. Other-version or original technical SourceFile IDs cannot be attached.

Every preview image request checks exact project/version/revision ownership and image visibility in that revision. A guessed hidden/detached image URL fails; history continues to reference its original frozen visibility. No public permanent storage URL is issued. Originals have no preview download route.

## Future compatibility

A later ApprovalSnapshot can pin ProjectVersion + exact PresentationRevision ID/content hash + asset IDs/hashes, alongside exact QuoteVersion once implemented. It must not follow a latest pointer. Secure customer grants, quote pricing, design-service payments, deliverable entitlements, explicit approval, PDF generation, notifications and ProductionRelease require separate increments. Preparing a presentation now confers none of those states or permissions.

## Verification

Targeted tests cover strict content validation and safe DTO allowlisting; hidden section/item/media suppression; metadata stripping and invalid raster rejection; PostgreSQL/S3 preservation, idempotency, stale revisions, exact-version guards, immutable records, audit and permissions. The browser scenario edits a synthetic project, uploads/orders/covers images, saves a revision, opens the isolated safe preview and checks desktop/mobile behavior and network isolation. Final results are recorded in IMPLEMENTATION_REPORT.md.

## Local setup

Run the existing `pnpm db:migrate` and `pnpm db:seed`, then restart the normal API when ready to review the new routes. No package installation is needed. The task's verification used a temporary API on port 3101 and preserved pre-existing development services; their already-loaded API code does not hot reload. Open Project → Client presentation, select the exact version, curate/save, then View as client.

## Quote integration now available (D51)

Commercial Quote Builder can pin an exact presentation revision and embed this safe projection in its standalone preview. Presentation authoring remains separate and contains no price calculation. Later presentation edits cannot alter a saved quote's preview. See COMMERCIAL_QUOTES.md; portal, approval, payment, PDF and release remain deferred.
