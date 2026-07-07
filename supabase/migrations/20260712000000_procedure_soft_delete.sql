-- Procedure soft delete
-- 1. Add is_deleted / deleted_at columns to procedures
-- 2. Update RLS to hide soft-deleted procedures

alter table public.procedures add column if not exists is_deleted boolean not null default false;
alter table public.procedures add column if not exists deleted_at timestamptz;

-- Update all existing procedure queries to filter out deleted
-- This is handled in the app layer; RLS remains for auth/role checks

-- Recreate the auto-invoice trigger to also skip soft-deleted procedures (defensive)
create or replace function public.handle_procedure_create_auto_invoice()
returns trigger as $$
declare
  v_invoice_name text;
begin
  if new.implant_system is not null and new.implant_system != '' and new.is_deleted = false then
    v_invoice_name := coalesce(new.procedure_name, 'Implant Procedure');
    insert into public.financial_records (
      patient_id, patient_name, record_type, invoice_name, procedure_id,
      total_amount, amount, paid_so_far, remaining_amount, status, notes, branch_id
    ) values (
      new.patient_id,
      (select full_name from public.patients where id = new.patient_id),
      'invoice',
      v_invoice_name,
      new.id,
      0, 0, 0, 0,
      'Pending',
      'Auto-generated from procedure',
      new.branch_id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
