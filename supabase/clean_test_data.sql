-- ═══════════════════════════════════════════════════════════════
-- TrackImplant — Clean All Test Data (v2 - TRUNCATE CASCADE)
-- ═══════════════════════════════════════════════════════════════
-- Preserves: users, branches, inventory_items (structure only)
-- Run this in Supabase Dashboard SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. DELETE DATA (FROM CHILDREN TO PARENTS) ──

DELETE FROM inventory_count_items;
DELETE FROM inventory_count_sessions;
DELETE FROM procedure_kit_items;
DELETE FROM procedure_kits;
DELETE FROM procedure_doctors;
DELETE FROM cross_branch_deliveries;
DELETE FROM cross_branch_requests;
DELETE FROM stock_requests;
DELETE FROM inventory_transactions;
DELETE FROM inventory_returns;
DELETE FROM inventory_deliveries;
DELETE FROM branch_inventory;
DELETE FROM implant_forms;
DELETE FROM patient_timeline_events;
DELETE FROM patient_reminders;
DELETE FROM patient_files;
DELETE FROM communications;
DELETE FROM follow_ups;
DELETE FROM doctor_schedules;
DELETE FROM notification_preferences;
DELETE FROM notifications;
DELETE FROM audit_logs;
DELETE FROM financial_records;
DELETE FROM appointments;
DELETE FROM procedures;
DELETE FROM patients;

-- ── 2. RESET INVENTORY ──

UPDATE inventory_items SET quantity = 0, reserved = 0, used = 0;
DELETE FROM implant_inventory;
DELETE FROM abutment_inventory;

-- ── 3. VERIFY ──

SELECT 'users_preserved' AS table_name, COUNT(*) AS rows FROM users
UNION ALL
SELECT 'branches_preserved', COUNT(*) FROM branches
UNION ALL
SELECT 'patients', COUNT(*) FROM patients
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'procedures', COUNT(*) FROM procedures
UNION ALL
SELECT 'financial_records', COUNT(*) FROM financial_records
UNION ALL
SELECT 'inventory_items_kept', COUNT(*) FROM inventory_items
UNION ALL
SELECT 'inventory_with_stock', COUNT(*) FROM inventory_items WHERE quantity > 0;
