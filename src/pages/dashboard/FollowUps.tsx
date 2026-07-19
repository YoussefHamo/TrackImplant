import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { followUpService } from '../../services/followUpService';
import { patientService } from '../../services/patientService';
import { procedureService } from '../../services/procedureService';
import type { HealingStatus, FollowUp } from '../../types';
import {
  Activity, AlertTriangle, Heart, Search, TrendingUp, AlertCircle, Plus, X, Edit2, Trash2, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import FixedOverlay from '../../components/ui/FixedOverlay';
import EmptyState from '../../components/ui/EmptyState';

const healingColors: Record<HealingStatus, { bg: string; text: string; glow: string }> = {
  OnTrack: { bg: 'var(--color-success-container)', text: 'var(--color-success)', glow: 'rgba(52,211,153,0.3)' },
  Healing: { bg: 'var(--color-primary-container)', text: 'var(--color-primary)', glow: 'rgba(79,209,255,0.3)' },
  Critical: { bg: 'var(--color-warning-container)', text: 'var(--color-warning)', glow: 'rgba(251,191,36,0.3)' },
  Failure: { bg: 'var(--color-error-container)', text: 'var(--color-error)', glow: 'rgba(244,63,94,0.3)' },
  Completed: { bg: 'var(--color-success-container)', text: 'var(--color-success)', glow: 'rgba(52,211,153,0.3)' },
};

function HealthScoreCircle({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-error)';
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function PainMeter({ level }: { level: number }) {
  const pct = Math.min(level / 10 * 100, 100);
  const color = level <= 3 ? 'var(--color-success)' : level <= 6 ? 'var(--color-warning)' : 'var(--color-error)';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-dim)' }}>Pain</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{level}/10</span>
    </div>
  );
}

export default function FollowUps() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_id: '', procedure_id: '', health_score: 80, pain_level: 2, healing_status: 'OnTrack' as HealingStatus, notes: '',
  });

  const resetForm = () => {
    setForm({ patient_id: '', procedure_id: '', health_score: 80, pain_level: 2, healing_status: 'OnTrack', notes: '' });
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (f: FollowUp) => {
    setForm({
      patient_id: f.patient_id,
      procedure_id: f.procedure_id || '',
      health_score: f.health_score ?? 80,
      pain_level: f.pain_level ?? 2,
      healing_status: f.healing_status || 'OnTrack',
      notes: f.notes || '',
    });
    setEditingId(f.id);
    setShowModal(true);
  };

  const { data: followUps = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => followUpService.getAll(),
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => procedureService.getAll(),
  });

  const patientProcedures = useMemo(() =>
    procedures.filter(p => p.patient_id === form.patient_id),
    [procedures, form.patient_id]
  );

  const patientMap = useMemo(() => {
    const m = new Map(patients.map(p => [p.id, p.full_name]));
    return m;
  }, [patients]);

  const procedureMap = useMemo(() => {
    const m = new Map(procedures.map(p => [p.id, p.procedure_name]));
    return m;
  }, [procedures]);

  const filtered = useMemo(() => {
    if (!searchQuery) return followUps;
    const q = searchQuery.toLowerCase();
    return followUps.filter(f => {
      const name = patientMap.get(f.patient_id) || '';
      return name.toLowerCase().includes(q) ||
        (f.healing_status || '').toLowerCase().includes(q) ||
        (f.notes || '').toLowerCase().includes(q);
    });
  }, [followUps, searchQuery, patientMap]);

  const failureCount = useMemo(() => followUps.filter(f => f.healing_status === 'Failure').length, [followUps]);
  const criticalCount = useMemo(() => followUps.filter(f => f.healing_status === 'Critical').length, [followUps]);
  const avgHealth = followUps.length ? Math.round(followUps.reduce((s, f) => s + (f.health_score ?? 100), 0) / followUps.length) : 0;

  const statusLabels: Record<string, string> = {
    OnTrack: t('follow_ups.status_on_track'),
    Healing: t('follow_ups.status_healing'),
    Critical: t('follow_ups.status_critical'),
    Failure: t('follow_ups.status_failure'),
    Completed: t('follow_ups.status_completed'),
  };

  function HealingBadge({ status }: { status: HealingStatus }) {
    const c = healingColors[status] || healingColors.OnTrack;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: c.bg, color: c.text }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text, boxShadow: `0 0 6px ${c.glow}` }} />
        {statusLabels[status] || status}
      </span>
    );
  }

  const createMut = useMutation({
    mutationFn: () => followUpService.create(form),
    onSuccess: () => {
      toast.success(t('follow_ups.toast_created'));
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: () => followUpService.update(editingId!, form),
    onSuccess: () => {
      toast.success(t('follow_ups.toast_updated'));
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, change_reason, reason_category }: { id: string; change_reason?: string; reason_category?: string }) =>
      followUpService.delete(id, change_reason, reason_category),
    onSuccess: () => {
      toast.success(t('follow_ups.toast_deleted'));
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">{t('follow_ups.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>
            {isLoading ? '...' : t('follow_ups.subtitle', { count: followUps.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('follow_ups.search_placeholder')} className="input-cyber pl-10" />
          </div>
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4" /> {t('follow_ups.add')}
          </button>
        </div>
      </div>

      {/* Failure Alert */}
      {failureCount > 0 && (
        <div className="p-5 glass-strong animate-fadeIn flex items-start gap-4"
          style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'var(--color-error-container)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(244,63,94,0.15)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-error)' }}>{t('follow_ups.failure_detected')}</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--app-text-dim)' }}>
              {t('follow_ups.failure_desc', { count: failureCount })}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-cyber flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary-container)' }}>
            <Activity className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-on-surface)]">{followUps.length}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.stat_total')}</div>
          </div>
        </div>
        <div className="card-cyber flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-success-container)' }}>
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-on-surface)]">{avgHealth}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.stat_avg_health')}</div>
          </div>
        </div>
        <div className="card-cyber flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-warning-container)' }}>
            <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{criticalCount}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.stat_critical')}</div>
          </div>
        </div>
        <div className="card-cyber flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-error-container)' }}>
            <Heart className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-error)' }}>{failureCount}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.stat_failures')}</div>
          </div>
        </div>
      </div>

      {/* Follow-ups List */}
      <div className="card-cyber p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <div className="flex-[2]">{t('follow_ups.table_patient')}</div>
              <div className="flex-[1.5]">{t('follow_ups.table_procedure')}</div>
              <div className="flex-[1.5]">{t('follow_ups.table_health')}</div>
              <div className="flex-[1]">{t('follow_ups.table_pain')}</div>
              <div className="flex-[1.5]">{t('follow_ups.table_healing')}</div>
              <div className="flex-[1.5]">{t('follow_ups.table_notes')}</div>
              <div className="flex-[1.5]">{t('follow_ups.table_date')}</div>
              <div className="w-20">{t('follow_ups.table_actions')}</div>
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isError ? (
                <div className="py-16 text-center text-sm" style={{ color: 'var(--color-error)' }}>
                  {t('follow_ups.empty_failed')}{' '}
                  <button onClick={() => refetch()} className="underline" style={{ color: 'var(--color-primary)' }}>{t('common.retry')}</button>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={searchQuery ? t('follow_ups.empty_search') : t('follow_ups.empty_all')}
                  description=""
                />
              ) : filtered.map(f => (
                <div key={f.id} className="flex items-center px-6 py-4 transition-all duration-150 hover:bg-[var(--app-table-hover)]"
                  style={{
                    background: f.healing_status === 'Failure' ? 'rgba(244,63,94,0.04)' :
                      f.healing_status === 'Critical' ? 'rgba(251,191,36,0.03)' : 'transparent',
                    borderLeft: f.healing_status === 'Failure' ? '3px solid var(--color-error)' :
                      f.healing_status === 'Critical' ? '3px solid var(--color-warning)' : '3px solid transparent',
                  }}>
                  <div className="flex-[2] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--color-primary-container)', border: '1px solid rgba(79,209,255,0.12)', color: 'var(--color-primary)' }}>
                      {(patientMap.get(f.patient_id) || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[var(--color-on-surface)]">{patientMap.get(f.patient_id) || 'Unknown'}</span>
                  </div>
                  <div className="flex-[1.5] text-xs" style={{ color: 'var(--app-text-dim)' }}>
                    {f.procedure_id ? (procedureMap.get(f.procedure_id) || '\u2014') : '\u2014'}
                  </div>
                  <div className="flex-[1.5]"><HealthScoreCircle score={f.health_score ?? 100} /></div>
                  <div className="flex-[1]"><PainMeter level={f.pain_level ?? 0} /></div>
                  <div className="flex-[1.5]"><HealingBadge status={f.healing_status || 'OnTrack'} /></div>
                  <div className="flex-[1.5] text-xs" style={{ color: 'var(--app-text-dim)' }}>
                    {(f.notes || '').slice(0, 40)}{(f.notes || '').length > 40 ? '...' : ''}
                  </div>
                  <div className="flex-[1.5] text-xs" style={{ color: 'var(--app-text-dim)' }}>
                    {f.created_at ? new Date(f.created_at).toLocaleDateString() : '\u2014'}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(f)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[rgba(255,255,255,0.05)]"
                      style={{ color: 'var(--app-text-dim)' }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirmId(f.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[rgba(244,63,94,0.1)]"
                      style={{ color: 'var(--app-text-dim)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Modal (Create / Edit) */}
      {showModal && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => { setShowModal(false); resetForm(); }}>
          <div className="w-full max-w-lg rounded-[24px] flex flex-col max-h-[90vh]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--app-border)' }}>
              <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{editingId ? t('follow_ups.modal_edit') : t('follow_ups.modal_new')}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('follow_ups.modal_patient')} *</label>
                <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} disabled={!!editingId}
                  className="input-cyber cursor-pointer">
                  <option value="">{t('follow_ups.placeholder_patient')}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('follow_ups.modal_procedure')} *</label>
                <select value={form.procedure_id} onChange={e => setForm(f => ({ ...f, procedure_id: e.target.value }))} disabled={!form.patient_id || !!editingId}
                  className="input-cyber cursor-pointer">
                  <option value="">{form.patient_id ? t('follow_ups.placeholder_procedure') : t('follow_ups.placeholder_procedure_first')}</option>
                  {patientProcedures.map(p => <option key={p.id} value={p.id}>{p.procedure_name} ({p.status})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('follow_ups.modal_health', { value: form.health_score })}</label>
                <input type="range" min="0" max="100" value={form.health_score} onChange={e => setForm(f => ({ ...f, health_score: Number(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.08)', accentColor: 'var(--color-primary)' }} />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--app-text-dim)' }}>
                  <span>0</span><span>50</span><span>100</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('follow_ups.modal_pain', { value: form.pain_level })}</label>
                <input type="range" min="0" max="10" value={form.pain_level} onChange={e => setForm(f => ({ ...f, pain_level: Number(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.08)', accentColor: 'var(--color-primary)' }} />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--app-text-dim)' }}>
                  <span>0</span><span>5</span><span>10</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('follow_ups.modal_healing_status')}</label>
                <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(79,209,255,0.25) rgba(255,255,255,0.04)' }}>
                  <div className="flex items-start gap-0">
                    {['OnTrack', 'Healing', 'Completed'].map((s, idx) => {
                      const status = s as HealingStatus;
                      const selectedIdx = ['OnTrack', 'Healing', 'Completed'].indexOf(form.healing_status);
                      const isActive = idx === selectedIdx;
                      const isPast = idx < selectedIdx;
                      const lineColor = isPast ? 'var(--color-success)' : 'rgba(255,255,255,0.06)';
                      return (
                        <div key={s} className="flex items-start flex-shrink-0">
                          <div className="flex flex-col items-center gap-1.5" style={{ width: 76 }}>
                            <button type="button" onClick={() => setForm(f => ({ ...f, healing_status: status }))}
                              className="relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90"
                              style={{
                                background: isPast ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                                border: isActive ? '2px solid rgba(79,209,255,0.5)' : '2px solid transparent',
                                boxShadow: isActive ? '0 0 16px rgba(79,209,255,0.45)' : 'none',
                              }}>
                              {isPast ? (
                                <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-on-primary)' }} />
                              ) : isActive ? (
                                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-on-primary)' }} />
                              ) : (
                                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                              )}
                            </button>
                            <span className="text-[9px] font-semibold text-center leading-tight transition-all"
                              style={{ color: isPast ? 'rgba(52,211,153,0.7)' : isActive ? 'var(--color-primary)' : 'var(--app-text-dim)' }}>
                              {s === 'OnTrack' ? t('follow_ups.stepper_on_track') : s === 'Healing' ? t('follow_ups.stepper_healing') : t('follow_ups.stepper_completed')}
                            </span>
                          </div>
                          {idx < 2 && <div className="flex-shrink-0 self-center" style={{ width: 20, height: 2, background: lineColor, marginBottom: 22 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.modal_special_cases')}</label>
                <div className="flex gap-2">
                  {(['Critical', 'Failure'] as HealingStatus[]).map(s => {
                    const isSelected = form.healing_status === s;
                    return (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, healing_status: s }))}
                        className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all duration-300 active:scale-[0.97]"
                        style={{
                          background: isSelected ? healingColors[s].bg : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? healingColors[s].text : 'var(--app-border)'}`,
                          color: isSelected ? healingColors[s].text : 'var(--app-text-muted)',
                          boxShadow: isSelected ? `0 0 16px ${healingColors[s].glow}` : 'none',
                        }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: isSelected ? healingColors[s].text : 'rgba(255,255,255,0.15)' }} />
                        {s === 'Critical' ? t('follow_ups.special_critical') : t('follow_ups.special_failure')}
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.healing_status === 'Failure' && (
                <div className="rounded-xl p-4 animate-fadeIn flex items-start gap-3" style={{ background: 'var(--color-error-container)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-error)' }}>{t('follow_ups.failure_warning')}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.failure_warning_desc')}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('follow_ups.modal_notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="input-cyber h-20 pt-2 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="btn-ghost">{t('follow_ups.modal_cancel')}</button>
              <button onClick={() => editingId ? updateMut.mutate() : createMut.mutate()}
                disabled={!form.patient_id || !form.procedure_id || createMut.isPending || updateMut.isPending}
                className="btn-primary">
                {editingId ? (updateMut.isPending ? t('follow_ups.modal_saving') : t('follow_ups.modal_save')) : (createMut.isPending ? t('follow_ups.modal_creating') : t('follow_ups.modal_create'))}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-sm rounded-[24px] p-6" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-error-container)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-on-surface)]">{t('follow_ups.delete_title')}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-dim)' }}>{t('follow_ups.delete_desc')}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-ghost">{t('follow_ups.delete_cancel')}</button>
              <button onClick={() => deleteMut.mutate({ id: deleteConfirmId })} disabled={deleteMut.isPending}
                className="btn-danger btn-sm">
                {deleteMut.isPending ? t('follow_ups.delete_deleting') : t('follow_ups.delete_confirm')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}
    </div>
  );
}
