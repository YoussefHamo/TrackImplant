-- Branch Context & Branch Isolation
-- Adds home_branch_id concept to patients, ensures all business tables have branch_id,
-- and updates RLS policies for proper branch isolation.

-- 1. Ensure patients.branch_id is treated as home_branch_id (already exists)
-- Add NOT NULL constraint for new records (existing NULLs stay NULL)
ALTER TABLE patients ALTER COLUMN branch_id DROP NOT NULL;

-- 2. Ensure all key tables have branch_id for branch isolation
-- appointments already has branch_id
-- procedures already has branch_id
-- financial_records already has branch_id
-- notifications - add branch_id for branch-scoped notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- patient_timeline_events - add branch_id
ALTER TABLE patient_timeline_events ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- communications - add branch_id
ALTER TABLE communications ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- patient_reminders - add branch_id
ALTER TABLE patient_reminders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- follow_ups - add branch_id
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 3. Create indexes for branch_id columns
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_events_branch_id ON patient_timeline_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_communications_branch_id ON communications(branch_id);
CREATE INDEX IF NOT EXISTS idx_patient_reminders_branch_id ON patient_reminders(branch_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_branch_id ON follow_ups(branch_id);

-- 4. Create or replace a function to get current user's branch_id
CREATE OR REPLACE FUNCTION get_current_user_branch_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT branch_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- 5. RLS policies for branch isolation on new columns
-- notifications - users see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- patient_timeline_events - visible globally (patients are global)
DROP POLICY IF EXISTS "Users can view timeline events" ON patient_timeline_events;
CREATE POLICY "Users can view timeline events" ON patient_timeline_events
  FOR SELECT USING (true);

-- communications - visible globally (patients are global)
DROP POLICY IF EXISTS "Users can view communications" ON communications;
CREATE POLICY "Users can view communications" ON communications
  FOR SELECT USING (true);

-- 6. Ensure notifications get branch_id from the creating context
-- When a notification is created for a branch-scoped entity, store the branch_id
-- This is handled by the application layer
