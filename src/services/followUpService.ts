import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { FollowUp } from '../types';

function followUpFromRow(row: Record<string, unknown>): FollowUp {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    procedure_id: row.procedure_id as string | undefined,
    health_score: row.health_score as number | undefined,
    pain_level: row.pain_level as number | undefined,
    healing_status: row.healing_status as FollowUp['healing_status'],
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

export const followUpService = {
  async getAll(): Promise<FollowUp[]> {
    const { data, error } = await supabase.from('follow_ups').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(followUpFromRow);
  },

  async getByPatient(patientId: string): Promise<FollowUp[]> {
    const { data, error } = await supabase.from('follow_ups').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(followUpFromRow);
  },

  async getCritical(): Promise<FollowUp[]> {
    const { data, error } = await supabase.from('follow_ups').select('*').in('healing_status', ['Critical', 'Failure']).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(followUpFromRow);
  },

  async update(id: string, updates: Partial<FollowUp>): Promise<void> {
    const { error } = await supabase.from('follow_ups').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
    if (updates.healing_status === 'Failure' && updates.procedure_id) {
      const { error: procErr } = await supabase.from('procedures').update({ status: 'Consultation' }).eq('id', updates.procedure_id);
      if (procErr) throw new Error(procErr.message);
    }
    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'UPDATE', table_name: 'follow_ups', record_id: id,
        new_data: updates as Record<string, unknown>,
      });
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('follow_ups').delete().eq('id', id);
    if (error) throw new Error(error.message);
    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'DELETE', table_name: 'follow_ups', record_id: id,
      });
    }
  },

  async create(followUp: Omit<FollowUp, 'id' | 'created_at'>): Promise<FollowUp> {
    const { data, error } = await supabase.from('follow_ups').insert([followUp]).select().single();
    if (error) throw new Error(error.message);
    if (followUp.healing_status === 'Failure' && followUp.procedure_id) {
      const { error: procErr } = await supabase.from('procedures').update({ status: 'Consultation' }).eq('id', followUp.procedure_id);
      if (procErr) throw new Error(procErr.message);
    }
    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'INSERT', table_name: 'follow_ups', record_id: data.id,
        new_data: data as Record<string, unknown>,
      });
    }
    return followUpFromRow(data);
  },

  async getStats(): Promise<{ total: number; critical: number; failure: number; avgPain: number; avgHealth: number }> {
    const { data } = await supabase.from('follow_ups').select('healing_status, pain_level, health_score');
    const rows = (data || []) as { healing_status: string | null; pain_level: number | null; health_score: number | null }[];
    const total = rows.length;
    const critical = rows.filter(r => r.healing_status === 'Critical').length;
    const failure = rows.filter(r => r.healing_status === 'Failure').length;
    const avgPain = total ? rows.reduce((s, r) => s + (r.pain_level ?? 0), 0) / total : 0;
    const avgHealth = total ? rows.reduce((s, r) => s + (r.health_score ?? 100), 0) / total : 0;
    return { total, critical, failure, avgPain, avgHealth };
  },
};
