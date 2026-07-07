-- Doctor Workflow & Multi-Doctor Procedures
-- 1. procedure_doctors junction table
-- 2. procedure_id on financial_records
-- 3. RLS updates for doctor isolation
-- 4. Auto-invoice trigger for implant procedures

-- ── 1. PROCEDURE_DOCTORS JUNCTION TABLE ──

create table if not exists public.procedure_doctors (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  doctor_id uuid not null references public.users(auth_user_id) on delete cascade,
  role_in_procedure text not null default 'assistant' check (role_in_procedure in ('primary', 'assistant')),
  display_order int not null default 0,
  unique (procedure_id, doctor_id)
);

alter table public.procedure_doctors enable row level security;

-- RLS: Admin/Manager can see all; Doctor sees only their own procedures
create policy "procedure_doctors_select" on public.procedure_doctors for select
  using (
    get_current_user_role() IN ('Admin', 'Manager')
    or doctor_id = auth.uid()
  );

create policy "procedure_doctors_insert" on public.procedure_doctors for insert
  with check (
    get_current_user_role() IN ('Admin', 'Manager', 'Doctor')
  );

create policy "procedure_doctors_update" on public.procedure_doctors for update
  using (
    get_current_user_role() IN ('Admin', 'Manager')
  );

create policy "procedure_doctors_delete" on public.procedure_doctors for delete
  using (
    get_current_user_role() IN ('Admin', 'Manager')
  );

-- ── 2. PROCEDURE_ID ON FINANCIAL_RECORDS ──

alter table public.financial_records add column if not exists procedure_id uuid references public.procedures(id) on delete set null;

-- ── 3. RLS: DOCTOR ISOLATION FOR APPOINTMENTS ──

-- Appointments: Doctor sees only their own
drop policy if exists "Appointments select" on public.appointments;
create policy "Appointments select" on public.appointments for select
  using (
    get_current_user_role() = 'Admin'
    or (get_current_user_role() IN ('Manager', 'Receptionist') and branch_id = (select branch_id from public.users where auth_user_id = auth.uid()))
    or (get_current_user_role() = 'Doctor' and doctor_id = auth.uid())
  );

-- Also add Assistant role to appointments select
drop policy if exists "Appointments assistant select" on public.appointments;
create policy "Appointments assistant select" on public.appointments for select
  using (
    get_current_user_role() = 'Assistant'
    and branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

-- Procedures: Doctor sees only their own
drop policy if exists "Procedures select" on public.procedures;
create policy "Procedures select" on public.procedures for select
  using (
    get_current_user_role() = 'Admin'
    or (get_current_user_role() IN ('Manager', 'Receptionist') and branch_id = (select branch_id from public.users where auth_user_id = auth.uid()))
    or (get_current_user_role() = 'Doctor' and (
      id in (select procedure_id from public.procedure_doctors where doctor_id = auth.uid())
    ))
  );

-- ── 4. AUTO-INVOICE TRIGGER FOR IMPLANT PROCEDURES ──

create or replace function public.handle_procedure_create_auto_invoice()
returns trigger as $$
declare
  v_invoice_name text;
begin
  -- Only auto-create invoice for implant procedures
  if new.implant_system is not null and new.implant_system != '' then
    v_invoice_name := coalesce(new.procedure_name, 'Implant Procedure');
    insert into public.financial_records (
      patient_id,
      patient_name,
      record_type,
      invoice_name,
      procedure_id,
      total_amount,
      amount,
      paid_so_far,
      remaining_amount,
      status,
      notes,
      branch_id
    ) values (
      new.patient_id,
      (select full_name from public.patients where id = new.patient_id),
      'invoice',
      v_invoice_name,
      new.id,
      0,
      0,
      0,
      0,
      'Pending',
      'Auto-generated from procedure',
      new.branch_id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_procedure_auto_invoice on public.procedures;
create trigger trg_procedure_auto_invoice
  after insert on public.procedures
  for each row execute function public.handle_procedure_create_auto_invoice();
