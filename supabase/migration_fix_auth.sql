-- =============================================================
-- Migration: Fix Authentication Issues
-- 1. RPC for public username lookup (bypasses RLS for login)
-- 2. RPC for admin to confirm a newly created auth user
-- =============================================================

-- 1. Public function: look up a user by username (for login flow)
--    SECURITY DEFINER bypasses RLS so unauthenticated users can
--    resolve their username to an email address before signing in.
create or replace function public.get_user_email_by_username(lookup_username text)
returns table (
  id uuid,
  username text,
  email text,
  is_active boolean
)
language sql
security definer
stable
as $$
  select u.id, u.username, u.email, u.is_active
  from public.users u
  where u.username = lookup_username
  limit 1;
$$;

grant execute on function public.get_user_email_by_username(text) to anon, authenticated;

-- 2. Admin function: confirm a user's email immediately after signUp
--    Called by authenticated admins right after creating a user via signUp.
--    This sets email_confirmed_at so the user can sign in without
--    clicking a confirmation link.
create or replace function public.confirm_auth_user(target_auth_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  update auth.users
  set
    email_confirmed_at = now(),
    confirmation_sent_at = now(),
    confirmed_at = now(),
    last_sign_in_at = now(),
    updated_at = now()
  where id = target_auth_user_id;

  return found;
end;
$$;

grant execute on function public.confirm_auth_user(uuid) to authenticated;
