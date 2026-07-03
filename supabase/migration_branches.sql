-- Migration: Branches, Branch Inventory, Delivery Forms, Returns

-- 1. Branches
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.branches enable row level security;

create policy "Branches select for authenticated"
  on public.branches for select to authenticated using (true);
create policy "Branches insert for admin"
  on public.branches for insert to authenticated with check (get_current_user_role() = 'Admin');
create policy "Branches update for admin"
  on public.branches for update to authenticated using (get_current_user_role() = 'Admin');
create policy "Branches delete for admin"
  on public.branches for delete to authenticated using (get_current_user_role() = 'Admin');

-- 2. Branch Inventory
create table if not exists public.branch_inventory (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  quantity int not null default 0 check (quantity >= 0),
  reserved int not null default 0 check (reserved >= 0),
  updated_at timestamptz default now(),
  unique (branch_id, item_id)
);

alter table public.branch_inventory enable row level security;

create policy "Branch inventory select for authenticated"
  on public.branch_inventory for select to authenticated using (true);
create policy "Branch inventory insert for admin"
  on public.branch_inventory for insert to authenticated with check (get_current_user_role() = 'Admin');
create policy "Branch inventory update for admin"
  on public.branch_inventory for update to authenticated using (get_current_user_role() = 'Admin');
create policy "Branch inventory delete for admin"
  on public.branch_inventory for delete to authenticated using (get_current_user_role() = 'Admin');

-- 3. Inventory Deliveries
create table if not exists public.inventory_deliveries (
  id uuid primary key default gen_random_uuid(),
  from_location text not null default 'supplier',
  to_type text not null check (to_type in ('warehouse', 'branch')),
  to_branch_id uuid references public.branches(id) on delete set null,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity int not null check (quantity > 0),
  notes text,
  received_by text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.inventory_deliveries enable row level security;

create policy "Deliveries select for authenticated"
  on public.inventory_deliveries for select to authenticated using (true);
create policy "Deliveries insert for admin"
  on public.inventory_deliveries for insert to authenticated with check (get_current_user_role() = 'Admin');
create policy "Deliveries update for admin"
  on public.inventory_deliveries for update to authenticated using (get_current_user_role() = 'Admin');
create policy "Deliveries delete for admin"
  on public.inventory_deliveries for delete to authenticated using (get_current_user_role() = 'Admin');

-- 4. Returns
create table if not exists public.inventory_returns (
  id uuid primary key default gen_random_uuid(),
  from_location text not null check (from_location in ('warehouse', 'branch', 'patient')),
  from_branch_id uuid references public.branches(id) on delete set null,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity int not null check (quantity > 0),
  reason text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.inventory_returns enable row level security;

create policy "Returns select for authenticated"
  on public.inventory_returns for select to authenticated using (true);
create policy "Returns insert for admin"
  on public.inventory_returns for insert to authenticated with check (get_current_user_role() = 'Admin');
create policy "Returns update for admin"
  on public.inventory_returns for update to authenticated using (get_current_user_role() = 'Admin');
create policy "Returns delete for admin"
  on public.inventory_returns for delete to authenticated using (get_current_user_role() = 'Admin');
