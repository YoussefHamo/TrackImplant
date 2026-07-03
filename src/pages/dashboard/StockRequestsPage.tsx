import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { implantInventoryService } from '../../services/implantInventoryService';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Send, Check, XCircle, Ban, Truck, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';

const statusConfig: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending: { bg: 'rgba(255,193,7,0.15)', text: '#FFC107', icon: Clock },
  approved: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8', icon: Check },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', icon: XCircle },
  delivered: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF', icon: Truck },
  completed: { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF', icon: CheckCircle },
};

export default function StockRequestsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'Admin';

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ item_name: '', quantity: 0, notes: '' });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['stock-requests'],
    queryFn: () => implantInventoryService.getStockRequests(),
  });

  const createMut = useMutation({
    mutationFn: () => implantInventoryService.createStockRequest(form),
    onSuccess: () => { toast.success(t('inventory.toast_request_created')); setShowCreate(false); setForm({ item_name: '', quantity: 0, notes: '' }); queryClient.invalidateQueries({ queryKey: ['stock-requests'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: import('../../types').StockRequestStatus }) =>
      implantInventoryService.updateStockRequestStatus(id, status),
    onSuccess: () => { toast.success(t('inventory.toast_request_updated')); queryClient.invalidateQueries({ queryKey: ['stock-requests'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="font-sans select-none space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('requests.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('requests.subtitle', { count: requests.length })}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
          <Send className="w-4 h-4" /> {t('requests.new_request')}
        </button>
      </div>

      {/* Pending count banner */}
      {(() => { const p = requests.filter(r => r.status === 'pending'); return p.length > 0 ? (
        <div className="rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2"
          style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.15)', color: '#FFC107' }}>
          <Clock className="w-4 h-4" /> {t('requests.pending_banner', { count: p.length })}
        </div>
      ) : null; })()}

      {/* Table */}
      <div className="rounded-[22px] overflow-hidden"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[2]">{t('requests.col_item')}</div>
          <div className="flex-[1]">{t('requests.col_qty')}</div>
          <div className="flex-[1.5]">{t('requests.col_requested_by')}</div>
          <div className="flex-[1.5]">{t('requests.col_status')}</div>
          <div className="flex-[1.5]">{t('requests.col_date')}</div>
          {isAdmin && <div className="w-24">{t('requests.col_actions')}</div>}
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" /></div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('requests.empty')}</div>
          ) : requests.map(r => {
            const sc = statusConfig[r.status] || statusConfig.pending;
            const SIcon = sc.icon;
            return (
              <div key={r.id} className="flex items-center px-6 py-4">
                <div className="flex-[2] text-sm font-medium text-white">{r.item_name}</div>
                <div className="flex-[1] text-sm font-bold text-white">{r.quantity}</div>
                <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.requested_by_name || '—'}</div>
                <div className="flex-[1.5]">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: sc.bg, color: sc.text }}>
                    <SIcon className="w-3 h-3" /> {r.status}
                  </span>
                </div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                </div>
                {isAdmin && r.status === 'pending' && (
                  <div className="w-24 flex items-center gap-1">
                    <button onClick={() => updateMut.mutate({ id: r.id, status: 'approved' })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#00E5A8' }} title={t('requests.tooltip_approve')}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => updateMut.mutate({ id: r.id, status: 'rejected' })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#ef4444' }} title={t('requests.tooltip_reject')}>
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {isAdmin && r.status === 'approved' && (
                  <div className="w-24 flex items-center gap-1">
                    <button onClick={() => updateMut.mutate({ id: r.id, status: 'delivered' })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#4FD1FF' }} title={t('requests.tooltip_deliver')}>
                      <Truck className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {isAdmin && r.status === 'delivered' && (
                  <div className="w-24 flex items-center gap-1">
                    <button onClick={() => updateMut.mutate({ id: r.id, status: 'completed' })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#7C5CFF' }} title={t('requests.tooltip_complete')}>
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); } }}>
          <div className="w-full max-w-sm rounded-[24px] p-6" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-lg font-bold text-white mb-4">{t('requests.modal_title')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('requests.modal_item')}</label>
                <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                  placeholder={t('requests.modal_item_placeholder')} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('requests.modal_qty')}</label>
                <input type="number" min="1" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('requests.modal_notes')}</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('requests.modal_notes_placeholder')} className={inputCls} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('common.cancel')}</button>
              <button onClick={() => createMut.mutate()} disabled={!form.item_name || form.quantity <= 0 || createMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>{t('requests.modal_submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
