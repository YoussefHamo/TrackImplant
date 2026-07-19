import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { procedureService } from '../services/procedureService';
import { patientService } from '../services/patientService';
import { followUpService } from '../services/followUpService';
import { implantInventoryService } from '../services/implantInventoryService';
import { userService } from '../services/userService';
import { supabase } from '../integrations/supabase/client';
import {
  Search, Activity, AlertTriangle,
  Calendar, User, Plus, X, ChevronRight, ChevronLeft, Check,
  Trash2, Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import type { Procedure } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import FixedOverlay from '../components/ui/FixedOverlay';

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  'Consultation': { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF', dot: '#4FD1FF' },
  'Imaging': { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF', dot: '#7C5CFF' },
  'Surgery Prep': { bg: 'rgba(255,193,7,0.12)', text: '#FFC107', dot: '#FFC107' },
  'Implant Placement': { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8', dot: '#00E5A8' },
  'Healing Phase': { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF', dot: '#4FD1FF' },
  'Crown Placement': { bg: 'rgba(69,214,255,0.12)', text: '#45D6FF', dot: '#45D6FF' },
  'Conclusion': { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF', dot: '#7C5CFF' },
  'Completed': { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8', dot: '#00E5A8' },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const c = statusStyles[status] || { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.3)' };
  const statusKey = `cases.status_${status.toLowerCase().replace(/\s+/g, '_')}`;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {t(statusKey)}
    </span>
  );
}

const inputCls = 'input-cyber';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-[var(--app-text-muted)]';
const sectionCls = 'rounded-xl p-4';

const boneConditionValues = ['Type I (Dense)', 'Type II (Medium)', 'Type III (Soft)', 'Type IV (Very Soft)'];
const boneDensityValues = ['High (>850 HU)', 'Medium (500-850 HU)', 'Low (<500 HU)'];
const decisions = ['Immediate', 'Delayed', 'Not Possible'] as const;

type FormData = {
  patient_id: string;
  patient_name: string;
  procedure_name: string;
  tooth_number: string;
  procedure_date: string;
  doctor_name: string;
  bone_condition: string;
  bone_density: string;
  bone_height: string;
  bone_width: string;
  pathology: string;
  ct_scan_notes: string;
  chronic_disease: string;
  medication: string;
  implant_decision: string;
  implant_brand: string;
  implant_system: string;
  implant_size: string;
  abutment_type: string;
  extraction_needed: boolean;
  notes: string;
};

const emptyForm: FormData = {
  patient_id: '', patient_name: '', procedure_name: '', tooth_number: '',
  procedure_date: new Date().toISOString().split('T')[0], doctor_name: '',
  bone_condition: '', bone_density: '', bone_height: '', bone_width: '',
  pathology: '', ct_scan_notes: '', chronic_disease: '', medication: '',
  implant_decision: '', implant_brand: '', implant_system: '', implant_size: '', abutment_type: '',
  extraction_needed: false, notes: '',
};

function StepCircle({ num, active, done }: { num: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
      done
        ? 'bg-[var(--color-success)] text-[var(--color-on-primary)]'
        : active
          ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[0_0_12px_var(--color-primary)/40%]'
          : 'bg-white/[0.06] text-white/30'
    }`}>
      {done ? <Check className="w-4 h-4" /> : num}
    </div>
  );
}

export function ImplantCases() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const userBranchId = activeBranchId || user?.branch_id;
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editProcId, setEditProcId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState(activeBranchId || '');
  const [filterImplant, setFilterImplant] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const selectedId = searchParams.get('id') || '';

  // Sync filterBranch when activeBranchId changes
  useEffect(() => {
    if (activeBranchId) setFilterBranch(activeBranchId);
  }, [activeBranchId]);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures', activeBranchId],
    queryFn: () => procedureService.getAll(activeBranchId),
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => followUpService.getAll(),
  });

  const { data: implants = [] } = useQuery({
    queryKey: ['implant-inventory'],
    queryFn: () => implantInventoryService.getImplants(),
  });

  const { data: abutmentInv = [] } = useQuery({
    queryKey: ['abutment-inventory'],
    queryFn: () => implantInventoryService.getAbutments(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
  });
  const doctors = useMemo(() => allUsers.filter(u => u.role === 'Doctor' && u.is_active !== false), [allUsers]);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const implantSystems = useMemo(() => [...new Set(implants.map(i => i.brand))].sort(), [implants]);

  const [doctorAssignments, setDoctorAssignments] = useState<{ doctor_id: string; role_in_procedure: 'primary' | 'assistant'; display_order: number }[]>([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  const getAvailableDoctors = (excludeIds: string[]) =>
    doctors.filter(d => !excludeIds.includes(d.auth_user_id || d.id));

  const addDoctorAssignment = (doctorId: string) => {
    if (doctorAssignments.length >= 3) return;
    if (doctorAssignments.some(d => d.doctor_id === doctorId)) return;
    const isPrimary = doctorAssignments.length === 0;
    setDoctorAssignments(prev => [...prev, {
      doctor_id: doctorId,
      role_in_procedure: isPrimary ? 'primary' : 'assistant',
      display_order: prev.length,
    }]);
    setDoctorSearch('');
    setShowDoctorDropdown(false);
  };

  const removeDoctorAssignment = (doctorId: string) => {
    setDoctorAssignments(prev => {
      const updated = prev.filter(d => d.doctor_id !== doctorId);
      return updated.map((d, i) => ({
        ...d,
        role_in_procedure: i === 0 ? 'primary' as const : 'assistant' as const,
        display_order: i,
      }));
    });
  };

  const implantBrands = useMemo(() => [...new Set(implants.map(i => i.brand))].sort(), [implants]);
  const implantSizesForBrand = useMemo(() => {
    if (!form.implant_brand) return [];
    return implants.filter(i => i.brand === form.implant_brand);
  }, [implants, form.implant_brand]);
  const abutmentTypes = useMemo(() => abutmentInv.map(a => a.type), [abutmentInv]);

  const steps = [
    { num: 1, label: t('cases.wizard_step1') },
    { num: 2, label: t('cases.wizard_step2') },
    { num: 3, label: t('cases.wizard_step3') },
    { num: 4, label: t('cases.wizard_step4') },
  ];

  const filtered = useMemo(() => {
    let items = procedures;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(p =>
        p.procedure_name.toLowerCase().includes(q) ||
        (p.tooth_number || '').toLowerCase().includes(q) ||
        (p.implant_system || '').toLowerCase().includes(q) ||
        (p.doctor_name || '').toLowerCase().includes(q) ||
        (p.status || '').toLowerCase().includes(q)
      );
    }
    if (filterDoctor) {
      items = items.filter(p => p.doctor_name?.toLowerCase().includes(filterDoctor.toLowerCase()));
    }
    if (filterStatus) {
      items = items.filter(p => p.status === filterStatus);
    }
    if (filterBranch) {
      items = items.filter(p => p.branch_id === filterBranch);
    }
    if (filterImplant) {
      items = items.filter(p => p.implant_system === filterImplant);
    }
    if (filterDateFrom) {
      items = items.filter(p => p.procedure_date >= filterDateFrom);
    }
    if (filterDateTo) {
      items = items.filter(p => p.procedure_date <= filterDateTo);
    }
    return items;
  }, [procedures, searchQuery, filterDoctor, filterStatus, filterBranch, filterImplant, filterDateFrom, filterDateTo]);

  const selectedProc = selectedId ? procedures.find(p => p.id === selectedId) : filtered[0];
  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['procedures'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    queryClient.invalidateQueries({ queryKey: ['implant-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['abutment-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, change_reason, reason_category }: { id: string; status: string; change_reason?: string; reason_category?: string }) =>
      procedureService.updateStatus(id, status, change_reason, reason_category),
    onSuccess: () => { toast.success(t('cases.toast_status_updated')); invalidateAll(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, change_reason, reason_category }: { data: Omit<Procedure, 'id' | 'created_at'>; change_reason?: string; reason_category?: string }) => {
      const proc = await procedureService.create(data, userBranchId, undefined, change_reason, reason_category);
      if (doctorAssignments.length > 0 && proc.id) {
        await procedureService.assignDoctors(proc.id, doctorAssignments);
      }
      return proc;
    },
    onSuccess: () => {
      toast.success(t('cases.toast_case_created'));
      invalidateAll();
      closeWizard();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateWithDoctorsMutation = useMutation({
    mutationFn: async ({ id, data, change_reason, reason_category }: { id: string; data: Partial<Procedure>; change_reason?: string; reason_category?: string }) => {
      await procedureService.update(id, data, change_reason, reason_category);
      if (doctorAssignments.length > 0) {
        await procedureService.assignDoctors(id, doctorAssignments);
      }
    },
    onSuccess: () => {
      toast.success(t('cases.toast_procedure_updated'));
      invalidateAll();
      closeWizard();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, change_reason, reason_category }: { id: string; data: Partial<Procedure>; change_reason?: string; reason_category?: string }) =>
      procedureService.update(id, data, change_reason, reason_category),
    onSuccess: () => {
      toast.success(t('cases.toast_procedure_updated'));
      invalidateAll();
      closeWizard();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, change_reason, reason_category }: { id: string; change_reason?: string; reason_category?: string }) =>
      procedureService.delete(id, change_reason, reason_category),
    onSuccess: () => {
      toast.success(t('cases.toast_procedure_deleted'));
      invalidateAll();
      setDeleteConfirmId(null);
      if (selectedId === deleteConfirmId) setSearchParams({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statuses = ['Consultation', 'Imaging', 'Surgery Prep', 'Implant Placement', 'Healing Phase', 'Crown Placement', 'Conclusion', 'Completed'];
  const currentIdx = selectedProc ? statuses.indexOf(selectedProc.status) : -1;

  const procFailureMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const fu of followUps) {
      if (fu.healing_status === 'Failure' && !map.has(fu.patient_id)) {
        map.set(fu.patient_id, true);
      }
    }
    return map;
  }, [followUps]);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setFormErrors(e => { const c = { ...e }; delete c[key]; return c; });
  }, []);

  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!form.patient_id) errs.patient_id = t('cases.wizard_error_patient');
      if (!form.procedure_name.trim()) errs.procedure_name = t('cases.wizard_error_procedure');
      if (!form.procedure_date) errs.procedure_date = t('cases.wizard_error_date');
    }
    if (step === 3) {
      if (form.implant_brand || form.implant_size) {
        if (doctorAssignments.length === 0) {
          errs.doctor = 'At least one doctor is required for implant procedures';
        }
        if (doctorAssignments.length > 0 && !doctorAssignments.some(d => d.role_in_procedure === 'primary')) {
          errs.doctor = 'One doctor must be marked as Primary';
        }
      }
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => { if (validateStep(wizardStep)) setWizardStep(s => s + 1); };
  const handlePrev = () => setWizardStep(s => Math.max(1, s - 1));

  const openEditWizard = async (proc: Procedure) => {
    const patient = patientMap.get(proc.patient_id);
    setForm({
      patient_id: proc.patient_id,
      patient_name: patient?.full_name || '',
      procedure_name: proc.procedure_name,
      tooth_number: proc.tooth_number || '',
      procedure_date: proc.procedure_date,
      doctor_name: proc.doctor_name || '',
      bone_condition: proc.bone_condition || '',
      bone_density: proc.bone_density || '',
      bone_height: proc.bone_height?.toString() || '',
      bone_width: proc.bone_width?.toString() || '',
      pathology: proc.pathology || '',
      ct_scan_notes: proc.ct_scan_notes || '',
      chronic_disease: proc.chronic_disease || '',
      medication: proc.medication || '',
      implant_decision: proc.implant_decision || '',
      implant_brand: proc.implant_brand || '',
      implant_system: proc.implant_system || '',
      implant_size: proc.implant_size || '',
      abutment_type: proc.abutment_type || '',
      extraction_needed: proc.extraction_needed || false,
      notes: proc.notes || '',
    });
    setEditProcId(proc.id);
    try {
      const existingDoctors = await procedureService.getDoctors(proc.id);
      setDoctorAssignments(existingDoctors.map(d => ({
        doctor_id: d.doctor_id,
        role_in_procedure: d.role_in_procedure,
        display_order: d.display_order,
      })));
    } catch {
      setDoctorAssignments([]);
    }
    setWizardStep(1);
    setShowWizard(true);
  };

  const doSave = (reason?: { reason: string; category: string }) => {
    const patient = patients.find(p => p.id === form.patient_id);
    if (!patient) { toast.error(t('cases.toast_patient_not_found')); return; }
    const primaryDoctor = doctorAssignments.find(d => d.role_in_procedure === 'primary');
    const primaryDoctorName = primaryDoctor
      ? (doctors.find(d => d.auth_user_id === primaryDoctor.doctor_id || d.id === primaryDoctor.doctor_id)?.full_name || '')
      : form.doctor_name;

    const procedureData = {
      patient_id: form.patient_id,
      procedure_name: form.procedure_name.trim(),
      tooth_number: form.tooth_number || undefined,
      implant_brand: form.implant_brand || undefined,
      implant_system: form.implant_system || undefined,
      implant_size: form.implant_size || undefined,
      procedure_date: form.procedure_date,
      doctor_name: primaryDoctorName || undefined,
      notes: form.notes || undefined,
      bone_condition: form.bone_condition || undefined,
      bone_density: form.bone_density || undefined,
      bone_height: form.bone_height ? Number(form.bone_height) : undefined,
      bone_width: form.bone_width ? Number(form.bone_width) : undefined,
      pathology: form.pathology || undefined,
      ct_scan_notes: form.ct_scan_notes || undefined,
      chronic_disease: form.chronic_disease || undefined,
      medication: form.medication || undefined,
      implant_decision: (form.implant_decision || undefined) as Procedure['implant_decision'],
      extraction_needed: form.extraction_needed || undefined,
      abutment_type: form.abutment_type || undefined,
      branch_id: userBranchId || null,
    };

    if (editProcId) {
      updateWithDoctorsMutation.mutate({
        id: editProcId,
        data: procedureData,
        change_reason: reason?.reason,
        reason_category: reason?.category,
      });
    } else {
      createMutation.mutate({
        data: { ...procedureData, status: 'Consultation' },
        change_reason: reason?.reason,
        reason_category: reason?.category,
      });
    }
  };

  const handleSave = () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    const patient = patients.find(p => p.id === form.patient_id);
    if (!patient) { toast.error(t('cases.toast_patient_not_found')); return; }

    if (form.implant_brand && form.implant_size) {
      const invItem = implants.find(i => i.brand === form.implant_brand && i.size === form.implant_size);
      if (invItem && invItem.quantity <= 0) {
        toast.error(t('cases.toast_no_stock_implant'));
        return;
      }
    }

    if (form.abutment_type) {
      const abtItem = abutmentInv.find(a => a.type === form.abutment_type);
      if (abtItem && abtItem.quantity <= 0) {
        toast.error(t('cases.toast_no_stock_abutment'));
        return;
      }
    }

    if ((form.implant_brand || form.implant_size) && doctorAssignments.length === 0) {
      toast.error('At least one doctor must be assigned');
      return;
    }
    if (doctorAssignments.length > 0 && !doctorAssignments.some(d => d.role_in_procedure === 'primary')) {
      toast.error('One doctor must be marked as Primary');
      return;
    }

    doSave();
  };

  const closeWizard = () => {
    setShowWizard(false);
    setWizardStep(1);
    setForm({ ...emptyForm });
    setFormErrors({});
    setEditProcId(null);
    setDoctorAssignments([]);
    setDoctorSearch('');
  };

  return (
    <div className="p-6 space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('cases.title')}</h1>
          <p className="text-sm mt-1 text-[var(--app-text-muted)]">
            {isLoading ? t('common.loading') : t('cases.subtitle', { count: filtered.length })}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--app-text-dim)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('cases.search_placeholder')}
              className="input-cyber h-9! pl-9 pr-3 text-xs"
              aria-label={t('cases.search_placeholder')}
            />
          </div>
          <select
            value={filterDoctor}
            onChange={e => setFilterDoctor(e.target.value)}
            className="input-cyber h-9! px-2.5 text-xs cursor-pointer appearance-none"
            aria-label="Filter by doctor"
          >
            <option value="">All Doctors</option>
            {doctors.map(d => (
              <option key={d.auth_user_id || d.id} value={d.full_name || d.username}>{d.full_name || d.username}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="input-cyber h-9! px-2.5 text-xs cursor-pointer appearance-none"
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            {['Consultation', 'Imaging', 'Surgery Prep', 'Implant Placement', 'Healing Phase', 'Crown Placement', 'Conclusion', 'Completed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="input-cyber h-9! px-2.5 text-xs cursor-pointer appearance-none"
            aria-label="Filter by branch"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={filterImplant}
            onChange={e => setFilterImplant(e.target.value)}
            className="input-cyber h-9! px-2.5 text-xs cursor-pointer appearance-none"
            aria-label="Filter by implant system"
          >
            <option value="">All Systems</option>
            {implantSystems.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="input-cyber h-9! px-2.5 text-xs [color-scheme:dark]"
            aria-label="Filter from date"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="input-cyber h-9! px-2.5 text-xs [color-scheme:dark]"
            aria-label="Filter to date"
          />
          <button
            onClick={() => setShowWizard(true)}
            className="btn-primary btn-sm"
            aria-label={t('cases.new_procedure')}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('cases.new_procedure')}
          </button>
        </div>
      </div>

      {/* ===== 2-COLUMN LAYOUT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">

        {/* ===== LEFT — PROCEDURES LIST ===== */}
        <div className="glass-strong rounded-xl overflow-hidden">
          <div className="min-w-[600px]">
            {/* Table Header */}
            <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[var(--app-border)] text-[var(--app-text-muted)]">
              <div className="flex-[2.5]">{t('cases.table_patient')}</div>
              <div className="flex-[1.5]">{t('cases.table_tooth')}</div>
              <div className="flex-[1.5]">{t('cases.table_doctor')}</div>
              <div className="flex-[1.5]">{t('cases.table_status')}</div>
              <div className="flex-[1.5]">{t('cases.table_date')}</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[var(--app-border)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--app-text-muted)]">
                  {searchQuery ? t('cases.empty_search') : t('cases.empty_all')}
                </div>
              ) : filtered.map(proc => {
                const patient = patientMap.get(proc.patient_id);
                return (
                  <div
                    key={proc.id}
                    onClick={() => setSearchParams({ id: proc.id })}
                    onKeyDown={e => { if (e.key === 'Enter') setSearchParams({ id: proc.id }); }}
                    role="row"
                    tabIndex={0}
                    aria-selected={selectedId === proc.id}
                    className={`flex items-center px-6 py-4 transition-all duration-150 cursor-pointer relative hover:bg-[var(--app-table-hover)] ${
                      selectedId === proc.id ? 'bg-[var(--color-primary)]/[0.04]' : ''
                    }`}
                  >
                    {selectedId === proc.id && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)]" />
                    )}
                    <div className="flex-[2.5]">
                      <div className="text-sm font-medium text-white">{patient?.full_name || t('common.unknown')}</div>
                      <div className="text-[11px] mt-0.5 text-[var(--app-text-muted)]">{proc.procedure_name}</div>
                    </div>
                    <div className="flex-[1.5] text-sm text-[var(--app-text-dim)]">
                      {proc.tooth_number || <span className="text-[var(--app-text-muted)]">{t('common.dash')}</span>}
                    </div>
                    <div className="flex-[1.5] text-sm text-[var(--app-text-dim)]">
                      {proc.doctor_name || <span className="text-[var(--app-text-muted)]">{t('common.dash')}</span>}
                    </div>
                    <div className="flex-[1.5] flex items-center gap-2">
                      <StatusBadge status={proc.status} />
                      {proc.status === 'Conclusion' && procFailureMap.has(proc.patient_id) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--color-error)]/15 text-[var(--color-error)] border border-[var(--color-error)]/25">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {t('cases.failure_badge')}
                        </span>
                      )}
                    </div>
                    <div className="flex-[1.5] text-xs text-[var(--app-text-muted)]">
                      {proc.procedure_date ? new Date(proc.procedure_date).toLocaleDateString() : t('common.dash')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== RIGHT — SELECTED PROCEDURE DETAIL ===== */}
        {selectedProc ? (
          <div className="glass-strong rounded-xl p-6 space-y-5">
            {/* Header: Avatar + Actions */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)]/20 text-[var(--color-primary)]">
                {(patientMap.get(selectedProc.patient_id)?.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-white truncate">{patientMap.get(selectedProc.patient_id)?.full_name || t('common.unknown')}</h3>
                <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">{selectedProc.procedure_name}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => openEditWizard(selectedProc)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[var(--app-text-dim)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(selectedProc.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[var(--app-text-dim)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Progress Timeline — Horizontal Stepper */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_progress')}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedProc.status} />
                  {selectedProc.status === 'Conclusion' && procFailureMap.has(selectedProc.patient_id) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-error)]/15 text-[var(--color-error)] border border-[var(--color-error)]/25">
                      <AlertTriangle className="w-3 h-3" />
                      {t('cases.failure_returned')}
                    </span>
                  )}
                </div>
              </div>
              {/* Stepper track */}
              <div className="overflow-x-auto pb-2 scrollbar-thin">
                <div className="flex items-start gap-0">
                  {statuses.map((s, idx) => {
                    const isActive = idx === currentIdx;
                    const isPast = idx < currentIdx;
                    return (
                      <div key={s} className="flex items-start flex-shrink-0">
                        <div className="flex flex-col items-center gap-1.5" style={{ width: 80 }}>
                          <button
                            onClick={() => { if (!isPast && !isActive) updateStatusMutation.mutate({ id: selectedProc.id, status: s }); }}
                            className="relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90"
                            style={{
                              background: isPast ? '#00E5A8' : isActive ? '#4FD1FF' : 'rgba(255,255,255,0.06)',
                              border: isActive ? '2px solid rgba(79,209,255,0.5)' : '2px solid transparent',
                              boxShadow: isActive ? '0 0 16px rgba(79,209,255,0.45)' : 'none',
                              cursor: isPast ? 'default' : 'pointer',
                            }}
                            aria-label={t(`cases.status_${s.toLowerCase().replace(/\s+/g, '_')}`)}
                          >
                            {isPast ? (
                              <Check className="w-3.5 h-3.5" style={{ color: '#050B14' }} />
                            ) : isActive ? (
                              <span className="w-2 h-2 rounded-full" style={{ background: '#050B14' }} />
                            ) : (
                              <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                            )}
                          </button>
                          <span className="text-[9px] font-semibold text-center leading-tight transition-all"
                            style={{
                              color: isPast ? 'rgba(0,229,168,0.7)' : isActive ? '#4FD1FF' : 'rgba(255,255,255,0.25)',
                              maxWidth: 72,
                            }}>
                            {t(`cases.status_${s.toLowerCase().replace(/\s+/g, '_')}`)}
                          </span>
                        </div>
                        {idx < statuses.length - 1 && (
                          <div className="flex-shrink-0 self-center" style={{ width: 24, height: 2, background: isPast ? '#00E5A8' : 'rgba(255,255,255,0.06)', marginBottom: 22 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_tooth')}</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.tooth_number || t('common.dash')}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3 text-[var(--app-text-muted)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_system')}</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.implant_system || t('common.dash')}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_size')}</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.implant_size || t('common.dash')}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="w-3 h-3 text-[var(--app-text-muted)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_doctor')}</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.doctor_name || t('common.dash')}</span>
              </div>
              {selectedProc.implant_decision && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_decision')}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{selectedProc.implant_decision}</span>
                </div>
              )}
              {selectedProc.abutment_type && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_abutment')}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{selectedProc.abutment_type}</span>
                </div>
              )}
            </div>

            {/* CBCT / Clinical Details */}
            {(selectedProc.bone_condition || selectedProc.bone_density) && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_cbct')}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {selectedProc.bone_condition && (
                    <div>
                      <span className="text-[var(--app-text-dim)]">{t('cases.detail_bone')} </span>
                      <span className="text-white">{selectedProc.bone_condition}</span>
                    </div>
                  )}
                  {selectedProc.bone_density && (
                    <div>
                      <span className="text-[var(--app-text-dim)]">{t('cases.detail_density')} </span>
                      <span className="text-white">{selectedProc.bone_density}</span>
                    </div>
                  )}
                  {selectedProc.bone_height && (
                    <div>
                      <span className="text-[var(--app-text-dim)]">{t('cases.detail_height')} </span>
                      <span className="text-white">{selectedProc.bone_height} mm</span>
                    </div>
                  )}
                  {selectedProc.bone_width && (
                    <div>
                      <span className="text-[var(--app-text-dim)]">{t('cases.detail_width')} </span>
                      <span className="text-white">{selectedProc.bone_width} mm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedProc.ct_scan_notes && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_ct_notes')}</span>
                <p className="text-sm mt-1 text-white/60">{selectedProc.ct_scan_notes}</p>
              </div>
            )}

            {/* Medical Info */}
            {(selectedProc.chronic_disease || selectedProc.medication) && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_medical')}</span>
                <div className="mt-2 space-y-1 text-sm">
                  {selectedProc.chronic_disease && (
                    <div>
                      <span className="text-[var(--app-text-dim)]">{t('cases.detail_chronic')} </span>
                      <span className="text-white">{selectedProc.chronic_disease}</span>
                    </div>
                  )}
                  {selectedProc.medication && (
                    <div>
                      <span className="text-[var(--app-text-dim)]">{t('cases.detail_medication')} </span>
                      <span className="text-white">{selectedProc.medication}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedProc.notes && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('cases.detail_notes')}</span>
                <p className="text-sm mt-1 leading-relaxed text-white/60">{selectedProc.notes}</p>
              </div>
            )}

            {/* Procedure Date */}
            <div className="rounded-xl p-4 bg-[var(--color-primary)]/[0.04] border border-[var(--color-primary)]/10">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-sm font-semibold text-white">{t('cases.detail_date')}</span>
              </div>
              <p className="text-xs text-[var(--app-text-muted)]">
                {selectedProc.procedure_date
                  ? new Date(selectedProc.procedure_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : t('common.dash')}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-strong rounded-xl p-6 flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-[var(--app-text-muted)]">{t('cases.detail_empty')}</p>
          </div>
        )}
      </div>

      {/* ===== NEW PROCEDURE WIZARD MODAL ===== */}
      {showWizard && (
        <FixedOverlay
          className="flex items-start justify-center p-4 pt-10 pb-10 overflow-y-auto bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={closeWizard}
        >
          <div className="w-full max-w-2xl glass-strong rounded-2xl overflow-hidden border border-[var(--app-border-light)]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-bold text-white">
                {editProcId ? t('cases.wizard_title_edit') : t('cases.wizard_title_new')}
              </h2>
              <button
                onClick={closeWizard}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--app-text-dim)] hover:bg-white/5"
                aria-label="Close wizard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-6 px-6 py-5 border-b border-[var(--app-border)]">
              {steps.map((s, idx) => (
                <div key={s.num} className="flex items-center gap-2">
                  <StepCircle num={s.num} active={wizardStep === s.num} done={wizardStep > s.num} />
                  <span className={`text-xs font-medium hidden sm:inline ${
                    wizardStep === s.num
                      ? 'text-[var(--color-primary)]'
                      : wizardStep > s.num
                        ? 'text-[var(--color-success)]'
                        : 'text-white/30'
                  }`}>
                    {s.label}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className={`w-6 h-px hidden sm:block ${wizardStep > s.num ? 'bg-[var(--color-success)]' : 'bg-white/[0.06]'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="p-6 space-y-5 max-h-[55vh] overflow-y-auto">
              {/* Step 1: Patient & Basic */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <label className={labelCls}>{t('cases.wizard_step1_patient')}</label>
                    <select
                      value={form.patient_id}
                      onChange={e => {
                        const p = patients.find(pt => pt.id === e.target.value);
                        updateField('patient_id', e.target.value);
                        if (p) updateField('patient_name', p.full_name);
                      }}
                      className={`${inputCls} cursor-pointer appearance-none`}
                    >
                      <option value="">{t('cases.wizard_placeholder_patient')}</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                    {formErrors.patient_id && <p className="text-[11px] mt-1 text-[var(--color-error)]">{formErrors.patient_id}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>{t('cases.wizard_step1_procedure')}</label>
                      <input
                        value={form.procedure_name}
                        onChange={e => updateField('procedure_name', e.target.value)}
                        placeholder={t('cases.wizard_placeholder_procedure')}
                        className={inputCls}
                      />
                      {formErrors.procedure_name && <p className="text-[11px] mt-1 text-[var(--color-error)]">{formErrors.procedure_name}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>{t('cases.wizard_step1_tooth')}</label>
                      <input
                        value={form.tooth_number}
                        onChange={e => updateField('tooth_number', e.target.value)}
                        placeholder={t('cases.wizard_placeholder_tooth')}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>{t('cases.wizard_step1_date')}</label>
                      <input
                        type="date"
                        value={form.procedure_date}
                        onChange={e => updateField('procedure_date', e.target.value)}
                        className={`${inputCls} [color-scheme:dark]`}
                      />
                      {formErrors.procedure_date && <p className="text-[11px] mt-1 text-[var(--color-error)]">{formErrors.procedure_date}</p>}
                    </div>
                    <div className="relative">
                      <label className={labelCls}>{t('cases.wizard_step1_doctor')}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {doctorAssignments.map(d => {
                          const doc = doctors.find(dd => dd.auth_user_id === d.doctor_id || dd.id === d.doctor_id);
                          return (
                            <span
                              key={d.doctor_id}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                d.role_in_procedure === 'primary'
                                  ? 'bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/20 text-[var(--color-primary)]'
                                  : 'bg-white/5 border border-white/10 text-white/60'
                              }`}
                            >
                              {d.role_in_procedure === 'primary' && <span className="text-[var(--color-primary)] mr-0.5">★</span>}
                              <span>{doc?.full_name || d.doctor_id}</span>
                              <button
                                onClick={() => removeDoctorAssignment(d.doctor_id)}
                                className="ml-0.5 hover:opacity-70 text-white/30"
                                aria-label={`Remove ${doc?.full_name || d.doctor_id}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      {doctorAssignments.length < 3 && (
                        <div className="relative">
                          <input
                            value={doctorSearch}
                            onChange={e => { setDoctorSearch(e.target.value); setShowDoctorDropdown(true); }}
                            onFocus={() => setShowDoctorDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDoctorDropdown(false), 200)}
                            placeholder={t('cases.wizard_placeholder_doctor')}
                            className={inputCls}
                          />
                          {showDoctorDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 bg-[var(--app-surface-modal)] border border-[var(--app-border-light)] shadow-lg">
                              {getAvailableDoctors(doctorAssignments.map(d => d.doctor_id))
                                .filter(d => !doctorSearch || d.full_name?.toLowerCase().includes(doctorSearch.toLowerCase()))
                                .slice(0, 10)
                                .map(d => (
                                  <button
                                    key={d.auth_user_id || d.id}
                                    onMouseDown={() => addDoctorAssignment(d.auth_user_id || d.id)}
                                    className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.04] text-white/80"
                                  >
                                    {d.full_name || d.username}
                                  </button>
                                ))}
                              {getAvailableDoctors(doctorAssignments.map(d => d.doctor_id)).length === 0 && (
                                <div className="px-3 py-2 text-xs text-[var(--app-text-muted)]">No doctors available</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {formErrors.doctor && <p className="text-[11px] mt-1 text-[var(--color-error)]">{formErrors.doctor}</p>}
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: CT Scan & Medical History */}
              {wizardStep === 2 && (
                <>
                  <div className={`${sectionCls} bg-[var(--color-primary)]/[0.04] border border-[var(--color-primary)]/10`}>
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                      {t('cases.wizard_step2_cbct')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step2_bone_condition')}</label>
                        <select
                          value={form.bone_condition}
                          onChange={e => updateField('bone_condition', e.target.value)}
                          className={`${inputCls} cursor-pointer appearance-none`}
                        >
                          <option value="">{t('cases.wizard_bone_select')}</option>
                          {boneConditionValues.map((o, i) => (
                            <option key={o} value={o}>{t(`cases.wizard_bone_type${i + 1}`)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step2_bone_density')}</label>
                        <select
                          value={form.bone_density}
                          onChange={e => updateField('bone_density', e.target.value)}
                          className={`${inputCls} cursor-pointer appearance-none`}
                        >
                          <option value="">{t('cases.wizard_bone_select')}</option>
                          {boneDensityValues.map((o, i) => (
                            <option key={o} value={o}>{t(`cases.wizard_density_${['high', 'medium', 'low'][i]}`)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step2_bone_height')}</label>
                        <input
                          type="number" min="0" step="0.1"
                          value={form.bone_height}
                          onChange={e => updateField('bone_height', e.target.value)}
                          placeholder="0.0"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step2_bone_width')}</label>
                        <input
                          type="number" min="0" step="0.1"
                          value={form.bone_width}
                          onChange={e => updateField('bone_width', e.target.value)}
                          placeholder="0.0"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className={labelCls}>{t('cases.wizard_step2_pathology')}</label>
                      <input
                        value={form.pathology}
                        onChange={e => updateField('pathology', e.target.value)}
                        placeholder="Any pathology or infection noted on CBCT"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{t('cases.wizard_step2_ct_notes')}</label>
                      <textarea
                        value={form.ct_scan_notes}
                        onChange={e => updateField('ct_scan_notes', e.target.value)}
                        rows={2}
                        className={`${inputCls} min-h-16 pt-2 resize-none`}
                        placeholder="Additional observations..."
                      />
                    </div>
                  </div>

                  <div className={`${sectionCls} bg-[var(--color-success)]/[0.03] border border-[var(--color-success)]/10`}>
                    <h3 className="text-sm font-semibold text-white mb-4">{t('cases.wizard_step2_medical')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step2_chronic')}</label>
                        <input
                          value={form.chronic_disease}
                          onChange={e => updateField('chronic_disease', e.target.value)}
                          placeholder="e.g. Diabetes, HTN"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step2_medication')}</label>
                        <input
                          value={form.medication}
                          onChange={e => updateField('medication', e.target.value)}
                          placeholder="e.g. Anticoagulants"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Implant Planning */}
              {wizardStep === 3 && (
                <>
                  <div className={`${sectionCls} bg-[var(--color-secondary)]/[0.04] border border-[var(--color-secondary)]/10`}>
                    <h3 className="text-sm font-semibold text-white mb-4">{t('cases.wizard_step3_decision')}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step3_decision_field')}</label>
                        <select
                          value={form.implant_decision}
                          onChange={e => updateField('implant_decision', e.target.value)}
                          className={`${inputCls} cursor-pointer appearance-none`}
                        >
                          <option value="">{t('cases.wizard_bone_select')}</option>
                          {decisions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step3_extraction')}</label>
                        <div className="flex items-center gap-3 h-10">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio" name="extraction"
                              checked={form.extraction_needed === true}
                              onChange={() => updateField('extraction_needed', true)}
                              className="accent-[var(--color-primary)]"
                            />
                            <span className="text-white/70">{t('common.yes')}</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio" name="extraction"
                              checked={form.extraction_needed === false}
                              onChange={() => updateField('extraction_needed', false)}
                              className="accent-[var(--color-primary)]"
                            />
                            <span className="text-white/70">{t('common.no')}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${sectionCls} bg-[var(--color-warning)]/[0.04] border border-[var(--color-warning)]/10`}>
                    <h3 className="text-sm font-semibold text-white mb-4">{t('cases.wizard_step3_selection')}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step3_brand')}</label>
                        <select
                          value={form.implant_brand}
                          onChange={e => {
                            updateField('implant_brand', e.target.value);
                            updateField('implant_system', e.target.value);
                            updateField('implant_size', '');
                          }}
                          className={`${inputCls} cursor-pointer appearance-none`}
                        >
                          <option value="">{t('cases.wizard_placeholder_brand')}</option>
                          {implantBrands.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>{t('cases.wizard_step3_size')}</label>
                        <select
                          value={form.implant_size}
                          onChange={e => updateField('implant_size', e.target.value)}
                          disabled={!form.implant_brand}
                          className={`${inputCls} cursor-pointer appearance-none`}
                        >
                          <option value="">
                            {form.implant_brand ? t('cases.wizard_placeholder_size') : t('cases.wizard_placeholder_size_brand_first')}
                          </option>
                          {implantSizesForBrand.map(item => (
                            <option key={item.id} value={item.size} disabled={item.quantity <= 0}>
                              {t('cases.wizard_size_available', { size: item.size, count: item.quantity })}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('cases.wizard_step3_abutment')}</label>
                      <select
                        value={form.abutment_type}
                        onChange={e => updateField('abutment_type', e.target.value)}
                        className={`${inputCls} cursor-pointer appearance-none`}
                      >
                        <option value="">{t('cases.wizard_bone_select')}</option>
                        {abutmentTypes.map(o => {
                          const inv = abutmentInv.find(a => a.type === o);
                          const disabled = inv ? inv.quantity <= 0 : false;
                          return (
                            <option key={o} value={o} disabled={disabled}>
                              {t('cases.wizard_abutment_available', { type: o, count: inv ? inv.quantity : 0 })}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>{t('common.notes')}</label>
                    <textarea
                      value={form.notes}
                      onChange={e => updateField('notes', e.target.value)}
                      rows={2}
                      className={`${inputCls} min-h-16 pt-2 resize-none`}
                      placeholder={t('cases.wizard_notes_placeholder')}
                    />
                  </div>
                </>
              )}

              {/* Step 4: Confirmation */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Check className="w-4 h-4 text-[var(--color-success)]" />
                    {t('cases.wizard_step4_review')}
                  </h3>

                  {/* Section 1: Basic Info */}
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-[var(--app-card-border)]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]/60">{t('cases.wizard_step4_section1')}</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_patient')} </span>
                        <span className="text-white">{form.patient_name || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_procedure')} </span>
                        <span className="text-white">{form.procedure_name || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_tooth')} </span>
                        <span className="text-white">{form.tooth_number || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_date')} </span>
                        <span className="text-white">{form.procedure_date || t('common.dash')}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_doctor')} </span>
                        <div className="inline-flex flex-wrap gap-1.5 mt-1">
                          {doctorAssignments.length > 0
                            ? doctorAssignments.map(d => {
                                const doc = doctors.find(dd => dd.auth_user_id === d.doctor_id || dd.id === d.doctor_id);
                                return (
                                  <span
                                    key={d.doctor_id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                    style={{
                                      background: d.role_in_procedure === 'primary' ? 'rgba(79,209,255,0.12)' : 'rgba(255,255,255,0.06)',
                                      color: d.role_in_procedure === 'primary' ? '#4FD1FF' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {doc?.full_name || d.doctor_id}
                                    {d.role_in_procedure === 'primary' && <span style={{ color: '#4FD1FF', opacity: 0.6 }}>★</span>}
                                  </span>
                                );
                              })
                            : <span className="text-white">{form.doctor_name || t('common.dash')}</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: CBCT & Medical */}
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-[var(--app-card-border)]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]/60">{t('cases.wizard_step4_section2')}</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_bone')} </span>
                        <span className="text-white">{form.bone_condition || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_density')} </span>
                        <span className="text-white">{form.bone_density || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_height')} </span>
                        <span className="text-white">{form.bone_height || t('common.dash')} mm</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_width')} </span>
                        <span className="text-white">{form.bone_width || t('common.dash')} mm</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_pathology')} </span>
                        <span className="text-white">{form.pathology || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_chronic')} </span>
                        <span className="text-white">{form.chronic_disease || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_medication')} </span>
                        <span className="text-white">{form.medication || t('common.dash')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Implant Details */}
                  <div className="rounded-xl p-4 bg-white/[0.02] border border-[var(--app-card-border)]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]/60">{t('cases.wizard_step4_section3')}</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_decision')} </span>
                        <span className="text-white">{form.implant_decision || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_extraction')} </span>
                        <span className="text-white">{form.extraction_needed ? t('common.yes') : t('common.no')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_brand')} </span>
                        <span className="text-white">{form.implant_brand || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_size')} </span>
                        <span className="text-white">{form.implant_size || t('common.dash')}</span>
                      </div>
                      <div>
                        <span className="text-[var(--app-text-dim)]">{t('cases.wizard_review_abutment')} </span>
                        <span className="text-white">{form.abutment_type || t('common.dash')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--app-border)]">
              <button
                onClick={closeWizard}
                className="btn-ghost btn-sm"
                aria-label={t('cases.wizard_cancel')}
              >
                {t('cases.wizard_cancel')}
              </button>
              <div className="flex items-center gap-3">
                {wizardStep > 1 && (
                  <button
                    onClick={handlePrev}
                    className="btn-ghost btn-sm"
                    aria-label={t('cases.wizard_back')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('cases.wizard_back')}
                  </button>
                )}
                {wizardStep < 4 ? (
                  <button
                    onClick={handleNext}
                    className="btn-primary btn-sm"
                    aria-label={t('cases.wizard_next')}
                  >
                    {t('cases.wizard_next')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn-primary btn-sm"
                    aria-label={editProcId ? t('cases.wizard_update') : t('cases.wizard_create')}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? t('cases.wizard_saving')
                      : editProcId
                        ? t('cases.wizard_update')
                        : t('cases.wizard_create')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteConfirmId && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => setDeleteConfirmId(null)}
        >
          <div className="w-full max-w-sm glass-strong rounded-2xl border border-[var(--app-border-light)]">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--color-error)]/10">
                <Trash2 className="w-6 h-6 text-[var(--color-error)]" />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">{t('cases.modal_delete_title')}</h3>
              <p className="text-sm text-center text-[var(--app-text-dim)]">{t('cases.modal_delete_desc')}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--app-border)]">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="btn-ghost btn-sm"
                aria-label={t('cases.modal_delete_cancel')}
              >
                {t('cases.modal_delete_cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deleteConfirmId })}
                disabled={deleteMutation.isPending}
                className="btn-danger btn-sm"
                aria-label={t('cases.modal_delete_confirm')}
              >
                {deleteMutation.isPending ? t('cases.modal_delete_deleting') : t('cases.modal_delete_confirm')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}
    </div>
  );
}