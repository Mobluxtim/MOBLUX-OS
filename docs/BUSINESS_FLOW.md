# MOBLUX OS
## BUSINESS FLOW & MANUFACTURING SPECIFICATION ADDENDUM v0.2

This document extends MASTER SOFTWARE SPECIFICATION v0.1.

Do not replace v0.1.

Treat both specifications as cumulative.

---

# 1. ACTUAL BUSINESS WORKFLOW

The real current furniture workflow is:

Lead / Customer

→ Initial discussions

→ Measurements / sketches / architect / designer information

→ PolyBoard design

→ Multiple project revisions

→ Customer design approval

→ Final commercial proposal

→ Price approval

→ Advance payment

→ Technical validation

→ Production Release

→ Material purchasing/reservation

→ External cutting and edge banding currently performed by Holver

→ Components received at Mobluxtim factory

→ CNC drilling/machining

→ Factory assembly / pre-assembly

→ Factory quality control

→ Packaging

→ Transport

→ Installation

→ Installation quality control

→ Customer acceptance

→ Final payment milestone

→ Customer feedback / review

→ Warranty / after-sales.

The architecture must support moving cutting and edge banding from Holver to internal Mobluxtim production in the future without redesigning the project model.

---

# 2. PROJECT ORIGIN

Projects may originate from:

- customer inquiry;
- proactive sales;
- architect;
- interior designer;
- existing sketches;
- plans;
- measurements;
- incomplete conceptual information.

Architectural and designer dimensions must NOT automatically be considered manufacturing dimensions.

Mobluxtim commonly reconstructs and validates the project itself.

Therefore preserve distinction between:

DESIGN INPUT DATA

and

MANUFACTURING VERIFIED DATA.

---

# 3. PROJECT VS PRODUCTION ORDER

A Project is NOT a Production Order.

A project can contain many revisions.

Example:

V1
V2
V3
V4
V5.

Only a specifically approved and technically validated project version can become a production source.

Create a separate entity:

ProductionRelease.

Example:

Project:
MLX-2026-0048

Approved Version:
V5

Production Release:
PR-2026-0048-01.

ProductionRelease must reference an immutable snapshot of the source project version.

Later project revisions must NOT silently modify an active ProductionRelease.

---

# 4. PRODUCTION RELEASE GATE

Default requirements for production release:

project design approved;

commercial proposal approved;

required advance/payment condition satisfied;

technical validation completed;

material requirements generated;

authorized user released production.

Provide controlled administrator override.

Overrides must require:

reason;

actor;

timestamp.

Store override in Audit Log.

---

# 5. POLYBOARD DATA

PolyBoard currently provides or is expected to provide manufacturing information including:

materials;

panel quantities;

hardware;

screws/fittings;

drilling;

machining operations;

cutting information;

part information;

CNC-related manufacturing information.

PolyBoard remains the manufacturing geometry source during initial MOBLUX OS versions.

Create flexible importer adapters.

Actual field mapping will be finalized after receiving real production exports.

---

# 6. CURRENT EXTERNAL PRODUCTION

Current panel workflow:

PolyBoard

→ Holver

→ cutting

→ edge banding

→ delivery to Mobluxtim

→ Mobluxtim CNC drilling

→ assembly.

Represent Holver as an external production step/provider.

Do not hard-code Holver into the production domain.

Use generic entities such as:

ProductionOperation

ProductionProvider

ExternalProcessingOrder.

Future workflow may move:

Cutting

and

Edge Banding

to internal Mobluxtim production.

---

# 7. PROCUREMENT STRATEGIES

Different materials require different procurement strategies.

Implement ProcurementMode.

Initial modes:

STOCK_ITEM

PROJECT_PURCHASE

ORDER_PER_PROJECT

AD_HOC

OPTIONAL_FUTURE:
CONSIGNMENT.

Examples:

Common hinges:
STOCK_ITEM.

Expensive drawer slides:
PROJECT_PURCHASE or low-stock strategy.

Panel/MDF:
ORDER_PER_PROJECT.

Unusual handles:
AD_HOC.

The application must not force all products into one inventory strategy.

---

# 8. SUPPLIERS

Initial important supplier relationships include:

Holver:
panels, MDF, cutting and edge banding.

Hettich:
hinges and drawer slide systems.

Handles and decorative accessories:
multiple changing suppliers.

Supplier selection must remain configurable.

No supplier must be hard-coded into business logic.

---

# 9. INVENTORY RESERVATION

For confirmed production:

REQUIRED QUANTITY

minus

AVAILABLE STOCK

equals

PURCHASE REQUIREMENT.

Available stock must consider:

physical stock;

reserved stock;

project allocation.

Material may be reserved against ProductionRelease.

---

# 10. COSTING ENGINE

Current commercial estimation frequently uses markup coefficients.

Initial examples:

general materials approximately x2;

some fronts approximately x1.5.

These values are configurable business rules and must NOT be hard-coded.

Support two parallel costing approaches.

## MODEL A
Markup Pricing

Material cost
× configurable markup.

## MODEL B
Actual Costing

Material

+

External processing

+

Cutting

+

Edge banding

+

CNC time

+

Assembly labour

+

Installation labour

+

Transport

+

Consumables

+

Waste

+

Overhead

+

Design cost

+

Sales cost

+

Rework allowance

=

TRUE COST.

Then:

TRUE COST

+

TARGET MARGIN

=

TARGET SELLING PRICE.

Allow comparison between traditional markup pricing and actual cost pricing.

---

# 11. FUTURE PRODUCTION TIME TRACKING

Prepare architecture for real production timing.

Track eventually:

operation start;

operation pause;

operation resume;

operation finish;

operator;

workstation;

project;

cabinet;

part where applicable.

Use this data for:

actual labour cost;

productivity;

production planning;

difficulty coefficients;

estimating future jobs.

---

# 12. ASSEMBLY / PRE-ASSEMBLY

Furniture is assembled or pre-assembled in the factory before installation.

Assembly should support status at cabinet level.

Example CabinetQualityChecklist:

all parts present;

machining correct;

edge band correct;

hardware present;

hardware installed;

fronts correct;

dimensions verified;

no scratches;

no damage;

drawer operation verified;

hinge operation verified;

assembly completed.

Operator confirms completion.

Allow supporting photos.

Completion by assembly operator does NOT equal Quality Control approval.

---

# 13. QUALITY CONTROL

Quality Control is a separate workflow.

States:

WAITING_FOR_QC

QC_PASSED

QC_FAILED

REWORK

RECHECK_REQUIRED.

Possible non-conformity categories:

missing part;

damaged part;

scratch;

dimension;

edge banding;

CNC machining;

hardware;

front;

supplier defect;

design issue;

assembly issue;

other.

Store:

category;

description;

responsible production stage where known;

photos;

reported by;

timestamp;

resolution.

This data must later support production quality analytics.

---

# 14. INSTALLATION

Create an InstallationOrder linked to the Project and ProductionRelease.

Installer view must be simplified.

Allow checklist at:

project level;

room level;

cabinet level where appropriate.

Possible completion checks:

cabinet installed;

fronts adjusted;

hardware tested;

worktop installed;

appliances integrated;

sealing finished;

site cleaned;

photos uploaded.

Installer marks installation complete.

Installation completion is followed by customer acceptance.

---

# 15. CUSTOMER ACCEPTANCE

Customer portal must support:

ACCEPT INSTALLATION

or

REPORT ISSUE.

If issue is reported:

create CustomerIssue;

allow description;

allow photos;

project remains open.

If accepted:

create immutable CustomerAcceptance event.

Store:

project;

project version;

production release;

customer;

date;

time;

acceptance reference;

audit metadata.

---

# 16. PAYMENT PLAN

Payment terms must be configurable per project.

Do NOT assume every project uses 50/50.

Default business practice may often be:

50% advance

50% final.

But support examples such as:

70 / 30

40 / 40 / 20

custom milestone payments.

Create:

PaymentPlan

PaymentMilestone.

Possible milestone triggers:

CONTRACT_SIGNED

PROJECT_APPROVED

PRODUCTION_RELEASED

BEFORE_DELIVERY

INSTALLATION_STARTED

INSTALLATION_COMPLETED

CUSTOMER_ACCEPTED

CUSTOM_DATE.

Customer acceptance may trigger the final payment milestone when configured.

---

# 17. CUSTOMER REVIEW FLOW

After successful customer acceptance:

request customer feedback.

Provide an easy path to the company's public review destination such as Google Reviews.

Store internal customer feedback where permitted.

Warranty rights must not depend upon the customer leaving a public review.

---

# 18. WARRANTY

After project completion:

activate warranty record;

generate/provide warranty documents;

make documents available in Client Portal.

Warranty record should reference:

project;

accepted project version;

installation;

acceptance date;

warranty start;

warranty duration;

documents.

Future module will support warranty/service tickets.

---

# 19. CLOUD STORAGE

All project data must be stored safely in cloud infrastructure.

Structured domain information belongs in the database.

Large files belong in object storage.

Use:

PostgreSQL for structured application data;

S3-compatible object storage for files;

versioning;

backup strategy;

access control;

audit logging.

Files may include:

PolyBoard files;

CSV/TXT exports;

DXF;

CNC files;

3D models;

PDF;

quotations;

contracts;

invoices;

photos;

installation documentation;

warranty documentation.

---

# 20. VIRTUAL PROJECT FOLDER VIEW

Users should have an intuitive folder-style document browser.

This is a VIEW over canonical system data.

Do not make filesystem paths the primary database model.

Desired conceptual navigation:

YEAR

→ MONTH

→ CALENDAR DATE + WEEKDAY

→ PROJECT ID + CUSTOMER.

Example:

2026
 / 09 - SEPTEMBER
   / 26 - SATURDAY
      / MLX-2026-0048 - CUSTOMER NAME.

Do not create empty date folders.

Within a project provide logical categories:

01_CLIENT

02_DESIGN

03_POLYBOARD

04_APPROVED

05_QUOTATION

06_CONTRACT

07_PRODUCTION

08_CNC

09_PURCHASE

10_QC

11_INSTALLATION

12_INVOICES

13_PHOTOS

14_WARRANTY.

The application should create and manage this structure automatically.

Users should not need to manually maintain folders.

---

# 21. PRODUCTION BOARD

Create a central Production Board separate from generic Projects.

It should show jobs that are approaching or have entered production.

Possible columns/indicators:

Project

Customer

Production Status

Payment Condition

Material Status

External Processing

CNC

Assembly

QC

Installation Date

Priority

Responsible Person.

Use visual states and minimal clicks.

---

# 22. PRODUCTION STATES

Suggested lifecycle:

NOT_RELEASED

WAITING_PAYMENT

WAITING_TECHNICAL_APPROVAL

WAITING_MATERIAL

MATERIAL_ORDERED

EXTERNAL_PROCESSING

MATERIAL_RECEIVED

WAITING_CNC

CNC_IN_PROGRESS

WAITING_ASSEMBLY

ASSEMBLY_IN_PROGRESS

WAITING_QC

QC_FAILED

REWORK

QC_PASSED

PACKING

READY_FOR_DELIVERY

IN_TRANSIT

INSTALLATION_IN_PROGRESS

WAITING_CUSTOMER_ACCEPTANCE

CUSTOMER_ISSUE

CUSTOMER_ACCEPTED

COMPLETED.

Do not implement states as uncontrolled strings.

Use a validated state machine or equivalent transition rules.

---

# 23. TRACEABILITY

Every production project should be traceable from:

Customer

→ Project

→ Version

→ Production Release

→ Material Requirement

→ Purchase Order / Inventory Allocation

→ Processing

→ CNC

→ Assembly

→ QC

→ Installation

→ Customer Acceptance

→ Invoice

→ Payment

→ Warranty.

This traceability is a central design requirement of MOBLUX OS.

---

# 24. UX PRINCIPLE

Administrative complexity must not be exposed to shop-floor staff.

Examples:

CNC operator sees CNC jobs.

Assembler sees assembly jobs.

QC sees jobs waiting for inspection.

Installer sees installation jobs.

Customer sees only customer-facing information.

Management sees the entire lifecycle.

Permissions remain configurable.

---

# 25. DEVELOPMENT NOTE

Do not fully implement costing, inventory or manufacturing assumptions that remain undefined.

Create extensible domain boundaries and record missing decisions in:

/docs/OPEN_QUESTIONS.md.

Do not invent business rules merely to complete screens.

This specification represents business understanding as of version 0.2.