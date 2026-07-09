-- Phase 3 — ERP Completion
-- 1. Enhanced notifications with categories
-- 2. Notification preferences
-- 3. Timeline events table
-- 4. Appointment analytics columns
-- 5. Schedule improvement columns

-- -- 1. ENHANCED NOTIFICATIONS --

alter table if exists public.notifications 
  add column if not exists category text default 'general',
  add column if not exists related_entity_type text,
  add column if not exists related_entity_id text;

create index if not exists idx_notifications_category on public.notifications(category);
create index if not exists idx_notifications_related on public.notifications(related_entity_type, related_entity_id);

-- -- 2. NOTIFICATION PREFERENCES --

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(auth_user_id) on delete cascade,
  category text not null,
  email boolean not null default true,
  in_app boolean not null default true,
  unique (user_id, category)
);

alter table public.notification_preferences enable row level security;

create policy "Users manage own notification preferences" on public.notification_preferences
  for all using (user_id = auth.uid() or get_current_user_role() = 'Admin');

grant all on public.notification_preferences to authenticated;

-- -- 3. PATIENT TIMELINE EVENTS TABLE --

create table if not exists public.patient_timeline_events (
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

alter table public.patient_timeline_events enable row level security;

create policy "Timeline events select" on public.patient_timeline_events for select
  using (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant'));

create policy "Timeline events insert" on public.patient_timeline_events for insert
  with check (get_current_user_role() IN ('Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant'));

grant all on public.patient_timeline_events to authenticated;

create index if not exists idx_timeline_patient on public.patient_timeline_events(patient_id, created_at desc);
create index if not exists idx_timeline_type on public.patient_timeline_events(event_type);

-- -- 4. APPOINTMENT ADDITIONAL COLUMNS --

alter table public.appointments 
  add column if not exists waiting_time_minutes int,
  add column if not exists treatment_time_minutes int,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.users(auth_user_id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists checked_in_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

-- -- 5. NOTIFICATION ENHANCEMENT FUNCTIONS --

create or replace function public.handle_appointment_notification_v2()
returns trigger as $$
declare
  v_title text;
  v_message text;
  v_category text;
  v_link text;
begin
  if tg_op = 'INSERT' then
    v_title := 'New Appointment';
    v_message := format('A new appointment has been scheduled.');
    v_category := 'appointment';
    v_link := '/dashboard/schedule';
    insert into public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
    values (new.doctor_id, v_title, v_message, 'info', v_link, v_category, 'appointment', new.id);
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'checked_in' and old.status = 'scheduled' then
      v_title := 'Patient Checked In';
      v_message := format('Your patient has arrived and checked in.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      insert into public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      values (new.doctor_id, v_title, v_message, 'info', v_link, v_category, 'appointment', new.id);
    end if;
    if new.status = 'cancelled' and old.status != 'cancelled' then
      v_title := 'Appointment Cancelled';
      v_message := format('An appointment has been cancelled.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      insert into public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      values (new.doctor_id, v_title, v_message, 'warning', v_link, v_category, 'appointment', new.id);
    end if;
    if new.status = 'no_show' and old.status != 'no_show' then
      v_title := 'No Show';
      v_message := format('A patient did not show for their appointment.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      insert into public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      values (new.doctor_id, v_title, v_message, 'critical', v_link, v_category, 'appointment', new.id);
    end if;
    if new.status = 'completed' and old.status != 'completed' then
      v_title := 'Appointment Completed';
      v_message := format('An appointment has been completed.');
      v_category := 'appointment';
      v_link := '/dashboard/schedule';
      insert into public.notifications (user_id, title, message, type, link, category, related_entity_type, related_entity_id)
      values (new.doctor_id, v_title, v_message, 'success', v_link, v_category, 'appointment', new.id);
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_appointment_notification_v2 on public.appointments;
create trigger trg_appointment_notification_v2
  after insert or update on public.appointments
  for each row execute function public.handle_appointment_notification_v2();

-- Drop old trigger
drop trigger if exists trg_appointment_notification on public.appointments;
