# TrackImplant — System Overview

Multi-branch dental implant ERP system built with React + TypeScript + Supabase. Covers financial, clinical, inventory, and CRM modules with full role-based access control.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Routing | React Router v7 |
| State / Server | TanStack React Query v5 |
| Styling | Tailwind CSS v4 + inline styles |
| Charts | Recharts |
| Export | xlsx (Excel), jsPDF + jspdf-autotable (PDF) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Auth | Supabase Auth (email/password) |
| Language | i18n (English / Arabic) |

---

## Project Structure

```
src/
├── components/          # Reusable UI components
├── context/             # React Context providers (Auth, Language, Theme)
├── hooks/               # Custom hooks
├── integrations/        # Supabase client
├── layouts/             # DashboardLayout (nav, search, notifications)
├── locales/             # en.json, ar.json
├── pages/
│   ├── auth/            # Login, Register, ForgotPassword, UpdatePassword
│   └── dashboard/       # All dashboard pages
├── services/            # API service layer (Supabase queries)
└── types/               # TypeScript interfaces & types
```

---

## Users & Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full access: users, settings, all branches, audit logs, approve returns |
| **Manager** | Branch-level: inventory, stock requests, deliveries, appointments, count sessions |
| **Doctor** | Clinical: patients (view), procedures (own), follow-ups (own), appointments (own), read-only financials. **Blocked from Inventory** at RLS + route level |
| **Receptionist** | Front desk: patients, appointments, payments |
| **Assistant** | Read-mostly: view patients, assist in procedures |

- Role stored in `auth.users.raw_user_meta_data->>'role'`
- Always use `get_current_user_role()` or `auth.jwt()->'user_metadata'->>'role'` (NOT `auth.jwt()->>'role'` which returns `'authenticated'`)

---

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User profiles linked to `auth.users.id` |
| `branches` | Clinic branches (name, address, is_active) |
| `patients` | Patient records (name, phone, gender, dob) |
| `appointments` | Patient appointments (date, status, type, doctor_id) |

### Clinical Tables
| Table | Purpose |
|-------|---------|
| `procedures` | Dental implant procedures (tooth, brand, status, kit_snapshot, branch_id) |
| `procedure_doctors` | Multi-doctor junction (max 3 per procedure, primary/assistant, revenue_percentage) |
| `procedure_kits` | Reusable kit templates with items |
| `follow_ups` | Post-op follow-ups (healing_status, pain_level, notes) |
| `prescriptions` | Medication prescriptions |

### Financial Tables
| Table | Purpose |
|-------|---------|
| `financial_records` | Invoices & payments (record_type, amount, status, **procedure_id** FK to procedures) |
| `payment_plans` | Installment plans for patients |

### Inventory Tables
| Table | Purpose |
|-------|---------|
| `inventory_items` | Unified items (category, branch_id) |
| `implant_inventory` | Legacy implants table (brand, size, quantity) |
| `abutment_inventory` | Legacy abutments table (type, quantity) |
| `inventory_transactions` | Audit trail (add/deduct/issue/return/adjust) |
| `inventory_returns` | Return requests (status, branch_id) |
| `inventory_count_sessions` | Count sessions (status: draft/in_progress/completed/approved) |
| `inventory_count_items` | Count items (system_quantity, actual_quantity, difference) |
| `stock_requests` | Internal stock requests between branches |
| `cross_branch_requests` | Cross-branch stock transfer requests |
| `cross_branch_deliveries` | Cross-branch delivery tracking |

### CRM Tables
| Table | Purpose |
|-------|---------|
| `communications` | Polymorphic CRM entries (type: note/call/email/sms, direction: inbound/outbound) |
| `patient_reminders` | Automated patient reminders |

### Audit & System
| Table | Purpose |
|-------|---------|
| `audit_logs` | Full audit trail (action, table, old/new data, role, branch, ip, user_agent, session_id) |
| `notifications` | System notifications (type, message, link, is_read) |

---

## Multi-Doctor Workflow

- Every implant procedure **must** have at least 1 doctor assigned (up to 3 max).
- Exactly 1 doctor is the **Primary** (marked with a star); others are **Assistant**.
- UI enforces: no save without primary doctor, max 3 doctors.

### procedure_doctors Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `procedure_id` | UUID FK → procedures | On delete cascade |
| `doctor_id` | UUID FK → users(auth_user_id) | On delete cascade |
| `role_in_procedure` | text | `'primary'` or `'assistant'` |
| `display_order` | int | 0 = primary, 1+ = assistants |
| `revenue_percentage` | numeric(5,2) | Equal split: `100 / num\_doctors` |

### Doctor Isolation (RLS)

- **Procedures**: Doctor sees only procedures where `id IN (SELECT procedure_id FROM procedure_doctors WHERE doctor_id = auth.uid())`
- **Appointments**: Doctor sees only appointments where `doctor_id = auth.uid()`
- **Inventory**: Doctor role is blocked from ALL inventory tables via RLS (`get_current_user_role() != 'Doctor'`)
- **Frontend routes**: `/dashboard/inventory` blocks Doctor role via `ProtectedRoute`

---

## Procedure ↔ Invoice Relationship

- **Implant procedures** (where `implant_system IS NOT NULL`) auto-create an invoice via DB trigger `trg_procedure_auto_invoice`.
- The trigger runs **AFTER INSERT** inside PostgreSQL's transaction. If invoice creation fails, the procedure insert is rolled back (atomic).
- The invoice is linked to the procedure via `financial_records.procedure_id`.
- Initial invoice: `total_amount=0`, `status='Pending'`. User fills the amount later.
- Non-implant procedures do NOT auto-generate invoices.

### Procedure Soft Delete
- `procedures.is_deleted` (boolean) + `deleted_at` (timestamptz) — all queries filter `is_deleted = false`
- On delete request:
  1. Check linked invoice: if it has payments (`paid_so_far > 0`) → **BLOCK** with error: "This procedure has financial transactions."
  2. If invoice exists with no payments → mark invoice as `Cancelled`
  3. Set `is_deleted = true, deleted_at = now()` on the procedure
- `financial_records.procedure_id` FK: `ON DELETE SET NULL` (safety fallback only — app never hard-deletes)

---

## Financial Workflow

### Revenue Attribution

When multiple doctors are assigned to a procedure, revenue is **split equally**:
- Total invoice amount / number of doctors = each doctor's attributed revenue
- Calculated at query time via `procedureService.getRevenueByDoctor()`
- Uses `procedure_doctors.revenue_percentage` stored at assignment time

---

## Services Layer

| Service | File | Key Methods |
|---------|------|------------|
| `userService` | `userService.ts` | `getAll()`, `getByAuthId()`, `create()`, `update()`, `resetPassword()` |
| `patientService` | `patientService.ts` | `getAll()`, `getById()`, `create()`, `update()`, `search()`, `getStats()` |
| `branchService` | `branchService.ts` | `getAll()`, `getById()`, `create()`, `update()` |
| `appointmentService` | `appointmentService.ts` | `getAll()`, `getByPatient()`, `create()`, `updateStatus()`, **`getByDoctor()`**, **`getUpcomingByDoctor()`** |
| `procedureService` | `procedureService.ts` | `getAll()`, `getByPatient()`, `getById()`, `create()`, `update()`, `updateStatus()`, `delete()`, `getStats()`, **`getDoctors()`**, **`getDoctorsByProcedureIds()`**, **`assignDoctors()`**, **`getByDoctor()`**, **`getProcedureStatsForDoctor()`**, **`getProceduresByDoctorForPeriod()`**, **`getInvoiceForProcedure()`**, **`getRevenueByDoctor()`** |
| `procedureKitService` | `procedureKitService.ts` | `getKits()`, `getKit()`, `createKit()`, `updateKit()`, `deleteKit()`, `getKitItems()` |
| `followUpService` | `followUpService.ts` | `getByPatient()`, `getStats()`, `create()`, `update()` |
| `financialRecordService` | `financialRecordService.ts` | `getByPatient()`, `getAllInvoices()`, `getInvoiceById()`, `getPaymentsByInvoice()`, `syncInvoice()`, `createInvoice()`, `addPayment()`, `createRefund()`, `updateInvoice()`, `deleteRecord()`, `getAnalytics()`, `getDailyRevenue()`, `getMonthlyBreakdown()`, `getInsuranceRevenue()`, `getCashRevenue()`, **`getByProcedure()`** |
| `implantInventoryService` | `implantInventoryService.ts` | Full CRUD + `consumeForProcedure()`, `checkProcedureStock()`, `recordTransaction()`, `consumeAbutmentForProcedure()` |
| `inventoryCountService` | `inventoryCountService.ts` | Session CRUD + item upsert |
| `deliveryService` | `deliveryService.ts` | `getDeliveries()`, `getReturns()`, `createReturn()`, `updateReturnStatus()` |
| `communicationService` | `communicationService.ts` | `getByPatient()`, `create()`, `delete()` |
| `reminderService` | `reminderService.ts` | `getByPatient()`, `create()`, `update()`, `delete()` |
| `auditLogService` | `auditLogService.ts` | `getAll()` (with role, branchId, dateFrom, dateTo, pagination), `log()` |
| `notificationService` | `notificationService.ts` | `getAll()`, `markRead()`, `markAllRead()`, `getUnreadCount()` |
| `searchService` | `searchService.ts` | `search()` (patients, procedures) |

---

## Pages & Components

### Authentication Pages
| Page | Route | Purpose |
|------|-------|---------|
| Login | `/login` | Email/username + password sign-in |
| Register | `/register` | New account creation |
| ForgotPassword | `/forgot-password` | Password reset email |
| UpdatePassword | `/update-password` | New password form |

### Dashboard Pages (all under `/dashboard`)
| Page | Route | Component | Purpose |
|------|-------|-----------|---------|
| Dashboard | `/dashboard` | `DoctorDashboard` / `ManagerDashboard` / `ReceptionDashboard` / `ClinicalDashboard` | Role-based home |
| Patients | `/dashboard/patients` | `PatientsPage` | CRUD + search patients |
| Patient Profile | `/dashboard/patients/:id` | `PatientProfile` | Full patient view with tabs (Overview, Medical, Procedures, Financial, Appointments, Documents, Timeline) |
| Implant Cases | `/dashboard/cases` | `ImplantCases` | Procedure tracking with multi-doctor wizard, dedicated filters (status, branch, implant, date, doctor) |
| Appointments | `/dashboard/appointments` | `AppointmentsPage` | Calendar + CRUD appointments (doctor-filtered for Doctor role) |
| Payments | `/dashboard/payments` | `PaymentsPage` | Invoice/payment management with procedure-linked invoices |
| Follow-ups | `/dashboard/follow-ups` | `FollowUpsPage` | Post-op follow-up tracking |
| Inventory | `/dashboard/inventory` | `Inventory` | **Blocked for Doctor role**. Multi-tab inventory management |
| Reports | `/dashboard/reports` | `Reports` | Enterprise reports with **Branch Procedures** + **Doctor Performance** sections |
| Settings | `/dashboard/settings` | `Settings` | User management, backup/export (Admin only) |
| Audit Logs | `/dashboard/logs` | `AuditLogs` | Filterable audit trail (Admin only) |
| Warehouse | `/dashboard/warehouse` | `ReturnsPage` | Return requests + approve/reject |

### DoctorDashboard
- **Stats**: Today's Appointments, Upcoming Appointments, Total Procedures, Total Appointments, Follow-ups, Critical Follow-ups, My Patients, My Revenue
- **Lists**: Today's Appointments, Upcoming Appointments, Upcoming Follow-ups, Critical Follow-ups, Today's Procedures
- **Revenue**: Generated / Collected / Pending from doctor's procedures

### Reports (`Reports.tsx`)
- **Sections**: Financial, Clinical, Inventory, Cross-Branch, Patients, **Branch Procedures**, **Doctors**
- **Filters**: Date range (from/to), Branch, Doctor
- **Export**: Excel (.xlsx) and PDF per section
- **Branch Procedures**: Total procedures by branch, procedure status breakdown per branch, common implants per branch
- **Doctor Performance**: Total/Completed/Surgery/Healing/Consultation counts per doctor, **Success Rate**, **Healing Rate**, **Failures**, **Implants Placed**, **Abutments Used**, **Revenue Generated/Collected/Pending** (split equally), **Monthly trend** bar chart
- **Date/Doctor/Branch filters** applied to doctor performance data

### ImplantCases Filters
Dedicated filter bar: Search, Doctor dropdown, Status dropdown, Branch dropdown, Implant System dropdown, Date From, Date To

---

## Route Protection

| Route | Blocked Roles | Mechanism |
|-------|--------------|-----------|
| `/dashboard/inventory` | Doctor | `ProtectedRoute allowedRoles={['Admin','Manager','Receptionist','Assistant']}` |
| `/dashboard/logs` | Non-Admin | `ProtectedRoute allowedRoles={['Admin']}` |
| `/dashboard/settings` | Non-Admin | `ProtectedRoute allowedRoles={['Admin']}` |

Inventory is also blocked at the RLS level: all inventory tables reject SELECT/INSERT/UPDATE where `get_current_user_role() = 'Doctor'`.

---

## Key Architecture Decisions

1. **Reports**: In-memory aggregation from Supabase queries (no RPCs)
2. **Dashboard**: Single `Dashboard.tsx` with conditional rendering based on user role
3. **Communications**: Polymorphic `communications` table
4. **Multi-Doctor**: `procedure_doctors` junction; UI enforces max 3, exactly 1 primary
5. **Revenue Split**: Equal split per doctor stored as `revenue_percentage` on assignment
6. **Invoice Auto-Creation**: DB trigger `trg_procedure_auto_invoice` (atomic with procedure insert)
7. **Doctor Isolation**: RLS on procedures (via `procedure_doctors` subquery) + appointments (via `doctor_id`)
8. **Inventory Block**: RLS check `get_current_user_role() != 'Doctor'` on ALL inventory tables
9. **Procedure-Only Invoices**: Trigger only fires for implant procedures
10. **Consumption**: Implant + abutment deducted from inventory on procedure creation

---

## Build & Run

```bash
npm run dev      # Development server
npm run build    # TypeScript check + Vite production build (0 errors)
npm run lint     # ESLint
```
