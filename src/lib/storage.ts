export const STORAGE_BUCKETS = {
  PATIENT_PROFILES: 'patient-profiles',
  PATIENT_DOCUMENTS: 'patient-documents',
} as const;

export const DOCUMENT_CATEGORIES = [
  'CBCT', 'Panorama', 'X-Ray', 'Blood Analysis',
  'Prescription', 'Clinical Photos', 'Treatment Plan', 'Other',
] as const;
export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];

export const PROFILE_IMAGE_CONSTRAINTS = {
  maxSizeMB: 5,
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export const DOCUMENT_CONSTRAINTS = {
  maxSizeMB: 20,
  maxSizeBytes: 20 * 1024 * 1024,
  allowedTypes: [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;

export function buildProfilePath(patientId: string, ext: string): string {
  return `profiles/${patientId}/profile.${ext}`;
}

export function buildDocumentPath(patientId: string, category: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `documents/${patientId}/${category}/${timestamp}_${sanitized}`;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
