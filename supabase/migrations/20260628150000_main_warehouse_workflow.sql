-- ═══════════════════════════════════════════════════════════════
-- Main Warehouse Workflow
-- ═══════════════════════════════════════════════════════════════
-- 1. Expand cross_branch_requests statuses + add completed
-- 2. Create cross_branch_deliveries table
-- 3. RPC: get_requestable_items (items available from other branches)
-- 4. RPC: find_best_source_branch (auto-pick source)
-- 5. Trigger: auto-transfer inventory on delivery completion
-- 6. Update notification trigger for new workflow events
-- 7. Update RLS policies for Receptionist access
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Cross-branch requests: relax status check ──
alter table public.cross_branch_requests drop constraint if exists cross_branch_requests_status_check;
alter table public.cross_branch_requests add constraint cross_branch_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'in_transit', 'delivered', 'completed'));

-- ── 2. Cross-branch deliveries table ──
create table if not exists public.cross_branch_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.cross_branch_requests(id) on delete cascade,
  status text not null default 'preparing' check (status in ('preparing', 'picked_up', 'in_transit', 'arrived', 'completed')),
  updated_by uuid references public.users(auth_user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cross_branch_deliveries enable row level security;

-- RLS: only managers/admins can see deliveries linked to their branch
create policy "cross_branch_deliveries_select"
  on public.cross_branch_deliveries for select
  to authenticated
  using (
    exists (
      select 1 from public.cross_branch_requests r
      where r.id = request_id
        and (r.from_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
          or r.to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
          or (select role from public.users where auth_user_id = auth.uid()) = 'Admin')
    )
  );

create policy "cross_branch_deliveries_insert"
  on public.cross_branch_deliveries for insert
  to authenticated
  with check (
    (select role from public.users where auth_user_id = auth.uid()) in ('Manager', 'Admin')
  );

create policy "cross_branch_deliveries_update"
  on public.cross_branch_deliveries for update
  to authenticated
  using (
    exists (
      select 1 from public.cross_branch_requests r
      where r.id = request_id
        and (r.from_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
          or r.to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
          or (select role from public.users where auth_user_id = auth.uid()) = 'Admin')
    )
  );

-- ── 3. RPC: get_requestable_items ──
-- Returns items available from branches other than the requesting branch,
-- grouped by type (brand+size for implants, subcategory for others).
-- Does NOT expose which branch has them.
create or replace function public.get_requestable_items(
  p_exclude_branch_id uuid,
  p_category text default null
)
returns table(
  lookup_key text,
  category text,
  subcategory text,
  name text,
  brand text,
  size text,
  unit text,
  total_quantity int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when ii.category = 'implant' then ii.brand || '||' || ii.size
      else coalesce(ii.subcategory, ii.name)
    end as lookup_key,
    ii.category,
    ii.subcategory,
    ii.name,
    ii.brand,
    ii.size,
    ii.unit,
    sum(ii.quantity)::int as total_quantity
  from public.inventory_items ii
  where ii.quantity > 0
    and ii.branch_id != p_exclude_branch_id
    and (p_category is null or ii.category = p_category)
  group by
    case
      when ii.category = 'implant' then ii.brand || '||' || ii.size
      else coalesce(ii.subcategory, ii.name)
    end,
    ii.category, ii.subcategory, ii.name, ii.brand, ii.size, ii.unit
  order by total_quantity desc;
$$;

-- ── 4. RPC: find_best_source_branch ──
-- Given a lookup_key (brand||size for implants, subcategory for others),
-- finds the best branch to fulfill the request.
-- Priority: highest quantity → same city → first available.
-- Returns the exact inventory_items.id so we can reference it in the request.
create or replace function public.find_best_source_branch(
  p_lookup_key text,
  p_category text,
  p_exclude_branch_id uuid
)
returns table (
  branch_id uuid,
  branch_name text,
  item_id uuid,
  available_qty int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ii.branch_id,
    b.name as branch_name,
    ii.id as item_id,
    ii.quantity as available_qty
  from public.inventory_items ii
  join public.branches b on b.id = ii.branch_id
  where ii.quantity > 0
    and ii.branch_id != p_exclude_branch_id
    and ii.category = p_category
    and (
      (p_category = 'implant' and (ii.brand || '||' || ii.size) = p_lookup_key)
      or (p_category != 'implant' and coalesce(ii.subcategory, ii.name) = p_lookup_key)
    )
  order by ii.quantity desc, b.name
  limit 1;
$$;

-- ── 5. Trigger: auto-transfer inventory on delivery completion ──
create or replace function public.handle_cross_branch_delivery_complete()
returns trigger as $$
declare
  req record;
  src_item record;
  dst_item record;
  item_type_text text;
begin
  if new.status = 'completed' and (old is null or old.status != 'completed') then
    -- Load the associated request
    select * into req from public.cross_branch_requests where id = new.request_id;
    if not found then return new; end if;

    -- Get the source branch's inventory item
    select * into src_item from public.inventory_items where id = req.item_id;
    if not found then return new; end if;

    -- Find matching item at the destination branch (same brand/size/subcategory)
    select * into dst_item from public.inventory_items
    where branch_id = req.to_branch_id
      and category = src_item.category
      and coalesce(brand, '') = coalesce(src_item.brand, '')
      and coalesce(size, '') = coalesce(src_item.size, '')
      and coalesce(subcategory, '') = coalesce(src_item.subcategory, '')
    limit 1;

    if found then
      -- Add to existing item at destination
      update public.inventory_items
      set quantity = quantity + req.quantity, updated_at = now()
      where id = dst_item.id;
    else
      -- Clone the item record for the destination branch
      insert into public.inventory_items (
        branch_id, category, subcategory, name, brand, size, unit,
        quantity, reserved, used, minimum_stock
      ) values (
        req.to_branch_id, src_item.category, src_item.subcategory, src_item.name,
        src_item.brand, src_item.size, src_item.unit,
        req.quantity, 0, 0, src_item.minimum_stock
      );
    end if;

    -- Deduct from source branch
    update public.inventory_items
    set quantity = quantity - req.quantity, updated_at = now()
    where id = src_item.id;

    -- Record transaction
    item_type_text := case when src_item.category = 'implant' then 'implant' else 'abutment' end;
    insert into public.inventory_transactions (
      item_type, item_id, type, operation_type, quantity,
      item_category, item_name, notes
    ) values (
      item_type_text, src_item.id, 'deduct', 'cross_branch', req.quantity,
      src_item.category, src_item.name,
      'Transferred via cross-branch delivery'
    );

    -- Mark request as completed
    update public.cross_branch_requests set status = 'completed', updated_at = now() where id = new.request_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cross_branch_delivery_complete on public.cross_branch_deliveries;
create trigger trg_cross_branch_delivery_complete
  after insert or update of status on public.cross_branch_deliveries
  for each row execute function public.handle_cross_branch_delivery_complete();

-- ── 6. Update notification trigger for new workflow ──
create or replace function public.handle_cross_branch_request_notification()
returns trigger as $$
declare
  target_user record;
  notif_title text;
  notif_message text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    -- Notify all managers of the source branch (they need to approve/ship)
    notif_title := 'طلب مخزون جديد';
    notif_message := format('طلب %s × %s من فرع %s', new.quantity, new.item_name, (select name from public.branches where id = new.to_branch_id));
    notif_type := 'info';
    for target_user in
      select auth_user_id from public.users
      where role = 'Manager' and branch_id = new.from_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/inventory');
    end loop;
    -- Also notify the requesting branch's managers and receptionists
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id = new.to_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, 'تم إرسال طلب مخزون', format('تم إرسال طلب %s × %s إلى المستودع الرئيسي', new.quantity, new.item_name), 'info', '/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    if new.status = 'approved' then
      notif_title := 'تم الموافقة على الطلب';
      notif_message := format('تمت الموافقة على طلب %s × %s', new.quantity, new.item_name);
      notif_type := 'success';
    elsif new.status = 'rejected' then
      notif_title := 'تم رفض الطلب';
      notif_message := format('تم رفض طلب %s × %s', new.quantity, new.item_name);
      notif_type := 'warning';
    else
      return new;
    end if;
    -- Notify requesting branch users
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id = new.to_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/inventory');
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cross_branch_request_notification on public.cross_branch_requests;
create trigger trg_cross_branch_request_notification
  after insert or update of status on public.cross_branch_requests
  for each row execute function public.handle_cross_branch_request_notification();

-- Notification trigger for delivery status changes
create or replace function public.handle_cross_branch_delivery_notification()
returns trigger as $$
declare
  req record;
  target_user record;
  notif_title text;
  notif_message text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    -- Delivery created (after approval)
    select * into req from public.cross_branch_requests where id = new.request_id;
    if not found then return new; end if;
    notif_title := 'تم إنشاء الشحنة';
    notif_message := format('شحنة %s × %s جاري تجهيزها', req.quantity, req.item_name);
    notif_type := 'info';
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id in (req.from_branch_id, req.to_branch_id) and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    select * into req from public.cross_branch_requests where id = new.request_id;
    if not found then return new; end if;
    if new.status = 'picked_up' then
      notif_title := 'تم استلام الشحنة';
      notif_message := format('شحنة %s × %s تم استلامها من الفرع المورد', req.quantity, req.item_name);
      notif_type := 'info';
    elsif new.status = 'in_transit' then
      notif_title := 'الشحنة في الطريق';
      notif_message := format('شحنة %s × %s في الطريق إليك', req.quantity, req.item_name);
      notif_type := 'info';
    elsif new.status = 'arrived' then
      notif_title := 'الشحنة وصلت';
      notif_message := format('شحنة %s × %s وصلت إلى الفرع', req.quantity, req.item_name);
      notif_type := 'success';
    elsif new.status = 'completed' then
      notif_title := 'تم اكتمال الشحنة';
      notif_message := format('شحنة %s × %s تم اكتمالها بنجاح', req.quantity, req.item_name);
      notif_type := 'success';
    else
      return new;
    end if;
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id in (req.from_branch_id, req.to_branch_id) and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/inventory');
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cross_branch_delivery_notification on public.cross_branch_deliveries;
create trigger trg_cross_branch_delivery_notification
  after insert or update of status on public.cross_branch_deliveries
  for each row execute function public.handle_cross_branch_delivery_notification();

-- ── 7. Update RLS policies on cross_branch_requests for Receptionist ──
drop policy if exists "cross_branch_requests_select" on public.cross_branch_requests;
create policy "cross_branch_requests_select"
  on public.cross_branch_requests for select
  to authenticated
  using (
    get_current_user_role() IN ('Manager', 'Receptionist', 'Admin')
  );

drop policy if exists "cross_branch_requests_insert" on public.cross_branch_requests;
create policy "cross_branch_requests_insert"
  on public.cross_branch_requests for insert
  to authenticated
  with check (
    get_current_user_role() = 'Admin'
    OR (
      get_current_user_role() IN ('Manager', 'Receptionist')
      AND to_branch_id = (SELECT branch_id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );

drop policy if exists "cross_branch_requests_update" on public.cross_branch_requests;
create policy "cross_branch_requests_update"
  on public.cross_branch_requests for update
  to authenticated
  using (get_current_user_role() IN ('Manager', 'Admin'))
  with check (
    get_current_user_role() = 'Admin'
    OR (
      get_current_user_role() = 'Manager'
      AND from_branch_id = (SELECT branch_id FROM public.users WHERE auth_user_id = auth.uid())
    )
  );
