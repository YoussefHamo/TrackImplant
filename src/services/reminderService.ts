import { supabase } from '../integrations/supabase/client';
import type { PatientReminder, ReminderType } from '../types';

function reminderFromRow(row: Record<string, unknown>): PatientReminder {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    reminder_type: row.reminder_type as ReminderType,
    title: row.title as string,
    message: row.message as string | undefined,
    scheduled_for: row.scheduled_for as string,
    sent_at: row.sent_at as string | undefined,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

export const reminderService = {
  async getByPatient(patientId: string): Promise<PatientReminder[]> {
    const { data, error } = await supabase
      .from('patient_reminders')
      .select('*')
      .eq('patient_id', patientId)
      .order('scheduled_for', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(reminderFromRow);
  },

  async getUpcoming(days = 7): Promise<PatientReminder[]> {
    const future = new Date();
    future.setDate(future.getDate() + days);
    const { data, error } = await supabase
      .from('patient_reminders')
      .select('*')
      .is('sent_at', null)
      .lte('scheduled_for', future.toISOString().split('T')[0])
      .order('scheduled_for');
    if (error) throw new Error(error.message);
    return (data || []).map(reminderFromRow);
  },

  async create(data: {
    patient_id: string;
    reminder_type: ReminderType;
    title: string;
    message?: string;
    scheduled_for: string;
    branch_id?: string;
  }): Promise<PatientReminder> {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = { ...data, created_by: user?.id };
    delete payload.branch_id;
    payload.branch_id = data.branch_id || null;
    const { data: inserted, error } = await supabase
      .from('patient_reminders')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return reminderFromRow(inserted);
  },

  async markSent(id: string): Promise<void> {
    const { error } = await supabase
      .from('patient_reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('patient_reminders').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Auto-generate birthday reminders for patients with upcoming birthdays
  async generateBirthdayReminders(): Promise<number> {
    const today = new Date();
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { data: patients } = await supabase
      .from('patients')
      .select('id, full_name, date_of_birth')
      .not('date_of_birth', 'is', null);
    let count = 0;
    for (const p of (patients || [])) {
      const dob = (p as Record<string, unknown>).date_of_birth as string;
      if (!dob) continue;
      const dobMD = dob.slice(5);
      if (dobMD === monthDay) {
        const existing = await supabase
          .from('patient_reminders')
          .select('id')
          .eq('patient_id', (p as Record<string, unknown>).id as string)
          .eq('reminder_type', 'birthday')
          .eq('scheduled_for', today.toISOString().split('T')[0])
          .maybeSingle();
        if (!existing.data) {
          await this.create({
            patient_id: (p as Record<string, unknown>).id as string,
            reminder_type: 'birthday',
            title: `عيد ميلاد سعيد - ${(p as Record<string, unknown>).full_name}`,
            scheduled_for: today.toISOString().split('T')[0],
          });
          count++;
        }
      }
    }
    return count;
  },
};
