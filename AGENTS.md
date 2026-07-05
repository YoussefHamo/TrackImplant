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
| Dashboard | **ClinicalDashboard** (financial analytics, revenue, appointments, procedures stats) | **Global** |
| Appointments | View, update own appointments | **Own branch only** |
| Procedures | Full CRUD, stock consumption on create | **Own branch only** |
| Follow-ups | Full CRUD, healing status tracking | **Own branch only** |
| Inventory | **Read-only** — view all tabs (Implants, Abutments, Prosthetic, Materials, Branches, Count, Deliveries) | **Own branch only** |
| Returns | View own returns, request returns | **Own branch only** |
| Reports | All sections — read-only | **Own branch filtered** |
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
- Financial section: daily revenue (7-day), monthly breakdown, outstanding balance
- Clinical section: procedures by status, healing stats (on-track/critical/failure)
- Inventory section: low stock alerts, top 5 used implants, estimated inventory value
- Cross-branch section: request stats (pending/approved/rejected/completed)
- Patient section: new vs returning patients (30-day window)
- Export: Excel (xlsx) and PDF per section
- Date range + Branch + Doctor filters

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
- **ManagerDashboard**: stock requests widget, low stock alerts, total deliveries, today's appointments
- Role-aware routing: Receptionist → ReceptionDashboard, Manager → ManagerDashboard, Admin/Doctor → ClinicalDashboard
- Removed unused queries/variables for clean build

#### `DashboardLayout.tsx`
- Nav items properly typed with optional `adminOnly` prop
- `Logs` tab visible only for Admin role

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
- **Next**: Verify procedure creation works end-to-end, test ReasonDialog on all sensitive operations, test cross-branch request flow

---

## Running the App
```bash
npm run dev
```
