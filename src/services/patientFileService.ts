import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { PatientFile } from '../types';
import {
  STORAGE_BUCKETS,
  buildDocumentPath,
  DOCUMENT_CONSTRAINTS,
} from '../lib/storage';
import type { DocumentCategory } from '../lib/storage';

export type { DocumentCategory };

const BUCKET = STORAGE_BUCKETS.PATIENT_DOCUMENTS;
const TABLE = 'patient_files';

function fileFromRow(row: Record<string, unknown>): PatientFile {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    file_name: row.file_name as string,
    file_type: row.file_type as string,
    file_size: row.file_size as number | undefined,
    category: row.category as string,
    storage_path: row.storage_path as string,
    public_url: row.public_url as string | undefined,
    uploaded_by: row.uploaded_by as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

export const patientFileService = {
  async getByPatient(patientId: string): Promise<PatientFile[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(fileFromRow);
  },

  async upload(
    patientId: string,
    file: File,
    category: string,
    userId?: string,
  ): Promise<PatientFile> {
    if (file.size > DOCUMENT_CONSTRAINTS.maxSizeBytes) {
      throw new Error(`File exceeds ${DOCUMENT_CONSTRAINTS.maxSizeMB}MB limit`);
    }

    const storagePath = buildDocumentPath(patientId, category, file.name);

    console.log('[patientFileService.upload]', {
      bucket: BUCKET,
      storagePath,
      dbTable: TABLE,
      fileSize: file.size,
      fileType: file.type,
      category,
    });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const record = {
      patient_id: patientId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      category,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      uploaded_by: userId || null,
    };

    console.log('[patientFileService.upload] DB insert payload:', { table: TABLE, record });

    const { data: inserted, error: dbError } = await supabase
      .from(TABLE)
      .insert([record])
      .select()
      .single();
    if (dbError) {
      console.error('[patientFileService.upload] DB insert failed, rolling back storage upload', dbError.message);
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw new Error(dbError.message);
    }

    console.log('[patientFileService.upload] Success:', { id: inserted.id, storagePath });

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'INSERT', table_name: 'patient_files', record_id: inserted.id,
        new_data: record as unknown as Record<string, unknown>,
      });
    }

    return fileFromRow(inserted);
  },

  async delete(docId: string, storagePath: string): Promise<void> {
    console.log('[patientFileService.delete]', { table: TABLE, docId, storagePath });

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);
    if (storageError) throw new Error(storageError.message);

    const { error: dbError } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', docId);
    if (dbError) throw new Error(dbError.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'DELETE', table_name: 'patient_files', record_id: docId,
      });
    }
  },

  async rename(docId: string, newName: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ file_name: newName })
      .eq('id', docId);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'UPDATE', table_name: 'patient_files', record_id: docId,
        new_data: { file_name: newName },
      });
    }
  },

  async updateCategory(docId: string, category: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ category })
      .eq('id', docId);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id, user_name: actor.user_name,
        action: 'UPDATE', table_name: 'patient_files', record_id: docId,
        new_data: { category },
      });
    }
  },
};
