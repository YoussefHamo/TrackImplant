# AGENTS.md — TrackImplant Phase 2

## Overview
Complete multi-branch dental implant ERP with financial, clinical, inventory, and CRM modules. All Phase 2 features are implemented and the project builds with **zero TypeScript errors**.

---

## Authorization Architecture

### Role-Based Permissions (Full Detail)

#### 👑 Admin
| Area | Access | Scope |
|------|--------|-------|
| Patients | Full CRUD, search, view all | **Global** — all branches |
| Patient Financial Records | Full CRUD, view all invoices/payments/refunds | **Global** — all branches |
| Patient Profile | Full access — timeline, financial, documents, communications, procedures | **Global** |
| Dashboard | ClinicalDashboard (full analytics, revenue, appointments, procedures) | **Global** |
| Appointments | Full CRUD, view all | **Global** |
| Procedures | Full CRUD, view all, stock consumption on create | **Global** |
| Follow-ups | Full CRUD, view all | **Global** |
| Inventory | Full CRUD — all tabs (Implants, Abutments, Prosthetic, Materials, Branches, Count, Deliveries, Returns, Requests, Transactions) | **All branches** |
| Inventory Count | Create, edit, approve, delete sessions | **All branches** |
| Stock Requests | View all, create, approve, reject | **Cross-branch** |
| Deliveries | Full CRUD, status workflow (preparing → picked_up → in_transit → arrived → completed) | **All branches** |
| Returns | Full CRUD, approve/reject returns | **All branches** |
| Inventory Transactions | View all transactions history | **All branches** |
| Reports | All sections (Financial, Clinical, Inventory, Cross-Branch, Patient) + Export XLSX/PDF | **Global** |
| Audit Logs | View all, filter by role/branch/date | **Global** |
| Settings | Full — Backup (Export JSON/Excel, Import JSON), all config | **Global** |
| Users/Branches | Full management | **Global** |
| Communications | Full CRUD, view all | **Global** |

---

#### 🏢 Manager
| Area | Access | Scope |
|------|--------|-------|
| Patients | View, search, create, update | **Global** — all branches |
| Patient Financial Records | View all, update invoices | **Global** — all branches |
| Patient Profile | Full view — timeline, financial, documents, communications, procedures | **Global** |
| Dashboard | **ManagerDashboard** (stock requests widget, low stock alerts, deliveries, today's appointments) | **Own branch only** |
| Appointments | View, create, update — own branch patients | **Own branch only** |
| Procedures | View, create, update — own branch | **Own branch only** |
| Follow-ups | View, create, update — own branch | **Own branch only** |
| Inventory | Full CRUD — all tabs | **Own branch only** |
| Inventory Count | Create, edit, approve sessions | **Own branch only** |
| Stock Requests | Create (source: other branches, destination: own branch), approve/reject incoming | **Cross-branch** |
| Deliveries | View deliveries to/from own branch, update status | **Own branch + cross-branch** |
| Returns | Create returns, view own | **Own branch only** |
| Inventory Transactions | View own branch transactions | **Own branch only** |
| Reports | All sections — date/branch/doctor filters | **Own branch filtered** |
| Communications | View/create for own branch patients | **Own branch only** |
| Settings | Limited — no Backup import/export | **Own branch only** |

---

#### 🩺 Doctor
| Area | Access | Scope |
|------|--------|-------|
| Patients | View, search, update | **Global** — all branches |
| Patient Financial Records | View only | **Global** — all branches |
| Patient Profile | Full view, add communications, add invoices | **Global** |
| Dashboard | **DoctorDashboard** (own stats: appointments, procedures, revenue, follow-ups, patients) | **Own data only** |
| Appointments | View, update own appointments; RLS isolates to `doctor_id = auth.uid()` | **Own only** |
| Procedures | Full CRUD, stock consumption on create; RLS isolates via `procedure_doctors` subquery | **Own only (where assigned via procedure_doctors)** |
| Follow-ups | Full CRUD, healing status tracking | **Own branch only** |
| Inventory | **BLOCKED** — no access at RLS or route level | **None** |
| Returns | View own returns, request returns | **Own branch only** |
| Reports | All sections — read-only, doctor-filtered | **Own branch filtered** |
| Communications | View/create for own patients | **Own branch only** |
| Settings | None | — |

---

#### 🖥️ Receptionist
| Area | Access | Scope |
|------|--------|-------|
| Patients | View, search, create, update | **Global** — all branches |
| Patient Financial Records | View only | **Global** — all branches |
| Patient Profile | Full view — timeline, financial, procedures, documents | **Global** |
| Dashboard | **ReceptionDashboard** (today's appointments, patient check-ins, quick actions) | **Own branch only** |
| Appointments | Full CRUD | **Own branch only** |
| Procedures | Create, view | **Own branch only** |
| Follow-ups | Create, view | **Own branch only** |
| Inventory | **Read-only** — view stock levels | **Own branch only** |
| Reports | View — limited sections | **Own branch filtered** |
| Communications | Create for own branch patients | **Own branch only** |
| Settings | None | — |

---

#### 🛠️ Assistant
| Area | Access | Scope |
|------|--------|-------|
| Patients | View, search | **Global** — all branches |
| Patient Financial Records | None | — |
| Patient Profile | Read-only | **Global** |
| Dashboard | None | — |
| Appointments | View only | **Own branch only** |
| Procedures | View, update (stock consumption only) | **Own branch only** |
| Follow-ups | Create, view | **Own branch only** |
| Inventory | **Read-only** | **Own branch only** |
| Communications | Create for own branch patients | **Own branch only** |
| Settings | None | — |

---

### Summary: Global vs Branch-Scoped

**Global (all roles see everything)**
- Patients — identity, search, profile
- Patient financial records — invoices, payments, refunds, balances
- Each financial record displays its originating branch name and branch ID

**Branch-scoped (manager's assigned branch only)**
- Dashboard (ManagerDashboard)
- Inventory (all tabs)
- Stock Requests
- Deliveries
- Inventory Transactions
- Inventory Count
- Low Stock Alerts
- Branch Reports
- Branch Analytics
- Appointments
- Procedures
- Follow-ups
- Communications

### RLS Policies
- `patients`: SELECT/UPDATE for Admin, Manager, Doctor, Receptionist (no branch filter)
- `financial_records`: SELECT for Admin, Manager, Doctor, Receptionist; UPDATE for Admin, Manager (no branch filter)
- All other tables: branch-isolated via `get_current_user_role()` function

### Service Layer
- `patientService.getAll/search/getStats()` — no branchId param (global)
- `financialRecordService.getAllInvoices()` — no branchId param (global)
- `financialRecordService.getAnalytics/getDailyRevenue/getMonthlyBreakdown()` — keep optional branchId (for branch-scoped use in dashboard/reports)
- `financialRecordService.getByPatient()` — joins `branches` table to populate `branch_name`

### Frontend
- `Patients.tsx` — no branchId filter, uses `patientService.getAll()`
- `Payments.tsx` — shows branch name column in invoice table
- `PatientProfile.tsx` — shows branch badge on each invoice card
- `Dashboard.tsx` — ManagerDashboard: operational only (no financial analytics); ClinicalDashboard/ReceptionDashboard: global

---

## What Was Done

### Phase 2 — Database
- **Migration** `20260629000000_phase2_enterprise.sql`:
  - `procedure_kits` table with kit_items (JSON snapshot on procedure assignment)
  - `inventory_returns` extended: added `status`, `reviewed_by`, `branch_id`, `reason` CHECK constraint
  - `inventory_count_sessions` + `inventory_count_items` tables
  - `communications` polymorphic table (type, direction, content)
  - `patient_reminders` table
  - `audit_logs` extended: `role`, `branch_id`, `ip_address`, `user_agent`, `os`, `session_id`

### Phase 2 — Services
- `procedureKitService.ts` — CRUD for kits + kit items
- `inventoryCountService.ts` — sessions + items with upsert
- `communicationService.ts` — CRM communications CRUD
- `reminderService.ts` — patient reminders CRUD
- Updated `deliveryService.ts` — `updateReturnStatus()` with status/reviewed_by/reviewed_at
- Updated `auditLogService.ts` — `getAll()` now accepts `role`, `branchId`, `dateFrom`, `dateTo` filters

### Phase 2 — Pages/Components

#### `Reports.tsx`
- **Financial section**: daily revenue (7-day), monthly breakdown, outstanding balance
- **Clinical section**: procedures by status, healing stats (on-track/critical/failure)
- **Inventory section**: low stock alerts, top 5 used implants, estimated inventory value
- **Cross-branch section**: request stats (pending/approved/rejected/completed)
- **Patient section**: new vs returning patients (30-day window)
- **Branch Procedures section**: total procedures by branch, status breakdown, common implants per branch
- **Doctors section**: per-doctor analytics — total/completed/surgery/healing/consultation counts, success rate, healing rate, failures, implants placed, abutments used, revenue generated/collected/pending (split equally), monthly trend chart
- **Export**: Excel (xlsx) and PDF per section
- **Filters**: Date range + Branch + Doctor + Doctor Performance filters

#### `Inventory.tsx` — Count Tab
- Sessions list table: name (from notes), branch, status badge, created date, actions
- Create session modal (name + branch)
- Expandable items grid per session with:
  - Item name, expected (system) qty, editable actual qty input, diff, update button
- Approve session (changes status to 'approved')
- Delete session
- Fixed count item field names: `system_quantity` / `actual_quantity` (not `expected_qty` / `actual_qty`)
- Fixed service calls: `updateSessionStatus(id, 'approved')` instead of `approveSession()`

#### `ReturnsPage.tsx`
- Status column with colored badges (pending/approved/rejected)
- Approve/reject buttons for Admin users
- Location selector modal (warehouse/branch/patient)
- Filtered by `requested_by` for non-admin

#### `PatientProfile.tsx` — Timeline Tab
- Chronological activity feed: communications, procedures, appointments, payments, invoices
- Emoji icons per type (📞 ✉️ 💬 📝)
- Add Communication modal with type (note/call/email/sms) and direction (inbound/outbound)
- Invalidate queries on mutation success

#### `Settings.tsx` — Backup Tab
- Export JSON: fetches all tables, downloads as JSON file
- Export Excel: multi-sheet XLSX workbook
- Import JSON: file upload → upsert into respective tables

#### `AuditLogs.tsx`
- Role filter dropdown (Admin/Manager/Doctor/Receptionist/Assistant)
- Branch filter dropdown (dynamically loaded)
- Date range filter (from/to date inputs)
- User avatar initials in log entries
- Expandable detail view with old/new data diff
- Pagination with page navigation
- Fixed filter param names: `branchId` (not `branch_id`), `dateFrom`/`dateTo`

#### `Dashboard.tsx`
- **DoctorDashboard**: today's appointments, upcoming appointments, upcoming/critical follow-ups, today's procedures, procedure status summary, my patients, revenue (generated/collected/pending)
- **ManagerDashboard**: stock requests widget, low stock alerts, total deliveries, today's appointments
- **ReceptionDashboard**: today's appointments, patient check-ins, quick actions
- **ClinicalDashboard** (Admin): full analytics, revenue, appointments, procedures
- Role-aware routing: Doctor → DoctorDashboard, Receptionist → ReceptionDashboard, Manager → ManagerDashboard, Admin → ClinicalDashboard
- Removed unused queries/variables for clean build

#### `DashboardLayout.tsx`
- Nav items properly typed with optional `adminOnly` prop
- `Logs` tab visible only for Admin role

### Phase 2 — Doctor Workflow

#### Database (Migration `20260710000000_doctor_workflow.sql` + `20260711000000_doctor_workflow_phase2.sql`)
- `procedure_doctors` junction table (procedure_id, doctor_id, role_in_procedure, display_order, revenue_percentage)
- `revenue_percentage` column (equal split: 100 / num_doctors)
- `procedure_id` FK on `financial_records` (nullable, only for implant procedures)
- Auto-invoice trigger `trg_procedure_auto_invoice` (implant procedures only, atomic with procedure insert)
- RLS: Doctor sees only own procedures (via `procedure_doctors` subquery) + own appointments (via `doctor_id`)
- RLS: Doctor **blocked** from ALL inventory tables (`get_current_user_role() != 'Doctor'`)
- Procedure notification trigger `trg_procedure_notification`

#### Services
- `procedureService.assignDoctors()` — saves multi-doctor assignments with equal revenue_percentage
- `procedureService.getDoctors()` / `getDoctorsByProcedureIds()` — fetch procedure doctors
- `procedureService.getByDoctor()` / `getProcedureStatsForDoctor()` / `getProceduresByDoctorForPeriod()` — doctor-isolated queries
- `procedureService.getInvoiceForProcedure()` — fetch linked invoice
- `procedureService.getRevenueByDoctor()` — revenue split equally, with date range filter
- `financialRecordService.getByProcedure()` — fetch invoice by procedure_id
- `appointmentService.getByDoctor()` / `getUpcomingByDoctor()` — doctor-isolated queries

#### UI
- **ImplantCases.tsx**: Searchable multi-doctor dropdown (max 3, primary/assistant), validation (requires at least 1 doctor + primary), dedicated filters (Doctor, Branch, Status, Implant System, Date Range)
- **PatientProfile.tsx**: Doctor badges with primary star on each procedure card
- **Payments.tsx**: "View Procedure" button for procedure-linked invoices
- **Appointments.tsx**: Doctor sees only own appointments
- **Dashboard.tsx**: New DoctorDashboard with appointments, follow-ups, procedures, revenue, patients
- **Reports.tsx**: New "Branch Procedures" + "Doctors" tabs with full analytics (revenue, success rate, healing rate, implants, abutments, export)
- **App.tsx**: Inventory route blocks Doctor via `ProtectedRoute`
- **Inventory.tsx**: Doctor cannot access at all

#### Key Decisions
- Revenue splits equally among all assigned doctors (Option B)
- Primary doctor's name stored on `procedures.doctor_name` for backward compatibility
- Auto-invoice created via DB trigger (not app code) — ensures atomicity
- Doctor isolated via RLS + UI filtering (two layers)
- Procedure search filters: doctor, branch, status, date range, implant system

### Build Fixes (TypeScript Errors Resolved)

| File | Issues Fixed |
|------|-------------|
| `implantInventoryService.ts` | Added missing `operation_type: 'adjust'` to 2 `recordTransaction` calls; removed duplicate `issueStock` method body (~20 stray lines after `consumeForProcedure`) |
| `Reports.tsx` | Removed duplicate `fetchReportData` function body (~100 lines); merged duplicate `style` attrs; replaced undefined `Filter` icon; removed unused `user`, `dateFrom`, `dateTo`, `totalRevenue`, `exportCSV` |
| `Inventory.tsx` | Fixed count item field names; fixed `approveSession` → `updateSessionStatus`; removed `session_name` from `createSession` call; removed 6 unused imports + `categoryHeaders` + `countFormItems` + `refR` + `ArrowLeftRight`; fixed `prostheticLabels`/`materialLabels` type indexing with `as keyof typeof` |
| `Inventory.tsx` (line 1267) | Fixed `s.status === 'pending'` (was unreachable since `CountSessionStatus` has no `'pending'`) → `s.status !== 'approved'` |
| `AuthContext.tsx` | Added `as` cast for `userRecord` from `maybeSingle()` (was typed as `{}`) |
| `AuditLogs.tsx` | Fixed `branch_id` → `branchId`, `date_from` → `dateFrom` to match service interface |
| `PatientProfile.tsx` | Fixed `payment_method` type cast to `PaymentMethod`; removed unused `useEffect`, `printInvoice`, `printRef`, `idx`; added `|| ''` fallback for `c.content` |
| `Dashboard.tsx` | Removed unused `branches`, `stockRequests`, `branchInventory`, `pendingRequests`, `lowStockItems` queries from ReceptionDashboard; removed unused `t`/`analytics` from ManagerDashboard |
| `DashboardLayout.tsx` | Added explicit type for `allNavItems` with `adminOnly?: boolean`; removed unused `useCallback`, `AppNotification`, `X`, `dir` |
| `Settings.tsx` | Removed unused `Building2`, `theme` |
| `branchService.ts` | Removed unused `auditLogService`, `getCurrentUserInfo` imports |
| `deliveryService.ts` | Removed unused `ReturnStatus` type; removed unused `userProfile` query |
| `LanguageContext.tsx` | Removed unused `NestedKeyOf`, `TranslationKey` types |
| `LanguageContext.tsx` (round 2) | Fixed `t` function type signature — now accepts `string | Record` as second arg; implementation uses string as default fallback |
| `Inventory.tsx` (round 2) | Added `reasonAction` state + `ReasonDialog` import; removed `item` from `setReasonAction()` calls; fixed `addStockMut.mutate()` to pass reason params |
| `implantInventoryService.ts` (round 2) | `adjustStock()` now passes `change_reason`/`reason_category` to `recordTransaction` + audit log |

---

## Mandatory Change Reason

Implemented per the specification. Every sensitive business operation requires a Reason for Change.

### Sensitive Operations (Reason Required)
- Invoice Creation, Update, Cancellation
- Payment Creation, Update
- Procedure Update
- Stock Quantity Adjustment, Transfer Approval/Rejection
- Inventory Count Approval
- Return Approval/Rejection
- Financial Corrections, Manual Balance Adjustments

### Architecture
- **DB Migration** `20260704000000_add_change_reason.sql`: added `change_reason` (TEXT) and `reason_category` (TEXT) columns to `financial_records`, `procedures`, `inventory_transactions`, `audit_logs`, `cross_branch_requests`, `inventory_count_sessions`, `inventory_returns`, `appointments`, `follow_ups`
- **Types**: `ReasonCategory` union type (20 categories in 4 groups: Financial, Inventory, Clinical, Administrative), `ChangeReason` interface
- **Constants**: `REASON_CATEGORIES` in `src/utils/reasonCategories.ts` with grouped categories for dropdown
- **UI Component**: `src/components/ReasonDialog.tsx` — modal with category selector (optgroup) and reason textarea, Cancel/Confirm buttons
- **Service Layer**: `auditLogService.log()` accepts `reason_category` and `change_reason`; `financialRecordService.createInvoice/addPayment/updateInvoice/deleteRecord` all accept `change_reason` and `reason_category` params
- **UI Integration**: Payments.tsx and PatientProfile.tsx show ReasonDialog before creating/updating invoices, recording payments, deleting records
- **Audit Display**: AuditLogs.tsx expanded detail shows reason_category badge and reason text
- **Permanence**: Reason fields are stored in both the record itself and the audit log entry (dual storage for immediate visibility + historical tracking)
- Reports use in-memory aggregation from Supabase queries (no dedicated RPCs)
- Dashboard role switching uses conditional rendering in single `Dashboard.tsx`
- Communications are Polymorphic (`communications` table)
- AuditLog filters are passed as named params to `auditLogService.getAll()`
- Inventory Count sessions snapshot ALL items on creation; per-item actual qty is editable inline
- Backup is client-side only (Supabase queries → file download)
- Procedure kit items are SNAPSHOT on assignment (`kit_snapshot` JSONB on `procedures`)
- `auth.jwt()->>'role'` returns `'authenticated'` — always use `get_current_user_role()` or `auth.jwt()->'user_metadata'->>'role'`
- All FKs reference `users(auth_user_id)` (auth.users.id)
- **Procedure soft delete**: `procedures` has `is_deleted` (boolean) + `deleted_at` (timestamptz). All queries filter `is_deleted = false`. On delete:
  - If linked invoice has payments → BLOCK with error
  - If linked invoice exists with no payments → mark invoice `Cancelled`
  - Then set `is_deleted = true, deleted_at = now()` on the procedure
- `financial_records.procedure_id` FK: `ON DELETE SET NULL` (safety fallback — actual deletes handled by app soft-delete logic)
- `LanguageContext.t()` second argument accepts `string | Record` — string is treated as a default fallback, Record is used for interpolation

---

## Build Status
```bash
npm run build  # PASS — 0 errors (tsc + vite)
```
Only informational warnings remain (chunk size, dynamic imports — non-blocking).

## Current State
- **Build**: 0 TypeScript errors, Vite build succeeds
- **Runtime**: All DB constraints fixed and applied
- **Notification link bug FIXED**: Trigger functions created notification links with `'/inventory'` but the React route is `/dashboard/inventory`. Clicking a notification navigated to `/inventory` (non-existent route) → catch-all redirect to `/` (login page). Fixed via migration `20260706000000_fix_notification_links.sql` which updates all existing notification links + recreates 3 trigger functions (`handle_cross_branch_request_notification`, `handle_cross_branch_delivery_notification`, `handle_return_notification`) to use `/dashboard/inventory`.
---

## Schedule & Calendar Module

### New Database Changes

#### `doctor_schedules` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `doctor_id` | UUID FK → `users(auth_user_id)` | On delete cascade |
| `day_of_week` | int (0-6) | 0=Sunday, 6=Saturday |
| `start_time` | time | Working day start |
| `end_time` | time | Working day end |
| `is_active` | boolean | Default true |
| `branch_id` | UUID FK → `branches` | Nullable |
| `UNIQUE(doctor_id, day_of_week)` | | One schedule per day per doctor |

#### `appointments` extended
- `duration_minutes` (int, default 30) — variable appointment duration
- `end_time` (timestamptz) — computed on create/update
- `color` (text) — status-based color

#### New Appointment Statuses
`'scheduled' | 'checked_in' | 'working' | 'completed' | 'cancelled' | 'no_show' | 'postponed'`

### Status Workflow
```
Reception books → Scheduled
Patient arrives → Checked In → notify doctor
Patient enters room → Working
Procedure finishes → Completed
No-show (auto after 15min past appt time) → No Show
Manual → Postponed / Cancelled
```

### Auto No-Show
- Function `auto_mark_no_show()` runs via trigger — marks `Scheduled` → `No Show` when `now() > appointment_date + 15 min`

### Notifications
- Trigger `trg_appointment_notification`:
  - On INSERT → notify doctor of new appointment
  - On UPDATE to `checked_in` → notify doctor that patient arrived

### Services

#### `appointmentService.ts` (updated)
| Method | Description |
|--------|-------------|
| `getById(id)` | Fetch single appointment with patient/doctor names |
| `getByDateRange(from, to, branchId?)` | Fetch appointments in date range |
| `getByPatient(patientId)` | Fetch patient's appointments |
| `checkOverlap(doctorId, startDate, duration, excludeId?)` | Double-booking detection |
| `update(id, updates)` | Update any fields, auto-compute end_time |
| `getTodayStats(branchId?)` | Today's stats by status |

#### `doctorScheduleService.ts` (new)
| Method | Description |
|--------|-------------|
| `getByDoctor(doctorId)` | Get doctor's weekly schedule |
| `getAll()` | Get all schedules |
| `upsert()` | Create or update schedule entry |
| `delete(id)` | Remove schedule entry |

### Components

#### `SchedulePage.tsx`
- **View Toggle**: Day / Week / Month
- **Navigation**: Previous/Next, Today button
- **Filters**: Doctor dropdown, Branch dropdown, Status dropdown, Search
- **Admin tools**: Settings button to manage doctor schedules
- **Context Menu**: Right-click on appointment for quick actions
- **Status Legend**: Color-coded bar at bottom

#### `MonthView.tsx`
- Month grid with day cells
- Appointment dots per day (max 3 shown, "+N more")
- Today highlighting
- Click day → switches to Day view

#### `WeekView.tsx`
- 7-day columns with doctor sub-columns
- Time rows (00:00 - 23:00)
- Slot click to create appointment
- Appointment blocks in correct time slot

#### `DayView.tsx`
- Single day with doctor columns
- Full 24h timeline
- Slot click to create appointment

#### `BookingDialog.tsx`
- Patient + Doctor + Date + Time + Duration + Notes
- Doctor schedule validation (warning if outside working hours)
- **Double-booking detection**: checks overlapping appointments
- Schedule conflict warning: "Dr. X does not work on this day/time"

#### `DoubleBookingWarning.tsx`
- Shows existing patient name, time, requested time, doctor name
- **Buttons**: Cancel (return to editing) | Continue Anyway (override)
- Remembers user intent after override to avoid re-prompting

#### `DoctorScheduleManager.tsx`
- Doctor selector
- Weekly grid with per-day Add/Edit/Delete
- Time inputs for start/end

#### `AppointmentBlock.tsx`
- Reusable appointment card with status color bar
- Shows time + patient name + doctor name
- Compact mode for Month view

#### `ContextMenu.tsx`
- Right-click menu with actions:
  - Open Patient (new tab)
  - Edit Appointment
  - Check In / Start Working / Complete / Postpone / Cancel
  - Reschedule
  - Delete (Admin only)

### Status Color Coding
| Status | Color |
|--------|-------|
| Scheduled | `#4FD1FF` (Blue) |
| Checked In | `#FF9800` (Orange) |
| Working | `#9C27B0` (Purple) |
| Completed | `#4CAF50` (Green) |
| Postponed | `#FFC107` (Yellow) |
| Cancelled | `#9E9E9E` (Gray) |
| No Show | `#F44336` (Red) |

### Routes
- `/dashboard/schedule` — SchedulePage (all authenticated roles)

### Nav Items
- `Schedule` — added to sidebar with Calendar icon (visible to all roles)
- `Appointments (Legacy)` — kept for backward compatibility with CalendarDays icon

### Build Status
```bash
npm run build  # PASS — 0 errors (tsc + vite)
```

---

## Phase 3 — ERP Completion

### Overview
Phase 3 completes the ERP experience across 8 areas: Dashboard widgets, Patient Timeline, Schedule Quick Actions, Calendar Improvements, Appointment Analytics, Reports Expansion, Notification Center, and UI/UX Polish.

### What Was Done

#### Part 1 — Complete Dashboard for Every Role

**ClinicalDashboard (Admin)** — Enhanced with 15+ new widgets:
- Revenue: Total, Today, This Month, Trend chart (AreaChart), Outstanding Payments, Revenue by Branch
- Performance: Branch Performance Ranking (revenue bars), Doctor Performance Ranking (procedure counts)
- Patients: Total Patients, New Patients, Active Implant Cases
- Operations: Procedures Today, Cross-Branch Requests (pending count), Deliveries In Transit, Inventory Value, Low Stock Items
- Activity: Notifications widget, Upcoming Appointments list
- Quick Actions bar: New Patient, New Appointment, New Procedure, View Reports, View Inventory, View Schedule

**ManagerDashboard** — Enhanced with:
- Today's Operational Stats: Procedures Today, Waiting/Checked In/Working/Completed/No-Show counts (6 compact cards)
- Branch Financial Overview: Branch Revenue + Inventory Value
- Doctor Performance: Top 5 doctors by procedure count
- Quick Actions: New Appointment, View Inventory, Reports, Stock Request
- Notifications Widget with color-coded type dots

**ReceptionDashboard** — Enhanced with:
- Patient Status Widget: Waiting/Checked In/Working/Completed/No-Show color-coded cards
- Outstanding Payments Card with "View Payments" button
- Today's Follow-ups list with health/pain scores
- Enhanced Quick Actions: 2×4 grid
- Notifications Widget

**DoctorDashboard** — Enhanced with:
- Monthly Procedures BarChart (Recharts, grouped by month)
- Implant Success Rate SVG ring/donut chart (completed/total %)
- Quick Actions: Schedule Appointment, Record Procedure, View Patients, View Schedule
- Notifications Widget with unread dot indicator
- Enhanced Today's Procedures table (Patient, Procedure, Status, Tooth, Time)

#### Part 2 — Patient Timeline
- **Services**: `src/services/timelineEventService.ts` (writes/reads from `patient_timeline_events` table) + `src/services/timelineService.ts` (reads from table, falls back to legacy aggregation)
- **Primary source**: `patient_timeline_events` DB table — events written automatically by `appointmentService`, `procedureService`, `financialRecordService`, `communicationService`
- **Fallback**: If table is empty, aggregates from 6 source tables (Communications, Appointments, Procedures, Financial Records, Reminders, Follow-ups)
- Sorted newest → oldest
- Each event: icon, user_name, date, time, branch_name, description
- Click navigates to related entity (appointments page, cases page, payments page)
- Integrated into PatientProfile.tsx Timeline tab

#### Part 3 — Schedule Quick Actions
- **ContextMenu.tsx**: Enhanced with separators, disabled items, Escape key support, ContextMenuItem exported
- **SchedulePage.tsx**: 20+ context menu actions
  - Open Patient (new tab), Open Procedure, Open Invoice
  - Call Patient (tel:), WhatsApp Patient (wa.me)
  - Check In, Start Working, Complete, Postpone, Cancel
  - Reschedule, Duplicate Appointment (clones +24h), Print Appointment (HTML print), Assign Doctor
  - Create Procedure (navigates to cases with patientId)
  - Delete (Admin only)
  - Separators between logical groups

#### Part 4 — Calendar Improvements
- **Keyboard shortcuts**: N=New, T=Today, 1=Day, 2=Week, 3=Month, ArrowLeft/Right=Navigate
- **Zoom**: −/+ buttons, 50%-200%, adjusts row height in WeekView/DayView via zoomLevel prop
- **Print**: Print button generates formatted HTML table for current view+date range
- **Resize**: True drag-to-resize on AppointmentBlock — mouse drag on bottom edge updates `duration_minutes` in real-time, persists via `appointmentService.update()` on release, `end_time` auto-computed
- **Mobile**: Toolbar wraps with flex-wrap

#### Part 5 — Appointment Analytics
- **Service**: `src/services/appointmentAnalyticsService.ts`
- `getAnalytics()` returns: averageWaitingTime, averageTreatmentTime, appointmentDuration stats, doctorUtilization[], peakHours[], peakDays[], cancellationRate, noShowRate, completionRate, workingTime, idleTime
- Used by Reports.tsx Schedule section and can be used by dashboards

### Notification Preferences
- **Service**: `src/services/notificationPreferenceService.ts` — CRUD for `notification_preferences` table
- **Settings integration**: Notification Preferences section in Settings.tsx with per-category toggle (Bell/BellOff icons)
- **Auto-init**: On Settings page mount, ensures every category has a preference row via `bulkInit()`
- **Notification Center**: Respects enabled categories — only shows category pills for user-enabled categories

#### Part 6 — Reports Expansion
- **Schedule Reports tab** added to `Reports.tsx`:
  - Summary cards: Total appointments, cancellation/no-show/completion rates
  - Analytics cards: Avg wait time, treatment time, working/idle time
  - Appointments by Doctor: Horizontal BarChart
  - Appointments by Status: Donut PieChart with status colors
  - Cancellation Report: Count, rate %, list
  - No Show Report: Count, rate %, list
  - Doctor Utilization: Colored progress bars (green/yellow/red thresholds)
  - Peak Hours: BarChart
  - Peak Days: BarChart
- **Enhanced Patient Reports**: Active patients count respects date range filters

#### Part 7 — Notification Center
- **Page**: `src/pages/dashboard/NotificationCenter.tsx` at `/dashboard/notifications`
- Category filter pills with unread counts per category
- Search input + read/unread filter dropdown
- Mark All Read button
- Notification cards: type-colored left border, category icon, title, message, timeAgo, read/unread dot
- Click-to-navigate on linked entities
- Pagination with page numbers, prev/next, item range
- Delete individual notifications
- Loading skeleton, empty state, error state

#### Part 8 — UI/UX Polish
- **Components**: `Skeleton.tsx` (Skeleton, CardSkeleton, TableSkeleton, StatSkeleton), `EmptyState.tsx`
- Dashboard loading: ClinicalDashboard uses StatSkeleton grid + TableSkeleton
- NotificationCenter: Uses TableSkeleton + EmptyState
- All components use the app's dark theme conventions

### Database Changes
- Migration `20260725000000_phase3_erp_completion.sql`:
  - `notifications` enhanced: category, related_entity_type, related_entity_id columns + indexes
  - `notification_preferences` table with per-user per-category settings + RLS
  - `patient_timeline_events` table with metadata JSONB + indexes — used as primary timeline event source; events auto-written on create/update/delete of appointments, procedures, financial records, communications
  - `appointments` extended: waiting/treatment time, cancellation info, timestamps (checked_in_at, started_at, completed_at)
  - Enhanced notification trigger `handle_appointment_notification_v2()` (covers insert, check-in, cancel, no-show, complete)
  - Old `trg_appointment_notification` replaced

### Build Status
```bash
npm run build  # PASS — 0 errors (tsc + vite)
```

---

## Phase 4 — Branch Context & Branch Isolation

### Overview
Every operation belongs to a branch. Admin users select their active branch via a UI selector; non-admin users always operate within their own `branch_id`. The `BranchContext` React context provides `activeBranchId` across the entire app.

### Architecture

#### `src/context/BranchContext.tsx` (new)
- `BranchProvider` wraps the app inside `AuthProvider`
- `useBranch()` hook returns: `activeBranchId`, `setActiveBranchId`, `availableBranches`, `branchLoading`, `isBranchRequired`, `currentBranchName`
- For **Admin** users: `activeBranchId` is stored in `localStorage` and selectable via UI
- For **non-Admin** users: `activeBranchId` is always their `user.branch_id` — set automatically, never changeable

#### `BranchSelector` (in `DashboardLayout.tsx`)
- Inline dropdown component rendered only for Admin users in the header bar
- Shows current branch name; click to open dropdown with all branches
- Changes trigger `setActiveBranchId()` which re-fetches all scoped data via updated query keys

#### DB Migration `20260726000000_branch_context.sql`
- Added `branch_id` columns to: `notifications`, `patient_timeline_events`, `communications`, `patient_reminders`, `follow_ups`
- Created indexes on all new `branch_id` columns
- Added `get_current_user_branch_id()` function
- Updated RLS policies for new columns

### How Branch Context Flows

1. **React Context** (`BranchContext`) → provides `activeBranchId`
2. **React Query Keys** include `activeBranchId` (e.g. `['appointments', activeBranchId]`) — automatic refetch on branch switch
3. **Services** accept optional `branchId` param (already existed in most services)
4. **All pages** import `useBranch()` and pass `activeBranchId` to service calls

### Pages Updated for Branch Context

| Page | Changes |
|------|---------|
| `Dashboard.tsx` — All 4 dashboards | Added `useBranch()`, pass `activeBranchId` to all analytics/procedures/appointments/financial queries |
| `SchedulePage.tsx` | Syncs `filterBranch` from `activeBranchId`, auto-refetches appointments on branch switch |
| `BookingDialog.tsx` | Passes `activeBranchId` as `branch_id` on appointment create |
| `Appointments.tsx` | Filters appointments by `activeBranchId` |
| `ImplantCases.tsx` | Filters procedures by `activeBranchId`, syncs branch filter |
| `Patients.tsx` | **Global (unchanged)** — patients from all branches visible; shows `home_branch_name` in detail panel |
| `PatientProfile.tsx` | Shows `home_branch_name` badge in patient header |
| `Reports.tsx` | Defaults branch filter to `activeBranchId`, syncs on change |
| `AddPatientModal.tsx` | Pre-fills branch from `activeBranchId` for both Admin and non-Admin |

### Patients are Global
- `patients` table queries are **never** filtered by branch
- `patientService.getAll/search/getById` return patients from all branches
- Each patient shows `home_branch_name` (joined from `branches` table)
- Patient creation stores `branch_id` as home branch (for reporting)

### Services Updated
- `communicationService.create()` — accepts `branch_id`, stores it, writes to timeline events
- `reminderService.create()` — accepts `branch_id`, stores it
- `timelineEventService.write()` — already supported `branch_id`, now all callers pass it
- `appointmentService` — timeline events include `branch_id`
- `procedureService` — timeline events include `branch_id`
- `patientService` — queries join `branches` table for `home_branch_name`

### Type Changes
- `Patient` interface: added `home_branch_name: string | undefined`
- `FollowUp` interface: added `branch_id?: string`

### RLS Notes
- Notifications: users see only their own (`user_id = auth.uid()`) — no branch filter needed
- Timeline events: visible globally (patients are global)
- Communications: visible globally (patients are global)
- All other tables: existing RLS already enforces branch isolation via `get_current_user_role()` function

### Build Status
```bash
npm run build  # PASS — 0 errors (tsc + vite)
```

## Running the App
```bash
npm run dev
```
