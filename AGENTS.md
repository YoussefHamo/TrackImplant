# AGENTS.md — TrackImplant Phase 2

## Overview
Complete multi-branch dental implant ERP with financial, clinical, inventory, and CRM modules. All Phase 2 features are implemented and the project builds with **zero TypeScript errors**.

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

---

## Key Architecture Decisions
- Reports use in-memory aggregation from Supabase queries (no dedicated RPCs)
- Dashboard role switching uses conditional rendering in single `Dashboard.tsx`
- Communications are Polymorphic (`communications` table)
- AuditLog filters are passed as named params to `auditLogService.getAll()`
- Inventory Count sessions snapshot ALL items on creation; per-item actual qty is editable inline
- Backup is client-side only (Supabase queries → file download)
- Procedure kit items are SNAPSHOT on assignment (`kit_snapshot` JSONB on `procedures`)
- `auth.jwt()->>'role'` returns `'authenticated'` — always use `get_current_user_role()` or `auth.jwt()->'user_metadata'->>'role'`
- All FKs reference `users(auth_user_id)` (auth.users.id)

---

## Build Status
```bash
npm run build  # PASS — 0 errors (tsc + vite)
```
Only informational warnings remain (chunk size, dynamic imports — non-blocking).

---

## Running the App
```bash
npm run dev
```
