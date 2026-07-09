-- Schedule & Calendar Module
-- 1. doctor_schedules table
-- 2. duration_minutes on appointments
-- 3. Auto No-Show function
-- 4. Notification function for appointment events

-- ── 1. DOCTOR SCHEDULES ──

create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.users(auth_user_id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  branch_id uuid references public.branches(id) on delete set null,
  unique (doctor_id, day_of_week)
);

alter table public.doctor_schedules enable row level security;

create policy "Doctor schedules select" on public.doctor_schedules for select
  using (get_current_user_role() IN ('Admin', 'Manager', 'Receptionist', 'Doctor'));

create policy "Doctor schedules insert" on public.doctor_schedules for insert
  with check (get_current_user_role() IN ('Admin', 'Manager'));

create policy "Doctor schedules update" on public.doctor_schedules for update
  using (get_current_user_role() IN ('Admin', 'Manager'));

create policy "Doctor schedules delete" on public.doctor_schedules for delete
  using (get_current_user_role() IN ('Admin', 'Manager'));

grant all on public.doctor_schedules to authenticated;

-- ── 2. DURATION ON APPOINTMENTS ──

alter table public.appointments add column if not exists duration_minutes int not null default 30;
alter table public.appointments add column if not exists end_time timestamptz;
alter table public.appointments add column if not exists color text;

-- ── 3. AUTO NO-SHOW FUNCTION ──

create or replace function public.auto_mark_no_show()
returns trigger as $$
begin
  if new.status = 'scheduled' and now() > new.appointment_date + interval '15 minutes' then
    new.status = 'no_show';
  end if;
  return new;
end;
$$ language plpgsql;

-- ── 4. APPOINTMENT NOTIFICATION TRIGGER ──

create or replace function public.handle_appointment_notification()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, message, type, link)
    values (
      new.doctor_id,
      'New Appointment',
      format('You have a new appointment scheduled.'),
      'info',
      '/dashboard/schedule'
    );
  end if;
  if tg_op = 'UPDATE' and new.status = 'checked_in' and old.status = 'scheduled' then
    insert into public.notifications (user_id, title, message, type, link)
    values (
      new.doctor_id,
      'Patient Checked In',
      format('Your patient has arrived and checked in.'),
      'info',
      '/dashboard/schedule'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_appointment_notification on public.appointments;
create trigger trg_appointment_notification
  after insert or update on public.appointments
  for each row execute function public.handle_appointment_notification();
