-- Cross-branch requests table
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

drop policy if exists "cross_branch_requests_select" on public.cross_branch_requests;
create policy "cross_branch_requests_select"
  on public.cross_branch_requests for select
  to authenticated
  using (
    get_current_user_role() = 'Manager'
    OR get_current_user_role() = 'Admin'
  );

drop policy if exists "cross_branch_requests_insert" on public.cross_branch_requests;
create policy "cross_branch_requests_insert"
  on public.cross_branch_requests for insert
  to authenticated
  with check (
    get_current_user_role() = 'Manager'
    OR get_current_user_role() = 'Admin'
  );

drop policy if exists "cross_branch_requests_update" on public.cross_branch_requests;
create policy "cross_branch_requests_update"
  on public.cross_branch_requests for update
  to authenticated
  using (get_current_user_role() IN ('Manager', 'Admin'));

drop policy if exists "cross_branch_requests_delete" on public.cross_branch_requests;
create policy "cross_branch_requests_delete"
  on public.cross_branch_requests for delete
  to authenticated
  using (get_current_user_role() = 'Admin');

-- Extend operation_type check on inventory_transactions
alter table inventory_transactions drop constraint if exists inventory_transactions_operation_type_check;
alter table inventory_transactions add constraint inventory_transactions_operation_type_check
  check (operation_type in ('add', 'issue', 'return', 'adjust', 'cross_branch'));
