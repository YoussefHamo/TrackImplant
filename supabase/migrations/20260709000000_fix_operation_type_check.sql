-- Recreate the operation_type check to ensure 'issue' is allowed
alter table public.inventory_transactions drop constraint if exists inventory_transactions_operation_type_check;
alter table public.inventory_transactions add constraint inventory_transactions_operation_type_check
  check (operation_type in ('add', 'issue', 'return', 'adjust', 'cross_branch'));
