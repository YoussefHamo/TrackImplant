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
| `notificationService` | `notificationService.ts` | `getByUser()`, `getUnreadCount()`, `markRead()`, `markAllRead()`, `create()`, `createForRole()`, `getFiltered()`, `delete()`, `getByCategory()`, `getUnreadByCategory()`, `createWithDetails()` |
| `notificationPreferenceService` | `notificationPreferenceService.ts` | `getAll()`, `getEnabledCategories()`, `upsert()`, `bulkInit()` |
| `timelineEventService` | `timelineEventService.ts` | `write()`, `getByPatient()` |
| `timelineService` | `timelineService.ts` | `getByPatient()` |
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

---

## Phase 3 — ERP Completion

### Services Added

| Service | File | Key Methods |
|---------|------|------------|
| `timelineService` | `timelineService.ts` | `getByPatient()` — aggregates appointments, procedures, financial records, communications, reminders, follow-ups into chronological `TimelineEvent[]` |
| `appointmentAnalyticsService` | `appointmentAnalyticsService.ts` | `getAnalytics()` — average waiting/treatment time, doctor utilization, peak hours/days, cancellation/no-show/completion rates |

### Services Enhanced

| Service | Enhancements |
|---------|-------------|
| `appointmentService` | `getTodayStats()` returns per-status counts |
| `notificationService` | Added `NotificationCategory` type, extended `AppNotification` with `category`/`related_entity_type`/`related_entity_id`, new methods: `getByCategory()`, `getFiltered()`, `delete()`, `getUnreadByCategory()`, `createWithDetails()` |

### Pages/Components Added

| Page | Route | Purpose |
|------|-------|---------|
| NotificationCenter | `/dashboard/notifications` | Complete notification center with category filters, search, pagination, mark read/all read, delete |

### Dashboard Enhancements

#### ClinicalDashboard (Admin)
- **18+ KPI widgets**: Total Revenue, Revenue Today/Month, Revenue Trend chart, Outstanding Payments, Branch/Doctor Performance Ranking, Total/New Patients, Active Implant Cases, Procedures Today, Cross-Branch Requests, Deliveries In Transit, Inventory Value, Low Stock, Notifications, Recent Activity, Upcoming Appointments, Quick Actions
- **Branch Performance**: Ranked by revenue with colored bars
- **Doctor Performance**: Top doctors by procedure count
- **Inventory Overview**: Value estimate + low stock alerts

#### ManagerDashboard
- **Today's Operational Stats**: Procedures Today, Waiting/Checked In/Working/Completed/No-Show counts
- **Branch Financial Overview**: Branch Revenue + Inventory Value
- **Doctor Performance**: Top 5 doctors by procedure count
- **Quick Actions**: New Appointment, View Inventory, Reports, Stock Request
- **Notifications Widget**

#### ReceptionDashboard
- **Patient Status Widget**: Waiting/Checked In/Working/Completed/No-Show color-coded counts
- **Outstanding Payments Card**
- **Today's Follow-ups** list
- **Enhanced Quick Actions**: Quick Patient Registration, Quick Appointment, Find Patient, View Schedule
- **Notifications Widget**

#### DoctorDashboard
- **Monthly Procedures BarChart** (Recharts)
- **Implant Success Rate** with SVG ring/donut visualization
- **Quick Actions**: Schedule Appointment, Record Procedure, View Patients, View Schedule
- **Notifications Widget**
- **Enhanced Today's Procedures** table

### Patient Timeline
- Comprehensive chronological feed via `timelineService.getByPatient(patientId)`
- Sources: Communications, Appointments, Procedures, Financial Records, Reminders, Follow-ups
- Each event has: Icon, User, Date, Time, Description
- Click navigates to related entity (appointments, procedures, payments)
- Sorted newest → oldest

### Schedule Quick Actions (Context Menu)
Extended context menu with 20+ actions:
- **Patient**: Open Patient (new tab)
- **Clinical**: Open Procedure, Open Invoice
- **Communication**: Call Patient, WhatsApp Patient
- **Status**: Check In, Start Working, Complete, Postpone, Cancel
- **Appointment**: Reschedule, Duplicate Appointment, Print Appointment, Assign Doctor
- **Procedures**: Create Procedure
- **Admin**: Delete
- Separators between logical groups
- Keyboard shortcut: `Escape` closes menu

### Calendar Improvements
- **Keyboard shortcuts**: `N`=New, `T`=Today, `1/2/3`=Day/Week/Month, Arrow keys=navigate
- **Zoom**: Zoom in/out from 50% to 200%, adjusts row height
- **Print schedule**: Print button generates formatted table for current view
- **Resize**: True drag-to-resize — mouse drag on bottom edge of appointment block updates `duration_minutes`, `end_time` auto-computed, persists via `appointmentService.update()`
- **Mobile**: Toolbar wraps with `flex-wrap`

### Reports Expansion
- **Schedule Reports tab**: Appointments by Doctor (bar chart), by Status (pie chart), Cancellation Report, No Show Report, Doctor Utilization (progress bars), Peak Hours/Days (bar charts)
- **Enhanced Patient Reports**: New/Returning/Active patients with date range filters
- **Scheduling Analytics**: Average wait time, treatment time, working/idle time

### Notification Center
- Category filter pills with unread counts
- Search + read/unread filter
- Mark All Read button
- Notification cards with type-colored borders, category icons, timeAgo display
- Click-to-navigate on linked entities
- Pagination with page numbers and item range
- Delete individual notifications
- Loading skeletons, empty states, error states

### UI/UX Polish
- **Skeleton components**: `Skeleton`, `CardSkeleton`, `TableSkeleton`, `StatSkeleton` with pulse animation
- **Empty State component**: Reusable with icon/title/description/action button
- Integrated skeletons into Dashboard ClinicalDashboard loading and NotificationCenter
- Consistent dark theme styling throughout

### Database Changes (Migration `20260725000000_phase3_erp_completion.sql`)
- `notifications`: Added `category`, `related_entity_type`, `related_entity_id` columns + indexes
- `notification_preferences`: New table (user_id, category, email, in_app) with RLS — per-user per-category notification toggles, wired to Settings UI and Notification Center filtering
- `patient_timeline_events`: New table (patient_id, event_type, description, user info, branch, related entity, metadata) with RLS + indexes — used as primary timeline event source; events auto-written on create/update/delete of appointments, procedures, financial records, communications
- `appointments`: Added `waiting_time_minutes`, `treatment_time_minutes`, `cancelled_at`, `cancelled_by`, `cancellation_reason`, `checked_in_at`, `started_at`, `completed_at` columns
- Enhanced notification trigger `handle_appointment_notification_v2()` now fires for: INSERT (new), UPDATE to checked_in, cancelled, no_show, completed statuses
- Old `trg_appointment_notification` trigger replaced with v2

---

## Build & Run

```bash
npm run dev      # Development server
npm run build    # TypeScript check + Vite production build (0 errors)
npm run lint     # ESLint
```
