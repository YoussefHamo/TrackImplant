-- Fix Schema Completion
-- 
-- 1. Add FK appointments.doctor_id → users(auth_user_id) (was missing — PostgREST embeds require FKs)
-- 2. Add missing Phase 3 columns on appointments
-- 3. Create patient_timeline_events table
-- 4. Create notification_preferences table
-- 5. Add missing columns on notifications
-- 6. Add branch_id on communications (missed in Phase 4)

-- -- 1. FK APPOINTMENTS.DOCTOR_ID → USERS --

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'appointments'
      AND kcu.column_name = 'doctor_id'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT fk_appointments_doctor_id
      FOREIGN KEY (doctor_id) REFERENCES users(auth_user_id) ON DELETE SET NULL;
  END IF;
END
$$;

-- -- 2. APPOINTMENT ADDITIONAL COLUMNS (Phase 3) --

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS waiting_time_minutes int,
  ADD COLUMN IF NOT EXISTS treatment_time_minutes int,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'appointments'
      AND kcu.column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT fk_appointments_cancelled_by
      FOREIGN KEY (cancelled_by) REFERENCES users(auth_user_id) ON DELETE SET NULL;
  END IF;
END
$$;

-- -- 3. NOTIFICATIONS ADDITIONAL COLUMNS (Phase 3 + Phase 4) --

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text default 'general',
  ADD COLUMN IF NOT EXISTS related_entity_type text,
  ADD COLUMN IF NOT EXISTS related_entity_id text,
  ADD COLUMN IF NOT EXISTS branch_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON notifications(branch_id);

-- -- 4. COMMUNICATIONS BRANCH_ID (Phase 4, missed) --

ALTER TABLE communications ADD COLUMN IF NOT EXISTS branch_id uuid;
CREATE INDEX IF NOT EXISTS idx_communications_branch_id ON communications(branch_id);

-- -- 5. PATIENT TIMELINE EVENTS TABLE (Phase 3) --

CREATE TABLE IF NOT EXISTS public.patient_timeline_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  event_type text not null,
  description text,
  user_id uuid references public.users(auth_user_id) on delete set null,
  user_name text,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  related_entity_type text,
  related_entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

ALTER TABLE public.patient_timeline_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Timeline events select' AND tablename = 'patient_timeline_events') THEN
    CREATE POLICY "Timeline events select" ON public.patient_timeline_events
      FOR SELECT USING (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Timeline events insert' AND tablename = 'patient_timeline_events') THEN
    CREATE POLICY "Timeline events insert" ON public.patient_timeline_events
      FOR INSERT WITH CHECK (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant'));
  END IF;
END
$$;

GRANT ALL ON public.patient_timeline_events TO authenticated;

CREATE INDEX IF NOT EXISTS idx_timeline_patient ON public.patient_timeline_events(patient_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_timeline_type ON public.patient_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_events_branch_id ON public.patient_timeline_events(branch_id);

-- -- 6. NOTIFICATION PREFERENCES TABLE (Phase 3) --

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(auth_user_id) on delete cascade,
  category text not null,
  email boolean not null default true,
  in_app boolean not null default true,
  unique (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own notification preferences' AND tablename = 'notification_preferences') THEN
    CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences
      FOR ALL USING (user_id = auth.uid() or get_current_user_role() = 'Admin');
  END IF;
END
$$;

GRANT ALL ON public.notification_preferences TO authenticated;

-- -- 7. RE-CREATE NOTIFICATION TRIGGER (Phase 3, missed) --

CREATE OR REPLACE FUNCTION public.handle_appointment_notification_v2()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_message text;
  v_category text;
  v_link text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'New Appointment';
    v_message := format('A new appointment has been scheduled.');
    v_category := 'appointment';
    v_link := '/dashboard/schedule';
    INSERT INTO public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
    VALUES (NEW.doctor_id, v_title, v_message, 'info', v_link, v_category, 'appointment', NEW.id);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'checked_in' AND OLD.status = 'scheduled' THEN
      v_title := 'Patient Checked In';
      v_message := format('Your patient has arrived and checked in.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      INSERT INTO public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      VALUES (NEW.doctor_id, v_title, v_message, 'info', v_link, v_category, 'appointment', NEW.id);
    END IF;
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      v_title := 'Appointment Cancelled';
      v_message := format('An appointment has been cancelled.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      INSERT INTO public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      VALUES (NEW.doctor_id, v_title, v_message, 'warning', v_link, v_category, 'appointment', NEW.id);
    END IF;
    IF NEW.status = 'no_show' AND OLD.status != 'no_show' THEN
      v_title := 'No Show';
      v_message := format('A patient did not show for their appointment.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      INSERT INTO public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      VALUES (NEW.doctor_id, v_title, v_message, 'critical', v_link, v_category, 'appointment', NEW.id);
    END IF;
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      v_title := 'Appointment Completed';
      v_message := format('An appointment has been completed.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      INSERT INTO public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      VALUES (NEW.doctor_id, v_title, v_message, 'success', v_link, v_category, 'appointment', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_appointment_notification ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointment_notification_v2 ON public.appointments;
CREATE TRIGGER trg_appointment_notification_v2
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_notification_v2();
