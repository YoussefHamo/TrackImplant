-- Fix: Manager role excluded from SELECT policies on inventory tables
-- Root cause: RLS policies for authenticated users only allowed Admin/Doctor/Receptionist,
-- but NOT Manager, so Branch Managers couldn't see any inventory data.

-- 1. implant_inventory
drop policy if exists "ImplantInventory select" on public.implant_inventory;
create policy "ImplantInventory select"
  on public.implant_inventory for select
  to authenticated
  using ((auth.jwt() ->> 'role') = ANY (ARRAY['Admin', 'Manager', 'Doctor', 'Receptionist']));
drop policy if exists "implant_inventory_select" on public.implant_inventory;
drop policy if exists "implant_inventory_admin_only" on public.implant_inventory;

-- 2. abutment_inventory
drop policy if exists "AbutmentInventory select" on public.abutment_inventory;
create policy "AbutmentInventory select"
  on public.abutment_inventory for select
  to authenticated
  using ((auth.jwt() ->> 'role') = ANY (ARRAY['Admin', 'Manager', 'Doctor', 'Receptionist']));
drop policy if exists "abutment_inventory_select" on public.abutment_inventory;

-- 3. inventory_items
drop policy if exists "InventoryItems select" on public.inventory_items;
create policy "InventoryItems select"
  on public.inventory_items for select
  to authenticated
  using ((auth.jwt() ->> 'role') = ANY (ARRAY['Admin', 'Manager', 'Doctor', 'Receptionist']));

-- 4. inventory_transactions
drop policy if exists "InventoryTransactions select" on public.inventory_transactions;
create policy "InventoryTransactions select"
  on public.inventory_transactions for select
  to authenticated
  using ((auth.jwt() ->> 'role') = ANY (ARRAY['Admin', 'Manager', 'Doctor', 'Receptionist']));

-- 5. stock_requests
drop policy if exists "StockRequests select" on public.stock_requests;
create policy "StockRequests select"
  on public.stock_requests for select
  to authenticated
  using ((auth.jwt() ->> 'role') = ANY (ARRAY['Admin', 'Manager', 'Doctor', 'Receptionist']));
