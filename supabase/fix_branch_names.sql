--- Fix: Delete corrupted branch data and re-insert with correct Arabic names
-- Run this in the Supabase SQL editor

-- First, clear any corrupted branch data
delete from public.branch_inventory;
delete from public.inventory_deliveries;
delete from public.inventory_returns;
delete from public.branches;

-- Re-insert with correct UTF-8 Arabic names
insert into public.branches (name) values
  ('سيدي بشر'),
  ('محرم بك'),
  ('الإبراهيمية'),
  ('العجمي'),
  ('أبو يوسف'),
  ('محطة الرمل'),
  ('سموحة');
