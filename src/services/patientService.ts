import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { Patient } from '../types';
import {
  STORAGE_BUCKETS,
  buildProfilePath,
  PROFILE_IMAGE_CONSTRAINTS,
} from '../lib/storage';

function patientFromRow(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    full_name: row.full_name as string,
    phone: row.phone as string,
    email: row.email as string | undefined,
    gender: row.gender as string | undefined,
    date_of_birth: row.date_of_birth as string | undefined,
    profile_image_url: row.profile_image_url as string | undefined,
    medical_history: row.medical_history as string | undefined,
    chronic_disease: row.chronic_disease as string | undefined,
    medication: row.medication as string | undefined,
    allergies: row.allergies as string | undefined,
    smoking_status: row.smoking_status as string | undefined,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

const BUCKET = STORAGE_BUCKETS.PATIENT_PROFILES;

export const patientService = {
  async getAll(): Promise<Patient[]> {
    const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(patientFromRow);
  },

  async getById(id: string): Promise<Patient | null> {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? patientFromRow(data) : null;
  },

  async search(query: string): Promise<Patient[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return (data || []).map(patientFromRow);
  },

  async create(patient: Omit<Patient, 'id' | 'created_at'>): Promise<Patient> {
    const { data, error } = await supabase.from('patients').insert([{
      full_name: patient.full_name,
      phone: patient.phone,
      medical_history: patient.medical_history,
    }]).select().single();
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'patients',
        record_id: data.id,
        new_data: data as Record<string, unknown>,
      });
    }

    return patientFromRow(data);
  },

  async update(id: string, updates: Partial<Patient>): Promise<void> {
    const { error } = await supabase.from('patients').update(updates).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'patients',
        record_id: id,
        new_data: updates as Record<string, unknown>,
      });
    }
  },

  async uploadProfileImage(patientId: string, file: File): Promise<string> {
    if (!(PROFILE_IMAGE_CONSTRAINTS.allowedTypes as readonly string[]).includes(file.type)) {
      throw new Error('Only JPEG, PNG, and WebP images are allowed');
    }
    if (file.size > PROFILE_IMAGE_CONSTRAINTS.maxSizeBytes) {
      throw new Error(`Image exceeds ${PROFILE_IMAGE_CONSTRAINTS.maxSizeMB}MB limit`);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const storagePath = buildProfilePath(patientId, ext);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const { error: dbError } = await supabase
      .from('patients')
      .update({ profile_image_url: publicUrl })
      .eq('id', patientId);
    if (dbError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw new Error(dbError.message);
    }

    return publicUrl;
  },

  async getStats(): Promise<{ total: number; newThisMonth: number }> {
    const { count: total } = await supabase.from('patients').select('*', { count: 'exact', head: true });
    const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0,0,0,0);
    const { count: newThisMonth } = await supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', firstOfMonth.toISOString());
    return { total: total || 0, newThisMonth: newThisMonth || 0 };
  },
};
