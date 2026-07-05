import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import { implantInventoryService } from '../../services/implantInventoryService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getItemDisplayName } from '../../utils/inventory';
import { RotateCcw, Building2, Package, User, Plus, X, Check, Ban } from 'lucide-react';
import { toast } from 'sonner';
import FixedOverlay from '../../components/ui/FixedOverlay';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider block mb-1.5';

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(255,193,7,0.15)', text: '#FFC107' },
  approved: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

export default function ReturnsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin' || user?.role === 'Doctor';
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    from_location: 'branch' as 'warehouse' | 'branch' | 'patient',
    from_branch_id: '',
    item_id: '',
    item_name: '',
    quantity: 0,
    reason: '',
    notes: '',
  });

  const { data: returns = [] } = useQuery({
    queryKey: ['inventory-returns'],
    queryFn: () => deliveryService.getReturns(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getAll(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => implantInventoryService.getInventoryItems(),
  });

  const createMut = useMutation({
    mutationFn: () => deliveryService.createReturn(form),
    onSuccess: () => {
      toast.success(t('returns.toast_created'));
      setShowForm(false);
      setForm({ from_location: 'branch', from_branch_id: '', item_id: '', item_name: '', quantity: 0, reason: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['inventory-returns'] });
      queryClient.invalidateQueries({ queryKey: ['branch-inventory-all'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, change_reason, reason_category }: { id: string; change_reason?: string; reason_category?: string }) =>
      deliveryService.updateReturnStatus(id, 'approved', change_reason, reason_category),
    onSuccess: () => {
      toast.success('Return approved — stock adjusted');
      queryClient.invalidateQueries({ queryKey: ['inventory-returns'] });
      queryClient.invalidateQueries({ queryKey: ['branch-inventory-all'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, change_reason, reason_category }: { id: string; change_reason?: string; reason_category?: string }) =>
      deliveryService.updateReturnStatus(id, 'rejected', change_reason, reason_category),
    onSuccess: () => {
      toast.success('Return rejected');
      queryClient.invalidateQueries({ queryKey: ['inventory-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const locationIcons: Record<string, typeof Building2> = {
    warehouse: Package,
    branch: Building2,
    patient: User,
  };

  return (
    <div className="font-sans select-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('returns.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('returns.subtitle', { count: returns.length })}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
          <Plus className="w-4 h-4" /> {t('returns.new_return')}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-[22px] overflow-hidden"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[1.5]">{t('returns.col_item')}</div>
          <div className="flex-[1]">{t('returns.col_qty')}</div>
          <div className="flex-[1.5]">{t('returns.col_from')}</div>
          <div className="flex-[1.5]">{t('returns.col_reason')}</div>
          <div className="flex-[1]">Status</div>
          <div className="flex-[1]">{t('returns.col_notes')}</div>
          <div className="flex-[1.5]">{t('returns.col_date')}</div>
          {(isAdmin) && <div className="w-20 text-right">Actions</div>}
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {returns.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.empty')}</div>
          ) : returns.map(r => {
            const LocIcon = locationIcons[r.from_location] || Package;
            const sc = statusColors[r.status] || statusColors.pending;
            return (
              <div key={r.id} className="flex items-center px-6 py-4">
                <div className="flex-[1.5] text-sm font-medium text-white">{r.item_name}</div>
                <div className="flex-[1] text-sm font-bold text-white">{r.quantity}</div>
                <div className="flex-[1.5] text-sm flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <LocIcon className="w-3.5 h-3.5" />
                  {r.from_location === 'branch' ? (r.branch_name || '—') : r.from_location}
                </div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.reason || '—'}</div>
                <div className="flex-[1]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: sc.bg, color: sc.text }}>{r.status}</span>
                </div>
                <div className="flex-[1] text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.notes || '—'}</div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                </div>
                {isAdmin && (
                  <div className="w-20 flex items-center justify-end gap-1">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => approveMut.mutate({ id: r.id })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#00E5A8] hover:bg-[rgba(0,229,168,0.1)]"
                          title="Approve"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => rejectMut.mutate({ id: r.id })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
                          title="Reject"><Ban className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create form modal */}
      {showForm && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white"><RotateCcw className="w-4 h-4 inline mr-2 text-[#4FD1FF]" />{t('returns.form_title')}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.form_from')}</label>
                <div className="flex gap-2">
                  {(['warehouse', 'branch', 'patient'] as const).map(loc => (
                    <button key={loc} onClick={() => setForm(f => ({ ...f, from_location: loc, from_branch_id: '' }))}
                      className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${form.from_location === loc ? 'bg-[rgba(79,209,255,0.12)] text-[#4FD1FF]' : 'bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.4)]'}`}>
                      {loc === 'warehouse' ? <Package className="w-3.5 h-3.5 inline mr-1" /> : loc === 'branch' ? <Building2 className="w-3.5 h-3.5 inline mr-1" /> : <User className="w-3.5 h-3.5 inline mr-1" />}
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {form.from_location === 'branch' && (
                <div>
                  <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.form_branch')}</label>
                  <select value={form.from_branch_id} onChange={e => setForm(f => ({ ...f, from_branch_id: e.target.value }))}
                    className={inputCls + ' cursor-pointer appearance-none'}>
                    <option value="" style={{ background: '#0D1B2A' }}>{t('returns.form_branch_placeholder')}</option>
                    {branches.filter(b => b.is_active).map(b => (
                      <option key={b.id} value={b.id} style={{ background: '#0D1B2A' }}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.form_item')}</label>
                <select value={form.item_id} onChange={e => {
                  const id = e.target.value;
                  const item = items.find(i => i.id === id);
                  setForm(f => ({ ...f, item_id: id, item_name: getItemDisplayName(item) }));
                }}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="" style={{ background: '#0D1B2A' }}>{t('returns.form_item_placeholder')}</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id} style={{ background: '#0D1B2A' }}>{getItemDisplayName(i)} ({i.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.form_qty')}</label>
                <input type="number" min="1" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.form_reason')}</label>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={t('returns.form_reason_placeholder')} className={inputCls} />
              </div>

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('returns.form_notes')}</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('returns.form_notes_placeholder')} className={inputCls} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowForm(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('common.cancel')}</button>
              <button onClick={() => createMut.mutate()}
                disabled={!form.item_name || form.quantity <= 0 || (form.from_location === 'branch' && !form.from_branch_id) || createMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                <RotateCcw className="w-3.5 h-3.5 inline mr-1.5" />{t('returns.form_submit')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

    </div>
  );
}
