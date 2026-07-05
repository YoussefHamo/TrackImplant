ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_medical_code TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_company TEXT;
