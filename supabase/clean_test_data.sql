-- ═══════════════════════════════════════════════════════════════
-- TrackImplant — Clean All Test Data
-- ═══════════════════════════════════════════════════════════════
-- Preserves: users (admins/doctors/managers), branches, auth.users
-- Resets: inventory_items quantities to 0
-- Deletes everything else (patients, appointments, procedures, etc.)
-- Run this in Supabase Dashboard SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. DISABLE TRIGGERS (prevents notification/audit errors during bulk delete) ──

ALTER TABLE appointments DISABLE TRIGGER ALL;
ALTER TABLE procedures DISABLE TRIGGER ALL;
ALTER TABLE financial_records DISABLE TRIGGER ALL;
ALTER TABLE inventory_returns DISABLE TRIGGER ALL;
ALTER TABLE inventory_count_sessions DISABLE TRIGGER ALL;
ALTER TABLE cross_branch_requests DISABLE TRIGGER ALL;
ALTER TABLE cross_branch_deliveries DISABLE TRIGGER ALL;
ALTER TABLE notifications DISABLE TRIGGER ALL;

-- ── 2. DELETE CHILD TABLES FIRST (FK order) ──

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

-- ── 3. DELETE CORE BUSINESS TABLES ──

DELETE FROM financial_records;
DELETE FROM appointments;
DELETE FROM procedures;
DELETE FROM patients;

-- ── 4. RESET INVENTORY ──

-- Zero out quantities but keep all item definitions (brands, sizes, categories)
UPDATE inventory_items SET quantity = 0, reserved = 0, used = 0;

-- Delete legacy inventory tables (all data)
DELETE FROM implant_inventory;
DELETE FROM abutment_inventory;

-- ── 5. RE-ENABLE TRIGGERS ──

ALTER TABLE appointments ENABLE TRIGGER ALL;
ALTER TABLE procedures ENABLE TRIGGER ALL;
ALTER TABLE financial_records ENABLE TRIGGER ALL;
ALTER TABLE inventory_returns ENABLE TRIGGER ALL;
ALTER TABLE inventory_count_sessions ENABLE TRIGGER ALL;
ALTER TABLE cross_branch_requests ENABLE TRIGGER ALL;
ALTER TABLE cross_branch_deliveries ENABLE TRIGGER ALL;
ALTER TABLE notifications ENABLE TRIGGER ALL;

-- ── 6. VERIFY ──

SELECT 'patients' AS table_name, COUNT(*) AS remaining FROM patients
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'procedures', COUNT(*) FROM procedures
UNION ALL
SELECT 'financial_records', COUNT(*) FROM financial_records
UNION ALL
SELECT 'inventory_items_with_stock', COUNT(*) FROM inventory_items WHERE quantity > 0
UNION ALL
SELECT 'users_preserved', COUNT(*) FROM users
UNION ALL
SELECT 'branches_preserved', COUNT(*) FROM branches
ORDER BY table_name;
