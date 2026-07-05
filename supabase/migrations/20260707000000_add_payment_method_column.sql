alter table public.financial_records
  add column if not exists payment_method text default null;
