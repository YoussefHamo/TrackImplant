-- ============================================================
-- TrackImplant – Dental Precision
-- Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. PATIENTS (expanded clinical profile)
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  gender text,
  date_of_birth date,
  profile_image_url text,
  medical_history text,
  chronic_disease text,
  medication text,
  allergies text,
  smoking_status text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table patients enable row level security;
create policy "Authenticated users can read patients"
  on patients for select to authenticated using (true);
create policy "Authenticated users can insert patients"
  on patients for insert to authenticated with check (true);
create policy "Authenticated users can update patients"
  on patients for update to authenticated using (true);

-- 2. APPOINTMENTS
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  doctor_id uuid references auth.users(id),
  appointment_date timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz default now()
);
alter table appointments enable row level security;
create policy "Authenticated users can read appointments"
  on appointments for select to authenticated using (true);
create policy "Authenticated users can manage appointments"
  on appointments for all to authenticated using (true);

-- 3. FINANCIAL RECORDS (single table for invoices & payments)
create table if not exists financial_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  patient_name text not null,
  record_type text not null check (record_type in ('invoice', 'payment')),
  parent_invoice_id uuid references financial_records(id) on delete set null,
  invoice_name text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  paid_so_far numeric(12,2) not null default 0 check (paid_so_far >= 0),
  remaining_amount numeric(12,2) not null default 0 check (remaining_amount >= 0),
  status text not null default 'Pending' check (status in ('Pending', 'Partial', 'Paid')),
  notes text,
  created_at timestamptz default now()
);
alter table financial_records enable row level security;
create policy "Authenticated users can read financial_records"
  on financial_records for select to authenticated using (true);
create policy "Authenticated users can insert financial_records"
  on financial_records for insert to authenticated with check (true);
create policy "Authenticated users can update financial_records"
  on financial_records for update to authenticated using (true);

-- 5. PROCEDURES (full implant clinical workflow)
create table if not exists procedures (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  procedure_name text not null,
  tooth_number text,
  implant_system text,
  implant_size text,
  procedure_date date not null,
  status text not null default 'Consultation',
  doctor_name text,
  notes text,
  -- CT Scan & Clinical Analysis
  bone_condition text,
  bone_density text,
  bone_height numeric(5,1),
  bone_width numeric(5,1),
  pathology text,
  ct_scan_notes text,
  -- Medical History
  chronic_disease text,
  medication text,
  -- Implant Decision
  implant_decision text check (implant_decision in ('Immediate', 'Delayed', 'Not Possible')),
  extraction_needed boolean default false,
  -- Implant Details
  abutment_type text,
  created_at timestamptz default now()
);
alter table procedures enable row level security;
create policy "Authenticated users can read procedures"
  on procedures for select to authenticated using (true);
create policy "Authenticated users can manage procedures"
  on procedures for all to authenticated using (true);

-- 6. FOLLOW_UPS
create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  procedure_id uuid references procedures(id) on delete set null,
  health_score integer check (health_score between 0 and 100),
  pain_level integer check (pain_level between 0 and 10),
  healing_status text check (healing_status in ('OnTrack', 'Healing', 'Critical', 'Failure', 'Completed')),
  notes text,
  created_at timestamptz default now()
);
alter table follow_ups enable row level security;
create policy "Authenticated users can read follow_ups"
  on follow_ups for select to authenticated using (true);
create policy "Authenticated users can manage follow_ups"
  on follow_ups for all to authenticated using (true);

-- 7. PATIENT FILES (Supabase Storage metadata)
-- Stores metadata for all uploaded patient medical documents.
-- Storage bucket: patient-documents
-- Path pattern:   documents/{patientId}/{category}/{timestamp}_{file}
create table if not exists patient_files (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer,
  category text default 'Other',
  storage_path text not null,
  public_url text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table patient_files enable row level security;
create policy "Authenticated users can read patient_files"
  on patient_files for select to authenticated using (true);
create policy "Authenticated users can insert patient_files"
  on patient_files for insert to authenticated with check (true);
create policy "Authenticated users can update patient_files"
  on patient_files for update to authenticated using (true);
create policy "Authenticated users can delete patient_files"
  on patient_files for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════════
-- MIGRATION (run once if patient_documents table already exists)
-- ════════════════════════════════════════════════════════════════
-- do $$
-- begin
--   if exists (select 1 from information_schema.tables where table_name = 'patient_documents') then
--     alter table patient_documents rename to patient_files;
--   end if;
-- end $$;

-- 8. INDEXES
create index if not exists idx_patients_full_name on patients using gin (full_name gin_trgm_ops);
create index if not exists idx_patients_phone on patients(phone);
create index if not exists idx_appointments_date on appointments(appointment_date);
create index if not exists idx_appointments_patient on appointments(patient_id);
create index if not exists idx_financial_patient on financial_records(patient_id);
create index if not exists idx_financial_type on financial_records(record_type);
create index if not exists idx_financial_status on financial_records(status);
create index if not exists idx_financial_parent on financial_records(parent_invoice_id);
create index if not exists idx_financial_created on financial_records(created_at);
create index if not exists idx_procedures_patient on procedures(patient_id);
create index if not exists idx_procedures_status on procedures(status);
create index if not exists idx_follow_ups_patient on follow_ups(patient_id);

create index if not exists idx_files_patient on patient_files(patient_id);
create index if not exists idx_files_category on patient_files(category);

-- Note: for pg_trgm indexes to work, run: create extension if not exists pg_trgm;

-- ============================================================
-- 9. STORAGE ARCHITECTURE
-- Two dedicated buckets with role-based access.
--
-- Bucket: patient-profiles
--   Purpose: Patient profile photos only
--   Access: Public read, Authenticated write/delete
--   Max file size: 5MB (enforced client-side)
--   Allowed types: JPEG, PNG, WebP
--   Path pattern: profiles/{patientId}/profile.{ext}
--   Upsert: Allowed (profile overwrite)
--
-- Bucket: patient-documents
--   Purpose: Medical documents (CBCT, X-Ray, PDFs, scans, lab results)
--   Access: Public read, Authenticated write/delete
--   Max file size: 20MB (enforced client-side)
--   Allowed types: JPEG, PNG, WebP, PDF, DOC, DOCX
--   Path pattern: documents/{patientId}/{category}/{timestamp}_{file}
--   Upsert: Not allowed (prevents accidental overwrite)
-- ============================================================

-- Create storage buckets (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-profiles', 'patient-profiles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-documents', 'patient-documents', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- ============================================================
-- STORAGE POLICIES — patient-profiles
-- ============================================================
create policy "Public can view patient profile images"
  on storage.objects for select
  using (bucket_id = 'patient-profiles');

create policy "Authenticated users can upload patient profile images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'patient-profiles');

create policy "Authenticated users can update patient profile images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'patient-profiles');

create policy "Authenticated users can delete patient profile images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'patient-profiles');

-- ============================================================
-- STORAGE POLICIES — patient-documents
-- ============================================================
create policy "Public can view patient documents"
  on storage.objects for select
  using (bucket_id = 'patient-documents');

create policy "Authenticated users can upload patient documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'patient-documents');

create policy "Authenticated users can update patient documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'patient-documents');

create policy "Authenticated users can delete patient documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'patient-documents');

-- ════════════════════════════════════════════════════════════════
-- 10. USERS TABLE (mirrors auth.users with role & status)
-- ════════════════════════════════════════════════════════════════
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  email text,  -- auto-generated as {username}@trackimplant.local; not used for auth
  role text not null check (role in ('Admin', 'Doctor', 'Receptionist')) default 'Doctor',
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table users enable row level security;

-- Admin sees all; Doctors/Receptionists see only their own record
create policy "Users select"
  on users for select to authenticated
  using (
    id = auth.uid()
    or auth.jwt() ->> 'role' = 'Admin'
  );

-- Only Admins can insert/update/delete users
create policy "Users insert"
  on users for insert to authenticated
  with check (auth.jwt() ->> 'role' = 'Admin');

create policy "Users update"
  on users for update to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

create policy "Users delete"
  on users for delete to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

-- Sync auth.users -> public.users on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (auth_user_id, username, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'User'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'Doctor'),
    true
  )
  on conflict (auth_user_id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- 11. AUDIT LOGS
-- ════════════════════════════════════════════════════════════════
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_name text not null default 'System',
  action text not null check (action in ('INSERT','UPDATE','DELETE','LOGIN','USER_CREATED','ROLE_CHANGED','INVENTORY_CHANGE','PAYMENT_CHANGE')),
  table_name text not null,
  record_id text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);
alter table audit_logs enable row level security;

-- Only Admins can read audit logs
create policy "Audit logs select"
  on audit_logs for select to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

-- Authenticated users can insert audit logs
create policy "Audit logs insert"
  on audit_logs for insert to authenticated
  with check (true);

-- ════════════════════════════════════════════════════════════════
-- 12. NEW COLUMNS FOR EXISTING TABLES
-- ════════════════════════════════════════════════════════════════
-- Add assigned_doctor_id to patients (for doctor-level filtering)
alter table patients add column if not exists assigned_doctor_id uuid references users(id) on delete set null;

-- Add doctor_id to procedures (for doctor-level filtering)
alter table procedures add column if not exists doctor_id uuid references users(id) on delete set null;

-- ════════════════════════════════════════════════════════════════
-- 13. UPDATED RLS POLICIES (role-based access)
-- ════════════════════════════════════════════════════════════════

-- PATIENTS: Admins & Receptionists see all; Doctors see only assigned
drop policy if exists "Authenticated users can read patients" on patients;
create policy "Patients select"
  on patients for select to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or assigned_doctor_id = auth.uid()
    or created_by = auth.uid()
  );

drop policy if exists "Authenticated users can insert patients" on patients;
create policy "Patients insert"
  on patients for insert to authenticated
  with check (true);

drop policy if exists "Authenticated users can update patients" on patients;
create policy "Patients update"
  on patients for update to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or assigned_doctor_id = auth.uid()
    or created_by = auth.uid()
  );

-- PROCEDURES: Admins & Receptionists see all; Doctors see only theirs
drop policy if exists "Authenticated users can read procedures" on procedures;
create policy "Procedures select"
  on procedures for select to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or doctor_id = auth.uid()
  );

drop policy if exists "Authenticated users can manage procedures" on procedures;
create policy "Procedures insert"
  on procedures for insert to authenticated
  with check (true);

create policy "Procedures update"
  on procedures for update to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or doctor_id = auth.uid()
  );

create policy "Procedures delete"
  on procedures for delete to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
  );

-- FOLLOW_UPS: Admins & Receptionists see all; Doctors see only their patients' follow-ups
drop policy if exists "Authenticated users can read follow_ups" on follow_ups;
create policy "FollowUps select"
  on follow_ups for select to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or exists (
      select 1 from procedures
      where procedures.id = follow_ups.procedure_id
      and procedures.doctor_id = auth.uid()
    )
  );

-- APPOINTMENTS: Admins & Receptionists see all; Doctors see only theirs
drop policy if exists "Authenticated users can read appointments" on appointments;
create policy "Appointments select"
  on appointments for select to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or doctor_id = auth.uid()
  );

-- FINANCIAL_RECORDS: Admins & Receptionists see all; Doctors see only their patients' records
drop policy if exists "Authenticated users can read financial_records" on financial_records;
create policy "FinancialRecords select"
  on financial_records for select to authenticated
  using (
    auth.jwt() ->> 'role' = 'Admin'
    or auth.jwt() ->> 'role' = 'Receptionist'
    or exists (
      select 1 from patients
      where patients.id = financial_records.patient_id
      and patients.assigned_doctor_id = auth.uid()
    )
  );

-- INVENTORY: Admin only
drop policy if exists "Authenticated users can read inventory" on implant_inventory;
create policy "ImplantInventory select"
  on implant_inventory for select to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

drop policy if exists "Authenticated users can read abutment inventory" on abutment_inventory;
create policy "AbutmentInventory select"
  on abutment_inventory for select to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

-- ════════════════════════════════════════════════════════════════
-- 14. INDEXES FOR NEW TABLES & COLUMNS
-- ════════════════════════════════════════════════════════════════
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_active on users(is_active);
create index if not exists idx_users_username on users(username);
create index if not exists idx_audit_logs_user on audit_logs(user_id);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_table on audit_logs(table_name);
create index if not exists idx_audit_logs_created on audit_logs(created_at);
create index if not exists idx_patients_assigned_doctor on patients(assigned_doctor_id);
create index if not exists idx_procedures_doctor on procedures(doctor_id);

-- ════════════════════════════════════════════════════════════════
-- 15. NOTIFICATIONS
-- ════════════════════════════════════════════════════════════════
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('info', 'warning', 'critical', 'success')),
  link text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;

create policy "Notifications select"
  on notifications for select to authenticated
  using (user_id = auth.uid() or auth.jwt() ->> 'role' = 'Admin');

create policy "Notifications insert"
  on notifications for insert to authenticated
  with check (user_id = auth.uid());

create policy "Notifications update"
  on notifications for update to authenticated
  using (user_id = auth.uid() or auth.jwt() ->> 'role' = 'Admin');

create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_read on notifications(is_read);
create index if not exists idx_notifications_created on notifications(created_at);
