-- SECURITY DEFINER function so branch managers can see another branch's items
-- when creating a cross-branch request.  The function itself has no row-level
-- security barrier, effectively bypassing RLS for this specific read.
create or replace function public.get_branch_inventory_items(p_branch_id uuid)
returns setof public.inventory_items
language sql
stable
security definer
set search_path = public
as $$
  select * from public.inventory_items where branch_id = p_branch_id order by category, name;
$$;
