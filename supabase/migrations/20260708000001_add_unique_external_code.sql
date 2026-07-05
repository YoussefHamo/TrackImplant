CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_external_code_unique ON patients (external_medical_code) WHERE external_medical_code IS NOT NULL;
