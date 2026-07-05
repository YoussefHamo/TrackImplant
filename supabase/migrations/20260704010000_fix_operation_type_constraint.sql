-- Fix inventory_transactions operation_type CHECK constraint
-- Ensure all values used by the application are allowed

alter table public.inventory_transactions drop constraint if exists inventory_transactions_operation_type_check;

alter table public.inventory_transactions add constraint inventory_transactions_operation_type_check
  check (operation_type in ('add', 'issue', 'return', 'adjust', 'cross_branch'));
