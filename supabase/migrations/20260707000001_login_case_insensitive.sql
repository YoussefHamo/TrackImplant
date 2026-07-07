-- Make username lookup case-insensitive during login
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
  where lower(u.username) = lower(lookup_username)
  limit 1;
$$;
