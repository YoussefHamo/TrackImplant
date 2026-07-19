-- RPC for email-based is_active lookup during login
-- SECURITY DEFINER bypasses RLS so unauthenticated users can check
-- their account status before attempting sign-in.
create or replace function public.get_user_by_email(lookup_email text)
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
  where lower(u.email) = lower(lookup_email)
  limit 1;
$$;

grant execute on function public.get_user_by_email(text) to anon, authenticated;
