import { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { procedureService } from '../../services/procedureService';
import { financialRecordService } from '../../services/financialRecordService';
import { appointmentService } from '../../services/appointmentService';
import { followUpService } from '../../services/followUpService';
import { patientFileService, type DocumentCategory } from '../../services/patientFileService';
import { communicationService } from '../../services/communicationService';
import { timelineService } from '../../services/timelineService';
import { useAuth } from '../../context/AuthContext';
import { implantFormService } from '../../services/implantFormService';
import ImplantFormDialog from '../../components/implantForm/ImplantFormDialog';
import ImplantFormViewer from '../../components/implantForm/ImplantFormViewer';
import Copyable from '../../components/ui/Copyable';
import type { Patient, FinancialRecord, PatientFile, Communication, ChangeReason, ImplantForm, ProcedureDoctor } from '../../types';
import ReasonDialog from '../../components/ReasonDialog';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import FixedOverlay from '../../components/ui/FixedOverlay';
import {
  ArrowLeft, Camera, Edit3, Save, X, Calendar, Phone, Mail, User, Activity,
  FileText, DollarSign, Clock, CreditCard, Plus,
  Upload, Download, Trash2, Image, File, Search,
  AlertCircle, Check, Eye, Pill, AlertTriangle, Printer, ScrollText, Undo2
} from 'lucide-react';

/* ─── Constants ─── */
const tabs = ['Overview', 'Medical History', 'Implant Procedures', 'Financial', 'Appointments', 'Documents', 'Timeline'] as const;
const tabKeys: Record<string, string> = {
  Overview: 'profile.tabs_overview',
  'Medical History': 'profile.tabs_medical',
  'Implant Procedures': 'profile.tabs_procedures',
  Financial: 'profile.tabs_financial',
  Appointments: 'profile.tabs_appointments',
  Documents: 'profile.tabs_documents',
  Timeline: 'profile.tabs_timeline',
};
const docCategoryKeys: Record<string, string> = {
  'CBCT': 'profile.documents_category_cbct',
  'Panorama': 'profile.documents_category_panorama',
  'X-Ray': 'profile.documents_category_xray',
  'Blood Analysis': 'profile.documents_category_blood',
  'Prescription': 'profile.documents_category_prescription',
  'Clinical Photos': 'profile.documents_category_photos',
  'Treatment Plan': 'profile.documents_category_treatment',
  'Other': 'profile.documents_category_other',
};
const statusColors: Record<string, { bg: string; text: string }> = {
  Paid: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8' },
  Partial: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF' },
  Pending: { bg: 'rgba(255,193,7,0.12)', text: '#FFC107' },
};
const docCategories: { value: DocumentCategory; icon: string }[] = [
  { value: 'CBCT', icon: '🦷' }, { value: 'Panorama', icon: '🖼' }, { value: 'X-Ray', icon: '📡' },
  { value: 'Blood Analysis', icon: '🧪' }, { value: 'Prescription', icon: '📋' }, { value: 'Clinical Photos', icon: '📷' },
  { value: 'Treatment Plan', icon: '📄' }, { value: 'Other', icon: '📁' },
];
const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';

/* ─── Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.4)' };
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.bg, color: c.text }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />{status}</span>;
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-[16px] p-4 transition-all hover:-translate-y-0.5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}22` }}>
            {icon}
          </div>
        </div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    </div>
  );
}

/* ─── Section Wrapper ─── */
function Section({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[18px] p-5 ${className}`} style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
      {title && <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>}
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PATIENT PROFILE COMPONENT
   ══════════════════════════════════════════════ */
export default function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invForm, setInvForm] = useState({ invoice_name: '', total_amount: '', notes: '' });
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<FinancialRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundingInvoice, setRefundingInvoice] = useState<FinancialRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundType, setRefundType] = useState<'insurance' | 'cash'>('cash');
  const [refundMethod, setRefundMethod] = useState('cash');

  const [reasonDialog, setReasonDialog] = useState<{
    open: boolean;
    title: string;
    onConfirm: (r: ChangeReason) => void;
  }>({ open: false, title: '', onConfirm: () => {} });

  const [payMethod, setPayMethod] = useState('cash');
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [apptForm, setApptForm] = useState({ appointment_date: '', status: 'scheduled' });
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Other');
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [showStatement, setShowStatement] = useState(false);
  const [, setPrintInvoice] = useState<FinancialRecord | null>(null);
  const [showImplantFormDialog, setShowImplantFormDialog] = useState(false);
  const [showImplantFormViewer, setShowImplantFormViewer] = useState(false);
  const [editingImplantForm, setEditingImplantForm] = useState<ImplantForm | null>(null);
  const [viewingImplantForm, setViewingImplantForm] = useState<ImplantForm | null>(null);

  /* ── Queries ── */
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id], queryFn: () => patientService.getById(id!), enabled: !!id,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['patient-procedures', id], queryFn: () => procedureService.getByPatient(id!), enabled: !!id,
  });

  const procedureIds = useMemo(() => procedures.map(p => p.id), [procedures]);

  const { data: procedureDoctors = [] } = useQuery({
    queryKey: ['procedure-doctors', procedureIds],
    queryFn: () => procedureService.getDoctorsByProcedureIds(procedureIds),
    enabled: procedureIds.length > 0,
  });

  const doctorsByProcedure = useMemo(() => {
    const map: Record<string, ProcedureDoctor[]> = {};
    for (const pd of procedureDoctors) {
      if (!map[pd.procedure_id]) map[pd.procedure_id] = [];
      map[pd.procedure_id].push(pd);
    }
    return map;
  }, [procedureDoctors]);

  const { data: financialRecords = [] } = useQuery({
    queryKey: ['patient-financial', id], queryFn: () => financialRecordService.getByPatient(id!), enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'], queryFn: () => appointmentService.getAll(),
  });
  const patientAppointments = useMemo(() => appointments.filter(a => a.patient_id === id), [appointments, id]);

  const { data: followUps = [] } = useQuery({
    queryKey: ['follow-ups'], queryFn: () => followUpService.getAll(),
  });
  const patientFollowUps = useMemo(() => followUps.filter(f => f.patient_id === id), [followUps, id]);
  const failureEvents = useMemo(() => patientFollowUps.filter(f => f.healing_status === 'Failure'), [patientFollowUps]);

  const { data: documents = [], isError: docsError, refetch: refetchDocs } = useQuery({
    queryKey: ['patient-documents', id], queryFn: () => patientFileService.getByPatient(id!), enabled: !!id,
  });

  const { data: implantForms = [] } = useQuery({
    queryKey: ['patient-implant-forms', id], queryFn: () => implantFormService.getByPatient(id!), enabled: !!id,
  });

  useQuery({
    queryKey: ['patient-communications', id], queryFn: () => communicationService.getByPatient(id!), enabled: !!id,
  });

  const { data: timelineEvents = [] } = useQuery({
    queryKey: ['patient-timeline', id],
    queryFn: () => timelineService.getByPatient(id!),
    enabled: !!id,
  });

  const [showCommForm, setShowCommForm] = useState(false);
  const [commForm, setCommForm] = useState({ type: 'note' as Communication['type'], content: '', direction: 'outbound' as Communication['direction'] });
  const createCommMut = useMutation({
    mutationFn: () => communicationService.create({
      patient_id: id!, type: commForm.type, content: commForm.content, direction: commForm.direction,
    }),
    onSuccess: () => {
      toast.success('Communication recorded');
      setShowCommForm(false);
      setCommForm({ type: 'note', content: '', direction: 'outbound' });
      queryClient.invalidateQueries({ queryKey: ['patient-communications', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── Derived ── */
  const invoices = useMemo(() => financialRecords.filter(r => r.record_type === 'invoice'), [financialRecords]);
  const payments = useMemo(() => financialRecords.filter(r => r.record_type === 'payment'), [financialRecords]);
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_so_far), 0);
  const totalRemaining = invoices.reduce((s, i) => s + Number(i.remaining_amount), 0);
  const upcomingAppts = useMemo(() => patientAppointments.filter(a => new Date(a.appointment_date) >= new Date()).sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()), [patientAppointments]);

  /* ── Mutations ── */
  const invalPatient = () => queryClient.invalidateQueries({ queryKey: ['patient', id] });
  const invalFinancial = () => queryClient.invalidateQueries({ queryKey: ['patient-financial', id] });
  const invalAppointments = () => queryClient.invalidateQueries({ queryKey: ['appointments'] });
  const invalAll = () => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
    queryClient.invalidateQueries({ queryKey: ['procedures'] });
  };

  const updatePatientMut = useMutation({
    mutationFn: (data: Partial<Patient>) => patientService.update(id!, data),
    onSuccess: () => { toast.success(t('profile.toast_profile_updated')); invalPatient(); setEditing(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadImageMut = useMutation({
    mutationFn: (file: File) => patientService.uploadProfileImage(id!, file),
    onSuccess: () => { toast.success(t('profile.toast_image_updated')); invalPatient(); invalAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvoiceMut = useMutation({
    mutationFn: (data: { patient_name: string; invoice_name: string; total_amount: number; notes?: string; change_reason?: string; reason_category?: string }) =>
      financialRecordService.createInvoice({ patient_id: id!, ...data }),
    onSuccess: () => { toast.success(t('profile.toast_invoice_created')); invalFinancial(); setShowAddInvoice(false); setInvForm({ invoice_name: '', total_amount: '', notes: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayMut = useMutation({
    mutationFn: (data: { invoice_id: string; patient_name: string; amount: number; payment_method?: string; change_reason?: string; reason_category?: string }) =>
      financialRecordService.addPayment({ patient_id: id!, invoice_id: data.invoice_id, patient_name: data.patient_name, amount: data.amount, payment_method: data.payment_method as import('../../types').PaymentMethod | undefined, change_reason: data.change_reason, reason_category: data.reason_category }),
    onSuccess: () => { toast.success(t('profile.toast_payment_recorded')); invalFinancial(); setShowPayModal(false); setPayingInvoice(null); setPayAmount(''); },
    onError: (e: Error) => toast.error(e.message),
  });

  const refundMut = useMutation({
    mutationFn: (data: { invoice_id: string; amount: number; refund_type?: 'insurance' | 'cash'; payment_method?: string; change_reason?: string; reason_category?: string }) =>
      financialRecordService.createRefund({ invoice_id: data.invoice_id, patient_id: id!, patient_name: patient?.full_name || '', amount: data.amount, refund_type: data.refund_type, payment_method: data.payment_method, change_reason: data.change_reason, reason_category: data.reason_category }),
    onSuccess: () => { toast.success(t('profile.toast_refund_processed', 'Refund processed')); invalFinancial(); setShowRefundModal(false); setRefundingInvoice(null); setRefundAmount(''); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createApptMut = useMutation({
    mutationFn: () => appointmentService.create({ patient_id: id!, appointment_date: apptForm.appointment_date, status: apptForm.status }),
    onSuccess: () => { toast.success(t('profile.toast_appointment_created')); invalAppointments(); invalAll(); setShowAddAppt(false); setApptForm({ appointment_date: '', status: 'scheduled' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelApptMut = useMutation({
    mutationFn: (apptId: string) => appointmentService.updateStatus(apptId, 'cancelled'),
    onSuccess: () => { toast.success(t('profile.toast_appointment_cancelled')); invalAppointments(); invalAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteImplantFormMut = useMutation({
    mutationFn: (formId: string) => implantFormService.delete(formId),
    onSuccess: () => {
      toast.success('Implant form deleted');
      queryClient.invalidateQueries({ queryKey: ['patient-implant-forms', id] });
      setShowImplantFormViewer(false);
      setViewingImplantForm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── Edit handlers ── */
  const startEditing = useCallback(() => {
    if (!patient) return;
    setEditForm({
      full_name: patient.full_name, phone: patient.phone || '', email: patient.email || '',
      gender: patient.gender || '', date_of_birth: patient.date_of_birth || '',
      medical_history: patient.medical_history || '',
      chronic_disease: patient.chronic_disease || '', medication: patient.medication || '',
      allergies: patient.allergies || '', smoking_status: patient.smoking_status || '',
      external_medical_code: patient.external_medical_code || '', insurance_company: patient.insurance_company || '',
    });
    setEditing(true);
  }, [patient]);

  const cleanFormData = (data: Record<string, string>): Partial<Patient> => {
    const cleaned: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = value.trim() === '' ? null : value;
    }
    return cleaned as Partial<Patient>;
  };

  const handleSaveProfile = () => {
    updatePatientMut.mutate(cleanFormData(editForm));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    uploadImageMut.mutate(file);
  };

  /* ── Document handlers ── */
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploadingDocs(true);
    try {
      for (const file of Array.from(files)) {
        await patientFileService.upload(id!, file, docCategory);
      }
      await refetchDocs();
      toast.success(t('profile.toast_files_uploaded', { count: files.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.toast_upload_failed'));
    }
    setUploadingDocs(false);
  };

  const handleDeleteDoc = async (doc: PatientFile) => {
    try {
      await patientFileService.delete(doc.id, doc.storage_path);
      await refetchDocs();
      toast.success(t('profile.toast_file_deleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.toast_delete_failed'));
    }
  };

  const handleRenameDoc = async (docId: string) => {
    try {
      await patientFileService.rename(docId, editDocName);
      setEditDocId(null);
      await refetchDocs();
      toast.success(t('profile.toast_file_renamed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const filteredDocs = useMemo(() => {
    const fileItems = documents.map(d => ({ type: 'file' as const, data: d, date: d.created_at || '' }));
    const formItems = implantForms.map(f => ({ type: 'form' as const, data: f, date: f.created_at || '' }));
    let all = [...fileItems, ...formItems];
    if (docSearch) {
      const q = docSearch.toLowerCase();
      all = all.filter(item => {
        if (item.type === 'file') return (item.data as PatientFile).file_name.toLowerCase().includes(q) || (item.data as PatientFile).category.toLowerCase().includes(q);
        const f = item.data as ImplantForm;
        return f.implant_type.toLowerCase().includes(q) || f.tooth_number.toLowerCase().includes(q) || f.manufacturer.toLowerCase().includes(q);
      });
    }
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [documents, implantForms, docSearch]);

  /* ── Invoice / Payment handlers ── */
  const handleCreateInvoice = () => {
    if (!invForm.invoice_name.trim() || !invForm.total_amount) { toast.error(t('profile.toast_name_amount_required')); return; }
    createInvoiceMut.mutate({ patient_name: patient?.full_name || '', invoice_name: invForm.invoice_name, total_amount: Number(invForm.total_amount), notes: invForm.notes || undefined });
  };

  const handlePay = () => {
    if (!payingInvoice || !payAmount || Number(payAmount) <= 0) { toast.error(t('profile.toast_amount_positive')); return; }
    addPayMut.mutate({ invoice_id: payingInvoice.id, patient_name: patient?.full_name || '', amount: Number(payAmount), payment_method: payMethod });
  };

  const handleRefund = () => {
    if (!refundingInvoice || !refundAmount || Number(refundAmount) <= 0) { toast.error(t('profile.toast_amount_positive')); return; }
    const amt = Number(refundAmount);
    if (amt > Number(refundingInvoice.paid_so_far)) { toast.error('Refund amount exceeds paid amount'); return; }
    setReasonDialog({
      open: true,
      title: refundType === 'insurance' ? 'Reason for Insurance Refund' : 'Reason for Cash Refund',
      onConfirm: (r) => {
        refundMut.mutate({ invoice_id: refundingInvoice.id, amount: amt, refund_type: refundType, payment_method: refundMethod, change_reason: r.reason, reason_category: r.category });
      },
    });
  };

  /* ── Print Receipt ── */
  const handlePrintReceipt = (invoice: FinancialRecord) => {
    setPrintInvoice(invoice);
    setTimeout(() => {
      const printContent = document.getElementById('printable-receipt');
      if (printContent) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`
            <html>
              <head>
                <title>${t('profile.print_receipt')} - ${invoice.invoice_name}</title>
                <style>
                  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { font-family: 'Inter', sans-serif; background: #fff; color: #111; padding: 40px; font-size: 13px; }
                  .receipt { max-width: 500px; margin: 0 auto; }
                  .header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #111; }
                  .header h1 { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
                  .header p { color: #666; font-size: 12px; margin-top: 4px; }
                  .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
                  .info div { line-height: 1.6; }
                  .info .label { color: #888; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 12px; }
                  th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; color: #666; }
                  .total-row td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; padding-top: 12px; font-size: 14px; }
                  .payments { margin-top: 20px; }
                  .payments h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 8px; }
                  .payment-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
                  .footer { text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
                  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
                  .badge.paid { background: #d4edda; color: #155724; }
                  .badge.pending { background: #fff3cd; color: #856404; }
                  .badge.partial { background: #cce5ff; color: #004085; }
                  @media print {
                    body { padding: 20px; }
                  }
                </style>
              </head>
              <body>
                <div class="receipt">
                  <div class="header">
                    <h1>TrackImplant</h1>
                    <p>Dental Implant Clinic</p>
                  </div>
                  <div class="info">
                    <div>
                      <div class="label">${t('profile.name_label')}</div>
                      <div style="font-weight:600">${patient?.full_name || ''}</div>
                      <div class="label" style="margin-top:4px">${t('profile.modal_statement_invoice')}</div>
                      <div>${invoice.invoice_name || ''}</div>
                    </div>
                    <div style="text-align:right">
                      <div class="label">${t('profile.modal_statement_date')}</div>
                      <div>${invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : t('common.dash')}</div>
                      <div class="label" style="margin-top:4px">${t('profile.modal_appt_status')}</div>
                      <div><span class="badge ${invoice.status.toLowerCase()}">${invoice.status}</span></div>
                    </div>
                  </div>
                  <table>
                    <tr><th>${t('profile.modal_statement_description')}</th><th style="text-align:right">${t('profile.modal_statement_amount')}</th></tr>
                    <tr><td>${invoice.invoice_name || t('profile.modal_statement_invoice')}</td><td style="text-align:right">$${Number(invoice.total_amount).toLocaleString()}</td></tr>
                    <tr class="total-row"><td>${t('profile.total_label')}</td><td style="text-align:right">$${Number(invoice.total_amount).toLocaleString()}</td></tr>
                  </table>
                  <div class="payments">
                    <h3>${t('profile.payment_history')}</h3>
                    ${(() => {
                      const invPayments = payments.filter(p => p.parent_invoice_id === invoice.id);
                      return invPayments.length > 0
                        ? invPayments.map(p => `<div class="payment-item"><span>${p.created_at ? new Date(p.created_at).toLocaleDateString() : t('common.dash')}${p.payment_method ? ' · ' + (t('profile.payment_method_' + p.payment_method) || p.payment_method.replace('_', ' ')) : ''}</span><span style="font-weight:600">$${Number(p.amount).toLocaleString()}</span></div>`).join('')
                        : '<div style="color:#888;font-size:12px">' + t('profile.modal_statement_empty') + '</div>';
                    })()}
                  </div>
                  <div class="footer">
                    <p>Thank you for your visit</p>
                    <p style="margin-top:2px">TrackImplant v1.0 · Generated ${new Date().toLocaleString()}</p>
                  </div>
                </div>
                <script>window.onload = function() { window.print(); window.close(); }</script>
              </body>
            </html>
          `);
          win.document.close();
        }
      }
      setPrintInvoice(null);
    }, 100);
  };

  const fileExtIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5" style={{ color: '#4FD1FF' }} />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5" style={{ color: '#FF6B6B' }} />;
    return <File className="w-5 h-5" style={{ color: '#FFC107' }} />;
  };

  if (patientLoading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" /></div>
  );
  if (!patient) return <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.patient_not_found')}</div>;

  return (
    <div className="font-sans select-auto space-y-6">
      {/* ── Back Button ── */}
      <button onClick={() => navigate('/dashboard/patients')} className="flex items-center gap-2 text-xs font-medium transition-all hover:gap-3" style={{ color: '#4FD1FF' }}>
        <ArrowLeft className="w-4 h-4" /> {t('profile.back_to_patients')}
      </button>

      {/* ══════════════════════════════════════
          PROFILE HEADER
          ══════════════════════════════════════ */}
      <div className="rounded-[22px] p-6 relative overflow-hidden" style={{ background: 'rgba(13,24,40,0.9)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold"
              style={{ background: 'rgba(79,209,255,0.12)', border: '2px solid rgba(79,209,255,0.2)' }}>
              {patient.profile_image_url ? (
                <img src={patient.profile_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: '#4FD1FF' }}>{patient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
              style={{ background: '#4FD1FF', color: '#050B14' }}>
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white">{patient.full_name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><Phone className="w-3 h-3" />{patient.phone ? <Copyable text={patient.phone}>{patient.phone}</Copyable> : t('common.dash')}</span>
                  {patient.email && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><Mail className="w-3 h-3" />{patient.email ? <Copyable text={patient.email}>{patient.email}</Copyable> : patient.email}</span>}
                  {patient.gender && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><User className="w-3 h-3" />{patient.gender}</span>}
                  {patient.date_of_birth && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><Calendar className="w-3 h-3" />{new Date(patient.date_of_birth).toLocaleDateString()}</span>}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
                    <Copyable text={patient.id}>{t('profile.id_prefix')} #{patient.id.slice(0, 8).toUpperCase()}</Copyable>
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{t('profile.registered_prefix')} {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : t('common.dash')}</span>
                  {patient.external_medical_code && <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: 'rgba(79,209,255,0.08)', color: '#4FD1FF' }}>
                    <Copyable text={patient.external_medical_code}>{patient.external_medical_code}</Copyable>
                  </span>}
                  {patient.home_branch_name && <span className="text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ background: 'rgba(0,229,168,0.08)', color: '#00E5A8' }}>
                    {patient.home_branch_name}
                  </span>}
                  <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: patient.insurance_company ? 'rgba(79,209,255,0.08)' : 'rgba(0,229,168,0.08)', color: patient.insurance_company ? '#4FD1FF' : '#00E5A8' }}>{patient.insurance_company || 'Cash'}</span>
                </div>
              </div>
              <button onClick={editing ? handleSaveProfile : startEditing} disabled={updatePatientMut.isPending}
                className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all active:scale-[0.98]"
                style={{ background: editing ? 'linear-gradient(135deg, #00E5A8, #45D6FF)' : 'rgba(79,209,255,0.1)', border: editing ? 'none' : '1px solid rgba(79,209,255,0.15)', color: editing ? '#050B14' : '#4FD1FF' }}>
                {editing ? <><Save className="w-3.5 h-3.5" /> {updatePatientMut.isPending ? t('profile.saving_profile') : t('profile.save_profile')}</> : <><Edit3 className="w-3.5 h-3.5" /> {t('profile.edit_profile')}</>}
              </button>
            </div>
            {editing && (
              <button onClick={() => setEditing(false)} className="ml-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('common.cancel')}</button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          TABS
          ══════════════════════════════════════ */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap"
            style={{
              color: activeTab === tab ? '#4FD1FF' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === tab ? '2px solid #4FD1FF' : '2px solid transparent',
            }}>
            {t(tabKeys[tab])}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB 1: OVERVIEW
          ══════════════════════════════════════ */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={<Activity className="w-4 h-4" color="#4FD1FF" />} label={t('profile.stat_active_procedures')} value={procedures.length.toString()} color="#4FD1FF" />
            <StatCard icon={<FileText className="w-4 h-4" color="#7C5CFF" />} label={t('profile.stat_total_invoiced')} value={`$${totalInvoiced.toLocaleString()}`} color="#7C5CFF" />
            <StatCard icon={<DollarSign className="w-4 h-4" color="#00E5A8" />} label={t('profile.stat_total_paid')} value={`$${totalPaid.toLocaleString()}`} color="#00E5A8" />
            <StatCard icon={<Clock className="w-4 h-4" color="#FFC107" />} label={t('profile.stat_remaining')} value={`$${totalRemaining.toLocaleString()}`} color="#FFC107" />
            <StatCard icon={<Calendar className="w-4 h-4" color="#4FD1FF" />} label={t('profile.stat_upcoming_appts')} value={upcomingAppts.length.toString()} color="#4FD1FF" />
            <StatCard icon={<FileText className="w-4 h-4" color="#FF6B6B" />} label={t('profile.stat_documents')} value={documents.length.toString()} color="#FF6B6B" />
          </div>

          {/* Quick Info */}
          <Section title={t('profile.patient_summary')}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.name_label')}: </span><span className="text-white"><Copyable text={patient.full_name}>{patient.full_name}</Copyable></span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.phone_label')}: </span><span className="text-white">{patient.phone ? <Copyable text={patient.phone}>{patient.phone}</Copyable> : t('common.dash')}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.email_label')}: </span><span className="text-white">{patient.email ? <Copyable text={patient.email}>{patient.email}</Copyable> : t('common.dash')}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.gender_label')}: </span><span className="text-white">{patient.gender || t('common.dash')}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.dob_label')}: </span><span className="text-white">{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : t('common.dash')}</span></div>
              {patient.smoking_status && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.smoking_label')}: </span><span className="text-white">{patient.smoking_status}</span></div>}
              {patient.external_medical_code && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>External Code: </span><span className="text-[#4FD1FF] font-mono">{patient.external_medical_code}</span></div>}
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Payment: </span><span className="text-white" style={{ color: patient.insurance_company ? '#4FD1FF' : '#00E5A8' }}>{patient.insurance_company || 'Cash'}</span></div>
            </div>
          </Section>

          {/* Recent Procedures */}
          {procedures.length > 0 && (
            <Section title={t('profile.recent_procedures', { count: procedures.length })}>
              <div className="space-y-2">
                {procedures.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div className="text-sm font-medium text-white">{p.procedure_name}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.procedure_tooth_date', { tooth: p.tooth_number || t('common.dash'), date: p.procedure_date ? new Date(p.procedure_date).toLocaleDateString() : t('common.dash') })}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Upcoming Appointments */}
          {upcomingAppts.length > 0 && (
            <Section title={t('profile.upcoming_appointments')}>
              <div className="space-y-2">
                {upcomingAppts.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div className="text-sm text-white">{new Date(a.appointment_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Implant Failure Timeline Events */}
          {failureEvents.length > 0 && (
            <Section title={t('profile.failure_timeline')}>
              <div className="space-y-3">
                {failureEvents.map(fe => (
                  <div key={fe.id} className="flex items-start gap-3 p-4 rounded-xl animate-fadeIn"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                      <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#ef4444]">{t('profile.failure_recorded')}</span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {fe.created_at ? new Date(fe.created_at).toLocaleDateString() : t('common.dash')}
                        </span>
                      </div>
                      {fe.notes && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{fe.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 2: MEDICAL HISTORY
          ══════════════════════════════════════ */}
      {activeTab === 'Medical History' && (
        <Section>
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'medical_history', label: 'edit_mode_medical_history', full: true, multiline: true },
                { key: 'chronic_disease', label: 'edit_mode_chronic' },
                { key: 'medication', label: 'edit_mode_medications' },
                { key: 'allergies', label: 'edit_mode_allergies' },
                { key: 'smoking_status', label: 'edit_mode_smoking' },
                { key: 'external_medical_code', label: 'External Medical Code' },
                { key: 'insurance_company', label: 'Insurance Company' },
              ].map(f => (
                <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.' + f.label)}</label>
                  {f.multiline ? (
                    <textarea value={editForm[f.key] || ''} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} rows={3} className={inputCls + ' h-20 pt-2 resize-none'} />
                  ) : (
                    <input value={editForm[f.key] || ''} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputCls} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Medical History */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(79,209,255,0.03)', border: '1px solid rgba(79,209,255,0.08)' }}>
                <h4 className="text-xs font-semibold text-[#4FD1FF] mb-2 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {t('profile.medical_history_title')}</h4>
                <p className="text-sm" style={{ color: patient.medical_history ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>{patient.medical_history || t('profile.no_medical_history')}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><Pill className="w-3.5 h-3.5" style={{ color: '#FFC107' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.chronic_disease')}</span></div>
                  <p className="text-sm text-white">{patient.chronic_disease || t('common.dash')}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><Pill className="w-3.5 h-3.5" style={{ color: '#00E5A8' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.medications')}</span></div>
                  <p className="text-sm text-white">{patient.medication || t('common.dash')}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><AlertCircle className="w-3.5 h-3.5" style={{ color: '#FF6B6B' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.allergies')}</span></div>
                  <p className="text-sm text-white">{patient.allergies || t('common.dash')}</p>
                </div>
              </div>
              {patient.smoking_status && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5" style={{ color: '#FFC107' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.smoking_status')}</span></div>
                  <p className="text-sm text-white">{patient.smoking_status}</p>
                </div>
              )}
              {!editing && (
                <button onClick={startEditing} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
                  <Edit3 className="w-3.5 h-3.5" /> {t('profile.edit_medical_history')}
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ══════════════════════════════════════
          TAB 3: IMPLANT PROCEDURES
          ══════════════════════════════════════ */}
      {activeTab === 'Implant Procedures' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.procedures_found', { count: procedures.length })}</span>
            <button onClick={() => navigate('/dashboard/cases')} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
              <Plus className="w-3.5 h-3.5" /> {t('profile.new_procedure')}
            </button>
          </div>
          {procedures.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
              {t('profile.no_procedures_hint')}
            </div>
          ) : procedures.map(p => (
            <div key={p.id} className="rounded-[18px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{p.procedure_name}</h4>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.procedure_tooth_date', { tooth: p.tooth_number || t('common.dash'), date: p.procedure_date ? new Date(p.procedure_date).toLocaleDateString() : t('common.dash') })}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {p.implant_system && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.system_label')}: </span><span className="text-white">{p.implant_system}</span></div>}
                {p.implant_size && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.size_label')}: </span><span className="text-white">{p.implant_size}</span></div>}
                {p.implant_decision && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.decision_label')}: </span><span className="text-white">{p.implant_decision}</span></div>}
                {p.abutment_type && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.abutment_label')}: </span><span className="text-white">{p.abutment_type}</span></div>}
                {p.bone_condition && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.bone_label')}: </span><span className="text-white">{p.bone_condition}</span></div>}
                {doctorsByProcedure[p.id] && doctorsByProcedure[p.id].length > 0 && (
                  <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.doctor_label')}: </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {doctorsByProcedure[p.id].map(pd => (
                        <span key={pd.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: pd.role_in_procedure === 'primary' ? 'rgba(79,209,255,0.12)' : 'rgba(255,255,255,0.06)', color: pd.role_in_procedure === 'primary' ? '#4FD1FF' : 'rgba(255,255,255,0.5)' }}>
                          {pd.doctor_name || pd.doctor_id}
                          {pd.role_in_procedure === 'primary' && <span style={{ color: '#4FD1FF', opacity: 0.6 }}>★</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p.extraction_needed !== undefined && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.extraction_label')}: </span><span className="text-white">{p.extraction_needed ? t('common.yes') : t('common.no')}</span></div>}
              </div>
              {p.notes && <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.notes}</p>}
              {(p.bone_height || p.bone_width || p.ct_scan_notes) && (
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4FD1FF]">{t('profile.cbct_heading')}</span>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs">
                    {p.bone_height && <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('profile.height_label')}: <span className="text-white">{p.bone_height}mm</span></span>}
                    {p.bone_width && <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('profile.width_label')}: <span className="text-white">{p.bone_width}mm</span></span>}
                    {p.ct_scan_notes && <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('profile.notes_label')}: <span className="text-white">{p.ct_scan_notes}</span></span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 4: FINANCIAL
          ══════════════════════════════════════ */}
      {activeTab === 'Financial' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(0,229,168,0.06)', border: '1px solid rgba(0,229,168,0.1)' }}>
              <div className="text-lg font-bold text-[#00E5A8]">${totalPaid.toLocaleString()}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.financial_paid')}</div>
            </div>
            <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.1)' }}>
              <div className="text-lg font-bold text-[#FFC107]">${totalRemaining.toLocaleString()}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.financial_remaining')}</div>
            </div>
            <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.1)' }}>
              <div className="text-lg font-bold text-[#7C5CFF]">{invoices.length}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.financial_invoices')}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.invoice_count', { count: invoices.length })}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowStatement(true)} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.15)', color: '#7C5CFF' }}>
                <ScrollText className="w-3.5 h-3.5" /> {t('profile.statement')}
              </button>
              <button onClick={() => setShowAddInvoice(true)} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                <Plus className="w-3.5 h-3.5" /> {t('profile.new_invoice')}
              </button>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>{t('profile.no_invoices')}</div>
          ) : invoices.map(inv => {
            const invPayments = payments.filter(p => p.parent_invoice_id === inv.id);
            return (
              <div key={inv.id} className="rounded-[18px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{inv.invoice_name}</h4>
                    {inv.branch_name && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                          {inv.branch_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.total_label')}: ${Number(inv.total_amount).toLocaleString()}</span>
                      <span className="text-xs text-[#00E5A8]">{t('profile.paid_label')}: ${Number(inv.paid_so_far).toLocaleString()}</span>
                      <span className="text-xs text-[#FFC107]">{t('profile.remaining_label')}: ${Number(inv.remaining_amount).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.status} />
                    <button onClick={() => handlePrintReceipt(inv)} title={t('profile.print_receipt')}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#4FD1FF', background: 'rgba(79,209,255,0.1)' }}>
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {inv.status !== 'Paid' && (
                      <button onClick={() => { setPayingInvoice(inv); setShowPayModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#00E5A8', background: 'rgba(0,229,168,0.1)' }}>
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {Number(inv.paid_so_far) > 0 && (
                      <button onClick={() => { setRefundingInvoice(inv); setRefundAmount(''); setShowRefundModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Payment Timeline */}
                {invPayments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{t('profile.payment_history')}</span>
                    <div className="mt-2 space-y-1.5">
                      {invPayments.map(p => {
                        const isRefund = Number(p.amount) < 0;
                        const refundTypeLabel = isRefund && p.notes?.startsWith('[Insurance Refund]') ? 'Insurance' : isRefund ? 'Cash' : null;
                        return (
                        <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: isRefund ? 'rgba(239,68,68,0.03)' : 'rgba(0,229,168,0.03)', border: `1px solid ${isRefund ? 'rgba(239,68,68,0.06)' : 'rgba(0,229,168,0.06)'}` }}>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isRefund ? 'text-[#ef4444]' : 'text-white'}`}>${isRefund ? '-' : ''}${Math.abs(Number(p.amount)).toLocaleString()}</span>
                            {p.payment_method && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isRefund ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)', color: isRefund ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>{t('profile.payment_method_' + p.payment_method) || p.payment_method.replace('_', ' ')}</span>
                            )}
                            {isRefund && refundTypeLabel && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: refundTypeLabel === 'Insurance' ? 'rgba(79,209,255,0.1)' : 'rgba(0,229,168,0.1)', color: refundTypeLabel === 'Insurance' ? '#4FD1FF' : '#00E5A8' }}>
                                {refundTypeLabel}
                              </span>
                            )}
                          </div>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : t('common.dash')}</span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 5: APPOINTMENTS
          ══════════════════════════════════════ */}
      {activeTab === 'Appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.appointments_count', { count: patientAppointments.length })}</span>
            <button onClick={() => setShowAddAppt(true)} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
              <Plus className="w-3.5 h-3.5" /> {t('profile.new_appointment')}
            </button>
          </div>
          {patientAppointments.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>{t('profile.no_appointments')}</div>
          ) : patientAppointments.map(a => (
            <div key={a.id} className="rounded-[18px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{new Date(a.appointment_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.status !== 'cancelled' && a.status !== 'completed' && (
                    <button onClick={() => cancelApptMut.mutate(a.id)} className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.15)', color: '#FF6B6B' }}>
                      {t('profile.cancel_appointment')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 6: DOCUMENTS
          ══════════════════════════════════════ */}
      {activeTab === 'Documents' && (
        <div className="space-y-4">
          {/* Upload Area */}
          <div className="rounded-[18px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 flex-wrap">
                <select value={docCategory} onChange={e => setDocCategory(e.target.value as DocumentCategory)}
                  className="h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer min-w-[140px]">
                  {docCategories.map(c => <option key={c.value} value={c.value} style={{ background: '#0D1B2A' }}>{c.icon} {t(docCategoryKeys[c.value])}</option>)}
                </select>
                <button onClick={() => docUploadRef.current?.click()} disabled={uploadingDocs}
                  className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                  <Upload className="w-4 h-4" /> {uploadingDocs ? t('profile.documents_uploading') : t('profile.documents_upload')}
                </button>
                <input ref={docUploadRef} type="file" multiple className="hidden" onChange={handleDocUpload} />
                <button onClick={() => { setEditingImplantForm(null); setShowImplantFormDialog(true); }}
                  className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.15)', color: '#7C5CFF' }}>
                  <FileText className="w-4 h-4" /> Implant Form
                </button>
              </div>
              <div className="relative w-full md:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
                <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('profile.documents_search')} className="w-full h-10 pl-9 pr-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500" />
              </div>
            </div>
          </div>

          {/* File Grid */}
          {docsError ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: '#FF6B6B' }}>
              {t('profile.documents_failed')} <button onClick={() => refetchDocs()} className="underline" style={{ color: '#4FD1FF' }}>{t('profile.documents_retry')}</button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
              {docSearch ? t('profile.documents_no_match') : t('profile.documents_empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredDocs.map(item => item.type === 'file' ? (
                <div key={item.data.id} className="rounded-[16px] p-4 transition-all hover:-translate-y-0.5 group" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {(item.data as PatientFile).file_type.startsWith('image/') ? (
                    <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-[rgba(0,0,0,0.3)] flex items-center justify-center">
                      <img src={(item.data as PatientFile).public_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {fileExtIcon((item.data as PatientFile).file_type)}
                    </div>
                  )}
                  {editDocId === item.data.id ? (
                    <div className="flex items-center gap-1">
                      <input value={editDocName} onChange={e => setEditDocName(e.target.value)} className="flex-1 h-7 px-2 rounded-lg text-xs outline-none bg-[rgba(255,255,255,0.06)] text-white" autoFocus />
                      <button onClick={() => handleRenameDoc(item.data.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: '#00E5A8' }}><Check className="w-3 h-3" /></button>
                      <button onClick={() => setEditDocId(null)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: '#FF6B6B' }}><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-white truncate">{(item.data as PatientFile).file_name}</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(79,209,255,0.08)', color: '#4FD1FF' }}>{(item.data as PatientFile).category}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{(item.data as PatientFile).file_size ? t('profile.documents_file_size', { size: ((item.data as PatientFile).file_size! / 1024).toFixed(0) }) : ''}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                    {(item.data as PatientFile).public_url && (
                      <a href={(item.data as PatientFile).public_url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[10px] font-medium transition-all"
                        style={{ background: 'rgba(79,209,255,0.08)', color: '#4FD1FF' }}>
                        <Eye className="w-3 h-3" /> {t('profile.documents_view')}
                      </a>
                    )}
                    {(item.data as PatientFile).public_url && (
                      <a href={(item.data as PatientFile).public_url} download={(item.data as PatientFile).file_name}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => { setEditDocId(item.data.id); setEditDocName((item.data as PatientFile).file_name); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteDoc(item.data)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(255,107,107,0.1)]" style={{ color: '#FF6B6B' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={item.data.id} className="rounded-[16px] p-4 transition-all hover:-translate-y-0.5 group" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(124,92,255,0.15)' }}>
                  <div className="w-full h-32 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'rgba(124,92,255,0.06)' }}>
                    <FileText className="w-10 h-10" style={{ color: '#7C5CFF' }} />
                  </div>
                  <p className="text-xs font-medium text-white truncate">Implant Form — {(item.data as ImplantForm).tooth_number}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        background: (item.data as ImplantForm).status === 'Completed' ? 'rgba(0,229,168,0.12)' : 'rgba(255,193,7,0.12)',
                        color: (item.data as ImplantForm).status === 'Completed' ? '#00E5A8' : '#FFC107',
                      }}>
                      {(item.data as ImplantForm).status}
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{(item.data as ImplantForm).implant_type}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                    <button onClick={() => { setViewingImplantForm(item.data as ImplantForm); setShowImplantFormViewer(true); }}
                      className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[10px] font-medium transition-all"
                      style={{ background: 'rgba(124,92,255,0.08)', color: '#7C5CFF' }}>
                      <Eye className="w-3 h-3" /> View
                    </button>
                    <button onClick={() => { setEditingImplantForm(item.data as ImplantForm); setShowImplantFormDialog(true); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color: '#4FD1FF' }}>
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteImplantFormMut.mutate(item.data.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(255,107,107,0.1)]" style={{ color: '#FF6B6B' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 7: TIMELINE
          ══════════════════════════════════════ */}
      {activeTab === 'Timeline' && (
        <div className="space-y-3">
          {timelineEvents.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">No timeline events recorded yet</p>
            </div>
          ) : (
            <div className="space-y-0">
              {timelineEvents.map(event => (
                <div key={event.id} className="flex items-start gap-4 p-4 rounded-xl transition-colors hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
                  onClick={() => {
                    if (event.related_entity_type === 'appointment') navigate(`/dashboard/schedule`);
                    else if (event.related_entity_type === 'procedure') navigate(`/dashboard/cases`);
                    else if (event.related_entity_type === 'financial_record') navigate(`/dashboard/payments`);
                  }}
                  style={{ borderLeft: `2px solid rgba(255,255,255,0.06)` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: 'rgba(79,209,255,0.08)' }}>
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium">{event.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span>{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>{event.time}</span>
                      {event.user_name && <span>by {event.user_name}</span>}
                      {event.branch_name && <span>at {event.branch_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Add Communication Modal ─── */}
      {showCommForm && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => setShowCommForm(false)}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">Record Communication</h2>
              <button onClick={() => setShowCommForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Type</label>
                <select value={commForm.type} onChange={e => setCommForm(f => ({ ...f, type: e.target.value as Communication['type'] }))}
                  className={inputCls + ' cursor-pointer'}>
                  <option value="note" style={{ background: '#0D1B2A' }}>Note</option>
                  <option value="call" style={{ background: '#0D1B2A' }}>Phone Call</option>
                  <option value="email" style={{ background: '#0D1B2A' }}>Email</option>
                  <option value="sms" style={{ background: '#0D1B2A' }}>SMS</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Direction</label>
                <select value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value as Communication['direction'] }))}
                  className={inputCls + ' cursor-pointer'}>
                  <option value="outbound" style={{ background: '#0D1B2A' }}>Outbound (to patient)</option>
                  <option value="inbound" style={{ background: '#0D1B2A' }}>Inbound (from patient)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Content</label>
                <textarea value={commForm.content} onChange={e => setCommForm(f => ({ ...f, content: e.target.value }))}
                  rows={3} className={inputCls + ' h-20 pt-2 resize-none'} placeholder="Enter notes or message content..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowCommForm(false)} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => createCommMut.mutate()} disabled={!commForm.content.trim() || createCommMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {createCommMut.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Add Invoice Modal */}
      {showAddInvoice && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => setShowAddInvoice(false)}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">{t('profile.modal_new_invoice')}</h2>
              <button onClick={() => setShowAddInvoice(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_invoice_name')}</label>
                <input value={invForm.invoice_name} onChange={e => setInvForm(f => ({ ...f, invoice_name: e.target.value }))} placeholder={t('profile.modal_invoice_placeholder')} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_total_amount')}</label>
                <input type="number" min="0" step="0.01" value={invForm.total_amount} onChange={e => setInvForm(f => ({ ...f, total_amount: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_notes')}</label>
                <textarea value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' h-16 pt-2 resize-none'} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowAddInvoice(false)} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('common.cancel')}</button>
              <button onClick={handleCreateInvoice} disabled={createInvoiceMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {createInvoiceMut.isPending ? t('profile.modal_creating') : t('profile.modal_create_invoice')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* Record Payment Modal */}
      {showPayModal && payingInvoice && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => { setShowPayModal(false); setPayingInvoice(null); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <div>
                <h2 className="text-lg font-bold text-white">{t('profile.modal_record_payment')}</h2>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{payingInvoice.invoice_name}</p>
              </div>
              <button onClick={() => { setShowPayModal(false); setPayingInvoice(null); }} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('profile.total_label')}: ${Number(payingInvoice.total_amount).toLocaleString()}</span>
                <span className="text-xs text-[#00E5A8]">{t('profile.paid_label')}: ${Number(payingInvoice.paid_so_far).toLocaleString()}</span>
                <span className="text-xs text-[#FFC107]">{t('profile.remaining_label')}: ${Number(payingInvoice.remaining_amount).toLocaleString()}</span>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_amount')}</label>
                <input type="number" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_method')}</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="cash" style={{ background: '#0D1B2A' }}>{t('profile.payment_method_cash')}</option>
                  <option value="card" style={{ background: '#0D1B2A' }}>{t('profile.payment_method_card')}</option>
                  <option value="insurance" style={{ background: '#0D1B2A' }}>{t('profile.payment_method_insurance')}</option>
                  <option value="bank_transfer" style={{ background: '#0D1B2A' }}>{t('profile.payment_method_bank_transfer')}</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => { setShowPayModal(false); setPayingInvoice(null); }} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('common.cancel')}</button>
              <button onClick={handlePay} disabled={addPayMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {addPayMut.isPending ? t('profile.modal_recording') : t('profile.modal_record_payment_btn')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* Refund Modal */}
      {showRefundModal && refundingInvoice && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => { setShowRefundModal(false); setRefundingInvoice(null); setRefundAmount(''); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <div>
                <h2 className="text-lg font-bold text-white">Process Refund</h2>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{refundingInvoice.invoice_name}</p>
              </div>
              <button onClick={() => { setShowRefundModal(false); setRefundingInvoice(null); setRefundAmount(''); }} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Total: ${Number(refundingInvoice.total_amount).toLocaleString()}</span>
                <span className="text-xs text-[#00E5A8]">Paid: ${Number(refundingInvoice.paid_so_far).toLocaleString()}</span>
                <span className="text-xs text-[#ef4444]">Refundable: ${Number(refundingInvoice.paid_so_far).toLocaleString()}</span>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Refund Amount</label>
                <input type="number" min="0" max={Number(refundingInvoice.paid_so_far)} step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Refund Method</label>
                <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="cash" style={{ background: '#0D1B2A' }}>Cash</option>
                  <option value="card" style={{ background: '#0D1B2A' }}>Card</option>
                  <option value="bank_transfer" style={{ background: '#0D1B2A' }}>Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Refund Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setRefundType('cash')}
                    className="flex-1 h-10 rounded-xl text-sm font-medium transition-all"
                    style={{ background: refundType === 'cash' ? 'rgba(0,229,168,0.15)' : 'rgba(255,255,255,0.04)', border: refundType === 'cash' ? '1px solid rgba(0,229,168,0.3)' : '1px solid rgba(255,255,255,0.06)', color: refundType === 'cash' ? '#00E5A8' : 'rgba(255,255,255,0.5)' }}>
                    Cash Refund
                  </button>
                  <button onClick={() => setRefundType('insurance')}
                    className="flex-1 h-10 rounded-xl text-sm font-medium transition-all"
                    style={{ background: refundType === 'insurance' ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.04)', border: refundType === 'insurance' ? '1px solid rgba(79,209,255,0.3)' : '1px solid rgba(255,255,255,0.06)', color: refundType === 'insurance' ? '#4FD1FF' : 'rgba(255,255,255,0.5)' }}>
                    Insurance Refund
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => { setShowRefundModal(false); setRefundingInvoice(null); setRefundAmount(''); }} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={handleRefund} disabled={refundMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: '#ef4444', color: 'white' }}>
                {refundMut.isPending ? 'Processing...' : 'Process Refund'}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* Account Statement Modal */}
      {showStatement && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => setShowStatement(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)] sticky top-0" style={{ background: 'rgba(13,24,40,0.98)' }}>
              <div>
                <h2 className="text-lg font-bold text-white">{t('profile.modal_statement_title')}</h2>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{patient?.full_name}</p>
              </div>
              <button onClick={() => setShowStatement(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-6">
              <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.1)' }}>
                <div className="text-lg font-bold text-[#7C5CFF]">${totalInvoiced.toLocaleString()}</div>
                <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.modal_statement_total_invoiced')}</div>
              </div>
              <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(0,229,168,0.06)', border: '1px solid rgba(0,229,168,0.1)' }}>
                <div className="text-lg font-bold text-[#00E5A8]">${totalPaid.toLocaleString()}</div>
                <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.modal_statement_total_paid')}</div>
              </div>
              <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.1)' }}>
                <div className="text-lg font-bold text-[#FFC107]">${totalRemaining.toLocaleString()}</div>
                <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.modal_statement_remaining')}</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="px-6 pb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('profile.modal_statement_history')}</h3>
              {(() => {
                const entries = [
                  ...invoices.map(inv => ({ ...inv, entry_type: 'invoice' as const, entry_date: inv.created_at || '' })),
                  ...payments.map(p => ({ ...p, entry_type: 'payment' as const, entry_date: p.created_at || '' })),
                ].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

                let runningBalance = 0;

                return entries.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_statement_empty')}</div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center text-[10px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.02)' }}>
                      <div className="w-24">{t('profile.modal_statement_date')}</div>
                      <div className="flex-1">{t('profile.modal_statement_description')}</div>
                      <div className="w-20 text-right">{t('profile.modal_statement_amount')}</div>
                      <div className="w-24 text-right">{t('profile.modal_statement_balance')}</div>
                    </div>
                    {entries.map((entry) => {
                      if (entry.entry_type === 'invoice') {
                        runningBalance += Number(entry.total_amount);
                      } else {
                        runningBalance -= Number(entry.amount);
                      }
                      const isInvoice = entry.entry_type === 'invoice';
                      return (
                        <div key={`${entry.entry_type}-${entry.id}`} className="flex items-center px-4 py-2.5 rounded-lg text-xs transition-all hover:bg-[rgba(255,255,255,0.02)]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <div className="w-24" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(entry.entry_date).toLocaleDateString()}</div>
                          <div className="flex-1 flex items-center gap-2">
                            {isInvoice ? (
                              <><FileText className="w-3.5 h-3.5" style={{ color: '#7C5CFF' }} /><span className="text-white">{entry.invoice_name || t('profile.modal_statement_invoice')}</span></>
                            ) : (
                              <><CreditCard className="w-3.5 h-3.5" style={{ color: '#00E5A8' }} /><span className="text-white">{t('profile.modal_statement_payment')}</span>{entry.payment_method && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>{t('profile.payment_method_' + entry.payment_method) || entry.payment_method.replace('_', ' ')}</span>}</>
                            )}
                          </div>
                          <div className="w-20 text-right font-medium" style={{ color: isInvoice ? '#7C5CFF' : '#00E5A8' }}>
                            {isInvoice ? '+' : '-'}${isInvoice ? Number(entry.total_amount).toLocaleString() : Number(entry.amount).toLocaleString()}
                          </div>
                          <div className="w-24 text-right font-semibold text-white">${runningBalance.toLocaleString()}</div>
                        </div>
                      );
                    })}
                    {/* Final balance */}
                    <div className="flex items-center px-4 py-3 rounded-lg text-sm font-bold" style={{ background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.1)' }}>
                      <div className="w-24" />
                      <div className="flex-1 text-[#FFC107]">{t('profile.modal_statement_due')}</div>
                      <div className="w-20 text-right" />
                      <div className="w-24 text-right text-[#FFC107]">${totalRemaining.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* New Appointment Modal */}
      {showAddAppt && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => setShowAddAppt(false)}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">{t('profile.modal_new_appointment')}</h2>
              <button onClick={() => setShowAddAppt(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_appt_datetime')}</label>
                <input type="datetime-local" value={apptForm.appointment_date} onChange={e => setApptForm(f => ({ ...f, appointment_date: e.target.value }))} className={inputCls + ' [color-scheme:dark]'} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('profile.modal_appt_status')}</label>
                <select value={apptForm.status} onChange={e => setApptForm(f => ({ ...f, status: e.target.value }))} className={inputCls + ' cursor-pointer'}>
                  <option value="scheduled" style={{ background: '#0D1B2A' }}>{t('profile.modal_appt_scheduled')}</option>
                  <option value="confirmed" style={{ background: '#0D1B2A' }}>{t('profile.modal_appt_confirmed')}</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowAddAppt(false)} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('common.cancel')}</button>
              <button onClick={() => createApptMut.mutate()} disabled={createApptMut.isPending || !apptForm.appointment_date}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {createApptMut.isPending ? t('profile.modal_creating') : t('profile.modal_create_appointment')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* Implant Form Dialog */}
      <ImplantFormDialog
        open={showImplantFormDialog}
        patient={patient}
        editForm={editingImplantForm}
        onClose={() => { setShowImplantFormDialog(false); setEditingImplantForm(null); }}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ['patient-implant-forms', id] }); }}
      />

      {/* Implant Form Viewer */}
      <ImplantFormViewer
        open={showImplantFormViewer}
        form={viewingImplantForm!}
        patient={patient}
        onClose={() => { setShowImplantFormViewer(false); setViewingImplantForm(null); }}
        onEdit={() => {
          setShowImplantFormViewer(false);
          setEditingImplantForm(viewingImplantForm);
          setShowImplantFormDialog(true);
        }}
        onDelete={() => {
          if (viewingImplantForm) deleteImplantFormMut.mutate(viewingImplantForm.id);
        }}
        canEdit={user?.role === 'Admin' || user?.role === 'Doctor' || user?.role === 'Receptionist'}
        canDelete={user?.role === 'Admin'}
      />

      <ReasonDialog
        open={reasonDialog.open}
        title={reasonDialog.title}
        onConfirm={(r) => {
          reasonDialog.onConfirm(r);
          setReasonDialog(f => ({ ...f, open: false }));
        }}
        onCancel={() => setReasonDialog(f => ({ ...f, open: false }))}
      />

    </div>
  );
}
