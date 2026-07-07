import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { Appointment } from '../types';

export const appointmentService = {
  async getAll(branchId?: string | null): Promise<Appointment[]> {
    let q = supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getByDoctor(doctorId: string, branchId?: string | null): Promise<Appointment[]> {
    let q = supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('appointment_date', { ascending: true });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getUpcomingByDoctor(doctorId: string, limit = 10): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .gte('appointment_date', new Date().toISOString())
      .order('appointment_date', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create(appointment: Omit<Appointment, 'id'>, change_reason?: string, reason_category?: string): Promise<void> {
    const payload = { ...appointment };
    if (change_reason !== undefined) (payload as Record<string, unknown>).change_reason = change_reason;
    if (reason_category !== undefined) (payload as Record<string, unknown>).reason_category = reason_category;
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
  },

  async updateStatus(id: string, status: string, change_reason?: string, reason_category?: string): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (change_reason !== undefined) updates.change_reason = change_reason;
    if (reason_category !== undefined) updates.reason_category = reason_category;
    const { error } = await supabase
      .from('appointments')
      .update(updates)
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
        new_data: { status },
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },
};
