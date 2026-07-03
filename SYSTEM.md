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
| **Doctor** | Clinical: patients, procedures, follow-ups, implant cases, timeline |
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
| `doctors` | Doctor profiles linked to users |
| `appointments` | Patient appointments (date, status, type) |

### Clinical Tables
| Table | Purpose |
|-------|---------|
| `procedures` | Dental implant procedures (tooth, brand, status, kit_snapshot) |
| `procedure_kits` | Reusable kit templates with items |
| `follow_ups` | Post-op follow-ups (healing_status, pain_level, notes) |
| `prescriptions` | Medication prescriptions |

### Financial Tables
| Table | Purpose |
|-------|---------|
| `financial_records` | Invoices & payments (record_type, amount, status) |
| `payment_plans` | Installment plans for patients |

### Inventory Tables
| Table | Purpose |
|-------|---------|
| `inventory_items` | Unified items (category: implant/abutment/prosthetic/material, branch_id) |
| `implant_inventory` | Legacy implants table (brand, size, quantity) |
| `abutment_inventory` | Legacy abutments table (type, quantity) |
| `inventory_transactions` | Audit trail (add/deduct/issue/return/adjust) |
| `inventory_returns` | Return requests (status: pending/approved/rejected, branch_id) |
| `inventory_count_sessions` | Count sessions (status: draft/in_progress/completed/approved) |
| `inventory_count_items` | Count items (system_quantity, actual_quantity, difference) |
| `stock_requests` | Internal stock requests between branches |
| `cross_branch_requests` | Cross-branch stock transfer requests |
| `cross_branch_deliveries` | Cross-branch delivery tracking (preparing → picked_up → in_transit → arrived → completed) |

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

## Services Layer

| Service | File | Key Methods |
|---------|------|------------|
| `userService` | `userService.ts` | `getAll()`, `getByAuthId()`, `create()`, `updateRole()`, `toggleActive()` |
| `patientService` | `patientService.ts` | `getAll()`, `getById()`, `create()`, `update()`, `search()`, `getStats()` |
| `branchService` | `branchService.ts` | `getAll()`, `getById()`, `create()`, `update()` |
| `appointmentService` | `appointmentService.ts` | `getAll()`, `getByPatient()`, `create()`, `update()`, `delete()` |
| `procedureService` | `procedureService.ts` | `getAll()`, `getByPatient()`, `create()`, `update()`, `delete()`, `getStats()` |
| `procedureKitService` | `procedureKitService.ts` | `getKits()`, `getKit()`, `createKit()`, `updateKit()`, `deleteKit()`, `getKitItems()` |
| `followUpService` | `followUpService.ts` | `getByPatient()`, `getStats()`, `create()`, `update()` |
| `financialRecordService` | `financialRecordService.ts` | `getByPatient()`, `getAnalytics()`, `getDailyRevenue()`, `getMonthlyBreakdown()`, `addPayment()`, `createInvoice()` |
| `implantInventoryService` | `implantInventoryService.ts` | `getImplants()`, `upsertImplant()`, `getAbutments()`, `upsertAbutment()`, `adjustQuantityImplant()`, `adjustQuantityAbutment()`, `recordTransaction()`, `getInventoryItems()`, `getBranchItems()`, `issueStock()`, `returnStock()`, `adjustStock()`, `consumeForProcedure()`, `checkProcedureStock()`, `getStockRequests()`, `createStockRequest()`, `updateStockRequestStatus()` |
| `inventoryCountService` | `inventoryCountService.ts` | `getSessions()`, `getSession()`, `createSession()`, `updateSessionStatus()`, `deleteSession()`, `getItems()`, `upsertItem()`, `deleteItem()` |
| `deliveryService` | `deliveryService.ts` | `getDeliveries()`, `getReturns()`, `createReturn()`, `updateReturnStatus()` |
| `communicationService` | `communicationService.ts` | `getByPatient()`, `create()`, `delete()` |
| `reminderService` | `reminderService.ts` | `getByPatient()`, `create()`, `update()`, `delete()` |
| `auditLogService` | `auditLogService.ts` | `getAll()` (with filters: action, table, role, branchId, dateFrom, dateTo, page, perPage), `log()` |
| `notificationService` | `notificationService.ts` | `getAll()`, `markRead()`, `markAllRead()`, `getUnreadCount()` |
| `searchService` | `searchService.ts` | `search()` (patients, procedures) |

### Key Inventory Flows

**Issue Stock:**
```
issueStock(id, qty) → check available (qty - reserved) → deduct qty → increment used → record 'issue' transaction
```

**Return Stock:**
```
returnStock(id, qty) → add qty back → decrement used → record 'return' transaction
```

**Adjust Stock:**
```
adjustStock(id, change) → add change to qty → if negative check sufficient → record 'adjust' transaction
```

**Consume for Procedure (auto-consumption):**
```
consumeForProcedure({branchId, brand, size}) → find inventory_item → deduct 1 → increment used → record 'issue' transaction with patient_id + procedure_id
```

**Cross-Branch Delivery Completion (auto-transfer):**
```
trigger on delivery status = 'completed' → deduct from source branch inventory → add to destination branch → record transaction
```

**Count Session Approval (auto-adjust):**
```
trigger on status = 'approved' → for each count_item where actual_quantity ≠ system_quantity → adjust inventory quantity → record 'adjust' transaction
```

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
| Dashboard | `/dashboard` | `ReceptionDashboard` / `ManagerDashboard` / `ClinicalDashboard` | Role-based home |
| Patients | `/dashboard/patients` | `PatientsPage` | CRUD + search patients |
| Patient Profile | `/dashboard/patients/:id` | `PatientProfile` | Full patient view with tabs (Info, Procedures, Timeline, Follow-ups, Payments, Documents, Communications) |
| Implant Cases | `/dashboard/cases` | `ImplantCases` | Procedure tracking with kit dropdown |
| Appointments | `/dashboard/appointments` | `AppointmentsPage` | Calendar + CRUD appointments |
| Payments | `/dashboard/payments` | `PaymentsPage` | Invoice/payment management |
| Follow-ups | `/dashboard/follow-ups` | `FollowUpsPage` | Post-op follow-up tracking |
| Inventory | `/dashboard/inventory` | `Inventory` | Multi-tab: implants, abutments, prosthetic, materials, transactions, requests, branches, deliveries, returns, count |
| Reports | `/dashboard/reports` | `Reports` | Enterprise reports: financial, clinical, inventory, cross-branch, patient stats + export |
| Settings | `/dashboard/settings` | `Settings` | User management, backup/export |
| Audit Logs | `/dashboard/logs` | `AuditLogs` | Filterable audit trail (Admin only) |
| Warehouse | `/dashboard/warehouse` | `ReturnsPage` | Return requests + approve/reject |

### Reports (`Reports.tsx`)
- **Sections**: Financial, Clinical, Inventory, Cross-Branch, Patients
- **Filters**: Date range (from/to), Branch, Doctor
- **Export**: Excel (.xlsx) and PDF per section
- **Financial**: Daily revenue (7-day), monthly breakdown, outstanding balance
- **Clinical**: Procedures by status, healing stats (on-track/critical/failure)
- **Inventory**: Low stock alerts, top 5 used implants, estimated value
- **Cross-Branch**: Pending/approved/rejected/completed requests
- **Patients**: New vs returning (30-day window)

### Inventory Count Workflow
1. Admin/Manager clicks "New Count" → enters session name
2. System snapshots ALL inventory items with current quantities
3. User edits actual quantities per item inline
4. User approves session → `updateSessionStatus(id, 'approved')`
5. Trigger auto-adjusts inventory quantities to match actual counts
6. Status changes to `approved` (items become read-only)

### Returns Workflow
1. User creates return (reason: defective/wrong_item/expired/other)
2. Admin reviews → approves or rejects
3. On approval, inventory quantity is adjusted (returned to stock)
4. Status badges: `pending` (yellow), `approved` (green), `rejected` (red)

### CRM Timeline (PatientProfile)
- Chronological feed merging: communications, procedures, appointments, payments, invoices
- Communication types: note, call, email, sms
- Direction: inbound/outbound
- Icons: 📞 call, ✉️ email, 💬 sms, 📝 note
- Add Communication modal opens from timeline tab

### Audit Logs (`AuditLogs.tsx`)
- Filters: Role, Branch, Date range, Search, Action, Table
- Expandable rows show old/new data diff
- User avatar initials
- Pagination with page navigation

### Backup & Restore (`Settings.tsx` — Backup tab)
- **Export JSON**: Fetches all tables → downloads as `.json`
- **Export Excel**: Multi-sheet `.xlsx` workbook
- **Import JSON**: File upload → upsert into tables

---

## Route Structure

```
/login                    → Login
/register                 → Register
/forgot-password          → ForgotPassword
/update-password          → UpdatePassword
/dashboard                → Dashboard (role-aware)
/dashboard/patients       → PatientsPage
/dashboard/patients/:id   → PatientProfile
/dashboard/cases          → ImplantCases
/dashboard/appointments   → AppointmentsPage
/dashboard/payments       → PaymentsPage
/dashboard/follow-ups     → FollowUpsPage
/dashboard/inventory      → Inventory
/dashboard/reports        → Reports
/dashboard/settings       → Settings
/dashboard/logs           → AuditLogs (Admin only)
/dashboard/warehouse      → ReturnsPage
```

---

## Key Architecture Decisions

1. **Reports**: In-memory aggregation from Supabase queries (no RPCs) — simpler to iterate, acceptable for current scale
2. **Dashboard**: Single `Dashboard.tsx` with conditional rendering based on user role — no extra routes
3. **Communications**: Polymorphic `communications` table (single table for all types)
4. **Audit Filters**: Passed as named params to `auditLogService.getAll()` — `role`, `branchId`, `dateFrom`, `dateTo`
5. **Count Sessions**: Snapshot ALL items on creation; inline editing of `actual_quantity` per item; approval auto-adjusts stock
6. **Backup**: Client-side only — Supabase queries → file download
7. **Procedure Kits**: `kit_snapshot` JSONB on procedures — snapshot on assignment; changing template doesn't affect past procedures
8. **RLS**: All inventory tables scoped by `branch_id`; non-admin users see only their branch
9. **Cross-branch delivery completion**: DB trigger auto-transfers inventory
10. **Notifications**: Server-side DB triggers (`handle_cross_branch_request_notification`, `handle_cross_branch_delivery_notification`, `handle_return_notification`)

---

## Build & Run

```bash
npm run dev      # Development server
npm run build    # TypeScript check + Vite production build (0 errors)
npm run lint     # ESLint
```
