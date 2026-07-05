# TrackImplant Enterprise Specification

**Version:** 2.0.0  
**Status:** Production-Ready  
**Build:** 0 TypeScript Errors  
**Last Updated:** 04 July 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Overview](#2-business-overview)
3. [Complete User Roles](#3-complete-user-roles)
4. [Complete Authorization Matrix](#4-complete-authorization-matrix)
5. [Complete Module Documentation](#5-complete-module-documentation)
6. [Business Rules](#6-business-rules)
7. [Workflow Documentation](#7-workflow-documentation)
8. [Inventory Documentation](#8-inventory-documentation)
9. [Financial Documentation](#9-financial-documentation)
10. [Patient Documentation](#10-patient-documentation)
11. [Communications](#11-communications)
12. [Reports](#12-reports)
13. [Dashboard Documentation](#13-dashboard-documentation)
14. [Audit System](#14-audit-system)
15. [Database Documentation](#15-database-documentation)
16. [API / Services](#16-api--services)
17. [Frontend Architecture](#17-frontend-architecture)
18. [Backend Architecture](#18-backend-architecture)
19. [Security](#19-security)
20. [Notifications](#20-notifications)
21. [Revision History](#21-revision-history)
22. [Soft Delete](#22-soft-delete)
23. [Ownership](#23-ownership)
24. [Coding Standards](#24-coding-standards)
25. [Future Roadmap](#25-future-roadmap)
26. [Glossary](#26-glossary)
27. [Appendix](#27-appendix)

---

## 1. Project Overview

### 1.1 Purpose

TrackImplant is a complete, multi-branch dental implant ERP (Enterprise Resource Planning) system. It manages the full lifecycle of a dental implant practice — from patient registration through treatment, inventory management, financial tracking, cross-branch operations, and clinical follow-up.

The system is built for dental implant clinics that operate across multiple physical branches. Each branch has its own inventory, staff, and patients, but patient identity and financial history are shared globally across the organization.

### 1.2 Goals

- **Centralize patient management** across all branches — a patient can register at any branch and receive treatment at any branch
- **Track inventory per branch** — each branch maintains its own stock of implants, abutments, prosthetic components, and materials
- **Enable cross-branch inventory transfers** — branches can request stock from other branches; requests are approved and fulfilled with delivery tracking
- **Provide complete financial tracking** — per-patient invoicing, payment recording, outstanding balance tracking, revenue analytics
- **Support clinical workflows** — procedure tracking, follow-up management, healing status monitoring
- **Enforce role-based security** — Admin, Manager, Doctor, Receptionist, Assistant roles with granular permissions
- **Maintain full audit trails** — every sensitive operation requires a reason for change and is logged permanently

### 1.3 Business Vision

A unified dental implant management platform where:

- A patient walks into any branch and staff can instantly access their full history
- Inventory is managed locally but visible globally for transfers
- Financial records follow the patient, not the branch
- Clinical outcomes are tracked systematically with healing status monitoring
- Every change is traceable with a reason and audit trail

### 1.4 System Objectives

| Objective | Description |
|-----------|-------------|
| Multi-Branch | Support unlimited physical branches with shared patient records |
| Role-Based Access | 5 distinct roles with granular permissions |
| Inventory Management | 4 categories of inventory: Implants, Abutments, Prosthetics, Materials |
| Cross-Branch Transfers | Request, approve, ship, receive inventory between branches |
| Financial Management | Per-patient invoicing, payments, refunds, balance tracking |
| Clinical Tracking | Procedures, follow-ups, healing status, kit management |
| Audit & Compliance | Full audit logs with mandatory reason for change |
| Reports & Analytics | Financial, clinical, inventory, cross-branch reports with export |
| CRM | Patient communications, reminders, files, timeline |

### 1.5 Modules

| Module | Description |
|--------|-------------|
| Dashboard | Role-aware dashboard with widgets and analytics |
| Patients | Patient registry, search, create, update, profile |
| Appointments | Appointment scheduling and management |
| Procedures | Clinical procedure tracking with inventory consumption |
| Follow-ups | Post-treatment healing status monitoring |
| Inventory | Full inventory management (4 categories + counts + deliveries + returns) |
| Financial | Invoicing, payments, refunds, revenue analytics |
| Reports | 5 report sections with XLSX/PDF export |
| Communications | Patient communications (calls, emails, SMS, notes) |
| Patient Files | Document upload and management |
| Reminders | Automated patient reminders (birthday, recall, follow-up) |
| Audit Logs | Complete audit trail with filters and detail view |
| Settings | Backup, configuration, user management |
| Notifications | In-app notifications for stock requests, deliveries |

### 1.6 Target Users

| Role | Typical User | Primary Function |
|------|-------------|------------------|
| Admin | Clinic owner, General Manager | Full system access, all branches |
| Manager | Branch Manager | Branch operations, inventory, staff |
| Doctor | Implant Surgeon | Clinical procedures, follow-ups |
| Receptionist | Front desk staff | Appointments, patient check-in |
| Assistant | Clinical Assistant | Procedure support, inventory consumption |

### 1.7 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 with TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS |
| State Management | React Query (TanStack Query) |
| Routing | React Router v6 |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Database | PostgreSQL 15 |
| Authentication | Supabase Auth (email/password) |
| Authorization | Row-Level Security (RLS) + custom roles |
| File Storage | Supabase Storage |
| PDF/Excel | html2canvas + xlsx |
| UI Icons | Lucide React |
| Notifications | Sonner (toast) |
| i18n | Custom context-based (en/ar) |

### 1.8 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TS)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Pages   │ │Components│ │  Hooks   │ │   Contexts     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘  │
│       └────────────┴────────────┴───────────────┘           │
│                          │                                   │
│                   ┌──────┴──────┐                            │
│                   │  Services   │  (Business Logic Layer)    │
│                   └──────┬──────┘                            │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │  Supabase Client SDK  │                       │
│              └───────────┬───────────┘                       │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┼───────────────────────────────────┐
│  Supabase Backend        │                                   │
│  ┌───────────────────────┴────────────┐                      │
│  │         PostgreSQL 15              │                      │
│  │  ┌─────┐ ┌─────┐ ┌────────────┐  │                      │
│  │  │Tables│ │Views│ │  RPC Funcs │  │                      │
│  │  └─────┘ └─────┘ └────────────┘  │                      │
│  │  ┌─────┐ ┌─────┐ ┌────────────┐  │                      │
│  │  │RLS  │ │Trig.│ │  Storage   │  │                      │
│  │  └─────┘ └─────┘ └────────────┘  │                      │
│  └──────────────────────────────────┘                      │
│  ┌──────────────────────────────────┐                      │
│  │      Supabase Auth               │                      │
│  └──────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.9 Folder Structure

```
trackimplant/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # DataTable, Modal, Skeleton, StatusBadge, etc.
│   │   ├── forms/            # Form components
│   │   ├── AddPatientModal.tsx
│   │   ├── ReasonDialog.tsx   # Mandatory reason-for-change dialog
│   │   ├── ProtectedRoute.tsx # Auth guard
│   │   └── ErrorBoundary.tsx  # Error boundary
│   ├── pages/
│   │   ├── Dashboard.tsx      # Main dashboard (role-aware)
│   │   ├── Inventory.tsx      # Full inventory management
│   │   ├── Patients.tsx       # Patient registry
│   │   ├── ImplantCases.tsx   # Clinical cases
│   │   ├── Login.tsx          # Login page
│   │   ├── auth/              # Auth pages (register, forgot/reset password)
│   │   └── dashboard/         # Dashboard sub-pages
│   │       ├── Appointments.tsx
│   │       ├── AuditLogs.tsx
│   │       ├── BranchInventory.tsx
│   │       ├── DeliveryForm.tsx
│   │       ├── FollowUps.tsx
│   │       ├── Notifications.tsx
│   │       ├── PatientProfile.tsx
│   │       ├── Payments.tsx
│   │       ├── Reports.tsx
│   │       ├── ReturnsPage.tsx
│   │       ├── Settings.tsx
│   │       └── StockRequestsPage.tsx
│   ├── services/             # Business logic layer (20 services)
│   ├── hooks/                # Custom React hooks
│   ├── context/              # React contexts (Auth, Language, Theme)
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   ├── locales/              # i18n translations (en.json, ar.json)
│   ├── layouts/              # Dashboard layout
│   ├── integrations/         # Supabase client
│   └── lib/                  # Library config (storage, schema)
├── supabase/
│   ├── migrations/           # 19 SQL migration files
│   ├── functions/            # Supabase Edge Functions
│   └── config.toml           # Supabase configuration
└── public/                   # Static assets
```

### 1.10 Coding Standards

- **TypeScript**: Strict mode, no `any` types, explicit interfaces
- **React**: Functional components with hooks, no class components
- **Naming**: camelCase for variables/functions, PascalCase for components/interfaces, kebab-case for files
- **Services**: Each service exports a singleton object with async methods, one service per domain
- **Queries**: React Query (TanStack Query) for all server state
- **Mutations**: `useMutation` for all writes, with `onSuccess` invalidation
- **Styles**: Inline `style` props with minimal CSS classes (Tailwind utility patterns)
- **Translations**: All UI text via `t()` function from `useLanguage()` hook
- **File Structure**: One component per file, co-located with related tests if applicable

---

## 2. Business Overview

### 2.1 The Dental Implant Business

A dental implant clinic performs surgical procedures to replace missing teeth with artificial roots (implants) and crowns (prosthetics). The clinic operates across multiple physical branches, each with:

- **Treatment rooms** with surgical equipment
- **Inventory** of implants, abutments, prosthetic components, and materials
- **Staff** including doctors, nurses, receptionists, and managers
- **Patients** who may visit any branch for treatment

The business model involves:
- Patient consultation → treatment planning → implant surgery → healing → prosthetic placement → follow-up
- Each procedure consumes inventory items (implants, abutments, materials)
- Patients are billed per procedure with invoicing and payment tracking
- Inventory is restocked via supplier orders and cross-branch transfers

### 2.2 Patient Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PATIENT LIFECYCLE                                │
└─────────────────────────────────────────────────────────────────────────┘

Registration (any branch)
    │
    ▼
Appointment Scheduling
    │
    ▼
Consultation & Treatment Planning
    │
    ▼
Procedure (Implant Surgery)
    │
    ├──→ Inventory Consumption
    │
    ▼
Invoice Creation
    │
    ▼
Payment (full or partial)
    │
    ▼
Follow-up Appointments (healing check)
    │
    ├──→ Healing Status Tracking
    │       ├── OnTrack
    │       ├── Critical
    │       └── Failure
    │
    ▼
Prosthetic Placement (if applicable)
    │
    ▼
Final Invoice Settlement
    │
    ▼
Periodic Follow-up / Recall
```

### 2.3 Inventory Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INVENTORY LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────────┘

Supplier Delivery → Stock Added to Branch
    │
    ▼
Stock Available at Branch
    │
    ├──→ Consumed during Procedure (auto-deduct)
    ├──→ Transferred to Another Branch (cross-branch request)
    ├──→ Counted in Inventory Count (periodic)
    ├──→ Returned to Supplier (defective/expired)
    └──→ Adjusted (manual correction)

Cross-Branch Transfer Flow:
    Branch A requests item from Branch B
        │
        ▼
    Branch B approves request
        │
        ▼
    Delivery created (status: preparing)
        │
        ▼
    Picked Up → In Transit → Arrived → Completed
        │
        ▼
    Inventory auto-transferred (DB trigger on delivery complete)
```

### 2.4 Financial Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FINANCIAL LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────────┘

Treatment Completed
    │
    ▼
Invoice Created (per patient, per treatment)
    ├── invoice_name, total_amount, status: Pending
    │
    ▼
Payment Recorded (partial or full)
    ├── amount, payment_method, linked to invoice
    │
    ▼
Invoice Synced
    ├── paid_so_far updated
    ├── remaining_amount recalculated
    ├── status updated: Pending → Partial → Paid
    │
    ▼
Refund (if needed)
    ├── negative payment entry linked to invoice
    │
    ▼
Invoice Settled
```

### 2.5 Cross-Branch Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CROSS-BRANCH WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

Scenario: Branch A needs item X, Branch B has stock.

Step 1: Manager at Branch A creates Stock Request
    ├── Selects item from product catalog
    ├── System shows branches with available stock
    ├── Selects source branch (Branch B)
    ├── Enters quantity + notes
    └── Status: pending

Step 2: Manager at Branch B reviews request
    ├── Check: does Branch B have sufficient stock?
    ├── If yes → approve (reason required)
    └── If no → reject (reason required)

Step 3: On approval, delivery auto-created
    ├── Status: preparing
    └── Delivery appears in both branches' Delivery tabs

Step 4: Branch B prepares shipment
    └── Status update: picked_up

Step 5: In transit
    └── Status update: in_transit

Step 6: Branch A receives
    └── Status update: arrived

Step 7: Delivery completed
    └── Status update: completed
    └── DB trigger auto-transfers inventory
        ├── Branch B: quantity -= requested amount
        └── Branch A: quantity += requested amount
```

### 2.6 Clinic Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLINIC WORKFLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

Patient arrives at branch
    │
    ▼
Receptionist checks in patient (appointment status update)
    │
    ▼
Doctor reviews patient history, medical records
    │
    ▼
Procedure performed
    ├── Doctor selects treatment plan
    ├── System checks stock availability
    ├── Kit items auto-consumed from branch inventory
    └── Procedure status updated
    │
    ▼
Follow-up scheduled (healing check)
    ├── Doctor monitors healing status
    ├── Records pain level, health score
    └── Updates: OnTrack / Critical / Failure
    │
    ▼
Treatment complete / Next phase planned
```

### 2.7 CRM Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CRM WORKFLOW                                     │
└─────────────────────────────────────────────────────────────────────────┘

Patient Communication Recorded
    ├── Type: call, email, sms, note, clinic_note, whatsapp
    ├── Direction: inbound / outbound
    └── Content: free text

Communications appear in:
    ├── Patient Profile Timeline
    └── Patient Communications tab

Reminders:
    ├── Birthday reminders (auto-generated)
    ├── Recall reminders
    ├── Missed appointment reminders
    ├── Follow-up reminders
    └── Custom reminders (manual)
```

### 2.8 Appointment Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      APPOINTMENT WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

Appointment Created
    ├── patient_id, doctor_id, appointment_date, status
    ├── Default status: scheduled
    └── Branch: assigned from user's branch

Status Transitions:
    scheduled → confirmed
    scheduled → cancelled
    confirmed → completed
    confirmed → no_show
    confirmed → cancelled

Daily Reception Dashboard:
    ├── Lists today's appointments
    ├── Check-in buttons
    └── Quick actions

Patient Profile:
    ├── Appointment history displayed
    └── New appointment creation
```

### 2.9 Stock Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        STOCK WORKFLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

Stock Addition (Admin only):
    ├── Select category (implant/abutment/prosthetic/material)
    ├── Select item from product catalog
    ├── Select target branch
    ├── Enter quantity
    └── System finds-or-creates inventory_item record

Stock Consumption (during procedure):
    ├── Doctor creates procedure
    ├── If kit assigned: all kit items auto-consumed
    ├── Stock check before consumption
    └── transaction recorded with operation_type: 'add' (consumption is negative)

Manual Adjustment:
    ├── Admin can adjust stock (add or deduct)
    ├── Reason required for all adjustments
    └── transaction recorded

Low Stock Detection:
    ├── Threshold: minimum_stock field per item
    ├── Alert when quantity - reserved <= threshold
    └── Visible on Manager Dashboard
```

### 2.10 Return Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RETURN WORKFLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

Return Created
    ├── from_location: warehouse | branch | patient
    ├── Item, quantity, reason
    ├── Return reasons: wrong_item, damaged, expired, cancelled_procedure,
    │                   cross_branch_return, supplier_return, other
    └── Status: pending

Admin/Manager Reviews
    ├── Approve → stock adjustment applied
    └── Reject → return voided

On Approval:
    ├── reviewed_by + reviewed_at recorded
    ├── Inventory adjusted
    └── Transaction recorded
```

### 2.11 Delivery Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DELIVERY WORKFLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

Delivery Created
    ├── From cross-branch request approval
    ├── Or manually (supplier delivery)
    └── Status: preparing

Status Workflow:
    preparing → picked_up → in_transit → arrived → completed

Each status update:
    ├── Available to authorized roles
    ├── Timestamp recorded
    └── On completion: inventory auto-transferred (DB trigger)
```

### 2.12 Inventory Count Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INVENTORY COUNT WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

Count Session Created
    ├── Branch selected
    ├── Notes/name
    └── Status: draft

Session auto-populates:
    ├── All inventory items for the branch
    ├── Expected quantities (system_quantity)
    └── Editable actual_quantity fields

Staff counts physical items:
    ├── Updates actual_quantity per item
    ├── Diff = actual - system (calculated)
    └── Optional reason per item

Session Approved:
    ├── Reason required for approval
    └── DB trigger adjusts inventory:
        ├── Updates quantities to match actual values
        └── Records adjustment transactions

Session States:
    draft → in_progress → completed → approved
```

---

## 3. Complete User Roles

### 3.1 Admin

**Description:** System administrator with full access across all branches. Typically the clinic owner or general manager.

**Responsibilities:**
- Manage users, branches, and system configuration
- View and edit all patients across all branches
- View and edit all financial records across all branches
- Full inventory CRUD across all branches
- Approve/reject stock returns
- Access all reports and export data
- Backup and restore system data
- View audit logs

**Business Rules:**
- Admin sees ALL data regardless of branch
- Admin can add stock to any branch
- Admin can approve inventory counts
- Admin can manage users and their roles
- Admin can access Settings (backup, import/export)

### 3.2 Manager

**Description:** Branch manager responsible for daily operations of their assigned branch.

**Responsibilities:**
- Manage patients (view, search, create, update) globally
- View all patient financial records globally
- Update invoices across all branches
- Full inventory CRUD for own branch
- Approve/reject incoming cross-branch stock requests
- Create cross-branch requests from own branch
- View branch reports and analytics
- Approve inventory counts for own branch

**Restrictions:**
- Dashboard is ManagerDashboard (operational only — no financial analytics)
- Inventory operations limited to own branch
- Appointments, procedures, follow-ups limited to own branch
- Communications limited to own branch patients
- Cannot access Settings backup/import/export
- Can only manage own branch stock requests

**Business Rules:**
- Patients are GLOBAL — Manager sees all patients from all branches
- Financial history is GLOBAL — Manager sees all invoices/payments for any patient
- Inventory is BRANCH-SCOPED — Manager only sees/manages own branch inventory
- Cross-branch requests: Manager can request FROM other branches and approve/reject requests TO own branch

### 3.3 Doctor

**Description:** Implant surgeon who performs procedures and manages clinical treatment.

**Responsibilities:**
- View patient information globally
- Perform procedures (create, update)
- Manage follow-ups with healing status tracking
- View own appointments
- View inventory (read-only) for own branch
- Add communications for own patients

**Restrictions:**
- Cannot create/edit patients (view and update only)
- Financial records: view only
- Inventory: read-only for own branch
- Appointments: view and update own only
- Cannot access Settings
- Cannot access audit logs
- Limited reports (own branch filtered)

**Business Rules:**
- Doctor sees all patients globally (for consultation)
- Stock consumption on procedure creation auto-deducts from own branch
- Can add invoices (for treatment billing)
- Healing status tracked per follow-up

### 3.4 Receptionist

**Description:** Front desk staff managing patient check-in and appointments.

**Responsibilities:**
- Register new patients, update patient info
- Schedule and manage appointments
- View patient financial records (read-only)
- View patient files and documents
- Create communications for own branch patients
- View inventory levels (read-only)

**Restrictions:**
- No inventory management (read-only view)
- No financial record creation/editing
- No procedure management
- No follow-up management
- No access to reports, audit logs, settings
- No access to user/branch management

### 3.5 Assistant

**Description:** Clinical assistant supporting doctors during procedures.

**Responsibilities:**
- View patient information (read-only)
- View appointments (read-only)
- View procedures and update stock consumption
- Create follow-ups
- Create communications for own branch patients
- View inventory levels (read-only)

**Restrictions:**
- Cannot create/edit patients
- No access to financial records
- No dashboard access
- No appointment creation (view only)
- No procedure creation (view + stock consumption only)
- No access to reports, audit logs, settings

---

## 4. Complete Authorization Matrix

### 4.1 Global vs Branch-Scoped Overview

| Module | Admin | Manager | Doctor | Receptionist | Assistant |
|--------|-------|---------|--------|--------------|-----------|
| Patients | GLOBAL | GLOBAL | GLOBAL | GLOBAL | GLOBAL |
| Financial Records | GLOBAL | GLOBAL | GLOBAL | GLOBAL | NONE |
| Dashboard | GLOBAL | BRANCH | GLOBAL | BRANCH | NONE |
| Appointments | GLOBAL | BRANCH | BRANCH | BRANCH | BRANCH |
| Procedures | GLOBAL | BRANCH | BRANCH | BRANCH | BRANCH |
| Follow-ups | GLOBAL | BRANCH | BRANCH | BRANCH | BRANCH |
| Inventory | ALL | OWN | OWN (RO) | OWN (RO) | OWN (RO) |
| Stock Requests | CROSS | CROSS | NONE | NONE | NONE |
| Deliveries | ALL | OWN | NONE | NONE | NONE |
| Returns | ALL | OWN | OWN | NONE | NONE |
| Count Sessions | ALL | OWN | NONE | NONE | NONE |
| Communications | GLOBAL | OWN | OWN | OWN | OWN |
| Reports | GLOBAL | BRANCH | BRANCH | NONE | NONE |
| Audit Logs | GLOBAL | NONE | NONE | NONE | NONE |
| Settings | FULL | LIMITED | NONE | NONE | NONE |
| Users/Branches | FULL | NONE | NONE | NONE | NONE |

**Key:** GLOBAL = no branch filter, BRANCH = own branch only, ALL = all branches, OWN = own branch only, CROSS = cross-branch operations, RO = read-only, NONE = no access, FULL = all settings, LIMITED = some settings

### 4.2 CRUD Permission Matrix

#### Patients

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View All | ✓ | ✓ (global) | ✓ (global) | ✓ (global) | ✓ (global) |
| Search | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create | ✓ | ✓ | ✗ | ✓ | ✗ |
| Update | ✓ | ✓ | ✓ | ✓ | ✗ |
| Delete | ✓ | ✗ | ✗ | ✗ | ✗ |
| Upload Photo | ✓ | ✓ | ✓ | ✓ | ✗ |
| View Profile | ✓ | ✓ | ✓ | ✓ | ✓ (RO) |

#### Financial Records

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View All Invoices | ✓ | ✓ (global) | ✓ (global) | ✓ (global) | ✗ |
| Create Invoice | ✓ | ✓ | ✓ | ✗ | ✗ |
| Update Invoice | ✓ | ✓ | ✗ | ✗ | ✗ |
| Add Payment | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Record | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Analytics | ✓ | ✓ (own) | ✓ | ✓ (own) | ✗ |
| View Patient Financials | ✓ | ✓ (global) | ✓ (global) | ✓ (global) | ✗ |

#### Inventory

| Operation | Admin | Manager | Doctor/Rec/Asst |
|-----------|-------|---------|-----------------|
| View Items | All branches | Own branch | Own branch (RO) |
| Add Stock | Any branch | Own branch | ✗ |
| Edit Item | Any branch | Own branch | ✗ |
| Delete Item | Any branch | Own branch | ✗ |
| Adjust Stock | Any branch | Own branch | ✗ |
| Issue Stock | Any branch | Own branch | ✗ (Asst: procedure only) |
| Transfer | Any to any | Own → other or Other → own | ✗ |
| Count Sessions | All branches | Own branch | ✗ |

#### Appointments

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View All | ✓ (all) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) |
| Create | ✓ | ✓ | ✗ | ✓ | ✗ |
| Update | ✓ | ✓ | ✓ (own) | ✓ | ✗ |
| Delete | ✓ | ✓ | ✗ | ✓ | ✗ |

#### Procedures

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View All | ✓ (all) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) |
| Create | ✓ | ✓ | ✓ | ✓ | ✗ |
| Update | ✓ | ✓ | ✓ | ✗ | ✓ (stock only) |
| Delete | ✓ | ✗ | ✗ | ✗ | ✗ |

#### Follow-ups

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View All | ✓ (all) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) |
| Create | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete | ✓ | ✗ | ✗ | ✗ | ✗ |

#### Stock Requests

| Operation | Admin | Manager | Doctor | Other |
|-----------|-------|---------|--------|-------|
| View | All | Incoming/outgoing | ✗ | ✗ |
| Create (to other) | ✓ | ✓ | ✗ | ✗ |
| Approve Incoming | ✓ | ✓ | ✗ | ✗ |
| Reject Incoming | ✓ | ✓ | ✗ | ✗ |

#### Reports

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View Reports | ✓ | ✓ (own branch) | ✓ (own branch) | ✗ | ✗ |
| Export XLSX | ✓ | ✓ | ✓ | ✗ | ✗ |
| Export PDF | ✓ | ✓ | ✓ | ✗ | ✗ |
| Filter by Branch | ✓ | ✓ | ✓ | ✗ | ✗ |

#### Audit Logs

| Operation | Admin | Manager | Doctor | Receptionist | Assistant |
|-----------|-------|---------|--------|--------------|-----------|
| View Logs | ✓ | ✗ | ✗ | ✗ | ✗ |
| Filter Logs | ✓ | ✗ | ✗ | ✗ | ✗ |

#### Settings

| Operation | Admin | Other |
|-----------|-------|-------|
| Export JSON | ✓ | ✗ |
| Export Excel | ✓ | ✗ |
| Import JSON | ✓ | ✗ |
| View Settings | ✓ | Manager (limited) |
| Manage Users | ✓ | ✗ |
| Manage Branches | ✓ | ✗ |

---

## 5. Complete Module Documentation

### 5.1 Dashboard

**Purpose:** Role-aware landing page showing relevant KPIs and operations.

**Business Goal:** Provide immediate visibility into daily operations.

**Location:** `src/pages/Dashboard.tsx`

**Role Routing:**
```
User Role → Dashboard Component:
  Receptionist → ReceptionDashboard
  Manager      → ManagerDashboard
  Admin/Doctor → ClinicalDashboard
  Assistant    → (no dashboard, redirect)
```

**ReceptionDashboard:**
- Quick stats: patients today, appts today, new patients (24h)
- Today's appointments list (scrollable horizontal patient cards)
- Today's appointments table (upcoming, with patient details)
- Quick actions panel (new patient, new appointment)

**ManagerDashboard:**
- Pending stock requests count
- Low stock items count (quantity - reserved <= 3)
- Total deliveries count
- Today's appointments count
- Pending stock requests widget (top 5)
- Low stock alerts widget (top 5)
- Link to full inventory view

**ClinicalDashboard:**
- Revenue KPIs: total revenue, pending, monthly collected, monthly growth
- Invoice status breakdown (paid/partial/pending counts)
- Patient stats: total active, new this month
- Procedure stats: total, by status
- Follow-up stats: total, critical, avg pain, avg health
- Daily revenue chart (7-day area chart)
- Next 24h appointments
- Auto-refresh every 30 seconds

**Data Sources:**
- `patientService.getAll()` — all patients
- `patientService.getStats()` — patient counts
- `appointmentService.getAll()` — appointments
- `procedureService.getAll()` — procedures
- `procedureService.getStats()` — procedure stats
- `followUpService.getStats()` — follow-up stats
- `financialRecordService.getAnalytics()` — revenue
- `financialRecordService.getDailyRevenue(7)` — chart data
- `implantInventoryService.getStockRequests()` — pending requests
- `branchService.getAllBranchInventory()` — low stock
- `deliveryService.getDeliveries()` — delivery count

### 5.2 Patients

**Purpose:** Patient registry with search, filtering, and creation.

**Business Goal:** Centralized patient management across all branches.

**Location:** `src/pages/Patients.tsx`

**Key Features:**
- Patient list with pagination (10 per page)
- Client-side search by name or phone
- Add Patient modal (full_name, phone, medical_history)
- Patient card selection with detail view
- Profile navigation on patient click

**Data Source:** `patientService.getAll()` — global, no branch filter
**Search:** Client-side filter on full_name and phone fields

**Validation:**
- full_name: required
- phone: required
- No duplicate phone check (business rule: allow same phone)

### 5.3 Patient Profile

**Purpose:** Complete patient 360-degree view.

**Location:** `src/pages/dashboard/PatientProfile.tsx`

**Tabs:**
- **Overview** — Personal info, vital stats, stat cards
- **Timeline** — Chronological activity feed (communications, procedures, appointments, payments, invoices)
- **Financial** — Invoices, payments, outstanding balance
- **Documents** — Uploaded files with categories
- **Communications** — Communication history

**Financial Section:**
- Stat cards: total invoiced, total paid, remaining
- Invoice cards with branch name badges (global display)
- Payment history per invoice
- Invoice creation modal (with reason dialog)
- Payment recording modal (with reason dialog)
- Print receipt functionality
- Statement modal (running balance)

**Data Sources:**
- `patientService.getById(id)`
- `procedureService.getByPatient(id)`
- `financialRecordService.getByPatient(id)` — joins branches for branch_name
- `appointmentService.getAll()` — filtered client-side
- `followUpService.getByPatient(id)`
- `patientFileService.getByPatient(id)`
- `communicationService.getByPatient(id)`

### 5.4 Appointments

**Purpose:** Appointment scheduling and management.

**Location:** `src/pages/dashboard/Appointments.tsx`

**Features:**
- Appointment list with pagination
- Filters: search by patient name, status filter
- Appointment creation modal
- Status management: confirm, complete, cancel, no-show

**Data Source:** `appointmentService.getAll(branchId?)` — branch-scoped for non-admin

**Status Transitions:**
```
scheduled → confirmed (receptionist confirms)
scheduled → cancelled
confirmed → completed (appointment done)
confirmed → no_show (patient didn't arrive)
confirmed → cancelled
```

### 5.5 Procedures

**Purpose:** Clinical procedure tracking with inventory consumption.

**Location:** `src/pages/ImplantCases.tsx`

**Features:**
- Procedure list with patient context
- Procedure creation (doctor fills details)
- Kit assignment (pre-configured procedure kits)
- Auto inventory consumption on procedure creation
- Stock availability check before procedure

**Data Source:** `procedureService.getAll(branchId?)` — branch-scoped

**Kit Consumption Flow:**
```
Procedure Created
    ├── kit_id assigned? → fetch kit items
    ├── For each kit item:
    │   ├── Check stock availability
    │   ├── Deduct from branch inventory
    │   └── Record inventory transaction
    └── Kit snapshot stored in procedure (kit_snapshot JSONB)
```

### 5.6 Financial

**Purpose:** Comprehensive financial management.

**Location:** `src/pages/dashboard/Payments.tsx`

**Invoices:**
- Invoice list per selected patient
- Columns: name, total, paid, remaining, status, date, branch
- Create, edit, delete invoices
- Invoice status badge (Pending/Partial/Paid)

**Payments:**
- Record payment against invoice
- Payment methods: cash, card, insurance, bank_transfer
- Auto-sync invoice status on payment
- Payment history per invoice

**Revenue Analytics:**
- Total revenue KPIs
- Monthly breakdown chart
- Status distribution (paid/partial/pending counts)

**Reason for Change:**
- Invoice creation → reason dialog
- Payment recording → reason dialog
- Invoice update → reason dialog
- Delete record → reason dialog

### 5.7 Inventory

**Purpose:** Complete inventory management across all categories and branches.

**Location:** `src/pages/Inventory.tsx` (~1770 lines)

**Tabs:**
1. **Implants** — Implant inventory per branch, CRUD operations
2. **Abutments** — Abutment inventory per branch, CRUD operations
3. **Prosthetic** — Prosthetic components, CRUD operations
4. **Materials** — Materials, CRUD operations
5. **Branches** — Per-branch inventory view with quantities
6. **Count** — Inventory count sessions (create, edit items, approve)
7. **Deliveries** — Cross-branch and supplier deliveries with status workflow
8. **Returns** — Return requests (create, approve/reject)
9. **Requests** — Cross-branch stock requests (create, approve/reject)
10. **Transactions** — Inventory movement history

**Shared Aggregation:**
All tabs use `get_aggregated_inventory(p_category, p_branch_id)` RPC which queries the `v_inventory_all` view. This view unifies data from `inventory_items`, legacy `implant_inventory`, and legacy `abutment_inventory` tables.

**Branch Isolation:**
- Non-admin users: `shouldFilterBranch = true`, queries filtered to own branch
- Admin users: all branches visible

**Item Display Name:**
All inventory items use the canonical `getItemDisplayName(item)` function from `src/utils/inventory.ts`:
```
fallback chain: name → subcategory → "brand size" → brand → size → category
```

**Product Catalog:**
The `get_product_catalog(p_category)` RPC returns distinct items using `DISTINCT ON (category, subcategory, name, brand, size)`. Used in request and add-stock dropdowns.

### 5.8 Reports

**Purpose:** Comprehensive reporting with export capabilities.

**Location:** `src/pages/dashboard/Reports.tsx`

**Report Sections:**
1. **Financial** — Daily revenue (7-day), monthly breakdown, outstanding balance
2. **Clinical** — Procedures by status, healing stats (on-track/critical/failure)
3. **Inventory** — Low stock alerts, top 5 used implants, estimated inventory value
4. **Cross-Branch** — Request stats (pending/approved/rejected/completed)
5. **Patient** — New vs returning patients (30-day window)

**Filters:**
- Date range (from/to)
- Branch (dropdown)
- Doctor (dropdown)

**Export:**
- XLSX per section using `xlsx` library
- PDF per section using `html2canvas`

**Data Calculation:** All reports use in-memory aggregation from Supabase queries (no dedicated RPCs).

**Permissions:**
- Admin: all sections, all branches
- Manager: all sections, own branch filtered
- Doctor: all sections, own branch filtered (read-only)
- Receptionist/Assistant: no access

### 5.9 Communications

**Purpose:** Patient communication tracking.

**Location:** Built into PatientProfile.tsx (Timeline tab, Communications tab)

**Types:**
- `call` — Phone call
- `whatsapp` — WhatsApp message
- `sms` — SMS text
- `email` — Email
- `note` — General note
- `clinic_note` — Clinical note

**Direction:**
- `inbound` — Patient contacted clinic
- `outbound` — Clinic contacted patient

**Features:**
- Add communication modal (type, direction, content)
- Display in Timeline chronologically
- Branch-scoped: staff can only add communications for own branch patients

**Data Source:** `communicationService.getByPatient(patientId)`

### 5.10 Patient Files

**Purpose:** Document management for patients.

**Location:** PatientProfile.tsx (Documents tab)

**Features:**
- Upload files (images, PDFs, documents)
- File categories
- Rename files
- Delete files
- View/download files

**Storage:** Supabase Storage bucket `patient_profiles` / `patient_files`

**Data Source:** `patientFileService.getByPatient(patientId)`

**Validation:**
- File type: JPEG, PNG, WebP only for profile images
- File size: configurable limits
- Storage path: `patients/{patientId}/{uuid}.{ext}`

### 5.11 Audit Logs

**Purpose:** Complete audit trail for all sensitive operations.

**Location:** `src/pages/dashboard/AuditLogs.tsx`

**Features:**
- Log list with avatar initials, user name, role, action, table, record ID
- Expanded detail view with old/new data diff
- Reason category badge and reason text display
- Filters: search, action, table, role, branch, date range
- Pagination (25 per page)

**Data Source:** `auditLogService.getAll(options)`

**Audit Actions:**
`INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `USER_CREATED`, `ROLE_CHANGED`, `INVENTORY_CHANGE`, `PAYMENT_CHANGE`

**Reason Display:**
In expanded detail view:
- Reason Category (yellow badge)
- Reason text (paragraph)

### 5.12 Settings

**Purpose:** System configuration and backup.

**Location:** `src/pages/dashboard/Settings.tsx`

**Tabs:**
1. **General** — Basic settings
2. **Backup** — Export/Import data

**Backup Features:**
- Export JSON: fetches all tables, downloads as JSON file
- Export Excel: multi-sheet XLSX workbook
- Import JSON: file upload → upsert into respective tables

**Permissions:**
- Admin: full access to all settings including backup import/export
- Manager: limited settings (no backup import/export)
- Other roles: no access

### 5.13 Users & Branches

**Purpose:** User and branch management.

**Managed within** Settings.tsx (Admin only).

**User Fields:**
`auth_user_id`, `username`, `full_name`, `email`, `role`, `is_active`, `branch_id`

**Branch Fields:**
`name`, `address`, `phone`, `is_active`

**User Roles:** Admin, Manager, Doctor, Receptionist, Assistant

**Business Rules:**
- Users must have a unique `username` and `email`
- `branch_id` is required for non-Admin roles
- Admin users have no branch restriction
- Users can be deactivated (`is_active: false`) rather than deleted

---

## 6. Business Rules

### 6.1 Patient Rules

- **Patients are GLOBAL.** All staff across all branches can see all patients.
- Patient `branch_id` is stored as metadata (which branch registered them) but is never used as a filter.
- Patients can be created by Admin, Manager, and Receptionist.
- Patient search is global (by name or phone).
- Patient profile shows complete history regardless of which branch performed the treatment.
- No duplicate phone validation — same phone allowed across different patients.

### 6.2 Financial Rules

- **Financial records are GLOBAL.** Every branch sees the complete financial history of every patient.
- Each financial record displays its originating `branch_name` and `branch_id`.
- Financial records are grouped by branch for readability but never hidden.
- Invoice statuses: `Pending` → `Partial` → `Paid` (auto-calculated from payments).
- Invoice sync: when a payment is added/updated/deleted, the parent invoice's `paid_so_far`, `remaining_amount`, and `status` are recalculated.
- Payment methods: `cash`, `card`, `insurance`, `bank_transfer`.
- Managers can edit invoices across all branches (global update permission).
- Financial analytics (`getAnalytics`, `getDailyRevenue`, `getMonthlyBreakdown`) accept optional `branchId` for scope.

### 6.3 Inventory Rules

- **Inventory is BRANCH-SCOPED.** Each branch has its own stock.
- Every product variant exists in every branch with qty=0 by default (seeded via migration).
- Shared aggregation via `v_inventory_all` view + `get_aggregated_inventory` RPC.
- Item display name uses canonical `getItemDisplayName()` helper.
- Product catalog dropdowns use `get_product_catalog()` RPC with `DISTINCT ON`.
- Stock adjustments require a reason (mandatory for all sensitive operations).
- Low stock threshold: `quantity - reserved <= minimum_stock` (default: 3 if not set).

### 6.4 Cross-Branch Rules

- Cross-branch requests replace stock_requests UI (stock_requests table kept for legacy).
- Request flow: Manager selects item → system shows branches with stock → picks source → sends request.
- Approval checks `checkSufficientStock()` — if insufficient, shows error.
- On approval → auto-creates Delivery (`preparing` status).
- Delivery completion auto-transfers inventory via DB trigger `handle_cross_branch_delivery_complete()`.
- Notifications are server-side DB triggers.

### 6.5 Procedure Rules

- Procedures consume inventory at creation time (if kit assigned).
- Kit items are SNAPSHOT on assignment (`kit_snapshot` JSONB on `procedures`).
- Stock check before consumption — fails if insufficient.
- Procedure updates require a reason (mandatory).

### 6.6 Follow-up Rules

- Healing statuses: `OnTrack`, `Healing`, `Critical`, `Failure`, `Completed`.
- Follow-ups track `health_score` (0-10) and `pain_level` (0-10).
- Critical follow-ups are flagged for attention.
- Follow-up status changes require a reason.

### 6.7 Appointment Rules

- Appointment statuses: `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`.
- Status transitions are one-way (forward only, except cancel).
- Appointment status changes require a reason.

### 6.8 Reason for Change Rules (Critical)

**Sensitive Operations (Reason Required):**
- Invoice Creation, Update, Cancellation
- Payment Creation, Update
- Refund Creation/Update
- Procedure Update
- Stock Quantity Adjustment
- Stock Transfer Approval/Rejection
- Inventory Count Approval
- Return Approval/Rejection
- Financial Corrections
- Manual Balance Adjustments
- Appointment Status Changes
- Follow-up Status Changes

**Storage:**
- Reason fields (`change_reason`, `reason_category`) stored in both:
  1. The record itself (for immediate visibility)
  2. The audit log entry (for historical tracking)

**Permanence:**
- Reason fields are immutable once saved
- Users cannot edit or delete the recorded reason
- Only a new revision can introduce a new reason

**Categories:**
- Financial: Billing Correction, Wrong Amount, Duplicate Invoice, Payment Adjustment, Refund Correction, Insurance Adjustment
- Inventory: Damaged Item, Expired Item, Stock Count Difference, Transfer Correction, Supplier Error, Manual Adjustment
- Clinical: Treatment Plan Updated, Clinical Correction, Wrong Patient Selection
- Administrative: Data Entry Error, User Request, Manager Decision, Administrative Correction, Other

### 6.9 Soft Delete Rules

- No records are permanently deleted from the database.
- Deletions are either:
  - Actual DELETE for financial records (invoices, payments) with audit logging
  - Status-based deactivation for users (`is_active: false`)
  - Hard DELETE only for specific cleanup operations (audit logged)
- All deletions are recorded in audit logs with reason.

### 6.10 Ownership Rules

- `created_by` — references `users(auth_user_id)` for the user who created the record
- `created_at` — auto-set timestamp
- `updated_at` — updated on modification (where table has this column)
- `branch_id` — which branch owns the record (for scoped tables)
- `requested_by` / `responded_by` — for cross-branch requests
- `approved_by` — for approval workflows
- `reviewed_by` — for return reviews

### 6.11 Notification Rules

- Notifications are created by DB triggers (server-side).
- Stock request creation → notification to source branch manager.
- Delivery status change → notification to requesting branch.
- Return approval/rejection → notification to requester.
- Low stock → notification to branch manager.

### 6.12 RLS (Row-Level Security) Rules

The RLS system uses `get_current_user_role()` PL/pgSQL function (not `auth.jwt()->>'role'` which returns 'authenticated').

**Key Tables and Their RLS:**
- `patients`: Global SELECT for Admin, Manager, Doctor, Receptionist
- `financial_records`: Global SELECT for Admin, Manager, Doctor, Receptionist; UPDATE for Admin, Manager
- `inventory_items`: Branch-isolated (role check + branch check)
- `procedures`: Branch-isolated
- `appointments`: Branch-isolated
- `inventory_transactions`: Branch-isolated
- `inventory_count_sessions`: Branch-isolated
- `inventory_returns`: Branch-isolated
- All SECURITY DEFINER RPCs include role/branch checks

---

## 7. Workflow Documentation

### 7.1 Complete Patient Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE PATIENT JOURNEY                            │
└──────────────────────────────────────────────────────────────────────────────┘

STEP 1: PATIENT REGISTRATION
────────────
    Receptionist at Branch A registers patient
    ├── Required: full_name, phone
    ├── Optional: email, gender, DOB, medical_history, etc.
    ├── branch_id set to Branch A (metadata only)
    └── Patient visible globally across all branches

STEP 2: APPOINTMENT SCHEDULING
────────────
    Receptionist schedules initial consultation
    ├── Date/time selected
    ├── Status: scheduled
    └── Patient arrives → Status: confirmed

STEP 3: CONSULTATION
────────────
    Doctor reviews patient history (global view)
    ├── Past procedures, medical history, allergies
    ├── Treatment plan discussed
    └── Implant decision: Immediate / Delayed / Not Possible

STEP 4: PROCEDURE (IMPLANT SURGERY)
────────────
    Doctor creates procedure record
    ├── Procedure name, tooth number, implant details
    ├── Kit assigned → auto-stock-check
    ├── If stock sufficient → consume inventory
    │   ├── Deduct from Branch A inventory
    │   └── Record transaction
    ├── If stock insufficient → show error, cannot proceed
    └── Kit snapshot saved in procedure

STEP 5: INVOICING
────────────
    Doctor/Admin/Manager creates invoice
    ├── Reason required for invoice creation
    ├── Invoice name, total amount
    ├── Status: Pending
    ├── branch_id recorded (metadata)
    └── Invoice visible globally

STEP 6: PAYMENT
────────────
    Patient makes payment (partial or full)
    ├── Reason required for payment
    ├── Cash/card/insurance/bank_transfer
    ├── Invoice synced automatically
    │   ├── paid_so_far += amount
    │   ├── remaining_amount = total - paid_so_far
    │   └── Status: Partial or Paid
    └── Payment visible globally

STEP 7: FOLLOW-UP (HEALING CHECK)
────────────
    Doctor schedules follow-up
    ├── Health score (0-10)
    ├── Pain level (0-10)
    ├── Healing status: OnTrack / Critical / Failure
    └── Notes on recovery

STEP 8: PROSTHETIC PLACEMENT
────────────
    (If applicable) Second procedure for crown/prosthetic
    ├── New procedure record
    ├── May consume prosthetic inventory items
    └── Additional invoicing if needed

STEP 9: FINAL SETTLEMENT
────────────
    Final invoice settlement
    ├── Any remaining balance paid
    └── Invoice status: Paid

STEP 10: PERIODIC FOLLOW-UP
────────────
    Reminder system
    ├── Birthday reminders
    ├── Recall reminders (6-month / 1-year)
    └── Custom scheduled reminders
```

### 7.2 Inventory Transfer Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      CROSS-BRANCH INVENTORY TRANSFER                        │
└──────────────────────────────────────────────────────────────────────────────┘

Branch A (Requesting)                    Branch B (Supplying)
────────────────────                     ────────────────────

Manager creates request                    
├── Opens Requests tab                    
├── Clicks "New Request"                  
├── Selects item from catalog             
│   (category → item selector)            
├── System shows Branch B has stock       
├── Selects Branch B (source)             
├── Enters quantity = 5                   
├── Notes: "Need for urgent surgery"      
└── Status: pending                       
                                          Manager sees incoming request
                                          ├── In Requests tab, "Incoming" section
                                          ├── Review: "5 units of Implant X"
                                          ├── System checks: Branch B has 20 units
                                          ├── Sufficient? → YES
                                          ├── Clicks Approve
                                          ├── Reason dialog: "Stock available"
                                          └── Status: approved
                                              
Delivery auto-created
├── Status: preparing
├── Delivery appears in Deliveries tab
└── Both branches can see it

Branch B prepares shipment
├── Status update: picked_up
└── Timestamp recorded

In transit
├── Status update: in_transit
└── (Logistics tracking)

Branch A receives
├── Status update: arrived
└── Branch A confirms receipt

Delivery completed
├── Status update: completed
├── DB TRIGGER FIRES:
│   ├── Branch B: inventory_item.quantity -= 5
│   └── Branch A: inventory_item.quantity += 5
└── Transaction recorded for both branches

ALTERNATIVE: REJECTION
└── Manager at Branch B clicks Reject
    ├── Reason dialog: "Insufficient stock"
    └── Status: rejected (request voided)

EDGE CASE: INSUFFICIENT STOCK ON APPROVAL
└── If stock changed between request and approval:
    ├── Approval check fails
    ├── Error shown: "Source branch no longer has sufficient stock"
    └── Request stays pending (manager must handle manually)
```

### 7.3 Invoice Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            INVOICE LIFECYCLE                                │
└──────────────────────────────────────────────────────────────────────────────┘

  CREATION
  ─────────
  Trigger: After procedure completion
  Created by: Doctor, Admin, Manager
  Fields: patient_name, invoice_name, total_amount, notes
  Reason: Required
  Status: Pending
  
  PAYMENT
  ───────
  Trigger: Patient pays
  Created by: Admin, Manager
  Fields: amount, payment_method (cash/card/insurance/bank_transfer)
  Reason: Required
  Auto-sync: Updates parent invoice
    ├── paid_so_far Increased
    ├── remaining_amount Decreased
    └── Status Recalculated
    
  UPDATE
  ──────
  Trigger: Correction needed
  By: Admin, Manager
  Fields: invoice_name, total_amount, notes
  Reason: Required
  If total_amount changed → re-sync invoice

  DELETION
  ────────
  Trigger: Wrong invoice, duplicate
  By: Admin, Manager
  Action: Hard DELETE from database
  Reason: Required
  Audit: Action logged with full context
  If deleted record was a payment → parent invoice re-synced

  STATUS CALCULATION
  ──────────────────
  paid_so_far = SUM of all payments' amount
  remaining_amount = MAX(0, total_amount - paid_so_far)
  
  IF paid_so_far = 0           → Pending
  IF paid_so_far < total_amount → Partial
  IF paid_so_far >= total_amount → Paid
```

### 7.4 Return Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            RETURN LIFECYCLE                                 │
└──────────────────────────────────────────────────────────────────────────────┘

  CREATION
  ─────────
  Trigger: Defective, expired, or wrong item
  Created by: Admin, Manager, Doctor
  Fields:
  ├── from_location: warehouse | branch | patient
  ├── from_branch_id (if from_location = branch)
  ├── item_id / item_name
  ├── quantity
  ├── reason: wrong_item | damaged | expired | cancelled_procedure |
  │           cross_branch_return | supplier_return | other
  ├── notes
  └── branch_id (own branch)
  
  Status: pending

  APPROVAL
  ────────
  By: Admin (global) or Manager (own branch)
  Action: Approve
  ├── Reason required
  ├── reviewed_by set
  ├── reviewed_at set
  ├── Inventory adjusted (item returned to stock or removed)
  └── Status: approved

  REJECTION
  ─────────
  By: Admin or Manager
  Action: Reject
  ├── Reason required
  ├── reviewed_by set
  ├── reviewed_at set
  └── Status: rejected

  EDGE CASES
  ──────────
  - Item already consumed: reject return
  - Item from different branch: route to appropriate branch
  - Quantity > available stock: reject or partial approve
```

### 7.5 Inventory Count Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        INVENTORY COUNT WORKFLOW                             │
└──────────────────────────────────────────────────────────────────────────────┘

  SESSION CREATION
  ────────────────
  By: Admin or Manager
  ├── Select branch
  ├── Enter session name/notes
  └── Status: draft
  
  Auto-populates all items for that branch
  ├── item_id, system_quantity (current stock level)
  ├── actual_quantity = system_quantity (default)
  ├── difference = 0
  └── All items from v_inventory_all for that branch

  COUNTING
  ────────
  Staff physically counts items
  ├── Updates actual_quantity per item
  ├── System calculates difference = actual - system
  ├── Optional reason per item (e.g., "Found 2 extra in drawer")
  └── Status update: in_progress

  COMPLETION
  ──────────
  All items counted
  ├── Status: completed
  └── Ready for approval

  APPROVAL
  ────────
  By: Admin or Manager (reason required)
  └── Status: approved
  
  DB TRIGGER FIRES: handle_count_session_approval()
  ├── For each item with difference != 0:
  │   ├── inventory_item.quantity = actual_quantity
  │   └── Adjustment transaction recorded
  └── Session locked (no further edits)

  DELETION
  ────────
  By: Admin
  ├── Only allowed for draft/in_progress sessions
  └── Cannot delete approved sessions
```

### 7.6 Appointment Booking Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        APPOINTMENT BOOKING FLOW                             │
└──────────────────────────────────────────────────────────────────────────────┘

  CREATE
  ──────
  By: Receptionist, Admin, Manager
  ├── Select patient (from global patient search)
  ├── Select date/time
  ├── Select doctor
  ├── Set status (default: scheduled)
  └── Branch: assigned from user's branch (non-admin)

  NOTIFICATION
  ────────────
  └── (Future: SMS/email notification to patient)

  CHECK-IN
  ────────
  Receptionist at front desk
  ├── Patient arrives
  ├── Status update: scheduled → confirmed
  └── Doctor notified

  COMPLETION
  ──────────
  ├── Appointment done
  ├── Status: confirmed → completed
  └── (Optional: auto-create procedure)

  CANCELLATION / NO-SHOW
  ├── Patient cancels → cancelled
  ├── Patient doesn't arrive → no_show
  └── Reason required for status change

  VIEWS
  ─────
  - Today's appointments on Reception Dashboard
  - Patient appointment history in Profile
  - Full appointment list in Appointments tab
```

---

## 8. Inventory Documentation

### 8.1 Inventory Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `implant` | Dental implant fixtures | "Implant 3.5x10mm", "Implant 4.0x8mm" |
| `abutment` | Connecting pieces between implant and crown | "Abutment TI Base", "Abutment Angled" |
| `prosthetic` | Crown and bridge components | "Zirconia Crown", "PFM Crown" |
| `material` | Consumable materials | "Suture", "Bone Graft", "Membrane" |

### 8.2 Inventory Data Model

The inventory system uses a unified view (`v_inventory_all`) that aggregates from three tables:

**Primary table:** `inventory_items`
- `id` (UUID)
- `branch_id` (UUID, FK → branches)
- `category` (implant | abutment | prosthetic | material)
- `subcategory` (string)
- `name` (string)
- `brand` (string)
- `size` (string)
- `unit` (string)
- `quantity` (integer)
- `reserved` (integer)
- `used` (integer)
- `minimum_stock` (integer)
- `created_at`, `updated_at`

**Legacy tables (still seeded but consolidated):**
- `implant_inventory` — More fields (brand, size, quantity, reserved, used)
- `abutment_inventory` — Type, quantity, reserved, used

**Unified View:** `v_inventory_all`
```sql
SELECT * FROM inventory_items
UNION ALL
SELECT ... FROM implant_inventory
UNION ALL
SELECT ... FROM abutment_inventory
```
With deduplication logic to prevent counting the same item twice.

### 8.3 Aggregation RPC

**Function:** `get_aggregated_inventory(p_category TEXT, p_branch_id UUID)`

Returns inventory items filtered by:
- Category (optional — if null, returns all categories)
- Branch (optional — if null, returns all branches for admin)

Used by: All inventory tabs, branch inventory view, reports.

### 8.4 Product Catalog

**Function:** `get_product_catalog(p_category TEXT)`

Returns distinct product variants using `DISTINCT ON (category, subcategory, name, brand, size)`.

Used by: Request modal (selecting items), Add Stock modal.

### 8.5 Item Display Name

**Canonical function:** `getItemDisplayName(item)` in `src/utils/inventory.ts`

Fallback chain:
```
if item.name       → return name
if item.subcategory → return subcategory
if brand + size     → return "brand size"
if brand           → return brand
if size            → return size
if category        → return category
else               → return "Unknown"
```

### 8.6 Stock Transactions

**Table:** `inventory_transactions`

Columns: `id`, `item_type`, `item_id`, `type` (add/deduct), `operation_type` (add/issue/return/adjust/cross_branch), `quantity`, `item_category`, `item_name`, `patient_id`, `procedure_id`, `notes`, `created_by`, `change_reason`, `reason_category`

**Operation Types:**
- `add` — Stock added (supplier, manual)
- `issue` — Stock consumed (procedure)
- `return` — Stock returned
- `adjust` — Manual adjustment (count correction)
- `cross_branch` — Transfer between branches

### 8.7 Cross-Branch Delivery

**Table:** `cross_branch_deliveries`

Columns: `id`, `request_id` (FK → cross_branch_requests), `status` (preparing/picked_up/in_transit/arrived/completed), `updated_by`, `created_at`, `updated_at`

**Trigger on completion** (`handle_cross_branch_delivery_complete`):
```sql
UPDATE inventory_items 
SET quantity = quantity - delivery.quantity 
WHERE branch_id = delivery.from_branch_id;

UPDATE inventory_items 
SET quantity = quantity + delivery.quantity 
WHERE branch_id = delivery.to_branch_id;
```

### 8.8 Low Stock Detection

Threshold: `quantity - reserved <= minimum_stock` or `quantity - reserved <= 3` (default)

**Display:**
- ManagerDashboard: Low Stock Alerts widget (top 5)
- Reports: Low Stock Alerts section
- Inventory: Visual indicators (red highlighting)

### 8.9 Inventory Count

**Tables:**
- `inventory_count_sessions` — `id`, `branch_id`, `status`, `notes`, `created_by`, `approved_by`, `approved_at`, `change_reason`, `reason_category`
- `inventory_count_items` — `id`, `session_id`, `item_id`, `system_quantity`, `actual_quantity`, `difference`, `reason`

**Trigger on approval** (`handle_count_session_approval()`):
For each count item where `difference != 0`, update `inventory_items.quantity` to `actual_quantity` and record an adjustment transaction.

---

## 9. Financial Documentation

### 9.1 Invoice System

**Table:** `financial_records` — polymorphic table for both invoices and payments.

**Invoice Fields:**
- `record_type: 'invoice'`
- `invoice_name` — Display name
- `total_amount` — Total invoice value
- `paid_so_far` — Sum of payments
- `remaining_amount` — Balance due
- `status` — Pending | Partial | Paid
- `branch_id` — Originating branch (metadata)
- `change_reason`, `reason_category` — Reason for creation

**Payment Fields:**
- `record_type: 'payment'`
- `parent_invoice_id` — FK to parent invoice
- `amount` — Payment amount
- `payment_method` — cash | card | insurance | bank_transfer
- `branch_id` — Originating branch (metadata)
- `change_reason`, `reason_category` — Reason for payment

### 9.2 Payment Status Calculation

```typescript
function syncInvoice(invoiceId: string) {
  totalPaid = SUM(payments.amount WHERE parent_invoice_id = invoiceId)
  remaining = MAX(0, totalAmount - totalPaid)
  paid = MIN(totalPaid, totalAmount)
  
  if (paid <= 0) status = 'Pending'
  else if (paid < totalAmount) status = 'Partial'
  else status = 'Paid'
  
  UPDATE financial_records 
  SET paid_so_far = paid, remaining_amount = remaining, status
  WHERE id = invoiceId
}
```

### 9.3 Revenue Analytics

**Methods:**
- `getAnalytics(branchId?)` — Total revenue, pending, monthly collected, growth, invoice/paid/partial/pending counts
- `getDailyRevenue(days?, branchId?)` — Daily revenue for the last N days
- `getMonthlyBreakdown(branchId?)` — Monthly collected vs pending

**Branch scoping:** Optional `branchId` parameter for dashboard/analytics use; when null, returns global figures.

**Calculation:** In-memory aggregation from Supabase queries (no dedicated RPCs).

### 9.4 Branch Display

Every financial record includes:
- `branch_id` — UUID of originating branch
- `branch_name` — Resolved via join to `branches` table

**Display locations:**
- Patient Profile: Blue badge on each invoice card
- Payments page: "Branch" column in invoice table

---

## 10. Patient Documentation

### 10.1 Patient Data Model

**Table:** `patients`

Columns: `id`, `full_name`, `phone`, `email`, `gender`, `date_of_birth`, `address`, `notes`, `emergency_contact_name`, `emergency_contact_phone`, `profile_image_url`, `medical_history`, `chronic_disease`, `medication`, `allergies`, `smoking_status`, `created_by`, `created_at`, `branch_id`

### 10.2 Patient Profile Sections

**Overview Tab:**
- Personal information (editable inline)
- Profile photo (upload/camera)
- Stat cards: total invoiced, procedures, follow-ups, appointments
- Medical history

**Timeline Tab:**
- Chronological feed of all patient activities
- Types: communications (📞 ✉️ 💬), procedures (📝), appointments (📅), payments (💳), invoices (📄)
- Each entry shows: type icon, description, date, staff member
- Add Communication button (inline)

**Financial Tab:**
- Summary cards: total invoiced, total paid, remaining
- Invoice cards (each with branch badge)
- Payment history per invoice
- Print receipt, record payment, create invoice

**Documents Tab:**
- Uploaded files with category badges
- Upload, rename, delete operations
- File type icons

**Communications Tab:**
- Communication history with direction indicators
- Add new communication (type, direction, content)

### 10.3 Patient Search

- Global search across all branches
- Search by `full_name` (ILIKE) or `phone` (partial match)
- Limited to 20 results
- Client-side case-insensitive filtering

---

## 11. Communications

### 11.1 Communication Types

| Type | Icon | Description |
|------|------|-------------|
| `call` | 📞 | Phone call |
| `whatsapp` | 💬 | WhatsApp message |
| `sms` | ✉️ | SMS text |
| `email` | 📧 | Email |
| `note` | 📝 | General note |
| `clinic_note` | 🏥 | Clinical note |

### 11.2 Direction

- `inbound` — Patient contacted clinic
- `outbound` — Clinic contacted patient

### 11.3 Features

- All communications appear in Patient Timeline chronologically
- Staff can add communications for own branch patients
- Communications are editable (subject/content only)
- Communications are audited (audit log entries)
- No deletion of communications (immutable record)

### 11.4 Table: `communications`

Columns: `id`, `patient_id`, `type`, `direction`, `subject`, `content`, `staff_id`, `created_at`

---

## 12. Reports

### 12.1 Report Sections

**Financial Section:**
- Daily Revenue (7-day chart): `financialRecordService.getDailyRevenue(7)`
- Monthly Breakdown (bar chart): `financialRecordService.getMonthlyBreakdown()`
- Outstanding Balance: Sum of `remaining_amount` for all invoices

**Clinical Section:**
- Procedures by Status: Pie chart from `procedureService.getStats()`
- Healing Stats: On-track / Critical / Failure from `followUpService.getStats()`

**Inventory Section:**
- Low Stock Alerts: Items where `quantity - reserved <= 3`
- Top 5 Used Implants: Aggregated from `inventory_transactions`
- Estimated Inventory Value: Sum of `quantity * unit_price` (approximate)

**Cross-Branch Section:**
- Request Stats: Pending / Approved / Rejected / Completed counts
- Data from `cross_branch_requests` table

**Patient Section:**
- New vs Returning Patients: 30-day window analysis
- New: `created_at` within last 30 days
- Returning: has at least one procedure

### 12.2 Filters

- Date Range (from/to) — applied to relevant data
- Branch — filters procedures by branch users
- Doctor — filters procedures by doctor

### 12.3 Exports

- **XLSX:** Multi-sheet workbook using `xlsx` library
- **PDF:** Per-section using `html2canvas` DOM capture

Permissions: Admin full, Manager/Doctor own branch filtered.

---

## 13. Dashboard Documentation

| Widget | ClinicalDashboard | ReceptionDashboard | ManagerDashboard |
|--------|-------------------|-------------------|------------------|
| Revenue KPIs | ✓ | ✗ | ✗ |
| Invoice Status | ✓ | ✗ | ✗ |
| Patient Stats | ✓ | ✓ | ✗ |
| Procedure Stats | ✓ | ✗ | ✗ |
| Follow-up Stats | ✓ | ✗ | ✗ |
| Revenue Chart | ✓ | ✗ | ✗ |
| Today's Appointments | ✗ | ✓ | ✓ |
| Quick Actions | ✗ | ✓ | ✗ |
| Pending Stock Requests | ✗ | ✗ | ✓ |
| Low Stock Alerts | ✗ | ✗ | ✓ |
| Total Deliveries | ✗ | ✗ | ✓ |
| New Patients (24h) | ✗ | ✓ | ✗ |

---

## 14. Audit System

### 14.1 Audit Logs

**Table:** `audit_logs`

Columns: `id`, `user_id`, `user_name`, `action`, `table_name`, `record_id`, `old_data`, `new_data`, `role`, `branch_id`, `ip_address`, `user_agent`, `os`, `session_id`, `reason_category`, `change_reason`, `created_at`

**Actions:**
`INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `USER_CREATED`, `ROLE_CHANGED`, `INVENTORY_CHANGE`, `PAYMENT_CHANGE`

### 14.2 Logging Process

Every sensitive operation:
1. Operation executes (DB write)
2. After success, `auditLogService.log()` called
3. Log entry includes:
   - Who (user_id, user_name)
   - What (action, table_name, record_id)
   - Before/After (old_data, new_data)
   - Context (role, branch_id, browser info)
   - Why (reason_category, change_reason)

### 14.3 Audit Log Viewing

- Admin only
- Filters: user, action, table, role, branch, date range
- Pagination (25 per page)
- Expandable detail rows showing old/new data diff
- Reason category badge (yellow) + reason text

### 14.4 Revision History

Not a separate table — revision history is captured in:
1. The audit log entry (old_data vs new_data diff)
2. The record's own `change_reason` and `reason_category` fields

This dual storage ensures the reason is visible:
- Immediately on the record (for quick reference)
- In the audit trail (for historical investigation)

---

## 15. Database Documentation

### 15.1 Complete Table List

| # | Table | Purpose |
|---|-------|---------|
| 1 | `users` | System users linked to auth.users |
| 2 | `branches` | Physical clinic branches |
| 3 | `patients` | Patient registry |
| 4 | `financial_records` | Invoices and payments |
| 5 | `procedures` | Clinical procedures |
| 6 | `appointments` | Patient appointments |
| 7 | `follow_ups` | Post-treatment follow-ups |
| 8 | `inventory_items` | Primary inventory table |
| 9 | `implant_inventory` | Legacy implant table |
| 10 | `abutment_inventory` | Legacy abutment table |
| 11 | `inventory_transactions` | Stock movement history |
| 12 | `cross_branch_requests` | Inter-branch stock requests |
| 13 | `cross_branch_deliveries` | Inter-branch delivery tracking |
| 14 | `inventory_count_sessions` | Inventory count sessions |
| 15 | `inventory_count_items` | Per-item count data |
| 16 | `inventory_returns` | Return requests |
| 17 | `inventory_deliveries` | Supplier deliveries |
| 18 | `stock_requests` | Legacy stock requests |
| 19 | `patient_files` | Patient document storage |
| 20 | `communications` | Patient communications |
| 21 | `patient_reminders` | Patient reminders |
| 22 | `procedure_kits` | Pre-configured surgical kits |
| 23 | `procedure_kit_items` | Items in each kit |
| 24 | `audit_logs` | System audit trail |
| 25 | `notifications` | In-app notifications |

### 15.2 Key Relationships

```
users.branch_id → branches.id
patients.branch_id → branches.id
financial_records.branch_id → branches.id
procedures.branch_id → branches.id
appointments.* → patients.*
procedures.patient_id → patients.id
financial_records.patient_id → patients.id
follow_ups.patient_id → patients.id
follow_ups.procedure_id → procedures.id
inventory_items.branch_id → branches.id
cross_branch_requests.from_branch_id → branches.id
cross_branch_requests.to_branch_id → branches.id
cross_branch_deliveries.request_id → cross_branch_requests.id
inventory_count_sessions.branch_id → branches.id
inventory_count_items.session_id → inventory_count_sessions.id
inventory_returns.branch_id → branches.id
communications.patient_id → patients.id
patient_reminders.patient_id → patients.id
```

### 15.3 Views

**`v_inventory_all`** — Unified inventory aggregation view combining `inventory_items`, `implant_inventory`, and `abutment_inventory` with deduplication.

### 15.4 RPC Functions

| Function | Purpose |
|----------|---------|
| `get_aggregated_inventory(p_category, p_branch_id)` | Returns unified inventory with role check |
| `get_product_catalog(p_category)` | Returns distinct product variants |
| `get_branch_inventory_items(p_branch_id)` | Returns items for a specific branch |
| `get_requestable_items(p_exclude_branch_id, p_category)` | Items available for cross-branch request |
| `find_best_source_branch(p_category, p_subcategory, p_name, p_brand, p_size, p_quantity)` | Auto-find source branch |
| `get_current_user_role()` | Returns custom role from metadata |
| `confirm_auth_user()` | Validates user exists |

### 15.5 Triggers

| Trigger | Event | Action |
|---------|-------|--------|
| `handle_cross_branch_delivery_complete` | UPDATE on cross_branch_deliveries | Auto-transfer inventory on completion |
| `handle_count_session_approval` | UPDATE on inventory_count_sessions | Adjust inventory on count approval |
| `notify_on_stock_request` | INSERT on cross_branch_requests | Create notification for manager |
| `notify_on_delivery_update` | UPDATE on cross_branch_deliveries | Create notification on status change |

### 15.6 RLS Policies Summary

All RLS policies use `get_current_user_role()` function which reads `auth.jwt()->'user_metadata'->>'role'` (NOT `auth.jwt()->>'role'` which returns 'authenticated').

Tables with branch-scoped RLS: `procedures`, `appointments`, `follow_ups`, `inventory_items`, `inventory_transactions`, `cross_branch_requests`, `cross_branch_deliveries`, `inventory_count_sessions`, `inventory_returns`, `inventory_deliveries`, `communications`, `patient_files`, `notifications`

Tables with global RLS: `patients` (SELECT: Admin/Manager/Doctor/Receptionist), `financial_records` (SELECT: Admin/Manager/Doctor/Receptionist; UPDATE: Admin/Manager)

---

## 16. API / Services

### 16.1 Service Layer Architecture

Each service is a singleton object exported from `src/services/`. Services encapsulate all Supabase queries and business logic.

**Service Pattern:**
```typescript
export const serviceName = {
  async methodName(params): Promise<ReturnType> {
    // 1. Validate input
    // 2. Build query
    // 3. Execute
    // 4. Transform data (row mapper)
    // 5. Audit log (if sensitive operation)
    // 6. Return result
  }
}
```

### 16.2 Service Catalog

| Service | File | Primary Methods |
|---------|------|-----------------|
| `patientService` | `patientService.ts` | getAll, getById, search, create, update, getStats, uploadProfileImage |
| `financialRecordService` | `financialRecordService.ts` | getByPatient, getAllInvoices, createInvoice, addPayment, updateInvoice, deleteRecord, getAnalytics, getDailyRevenue, getMonthlyBreakdown |
| `procedureService` | `procedureService.ts` | getAll, getByPatient, create, update, updateStatus, delete, getStats |
| `appointmentService` | `appointmentService.ts` | getAll, create, updateStatus |
| `followUpService` | `followUpService.ts` | getAll, getByPatient, getCritical, create, update, delete, getStats |
| `implantInventoryService` | `implantInventoryService.ts` | getAggregatedInventory, getProductCatalog, getImplants, getAbutments, getInventoryItems, issueStock, adjustStock, consumeForProcedure, addStockToBranch, getTransactions, getStockRequests |
| `branchService` | `branchService.ts` | getAll, getById, create, update, delete, getInventory, getAllBranchInventory, adjustBranchStock |
| `crossBranchRequestService` | `crossBranchRequestService.ts` | getAll, create, approveRequest, updateStatus, checkSufficientStock, getRequestableItems, createDelivery, updateDeliveryStatus, getDeliveriesForBranches |
| `deliveryService` | `deliveryService.ts` | getDeliveries, createDelivery, getReturns, createReturn, updateReturnStatus |
| `inventoryCountService` | `inventoryCountService.ts` | getSessions, createSession, updateSessionStatus, deleteSession, getItems, upsertItem, batchInsertItems |
| `communicationService` | `communicationService.ts` | getByPatient, create, update, delete |
| `patientFileService` | `patientFileService.ts` | getByPatient, upload, delete, rename, updateCategory |
| `reminderService` | `reminderService.ts` | getByPatient, getUpcoming, create, markSent, delete |
| `auditLogService` | `auditLogService.ts` | getAll, log |
| `notificationService` | `notificationService.ts` | getByUser, getUnreadCount, markRead, markAllRead, create, createForRole |
| `userService` | `userService.ts` | getAll, getById, create, update, resetPassword, getCurrentBranchId |
| `authScope` | `authScope.ts` | getBranchScope, canAccessBranch, isAdminUser, isManagerUser |
| `procedureKitService` | `procedureKitService.ts` | getAll, getById, create, update, delete, getItems, addItem, updateItem, deleteItem |
| `searchService` | `searchService.ts` | searchAll |

### 16.3 Input Validation

Services do NOT perform extensive validation. Validation is handled:
- Client-side: before mutation call (form validation)
- Database: via NOT NULL constraints, CHECK constraints, and RLS
- Service layer: minimal validation (e.g., checking row existence)

### 16.4 Error Handling

- Services throw `Error` with message from Supabase
- UI catches errors and shows toast via `sonner`
- `errorService.log(error, context)` for console logging

---

## 17. Frontend Architecture

### 17.1 Component Tree

```
App.tsx
├── AuthContext.Provider
│   ├── LanguageContext.Provider
│   │   ├── ThemeContext.Provider
│   │   │   ├── Routes:
│   │   │   │   ├── / → Login.tsx
│   │   │   │   ├── /register → Register.tsx
│   │   │   │   ├── /forgot-password → ForgotPassword.tsx
│   │   │   │   ├── /update-password → UpdatePassword.tsx
│   │   │   │   └── /dashboard/* → ProtectedRoute → DashboardLayout.tsx
│   │   │   │       ├── /dashboard → Dashboard.tsx
│   │   │   │       ├── /dashboard/patients → Patients.tsx
│   │   │   │       ├── /dashboard/patients/:id/profile → PatientProfile.tsx
│   │   │   │       ├── /dashboard/appointments → Appointments.tsx
│   │   │   │       ├── /dashboard/procedures → ImplantCases.tsx
│   │   │   │       ├── /dashboard/follow-ups → FollowUps.tsx
│   │   │   │       ├── /dashboard/inventory → Inventory.tsx
│   │   │   │       ├── /dashboard/payments → Payments.tsx
│   │   │   │       ├── /dashboard/reports → Reports.tsx
│   │   │   │       ├── /dashboard/communications → (in PatientProfile)
│   │   │   │       ├── /dashboard/logs → AuditLogs.tsx
│   │   │   │       ├── /dashboard/settings → Settings.tsx
│   │   │   │       ├── /dashboard/notifications → Notifications.tsx
│   │   │   │       ├── /dashboard/stock-requests → StockRequestsPage.tsx
│   │   │   │       ├── /dashboard/returns → ReturnsPage.tsx
│   │   │   │       ├── /dashboard/deliveries → DeliveryForm.tsx
│   │   │   │       └── /dashboard/branches → BranchInventory.tsx
```

### 17.2 Contexts

**AuthContext** (`src/context/AuthContext.tsx`):
- Provides `user` object with `AuthUser` type (id, email, role, full_name, username, is_active, branch_id)
- Provides `signIn`, `signOut`, `signUp` methods
- Uses Supabase Auth for authentication
- Fetches user profile from `users` table

**LanguageContext** (`src/context/LanguageContext.tsx`):
- Provides `t()` translation function
- Supports English and Arabic
- Uses JSON locale files (en.json, ar.json)
- Language toggle persisted in localStorage

**ThemeContext** (`src/context/ThemeContext.tsx`):
- Dark theme only (the clinic UI uses a dark color scheme)
- Provides consistent color tokens

### 17.3 Hooks

- `useAuth()` — Convenience hook for AuthContext
- `useLanguage()` — Translation hook providing `t()` function
- `useAppointments()` — Complex hook wrapping appointment queries
- `useDebounce()` — Debounce utility for search inputs
- `useTranslation()` — Alternative translation hook

### 17.4 Reusable Components

- **ProtectedRoute** — Auth guard that redirects unauthenticated users
- **ReasonDialog** — Mandatory reason-for-change modal with category selector
- **AddPatientModal** — Patient creation form modal
- **StatusBadge** — Colored status indicator badge
- **Modal** — Generic modal wrapper
- **DataTable** — Reusable table component
- **Timeline** — Chronological activity feed
- **EmptyState** — Empty state placeholder
- **Skeleton** — Loading skeleton placeholder
- **AppointmentForm** — Appointment creation form

### 17.5 State Management

All server state is managed via React Query (TanStack Query):
- `useQuery` for data fetching (cached, auto-refetch)
- `useMutation` for data writes (onSuccess invalidates related queries)
- Query keys follow pattern: `['domain', ...params]`

Example:
```typescript
const { data: patients = [] } = useQuery({
  queryKey: ['patients'],
  queryFn: () => patientService.getAll(),
});

const createInvoiceMut = useMutation({
  mutationFn: (data) => financialRecordService.createInvoice(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['patient-financial'] });
    toast.success('Invoice created');
  },
});
```

---

## 18. Backend Architecture

### 18.1 Supabase

TrackImplant uses Supabase as its complete backend platform:

**Database:** PostgreSQL 15 with:
- Tables (25+)
- Views (1: `v_inventory_all`)
- RPC Functions (8+)
- Triggers (4+)
- Row-Level Security (all tables)
- Extensions (uuid-ossp)

**Authentication:** Supabase Auth with:
- Email/password authentication
- Session management
- User metadata for roles

**Storage:** Supabase Storage for:
- Patient profile images
- Patient documents/files

### 18.2 Authentication

- Email/password login via `supabase.auth.signInWithPassword()`
- Registration via `supabase.auth.signUp()`
- Password reset via `supabase.auth.resetPasswordForEmail()`
- Session managed by Supabase Auth SDK (auto-refresh)

### 18.3 Authorization

Three layers:

**Layer 1 — Database (RLS):**
- PostgreSQL Row-Level Security policies on every table
- Uses `get_current_user_role()` PL/pgSQL function
- SECURITY DEFINER RPCs include explicit role checks

**Layer 2 — Service Layer:**
- Branch-scoped services accept `branchId` parameter
- Admin services bypass branch filter
- Global services (patients, financial records) have no branch filter

**Layer 3 — Frontend:**
- `authScope.ts` provides `getBranchScope()`, `canAccessBranch()`
- Dashboard Layout shows/hides nav items based on role
- UI conditional rendering based on `user.role`

---

## 19. Security

### 19.1 Authentication Security

- All API calls go through Supabase Auth (JWT-based)
- Supabase client initialized with anonymous key (safe for client-side)
- Auth sessions auto-refreshed
- Password reset via email link

### 19.2 Authorization Security

- **RLS is the primary security layer** — enforced at the database level
- RLS policies use `get_current_user_role()` which reads from `auth.jwt()->'user_metadata'->>'role'`
- SECURITY DEFINER RPCs include explicit role validation
- Frontend role checks are for UX only (RLS is the real enforcement)

### 19.3 Branch Isolation

- Inventory tables: RLS checks `branch_id = get_user_branch()` for non-admin
- Clinical tables (procedures, appointments, follow-ups): RLS checks branch via `users` join
- Cross-branch tables: RLS allows access to both source and destination branches
- Global tables (patients, financial_records): RLS has NO branch filter

### 19.4 Sensitive Operation Security

All sensitive operations require:
1. Authentication (valid JWT)
2. Authorization (RLS check)
3. Reason for Change (mandatory, recorded permanently)
4. Audit Log Entry (permanent record)

### 19.5 Reason Tracking Security

- Reason fields are stored in both the record and the audit log
- Once saved, reasons cannot be edited or deleted
- Only a new revision can introduce a new reason
- No sensitive operation occurs without a traceable reason

---

## 20. Notifications

### 20.1 Table

**Table:** `notifications`

Columns: `id`, `user_id`, `title`, `message`, `type`, `link`, `is_read`, `created_at`

Types: `stock_request`, `delivery_update`, `return_status`, `low_stock`, `general`

### 20.2 Notification Events

| Event | Trigger | Created For | Type |
|-------|---------|-------------|------|
| Stock request created | INSERT on cross_branch_requests | Source branch manager | stock_request |
| Stock request approved | UPDATE on cross_branch_requests | Requesting branch manager | stock_request |
| Delivery status changed | UPDATE on cross_branch_deliveries | Both branch managers | delivery_update |
| Return status changed | UPDATE on inventory_returns | Return creator | return_status |
| Low stock detected | (Manual/periodic check) | Branch manager | low_stock |

### 20.3 UI

- `Notifications.tsx` page lists all notifications
- Unread count badge in navigation
- Mark read / Mark all read
- Clickable links navigate to relevant context

---

## 21. Revision History

### 21.1 Architecture

TrackImplant does NOT use a separate revision history table. Instead:

1. **Audit Logs** capture every data change with `old_data` and `new_data` JSON
2. **Reason Fields** on records store the reason for the latest change
3. **Timestamps** (`created_at`, `updated_at`) provide temporal context

### 21.2 Viewing History

- Audit Logs page shows all changes with diffs (old vs new)
- Patient Profile Timeline shows chronological activity
- Each audit entry shows: who, what, when, why (reason)

### 21.3 Restore

No automated restore from revision history. If a record needs to be restored:
1. Admin finds the original data in the audit log diff
2. Manually creates a correction entry with appropriate reason

---

## 22. Soft Delete

### 22.1 Implementation

TrackImplant does NOT use a universal soft delete pattern. Instead:

- **Financial records**: Hard DELETE with audit logging (deletions are rare and tracked)
- **Users**: Deactivation via `is_active: false` flag (soft)
- **Patients**: No delete available (records are permanent)
- **Procedures**: No delete available (clinical records are permanent)
- **Inventory items**: Hard DELETE with permission checks
- **Cross-branch requests**: Status-based deactivation (`rejected` status)
- **Inventory count sessions**: Hard DELETE (draft/in_progress only)

### 22.2 Recovery

- Financial records: Admin can re-create from audit log data
- Users: Admin can re-activate by setting `is_active: true`
- Inventory count sessions: Cannot recover deleted sessions (re-create instead)

---

## 23. Ownership

### 23.1 Ownership Fields

| Field | Purpose | Applied To |
|-------|---------|------------|
| `created_by` | User who created the record | patients, financial_records, inventory_count_sessions, inventory_transactions, inventory_returns, communications |
| `updated_at` | Last update timestamp | inventory_items, inventory_count_sessions, cross_branch_requests, inventory_returns, users, branches |
| `branch_id` | Owning branch | patients, financial_records, procedures, appointments, follow_ups, inventory_items, inventory_count_sessions, inventory_returns, communications |
| `requested_by` | User who requested | cross_branch_requests |
| `responded_by` | User who responded | cross_branch_requests |
| `approved_by` | User who approved | inventory_count_sessions |
| `reviewed_by` | User who reviewed | inventory_returns |

### 23.2 Referential Integrity

All FK references point to `users(auth_user_id)` (auth.users.id), not `users(id)` (public.users.id).

---

## 24. Coding Standards

### 24.1 TypeScript

- Strict mode enabled
- Explicit return types on all functions
- Interfaces over types (for object shapes)
- `Record<string, unknown>` for dynamic object mappers
- No `any` — use `unknown` and narrow
- `as` casts only in row mappers, nowhere else

### 24.2 React

- Functional components only
- Hooks for state and side effects
- No class components
- Props typed with interfaces
- Default export for page components, named export for shared components

### 24.3 Naming Conventions

- **Files:** `kebab-case.ts`, `kebab-case.tsx`
- **Components:** `PascalCase.tsx`
- **Functions/ Variables:** `camelCase`
- **Interfaces:** `PascalCase`
- **Types:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **CSS classes:** Inline `style` props (no separate CSS files)
- **Translation keys:** `module.field_name` (dot notation)

### 24.4 Service Pattern

```typescript
import { supabase } from '../integrations/supabase/client';
import type { Entity } from '../types';

function rowToEntity(row: Record<string, unknown>): Entity {
  return { id: row.id as string, ... };
}

export const entityService = {
  async getAll(): Promise<Entity[]> {
    const { data, error } = await supabase.from('entities').select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(rowToEntity);
  },
};
```

### 24.5 Component Pattern

```typescript
interface Props {
  id: string;
  onSave: () => void;
}

export default function MyComponent({ id, onSave }: Props) {
  // Hooks at top
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  // Queries
  const { data } = useQuery({ ... });
  
  // Mutations
  const mut = useMutation({ ... });
  
  // Computed values
  const filtered = useMemo(() => ..., [data]);
  
  // Handlers
  const handleClick = () => { ... };
  
  // Render
  return ( ... );
}
```

### 24.6 Folder Structure

```
services/    → Business logic
pages/       → Route-level components
components/  → Reusable UI
hooks/       → Custom hooks
context/     → React contexts
types/       → TypeScript definitions
utils/       → Utility functions
locales/     → Translation files
layouts/     → Layout components
integrations/→ Third-party integrations (Supabase client)
lib/         → Config and helpers
```

---

## 25. Future Roadmap

### 25.1 Planned Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Doctor Module | High | Dedicated doctor view with patient list, schedule, clinical tools |
| Assistant Module | Medium | Task list, procedure prep, inventory assistant |
| Mobile App | Medium | React Native or PWA for field access |
| AI Assistant | Low | AI-powered treatment plan suggestions, patient communication |
| Cloud Backup | High | Automated daily backup to cloud storage |
| Barcode/QR | Medium | Barcode scanning for inventory management |
| Offline Mode | Medium | PWA with offline-first data sync |
| SMS Integration | Medium | Twilio integration for appointment reminders |
| Email Integration | Low | Automated email invoicing and statements |
| Insurance Claims | Low | Insurance claim submission and tracking |
| Multi-language | Medium | Additional languages (French, Spanish) |
| Advanced Analytics | Low | ML-based predictions for patient outcomes |
| Payment Gateway | Medium | Online payment processing |
| Lab Integration | Low | Direct integration with dental labs for orders |

### 25.2 Enhancement Areas

- **Procedure Templates** — Reusable treatment plan templates
- **Bulk Operations** — Batch inventory count, batch invoices
- **Advanced Search** — Full-text search across all entities
- **Role Customization** — Admin-configurable role permissions
- **Audit Dashboard** — Visual audit analytics
- **Patient Portal** — Patient self-service portal
- **Inventory Forecasting** — Auto-reorder suggestions based on usage

---

## 26. Glossary

| Term | Definition |
|------|------------|
| **Abutment** | Connector piece that attaches the implant fixture to the prosthetic crown |
| **Branch** | Physical clinic location with its own inventory and staff |
| **ClinicalDashboard** | Full analytics dashboard for Admin/Doctor roles |
| **Count Session** | Periodic inventory counting process with approval workflow |
| **Cross-Branch Request** | Request to transfer inventory from one branch to another |
| **Delivery** | Physical transfer of inventory items (supplier or cross-branch) |
| **ERP** | Enterprise Resource Planning — integrated management system |
| **Financial Record** | Either an invoice or a payment in the financial_records table |
| **Follow-up** | Post-procedure appointment to monitor healing |
| **Healing Status** | OnTrack/Critical/Failure — tracks implant healing progress |
| **Implant** | Dental implant fixture (screw) placed in the jawbone |
| **Inventory Item** | A stockable product (implant, abutment, prosthetic, material) |
| **Invoice** | Billing document for patient treatment |
| **Kit** | Pre-configured set of inventory items used in a procedure |
| **Kit Snapshot** | JSON snapshot of kit items at procedure creation time |
| **Low Stock** | Inventory quantity below minimum threshold |
| **ManagerDashboard** | Operational dashboard for Branch Managers |
| **Outstanding Balance** | Remaining amount due on an invoice |
| **Prosthetic** | Crown, bridge, or other dental restoration |
| **ReceptionDashboard** | Check-in and appointment dashboard |
| **Return** | Process of sending inventory back (supplier, expired, damaged) |
| **RLS** | Row-Level Security — PostgreSQL policy that restricts row access |
| **RPC** | Remote Procedure Call — PostgreSQL function callable via API |
| **SECURITY DEFINER** | PostgreSQL function attribute — runs with owner's permissions |
| **Stock Request** | Request to transfer inventory between branches |
| **Timeline** | Chronological patient activity feed in Patient Profile |

---

## 27. Appendix

### 27.1 Example: Complete Patient Journey (Real Scenario)

```
Patient: Ahmed Mohamed
Branch: Sidi Beshr (Branch A)

Day 1:
- Ahmed calls clinic → Receptionist registers him (global patient record created)
- Appointment scheduled: Day 3, 10:00 AM

Day 3:
- Ahmed arrives → Receptionist checks in (status: confirmed)
- Doctor examines → Treatment plan: Implant #36, size 4.0x10mm
- Kit assigned: "Standard Implant Kit" → Stock check: 5 units available → OK
- Procedure created → Inventory consumed (1 implant, 1 cover screw)
- Invoice created: "Implant #36 Surgery" = $1,500 → Reason: "Initial implant placement"
- Ahmed pays $500 deposit → Reason: "Partial payment for surgery"
- Invoice status: Partial ($500 paid, $1,000 remaining)
- Follow-up scheduled: Day 10

Day 10:
- Doctor checks healing → Health score: 8/10, Pain: 2/10
- Healing status: OnTrack
- Follow-up notes: "Good healing, no complications"

Day 45:
- Ahmed returns for prosthetic phase
- Procedure: "Crown placement #36"
- Prosthetic item consumed: "Zirconia Crown"
- Invoice: "Crown #36" = $800 → Reason: "Prosthetic placement"
- Ahmed pays $800 → Invoice status: Paid
- Follow-up: Day 60

Day 60:
- Final check → Healing: Completed
- Outstanding balance from first invoice: $1,000
- Ahmed pays $1,000 → First invoice now Paid

Data visible from ANY branch:
- Full patient timeline
- All invoices and payments
- All procedures and follow-ups
- All communications
```

### 27.2 Example: Cross-Branch Inventory Transfer

```
Scenario: Branch A (Gleem) needs "Implant 4.0x8mm", Branch B (Sidi Beshr) has stock.

Manager at Gleem:
1. Opens Inventory → Requests tab
2. Clicks "New Request"
3. Selects category: Implant
4. Selects item: "Implant 4.0x8mm"
5. System checks: Sidi Beshr has 15 units → Available
6. Selects source: Sidi Beshr
7. Quantity: 3
8. Notes: "Urgent — patient scheduled tomorrow"
9. Submit → Status: pending

Manager at Sidi Beshr:
1. Sees notification "New stock request from Gleem"
2. Opens Requests tab → Incoming section
3. Reviews: "3 x Implant 4.0x8mm requested by Manager Ahmed"
4. Clicks Approve → Reason: "Sufficient stock in inventory"
5. Delivery auto-created: Status: preparing

Sidi Beshr staff:
1. Opens Deliveries tab
2. Sees delivery: "3 x Implant 4.0x8mm → Gleem"
3. Packs items → Status: picked_up

Courier:
1. Status: in_transit

Gleem receives:
1. Status: arrived
2. Confirms receipt → Status: completed

AUTO-TRANSFER (DB Trigger):
- Sidi Beshr: implant_4.0x8mm quantity: 15 - 3 = 12
- Gleem: implant_4.0x8mm quantity: 0 + 3 = 3

Managers at both branches can see updated inventory.
```

### 27.3 Example: Invoice Lifecycle with Reason Tracking

```
CREATE INVOICE
├── Amount: $2,000
├── Reason Category: Billing Correction
├── Reason: "Initial implant surgery invoice"
└── Audit Log: INSERT, user: "Doctor Ali", reason stored

RECORD PAYMENT ($500)
├── Reason Category: Payment Adjustment
├── Reason: "Patient paid initial deposit"
└── Audit Log: PAYMENT_CHANGE, reason stored
├── Invoice synced: paid=$500, remaining=$1,500, status=Partial

UPDATE INVOICE (total changed to $1,800)
├── Reason Category: Wrong Amount
├── Reason: "Corrected — insurance covers $200"
└── Audit Log: UPDATE, old_data: {total_amount: 2000}, new_data: {total_amount: 1800}
├── Invoice re-synced: paid=$500, remaining=$1,300, status=Partial

RECORD FINAL PAYMENT ($1,300)
├── Reason Category: Billing Correction
├── Reason: "Final payment received"
└── Invoice synced: paid=$1,800, remaining=$0, status=Paid

AUDIT LOG VIEW:
├── 4 entries visible for this invoice
├── Each shows: user, action, timestamp, reason category, reason text
└── Admin can see complete history with all reasons
```

### 27.4 Example: Return Lifecycle

```
DOCTOR discovers damaged implant
1. Opens Returns tab → Clicks "New Return"
2. Item: "Implant 4.0x8mm" (Lot: XYZ-123)
3. Quantity: 2
4. From: branch
5. Reason: damaged
6. Notes: "Packaging compromised during surgery prep"
7. Submit → Status: pending

MANAGER reviews
1. Sees return request
2. Verifies damaged items
3. Clicks Approve
4. Reason Category: Damaged Item
5. Reason: "Items damaged in storage — approved for supplier return"
6. Status: approved
7. Inventory adjusted: -2 units
8. Audit logged with full reason

ALTERNATIVE: REJECT
1. Manager decides items are not damaged
2. Reason: "Items inspected, no damage found"
3. Status: rejected
4. No inventory adjustment
```

### 27.5 Example: Audit Log History

```
┌────────────────────────────────────────────────────────────────┐
│                    AUDIT LOG HISTORY                           │
├──────┬────────┬──────────┬──────────┬──────────────────────────┤
│ Time │ User   │ Action   │ Table    │ Reason                   │
├──────┼────────┼──────────┼──────────┼──────────────────────────┤
│ 9:00 │ Admin  │ INSERT   │ patients │ — (non-sensitive)        │
│ 9:05 │ Doctor │ UPDATE   │ financial│ Billing Correction:      │
│      │        │          │ records  │ "Created invoice"        │
│ 9:10 │ Doctor │ PAYMENT  │ financial│ Payment Adjustment:      │
│      │        │ _CHANGE  │ records  │ "$500 deposit received"  │
│ 9:15 │ Doctor │ UPDATE   │ financial│ Wrong Amount:            │
│      │        │          │ records  │ "Corrected from $2000"   │
│ 9:20 │ Admin  │ INVENTORY│ inventory│ Manual Adjustment:       │
│      │        │ _CHANGE  │ _items   │ "Count correction +2"    │
│ 9:25 │ Mgr    │ UPDATE   │ cross    │ Manager Decision:        │
│      │        │          │ _branch  │ "Approved — stock OK"    │
│      │        │          │_requests │                          │
└──────┴────────┴──────────┴──────────┴──────────────────────────┘
```

### 27.6 Example: Reports Output

```
FINANCIAL REPORT (Last 7 Days)
├── Daily Revenue Chart:
│   Mon: $2,500 | Tue: $3,200 | Wed: $1,800 | Thu: $4,100 |
│   Fri: $2,900 | Sat: $1,200 | Sun: $3,800
├── Monthly Breakdown:
│   Jun '26: $45,200 collected, $12,300 pending
│   May '26: $38,700 collected, $15,100 pending
└── Outstanding Balance: $27,500

INVENTORY REPORT
├── Low Stock Items (3):
│   │ Item                  │ Branch      │ Qty │ Min │
│   │ Implant 3.5x10mm      │ Gleem       │ 2   │ 5   │
│   │ Abutment TI Base      │ Sidi Beshr  │ 1   │ 3   │
│   │ Suture 3-0            │ Gleem       │ 0   │ 10  │
├── Top 5 Used Implants:
│   1. Implant 4.0x8mm — 47 used
│   2. Implant 3.5x10mm — 32 used
│   3. Implant 5.0x10mm — 18 used
└── Estimated Inventory Value: $124,500

CROSS-BRANCH REPORT
├── Pending Requests: 3
├── Approved: 12
├── Rejected: 2
└── Completed: 8
```

### 27.7 Example: Reason Dialog UI

```
┌──────────────────────────────────────────┐
│  Reason for Invoice Creation              │
│                                          │
│  Category *                              │
│  ┌─────────────────────────────────────┐ │
│  │ Financial                           │ │
│  │  ├ Billing Correction              │ │
│  │  ├ Wrong Amount                    │ │
│  │  ├ Duplicate Invoice               │ │
│  │  ├ Payment Adjustment              │ │
│  │  ├ Refund Correction               │ │
│  │  └ Insurance Adjustment            │ │
│  ├ Inventory                           │ │
│  ├ Clinical                            │ │
│  └ Administrative                      │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  Reason *                                │
│  ┌─────────────────────────────────────┐ │
│  │ Corrected invoice amount after      │ │
│  │ verifying payment.                  │ │
│  └─────────────────────────────────────┘ │
│                                          │
│         [Cancel]    [Confirm]           │
└──────────────────────────────────────────┘
```

### 27.8 Key Architectural Decisions

- **`auth.jwt()->>'role'` returns `'authenticated'`** — always use `get_current_user_role()` for custom roles
- **`public.users.id` ≠ `auth.users.id`** — all FKs reference `users(auth_user_id)`
- Cross-branch requests replaced stock_requests UI entirely; stock_requests table kept for legacy data
- Shared aggregation via SQL View (`v_inventory_all`) + RPC (`get_aggregated_inventory`)
- Dashboard role switching uses conditional rendering in single `Dashboard.tsx`
- Communications are Polymorphic (`communications` table)
- Backup is client-side only (Supabase queries → file download)
- Procedure kit items are SNAPSHOT on assignment (`kit_snapshot` JSONB on `procedures`)

---

*End of TrackImplant Enterprise Specification — Version 2.0.0*
