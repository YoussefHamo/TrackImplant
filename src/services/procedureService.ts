import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { Procedure } from '../types';

function procedureFromRow(row: Record<string, unknown>): Procedure {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    procedure_name: row.procedure_name as string,
    tooth_number: row.tooth_number as string | undefined,
    implant_system: row.implant_system as string | undefined,
    implant_size: row.implant_size as string | undefined,
    procedure_date: row.procedure_date as string,
    status: row.status as string,
    doctor_name: row.doctor_name as string | undefined,
    notes: row.notes as string | undefined,
    bone_condition: row.bone_condition as string | undefined,
    bone_density: row.bone_density as string | undefined,
    bone_height: row.bone_height != null ? Number(row.bone_height) : undefined,
    bone_width: row.bone_width != null ? Number(row.bone_width) : undefined,
    pathology: row.pathology as string | undefined,
    ct_scan_notes: row.ct_scan_notes as string | undefined,
    chronic_disease: row.chronic_disease as string | undefined,
    medication: row.medication as string | undefined,
    implant_decision: row.implant_decision as Procedure['implant_decision'],
    extraction_needed: row.extraction_needed as boolean | undefined,
    abutment_type: row.abutment_type as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

export const procedureService = {
  async getAll(): Promise<Procedure[]> {
    const { data, error } = await supabase.from('procedures').select('*').order('procedure_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getByPatient(patientId: string): Promise<Procedure[]> {
    const { data, error } = await supabase.from('procedures').select('*').eq('patient_id', patientId).order('procedure_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getById(id: string): Promise<Procedure | null> {
    const { data, error } = await supabase.from('procedures').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data ? procedureFromRow(data) : null;
  },

  async create(procedure: Omit<Procedure, 'id' | 'created_at'>): Promise<Procedure> {
    const { data, error } = await supabase.from('procedures').insert([procedure]).select().single();
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'procedures',
        record_id: data.id,
        new_data: data as Record<string, unknown>,
      });
    }

    return procedureFromRow(data);
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from('procedures').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'procedures',
        record_id: id,
        new_data: { status },
      });
    }
  },

  async update(id: string, updates: Partial<Procedure>): Promise<void> {
    const { error } = await supabase.from('procedures').update(updates).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'procedures',
        record_id: id,
        new_data: updates as Record<string, unknown>,
      });
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('procedures').delete().eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'DELETE',
        table_name: 'procedures',
        record_id: id,
      });
    }
  },

  async getStats(): Promise<{ total: number; byStatus: Record<string, number> }> {
    const { data } = await supabase.from('procedures').select('status');
    const rows = (data || []) as { status: string }[];
    const byStatus: Record<string, number> = {};
    rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return { total: rows.length, byStatus };
  },
};
