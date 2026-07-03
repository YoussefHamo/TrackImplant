-- ═══════════════════════════════════════════════════════════════
-- TrackImplant Phase 2 — Enterprise Upgrade
-- ═══════════════════════════════════════════════════════════════
-- 1. Procedure Kits
-- 2. Inventory Returns (extend)
-- 3. Inventory Count
-- 4. Communications (CRM)
-- 5. Patient Reminders
-- 6. Audit Logs (extend)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. PROCEDURE KITS ──────────────────────────────────────────

create table if not exists public.procedure_kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  branch_id uuid references public.branches(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.procedure_kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.procedure_kits(id) on delete cascade,
  category text not null check (category in ('implant', 'abutment', 'prosthetic', 'material')),
  subcategory text,
  brand text,
  size text,
  name text,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz default now()
);

-- Add kit tracking to procedures
alter table public.procedures add column if not exists kit_id uuid references public.procedure_kits(id) on delete set null;
alter table public.procedures add column if not exists kit_snapshot jsonb;

-- RLS for procedure_kits
alter table public.procedure_kits enable row level security;
alter table public.procedure_kit_items enable row level security;

create policy "procedure_kits_select" on public.procedure_kits for select
  to authenticated using (
    get_current_user_role() IN ('Manager', 'Admin')
    OR branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "procedure_kits_insert" on public.procedure_kits for insert
  to authenticated with check (get_current_user_role() IN ('Manager', 'Admin'));
create policy "procedure_kits_update" on public.procedure_kits for update
  to authenticated using (get_current_user_role() IN ('Manager', 'Admin'));
create policy "procedure_kits_delete" on public.procedure_kits for delete
  to authenticated using (get_current_user_role() = 'Admin');

create policy "procedure_kit_items_select" on public.procedure_kit_items for select
  to authenticated using (
    exists (select 1 from public.procedure_kits k where k.id = kit_id)
  );
create policy "procedure_kit_items_insert" on public.procedure_kit_items for insert
  to authenticated with check (get_current_user_role() IN ('Manager', 'Admin'));
create policy "procedure_kit_items_update" on public.procedure_kit_items for update
  to authenticated using (get_current_user_role() IN ('Manager', 'Admin'));
create policy "procedure_kit_items_delete" on public.procedure_kit_items for delete
  to authenticated using (get_current_user_role() = 'Admin');

-- ── 2. INVENTORY RETURNS (extend) ───────────────────────────────

alter table public.inventory_returns add column if not exists status text
  default 'pending' check (status in ('pending', 'approved', 'rejected'));
alter table public.inventory_returns add column if not exists reviewed_by uuid
  references public.users(auth_user_id) on delete set null;
alter table public.inventory_returns add column if not exists reviewed_at timestamptz;
alter table public.inventory_returns add column if not exists branch_id uuid
  references public.branches(id) on delete set null;
alter table public.inventory_returns add column if not exists created_by uuid
  references public.users(auth_user_id) on delete set null;
alter table public.inventory_returns add column if not exists updated_at timestamptz default now();

alter table public.inventory_returns drop constraint if exists inventory_returns_reason_check;
alter table public.inventory_returns add constraint inventory_returns_reason_check
  check (reason in ('wrong_item', 'damaged', 'expired', 'cancelled_procedure', 'cross_branch_return', 'supplier_return', 'other'));

create index if not exists idx_inventory_returns_status on public.inventory_returns(status);
create index if not exists idx_inventory_returns_branch on public.inventory_returns(branch_id);

-- RLS for extended returns
drop policy if exists "inventory_returns_select" on public.inventory_returns;
create policy "inventory_returns_select" on public.inventory_returns for select
  to authenticated using (
    get_current_user_role() = 'Admin'
    OR branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

drop policy if exists "inventory_returns_insert" on public.inventory_returns;
create policy "inventory_returns_insert" on public.inventory_returns for insert
  to authenticated with check (
    get_current_user_role() IN ('Receptionist', 'Manager', 'Admin')
  );

drop policy if exists "inventory_returns_update" on public.inventory_returns;
create policy "inventory_returns_update" on public.inventory_returns for update
  to authenticated using (
    get_current_user_role() = 'Admin'
    OR (
      get_current_user_role() = 'Manager'
      AND branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );

drop policy if exists "inventory_returns_delete" on public.inventory_returns;
create policy "inventory_returns_delete" on public.inventory_returns for delete
  to authenticated using (get_current_user_role() = 'Admin');

-- Returns notification trigger
create or replace function public.handle_return_notification()
returns trigger as $$
declare
  target_user record;
begin
  if tg_op = 'INSERT' then
    -- Notify managers of the return branch
    for target_user in
      select auth_user_id from public.users
      where role = 'Manager' and branch_id = new.branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, 'طلب إرجاع جديد',
        format('تم تقديم طلب إرجاع %s × %s', new.quantity, new.item_name),
        'info', '/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    if new.status = 'approved' then
      for target_user in
        select auth_user_id from public.users
        where role in ('Manager', 'Receptionist') and branch_id = new.branch_id and is_active = true
      loop
        insert into public.notifications (user_id, title, message, type, link)
        values (target_user.auth_user_id, 'تم الموافقة على الإرجاع',
          format('تمت الموافقة على إرجاع %s × %s', new.quantity, new.item_name),
          'success', '/inventory');
      end loop;
    elsif new.status = 'rejected' then
      for target_user in
        select auth_user_id from public.users
        where role in ('Manager', 'Receptionist') and branch_id = new.branch_id and is_active = true
      loop
        insert into public.notifications (user_id, title, message, type, link)
        values (target_user.auth_user_id, 'تم رفض الإرجاع',
          format('تم رفض إرجاع %s × %s', new.quantity, new.item_name),
          'warning', '/inventory');
      end loop;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_return_notification on public.inventory_returns;
create trigger trg_return_notification
  after insert or update of status on public.inventory_returns
  for each row execute function public.handle_return_notification();

-- Auto-adjust inventory on approved returns
create or replace function public.handle_return_approval()
returns trigger as $$
begin
  if new.status = 'approved' and (old is null or old.status != 'approved') then
    -- Find the inventory item and add quantity back
    update public.inventory_items
    set quantity = quantity + new.quantity, updated_at = now()
    where id = new.item_id and branch_id = new.branch_id;

    -- Record transaction
    insert into public.inventory_transactions (
      item_type, item_id, type, operation_type, quantity,
      item_category, item_name, notes
    ) values (
      coalesce((select category from public.inventory_items where id = new.item_id), 'implant'),
      new.item_id, 'add', 'return', new.quantity,
      (select category from public.inventory_items where id = new.item_id), new.item_name,
      format('Return approved: %s', new.reason)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_return_approval on public.inventory_returns;
create trigger trg_return_approval
  after insert or update of status on public.inventory_returns
  for each row execute function public.handle_return_approval();

-- ── 3. INVENTORY COUNT ─────────────────────────────────────────

create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'approved')),
  notes text,
  created_by uuid references public.users(auth_user_id) on delete set null,
  approved_by uuid references public.users(auth_user_id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_count_sessions(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  system_quantity int not null,
  actual_quantity int not null,
  difference int generated always as (actual_quantity - system_quantity) stored,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_count_sessions_branch on public.inventory_count_sessions(branch_id);
create unique index if not exists idx_count_items_session_item on public.inventory_count_items(session_id, item_id);

alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_items enable row level security;

-- RLS for count sessions
create policy "count_sessions_select" on public.inventory_count_sessions for select
  to authenticated using (
    get_current_user_role() = 'Admin'
    OR branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "count_sessions_insert" on public.inventory_count_sessions for insert
  to authenticated with check (get_current_user_role() IN ('Manager', 'Admin'));
create policy "count_sessions_update" on public.inventory_count_sessions for update
  to authenticated using (get_current_user_role() IN ('Manager', 'Admin'));
create policy "count_sessions_delete" on public.inventory_count_sessions for delete
  to authenticated using (get_current_user_role() = 'Admin');

-- RLS for count items (inherit from session)
create policy "count_items_select" on public.inventory_count_items for select
  to authenticated using (
    exists (select 1 from public.inventory_count_sessions s
      where s.id = session_id and (
        s.branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
        OR get_current_user_role() = 'Admin'
      ))
  );
create policy "count_items_insert" on public.inventory_count_items for insert
  to authenticated with check (
    exists (select 1 from public.inventory_count_sessions s
      where s.id = session_id and get_current_user_role() IN ('Manager', 'Admin'))
  );
create policy "count_items_update" on public.inventory_count_items for update
  to authenticated using (
    exists (select 1 from public.inventory_count_sessions s
      where s.id = session_id and get_current_user_role() IN ('Manager', 'Admin'))
  );
create policy "count_items_delete" on public.inventory_count_items for delete
  to authenticated using (
    exists (select 1 from public.inventory_count_sessions s
      where s.id = session_id and get_current_user_role() = 'Admin')
  );

-- Auto-adjust inventory on approved count session
create or replace function public.handle_count_session_approval()
returns trigger as $$
declare
  count_item record;
begin
  if new.status = 'approved' and (old is null or old.status != 'approved') then
    for count_item in
      select ci.* from public.inventory_count_items ci
      where ci.session_id = new.id and ci.difference != 0
    loop
      -- Adjust inventory
      update public.inventory_items
      set quantity = count_item.actual_quantity, updated_at = now()
      where id = count_item.item_id;

      -- Record transaction
      insert into public.inventory_transactions (
        item_type, item_id, type, operation_type, quantity,
        item_category, item_name, notes
      ) values (
        case when (select category from public.inventory_items where id = count_item.item_id) = 'implant' then 'implant' else 'abutment' end,
        count_item.item_id,
        case when count_item.difference > 0 then 'add' else 'deduct' end,
        'adjust', abs(count_item.difference),
        (select category from public.inventory_items where id = count_item.item_id),
        (select name from public.inventory_items where id = count_item.item_id),
        format('Inventory count adjustment (session %s): %s', new.id, count_item.reason)
      );
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_count_session_approval on public.inventory_count_sessions;
create trigger trg_count_session_approval
  after update of status on public.inventory_count_sessions
  for each row execute function public.handle_count_session_approval();

-- ── 4. COMMUNICATIONS (CRM) ────────────────────────────────────

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  type text not null check (type in ('call', 'whatsapp', 'sms', 'email', 'note', 'clinic_note')),
  direction text not null check (direction in ('inbound', 'outbound')) default 'outbound',
  subject text,
  content text,
  staff_id uuid references public.users(auth_user_id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_communications_patient on public.communications(patient_id);
create index if not exists idx_communications_created on public.communications(created_at desc);

alter table public.communications enable row level security;

create policy "communications_select" on public.communications for select
  to authenticated using (
    get_current_user_role() IN ('Admin', 'Doctor', 'Manager', 'Receptionist')
  );
create policy "communications_insert" on public.communications for insert
  to authenticated with check (
    get_current_user_role() IN ('Admin', 'Doctor', 'Manager', 'Receptionist')
  );
create policy "communications_update" on public.communications for update
  to authenticated using (get_current_user_role() IN ('Admin', 'Manager'));
create policy "communications_delete" on public.communications for delete
  to authenticated using (get_current_user_role() = 'Admin');

-- ── 5. PATIENT REMINDERS ───────────────────────────────────────

create table if not exists public.patient_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('birthday', 'recall', 'missed_appointment', 'follow_up', 'custom')),
  title text not null,
  message text,
  scheduled_for date not null,
  sent_at timestamptz,
  created_by uuid references public.users(auth_user_id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_reminders_patient on public.patient_reminders(patient_id);
create index if not exists idx_reminders_scheduled on public.patient_reminders(scheduled_for);
create index if not exists idx_reminders_sent on public.patient_reminders(sent_at);

alter table public.patient_reminders enable row level security;

create policy "reminders_select" on public.patient_reminders for select
  to authenticated using (
    get_current_user_role() IN ('Admin', 'Doctor', 'Manager', 'Receptionist')
  );
create policy "reminders_insert" on public.patient_reminders for insert
  to authenticated with check (
    get_current_user_role() IN ('Admin', 'Doctor', 'Manager', 'Receptionist')
  );
create policy "reminders_update" on public.patient_reminders for update
  to authenticated using (get_current_user_role() IN ('Admin', 'Manager'));
create policy "reminders_delete" on public.patient_reminders for delete
  to authenticated using (get_current_user_role() = 'Admin');

-- ── 6. AUDIT LOGS (extend) ─────────────────────────────────────

alter table public.audit_logs add column if not exists role text;
alter table public.audit_logs add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.audit_logs add column if not exists ip_address text;
alter table public.audit_logs add column if not exists user_agent text;
alter table public.audit_logs add column if not exists os text;
alter table public.audit_logs add column if not exists session_id text;

create index if not exists idx_audit_logs_role on public.audit_logs(role);
create index if not exists idx_audit_logs_branch on public.audit_logs(branch_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_table on public.audit_logs(table_name);
