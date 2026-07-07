-- Doctor Workflow Phase 2
-- 1. revenue_percentage on procedure_doctors for equal revenue split
-- 2. RLS: Block Doctor role from ALL inventory tables
-- 3. Procedure doctors unique constraint update

-- ── 1. REVENUE_PERCENTAGE ON PROCEDURE_DOCTORS ──

alter table public.procedure_doctors add column if not exists revenue_percentage numeric(5,2) default 0 check (revenue_percentage >= 0 and revenue_percentage <= 100);

-- ── 2. RLS: BLOCK DOCTOR FROM INVENTORY TABLES ──

-- implant_inventory
drop policy if exists "ImplantInventory select" on public.implant_inventory;
create policy "ImplantInventory select"
  on public.implant_inventory for select
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "ImplantInventory insert" on public.implant_inventory;
create policy "ImplantInventory insert"
  on public.implant_inventory for insert
  to authenticated
  with check (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "ImplantInventory update" on public.implant_inventory;
create policy "ImplantInventory update"
  on public.implant_inventory for update
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

-- abutment_inventory
drop policy if exists "AbutmentInventory select" on public.abutment_inventory;
create policy "AbutmentInventory select"
  on public.abutment_inventory for select
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "AbutmentInventory insert" on public.abutment_inventory;
create policy "AbutmentInventory insert"
  on public.abutment_inventory for insert
  to authenticated
  with check (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "AbutmentInventory update" on public.abutment_inventory;
create policy "AbutmentInventory update"
  on public.abutment_inventory for update
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

-- inventory_items
drop policy if exists "InventoryItems select" on public.inventory_items;
create policy "InventoryItems select"
  on public.inventory_items for select
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "InventoryItems insert" on public.inventory_items;
create policy "InventoryItems insert"
  on public.inventory_items for insert
  to authenticated
  with check (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "InventoryItems update" on public.inventory_items;
create policy "InventoryItems update"
  on public.inventory_items for update
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

-- inventory_transactions (no direct branch_id; uses item_id lookup)
drop policy if exists "InventoryTransactions select" on public.inventory_transactions;
create policy "InventoryTransactions select"
  on public.inventory_transactions for select
  to authenticated
  using (
    (get_current_user_role() != 'Doctor' and item_id in (
      select id from public.inventory_items
      where branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    ))
    or get_current_user_role() = 'Admin'
  );

-- inventory_returns
drop policy if exists "InventoryReturns select" on public.inventory_returns;
create policy "InventoryReturns select"
  on public.inventory_returns for select
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

-- inventory_deliveries (to_branch_id only)
drop policy if exists "Deliveries select for authenticated" on public.inventory_deliveries;
create policy "Deliveries select for authenticated"
  on public.inventory_deliveries for select
  to authenticated
  using (
    (to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

-- inventory_count_sessions
drop policy if exists "count_sessions_select" on public.inventory_count_sessions;
create policy "count_sessions_select"
  on public.inventory_count_sessions for select
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "count_sessions_insert" on public.inventory_count_sessions;
create policy "count_sessions_insert"
  on public.inventory_count_sessions for insert
  to authenticated
  with check (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "count_sessions_update" on public.inventory_count_sessions;
create policy "count_sessions_update"
  on public.inventory_count_sessions for update
  to authenticated
  using (
    (branch_id = (select branch_id from public.users where auth_user_id = auth.uid()) and get_current_user_role() != 'Doctor')
    or get_current_user_role() = 'Admin'
  );

-- inventory_count_items
drop policy if exists "count_items_select" on public.inventory_count_items;
create policy "count_items_select"
  on public.inventory_count_items for select
  to authenticated
  using (
    get_current_user_role() = 'Admin'
    or (get_current_user_role() != 'Doctor' and session_id in (
      select id from public.inventory_count_sessions
      where branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    ))
  );

-- cross_branch_requests (uses from_branch_id / to_branch_id)
drop policy if exists "cross_branch_requests_select" on public.cross_branch_requests;
drop policy if exists "CrossBranchRequests select" on public.cross_branch_requests;
create policy "cross_branch_requests_select"
  on public.cross_branch_requests for select
  to authenticated
  using (
    (get_current_user_role() != 'Doctor' and (select branch_id from public.users where auth_user_id = auth.uid()) in (from_branch_id, to_branch_id))
    or get_current_user_role() = 'Admin'
  );

-- ── 3. NOTIFICATIONS: UPDATE TRIGGER TO INCLUDE PROCEDURE NOTIFICATIONS ──

-- Create notification for procedure creation (new)
create or replace function public.handle_procedure_notification()
returns trigger as $$
begin
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  select
    u.auth_user_id,
    'New Procedure Created',
    'Procedure ' || coalesce(new.procedure_name, '') || ' created for patient ' || coalesce((select full_name from public.patients where id = new.patient_id), ''),
    '/dashboard/cases?id=' || new.id,
    false,
    now()
  from public.users u
  where u.role in ('Admin', 'Manager')
    and (new.branch_id is null or u.branch_id = new.branch_id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_procedure_notification on public.procedures;
create trigger trg_procedure_notification
  after insert on public.procedures
  for each row execute function public.handle_procedure_notification();

-- ── 4. UPDATE AUTO-INVOICE TRIGGER TO SET branch_id ── (already correct, no change needed)

-- ── 5. ADD RECEPTIONIST AND ASSISTANT TO DOCTOR ROUTE CHECKS ── (handled in app layer)
