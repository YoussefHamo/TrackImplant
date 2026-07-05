import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { ImplantForm, ImplantFormAttachment } from '../types';

function formFromRow(row: Record<string, unknown>): ImplantForm {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    implant_type: row.implant_type as string,
    manufacturer: row.manufacturer as string,
    diameter: row.diameter as string,
    length: row.length as string | undefined,
    quantity: row.quantity as number,
    tooth_number: row.tooth_number as string,
    batch_number: row.batch_number as string | undefined,
    serial_number: row.serial_number as string | undefined,
    warranty_number: row.warranty_number as string | undefined,
    doctors: (row.doctors || []) as ImplantForm['doctors'],
    attachments: (row.attachments || []) as ImplantFormAttachment[],
    notes: row.notes as string | undefined,
    branch_id: row.branch_id as string | undefined,
    status: row.status as ImplantForm['status'],
    created_by: row.created_by as string | undefined,
    updated_by: row.updated_by as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export const implantFormService = {
  async getByPatient(patientId: string): Promise<ImplantForm[]> {
    const { data, error } = await supabase
      .from('implant_forms')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(formFromRow);
  },

  async getById(id: string): Promise<ImplantForm | null> {
    const { data, error } = await supabase
      .from('implant_forms')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? formFromRow(data) : null;
  },

  async create(data: Omit<ImplantForm, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>): Promise<ImplantForm> {
    const actor = await getCurrentUserInfo();
    const payload = {
      ...data,
      created_by: actor?.user_id || null,
      updated_by: actor?.user_id || null,
    };
    const { data: inserted, error } = await supabase
      .from('implant_forms')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);

    const actorLog = await getCurrentUserInfo();
    if (actorLog) {
      auditLogService.log({
        user_id: actorLog.user_id,
        user_name: actorLog.user_name,
        action: 'INSERT',
        table_name: 'implant_forms',
        record_id: inserted.id,
        new_data: payload as unknown as Record<string, unknown>,
      });
    }
    return formFromRow(inserted);
  },

  async update(id: string, data: Partial<Omit<ImplantForm, 'id' | 'created_at' | 'created_by'>>): Promise<void> {
    const actor = await getCurrentUserInfo();
    const payload = {
      ...data,
      updated_by: actor?.user_id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('implant_forms')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);

    const actorLog = await getCurrentUserInfo();
    if (actorLog) {
      auditLogService.log({
        user_id: actorLog.user_id,
        user_name: actorLog.user_name,
        action: 'UPDATE',
        table_name: 'implant_forms',
        record_id: id,
        new_data: payload as unknown as Record<string, unknown>,
      });
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('implant_forms')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'DELETE',
        table_name: 'implant_forms',
        record_id: id,
      });
    }
  },

  async uploadAttachment(
    patientId: string,
    formId: string,
    file: File,
  ): Promise<ImplantFormAttachment> {
    const storagePath = `implant-forms/${patientId}/${formId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from('patient-documents')
      .upload(storagePath, file, { upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage
      .from('patient-documents')
      .getPublicUrl(storagePath);

    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      file_size: file.size,
    };
  },

  async deleteAttachment(formId: string, attachment: ImplantFormAttachment): Promise<void> {
    await supabase.storage
      .from('patient-documents')
      .remove([attachment.storage_path]);

    const { data: form } = await supabase
      .from('implant_forms')
      .select('attachments')
      .eq('id', formId)
      .single();

    if (form) {
      const remaining = (form.attachments as ImplantFormAttachment[]).filter(
        (a) => a.id !== attachment.id,
      );
      await supabase
        .from('implant_forms')
        .update({ attachments: remaining })
        .eq('id', formId);
    }
  },

  async getDoctors(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('auth_user_id, full_name')
      .eq('role', 'Doctor')
      .eq('is_active', true)
      .order('full_name');
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => ({
      id: r.auth_user_id as string,
      name: r.full_name as string,
    }));
  },
};
