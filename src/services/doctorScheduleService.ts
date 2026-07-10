import { supabase } from '../integrations/supabase/client';
import type { DoctorSchedule } from '../types';

function rowToSchedule(row: Record<string, unknown>): DoctorSchedule {
  return {
    id: row.id as string,
    doctor_id: row.doctor_id as string,
    day_of_week: row.day_of_week as number,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    is_active: row.is_active as boolean,
    branch_id: row.branch_id as string | undefined,
  };
}

export const doctorScheduleService = {
  async getByDoctor(doctorId: string): Promise<DoctorSchedule[]> {
    const { data, error } = await supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .order('day_of_week');
    if (error) throw new Error(error.message);
    return (data || []).map(rowToSchedule);
  },

  async getAll(branchId?: string | null): Promise<DoctorSchedule[]> {
    let q = supabase
      .from('doctor_schedules')
      .select('*')
      .order('day_of_week');
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(rowToSchedule);
  },

  async upsert(schedule: Omit<DoctorSchedule, 'id'> & { id?: string }): Promise<DoctorSchedule> {
    const { data, error } = await supabase
      .from('doctor_schedules')
      .upsert(schedule)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToSchedule(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('doctor_schedules').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async checkOverlap(doctorId: string, date: string, _startTime: string, durationMinutes: number, excludeAppointmentId?: string): Promise<boolean> {
    const startDate = new Date(date);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const endIso = endDate.toISOString();

    let query = supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctorId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .lt('appointment_date', endIso)
      .gte('appointment_date', startDate.toISOString());

    if (excludeAppointmentId) query = query.neq('id', excludeAppointmentId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).length > 0;
  },
};
