-- Migration: Add branch_id to users, update roles

-- 1. Add branch_id column to users
alter table public.users add column if not exists branch_id uuid references public.branches(id) on delete set null;
create index if not exists idx_users_branch_id on public.users(branch_id);

-- 2. Insert the 7 branches
insert into public.branches (name) values
  ('سيدي بشر'),
  ('محرم بك'),
  ('الإبراهيمية'),
  ('العجمي'),
  ('أبو يوسف'),
  ('محطة الرمل'),
  ('سموحة')
on conflict (name) do nothing;

-- 3. Drop old RLS policies that check role and recreate to allow Manager
-- For users table
drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin"
  on public.users for select
  to authenticated
  using (
    get_current_user_role() IN ('Admin', 'Manager')
    OR auth.uid() = auth_user_id
  );

drop policy if exists "users_insert_admin" on public.users;
create policy "users_insert_admin"
  on public.users for insert
  to authenticated
  with check (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "users_update_admin" on public.users;
create policy "users_update_admin"
  on public.users for update
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "users_delete_admin" on public.users;
create policy "users_delete_admin"
  on public.users for delete
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

-- For inventory_items
drop policy if exists "Inventory items select" on public.inventory_items;
create policy "Inventory items select"
  on public.inventory_items for select
  to authenticated
  using (true);

drop policy if exists "Inventory items insert" on public.inventory_items;
create policy "Inventory items insert"
  on public.inventory_items for insert
  to authenticated
  with check (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "Inventory items update" on public.inventory_items;
create policy "Inventory items update"
  on public.inventory_items for update
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "Inventory items delete" on public.inventory_items;
create policy "Inventory items delete"
  on public.inventory_items for delete
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

-- For branch_inventory
drop policy if exists "Branch inventory select for authenticated" on public.branch_inventory;
create policy "Branch inventory select for authenticated"
  on public.branch_inventory for select
  to authenticated
  using (true);

drop policy if exists "Branch inventory insert for admin" on public.branch_inventory;
create policy "Branch inventory insert for admin"
  on public.branch_inventory for insert
  to authenticated
  with check (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "Branch inventory update for admin" on public.branch_inventory;
create policy "Branch inventory update for admin"
  on public.branch_inventory for update
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "Branch inventory delete for admin" on public.branch_inventory;
create policy "Branch inventory delete for admin"
  on public.branch_inventory for delete
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

-- For stock_requests
drop policy if exists "Stock requests select" on public.stock_requests;
create policy "Stock requests select"
  on public.stock_requests for select
  to authenticated
  using (true);

drop policy if exists "Stock requests insert" on public.stock_requests;
create policy "Stock requests insert"
  on public.stock_requests for insert
  to authenticated
  with check (true);

drop policy if exists "Stock requests update" on public.stock_requests;
create policy "Stock requests update"
  on public.stock_requests for update
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

drop policy if exists "Stock requests delete" on public.stock_requests;
create policy "Stock requests delete"
  on public.stock_requests for delete
  to authenticated
  using (get_current_user_role() IN ('Admin', 'Manager'));

-- For branches
drop policy if exists "Branches select for authenticated" on public.branches;
create policy "Branches select for authenticated"
  on public.branches for select
  to authenticated
  using (true);

drop policy if exists "Branches insert for admin" on public.branches;
create policy "Branches insert for admin"
  on public.branches for insert
  to authenticated
  with check (get_current_user_role() = 'Manager');

drop policy if exists "Branches update for admin" on public.branches;
create policy "Branches update for admin"
  on public.branches for update
  to authenticated
  using (get_current_user_role() = 'Manager');

drop policy if exists "Branches delete for admin" on public.branches;
create policy "Branches delete for admin"
  on public.branches for delete
  to authenticated
  using (get_current_user_role() = 'Manager');

-- Add Manager role to user_role enum
alter type public.user_role add value if not exists 'Manager';

-- Update get_current_user_role to handle Manager role too
create or replace function public.get_current_user_role()
returns text
language sql
stable security definer
as $$
  SELECT role::text
  FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;
