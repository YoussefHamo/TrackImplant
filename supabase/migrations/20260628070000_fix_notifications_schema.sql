-- Fix notifications table: add missing columns and proper RLS policies
-- Root cause: table was created without user_id, type, and link columns,
-- causing PostgREST 400 when frontend queried non-existent columns.

-- 1. Add missing columns
alter table public.notifications add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.notifications add column if not exists type text not null default 'info' check (type in ('info', 'warning', 'critical', 'success'));
alter table public.notifications add column if not exists link text;

-- 2. Make existing nullable columns NOT NULL (table is empty so this is safe)
alter table public.notifications alter column title set not null;
alter table public.notifications alter column message set not null;
alter table public.notifications alter column is_read set not null;
alter table public.notifications alter column user_id set not null;

-- 3. Drop the permissive catch-all policy
drop policy if exists "full access notifications" on public.notifications;

-- 4. Create proper RLS policies matching src/lib/schema.sql
create policy "Notifications select"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid() or auth.jwt() ->> 'role' = 'Admin');

create policy "Notifications insert"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Notifications update"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid() or auth.jwt() ->> 'role' = 'Admin');

-- 5. Create indexes for performance
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(is_read);
create index if not exists idx_notifications_created on public.notifications(created_at);

-- 6. Ensure RLS is enabled
alter table public.notifications enable row level security;
