import { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { procedureService } from '../../services/procedureService';
import { financialRecordService } from '../../services/financialRecordService';
import { appointmentService } from '../../services/appointmentService';
import { followUpService } from '../../services/followUpService';
import { patientFileService, type DocumentCategory } from '../../services/patientFileService';
import type { Patient, FinancialRecord, PatientFile } from '../../types';
import { toast } from 'sonner';
import {
  ArrowLeft, Camera, Edit3, Save, X, Calendar, Phone, Mail, User, Activity,
  FileText, DollarSign, Clock, CreditCard, Plus,
  Upload, Download, Trash2, Image, File, Search,
  AlertCircle, Check, Eye, Pill, AlertTriangle
} from 'lucide-react';

/* ─── Constants ─── */
const tabs = ['Overview', 'Medical History', 'Implant Procedures', 'Financial', 'Appointments', 'Documents'] as const;
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
  const [payMethod, setPayMethod] = useState('cash');
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [apptForm, setApptForm] = useState({ appointment_date: '', status: 'scheduled' });
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Other');
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState('');

  /* ── Queries ── */
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id], queryFn: () => patientService.getById(id!), enabled: !!id,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['patient-procedures', id], queryFn: () => procedureService.getByPatient(id!), enabled: !!id,
  });

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
    onSuccess: () => { toast.success('Profile updated'); invalPatient(); setEditing(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadImageMut = useMutation({
    mutationFn: (file: File) => patientService.uploadProfileImage(id!, file),
    onSuccess: () => { toast.success('Image updated'); invalPatient(); invalAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvoiceMut = useMutation({
    mutationFn: (data: { patient_name: string; invoice_name: string; total_amount: number; notes?: string }) =>
      financialRecordService.createInvoice({ patient_id: id!, ...data }),
    onSuccess: () => { toast.success('Invoice created'); invalFinancial(); setShowAddInvoice(false); setInvForm({ invoice_name: '', total_amount: '', notes: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayMut = useMutation({
    mutationFn: (data: { invoice_id: string; patient_name: string; amount: number }) =>
      financialRecordService.addPayment({ patient_id: id!, ...data }),
    onSuccess: () => { toast.success('Payment recorded'); invalFinancial(); setShowPayModal(false); setPayingInvoice(null); setPayAmount(''); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createApptMut = useMutation({
    mutationFn: () => appointmentService.create({ patient_id: id!, appointment_date: apptForm.appointment_date, status: apptForm.status }),
    onSuccess: () => { toast.success('Appointment created'); invalAppointments(); invalAll(); setShowAddAppt(false); setApptForm({ appointment_date: '', status: 'scheduled' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelApptMut = useMutation({
    mutationFn: (apptId: string) => appointmentService.updateStatus(apptId, 'cancelled'),
    onSuccess: () => { toast.success('Appointment cancelled'); invalAppointments(); invalAll(); },
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
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploadingDocs(false);
  };

  const handleDeleteDoc = async (doc: PatientFile) => {
    try {
      await patientFileService.delete(doc.id, doc.storage_path);
      await refetchDocs();
      toast.success('File deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRenameDoc = async (docId: string) => {
    try {
      await patientFileService.rename(docId, editDocName);
      setEditDocId(null);
      await refetchDocs();
      toast.success('File renamed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const filteredDocs = useMemo(() => {
    if (!docSearch) return documents;
    const q = docSearch.toLowerCase();
    return documents.filter(d => d.file_name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }, [documents, docSearch]);

  /* ── Invoice / Payment handlers ── */
  const handleCreateInvoice = () => {
    if (!invForm.invoice_name.trim() || !invForm.total_amount) { toast.error('Name and amount required'); return; }
    createInvoiceMut.mutate({ patient_name: patient?.full_name || '', invoice_name: invForm.invoice_name, total_amount: Number(invForm.total_amount), notes: invForm.notes || undefined });
  };

  const handlePay = () => {
    if (!payingInvoice || !payAmount || Number(payAmount) <= 0) { toast.error('Amount must be positive'); return; }
    addPayMut.mutate({ invoice_id: payingInvoice.id, patient_name: patient?.full_name || '', amount: Number(payAmount) });
  };

  const fileExtIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5" style={{ color: '#4FD1FF' }} />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5" style={{ color: '#FF6B6B' }} />;
    return <File className="w-5 h-5" style={{ color: '#FFC107' }} />;
  };

  if (patientLoading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" /></div>
  );
  if (!patient) return <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>Patient not found</div>;

  return (
    <div className="font-sans select-none space-y-6">
      {/* ── Back Button ── */}
      <button onClick={() => navigate('/dashboard/patients')} className="flex items-center gap-2 text-xs font-medium transition-all hover:gap-3" style={{ color: '#4FD1FF' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Patients
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
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><Phone className="w-3 h-3" />{patient.phone || '—'}</span>
                  {patient.email && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><Mail className="w-3 h-3" />{patient.email}</span>}
                  {patient.gender && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><User className="w-3 h-3" />{patient.gender}</span>}
                  {patient.date_of_birth && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}><Calendar className="w-3 h-3" />{new Date(patient.date_of_birth).toLocaleDateString()}</span>}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>ID: #{patient.id.slice(0, 8).toUpperCase()}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Registered {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
              <button onClick={editing ? handleSaveProfile : startEditing} disabled={updatePatientMut.isPending}
                className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all active:scale-[0.98]"
                style={{ background: editing ? 'linear-gradient(135deg, #00E5A8, #45D6FF)' : 'rgba(79,209,255,0.1)', border: editing ? 'none' : '1px solid rgba(79,209,255,0.15)', color: editing ? '#050B14' : '#4FD1FF' }}>
                {editing ? <><Save className="w-3.5 h-3.5" /> {updatePatientMut.isPending ? 'Saving...' : 'Save'}</> : <><Edit3 className="w-3.5 h-3.5" /> Edit Profile</>}
              </button>
            </div>
            {editing && (
              <button onClick={() => setEditing(false)} className="ml-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          TABS
          ══════════════════════════════════════ */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap"
            style={{
              color: activeTab === t ? '#4FD1FF' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === t ? '2px solid #4FD1FF' : '2px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB 1: OVERVIEW
          ══════════════════════════════════════ */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={<Activity className="w-4 h-4" color="#4FD1FF" />} label="Active Procedures" value={procedures.length.toString()} color="#4FD1FF" />
            <StatCard icon={<FileText className="w-4 h-4" color="#7C5CFF" />} label="Total Invoiced" value={`$${totalInvoiced.toLocaleString()}`} color="#7C5CFF" />
            <StatCard icon={<DollarSign className="w-4 h-4" color="#00E5A8" />} label="Total Paid" value={`$${totalPaid.toLocaleString()}`} color="#00E5A8" />
            <StatCard icon={<Clock className="w-4 h-4" color="#FFC107" />} label="Remaining" value={`$${totalRemaining.toLocaleString()}`} color="#FFC107" />
            <StatCard icon={<Calendar className="w-4 h-4" color="#4FD1FF" />} label="Upcoming Appts" value={upcomingAppts.length.toString()} color="#4FD1FF" />
            <StatCard icon={<FileText className="w-4 h-4" color="#FF6B6B" />} label="Documents" value={documents.length.toString()} color="#FF6B6B" />
          </div>

          {/* Quick Info */}
          <Section title="Patient Summary">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Name: </span><span className="text-white">{patient.full_name}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Phone: </span><span className="text-white">{patient.phone || '—'}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Email: </span><span className="text-white">{patient.email || '—'}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Gender: </span><span className="text-white">{patient.gender || '—'}</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>DOB: </span><span className="text-white">{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'}</span></div>
              {patient.smoking_status && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Smoking: </span><span className="text-white">{patient.smoking_status}</span></div>}
            </div>
          </Section>

          {/* Recent Procedures */}
          {procedures.length > 0 && (
            <Section title={`Recent Procedures (${procedures.length})`}>
              <div className="space-y-2">
                {procedures.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div className="text-sm font-medium text-white">{p.procedure_name}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.tooth_number || '—'} · {p.procedure_date ? new Date(p.procedure_date).toLocaleDateString() : '—'}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Upcoming Appointments */}
          {upcomingAppts.length > 0 && (
            <Section title="Upcoming Appointments">
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
            <Section title="Failure Timeline">
              <div className="space-y-3">
                {failureEvents.map(fe => (
                  <div key={fe.id} className="flex items-start gap-3 p-4 rounded-xl animate-fadeIn"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                      <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#ef4444]">Implant Failure Recorded</span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {fe.created_at ? new Date(fe.created_at).toLocaleDateString() : '—'}
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
                { key: 'medical_history', label: 'Medical History', full: true, multiline: true },
                { key: 'chronic_disease', label: 'Chronic Diseases' },
                { key: 'medication', label: 'Current Medications' },
                { key: 'allergies', label: 'Allergies' },
                { key: 'smoking_status', label: 'Smoking Status' },
              ].map(f => (
                <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.label}</label>
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
                <h4 className="text-xs font-semibold text-[#4FD1FF] mb-2 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Medical History</h4>
                <p className="text-sm" style={{ color: patient.medical_history ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>{patient.medical_history || 'No medical history recorded'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><Pill className="w-3.5 h-3.5" style={{ color: '#FFC107' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Chronic Disease</span></div>
                  <p className="text-sm text-white">{patient.chronic_disease || '—'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><Pill className="w-3.5 h-3.5" style={{ color: '#00E5A8' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Medications</span></div>
                  <p className="text-sm text-white">{patient.medication || '—'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><AlertCircle className="w-3.5 h-3.5" style={{ color: '#FF6B6B' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Allergies</span></div>
                  <p className="text-sm text-white">{patient.allergies || '—'}</p>
                </div>
              </div>
              {patient.smoking_status && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5" style={{ color: '#FFC107' }} /><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Smoking Status</span></div>
                  <p className="text-sm text-white">{patient.smoking_status}</p>
                </div>
              )}
              {!editing && (
                <button onClick={startEditing} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
                  <Edit3 className="w-3.5 h-3.5" /> Edit Medical History
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
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{procedures.length} procedure(s) found</span>
            <button onClick={() => navigate('/dashboard/cases')} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
              <Plus className="w-3.5 h-3.5" /> New Procedure
            </button>
          </div>
          {procedures.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
              No implant procedures yet. Click "New Procedure" to start.
            </div>
          ) : procedures.map(p => (
            <div key={p.id} className="rounded-[18px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{p.procedure_name}</h4>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Tooth {p.tooth_number || '—'} · {p.procedure_date ? new Date(p.procedure_date).toLocaleDateString() : '—'}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {p.implant_system && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>System: </span><span className="text-white">{p.implant_system}</span></div>}
                {p.implant_size && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Size: </span><span className="text-white">{p.implant_size}</span></div>}
                {p.implant_decision && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Decision: </span><span className="text-white">{p.implant_decision}</span></div>}
                {p.abutment_type && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Abutment: </span><span className="text-white">{p.abutment_type}</span></div>}
                {p.bone_condition && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Bone: </span><span className="text-white">{p.bone_condition}</span></div>}
                {p.doctor_name && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Doctor: </span><span className="text-white">{p.doctor_name}</span></div>}
                {p.extraction_needed !== undefined && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Extraction: </span><span className="text-white">{p.extraction_needed ? 'Yes' : 'No'}</span></div>}
              </div>
              {p.notes && <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.notes}</p>}
              {(p.bone_height || p.bone_width || p.ct_scan_notes) && (
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4FD1FF]">CBCT</span>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs">
                    {p.bone_height && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Height: <span className="text-white">{p.bone_height}mm</span></span>}
                    {p.bone_width && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Width: <span className="text-white">{p.bone_width}mm</span></span>}
                    {p.ct_scan_notes && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Notes: <span className="text-white">{p.ct_scan_notes}</span></span>}
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
              <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Paid</div>
            </div>
            <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.1)' }}>
              <div className="text-lg font-bold text-[#FFC107]">${totalRemaining.toLocaleString()}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Remaining</div>
            </div>
            <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.1)' }}>
              <div className="text-lg font-bold text-[#7C5CFF]">{invoices.length}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Invoices</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{invoices.length} invoice(s)</span>
            <button onClick={() => setShowAddInvoice(true)} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
              <Plus className="w-3.5 h-3.5" /> New Invoice
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>No invoices yet.</div>
          ) : invoices.map(inv => {
            const invPayments = payments.filter(p => p.parent_invoice_id === inv.id);
            return (
              <div key={inv.id} className="rounded-[18px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{inv.invoice_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Total: ${Number(inv.total_amount).toLocaleString()}</span>
                      <span className="text-xs text-[#00E5A8]">Paid: ${Number(inv.paid_so_far).toLocaleString()}</span>
                      <span className="text-xs text-[#FFC107]">Remaining: ${Number(inv.remaining_amount).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.status} />
                    {inv.status !== 'Paid' && (
                      <button onClick={() => { setPayingInvoice(inv); setShowPayModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#00E5A8', background: 'rgba(0,229,168,0.1)' }}>
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Payment Timeline */}
                {invPayments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Payment History</span>
                    <div className="mt-2 space-y-1.5">
                      {invPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(0,229,168,0.03)', border: '1px solid rgba(0,229,168,0.06)' }}>
                          <span className="text-white">${Number(p.amount).toLocaleString()}</span>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</span>
                        </div>
                      ))}
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
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{patientAppointments.length} appointment(s)</span>
            <button onClick={() => setShowAddAppt(true)} className="h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold" style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
              <Plus className="w-3.5 h-3.5" /> New Appointment
            </button>
          </div>
          {patientAppointments.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>No appointments.</div>
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
                      Cancel
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
                  {docCategories.map(c => <option key={c.value} value={c.value} style={{ background: '#0D1B2A' }}>{c.icon} {c.value}</option>)}
                </select>
                <button onClick={() => docUploadRef.current?.click()} disabled={uploadingDocs}
                  className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                  <Upload className="w-4 h-4" /> {uploadingDocs ? 'Uploading...' : 'Upload Files'}
                </button>
                <input ref={docUploadRef} type="file" multiple className="hidden" onChange={handleDocUpload} />
              </div>
              <div className="relative w-full md:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
                <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Search files..." className="w-full h-10 pl-9 pr-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500" />
              </div>
            </div>
          </div>

          {/* File Grid */}
          {docsError ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: '#FF6B6B' }}>
              Failed to load documents. <button onClick={() => refetchDocs()} className="underline" style={{ color: '#4FD1FF' }}>Retry</button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-[18px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
              {docSearch ? 'No files match your search' : 'No documents uploaded yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="rounded-[16px] p-4 transition-all hover:-translate-y-0.5 group" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {/* Preview */}
                  {doc.file_type.startsWith('image/') ? (
                    <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-[rgba(0,0,0,0.3)] flex items-center justify-center">
                      <img src={doc.public_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {fileExtIcon(doc.file_type)}
                    </div>
                  )}
                  {/* Info */}
                  {editDocId === doc.id ? (
                    <div className="flex items-center gap-1">
                      <input value={editDocName} onChange={e => setEditDocName(e.target.value)} className="flex-1 h-7 px-2 rounded-lg text-xs outline-none bg-[rgba(255,255,255,0.06)] text-white" autoFocus />
                      <button onClick={() => handleRenameDoc(doc.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: '#00E5A8' }}><Check className="w-3 h-3" /></button>
                      <button onClick={() => setEditDocId(null)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: '#FF6B6B' }}><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-white truncate">{doc.file_name}</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(79,209,255,0.08)', color: '#4FD1FF' }}>{doc.category}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}</span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                    {doc.public_url && (
                      <a href={doc.public_url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[10px] font-medium transition-all"
                        style={{ background: 'rgba(79,209,255,0.08)', color: '#4FD1FF' }}>
                        <Eye className="w-3 h-3" /> View
                      </a>
                    )}
                    {doc.public_url && (
                      <a href={doc.public_url} download={doc.file_name}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => { setEditDocId(doc.id); setEditDocName(doc.file_name); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteDoc(doc)}
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

      {/* ═══ MODALS ═══ */}

      {/* Add Invoice Modal */}
      {showAddInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddInvoice(false); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">New Invoice</h2>
              <button onClick={() => setShowAddInvoice(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Invoice Name *</label>
                <input value={invForm.invoice_name} onChange={e => setInvForm(f => ({ ...f, invoice_name: e.target.value }))} placeholder="e.g. Implant Surgery" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Total Amount *</label>
                <input type="number" min="0" step="0.01" value={invForm.total_amount} onChange={e => setInvForm(f => ({ ...f, total_amount: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Notes</label>
                <textarea value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' h-16 pt-2 resize-none'} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowAddInvoice(false)} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={handleCreateInvoice} disabled={createInvoiceMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {createInvoiceMut.isPending ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowPayModal(false); setPayingInvoice(null); } }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <div>
                <h2 className="text-lg font-bold text-white">Record Payment</h2>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{payingInvoice.invoice_name}</p>
              </div>
              <button onClick={() => { setShowPayModal(false); setPayingInvoice(null); }} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Total: ${Number(payingInvoice.total_amount).toLocaleString()}</span>
                <span className="text-xs text-[#00E5A8]">Paid: ${Number(payingInvoice.paid_so_far).toLocaleString()}</span>
                <span className="text-xs text-[#FFC107]">Remaining: ${Number(payingInvoice.remaining_amount).toLocaleString()}</span>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Amount *</label>
                <input type="number" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="cash" style={{ background: '#0D1B2A' }}>Cash</option>
                  <option value="card" style={{ background: '#0D1B2A' }}>Card</option>
                  <option value="insurance" style={{ background: '#0D1B2A' }}>Insurance</option>
                  <option value="bank_transfer" style={{ background: '#0D1B2A' }}>Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => { setShowPayModal(false); setPayingInvoice(null); }} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={handlePay} disabled={addPayMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {addPayMut.isPending ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Appointment Modal */}
      {showAddAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddAppt(false); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">New Appointment</h2>
              <button onClick={() => setShowAddAppt(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Date & Time *</label>
                <input type="datetime-local" value={apptForm.appointment_date} onChange={e => setApptForm(f => ({ ...f, appointment_date: e.target.value }))} className={inputCls + ' [color-scheme:dark]'} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Status</label>
                <select value={apptForm.status} onChange={e => setApptForm(f => ({ ...f, status: e.target.value }))} className={inputCls + ' cursor-pointer'}>
                  <option value="scheduled" style={{ background: '#0D1B2A' }}>Scheduled</option>
                  <option value="confirmed" style={{ background: '#0D1B2A' }}>Confirmed</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowAddAppt(false)} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => createApptMut.mutate()} disabled={createApptMut.isPending || !apptForm.appointment_date}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {createApptMut.isPending ? 'Creating...' : 'Create Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
