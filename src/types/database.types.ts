export type UserRole = 'Manager' | 'Admin' | 'Doctor' | 'Assistant' | 'Receptionist';
export type ReasonCategory =
  | 'Billing Correction'
  | 'Wrong Amount'
  | 'Duplicate Invoice'
  | 'Payment Adjustment'
  | 'Refund Correction'
  | 'Insurance Adjustment'
  | 'Damaged Item'
  | 'Expired Item'
  | 'Stock Count Difference'
  | 'Transfer Correction'
  | 'Supplier Error'
  | 'Manual Adjustment'
  | 'Treatment Plan Updated'
  | 'Clinical Correction'
  | 'Wrong Patient Selection'
  | 'Data Entry Error'
  | 'User Request'
  | 'Manager Decision'
  | 'Administrative Correction'
  | 'Other';

export interface ChangeReason {
  category: ReasonCategory;
  reason: string;
  approved_by?: string;
  approval_notes?: string;
}
export type AppointmentStatus = 'scheduled' | 'checked_in' | 'working' | 'completed' | 'cancelled' | 'no_show' | 'postponed';
export type PaymentStatus = 'Pending' | 'Partial' | 'Paid';
export type PaymentMethod = 'cash' | 'card' | 'insurance' | 'bank_transfer';
export type RecordType = 'invoice' | 'payment';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'USER_CREATED' | 'ROLE_CHANGED' | 'INVENTORY_CHANGE' | 'PAYMENT_CHANGE' | 'SOFT_DELETE';
export type InventoryItemType = 'implant' | 'abutment';
export type InventoryCategory = 'implant' | 'abutment' | 'prosthetic' | 'material';
export type TransactionType = 'add' | 'deduct';
export type OperationType = 'add' | 'issue' | 'return' | 'adjust' | 'cross_branch';
export type CrossBranchRequestStatus = 'pending' | 'approved' | 'rejected' | 'in_transit' | 'delivered' | 'completed';
export type CrossBranchDeliveryStatus = 'preparing' | 'picked_up' | 'in_transit' | 'arrived' | 'completed';
export type StockRequestStatus = 'pending' | 'approved' | 'rejected' | 'delivered' | 'completed';
export type HealingStatus = 'OnTrack' | 'Healing' | 'Critical' | 'Failure' | 'Completed';
export type ReturnReason = 'wrong_item' | 'damaged' | 'expired' | 'cancelled_procedure' | 'cross_branch_return' | 'supplier_return' | 'other';
export type ReturnStatus = 'pending' | 'approved' | 'rejected';
export type CountSessionStatus = 'draft' | 'in_progress' | 'completed' | 'approved';
export interface ProductCatalogItem {
  id: string;
  category: InventoryCategory;
  subcategory: string | null;
  name: string | null;
  brand: string | null;
  size: string | null;
  unit: string | null;
}
export type CommunicationType = 'call' | 'whatsapp' | 'sms' | 'email' | 'note' | 'clinic_note';
export type CommunicationDirection = 'inbound' | 'outbound';
export type ReminderType = 'birthday' | 'recall' | 'missed_appointment' | 'follow_up' | 'custom';

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
  external_medical_code?: string;
  insurance_company?: string;
  created_at?: string;
  created_by?: string;
  branch_id?: string;
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
  duration_minutes?: number;
  end_time?: string;
  color?: string;
  doctor_name?: string;
  patient_name?: string;
  notes?: string;
  branch_id?: string;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  branch_id?: string;
}

export interface ProcedureDoctor {
  id: string;
  procedure_id: string;
  doctor_id: string;
  doctor_name?: string;
  role_in_procedure: 'primary' | 'assistant';
  display_order: number;
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
  payment_method?: PaymentMethod;
  notes?: string;
  created_at?: string;
  branch_id?: string | null;
  branch_name?: string | null;
  change_reason?: string | null;
  reason_category?: string | null;
  procedure_id?: string | null;
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
  branch_id?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  implant_decision?: 'Immediate' | 'Delayed' | 'Not Possible';
  extraction_needed?: boolean;
  abutment_type?: string;
  kit_id?: string;
  kit_snapshot?: Record<string, unknown>;
  created_at?: string;
  change_reason?: string | null;
  reason_category?: string | null;
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
  branch_id?: string;
}

export interface AppUser {
  id: string;
  auth_user_id: string;
  username: string;
  full_name: string;
  email?: string;
  role: UserRole;
  is_active: boolean;
  branch_id?: string;
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
  role?: string;
  branch_id?: string;
  ip_address?: string;
  user_agent?: string;
  os?: string;
  session_id?: string;
  created_at?: string;
  reason_category?: string | null;
  change_reason?: string | null;
}

export interface ImplantInventory {
  id: string;
  brand: string;
  size: string;
  quantity: number;
  reserved?: number;
  used?: number;
  minimum_stock?: number;
  branch_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AbutmentInventory {
  id: string;
  type: string;
  quantity: number;
  reserved?: number;
  used?: number;
  minimum_stock?: number;
  branch_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryTransaction {
  id: string;
  item_type: InventoryItemType;
  item_id: string;
  type: TransactionType;
  operation_type: OperationType;
  quantity: number;
  item_category?: string;
  item_name?: string;
  patient_id?: string;
  procedure_id?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  change_reason?: string | null;
  reason_category?: string | null;
}

export interface InventoryItem {
  id: string;
  branch_id?: string;
  category: InventoryCategory;
  subcategory?: string;
  name?: string;
  brand?: string;
  size?: string;
  unit: string;
  quantity: number;
  reserved: number;
  used: number;
  minimum_stock?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StockRequest {
  id: string;
  item_id?: string;
  item_name: string;
  item_category?: string;
  quantity: number;
  requested_by?: string;
  requested_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  status: StockRequestStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CrossBranchRequest {
  id: string;
  from_branch_id: string;
  to_branch_id: string;
  item_id?: string;
  item_name: string;
  item_category?: string;
  quantity: number;
  status: CrossBranchRequestStatus;
  requested_by?: string;
  responded_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  from_branch_name?: string;
  to_branch_name?: string;
  requester_name?: string;
  responder_name?: string;
  // Delivery info (joined)
  delivery_id?: string;
  delivery_status?: CrossBranchDeliveryStatus;
}

export interface ImplantFormAttachment {
  id: string;
  name: string;
  type: string;
  storage_path: string;
  public_url: string;
  file_size: number;
}

export interface ImplantFormDoctor {
  id: string;
  name: string;
}

export interface ImplantForm {
  id: string;
  patient_id: string;
  implant_type: string;
  manufacturer: string;
  diameter: string;
  length?: string;
  quantity: number;
  tooth_number: string;
  batch_number?: string;
  serial_number?: string;
  warranty_number?: string;
  doctors: ImplantFormDoctor[];
  attachments: ImplantFormAttachment[];
  notes?: string;
  branch_id?: string;
  status: 'Draft' | 'Completed';
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RequestableItem {
  id: string;
  branch_id: string;
  category: string;
  subcategory?: string;
  name?: string;
  brand?: string;
  size?: string;
  unit: string;
  quantity: number;
}

export interface CrossBranchDelivery {
  id: string;
  request_id: string;
  status: CrossBranchDeliveryStatus;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  // Joined
  request?: CrossBranchRequest;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

export interface BranchInventory {
  id: string;
  branch_id: string;
  item_id: string;
  quantity: number;
  reserved: number;
  updated_at?: string;
  // Joined fields
  branch_name?: string;
  item_name?: string;
  item_category?: string;
}

export interface InventoryDelivery {
  id: string;
  from_location: string;
  to_type: 'warehouse' | 'branch';
  to_branch_id?: string;
  item_id?: string;
  item_name: string;
  quantity: number;
  notes?: string;
  received_by?: string;
  created_by?: string;
  created_at?: string;
  // Joined fields
  branch_name?: string;
}

export interface InventoryReturn {
  id: string;
  from_location: 'warehouse' | 'branch' | 'patient';
  from_branch_id?: string;
  item_id?: string;
  item_name: string;
  quantity: number;
  reason: ReturnReason | string;
  notes?: string;
  status: ReturnStatus;
  branch_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  branch_name?: string;
  reviewer_name?: string;
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

// ── Phase 2: Procedure Kits ──
export interface ProcedureKit {
  id: string;
  name: string;
  description?: string;
  branch_id?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined
  items?: ProcedureKitItem[];
}

export interface ProcedureKitItem {
  id: string;
  kit_id: string;
  category: InventoryCategory;
  subcategory?: string;
  brand?: string;
  size?: string;
  name?: string;
  quantity: number;
  created_at?: string;
}

// ── Phase 2: Inventory Count ──
export interface InventoryCountSession {
  id: string;
  branch_id: string;
  status: CountSessionStatus;
  notes?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
  // Joined
  branch_name?: string;
  creator_name?: string;
  approver_name?: string;
  items?: InventoryCountItem[];
}

export interface InventoryCountItem {
  id: string;
  session_id: string;
  item_id: string;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  reason?: string;
  created_at?: string;
  // Joined
  item_name?: string;
  item_category?: string;
}

// ── Phase 2: CRM Communications ──
export interface Communication {
  id: string;
  patient_id: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content?: string;
  staff_id?: string;
  created_at?: string;
  // Joined
  staff_name?: string;
}

// ── Phase 2: Patient Reminders ──
export interface PatientReminder {
  id: string;
  patient_id: string;
  reminder_type: ReminderType;
  title: string;
  message?: string;
  scheduled_for: string;
  sent_at?: string;
  created_by?: string;
  created_at?: string;
}

// ── Phase 2: Dashboard types ──
export interface DashboardStats {
  totalPatients: number;
  newPatientsThisMonth: number;
  totalProcedures: number;
  todayAppointments: number;
  todayProcedures: number;
  pendingRequests: number;
  lowStockItems: number;
  criticalFollowUps: number;
  totalRevenue: number;
  pendingRevenue: number;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  doctorId?: string;
}
