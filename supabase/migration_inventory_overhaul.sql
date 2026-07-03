-- ============================================================
-- TrackImplant – Inventory Overhaul Migration
-- 1. Add reserved/used columns to existing inventory tables
-- 2. Create unified inventory_items for new categories
-- 3. Create stock_requests workflow table
-- 4. Update inventory_transactions with new operation types
-- 5. Update RLS policies for Receptionist view-only access
-- ============================================================

-- 1. ADD RESERVED & USED COLUMNS TO EXISTING TABLES
alter table implant_inventory add column if not exists reserved int not null default 0 check (reserved >= 0);
alter table implant_inventory add column if not exists used int not null default 0 check (used >= 0);
alter table abutment_inventory add column if not exists reserved int not null default 0 check (reserved >= 0);
alter table abutment_inventory add column if not exists used int not null default 0 check (used >= 0);

-- 2. CREATE INVENTORY_ITEMS TABLE (unified for all categories)
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('implant', 'abutment', 'prosthetic', 'material')),
  subcategory text,
  name text,
  brand text,
  size text,
  unit text default 'piece',
  quantity int not null default 0 check (quantity >= 0),
  reserved int not null default 0 check (reserved >= 0),
  used int not null default 0 check (used >= 0),
  minimum_stock int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table inventory_items enable row level security;

create index if not exists idx_inventory_items_category on inventory_items(category);
create index if not exists idx_inventory_items_subcategory on inventory_items(subcategory);


-- 3. CREATE STOCK_REQUESTS TABLE
create table if not exists stock_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventory_items(id) on delete set null,
  item_name text not null,
  item_category text,
  quantity int not null check (quantity > 0),
  requested_by uuid references users(id) on delete set null,
  requested_by_name text,
  approved_by uuid references users(id) on delete set null,
  approved_by_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'delivered', 'completed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table stock_requests enable row level security;

create index if not exists idx_stock_requests_status on stock_requests(status);
create index if not exists idx_stock_requests_requested_by on stock_requests(requested_by);

-- 4. UPDATE INVENTORY_TRANSACTIONS - add new columns
alter table inventory_transactions add column if not exists item_category text;
alter table inventory_transactions add column if not exists item_name text;
alter table inventory_transactions add column if not exists created_by uuid references users(id) on delete set null;

-- 5. UPDATE RLS POLICIES
-- Inventory Items: Receptionist + can view, Admin full access
create policy "InventoryItems select"
  on inventory_items for select to authenticated
  using (auth.jwt() ->> 'role' in ('Admin', 'Receptionist', 'Doctor'));

create policy "InventoryItems insert"
  on inventory_items for insert to authenticated
  with check (auth.jwt() ->> 'role' = 'Admin');

create policy "InventoryItems update"
  on inventory_items for update to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

create policy "InventoryItems delete"
  on inventory_items for delete to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

-- Stock Requests: Receptionist can create & view, Admin can do all
create policy "StockRequests select"
  on stock_requests for select to authenticated
  using (auth.jwt() ->> 'role' in ('Admin', 'Receptionist'));

create policy "StockRequests insert"
  on stock_requests for insert to authenticated
  with check (auth.jwt() ->> 'role' in ('Admin', 'Receptionist'));

create policy "StockRequests update"
  on stock_requests for update to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

create policy "StockRequests delete"
  on stock_requests for delete to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

-- Existing inventory tables: add Receptionist read access
drop policy if exists "ImplantInventory select" on implant_inventory;
create policy "ImplantInventory select"
  on implant_inventory for select to authenticated
  using (auth.jwt() ->> 'role' in ('Admin', 'Receptionist', 'Doctor'));

drop policy if exists "AbutmentInventory select" on abutment_inventory;
create policy "AbutmentInventory select"
  on abutment_inventory for select to authenticated
  using (auth.jwt() ->> 'role' in ('Admin', 'Receptionist', 'Doctor'));

-- Inventory Transactions: view for all
drop policy if exists "InventoryTransactions select" on inventory_transactions;
create policy "InventoryTransactions select"
  on inventory_transactions for select to authenticated
  using (auth.jwt() ->> 'role' in ('Admin', 'Receptionist', 'Doctor'));

-- Update implant_inventory insert/update/delete for Admin only
drop policy if exists "ImplantInventory insert" on implant_inventory;
create policy "ImplantInventory insert"
  on implant_inventory for insert to authenticated
  with check (auth.jwt() ->> 'role' = 'Admin');

drop policy if exists "ImplantInventory update" on implant_inventory;
create policy "ImplantInventory update"
  on implant_inventory for update to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

drop policy if exists "ImplantInventory delete" on implant_inventory;
create policy "ImplantInventory delete"
  on implant_inventory for delete to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

drop policy if exists "AbutmentInventory insert" on abutment_inventory;
create policy "AbutmentInventory insert"
  on abutment_inventory for insert to authenticated
  with check (auth.jwt() ->> 'role' = 'Admin');

drop policy if exists "AbutmentInventory update" on abutment_inventory;
create policy "AbutmentInventory update"
  on abutment_inventory for update to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

drop policy if exists "AbutmentInventory delete" on abutment_inventory;
create policy "AbutmentInventory delete"
  on abutment_inventory for delete to authenticated
  using (auth.jwt() ->> 'role' = 'Admin');

-- 6. SEED DEFAULT SUBCATEGORIES
-- Prosthetic subcategories
insert into inventory_items (category, subcategory, name, quantity, minimum_stock) values
  ('prosthetic', 'healing_abutment', 'Healing Abutment', 0, 5),
  ('prosthetic', 'cover_screw', 'Cover Screw', 0, 10),
  ('prosthetic', 'transfer', 'Transfer', 0, 5),
  ('prosthetic', 'analog', 'Analog', 0, 5),
  ('prosthetic', 'scan_body', 'Scan Body', 0, 3),
  ('prosthetic', 'multi_unit', 'Multi Unit', 0, 3),
  ('prosthetic', 'lab_analog', 'Lab Analog', 0, 3)
on conflict (id) do nothing;

-- Material subcategories
insert into inventory_items (category, subcategory, name, quantity, minimum_stock) values
  ('material', 'bone_graft', 'Bone Graft', 0, 2),
  ('material', 'membrane', 'Membrane', 0, 2),
  ('material', 'sutures', 'Sutures', 0, 10),
  ('material', 'saline', 'Saline', 0, 5),
  ('material', 'anesthetic', 'Anesthetic', 0, 5),
  ('material', 'gloves', 'Gloves', 0, 20),
  ('material', 'surgical_kit', 'Surgical Kit', 0, 2),
  ('material', 'other', 'Other Materials', 0, 0)
on conflict (id) do nothing;
