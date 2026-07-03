-- Fix: cross_branch_requests.requested_by and responded_by FK reference users(id)
-- but the app sends auth.users.id (the id from supabase.auth.getUser()).
-- public.users.id != auth.users.id, so the FK violates.
-- Fix: point FK to users(auth_user_id) which stores auth.users.id.

alter table public.cross_branch_requests
  drop constraint if exists cross_branch_requests_requested_by_fkey,
  add constraint cross_branch_requests_requested_by_fkey
    foreign key (requested_by) references public.users(auth_user_id) on delete set null;

alter table public.cross_branch_requests
  drop constraint if exists cross_branch_requests_responded_by_fkey,
  add constraint cross_branch_requests_responded_by_fkey
    foreign key (responded_by) references public.users(auth_user_id) on delete set null;
