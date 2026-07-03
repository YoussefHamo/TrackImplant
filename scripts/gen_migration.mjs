import fs from 'fs';
import path from 'path';

const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

const content = `-- Cross-branch requests table for inter-branch inventory transfers
create table if not exists public.cross_branch_requests (
  id uuid primary key default gen_random_uuid(),
  from_branch_id uuid not null references public.branches(id) on delete cascade,
  to_branch_id uuid not null references public.branches(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  item_category text,
  quantity int not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'in_transit', 'delivered')),
  requested_by uuid references public.users(id) on delete set null,
  responded_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cross_branch_requests enable row level security;

-- Managers see requests involving their branch; Super Manager sees all
create policy "cross_branch_requests_select"
  on public.cross_branch_requests for select
  to authenticated
  using (
    get_current_user_role() = 'Manager'
    OR get_current_user_role() = 'Admin'
  );

create policy "cross_branch_requests_insert"
  on public.cross_branch_requests for insert
  to authenticated
  with check (
    get_current_user_role() = 'Manager'
    OR get_current_user_role() = 'Admin'
  );

create policy "cross_branch_requests_update"
  on public.cross_branch_requests for update
  to authenticated
  using (get_current_user_role() IN ('Manager', 'Admin'));

create policy "cross_branch_requests_delete"
  on public.cross_branch_requests for delete
  to authenticated
  using (get_current_user_role() = 'Admin');

-- Add cross_branch operation_type to inventory_transactions
alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_operation_type_check;

alter table public.inventory_transactions
  add constraint inventory_transactions_operation_type_check
  check (operation_type in ('add', 'issue', 'return', 'adjust', 'cross_branch'));

-- Update stock_requests to allow cross_branch type
alter table public.stock_requests add column if not exists request_type text default 'internal' check (request_type in ('internal', 'cross_branch'));
alter table public.stock_requests add column if not exists from_branch_id uuid references public.branches(id) on delete set null;
alter table public.stock_requests add column if not exists to_branch_id uuid references public.branches(id) on delete set null;
`;

const dir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const filePath = path.join(dir, ts + '_cross_branch_requests.sql');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Created: ' + filePath);
console.log(content);
