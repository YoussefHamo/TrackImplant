-- ============================================================
-- Fix Branch Isolation: add branch_id to clinical tables,
-- fix broken RLS policies, and secure SECURITY DEFINER RPCs.
-- ============================================================

-- ── 1. Add branch_id to tables missing it ──

alter table public.patients
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.procedures
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.appointments
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.financial_records
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.follow_ups
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.patient_reminders
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- ── 2. Fix RLS policies on all tables ──

-- Helper: drop policy if exists
do $$ begin
  -- patients
  drop policy if exists "Patients select" on public.patients;
  drop policy if exists "Patients insert" on public.patients;
  drop policy if exists "Patients update" on public.patients;

  -- procedures
  drop policy if exists "Procedures select" on public.procedures;
  drop policy if exists "Procedures insert" on public.procedures;
  drop policy if exists "Procedures update" on public.procedures;
  drop policy if exists "Procedures delete" on public.procedures;

  -- appointments
  drop policy if exists "Appointments select" on public.appointments;
  drop policy if exists "Appointments insert" on public.appointments;
  drop policy if exists "Appointments update" on public.appointments;
  drop policy if exists "Appointments delete" on public.appointments;
  drop policy if exists "Authenticated users can manage appointments" on public.appointments;

  -- financial_records
  drop policy if exists "FinancialRecords select" on public.financial_records;
  drop policy if exists "FinancialRecords insert" on public.financial_records;
  drop policy if exists "FinancialRecords update" on public.financial_records;

  -- follow_ups
  drop policy if exists "FollowUps select" on public.follow_ups;
  drop policy if exists "FollowUps insert" on public.follow_ups;
  drop policy if exists "FollowUps update" on public.follow_ups;

  -- stock_requests
  drop policy if exists "StockRequests select" on public.stock_requests;

  -- cross_branch_deliveries
  drop policy if exists "CrossBranchDeliveries select" on public.cross_branch_deliveries;

  -- communications
  drop policy if exists "communications_select" on public.communications;

  -- notifications
  drop policy if exists "Notifications select" on public.notifications;
  drop policy if exists "Notifications insert" on public.notifications;
  drop policy if exists "Notifications update" on public.notifications;

  -- audit_logs
  drop policy if exists "Audit logs select" on public.audit_logs;

  -- patient_files
  drop policy if exists "Authenticated users can read patient_files" on public.patient_files;
  drop policy if exists "Authenticated users can insert patient_files" on public.patient_files;
  drop policy if exists "Authenticated users can update patient_files" on public.patient_files;
  drop policy if exists "Authenticated users can delete patient_files" on public.patient_files;
  drop policy if exists "patient_files_select" on public.patient_files;
  drop policy if exists "patient_files_insert" on public.patient_files;
  drop policy if exists "patient_files_update" on public.patient_files;
  drop policy if exists "patient_files_delete" on public.patient_files;

  -- patient_reminders
  drop policy if exists "reminders_select" on public.patient_reminders;

  -- inventory_deliveries
  drop policy if exists "Deliveries select for authenticated" on public.inventory_deliveries;
end $$;

-- ── PATIENTS ──
create policy "Patients select" on public.patients for select
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "Patients insert" on public.patients for insert
  with check (true);
create policy "Patients update" on public.patients for update
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

-- ── PROCEDURES ──
create policy "Procedures select" on public.procedures for select
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "Procedures insert" on public.procedures for insert
  with check (true);
create policy "Procedures update" on public.procedures for update
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "Procedures delete" on public.procedures for delete
  using (get_current_user_role() = 'Admin');

-- ── APPOINTMENTS ──
create policy "Appointments select" on public.appointments for select
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "Appointments insert" on public.appointments for insert
  with check (true);
create policy "Appointments update" on public.appointments for update
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "Appointments delete" on public.appointments for delete
  using (get_current_user_role() = 'Admin');

-- ── FINANCIAL_RECORDS ──
create policy "FinancialRecords select" on public.financial_records for select
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "FinancialRecords insert" on public.financial_records for insert
  with check (true);
create policy "FinancialRecords update" on public.financial_records for update
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

-- ── FOLLOW_UPS ──
create policy "FollowUps select" on public.follow_ups for select
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );
create policy "FollowUps insert" on public.follow_ups for insert
  with check (true);
create policy "FollowUps update" on public.follow_ups for update
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

-- ── STOCK_REQUESTS ──
create policy "StockRequests select" on public.stock_requests for select
  using (
    get_current_user_role() = 'Admin'
    or requested_by = auth.uid()
  );

-- ── CROSS_BRANCH_DELIVERIES ──
-- Branch isolation via join to cross_branch_requests
create policy "CrossBranchDeliveries select" on public.cross_branch_deliveries for select
  using (
    get_current_user_role() = 'Admin'
    or exists (
      select 1 from public.cross_branch_requests r
      where r.id = cross_branch_deliveries.request_id
        and (r.from_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
          or r.to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid()))
    )
  );

-- ── COMMUNICATIONS ──
create policy "communications_select" on public.communications for select
  using (
    get_current_user_role() = 'Admin'
    or exists (
      select 1 from public.patients p
      where p.id = communications.patient_id
        and p.branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );

-- ── NOTIFICATIONS ──
create policy "Notifications select" on public.notifications for select
  using (
    user_id = auth.uid()
    or get_current_user_role() = 'Admin'
  );
create policy "Notifications insert" on public.notifications for insert
  with check (true);
create policy "Notifications update" on public.notifications for update
  using (
    user_id = auth.uid()
    or get_current_user_role() = 'Admin'
  );

-- ── AUDIT_LOGS ──
create policy "Audit logs select" on public.audit_logs for select
  using (get_current_user_role() = 'Admin');

-- ── PATIENT_FILES ──
create policy "patient_files_select" on public.patient_files for select
  using (
    get_current_user_role() = 'Admin'
    or exists (
      select 1 from public.patients p
      where p.id = patient_files.patient_id
        and p.branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );
create policy "patient_files_insert" on public.patient_files for insert
  with check (true);
create policy "patient_files_update" on public.patient_files for update
  using (get_current_user_role() = 'Admin');
create policy "patient_files_delete" on public.patient_files for delete
  using (get_current_user_role() = 'Admin');

-- ── PATIENT_REMINDERS ──
create policy "reminders_select" on public.patient_reminders for select
  using (
    get_current_user_role() = 'Admin'
    or branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

-- ── INVENTORY_DELIVERIES ──
create policy "Deliveries select for authenticated" on public.inventory_deliveries for select
  using (
    get_current_user_role() = 'Admin'
    or to_branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
  );

-- ── INVENTORY_TRANSACTIONS ──
-- Already has a good policy from earlier migration — ensure it uses get_current_user_role()
drop policy if exists "InventoryTransactions select" on public.inventory_transactions;
create policy "InventoryTransactions select" on public.inventory_transactions for select
  using (
    get_current_user_role() = 'Admin'
    or item_id in (
      select id from public.inventory_items
      where branch_id = (select branch_id from public.users where auth_user_id = auth.uid())
    )
  );

-- ── 3. RPC role fixes moved to 20260704000000_fix_spec_violations.sql ──
