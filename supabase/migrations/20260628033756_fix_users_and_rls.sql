-- Fix: users table CHECK constraint, trigger, and RLS policies
-- 1. Fix CHECK constraint on users.role to include Manager, Assistant
-- 2. Update handle_new_user() trigger to include branch_id
-- 3. Fix RLS policies for Manager role
-- 4. Insert missing public.users records for existing auth users

-- 1. Drop old CHECK constraint and recreate with all roles
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('Manager', 'Admin', 'Doctor', 'Receptionist', 'Assistant'));

-- 2. Recreate the trigger function to include branch_id and all roles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (auth_user_id, username, full_name, email, role, branch_id, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'User'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'Doctor'),
    (new.raw_user_meta_data ->> 'branch_id')::uuid,
    true
  )
  on conflict (auth_user_id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    branch_id = excluded.branch_id;
  return new;
end;
$$ language plpgsql security definer;

-- 3. Recreate users table RLS policies for Manager + get_current_user_role
drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin"
  on public.users for select
  to authenticated
  using (
    get_current_user_role() IN ('Manager', 'Admin')
    OR auth.uid() = auth_user_id
  );

drop policy if exists "users_insert_admin" on public.users;
create policy "users_insert_admin"
  on public.users for insert
  to authenticated
  with check (get_current_user_role() IN ('Manager', 'Admin'));

drop policy if exists "users_update_admin" on public.users;
create policy "users_update_admin"
  on public.users for update
  to authenticated
  using (get_current_user_role() IN ('Manager', 'Admin'));

drop policy if exists "users_delete_admin" on public.users;
create policy "users_delete_admin"
  on public.users for delete
  to authenticated
  using (get_current_user_role() IN ('Manager', 'Admin'));

-- 5. Ensure branches exist (idempotent)
insert into public.branches (name) values
  ('سيدي بشر'),
  ('محرم بك'),
  ('الإبراهيمية'),
  ('العجمي'),
  ('أبو يوسف'),
  ('محطة الرمل'),
  ('سموحة')
on conflict (name) do nothing;
