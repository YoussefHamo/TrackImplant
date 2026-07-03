-- Consolidate all inventory to Sidi Bishr branch
-- 1. Sync implant_inventory → inventory_items (category='implant')
-- 2. Sync abutment_inventory → inventory_items (category='abutment')
-- 3. Create/update branch_inventory entries for ALL inventory_items at Sidi Bishr
-- 4. Remove branch_inventory entries for other branches

do $$
declare
  sidi_bishr_id uuid;
  rec record;
  existing_id uuid;
begin
  select id into sidi_bishr_id from public.branches where name = 'سيدي بشر';
  if sidi_bishr_id is null then
    raise exception 'Branch "سيدي بشر" not found';
  end if;

  -- 1. Sync implant_inventory → inventory_items
  for rec in select id, brand, size, quantity, coalesce(reserved,0) as reserved, coalesce(used,0) as used from public.implant_inventory loop
    existing_id := null;
    select id into existing_id from public.inventory_items
      where category = 'implant' and brand = rec.brand and size = rec.size;
    if existing_id is not null then
      update public.inventory_items set
        quantity = rec.quantity,
        reserved = rec.reserved,
        used = rec.used,
        updated_at = now()
      where id = existing_id;
    else
      insert into public.inventory_items (category, name, brand, size, quantity, reserved, used)
      values ('implant', rec.brand || ' ' || rec.size, rec.brand, rec.size, rec.quantity, rec.reserved, rec.used);
    end if;
  end loop;

  -- 2. Sync abutment_inventory → inventory_items
  for rec in select id, type, quantity, coalesce(reserved,0) as reserved, coalesce(used,0) as used from public.abutment_inventory loop
    existing_id := null;
    select id into existing_id from public.inventory_items
      where category = 'abutment' and subcategory = rec.type;
    if existing_id is not null then
      update public.inventory_items set
        quantity = rec.quantity,
        reserved = rec.reserved,
        used = rec.used,
        updated_at = now()
      where id = existing_id;
    else
      insert into public.inventory_items (category, name, subcategory, quantity, reserved, used)
      values ('abutment', rec.type, rec.type, rec.quantity, rec.reserved, rec.used);
    end if;
  end loop;

  -- 3. Create/update branch_inventory for ALL inventory_items at Sidi Bishr
  for rec in select id, quantity, reserved from public.inventory_items loop
    insert into public.branch_inventory (branch_id, item_id, quantity, reserved)
    values (sidi_bishr_id, rec.id, rec.quantity, rec.reserved)
    on conflict (branch_id, item_id) do update set
      quantity = excluded.quantity,
      reserved = excluded.reserved,
      updated_at = now();
  end loop;

  -- 4. Remove branch_inventory entries for branches other than Sidi Bishr
  delete from public.branch_inventory where branch_id != sidi_bishr_id;

  raise notice 'Consolidation complete. All inventory assigned to Sidi Bishr (id: %)', sidi_bishr_id;
end;
$$;
