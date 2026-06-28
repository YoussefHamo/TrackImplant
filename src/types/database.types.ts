export type UserRole = 'Admin' | 'Doctor' | 'Assistant' | 'Receptionist';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'Pending' | 'Partial' | 'Paid';
export type PaymentMethod = 'cash' | 'card' | 'insurance' | 'bank_transfer';
export type RecordType = 'invoice' | 'payment';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'USER_CREATED' | 'ROLE_CHANGED' | 'INVENTORY_CHANGE' | 'PAYMENT_CHANGE';
export type InventoryItemType = 'implant' | 'abutment';
export type TransactionType = 'add' | 'deduct';
export type HealingStatus = 'OnTrack' | 'Healing' | 'Critical' | 'Failure' | 'Completed';

export interface Patient {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_image_url?: string;
  medical_history?: string;
  chronic_disease?: string;
  medication?: string;
  allergies?: string;
  smoking_status?: string;
  created_at?: string;
  created_by?: string;
}

export interface PatientDocument {
  id: string;
  patient_id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  category: string;
  storage_path: string;
  public_url?: string;
  uploaded_by?: string;
  created_at?: string;
}

export interface Appointment {
  id: string;
  patient_id?: string;
  doctor_id?: string;
  appointment_date: string;
  status: string;
  created_at?: string;
}

export interface FinancialRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  record_type: RecordType;
  parent_invoice_id?: string | null;
  invoice_name?: string;
  total_amount: number;
  amount: number;
  paid_so_far: number;
  remaining_amount: number;
  status: PaymentStatus;
  notes?: string;
  created_at?: string;
}

export interface Procedure {
  id: string;
  patient_id: string;
  procedure_name: string;
  tooth_number?: string;
  implant_system?: string;
  implant_size?: string;
  implant_brand?: string;
  procedure_date: string;
  status: string;
  doctor_name?: string;
  notes?: string;
  bone_condition?: string;
  bone_density?: string;
  bone_height?: number;
  bone_width?: number;
  pathology?: string;
  ct_scan_notes?: string;
  chronic_disease?: string;
  medication?: string;
  implant_decision?: 'Immediate' | 'Delayed' | 'Not Possible';
  extraction_needed?: boolean;
  abutment_type?: string;
  created_at?: string;
}

export interface FollowUp {
  id: string;
  patient_id: string;
  procedure_id?: string;
  health_score?: number;
  pain_level?: number;
  healing_status?: HealingStatus;
  notes?: string;
  created_at?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  role: UserRole;
  full_name: string;
  username: string;
  is_active: boolean;
}

export interface AppUser {
  id: string;
  auth_user_id: string;
  username: string;
  full_name: string;
  email?: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  created_at?: string;
}

export interface ImplantInventory {
  id: string;
  brand: string;
  size: string;
  quantity: number;
  minimum_stock?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AbutmentInventory {
  id: string;
  type: string;
  quantity: number;
  minimum_stock?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryTransaction {
  id: string;
  item_type: InventoryItemType;
  item_id: string;
  type: TransactionType;
  quantity: number;
  patient_id?: string;
  procedure_id?: string;
  notes?: string;
  created_at?: string;
}

export interface PatientFile {
  id: string;
  patient_id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  category: string;
  storage_path: string;
  public_url?: string;
  uploaded_by?: string;
  created_at?: string;
}
