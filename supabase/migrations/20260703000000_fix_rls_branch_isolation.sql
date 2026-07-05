-- Fix: Enforce branch isolation for all inventory/clinical tables.
-- Non-Admin users see only their branch's data.
-- Admin users see all branches.
-- Uses get_current_user_role() consistently.

-- 1. implant_inventory
drop policy if exists "ImplantInventory select" on public.implant_inventory;
create policy "ImplantInventory select"
  on public.implant_inventory for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "ImplantInventory insert" on public.implant_inventory;
create policy "ImplantInventory insert"
  on public.implant_inventory for insert
  to authenticated
  with check (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "ImplantInventory update" on public.implant_inventory;
create policy "ImplantInventory update"
  on public.implant_inventory for update
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "ImplantInventory delete" on public.implant_inventory;
create policy "ImplantInventory delete"
  on public.implant_inventory for delete
  to authenticated
  using (get_current_user_role() = 'Admin');

-- 2. abutment_inventory
drop policy if exists "AbutmentInventory select" on public.abutment_inventory;
create policy "AbutmentInventory select"
  on public.abutment_inventory for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "AbutmentInventory insert" on public.abutment_inventory;
create policy "AbutmentInventory insert"
  on public.abutment_inventory for insert
  to authenticated
  with check (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "AbutmentInventory update" on public.abutment_inventory;
create policy "AbutmentInventory update"
  on public.abutment_inventory for update
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "AbutmentInventory delete" on public.abutment_inventory;
create policy "AbutmentInventory delete"
  on public.abutment_inventory for delete
  to authenticated
  using (get_current_user_role() = 'Admin');

-- 3. inventory_items
drop policy if exists "InventoryItems select" on public.inventory_items;
create policy "InventoryItems select"
  on public.inventory_items for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "InventoryItems insert" on public.inventory_items;
create policy "InventoryItems insert"
  on public.inventory_items for insert
  to authenticated
  with check (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "InventoryItems update" on public.inventory_items;
create policy "InventoryItems update"
  on public.inventory_items for update
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

drop policy if exists "InventoryItems delete" on public.inventory_items;
create policy "InventoryItems delete"
  on public.inventory_items for delete
  to authenticated
  using (get_current_user_role() = 'Admin');

-- 4. inventory_transactions — Non-Admin can only see their branch's transactions
drop policy if exists "InventoryTransactions select" on public.inventory_transactions;
create policy "InventoryTransactions select"
  on public.inventory_transactions for select
  to authenticated
  using (
    get_current_user_role() = 'Admin'
    or item_id in (
      select id from public.inventory_items
      where branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );

-- 5. stock_requests (deprecated — replaced by cross_branch_requests)
drop policy if exists "StockRequests select" on public.stock_requests;
create policy "StockRequests select"
  on public.stock_requests for select
  to authenticated
  using (get_current_user_role() = 'Admin');

-- 6. cross_branch_requests — same branch isolation
drop policy if exists "CrossBranchRequests select" on public.cross_branch_requests;
create policy "CrossBranchRequests select"
  on public.cross_branch_requests for select
  to authenticated
  using (
    get_current_user_role() = 'Admin'
    or (select branch_id from public.users where auth_user_id = auth.uid()) in (from_branch_id, to_branch_id)
    or requested_by = auth.uid()
  );

-- 7. cross_branch_deliveries — branch isolation via join to cross_branch_requests
drop policy if exists "CrossBranchDeliveries select" on public.cross_branch_deliveries;
create policy "CrossBranchDeliveries select"
  on public.cross_branch_deliveries for select
  to authenticated
  using (
    get_current_user_role() = 'Admin'
    or exists (
      select 1 from public.cross_branch_requests r
      where r.id = cross_branch_deliveries.request_id
        and (r.from_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
          or r.to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid()))
    )
  );

-- 8. patients — branch isolation (patients have branch_id)
drop policy if exists "Patients select" on public.patients;
create policy "Patients select"
  on public.patients for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

-- 9. procedures — branch isolation (procedures have branch_id via patients or direct)
drop policy if exists "Procedures select" on public.procedures;
create policy "Procedures select"
  on public.procedures for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

-- 10. appointments — branch isolation
drop policy if exists "Appointments select" on public.appointments;
create policy "Appointments select"
  on public.appointments for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

-- 11. follow_ups — branch isolation via patient's branch
drop policy if exists "FollowUps select" on public.follow_ups;
create policy "FollowUps select"
  on public.follow_ups for select
  to authenticated
  using (
    get_current_user_role() = 'Admin'
    or exists (
      select 1 from public.patients p
      where p.id = follow_ups.patient_id
      and p.branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );

-- 12. financial_records — branch isolation
drop policy if exists "FinancialRecords select" on public.financial_records;
create policy "FinancialRecords select"
  on public.financial_records for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

-- 13. communications — branch isolation via patient
drop policy if exists "communications_select" on public.communications;
create policy "communications_select"
  on public.communications for select
  to authenticated
  using (
    get_current_user_role() = 'Admin'
    or exists (
      select 1 from public.patients p
      where p.id = communications.patient_id
      and p.branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );

-- 14. inventory_returns — branch isolation
drop policy if exists "InventoryReturns select" on public.inventory_returns;
create policy "InventoryReturns select"
  on public.inventory_returns for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );

-- 15. inventory_deliveries — branch isolation (to_branch_id only, no from_branch_id column)
drop policy if exists "Deliveries select for authenticated" on public.inventory_deliveries;
create policy "Deliveries select for authenticated"
  on public.inventory_deliveries for select
  to authenticated
  using (
    to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or get_current_user_role() = 'Admin'
  );
