# MOBLUX OS

## MASTER SOFTWARE SPECIFICATION — VERSION 0.1

You are acting as the Principal Software Architect and Senior Full-Stack Engineer for MOBLUX OS.

The owner of the application is not a software developer.

Therefore:

- make technically sound architectural decisions;
- explain major decisions clearly;
- do not require the owner to make low-level technical choices;
- never sacrifice maintainability for a quick prototype;
- keep the interface extremely simple;
- design for future expansion;
- avoid premature microservices;
- document all important architectural decisions;
- use strict typing and automated tests;
- never silently change business rules.

---

# 1. PRODUCT VISION

MOBLUX OS is an integrated Furniture Manufacturing Operating System.

The system must connect the complete lifecycle of a custom furniture project:

PolyBoard

→ Project Import

→ Project Management

→ Quotation

→ Client Portal

→ Client Approval

→ Order Confirmation

→ Inventory

→ Purchasing

→ Production

→ CNC / Cutting / Machining

→ Assembly

→ Quality Control

→ Installation

→ Invoicing / Payment

→ Warranty / After-sales.

The application should eventually become the digital operating system of the furniture company.

PolyBoard remains the CAD/furniture engineering system during the first development phases.

MOBLUX OS becomes the business, production, collaboration and automation layer around it.

---

# 2. CORE ARCHITECTURAL PRINCIPLE

Every furniture job must have ONE canonical PROJECT ID.

All information must be connected to this ID:

- customer;
- PolyBoard project;
- project versions;
- 3D model;
- rooms;
- cabinets;
- parts;
- materials;
- hardware;
- machining;
- quotations;
- orders;
- inventory reservations;
- purchases;
- production;
- documents;
- approvals;
- invoices;
- payments;
- delivery;
- installation;
- photos;
- warranty;
- communication;
- audit events.

Avoid duplicated disconnected data.

---

# 3. INITIAL ARCHITECTURE

Build the initial application as a MODULAR MONOLITH.

Do NOT create microservices during the MVP unless technically unavoidable.

Modules must nevertheless have clean boundaries so that individual services may later be extracted.

Initial modules:

01 Identity & Security

02 Users

03 Roles & Permissions

04 Customers

05 Projects

06 PolyBoard Import Engine

07 Product / Material Master Data

08 3D Model Management

09 Client Portal

10 Project Approvals

11 Quotations

12 Orders

13 Inventory

14 Purchasing

15 Production

16 CNC / Manufacturing Files

17 Assembly

18 Quality Control

19 Installation

20 Documents

21 Notifications

22 Payments

23 Invoicing Integration

24 Warranty

25 AI Assistant

26 Audit & Event Log

27 Administration

---

# 4. POLYBOARD INTEGRATION

MOBLUX OS must include a dedicated PolyBoard Import Engine.

Do NOT depend upon manually re-entering PolyBoard information.

Initially support structured PolyBoard exports.

The importer should be designed using adapters so additional PolyBoard export formats can be added later.

Target input types include:

- configurable ERP exports;
- CSV;
- TXT;
- part lists;
- material lists;
- hardware lists;
- machining information;
- individual part DXF;
- project 3D DXF;
- project 3DS;
- PDFs where useful.

Never treat PDF as the canonical manufacturing data source when structured data is available.

---

# 5. NORMALIZED PROJECT MODEL

Imported PolyBoard information must be converted into an internal canonical data model.

Example hierarchy:

Project

Room

Cabinet

Part

Material

Edge

MachiningOperation

HardwareItem

Accessory

ManufacturingFile

3DModel

Each imported entity must preserve:

- original source;
- original PolyBoard identifier where available;
- import timestamp;
- project version;
- source file hash;
- parsed values;
- validation state.

---

# 6. PROJECT VERSIONING

Project versioning is mandatory.

Example:

V1
V2
V3
V4

Client approval always applies to one exact immutable version.

If an approved project is changed:

DO NOT overwrite the approved version.

Create a new version.

Example:

V4 = APPROVED

Modification occurs.

V5 = DRAFT / WAITING FOR APPROVAL.

Every version must retain:

- design files;
- structured project data;
- 3D model;
- quotation;
- materials;
- approval status;
- customer approvals;
- relevant documents.

---

# 7. PERMISSION SYSTEM

Create a highly configurable authorization system.

Use:

RBAC + granular permissions.

Roles provide permission templates.

Permissions can additionally be enabled or disabled per user where appropriate.

Possible roles:

Super Admin

Administrator

Management

Project Designer

Sales

Accounting

Purchasing

Warehouse

Production Manager

Cutting Operator

CNC Operator

Edgebander Operator

Drilling Operator

Assembler

Quality Control

Installer

External Contractor

Customer

Permissions must be granular.

Examples:

project.view

project.edit

project.delete

project.cost.view

project.margin.view

project.purchase_list.view

project.production.view

project.files.download

project.approve

inventory.view

inventory.adjust

purchase.create

purchase.approve

production.start

production.complete

quality.approve

installation.complete

invoice.view

invoice.create

customer.manage

users.manage

permissions.manage

The application administrator must have a visual permission matrix with simple checkboxes.

Example:

                         VIEW   EDIT   APPROVE   COST

Designer                  ✓      ✓        -        -

Production                ✓      -        -        -

Accounting                ✓      -        -        ✓

Customer                  ✓      -        ✓        -

Permission checks MUST be enforced in the backend.

Do not rely only on hiding buttons in the frontend.

---

# 8. CLIENT PORTAL

Each customer can receive secure access to their project.

Preferred authentication:

Email or phone

+

Magic Link and/or OTP.

Do not send reusable plaintext passwords.

Customer portal should eventually contain:

Project Overview

3D Viewer

Drawings

Materials

Finishes

Project Versions

Quotation

Approvals

Contract

Invoices

Payment

Production Status

Installation

Documents

Warranty

Support.

The customer must NEVER see internal information unless explicitly authorized.

Internal-only examples:

supplier prices;

profit margin;

internal purchase list;

employee information;

production costs;

internal notes.

---

# 9. CUSTOMER APPROVAL SYSTEM

Provide configurable project approval checkpoints.

Possible approvals:

Measurements approved

Layout approved

Materials approved

Colours approved

Hardware approved

Appliances approved

Price approved

Final project approved.

Each approval event must store:

customer;

project;

project version;

approval category;

timestamp;

approval state;

relevant audit information;

snapshot/reference of approved data.

Approvals must be immutable audit events.

---

# 10. 3D VIEWER

Implement an architecture allowing PolyBoard models to be displayed directly in the web application.

Source formats may initially include:

3DS

3D DXF.

Create a conversion pipeline to a modern web format such as:

glTF / GLB.

Architecture:

PolyBoard Export

→ Upload

→ Conversion Service

→ GLB/glTF

→ Object Storage

→ Web 3D Viewer.

The viewer should eventually support:

orbit;

zoom;

pan;

cabinet selection;

object highlighting;

material display;

part identification;

dimensions;

annotations;

project comments.

Keep technical geometry separate from AI-generated visual renders.

AI renderings must NEVER become manufacturing geometry.

---

# 11. INVENTORY

Inventory must use a central master-data system.

Possible entities:

Panel

Edge Band

Hardware

Fitting

Profile

Adhesive

Consumable

Accessory

Packaging.

For every item support:

SKU;

manufacturer;

manufacturer code;

supplier;

supplier code;

unit;

current stock;

reserved stock;

available stock;

minimum stock;

reorder point;

location;

purchase price;

historical prices;

lead time;

packaging multiple.

Formula:

AVAILABLE STOCK =
PHYSICAL STOCK
-
RESERVED STOCK.

---

# 12. PROJECT MATERIAL REQUIREMENTS

When a project is confirmed, calculate material requirements.

For every material:

PROJECT REQUIREMENT

minus

AVAILABLE STOCK

equals

PURCHASE REQUIREMENT.

Take into account:

stock already reserved for other projects;

minimum stock;

supplier pack size;

purchase multiples;

waste factors where applicable.

---

# 13. PURCHASING

Create purchasing rules.

Possible modes:

MANUAL

SUGGEST PURCHASE

AUTO CREATE PURCHASE ORDER

AUTO SEND ORDER.

Auto-send must require an explicit configuration.

Possible rule:

if supplier = X

and product category = hardware

and project status = CONFIRMED

then generate supplier order draft.

The system must support human approval before sending unless explicitly configured otherwise.

---

# 14. PRODUCTION

Production must be driven from the confirmed project version.

Possible stages:

Engineering

Material allocation

Cutting

CNC

Edge banding

Drilling

Special operations

Assembly

Quality Control

Packaging

Ready for installation

Installation

Completed.

Each production station receives only the information it needs.

Example:

Cutting operator:

part;

material;

dimensions;

grain direction;

quantity;

cutting file;

labels.

Assembler:

cabinet;

parts;

hardware;

assembly instructions;

3D model;

completion checklist.

Installer:

customer;

site;

rooms;

cabinet list;

installation drawings;

photos;

issues;

completion checklist.

---

# 15. SHOP FLOOR INTERFACE

Production UI must be radically simpler than administrative UI.

Target:

large touch-friendly controls;

minimal text;

clear project ID;

clear part/cabinet ID;

barcode/QR support;

very few clicks.

Do not expose ERP complexity to production operators.

---

# 16. QR / BARCODE ARCHITECTURE

Design the system so entities can later receive QR/barcode identifiers.

Examples:

Project

Cabinet

Part

Bundle

Material

Production Order

Installation Package.

Scanning should allow the operator to immediately open the correct context.

---

# 17. NOTIFICATION SYSTEM

Build notifications using provider adapters.

Channels:

Email

SMS

WhatsApp

In-app notification.

Business logic must not depend upon a specific notification provider.

Example event:

PROJECT_READY_FOR_APPROVAL

can trigger:

email;

WhatsApp;

SMS;

in-app.

Admin must eventually be able to enable/disable channels.

---

# 18. DOCUMENT SYSTEM

Every project should have structured document storage.

Document types may include:

quotation;

agreement;

contract;

invoice;

drawings;

production documents;

delivery documents;

installation documents;

photos;

warranty.

Every document must be linked to:

Project ID

Customer ID

Document Type

Version

Creation Date.

---

# 19. PAYMENT

Prepare architecture for payment provider integration.

Customer portal may eventually provide:

invoice;

amount due;

amount paid;

balance;

payment status;

payment link.

Use provider adapters.

Do not hard-code the application to one payment provider.

---

# 20. ACCOUNTING / INVOICING

Keep accounting/invoicing as an integration boundary.

The core system owns:

customer;

project;

quotation;

order;

commercial values;

payment status references.

A dedicated integration layer may synchronize invoices with external accounting/invoicing systems.

Do not embed country-specific accounting implementation throughout the domain model.

---

# 21. AI ARCHITECTURE

AI is an assistant.

AI is NOT the source of truth for manufacturing geometry.

AI functionality may include:

project analysis;

missing-data detection;

quotation drafting;

customer communication;

document generation;

inventory analysis;

purchase suggestions;

profit analysis;

production anomaly detection;

semantic search;

technical assistant;

internal knowledge search.

All AI-generated actions affecting money, purchasing, project approval or manufacturing must have appropriate validation or approval rules.

---

# 22. AUDIT LOG

Create an append-only audit log for important actions.

Examples:

project imported;

project modified;

version created;

quotation changed;

client approval received;

purchase order created;

purchase order approved;

production started;

QC completed;

invoice issued;

payment received;

permissions changed.

Record:

event;

actor;

timestamp;

entity;

entity ID;

before state where appropriate;

after state where appropriate.

---

# 23. UI PRINCIPLES

The owner explicitly requires the application to feel:

FAST

FLUID

SIMPLE

VISUAL

MODERN.

Complexity must exist in the backend, not in the user's workflow.

Prefer:

dashboards;

cards;

status indicators;

search;

filters;

visual timelines;

drag/drop where appropriate;

checklists;

one-click actions.

Avoid massive spreadsheet-style screens unless the use case explicitly requires them.

---

# 24. MAIN NAVIGATION

Initial concept:

Dashboard

Projects

Customers

Production

Inventory

Purchasing

Installations

Invoices

Documents

AI Assistant

Reports

Administration.

---

# 25. PROJECT SCREEN

The Project screen is one of the most important parts of MOBLUX OS.

Suggested structure:

PROJECT HEADER

Customer

Project number

Status

Current version

Deadline

Project manager.

TABS:

Overview

3D

Design

Materials

Hardware

Quotation

Approvals

Purchasing

Production

Installation

Invoices

Documents

Communication

Warranty

Audit.

---

# 26. DASHBOARD

Initial dashboard should show:

Active projects

Awaiting customer approval

Awaiting materials

Ready for production

Currently in production

Ready for installation

Delayed projects

Installation this week

Outstanding payments

Important inventory alerts.

---

# 27. TECHNICAL DIRECTION

Use a modern web application architecture.

Preferred initial direction:

Frontend:
React / Next.js
TypeScript

Backend:
TypeScript backend architecture suitable for complex domain logic.

Database:
PostgreSQL

ORM:
A mature strongly typed ORM.

Authentication:
secure modern authentication with support for role/permission model.

File storage:
S3-compatible object storage.

3D:
Three.js / React Three Fiber where appropriate.

Jobs:
background job queue for imports, conversions, notifications and document generation.

Cache:
Redis where justified.

API:
clearly defined typed API.

Infrastructure:
Docker.

Source control:
Git.

Testing:
unit tests;
integration tests;
end-to-end tests for critical workflows.

Do not over-engineer infrastructure during MVP.

---

# 28. DEVELOPMENT PRINCIPLES

Use:

strict TypeScript;

clear domain boundaries;

database migrations;

seed data;

schema validation;

structured logging;

central error handling;

automated tests;

environment configuration;

security best practices.

Never hard-code:

user IDs;

supplier IDs;

permission IDs;

company-specific paths;

API credentials;

notification providers.

---

# 29. MVP PHASE 1

DO NOT IMPLEMENT THE ENTIRE ERP YET.

The first working vertical slice should demonstrate the architecture.

Build:

Authentication

Users

Roles

Granular Permissions

Customers

Projects

Project Versioning

PolyBoard Import framework

File upload

Basic structured import

Basic 3D import/conversion architecture

Client Portal foundation

Project approval workflow

Audit log

Modern responsive interface.

Also create placeholder modules for:

Inventory

Purchasing

Production

Invoicing

Warranty.

They do not need full business logic yet.

---

# 30. FIRST DEMONSTRATION WORKFLOW

The first demonstrable end-to-end flow must be:

1. Admin logs in.

2. Admin creates customer.

3. Admin creates project.

4. Admin uploads PolyBoard project export files.

5. System creates an import.

6. System parses supported structured data.

7. System creates project version V1.

8. Project page displays imported information.

9. If a 3D file is available, create/display model preview.

10. Admin sends project to customer for approval.

11. Customer receives secure access.

12. Customer opens project.

13. Customer sees project information and 3D model.

14. Customer approves project.

15. System records immutable approval.

16. Project status becomes APPROVED.

17. Audit log contains complete history.

---

# 31. DEVELOPMENT DELIVERABLES

Before implementing large amounts of functionality:

Create:

/docs/ARCHITECTURE.md

/docs/DOMAIN_MODEL.md

/docs/PERMISSIONS.md

/docs/POLYBOARD_IMPORT.md

/docs/PROJECT_LIFECYCLE.md

/docs/SECURITY.md

/docs/ROADMAP.md

AGENTS.md.

Create database ER diagram documentation.

Create initial UI wireframe structure.

Then implement the first vertical slice.

---

# 32. IMPORTANT RULE

The application must be designed so future development can eventually replace or complement parts of the current furniture-design workflow.

However:

DO NOT attempt to recreate PolyBoard CAD functionality during MVP.

First build the operating system around the existing CAD workflow.

---

# 33. CURRENT PRODUCT NAME

Working product name:

MOBLUX OS

This is temporary and may be renamed later.

---

# 34. CURRENT STATUS

This specification is VERSION 0.1.

Many manufacturing, inventory, costing, purchasing, CNC, installation and accounting rules will be defined together with the business owner during future development.

Therefore:

implement these areas through extensible domain models;

do not invent business rules that have not yet been defined;

record unclear areas as OPEN QUESTIONS in:

/docs/OPEN_QUESTIONS.md

rather than silently making assumptions.

---

# 35. FIRST TASK

Do NOT immediately generate the whole application.

First:

1. analyze this specification;

2. propose the repository architecture;

3. propose the database/domain entities;

4. produce the initial ER model;

5. define the permissions architecture;

6. define the PolyBoard import adapter architecture;

7. define the project/version/approval lifecycle;

8. define the 3D conversion architecture;

9. identify architectural risks;

10. create the development roadmap;

11. identify ONLY questions whose answers materially affect the architecture.

After that, begin implementation of the first vertical slice.