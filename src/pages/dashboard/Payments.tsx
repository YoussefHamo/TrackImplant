import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { financialRecordService } from '../../services/financialRecordService';
import { patientService } from '../../services/patientService';
import { procedureService } from '../../services/procedureService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  DollarSign, TrendingUp, FileText, PieChart,
  Plus, Search, ChevronLeft, ChevronRight,
  X, Clock, CreditCard, User, Pencil, Trash2, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import type { FinancialRecord, PaymentMethod, ChangeReason } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import ReasonDialog from '../../components/ReasonDialog';
import FixedOverlay from '../../components/ui/FixedOverlay';
import EmptyState from '../../components/ui/EmptyState';

const statusColors: Record<string, string> = {
  Paid: 'var(--color-success)',
  Partial: 'var(--color-primary)',
  Pending: 'var(--color-warning)',
  Overdue: 'var(--color-error)',
  Cancelled: '#9E9E9E',
  Refunded: '#7C5CFF',
};

function Badge({ status }: { status: string }) {
  const color = statusColors[status] || 'var(--color-warning)';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${color}1A`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

export default function Payments() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [page, setPage] = useState(1);
  const perPage = 10;
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<FinancialRecord | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<FinancialRecord | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<FinancialRecord[]>([]);

  const [addForm, setAddForm] = useState({ patient_id: '', patient_name: '', invoice_name: '', total_amount: '', notes: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingInvoice, setEditingInvoice] = useState<FinancialRecord | null>(null);
  const [editForm, setEditForm] = useState({ invoice_name: '', total_amount: '', notes: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'invoice' | 'payment'>('invoice');

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState('');

  const [reasonDialog, setReasonDialog] = useState<{
    open: boolean;
    title: string;
    onConfirm: (r: ChangeReason) => void;
  }>({ open: false, title: '', onConfirm: () => {} });

  const { data: analytics } = useQuery({
    queryKey: ['financial-analytics'],
    queryFn: () => financialRecordService.getAnalytics(),
  });

  const { data: monthlyData = [] } = useQuery({
    queryKey: ['financial-monthly'],
    queryFn: () => financialRecordService.getMonthlyBreakdown(),
  });

  const { data: insuranceRevenue = 0 } = useQuery({
    queryKey: ['insurance-revenue'],
    queryFn: () => financialRecordService.getInsuranceRevenue(),
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });

  const { data: patientInvoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['patient-invoices', selectedPatientId],
    queryFn: () => financialRecordService.getByPatient(selectedPatientId),
    enabled: !!selectedPatientId,
  });

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ['financial-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['financial-monthly'] });
    queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
  };

  const createInvoiceMut = useMutation({
    mutationFn: (data: { patient_id: string; patient_name: string; invoice_name: string; total_amount: number; notes?: string; change_reason?: string; reason_category?: string }) =>
      financialRecordService.createInvoice(data),
    onSuccess: () => {
      toast.success(t('payments.toast_invoice_created'));
      inval();
      setShowAddInvoiceModal(false);
      setAddForm({ patient_id: '', patient_name: '', invoice_name: '', total_amount: '', notes: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateInvoiceMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { invoice_name?: string; total_amount?: number; notes?: string; change_reason?: string; reason_category?: string } }) =>
      financialRecordService.updateInvoice(id, data),
    onSuccess: () => {
      toast.success(t('payments.toast_invoice_updated'));
      inval();
      setEditingInvoice(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRecordMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: { change_reason?: string; reason_category?: string } }) =>
      financialRecordService.deleteRecord(id, reason),
    onSuccess: () => {
      toast.success(t('payments.toast_record_deleted'));
      inval();
      setDeleteConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPaymentMut = useMutation({
    mutationFn: (data: { invoice_id: string; patient_id: string; patient_name: string; amount: number; payment_method?: PaymentMethod; notes?: string; change_reason?: string; reason_category?: string }) =>
      financialRecordService.addPayment(data),
    onSuccess: () => {
      toast.success(t('payments.toast_payment_recorded'));
      inval();
      setShowPayModal(false);
      setPayingInvoice(null);
      setPayAmount('');
      setPayNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(p => p.full_name.toLowerCase().includes(q));
  }, [patients, patientSearch]);

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const invoices = useMemo(
    () => (patientInvoices || []).filter(r => r.record_type === 'invoice'),
    [patientInvoices]
  );

  const totalPages = Math.max(1, Math.ceil(invoices.length / perPage));
  const paged = invoices.slice((page - 1) * perPage, page * perPage);

  const procedureIds = useMemo(
    () => [...new Set(paged.filter(inv => inv.procedure_id).map(inv => inv.procedure_id!))],
    [paged]
  );

  const { data: procedures = [] } = useQuery({
    queryKey: ['invoice-procedures', ...procedureIds],
    queryFn: () => Promise.all(procedureIds.map(id => procedureService.getById(id))),
    enabled: procedureIds.length > 0,
  });

  const procedureMap = useMemo(
    () => new Map(procedures.filter(Boolean).map(p => [p!.id, p!])),
    [procedures]
  );

  const a = analytics || { totalRevenue: 0, totalPending: 0, monthlyCollected: 0, monthlyGrowth: 0, invoiceCount: 0, paidCount: 0, partialCount: 0, pendingCount: 0 };

  const viewPayments = async (inv: FinancialRecord) => {
    setViewingInvoice(inv);
    try {
      const payments = await financialRecordService.getPaymentsByInvoice(inv.id);
      setInvoicePayments(payments);
    } catch {
      setInvoicePayments([]);
    }
  };

  const validateAdd = (): boolean => {
    const errs: Record<string, string> = {};
    if (!addForm.invoice_name.trim()) errs.invoice_name = t('payments.error_name_required');
    if (!addForm.total_amount || Number(addForm.total_amount) <= 0) errs.total_amount = t('payments.error_amount_positive');
    if (!addForm.patient_id) errs.patient = t('payments.error_patient_required');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateInvoice = () => {
    if (!validateAdd()) return;
    createInvoiceMut.mutate({
      patient_id: addForm.patient_id,
      patient_name: addForm.patient_name,
      invoice_name: addForm.invoice_name.trim(),
      total_amount: Number(addForm.total_amount),
      notes: addForm.notes || undefined,
    });
  };

  const handlePay = () => {
    if (!payingInvoice) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { toast.error(t('payments.error_amount_positive')); return; }
    addPaymentMut.mutate({
      invoice_id: payingInvoice.id,
      patient_id: payingInvoice.patient_id,
      patient_name: payingInvoice.patient_name,
      amount: amt,
      payment_method: payMethod,
      notes: payNotes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-on-surface)]">{t('payments.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>
            {t('payments.subtitle', { count: a.invoiceCount, amount: a.totalRevenue.toLocaleString() })}
          </p>
        </div>
        <button onClick={() => setShowAddInvoiceModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> {t('payments.new_invoice')}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: t('payments.kpi_total_revenue'), value: `$${a.totalRevenue.toLocaleString()}`, color: 'var(--color-success)', bg: 'var(--color-success-container)' },
          { icon: Clock, label: t('payments.kpi_pending_revenue'), value: `$${a.totalPending.toLocaleString()}`, color: 'var(--color-warning)', bg: 'var(--color-warning-container)' },
          { icon: TrendingUp, label: t('payments.kpi_monthly_collected'), value: `$${a.monthlyCollected.toLocaleString()}`, color: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
          { icon: TrendingUp, label: t('payments.kpi_monthly_growth'), value: `${a.monthlyGrowth >= 0 ? '+' : ''}${a.monthlyGrowth}%`, color: a.monthlyGrowth >= 0 ? 'var(--color-success)' : 'var(--color-error)', bg: a.monthlyGrowth >= 0 ? 'var(--color-success-container)' : 'var(--color-error-container)' },
          { icon: FileText, label: t('payments.kpi_total_invoices'), value: a.invoiceCount.toLocaleString(), color: 'var(--color-secondary)', bg: 'var(--color-secondary-container)' },
          { icon: PieChart, label: t('payments.kpi_status_format', { paid: a.paidCount, partial: a.partialCount, pending: a.pendingCount }), value: `${a.paidCount} / ${a.partialCount} / ${a.pendingCount}`, color: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
          { icon: Heart, label: t('payments.kpi_insurance_revenue'), value: `$${insuranceRevenue.toLocaleString()}`, color: '#ff6b9d', bg: 'rgba(255,107,157,0.1)' },
        ].map((card, i) => (
          <div key={i} className="card-cyber hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg, border: `1px solid ${card.color}22` }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--color-on-surface)] font-mono">{card.value}</div>
            <div className="text-[10px] mt-0.5 font-medium uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly Chart */}
      <div className="card-cyber">
        <h3 className="text-base font-semibold text-[var(--color-on-surface)] mb-4">{t('payments.chart_title')}</h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
              <XAxis dataKey="name" stroke="var(--app-text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--app-text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)', borderRadius: '12px', color: 'var(--color-on-surface)', fontSize: '12px' }} />
              <Bar dataKey="collected" name={t('payments.chart_collected')} fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="pending" name={t('payments.chart_pending')} fill="var(--color-warning)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Patient Selector */}
      <div className="card-cyber">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
            <span className="text-sm font-semibold text-[var(--color-on-surface)]">{t('payments.patient_label')}</span>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
            <input value={patientSearch} onChange={e => { setPatientSearch(e.target.value); setSelectedPatientId(''); setPage(1); }}
              placeholder={t('payments.patient_search')} className="input-cyber pl-9" />
          </div>
          <select value={selectedPatientId} onChange={e => { setSelectedPatientId(e.target.value); setPage(1); }}
            className="input-cyber cursor-pointer appearance-none min-w-[180px]">
            <option value="">{t('payments.patient_select')}</option>
            {filteredPatients.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          {selectedPatient && (
            <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-success-container)', border: '1px solid rgba(52,211,153,0.12)', color: 'var(--color-success)' }}>
              {t('payments.patient_invoices', { count: invoices.length })}
            </span>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card-cyber p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <div className="flex-[2]">{t('payments.table_invoice')}</div>
              <div className="flex-[1]">{t('payments.table_total')}</div>
              <div className="flex-[1]">{t('payments.table_paid')}</div>
              <div className="flex-[1]">{t('payments.table_remaining')}</div>
              <div className="flex-[0.8]">{t('payments.table_branch')}</div>
              <div className="flex-[1]">Doctor</div>
              <div className="flex-[0.9]">Procedure</div>
              <div className="flex-[1]">{t('payments.table_status')}</div>
              <div className="flex-[1]">{t('payments.table_date')}</div>
              <div className="w-28 text-right">{t('payments.table_actions')}</div>
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
              {!selectedPatientId ? (
                <EmptyState title={t('payments.empty_select')} description="" />
              ) : invoicesLoading ? (
                <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /></div>
              ) : paged.length === 0 ? (
                <EmptyState title={t('payments.empty_invoices')} description="" />
              ) : paged.map(inv => (
                <div key={inv.id} className="flex items-center px-6 py-3.5 transition-all hover:bg-[var(--app-table-hover)]">
                  <div className="flex-[2] text-sm font-medium text-[var(--color-on-surface)]">{inv.invoice_name}</div>
                  <div className="flex-[1] text-sm font-semibold text-[var(--color-on-surface)] font-mono">${Number(inv.total_amount).toLocaleString()}</div>
                  <div className="flex-[1] text-sm font-mono" style={{ color: 'var(--color-success)' }}>${Number(inv.paid_so_far).toLocaleString()}</div>
                  <div className="flex-[1] text-sm font-mono" style={{ color: Number(inv.remaining_amount) > 0 ? 'var(--color-warning)' : 'var(--app-text-muted)' }}>
                    ${Number(inv.remaining_amount).toLocaleString()}
                  </div>
                  <div className="flex-[0.8] text-[10px] truncate" style={{ color: 'var(--app-text-dim)' }}>
                    {inv.branch_name || '\u2014'}
                  </div>
                  <div className="flex-[1] text-xs truncate" style={{ color: 'var(--app-text-dim)' }}>
                    {inv.procedure_id && procedureMap.get(inv.procedure_id)?.doctor_name
                      ? procedureMap.get(inv.procedure_id)!.doctor_name
                      : '\u2014'}
                  </div>
                  <div className="flex-[0.9]">
                    {inv.procedure_id ? (
                      <button onClick={() => navigate(`/dashboard/cases?id=${inv.procedure_id}`)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
                        style={{ color: 'var(--color-primary)', background: 'var(--color-primary-container)' }}>
                        View Procedure
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>\u2014</span>
                    )}
                  </div>
                  <div className="flex-[1]"><Badge status={inv.status} /></div>
                  <div className="flex-[1] text-xs" style={{ color: 'var(--app-text-dim)' }}>
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '\u2014'}
                  </div>
                  <div className="w-28 flex items-center justify-end gap-1">
                    <button onClick={() => viewPayments(inv)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(79,209,255,0.1)]" style={{ color: 'var(--app-text-dim)' }}
                      title={t('payments.tooltip_view_payments')}>
                      <DollarSign className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingInvoice(inv); setEditForm({ invoice_name: inv.invoice_name || '', total_amount: inv.total_amount.toString(), notes: inv.notes || '' }); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(79,209,255,0.1)] hover:text-[var(--color-primary)]" style={{ color: 'var(--app-text-dim)' }}
                      title={t('payments.tooltip_edit_invoice')}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeleteConfirmId(inv.id); setDeleteType('invoice'); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(244,63,94,0.1)] hover:text-[var(--color-error)]" style={{ color: 'var(--app-text-dim)' }}
                      title={t('payments.tooltip_delete_invoice')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {inv.status !== 'Paid' && (
                      <button onClick={() => { setPayingInvoice(inv); setShowPayModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(52,211,153,0.1)] hover:text-[var(--color-success)]" style={{ color: 'var(--app-text-dim)' }}
                        title={t('payments.tooltip_add_payment')}>
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {selectedPatientId && invoices.length > perPage && (
              <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>
                  {t('common.showing_entries', { start: (page - 1) * perPage + 1, end: Math.min(page * perPage, invoices.length), total: invoices.length })}
                </span>
                <div className="flex items-center gap-1.5">
                  <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-dim)' }}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                    const n = idx + 1;
                    return <button key={n} onClick={() => setPage(n)}
                      className="w-8 h-8 rounded-lg text-xs font-semibold"
                      style={{ background: page === n ? 'var(--color-primary-container)' : 'transparent', border: `1px solid ${page === n ? 'rgba(79,209,255,0.2)' : 'var(--app-border)'}`, color: page === n ? 'var(--color-primary)' : 'var(--app-text-dim)' }}>{n}</button>;
                  })}
                  <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-dim)' }}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== VIEW PAYMENTS DRAWER ===== */}
      {viewingInvoice && (
        <FixedOverlay className="flex items-start justify-center p-4 pt-20" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setViewingInvoice(null)}>
          <div className="w-full max-w-lg rounded-[24px] max-h-[70vh] overflow-y-auto" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{viewingInvoice.invoice_name}</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--app-text-dim)' }}>
                  {viewingInvoice.patient_name} \u00b7 <span className="font-mono">${Number(viewingInvoice.total_amount).toLocaleString()}</span> total \u00b7 <Badge status={viewingInvoice.status} />
                </p>
              </div>
              <button onClick={() => setViewingInvoice(null)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-4">{t('payments.drawer_payment_history')}</h3>
              {invoicePayments.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>
                  {t('payments.drawer_no_payments')}
                </div>
              ) : (
                <div className="space-y-2">
                  {invoicePayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-medium text-[var(--color-on-surface)] font-mono">${Number(p.amount).toLocaleString()}</div>
                          <div className="text-[11px]" style={{ color: 'var(--app-text-dim)' }}>
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                          </div>
                        </div>
                        {p.notes && <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{p.notes}</div>}
                      </div>
                      <button onClick={() => { setDeleteConfirmId(p.id); setDeleteType('payment'); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 hover:bg-[rgba(244,63,94,0.1)] hover:text-[var(--color-error)]" style={{ color: 'var(--app-text-dim)' }}
                        title={t('payments.tooltip_delete_invoice')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex-1">
                <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{t('payments.drawer_paid')}: <strong style={{ color: 'var(--color-success)' }} className="font-mono">${Number(viewingInvoice.paid_so_far).toLocaleString()}</strong></span>
              </div>
              <div className="flex-1 text-right">
                <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{t('payments.drawer_remaining')}: <strong style={{ color: 'var(--color-warning)' }} className="font-mono">${Number(viewingInvoice.remaining_amount).toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== ADD INVOICE MODAL ===== */}
      {showAddInvoiceModal && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => { setShowAddInvoiceModal(false); setAddForm({ patient_id: '', patient_name: '', invoice_name: '', total_amount: '', notes: '' }); }}>
          <div className="w-full max-w-lg rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{t('payments.modal_new_invoice')}</h2>
              <button onClick={() => { setShowAddInvoiceModal(false); setAddForm({ patient_id: '', patient_name: '', invoice_name: '', total_amount: '', notes: '' }); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_patient')} *</label>
                <select value={addForm.patient_id} onChange={e => {
                  const p = patients.find(pt => pt.id === e.target.value);
                  setAddForm(f => ({ ...f, patient_id: e.target.value, patient_name: p ? p.full_name : '' }));
                }} className="input-cyber cursor-pointer appearance-none">
                  <option value="">{t('payments.placeholder_patient')}</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                {formErrors.patient && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{formErrors.patient}</p>}
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_invoice_name')} *</label>
                <input value={addForm.invoice_name} onChange={e => setAddForm(f => ({ ...f, invoice_name: e.target.value }))}
                  placeholder={t('payments.placeholder_invoice_name')} className="input-cyber" />
                {formErrors.invoice_name && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{formErrors.invoice_name}</p>}
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_total_amount')} *</label>
                <input type="number" min="0" step="0.01" value={addForm.total_amount} onChange={e => setAddForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0.00" className="input-cyber" />
                {formErrors.total_amount && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{formErrors.total_amount}</p>}
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_notes')}</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="input-cyber h-20 pt-2 resize-none" placeholder={t('payments.placeholder_notes')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => { setShowAddInvoiceModal(false); setAddForm({ patient_id: '', patient_name: '', invoice_name: '', total_amount: '', notes: '' }); }}
                className="btn-ghost">{t('payments.modal_cancel')}</button>
              <button onClick={handleCreateInvoice} disabled={createInvoiceMut.isPending} className="btn-primary">
                {createInvoiceMut.isPending ? t('payments.modal_creating') : t('payments.modal_create')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== ADD PAYMENT MODAL ===== */}
      {showPayModal && payingInvoice && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => { setShowPayModal(false); setPayingInvoice(null); }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{t('payments.modal_record_title')}</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--app-text-dim)' }}>
                  {payingInvoice.invoice_name} \u00b7 {payingInvoice.patient_name}
                </p>
              </div>
              <button onClick={() => { setShowPayModal(false); setPayingInvoice(null); }} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>Total: <span className="font-mono">${Number(payingInvoice.total_amount).toLocaleString()}</span></span>
                <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>Paid: <span style={{ color: 'var(--color-success)' }} className="font-mono">${Number(payingInvoice.paid_so_far).toLocaleString()}</span></span>
                <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>Remaining: <span style={{ color: 'var(--color-warning)' }} className="font-mono">${Number(payingInvoice.remaining_amount).toLocaleString()}</span></span>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_amount')} *</label>
                <input type="number" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_method')}</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)} className="input-cyber cursor-pointer appearance-none">
                  {[{ v: 'cash', l: t('payments.method_cash') }, { v: 'card', l: t('payments.method_card') }, { v: 'insurance', l: t('payments.method_insurance') }, { v: 'bank_transfer', l: t('payments.method_bank_transfer') }]
                    .map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_notes_label')}</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder={t('payments.placeholder_notes')} className="input-cyber" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => { setShowPayModal(false); setPayingInvoice(null); }} className="btn-ghost">{t('payments.modal_cancel_pay')}</button>
              <button onClick={handlePay} disabled={addPaymentMut.isPending} className="btn-primary">
                {addPaymentMut.isPending ? t('payments.modal_recording') : t('payments.modal_record')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== EDIT INVOICE MODAL ===== */}
      {editingInvoice && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setEditingInvoice(null)}>
          <div className="w-full max-w-lg rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--app-border)' }}>
              <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{t('payments.modal_edit_title')}</h2>
              <button onClick={() => setEditingInvoice(null)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--app-text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_invoice_name')} *</label>
                <input value={editForm.invoice_name} onChange={e => setEditForm(f => ({ ...f, invoice_name: e.target.value }))}
                  placeholder={t('payments.placeholder_invoice_name')} className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_total_amount')} *</label>
                <input type="number" min="0" step="0.01" value={editForm.total_amount} onChange={e => setEditForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0.00" className="input-cyber" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{t('payments.modal_notes')}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="input-cyber h-20 pt-2 resize-none" placeholder={t('payments.placeholder_notes')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => setEditingInvoice(null)} className="btn-ghost">{t('payments.modal_edit_cancel')}</button>
              <button onClick={() => {
                const amt = Number(editForm.total_amount);
                if (!editForm.invoice_name.trim()) { toast.error(t('payments.error_name_required')); return; }
                if (!amt || amt <= 0) { toast.error(t('payments.error_amount_positive')); return; }
                updateInvoiceMut.mutate({ id: editingInvoice.id, data: { invoice_name: editForm.invoice_name.trim(), total_amount: amt, notes: editForm.notes || undefined } });
              }} disabled={updateInvoiceMut.isPending} className="btn-primary">
                {updateInvoiceMut.isPending ? t('payments.modal_edit_saving') : t('payments.modal_edit_save')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteConfirmId && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }} onClose={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-sm rounded-[24px]" style={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)' }}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--color-error-container)' }}>
                <Trash2 className="w-6 h-6" style={{ color: 'var(--color-error)' }} />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-on-surface)] text-center mb-2">
                {t(deleteType === 'invoice' ? 'payments.modal_delete_invoice_title' : 'payments.modal_delete_payment_title')}
              </h3>
              <p className="text-sm text-center" style={{ color: 'var(--app-text-dim)' }}>
                {t(deleteType === 'invoice' ? 'payments.modal_delete_invoice_desc' : 'payments.modal_delete_payment_desc')}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button onClick={() => setDeleteConfirmId(null)} className="btn-ghost">
                {t('payments.modal_delete_cancel')}
              </button>
              <button onClick={() => {
                setReasonDialog({
                  open: true,
                  title: t(deleteType === 'invoice' ? 'payments.modal_delete_invoice_title' : 'payments.modal_delete_payment_title'),
                  onConfirm: (r) => {
                    deleteRecordMut.mutate({ id: deleteConfirmId, reason: { change_reason: r.reason, reason_category: r.category } });
                  },
                });
              }} disabled={deleteRecordMut.isPending} className="btn-danger">
                {deleteRecordMut.isPending ? t('payments.modal_delete_deleting') : t('payments.modal_delete_confirm')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

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
