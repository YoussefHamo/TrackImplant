import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { procedureService } from '../services/procedureService';
import { patientService } from '../services/patientService';
import { followUpService } from '../services/followUpService';
import { implantInventoryService } from '../services/implantInventoryService';
import {
  Search, Activity, AlertTriangle,
  Calendar, User, Plus, X, ChevronRight, ChevronLeft, Check,
  Trash2, Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import type { Procedure } from '../types';

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
  const c = statusStyles[status] || { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.3)' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider block mb-1.5';
const sectionCls = 'rounded-xl p-4';

const steps = [
  { num: 1, label: 'Patient & Basic' },
  { num: 2, label: 'CT Scan & History' },
  { num: 3, label: 'Implant Planning' },
  { num: 4, label: 'Confirm & Save' },
];

const boneConditions = ['Type I (Dense)', 'Type II (Medium)', 'Type III (Soft)', 'Type IV (Very Soft)'];
const boneDensities = ['High (>850 HU)', 'Medium (500-850 HU)', 'Low (<500 HU)'];
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
  const bg = done ? '#00E5A8' : active ? '#4FD1FF' : 'rgba(255,255,255,0.06)';
  const text = done || active ? '#050B14' : 'rgba(255,255,255,0.3)';
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
      style={{ background: bg, color: text }}>
      {done ? <Check className="w-4 h-4" /> : num}
    </div>
  );
}

export function ImplantCases() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editProcId, setEditProcId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const selectedId = searchParams.get('id') || '';

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => procedureService.getAll(),
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

  const implantBrands = useMemo(() => [...new Set(implants.map(i => i.brand))].sort(), [implants]);
  const implantSizesForBrand = useMemo(() => {
    if (!form.implant_brand) return [];
    return implants.filter(i => i.brand === form.implant_brand);
  }, [implants, form.implant_brand]);
  const abutmentTypes = useMemo(() => abutmentInv.map(a => a.type), [abutmentInv]);

  const filtered = useMemo(() => {
    if (!searchQuery) return procedures;
    const q = searchQuery.toLowerCase();
    return procedures.filter(p =>
      p.procedure_name.toLowerCase().includes(q) ||
      (p.tooth_number || '').toLowerCase().includes(q) ||
      (p.implant_system || '').toLowerCase().includes(q) ||
      (p.doctor_name || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q)
    );
  }, [procedures, searchQuery]);

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
    mutationFn: ({ id, status }: { id: string; status: string }) => procedureService.updateStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); invalidateAll(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Procedure, 'id' | 'created_at'>) => procedureService.create(data),
    onSuccess: () => {
      toast.success('Implant case created');
      invalidateAll();
      closeWizard();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Procedure> }) => procedureService.update(id, data),
    onSuccess: () => {
      toast.success('Procedure updated');
      invalidateAll();
      closeWizard();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => procedureService.delete(id),
    onSuccess: () => {
      toast.success('Procedure deleted');
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
      if (!form.patient_id) errs.patient_id = 'Patient is required';
      if (!form.procedure_name.trim()) errs.procedure_name = 'Procedure name is required';
      if (!form.procedure_date) errs.procedure_date = 'Date is required';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => { if (validateStep(wizardStep)) setWizardStep(s => s + 1); };
  const handlePrev = () => setWizardStep(s => Math.max(1, s - 1));

  const openEditWizard = (proc: Procedure) => {
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
    setWizardStep(1);
    setShowWizard(true);
  };

  const handleSave = () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    const patient = patients.find(p => p.id === form.patient_id);
    if (!patient) { toast.error('Patient not found'); return; }

    // Check implant stock
    if (form.implant_brand && form.implant_size) {
      const invItem = implants.find(i => i.brand === form.implant_brand && i.size === form.implant_size);
      if (invItem && invItem.quantity <= 0) {
        toast.error('No stock available for selected implant.');
        return;
      }
    }

    // Check abutment stock
    if (form.abutment_type) {
      const abtItem = abutmentInv.find(a => a.type === form.abutment_type);
      if (abtItem && abtItem.quantity <= 0) {
        toast.error('No stock available for selected abutment.');
        return;
      }
    }

    if (editProcId) {
      updateMutation.mutate({
        id: editProcId,
        data: {
          patient_id: form.patient_id,
          procedure_name: form.procedure_name.trim(),
          tooth_number: form.tooth_number || undefined,
          implant_brand: form.implant_brand || undefined,
          implant_system: form.implant_system || undefined,
          implant_size: form.implant_size || undefined,
          procedure_date: form.procedure_date,
          doctor_name: form.doctor_name || undefined,
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
        },
      });
    } else {
      createMutation.mutate({
        patient_id: form.patient_id,
        procedure_name: form.procedure_name.trim(),
        tooth_number: form.tooth_number || undefined,
        implant_brand: form.implant_brand || undefined,
        implant_system: form.implant_system || undefined,
        implant_size: form.implant_size || undefined,
        procedure_date: form.procedure_date,
        status: 'Consultation',
        doctor_name: form.doctor_name || undefined,
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
      });
    }
  };

  const closeWizard = () => {
    setShowWizard(false);
    setWizardStep(1);
    setForm({ ...emptyForm });
    setFormErrors({});
    setEditProcId(null);
  };

  return (
    <div className="font-sans select-none space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Procedure Tracking</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {isLoading ? 'Loading...' : `${procedures.length} procedures`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search procedures..."
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }} />
          </div>
          <button onClick={() => setShowWizard(true)}
            className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all duration-300 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
            <Plus className="w-4 h-4" /> New Procedure
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        {/* LEFT — Procedures List */}
        <div className="rounded-[22px] overflow-hidden"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            <div className="flex-[2.5]">Patient / Procedure</div>
            <div className="flex-[1.5]">Tooth</div>
            <div className="flex-[1.5]">Doctor</div>
            <div className="flex-[1.5]">Status</div>
            <div className="flex-[1.5]">Date</div>
          </div>

          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {searchQuery ? 'No procedures match your search' : 'No procedures yet.'}
              </div>
            ) : filtered.map(proc => {
              const patient = patientMap.get(proc.patient_id);
              return (
                <div key={proc.id} onClick={() => setSearchParams({ id: proc.id })}
                  className="flex items-center px-6 py-4 transition-all duration-150 cursor-pointer relative"
                  style={{ background: selectedId === proc.id ? 'rgba(79,209,255,0.04)' : 'transparent' }}
                  onMouseEnter={e => { if (selectedId !== proc.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (selectedId !== proc.id) e.currentTarget.style.background = 'transparent'; }}>
                  {selectedId === proc.id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style={{ background: '#4FD1FF', boxShadow: '0 0 8px rgba(79,209,255,0.5)' }} />
                  )}
                  <div className="flex-[2.5]">
                    <div className="text-sm font-medium text-white">{patient?.full_name || 'Unknown'}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{proc.procedure_name}</div>
                  </div>
                  <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{proc.tooth_number || '—'}</div>
                  <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{proc.doctor_name || '—'}</div>
                  <div className="flex-[1.5] flex items-center gap-2">
                    <StatusBadge status={proc.status} />
                    {proc.status === 'Conclusion' && procFailureMap.has(proc.patient_id) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <AlertTriangle className="w-2.5 h-2.5" /> Failure
                      </span>
                    )}
                  </div>
                  <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {proc.procedure_date ? new Date(proc.procedure_date).toLocaleDateString() : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Selected Procedure Detail */}
        {selectedProc ? (
          <div className="rounded-[22px] p-6"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'rgba(79,209,255,0.1)', border: '2px solid rgba(79,209,255,0.2)', color: '#4FD1FF' }}>
                {(patientMap.get(selectedProc.patient_id)?.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-white truncate">{patientMap.get(selectedProc.patient_id)?.full_name || 'Unknown Patient'}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{selectedProc.procedure_name}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => openEditWizard(selectedProc)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,209,255,0.1)'; e.currentTarget.style.color = '#4FD1FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  title="Edit Procedure">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteConfirmId(selectedProc.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  title="Delete Procedure">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Progress Timeline — Horizontal Stepper */}
            <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Progress Timeline</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedProc.status} />
                  {selectedProc.status === 'Conclusion' && procFailureMap.has(selectedProc.patient_id) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertTriangle className="w-3 h-3" /> Returned Due To Failure
                    </span>
                  )}
                </div>
              </div>
              {/* Stepper track */}
              <div className="overflow-x-auto pb-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(79,209,255,0.25) rgba(255,255,255,0.04)' }}>
                <style>{`div::-webkit-scrollbar { height: 4px; } div::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 4px; } div::-webkit-scrollbar-thumb { background: rgba(79,209,255,0.25); border-radius: 4px; } div::-webkit-scrollbar-thumb:hover { background: rgba(79,209,255,0.4); }`}</style>
                <div className="flex items-start gap-0">
                  {statuses.map((s, idx) => {
                    const isActive = idx === currentIdx;
                    const isPast = idx < currentIdx;
                    const labelColor = isPast ? 'rgba(0,229,168,0.7)' : isActive ? '#4FD1FF' : 'rgba(255,255,255,0.25)';
                    const lineColor = isPast ? '#00E5A8' : 'rgba(255,255,255,0.06)';
                    return (
                      <div key={s} className="flex items-start flex-shrink-0">
                        {/* Node + label column */}
                        <div className="flex flex-col items-center gap-1.5" style={{ width: 80 }}>
                          <button onClick={() => { if (!isPast && !isActive) updateStatusMutation.mutate({ id: selectedProc.id, status: s }); }}
                            className="relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90"
                            style={{
                              background: isPast ? '#00E5A8' : isActive ? '#4FD1FF' : 'rgba(255,255,255,0.06)',
                              border: isActive ? '2px solid rgba(79,209,255,0.5)' : '2px solid transparent',
                              boxShadow: isActive ? '0 0 16px rgba(79,209,255,0.45)' : 'none',
                              cursor: isPast ? 'default' : 'pointer',
                            }}>
                            {isPast ? (
                              <Check className="w-3.5 h-3.5" style={{ color: '#050B14' }} />
                            ) : isActive ? (
                              <span className="w-2 h-2 rounded-full" style={{ background: '#050B14' }} />
                            ) : (
                              <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                            )}
                          </button>
                          <span className="text-[9px] font-semibold text-center leading-tight transition-all"
                            style={{ color: labelColor, maxWidth: 72 }}>
                            {s}
                          </span>
                        </div>
                        {/* Connector line (not after last) */}
                        {idx < statuses.length - 1 && (
                          <div className="flex-shrink-0 self-center" style={{ width: 24, height: 2, background: lineColor, marginBottom: 22 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Tooth</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.tooth_number || '—'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>System</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.implant_system || '—'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Impl. Size</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.implant_size || '—'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Doctor</span>
                </div>
                <span className="text-sm font-medium text-white">{selectedProc.doctor_name || '—'}</span>
              </div>
              {selectedProc.implant_decision && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Decision</span>
                  </div>
                  <span className="text-sm font-medium text-white">{selectedProc.implant_decision}</span>
                </div>
              )}
              {selectedProc.abutment_type && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Abutment</span>
                  </div>
                  <span className="text-sm font-medium text-white">{selectedProc.abutment_type}</span>
                </div>
              )}
            </div>

            {/* Clinical Details */}
            {(selectedProc.bone_condition || selectedProc.bone_density) && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>CBCT Analysis</span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {selectedProc.bone_condition && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Bone: </span><span className="text-white">{selectedProc.bone_condition}</span></div>}
                  {selectedProc.bone_density && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Density: </span><span className="text-white">{selectedProc.bone_density}</span></div>}
                  {selectedProc.bone_height && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Height: </span><span className="text-white">{selectedProc.bone_height} mm</span></div>}
                  {selectedProc.bone_width && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Width: </span><span className="text-white">{selectedProc.bone_width} mm</span></div>}
                </div>
              </div>
            )}

            {selectedProc.ct_scan_notes && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>CT Notes</span>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{selectedProc.ct_scan_notes}</p>
              </div>
            )}

            {(selectedProc.chronic_disease || selectedProc.medication) && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Medical History</span>
                <div className="mt-2 space-y-1 text-sm">
                  {selectedProc.chronic_disease && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Chronic Disease: </span><span className="text-white">{selectedProc.chronic_disease}</span></div>}
                  {selectedProc.medication && <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Medication: </span><span className="text-white">{selectedProc.medication}</span></div>}
                </div>
              </div>
            )}

            {selectedProc.notes && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Notes</span>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{selectedProc.notes}</p>
              </div>
            )}

            <div className="rounded-xl p-4" style={{ background: 'rgba(79,209,255,0.04)', border: '1px solid rgba(79,209,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[#4FD1FF]" />
                <span className="text-sm font-semibold text-white">Procedure Date</span>
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {selectedProc.procedure_date ? new Date(selectedProc.procedure_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] p-6 flex items-center justify-center h-64"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: 'rgba(255,255,255,0.2)' }} className="text-sm">Select a procedure to view details</p>
          </div>
        )}
      </div>

      {/* ===== NEW PROCEDURE WIZARD MODAL ===== */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 pb-10 overflow-y-auto"
          style={{ background: 'rgba(5,11,20,0.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeWizard(); }}>
          <div className="w-full max-w-2xl rounded-[24px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.97)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">{editProcId ? 'Edit Implant Procedure' : 'New Implant Procedure'}</h2>
              <button onClick={closeWizard} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-6 px-6 py-5 border-b border-[rgba(255,255,255,0.04)]">
              {steps.map((s, idx) => (
                <div key={s.num} className="flex items-center gap-2">
                  <StepCircle num={s.num} active={wizardStep === s.num} done={wizardStep > s.num} />
                  <span className="text-xs font-medium hidden sm:inline" style={{
                    color: wizardStep === s.num ? '#4FD1FF' : wizardStep > s.num ? '#00E5A8' : 'rgba(255,255,255,0.3)'
                  }}>{s.label}</span>
                  {idx < steps.length - 1 && (
                    <div className="w-6 h-px hidden sm:block" style={{ background: wizardStep > s.num ? '#00E5A8' : 'rgba(255,255,255,0.06)' }} />
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
                    <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Patient *</label>
                    <select value={form.patient_id} onChange={e => {
                      const p = patients.find(pt => pt.id === e.target.value);
                      updateField('patient_id', e.target.value);
                      if (p) updateField('patient_name', p.full_name);
                    }} className={inputCls + ' cursor-pointer appearance-none'}>
                      <option value="" style={{ background: '#0D1B2A' }}>Select patient...</option>
                      {patients.map(p => <option key={p.id} value={p.id} style={{ background: '#0D1B2A' }}>{p.full_name}</option>)}
                    </select>
                    {formErrors.patient_id && <p className="text-[11px] mt-1 text-red-400">{formErrors.patient_id}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Procedure Name *</label>
                      <input value={form.procedure_name} onChange={e => updateField('procedure_name', e.target.value)}
                        placeholder="e.g. Implant #14" className={inputCls} />
                      {formErrors.procedure_name && <p className="text-[11px] mt-1 text-red-400">{formErrors.procedure_name}</p>}
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Tooth Number</label>
                      <input value={form.tooth_number} onChange={e => updateField('tooth_number', e.target.value)}
                        placeholder="e.g. #14" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Procedure Date *</label>
                      <input type="date" value={form.procedure_date} onChange={e => updateField('procedure_date', e.target.value)}
                        className={inputCls + ' [color-scheme:dark]'} />
                      {formErrors.procedure_date && <p className="text-[11px] mt-1 text-red-400">{formErrors.procedure_date}</p>}
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Doctor Name</label>
                      <input value={form.doctor_name} onChange={e => updateField('doctor_name', e.target.value)}
                        placeholder="Dr. name" className={inputCls} />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: CT Scan & Medical History */}
              {wizardStep === 2 && (
                <>
                  <div className={sectionCls} style={{ background: 'rgba(79,209,255,0.04)', border: '1px solid rgba(79,209,255,0.1)' }}>
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#4FD1FF]" /> CBCT Scan Analysis
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Bone Condition</label>
                        <select value={form.bone_condition} onChange={e => updateField('bone_condition', e.target.value)}
                          className={inputCls + ' cursor-pointer appearance-none'}>
                          <option value="" style={{ background: '#0D1B2A' }}>Select...</option>
                          {boneConditions.map(o => <option key={o} value={o} style={{ background: '#0D1B2A' }}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Bone Density</label>
                        <select value={form.bone_density} onChange={e => updateField('bone_density', e.target.value)}
                          className={inputCls + ' cursor-pointer appearance-none'}>
                          <option value="" style={{ background: '#0D1B2A' }}>Select...</option>
                          {boneDensities.map(o => <option key={o} value={o} style={{ background: '#0D1B2A' }}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Bone Height (mm)</label>
                        <input type="number" min="0" step="0.1" value={form.bone_height} onChange={e => updateField('bone_height', e.target.value)}
                          placeholder="0.0" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Bone Width (mm)</label>
                        <input type="number" min="0" step="0.1" value={form.bone_width} onChange={e => updateField('bone_width', e.target.value)}
                          placeholder="0.0" className={inputCls} />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Pathology / Infection</label>
                      <input value={form.pathology} onChange={e => updateField('pathology', e.target.value)}
                        placeholder="Any pathology or infection noted on CBCT" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>CT Scan Notes</label>
                      <textarea value={form.ct_scan_notes} onChange={e => updateField('ct_scan_notes', e.target.value)}
                        rows={2} className={inputCls + ' h-16 pt-2 resize-none'} placeholder="Additional observations..." />
                    </div>
                  </div>

                  <div className={sectionCls} style={{ background: 'rgba(0,229,168,0.03)', border: '1px solid rgba(0,229,168,0.08)' }}>
                    <h3 className="text-sm font-semibold text-white mb-4">Medical History</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Chronic Disease</label>
                        <input value={form.chronic_disease} onChange={e => updateField('chronic_disease', e.target.value)}
                          placeholder="e.g. Diabetes, HTN" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Medication</label>
                        <input value={form.medication} onChange={e => updateField('medication', e.target.value)}
                          placeholder="e.g. Anticoagulants" className={inputCls} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Implant Planning */}
              {wizardStep === 3 && (
                <>
                  <div className={sectionCls} style={{ background: 'rgba(124,92,255,0.04)', border: '1px solid rgba(124,92,255,0.1)' }}>
                    <h3 className="text-sm font-semibold text-white mb-4">Implant Decision</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Implant Decision *</label>
                        <select value={form.implant_decision} onChange={e => updateField('implant_decision', e.target.value)}
                          className={inputCls + ' cursor-pointer appearance-none'}>
                          <option value="" style={{ background: '#0D1B2A' }}>Select...</option>
                          {decisions.map(o => <option key={o} value={o} style={{ background: '#0D1B2A' }}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Extraction Needed</label>
                        <div className="flex items-center gap-3 h-10">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="radio" name="extraction" checked={form.extraction_needed === true}
                              onChange={() => updateField('extraction_needed', true)} className="accent-[#4FD1FF]" />
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Yes</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="radio" name="extraction" checked={form.extraction_needed === false}
                              onChange={() => updateField('extraction_needed', false)} className="accent-[#4FD1FF]" />
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>No</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={sectionCls} style={{ background: 'rgba(255,193,7,0.04)', border: '1px solid rgba(255,193,7,0.1)' }}>
                    <h3 className="text-sm font-semibold text-white mb-4">Implant Selection</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Implant Brand</label>
                        <select value={form.implant_brand} onChange={e => { updateField('implant_brand', e.target.value); updateField('implant_size', ''); }}
                          className={inputCls + ' cursor-pointer appearance-none'}>
                          <option value="" style={{ background: '#0D1B2A' }}>Select brand...</option>
                          {implantBrands.map(o => <option key={o} value={o} style={{ background: '#0D1B2A' }}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Implant Size</label>
                        <select value={form.implant_size} onChange={e => updateField('implant_size', e.target.value)}
                          disabled={!form.implant_brand}
                          className={inputCls + ' cursor-pointer appearance-none'}>
                          <option value="" style={{ background: '#0D1B2A' }}>{form.implant_brand ? 'Select size...' : 'Select a brand first'}</option>
                          {implantSizesForBrand.map(item => (
                            <option key={item.id} value={item.size} disabled={item.quantity <= 0} style={{ background: '#0D1B2A' }}>
                              {item.size} (Available: {item.quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Abutment Type</label>
                      <select value={form.abutment_type} onChange={e => updateField('abutment_type', e.target.value)}
                        className={inputCls + ' cursor-pointer appearance-none'}>
                        <option value="" style={{ background: '#0D1B2A' }}>Select...</option>
                        {abutmentTypes.map(o => {
                          const inv = abutmentInv.find(a => a.type === o);
                          const disabled = inv ? inv.quantity <= 0 : false;
                          return (
                            <option key={o} value={o} disabled={disabled} style={{ background: '#0D1B2A' }}>
                              {o}{inv ? ` (Available: ${inv.quantity})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>Additional Notes</label>
                    <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)}
                      rows={2} className={inputCls + ' h-16 pt-2 resize-none'} placeholder="Any additional notes..." />
                  </div>
                </>
              )}

              {/* Step 4: Confirmation */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00E5A8]" /> Review & Confirm
                  </h3>
                  <div className={sectionCls} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(79,209,255,0.6)' }}>Step 1: Patient & Basic</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Patient: </span><span className="text-white">{form.patient_name || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Procedure: </span><span className="text-white">{form.procedure_name || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Tooth: </span><span className="text-white">{form.tooth_number || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Date: </span><span className="text-white">{form.procedure_date || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Doctor: </span><span className="text-white">{form.doctor_name || '—'}</span></div>
                    </div>
                  </div>
                  <div className={sectionCls} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(79,209,255,0.6)' }}>Step 2: CBCT & Medical History</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Bone: </span><span className="text-white">{form.bone_condition || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Density: </span><span className="text-white">{form.bone_density || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Height: </span><span className="text-white">{form.bone_height || '—'} mm</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Width: </span><span className="text-white">{form.bone_width || '—'} mm</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Pathology: </span><span className="text-white">{form.pathology || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Chronic Disease: </span><span className="text-white">{form.chronic_disease || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Medication: </span><span className="text-white">{form.medication || '—'}</span></div>
                    </div>
                  </div>
                  <div className={sectionCls} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(79,209,255,0.6)' }}>Step 3: Implant Planning</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Decision: </span><span className="text-white">{form.implant_decision || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Extraction: </span><span className="text-white">{form.extraction_needed ? 'Yes' : 'No'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Brand: </span><span className="text-white">{form.implant_brand || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Size: </span><span className="text-white">{form.implant_size || '—'}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.35)' }}>Abutment: </span><span className="text-white">{form.abutment_type || '—'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={closeWizard}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {wizardStep > 1 && (
                  <button onClick={handlePrev}
                    className="h-10 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                {wizardStep < 4 ? (
                  <button onClick={handleNext}
                    className="h-10 px-5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}
                    className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #00E5A8, #45D6FF)', color: '#050B14', boxShadow: '0 4px 20px rgba(0,229,168,0.25)' }}>
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editProcId ? 'Update Procedure' : 'Create Implant Case'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirmId(null); }}>
          <div className="w-full max-w-sm rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Trash2 className="w-6 h-6" style={{ color: '#ef4444' }} />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Delete Procedure?</h3>
              <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                This will permanently delete this implant case and cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setDeleteConfirmId(null)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}
                className="h-10 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: '#ef4444', color: 'white' }}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
