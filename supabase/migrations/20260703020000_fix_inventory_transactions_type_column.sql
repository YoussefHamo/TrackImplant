-- Ensure inventory_transactions has both `type` and `operation_type` columns.
-- The app uses both, but the initial schema may be missing `type`.

alter table public.inventory_transactions add column if not exists type text;
alter table public.inventory_transactions add column if not exists operation_type text;

-- Set defaults for existing null rows
update public.inventory_transactions set type = 'add' where type is null;
update public.inventory_transactions set operation_type = 'adjust' where operation_type is null;

-- Make them not null going forward
alter table public.inventory_transactions alter column type set not null;
alter table public.inventory_transactions alter column operation_type set not null;
