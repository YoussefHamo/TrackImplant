-- Add procedure_name column to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS procedure_name TEXT;
