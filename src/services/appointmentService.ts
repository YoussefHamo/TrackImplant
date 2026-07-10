import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import { notificationService } from './notificationService';
import { timelineEventService } from './timelineEventService';
import type { Appointment } from '../types';

function rowToAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string | undefined,
    doctor_id: row.doctor_id as string | undefined,
    appointment_date: row.appointment_date as string,
    status: row.status as string,
    created_at: row.created_at as string | undefined,
    duration_minutes: row.duration_minutes as number | undefined,
    end_time: row.end_time as string | undefined,
    color: row.color as string | undefined,
    notes: row.notes as string | undefined,
    branch_id: row.branch_id as string | undefined,
    doctor_name: row.doctor_name as string | undefined,
  };
}

export const appointmentService = {
  async getAll(branchId?: string | null): Promise<Appointment[]> {
    let q = supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .order('appointment_date', { ascending: true });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...rowToAppointment(r),
      patient_name: r.patients?.full_name,
      doctor_name: r.doctor_id?.full_name,
    }));
  },

  async getById(id: string): Promise<Appointment | null> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      ...rowToAppointment(data),
      patient_name: (data as any).patients?.full_name,
      doctor_name: (data as any).doctor_id?.full_name,
    };
  },

  async getByDoctor(doctorId: string, branchId?: string | null): Promise<Appointment[]> {
    let q = supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .eq('doctor_id', doctorId)
      .order('appointment_date', { ascending: true });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...rowToAppointment(r),
      patient_name: r.patients?.full_name,
      doctor_name: r.doctor_id?.full_name,
    }));
  },

  async getUpcomingByDoctor(doctorId: string, limit = 10): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .eq('doctor_id', doctorId)
      .gte('appointment_date', new Date().toISOString())
      .order('appointment_date', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...rowToAppointment(r),
      patient_name: r.patients?.full_name,
      doctor_name: r.doctor_id?.full_name,
    }));
  },

  async getByDateRange(from: string, to: string, branchId?: string | null): Promise<Appointment[]> {
    let q = supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .gte('appointment_date', from)
      .lte('appointment_date', to)
      .order('appointment_date', { ascending: true });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...rowToAppointment(r),
      patient_name: r.patients?.full_name,
      doctor_name: r.doctor_id?.full_name,
    }));
  },

  async getByPatient(patientId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...rowToAppointment(r),
      patient_name: r.patients?.full_name,
      doctor_name: r.doctor_id?.full_name,
    }));
  },

  async checkOverlap(doctorId: string, startDate: string, durationMinutes: number, excludeAppointmentId?: string): Promise<{ hasOverlap: boolean; appointments: Appointment[] }> {
    const start = new Date(startDate);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const endIso = end.toISOString();

    let q = supabase
      .from('appointments')
      .select('*, patients!inner(full_name), doctor_id:users!inner(full_name)')
      .eq('doctor_id', doctorId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .lt('appointment_date', endIso)
      .gte('appointment_date', start.toISOString());

    if (excludeAppointmentId) q = q.neq('id', excludeAppointmentId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const apps = (data || []).map((r: any) => ({
      ...rowToAppointment(r),
      patient_name: r.patients?.full_name,
      doctor_name: r.doctor_id?.full_name,
    }));
    return { hasOverlap: apps.length > 0, appointments: apps };
  },

  async create(appointment: Omit<Appointment, 'id'>, change_reason?: string, reason_category?: string): Promise<void> {
    const payload: Record<string, unknown> = {
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appointment_date: appointment.appointment_date,
      status: appointment.status || 'scheduled',
      duration_minutes: appointment.duration_minutes || 30,
      notes: appointment.notes || null,
      branch_id: appointment.branch_id || null,
    };
    if (appointment.duration_minutes) {
      const start = new Date(appointment.appointment_date);
      const end = new Date(start.getTime() + appointment.duration_minutes * 60000);
      payload.end_time = end.toISOString();
    }
    if (change_reason !== undefined) payload.change_reason = change_reason;
    if (reason_category !== undefined) payload.reason_category = reason_category;
    const { data, error } = await supabase
      .from('appointments')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'appointments',
        record_id: data.id,
        new_data: data as Record<string, unknown>,
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }

    // Write timeline event
    if (appointment.patient_id) {
      timelineEventService.write({
        patient_id: appointment.patient_id,
        event_type: 'appointment_scheduled',
        description: `Appointment scheduled${appointment.doctor_id ? '' : ''}`,
        related_entity_type: 'appointment',
        related_entity_id: data.id,
        branch_id: appointment.branch_id || undefined,
        metadata: { status: appointment.status || 'scheduled', doctor_id: appointment.doctor_id },
      }).catch(() => {});
    }

    // Notify doctor
    if (appointment.doctor_id) {
      notificationService.create({
        user_id: appointment.doctor_id,
        title: 'New Appointment',
        message: 'You have a new appointment scheduled.',
        type: 'info',
        link: '/dashboard/schedule',
      }).catch(() => {});
    }
  },

  async update(id: string, updates: Partial<Appointment>, change_reason?: string, reason_category?: string): Promise<void> {
    const payload: Record<string, unknown> = { ...updates };
    if (updates.appointment_date && updates.duration_minutes) {
      const start = new Date(updates.appointment_date);
      const end = new Date(start.getTime() + updates.duration_minutes * 60000);
      payload.end_time = end.toISOString();
    }
    if (change_reason !== undefined) payload.change_reason = change_reason;
    if (reason_category !== undefined) payload.reason_category = reason_category;
    const { error } = await supabase
      .from('appointments')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'appointments',
        record_id: id,
        new_data: payload,
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }

    // Write timeline event for status changes
    const appt = await this.getById(id).catch(() => null);
    if (appt?.patient_id) {
      if (updates.status) {
        timelineEventService.write({
          patient_id: appt.patient_id,
          event_type: `appointment_${updates.status}`,
          description: `Appointment ${updates.status}${appt.doctor_name ? ` with Dr. ${appt.doctor_name}` : ''}`,
          related_entity_type: 'appointment',
          related_entity_id: id,
          branch_id: appt.branch_id || undefined,
          metadata: { status: updates.status },
        }).catch(() => {});
      } else if (updates.duration_minutes) {
        timelineEventService.write({
          patient_id: appt.patient_id,
          event_type: 'appointment_updated',
          description: `Duration changed to ${updates.duration_minutes} min`,
          related_entity_type: 'appointment',
          related_entity_id: id,
          branch_id: appt.branch_id || undefined,
          metadata: { duration_minutes: updates.duration_minutes },
        }).catch(() => {});
      }
    }

    // Notify doctor on check-in
    if (updates.status === 'checked_in') {
      if (appt?.doctor_id) {
        notificationService.create({
          user_id: appt.doctor_id,
          title: 'Patient Checked In',
          message: 'Your patient has arrived and checked in.',
          type: 'info',
          link: '/dashboard/schedule',
        }).catch(() => {});
      }
    }
  },

  async updateStatus(id: string, status: string, change_reason?: string, reason_category?: string): Promise<void> {
    await this.update(id, { status }, change_reason, reason_category);
  },

  async delete(id: string): Promise<void> {
    const appt = await this.getById(id).catch(() => null);
    if (appt?.patient_id) {
      timelineEventService.write({
        patient_id: appt.patient_id,
        event_type: 'appointment_cancelled',
        description: 'Appointment deleted',
        related_entity_type: 'appointment',
        related_entity_id: id,
        metadata: { deleted: true },
      }).catch(() => {});
    }
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getTodayStats(branchId?: string | null): Promise<{
    total: number; checkedIn: number; working: number; completed: number;
    cancelled: number; noShow: number; postponed: number; scheduled: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let q = supabase
      .from('appointments')
      .select('status')
      .gte('appointment_date', today.toISOString())
      .lt('appointment_date', tomorrow.toISOString());
    if (branchId) q = q.eq('branch_id', branchId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const stats = { total: 0, checkedIn: 0, working: 0, completed: 0, cancelled: 0, noShow: 0, postponed: 0, scheduled: 0 };
    (data || []).forEach((r: any) => {
      stats.total++;
      switch (r.status) {
        case 'checked_in': stats.checkedIn++; break;
        case 'working': stats.working++; break;
        case 'completed': stats.completed++; break;
        case 'cancelled': stats.cancelled++; break;
        case 'no_show': stats.noShow++; break;
        case 'postponed': stats.postponed++; break;
        default: stats.scheduled++;
      }
    });
    return stats;
  },
};
