-- Fix unique constraints to include branch_id so each branch
-- can have their own copy of the same item type.

-- implant_inventory
alter table public.implant_inventory drop constraint if exists implant_inventory_brand_size_key;
alter table public.implant_inventory add constraint implant_inventory_branch_brand_size unique (branch_id, brand, size);

-- abutment_inventory
alter table public.abutment_inventory drop constraint if exists abutment_inventory_type_key;
alter table public.abutment_inventory add constraint abutment_inventory_branch_type unique (branch_id, type);
