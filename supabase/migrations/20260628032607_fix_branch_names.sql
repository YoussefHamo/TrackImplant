-- Fix corrupted Arabic branch names
delete from public.branch_inventory;
delete from public.inventory_deliveries;
delete from public.inventory_returns;
delete from public.branches;
insert into public.branches (name) values
  ('سيدي بشر'),
  ('محرم بك'),
  ('الإبراهيمية'),
  ('العجمي'),
  ('أبو يوسف'),
  ('محطة الرمل'),
  ('سموحة');
