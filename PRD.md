# TrackImplant — Product Requirements Document (PRD)

## Overview
TrackImplant is a dental implant clinic management system with role-based access, full clinical workflow (patient → procedure → follow-up), financial tracking, inventory management, and audit logging.

---

## 1. Roles & Permissions

### Roles
| Role | Abilities |
|---|---|
| **Admin** | Full access — all pages, CRUD users, view logs, inventory, reports |
| **Doctor** | Patients (assigned only), procedures, appointments, follow-ups, payments, reports |
| **Receptionist** | Patients, appointments, payments (no reports, no inventory, no logs) |

### Route Protection (`ProtectedRoute.tsx`)
- Routes accept `allowedRoles` prop
- Unauthenticated users → redirect to `/` (login)
- Unauthorized role → redirect to `/dashboard`
- Loading state shows "Verifying access credentials..."

### Key Routes & Access
| Route | Admin | Doctor | Receptionist |
|---|---|---|---|
| `/dashboard` | ✓ | ✓ | ✓ |
| `/dashboard/patients` | ✓ | ✓* | ✓ |
| `/dashboard/cases` | ✓ | ✓* | ✓ |
| `/dashboard/appointments` | ✓ | ✓* | ✓ |
| `/dashboard/follow-ups` | ✓ | ✓* | ✓ |
| `/dashboard/payments` | ✓ | ✓ | ✓ |
| `/dashboard/reports` | ✓ | ✓ | ✗ |
| `/dashboard/inventory` | ✓ | ✗ | ✗ |
| `/dashboard/logs` | ✓ | ✗ | ✗ |
| `/dashboard/settings` | ✓ | ✗ | ✗ |
| `/dashboard/notifications` | ✓ | ✓ | ✓ |

### RLS Policies (Database)
- **users**: Admin sees all; others see own record
- **patients**: Admin/Receptionist see all; Doctors see assigned + created
- **procedures**: Admin/Receptionist see all; Doctors see assigned
- **appointments**: Admin/Receptionist see all; Doctors see theirs
- **financial_records**: Admin/Receptionist see all; Doctors see their patients'
- **follow_ups**: Admin/Receptionist see all; Doctors see their patients'
- **implant_inventory / abutment_inventory**: Admin only

### Navbar Hiding (DashboardLayout.tsx)
- Sidebar items with `adminOnly: true` hidden for non-Admin
- Settings link hidden for non-Admin
- Role badge shown in top bar

---

## 2. Activity Logs (Audit Logs)

### Table: `audit_logs`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | auto-generated |
| user_id | uuid FK → users.id | who performed the action |
| user_name | text | denormalized username |
| action | text | INSERT, UPDATE, DELETE, LOGIN, USER_CREATED, ROLE_CHANGED, INVENTORY_CHANGE, PAYMENT_CHANGE |
| table_name | text | affected table |
| record_id | text | affected record ID |
| old_data | jsonb | previous state (optional) |
| new_data | jsonb | new state (optional) |
| created_at | timestamptz | auto |

### Logging Coverage
All services log via `auditLogService.log()`:
- userService — create (USER_CREATED), update (UPDATE/ROLE_CHANGED)
- patientService — create (INSERT), update (UPDATE)
- appointmentService — create (INSERT), updateStatus (UPDATE)
- procedureService — create (INSERT), update/updateStatus (UPDATE), delete (DELETE)
- followUpService — create (INSERT), update (UPDATE), delete (DELETE)
- financialRecordService — createInvoice (INSERT), addPayment (PAYMENT_CHANGE), updateInvoice (UPDATE), deleteRecord (DELETE)
- implantInventoryService — upsert (INSERT/UPDATE), update (UPDATE), delete (DELETE), adjustStock (INVENTORY_CHANGE)
- patientFileService — upload (INSERT), delete (DELETE), rename/updateCategory (UPDATE)
- AuthContext — signIn (LOGIN)

### UI Page (`/dashboard/logs`)
- Table with columns: User, Action, Table, Record ID, Timestamp
- Expandable rows show old_data / new_data JSON
- Filters: search, action type, table name
- Pagination (25 per page)
- Admin only

---

## 3. Inventory Transactions

### Tables
| Table | Columns |
|---|---|
| `implant_inventory` | id, brand, size, quantity, minimum_stock, created_at, updated_at |
| `abutment_inventory` | id, type, quantity, minimum_stock, created_at, updated_at |
| `inventory_transactions` | id, item_type (implant|abutment), item_id, type (add|deduct), quantity, patient_id?, procedure_id?, notes?, created_at |

### Inventory Page (`/dashboard/inventory`)
- Tabs: Implants / Abutments / Transactions
- **Implants tab**: table (brand, size, qty), add/upsert modal, edit inline, delete with confirm, stock adjustment (+/-)
- **Abutments tab**: table (type, qty), same CRUD + adjustment
- **Transactions tab**: log of all add/deduct operations
- Admin only

### Stock Adjustment (`adjustImplantStock`, `adjustAbutmentStock`)
- Reads current quantity, adds delta (can be negative)
- Validates: new qty >= 0
- Updates row, records transaction, logs audit (INVENTORY_CHANGE)

---

## 4. Appointment System

### Table: `appointments`
| Column | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK → patients |
| doctor_id | uuid FK → auth.users |
| appointment_date | timestamptz |
| status | text: scheduled, confirmed, completed, cancelled, no_show |
| created_at | timestamptz |

### Page (`/dashboard/appointments`)
- Month calendar grid view
- Day/Week/Month view toggle
- Each day shows appointment events (colored by status)
- Quick booking sidebar: patient select + datetime picker
- Cancel button on hover
- All appointments list below calendar

### Status Flow
```
scheduled → confirmed → completed
         ↘ cancelled
         ↘ no_show
```

---

## 5. Financial Module

### Table: `financial_records`
| Column | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK → patients |
| patient_name | text (denormalized) |
| record_type | text: invoice, payment |
| parent_invoice_id | uuid FK → self (for payments) |
| invoice_name | text |
| total_amount | numeric(12,2) |
| amount | numeric(12,2) |
| paid_so_far | numeric(12,2) |
| remaining_amount | numeric(12,2) |
| status | text: Pending, Partial, Paid |
| notes | text |
| created_at | timestamptz |

### Key Logic (`syncInvoice`)
- When a payment is added to an invoice, recalculates:
  - `paid_so_far` = sum of all payments
  - `remaining_amount` = max(0, total_amount - paid_so_far)
  - `status` = Pending (paid=0) | Partial (paid < total) | Paid (paid >= total)

### Pages
- **Payments** (`/dashboard/payments`): Patient financial profile view — list invoices, add payments, CRUD
- **Dashboard** (`/dashboard`): Revenue trend chart (7-day), analytics cards (total revenue, monthly collected, pending)
- **Reports** (`/dashboard/reports`): Monthly breakdown, daily revenue

### Access
- Admin/Doctor/Receptionist can view payments page
- Reports: Admin/Doctor only

---

## 6. Notifications

### Table: `notifications`
| Column | Type |
|---|---|
| id | uuid PK |
| user_id | uuid FK → users |
| title | text |
| message | text |
| type | text: info, warning, critical, success |
| link | text (optional, navigable URL) |
| is_read | boolean, default false |
| created_at | timestamptz |

### Service (`notificationService.ts`)
- `getByUser(userId, limit)` — fetch notifications
- `getUnreadCount(userId)` — count unread
- `markRead(id)` — mark one as read
- `markAllRead(userId)` — mark all as read
- `create({ user_id, title, message, type, link })` — create one
- `createForRole(role, { title, message, type, link })` — notify all users with a role

### UI
- **Navbar bell icon**: links to `/dashboard/notifications`
- **Notifications page** (`/dashboard/notifications`): grouped list with type icons, read/unread state, mark all read button

### Future Enhancements (not yet implemented)
- Trigger notifications on: critical follow-up, implant failure, payment overdue, low inventory stock
- Push/email integration
- Real-time subscription via Supabase Realtime

---

## 7. Procedure Workflow

### Table: `procedures`
| Column | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK → patients |
| procedure_name | text |
| tooth_number | text |
| implant_system | text |
| implant_size | text |
| implant_brand | text |
| procedure_date | date |
| status | text: Consultation, Surgery, Healing, Completed |
| doctor_name | text |
| notes | text |
| bone_condition | text |
| bone_density | text |
| bone_height | numeric(5,1) |
| bone_width | numeric(5,1) |
| pathology | text |
| ct_scan_notes | text |
| chronic_disease | text |
| medication | text |
| implant_decision | text: Immediate, Delayed, Not Possible |
| extraction_needed | boolean |
| abutment_type | text |
| doctor_id | uuid FK → users |
| created_at | timestamptz |

### Table: `follow_ups`
| Column | Type |
|---|---|
| id | uuid PK |
| patient_id | uuid FK → patients |
| procedure_id | uuid FK → procedures |
| health_score | integer (0–100) |
| pain_level | integer (0–10) |
| healing_status | text: OnTrack, Healing, Critical, Failure, Completed |
| notes | text |
| created_at | timestamptz |

### Workflow
```
Consultation → Surgery → Healing → Completed
                              ↘ Critical → (monitor)
                              ↘ Failure → Consultation (reset)
```

### Pages
- **ImplantCases** (`/dashboard/cases`): Table with status badges, search, edit/delete, create procedure form (modal)
- **Follow-ups** (`/dashboard/follow-ups`): Summary cards (total, avg health, critical, failure), table with health score circle, pain meter, healing badge, CRUD modal
- **PatientProfile** (`/dashboard/patients/:id/profile`): Patient detail with procedures tab, follow-ups tab, files tab

### Auto-reset on Failure
- When a follow-up records `healing_status = 'Failure'`, the related procedure is automatically reset to `Consultation`

---

## 8. File Management Improvements

### Tables
| Table | Columns |
|---|---|
| `patient_files` | id, patient_id, file_name, file_type, file_size, category, storage_path, public_url, uploaded_by, created_at |

### Storage Buckets
| Bucket | Max Size | Allowed Types | Path Pattern |
|---|---|---|---|
| `patient-profiles` | 5MB | JPEG, PNG, WebP | `profiles/{patientId}/profile.{ext}` |
| `patient-documents` | 20MB | JPEG, PNG, WebP, PDF, DOC, DOCX | `documents/{patientId}/{category}/{timestamp}_{file}` |

### Service (`patientFileService.ts`)
- `upload(patientId, file, category, userId?)` — upload to storage + DB insert; rollback on failure
- `delete(docId, storagePath)` — remove from storage + DB
- `rename(docId, newName)` — update file_name
- `updateCategory(docId, category)` — update category
- `getByPatient(patientId)` — list all files for a patient

### UI (PatientProfile > Files tab)
- File list with: name, type, size, category, date
- Upload button (dropdown with category selection)
- Delete with storage cleanup
- Inline rename + category edit

### Categories
X-Ray, CBCT, Photo, Lab, Prescription, Referral, Insurance, Other

---

## 9. Settings Module

### Table: `users`
| Column | Type |
|---|---|
| id | uuid PK |
| auth_user_id | uuid FK → auth.users (unique) |
| username | text unique |
| full_name | text |
| email | text (nullable, informational) |
| role | text: Admin, Doctor, Receptionist |
| is_active | boolean, default true |
| created_at | timestamptz |

### Page (`/dashboard/settings`)
- **User list table**: username, full_name, email (editable), role badge, active toggle
- **Create user modal**: username, full_name, email, password, role
  - Calls `signUp()` with real email → `upsert` into public.users → audit log (USER_CREATED)
- **Edit user modal**: full_name, email, role
  - If role changes → audit log (ROLE_CHANGED)
- **Password reset**: shows `{username}@trackimplant.local` as auth hint
- **Search/filter** by name, email, role
- Admin only

### Trigger: `handle_new_user()`
- On `auth.users` INSERT → creates corresponding `public.users` row
- Falls back: username from `raw_user_meta_data` or `split_part(email, '@', 1)`
- UPSERT on conflict (idempotent)

---

## 10. CRM (Patient Relationship Management)

### Features (Current)
- **Patient search** in navbar (by name, phone, ID) with dropdown results
- **Global search** via `/dashboard/patients` page
- **Add Patient** modal from navbar button
- **Patient Profile** (`/dashboard/patients/:id/profile`):
  - Personal info: name, phone, email, DOB, gender
  - Medical history: chronic disease, medication, allergies, smoking status
  - Procedures: list per patient
  - Follow-ups: per patient with timeline
  - Files: document upload/view/delete
  - Profile photo upload
- **Follow-up tracking**: health scores over time, implant healing monitoring

### Planned Enhancements (database schema ready, UI not built)
- `assigned_doctor_id` on patients (already in schema for RLS)
- Patient communication log (call/email/message history)
- Appointment reminders (SMS/email via Resend)
- Treatment plan tracking (multi-stage procedures)
- Patient referral tracking

### `patients` Table (Full)
| Column | Type |
|---|---|
| id | uuid PK |
| full_name | text |
| phone | text |
| email | text? |
| gender | text? |
| date_of_birth | date? |
| address | text? |
| notes | text? |
| emergency_contact_name | text? |
| emergency_contact_phone | text? |
| profile_image_url | text? |
| medical_history | text? |
| chronic_disease | text? |
| medication | text? |
| allergies | text? |
| smoking_status | text? |
| assigned_doctor_id | uuid FK → users? |
| created_by | uuid FK → auth.users? |
| created_at | timestamptz |

---

## Database Tables Summary

| # | Table | Purpose |
|---|---|---|
| 1 | `users` | User profiles (mirrors auth.users) |
| 2 | `patients` | Patient clinical profiles |
| 3 | `appointments` | Appointment calendar |
| 4 | `financial_records` | Invoices & payments (single table) |
| 5 | `procedures` | Implant surgical workflow |
| 6 | `follow_ups` | Post-surgery healing tracking |
| 7 | `patient_files` | File/document metadata |
| 8 | `implant_inventory` | Implant stock (brand + size) |
| 9 | `abutment_inventory` | Abutment stock (type) |
| 10 | `inventory_transactions` | Stock change log |
| 11 | `audit_logs` | Activity audit trail |
| 12 | `notifications` | In-app notifications |

## RLS Policy Summary
See `src/lib/schema.sql` lines 253–455 for complete RLS definitions.

## API / Services Summary
All services in `src/services/`:

| Service | Key Functions |
|---|---|
| `userService` | create, update, getAll, getByUsername, resetPassword |
| `patientService` | create, update, getAll, search, getStats, uploadProfileImage |
| `appointmentService` | create, updateStatus, getAll |
| `procedureService` | create, update, updateStatus, delete, getStats |
| `followUpService` | create, update, delete, getCritical, getStats |
| `financialRecordService` | createInvoice, addPayment, updateInvoice, deleteRecord, syncInvoice, getAnalytics |
| `implantInventoryService` | get/upsert/update/delete Implant & Abutment, adjustStock, recordTransaction |
| `patientFileService` | upload, delete, rename, updateCategory |
| `auditLogService` | getAll, log |
| `notificationService` | getByUser, markRead, markAllRead, create, createForRole |
| `searchService` | searchAll (patients + procedures) |
| `errorService` | log, formatMessage |

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: TanStack React Query
- **Auth**: Supabase Auth (email/password)
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Routing**: React Router v6
- **Notifications**: Sonner (toast)

## File Tree (src/)
```
src/
├── App.tsx
├── main.tsx
├── index.css
├── components/
│   ├── AddPatientModal.tsx
│   └── ProtectedRoute.tsx
├── context/
│   └── AuthContext.tsx
├── hooks/
│   └── useDebounce.ts
├── integrations/
│   └── supabase/
│       └── client.ts
├── layouts/
│   └── DashboardLayout.tsx
├── lib/
│   ├── schema.sql
│   └── storage.ts
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Patients.tsx
│   ├── ImplantCases.tsx
│   ├── Inventory.tsx
│   ├── auth/
│   │   ├── Register.tsx
│   │   ├── ForgotPassword.tsx
│   │   └── UpdatePassword.tsx
│   └── dashboard/
│       ├── Appointments.tsx
│       ├── AuditLogs.tsx
│       ├── FollowUps.tsx
│       ├── Notifications.tsx
│       ├── PatientProfile.tsx
│       ├── Payments.tsx
│       ├── Reports.tsx
│       └── Settings.tsx
├── services/
│   ├── appointmentService.ts
│   ├── auditLogService.ts
│   ├── errorService.ts
│   ├── financialRecordService.ts
│   ├── followUpService.ts
│   ├── implantInventoryService.ts
│   ├── notificationService.ts
│   ├── patientFileService.ts
│   ├── patientService.ts
│   ├── procedureService.ts
│   ├── searchService.ts
│   └── userService.ts
└── types/
    ├── database.types.ts
    └── index.ts
```
