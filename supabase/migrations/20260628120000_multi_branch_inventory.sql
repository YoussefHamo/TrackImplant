-- True multi-branch inventory system.
-- Every inventory record belongs to exactly one branch.
-- Managers see only their own branch's stock.
-- Admin sees all.

-- 1. Add branch_id to implant_inventory
alter table public.implant_inventory add column if not exists branch_id uuid references public.branches(id) on delete set null;
update public.implant_inventory set branch_id = (select id from public.branches where name = 'سيدي بشر') where branch_id is null;
alter table public.implant_inventory alter column branch_id set not null;
create index if not exists idx_implant_inventory_branch on public.implant_inventory(branch_id);

-- 2. Add branch_id to abutment_inventory
alter table public.abutment_inventory add column if not exists branch_id uuid references public.branches(id) on delete set null;
update public.abutment_inventory set branch_id = (select id from public.branches where name = 'سيدي بشر') where branch_id is null;
alter table public.abutment_inventory alter column branch_id set not null;
create index if not exists idx_abutment_inventory_branch on public.abutment_inventory(branch_id);

-- 3. Add branch_id to inventory_items (undo the consolidation — each branch owns its items)
alter table public.inventory_items add column if not exists branch_id uuid references public.branches(id) on delete set null;
update public.inventory_items set branch_id = (select id from public.branches where name = 'سيدي بشر') where branch_id is null;
alter table public.inventory_items alter column branch_id set not null;
create index if not exists idx_inventory_items_branch on public.inventory_items(branch_id);

-- 4. Clear the consolidation: remove branch_inventory entries that were just mirroring inventory_items
-- (stock is now tracked directly on inventory_items.branch_id)
delete from public.branch_inventory;

-- 5. RLS — implant_inventory
drop policy if exists "ImplantInventory select" on public.implant_inventory;
create policy "ImplantInventory select"
  on public.implant_inventory for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

drop policy if exists "ImplantInventory insert" on public.implant_inventory;
create policy "ImplantInventory insert"
  on public.implant_inventory for insert
  to authenticated
  with check (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

drop policy if exists "ImplantInventory update" on public.implant_inventory;
create policy "ImplantInventory update"
  on public.implant_inventory for update
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

-- 6. RLS — abutment_inventory
drop policy if exists "AbutmentInventory select" on public.abutment_inventory;
create policy "AbutmentInventory select"
  on public.abutment_inventory for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

drop policy if exists "AbutmentInventory insert" on public.abutment_inventory;
create policy "AbutmentInventory insert"
  on public.abutment_inventory for insert
  to authenticated
  with check (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

drop policy if exists "AbutmentInventory update" on public.abutment_inventory;
create policy "AbutmentInventory update"
  on public.abutment_inventory for update
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

-- 7. RLS — inventory_items
drop policy if exists "InventoryItems select" on public.inventory_items;
create policy "InventoryItems select"
  on public.inventory_items for select
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

drop policy if exists "InventoryItems insert" on public.inventory_items;
create policy "InventoryItems insert"
  on public.inventory_items for insert
  to authenticated
  with check (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

drop policy if exists "InventoryItems update" on public.inventory_items;
create policy "InventoryItems update"
  on public.inventory_items for update
  to authenticated
  using (
    branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    or (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

-- 8. RLS — inventory_transactions
drop policy if exists "InventoryTransactions select" on public.inventory_transactions;
create policy "InventoryTransactions select"
  on public.inventory_transactions for select
  to authenticated
  using (
    (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
  );

-- 9. RLS — stock_requests
drop policy if exists "StockRequests select" on public.stock_requests;
create policy "StockRequests select"
  on public.stock_requests for select
  to authenticated
  using (
    (select role from public.users where auth_user_id = auth.uid()) = 'Admin'
    or requested_by = auth.uid()
  );

-- 10. RLS — branch_inventory (deprecated, but keep a safety policy)
drop policy if exists "Branch inventory select for authenticated" on public.branch_inventory;
create policy "Branch inventory select for authenticated"
  on public.branch_inventory for select
  to authenticated
  using (false);
