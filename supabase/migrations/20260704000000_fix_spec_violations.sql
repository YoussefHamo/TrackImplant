-- ============================================================
-- TrackImplant Phase 2 — Fix Specification Violations
-- 1. Restore GLOBAL access for Patients & Financial Records (no branch filter in RLS SELECT/UPDATE)
-- 2. Restore GLOBAL access for Patient Files & Communications SELECT
-- 3. Fix get_requestable_items RPC role check to allow Managers to see other branch stock
-- 4. Fix get_aggregated_inventory RPC to prevent non-Admin branch isolation bypass
-- 5. Fix handle_return_approval trigger to look up actual item category
-- ============================================================

-- ── 1. GLOBAL TABLES RLS RESTORATION ──

-- Add Assistant role to user_role enum in a separate block
do $$ begin
  alter type public.user_role add value if not exists 'Assistant';
exception when others then null;
end $$;

-- Drop conflicting restrictive policies from migration 20260703030000_fix_branch_isolation.sql
drop policy if exists "Patients select" on public.patients;
drop policy if exists "Patients update" on public.patients;
drop policy if exists "FinancialRecords select" on public.financial_records;
drop policy if exists "FinancialRecords update" on public.financial_records;

-- Create global policies (allow all authenticated roles global visibility/search)
create policy "Patients select" on public.patients for select
  using (
    (select role::text from public.users where auth_user_id = auth.uid()) IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant')
  );

create policy "Patients update" on public.patients for update
  using (
    get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist')
  );

create policy "FinancialRecords select" on public.financial_records for select
  using (
    get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist')
  );

create policy "FinancialRecords update" on public.financial_records for update
  using (
    get_current_user_role() IN ('Admin', 'Manager')
  );


-- ── 2. GLOBAL PROFILE ACCESS RESTORATION ──

drop policy if exists "patient_files_select" on public.patient_files;
drop policy if exists "communications_select" on public.communications;

-- Documents and communications must be viewable by anyone viewing the global patient profile
create policy "patient_files_select" on public.patient_files for select
  using (
    (select role::text from public.users where auth_user_id = auth.uid()) IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant')
  );

create policy "communications_select" on public.communications for select
  using (
    (select role::text from public.users where auth_user_id = auth.uid()) IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant')
  );


-- ── 3. FIX GET_REQUESTABLE_ITEMS RPC ──
-- Managers must be able to view inventory in other branches to submit cross-branch stock requests
create or replace function public.get_requestable_items(
  p_exclude_branch_id uuid default null,
  p_category text default null
)
returns table(
  id uuid, branch_id uuid, category text, subcategory text, name text,
  brand text, size text, unit text, quantity numeric
)
language sql
security definer
set search_path = public
as $$
  select iv.id, iv.branch_id, iv.category, iv.subcategory, iv.name,
         iv.brand, iv.size, iv.unit, iv.quantity
  from public.inventory_items iv
  where iv.quantity > 0
    and (p_exclude_branch_id is null or iv.branch_id != p_exclude_branch_id)
    and (p_category is null or iv.category = p_category)
    and (
      get_current_user_role() IN ('Admin', 'Manager')
    );
$$;


-- ── 4. FIX GET_AGGREGATED_INVENTORY RPC ──
-- Enforce branch isolation for non-Admin users even when filtering by branch parameter
create or replace function public.get_aggregated_inventory(
  p_category text default null,
  p_branch_id uuid default null
)
returns table(
  id uuid, branch_id uuid, category text, subcategory text, name text,
  brand text, size text, unit text, quantity numeric, reserved numeric,
  used numeric, minimum_stock numeric, created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select * from public.v_inventory_all
  where (p_category is null or category = p_category)
    and (
      get_current_user_role() = 'Admin'
      or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
    and (p_branch_id is null or branch_id = p_branch_id);
$$;


-- ── 5. FIX RETURN TRIGGER ITEM_TYPE LOGIC ──
-- Look up actual item category from inventory_items instead of guessing based on return location
create or replace function public.handle_return_approval()
returns trigger as $$
declare
  v_category text;
begin
  if new.status = 'approved' and (old is null or old.status != 'approved') then
    -- Get the actual category of the inventory item
    select category into v_category from public.inventory_items where id = new.item_id;

    -- Find the inventory item and add quantity back
    update public.inventory_items
    set quantity = quantity + new.quantity, updated_at = now()
    where id = new.item_id and branch_id = new.branch_id;

    -- Record transaction
    insert into public.inventory_transactions (
      item_type, item_id, type, operation_type, quantity,
      item_category, item_name, notes
    ) values (
      case when v_category = 'implant' then 'implant' else 'abutment' end,
      new.item_id, 'add', 'return', new.quantity,
      v_category, new.item_name,
      format('Return approved: %s', new.reason)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
