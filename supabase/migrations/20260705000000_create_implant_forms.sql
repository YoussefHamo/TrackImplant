-- Implant Forms table — structured dental implant documentation
-- Each form is linked to a patient and appears in the patient's Documents tab
create table if not exists public.implant_forms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  implant_type text not null,
  manufacturer text not null,
  diameter text not null,
  length text,
  quantity int not null default 1 check (quantity >= 1),
  tooth_number text not null,
  batch_number text,
  serial_number text,
  warranty_number text,
  doctors jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  notes text,
  branch_id uuid references public.branches(id) on delete set null,
  status text not null default 'Draft' check (status in ('Draft', 'Completed')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_implant_forms_patient on public.implant_forms(patient_id);
create index if not exists idx_implant_forms_status on public.implant_forms(status);
create index if not exists idx_implant_forms_created on public.implant_forms(created_at);

alter table public.implant_forms enable row level security;

-- RLS: global read for all authenticated roles (same as patient_files)
drop policy if exists "implant_forms_select" on public.implant_forms;
create policy "implant_forms_select"
  on public.implant_forms for select
  to authenticated
  using (
    (select role::text from public.users where auth_user_id = auth.uid())
    IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant')
  );

drop policy if exists "implant_forms_insert" on public.implant_forms;
create policy "implant_forms_insert"
  on public.implant_forms for insert
  to authenticated
  with check (
    (select role::text from public.users where auth_user_id = auth.uid())
    IN ('Admin', 'Doctor', 'Receptionist')
  );

drop policy if exists "implant_forms_update" on public.implant_forms;
create policy "implant_forms_update"
  on public.implant_forms for update
  to authenticated
  using (
    (select role::text from public.users where auth_user_id = auth.uid())
    IN ('Admin', 'Doctor', 'Receptionist')
  );

drop policy if exists "implant_forms_delete" on public.implant_forms;
create policy "implant_forms_delete"
  on public.implant_forms for delete
  to authenticated
  using (
    (select role::text from public.users where auth_user_id = auth.uid()) = 'Admin'
  );
