-- Seed: ensure every branch has a row for every distinct product variant.
-- Any missing (branch, variant) combo gets inserted with quantity = 0.
-- A product variant is uniquely identified by (category, subcategory, name, brand, size, unit).

-- 1. Gather all distinct product variants that exist anywhere
-- 2. Cross-join with all active branches
-- 3. Insert rows that don't already exist (qty = 0, reserved = 0, used = 0)

insert into public.inventory_items (branch_id, category, subcategory, name, brand, size, unit, quantity, reserved, used, minimum_stock)
select
  b.id,
  v.category,
  v.subcategory,
  v.name,
  v.brand,
  v.size,
  v.unit,
  0, 0, 0, 0
from (
  select distinct category, subcategory, name, brand, size, unit
  from public.inventory_items
  where category is not null
) v
cross join public.branches b
where b.is_active = true
  and not exists (
    select 1 from public.inventory_items existing
    where existing.branch_id = b.id
      and existing.category = v.category
      and coalesce(existing.subcategory, '') = coalesce(v.subcategory, '')
      and coalesce(existing.name, '') = coalesce(v.name, '')
      and coalesce(existing.brand, '') = coalesce(v.brand, '')
      and coalesce(existing.size, '') = coalesce(v.size, '')
      and coalesce(existing.unit, '') = coalesce(v.unit, '')
  );

-- If there are branches with NO items at all (brand new branch), create empty seed rows
-- using the first branch's items as a template
insert into public.inventory_items (branch_id, category, subcategory, name, brand, size, unit, quantity, reserved, used, minimum_stock)
select
  b.id,
  ref.category,
  ref.subcategory,
  ref.name,
  ref.brand,
  ref.size,
  ref.unit,
  0, 0, 0, 0
from public.branches b
cross join (
  select distinct category, subcategory, name, brand, size, unit
  from public.inventory_items
  where branch_id = (select id from public.branches where is_active = true limit 1)
) ref
where b.is_active = true
  and not exists (
    select 1 from public.inventory_items existing
    where existing.branch_id = b.id
  );
