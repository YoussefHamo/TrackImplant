import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import { implantInventoryService } from '../../services/implantInventoryService';
import { useLanguage } from '../../context/LanguageContext';
import { getItemDisplayName } from '../../utils/inventory';
import { Truck, Package, Building2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import FixedOverlay from '../../components/ui/FixedOverlay';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider block mb-1.5';

export default function DeliveryForm() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    to_type: 'warehouse' as 'warehouse' | 'branch',
    to_branch_id: '',
    item_id: '',
    item_name: '',
    quantity: 0,
    notes: '',
    received_by: '',
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => deliveryService.getDeliveries(),
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
    mutationFn: () => deliveryService.createDelivery(form),
    onSuccess: () => {
      toast.success(t('delivery.toast_created'));
      setShowForm(false);
      setForm({ to_type: 'warehouse', to_branch_id: '', item_id: '', item_name: '', quantity: 0, notes: '', received_by: '' });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['branch-inventory-all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="font-sans select-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('delivery.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('delivery.subtitle', { count: deliveries.length })}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
          <Plus className="w-4 h-4" /> {t('delivery.new_delivery')}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-[22px] overflow-hidden"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[1.5]">{t('delivery.col_item')}</div>
          <div className="flex-[1]">{t('delivery.col_qty')}</div>
          <div className="flex-[1.5]">{t('delivery.col_to')}</div>
          <div className="flex-[1.5]">{t('delivery.col_received_by')}</div>
          <div className="flex-[1]">{t('delivery.col_notes')}</div>
          <div className="flex-[1.5]">{t('delivery.col_date')}</div>
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {deliveries.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.empty')}</div>
          ) : deliveries.map(d => (
            <div key={d.id} className="flex items-center px-6 py-4">
              <div className="flex-[1.5] text-sm font-medium text-white">{d.item_name}</div>
              <div className="flex-[1] text-sm font-bold text-white">{d.quantity}</div>
              <div className="flex-[1.5] text-sm flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {d.to_type === 'branch' ? <Building2 className="w-3.5 h-3.5 text-[#4FD1FF]" /> : <Package className="w-3.5 h-3.5 text-[#FFC107]" />}
                {d.to_type === 'branch' ? (d.branch_name || t('common.dash')) : t('delivery.warehouse')}
              </div>
              <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{d.received_by || '—'}</div>
              <div className="flex-[1] text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{d.notes || '—'}</div>
              <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create form modal */}
      {showForm && (
        <FixedOverlay className="flex items-center justify-center p-4" style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }} onClose={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white"><Truck className="w-4 h-4 inline mr-2 text-[#4FD1FF]" />{t('delivery.form_title')}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.form_to')}</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm(f => ({ ...f, to_type: 'warehouse', to_branch_id: '' }))}
                    className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${form.to_type === 'warehouse' ? 'bg-[rgba(255,193,7,0.12)] text-[#FFC107]' : 'bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.4)]'}`}>
                    <Package className="w-3.5 h-3.5 inline mr-1.5" />{t('delivery.warehouse')}
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, to_type: 'branch' }))}
                    className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${form.to_type === 'branch' ? 'bg-[rgba(79,209,255,0.12)] text-[#4FD1FF]' : 'bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.4)]'}`}>
                    <Building2 className="w-3.5 h-3.5 inline mr-1.5" />{t('delivery.branch')}
                  </button>
                </div>
              </div>

              {form.to_type === 'branch' && (
                <div>
                  <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.form_branch')}</label>
                  <select value={form.to_branch_id} onChange={e => setForm(f => ({ ...f, to_branch_id: e.target.value }))}
                    className={inputCls + ' cursor-pointer appearance-none'}>
                    <option value="" style={{ background: '#0D1B2A' }}>{t('delivery.form_branch_placeholder')}</option>
                    {branches.filter(b => b.is_active).map(b => (
                      <option key={b.id} value={b.id} style={{ background: '#0D1B2A' }}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.form_item')}</label>
                <select value={form.item_id} onChange={e => {
                  const id = e.target.value;
                  const item = items.find(i => i.id === id);
                  setForm(f => ({ ...f, item_id: id, item_name: getItemDisplayName(item) }));
                }}
                  className={inputCls + ' cursor-pointer appearance-none'}>
                  <option value="" style={{ background: '#0D1B2A' }}>{t('delivery.form_item_placeholder')}</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id} style={{ background: '#0D1B2A' }}>{getItemDisplayName(i)} ({i.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.form_qty')}</label>
                <input type="number" min="1" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.form_received_by')}</label>
                <input value={form.received_by} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))}
                  placeholder={t('delivery.form_received_by_placeholder')} className={inputCls} />
              </div>

              <div>
                <label className={labelCls} style={{ color: 'rgba(255,255,255,0.3)' }}>{t('delivery.form_notes')}</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('delivery.form_notes_placeholder')} className={inputCls} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => setShowForm(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>{t('common.cancel')}</button>
              <button onClick={() => createMut.mutate()}
                disabled={!form.item_name || form.quantity <= 0 || (form.to_type === 'branch' && !form.to_branch_id) || createMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                <Truck className="w-3.5 h-3.5 inline mr-1.5" />{t('delivery.form_submit')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}
    </div>
  );
}
