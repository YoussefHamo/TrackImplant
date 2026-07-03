-- Fix: RLS policies use auth.jwt() ->> 'role' which returns 'authenticated',
-- NOT the custom role from user_metadata.
-- Use get_current_user_role() which queries public.users correctly.
-- Root cause: auth.jwt() ->> 'role' returns Supabase auth role ('authenticated'),
-- not the custom Manager/Admin/Doctor/Receptionist role.

-- 1. implant_inventory
drop policy if exists "ImplantInventory select" on public.implant_inventory;
create policy "ImplantInventory select"
  on public.implant_inventory for select
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist'));

-- 2. abutment_inventory
drop policy if exists "AbutmentInventory select" on public.abutment_inventory;
create policy "AbutmentInventory select"
  on public.abutment_inventory for select
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist'));

-- 3. inventory_items
drop policy if exists "InventoryItems select" on public.inventory_items;
create policy "InventoryItems select"
  on public.inventory_items for select
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist'));

-- 4. inventory_transactions
drop policy if exists "InventoryTransactions select" on public.inventory_transactions;
create policy "InventoryTransactions select"
  on public.inventory_transactions for select
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist'));

-- 5. stock_requests
drop policy if exists "StockRequests select" on public.stock_requests;
create policy "StockRequests select"
  on public.stock_requests for select
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist'));
