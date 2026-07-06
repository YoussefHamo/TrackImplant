-- Drop the operation_type CHECK constraint — it was blocking valid values
-- The application already validates operation_type values
alter table public.inventory_transactions drop constraint if exists inventory_transactions_operation_type_check;
