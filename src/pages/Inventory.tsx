import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { implantInventoryService } from '../services/implantInventoryService';
import { patientService } from '../services/patientService';
import { procedureService } from '../services/procedureService';
import type { ImplantInventory, AbutmentInventory } from '../types';
import {
  Package, Layers, ArrowUpDown, Plus, X, AlertTriangle,
  Edit2, Trash2, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'implants' | 'abutments' | 'transactions';
type TxFilter = 'all' | 'implant' | 'abutment' | 'add' | 'deduct';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';

const tabs: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'implants', label: 'Implants', icon: Package },
  { key: 'abutments', label: 'Abutments', icon: Layers },
  { key: 'transactions', label: 'Transactions', icon: ArrowUpDown },
];

export default function Inventory() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('implants');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'implant' | 'abutment'>('implant');
  const [editId, setEditId] = useState<string | null>(null);
  const [modalForm, setModalForm] = useState({ brand: '', size: '', type: '', quantity: 0 });
  const [customBrand, setCustomBrand] = useState(false);
  const [customSize, setCustomSize] = useState(false);
  const [customType, setCustomType] = useState(false);
  const [adjustModal, setAdjustModal] = useState<{ id: string; type: 'implant' | 'abutment'; label: string } | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');

  // Data
  const { data: implants = [], isLoading: loadI, isError: errI, refetch: refI } = useQuery({
    queryKey: ['implant-inventory'],
    queryFn: () => implantInventoryService.getImplants(),
  });
  const { data: abutments = [], isLoading: loadA, isError: errA, refetch: refA } = useQuery({
    queryKey: ['abutment-inventory'],
    queryFn: () => implantInventoryService.getAbutments(),
  });
  const { data: transactions = [], isLoading: loadT, isError: errT, refetch: refT } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: () => implantInventoryService.getTransactions(),
  });
  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });
  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => procedureService.getAll(),
  });

  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p.full_name])), [patients]);
  const procedureMap = useMemo(() => new Map(procedures.map(p => [p.id, p.procedure_name])), [procedures]);

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ['implant-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['abutment-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['procedures'] });
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  };

  // Mutations
  const upsertImplantMut = useMutation({
    mutationFn: () => implantInventoryService.upsertImplant({ brand: modalForm.brand, size: modalForm.size, quantity: modalForm.quantity }),
    onSuccess: () => { toast.success('Implant stock updated'); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateImplantMut = useMutation({
    mutationFn: () => implantInventoryService.updateImplant(editId!, { brand: modalForm.brand, size: modalForm.size, quantity: modalForm.quantity }),
    onSuccess: () => { toast.success('Implant updated'); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteImplantMut = useMutation({
    mutationFn: (id: string) => implantInventoryService.deleteImplant(id),
    onSuccess: () => { toast.success('Implant deleted'); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsertAbutMut = useMutation({
    mutationFn: () => implantInventoryService.upsertAbutment({ type: modalForm.type, quantity: modalForm.quantity }),
    onSuccess: () => { toast.success('Abutment stock updated'); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateAbutMut = useMutation({
    mutationFn: () => implantInventoryService.updateAbutment(editId!, { type: modalForm.type, quantity: modalForm.quantity }),
    onSuccess: () => { toast.success('Abutment updated'); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteAbutMut = useMutation({
    mutationFn: (id: string) => implantInventoryService.deleteAbutment(id),
    onSuccess: () => { toast.success('Abutment deleted'); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustMut = useMutation({
    mutationFn: () => {
      if (!adjustModal) throw new Error('No item');
      return adjustModal.type === 'implant'
        ? implantInventoryService.adjustImplantStock(adjustModal.id, adjustQty, adjustNotes || undefined)
        : implantInventoryService.adjustAbutmentStock(adjustModal.id, adjustQty, adjustNotes || undefined);
    },
    onSuccess: () => { toast.success('Stock adjusted'); setAdjustModal(null); setAdjustQty(0); setAdjustNotes(''); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetModal = () => { setEditId(null); setModalForm({ brand: '', size: '', type: '', quantity: 0 }); setCustomBrand(false); setCustomSize(false); setCustomType(false); };

  const openCreate = (type: 'implant' | 'abutment') => {
    resetModal(); setModalMode(type); setShowModal(true);
  };

  const openEdit = (type: 'implant' | 'abutment', item: ImplantInventory | AbutmentInventory) => {
    setModalMode(type);
    if (type === 'implant') {
      const i = item as ImplantInventory;
      setModalForm({ brand: i.brand, size: i.size, type: '', quantity: i.quantity });
    } else {
      const a = item as AbutmentInventory;
      setModalForm({ brand: '', size: '', type: a.type, quantity: a.quantity });
    }
    setEditId(item.id);
    setShowModal(true);
  };

  // Filtered Transactions
  const filteredTxs = useMemo(() => {
    let list = [...transactions];
    if (txFilter === 'implant') list = list.filter(t => t.item_type === 'implant');
    else if (txFilter === 'abutment') list = list.filter(t => t.item_type === 'abutment');
    else if (txFilter === 'add') list = list.filter(t => t.type === 'add');
    else if (txFilter === 'deduct') list = list.filter(t => t.type === 'deduct');
    return list;
  }, [transactions, txFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / perPage));
  const pagedTxs = filteredTxs.slice((page - 1) * perPage, page * perPage);

  const lowStock = useMemo(() => {
    const i = implants.filter(x => x.quantity <= 3);
    const a = abutments.filter(x => x.quantity <= 3);
    return { implants: i, abutments: a, total: i.length + a.length };
  }, [implants, abutments]);

  return (
    <div className="font-sans select-none space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Inventory</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {implants.length + abutments.length} items tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lowStock.total > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> {lowStock.total} low stock
            </div>
          )}
          <button onClick={() => openCreate('implant')}
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
            <Plus className="w-4 h-4" /> Add Implant
          </button>
          <button onClick={() => openCreate('abutment')}
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #7C5CFF, #6B4CE0)', color: '#FFFFFF', boxShadow: '0 4px 20px rgba(124,92,255,0.25)' }}>
            <Plus className="w-4 h-4" /> Add Abutment
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.total > 0 && (
        <div className="rounded-[18px] p-4 animate-fadeIn flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="w-5 h-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#ef4444]">Low Stock Alert</h3>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {lowStock.implants.length} implant{lowStock.implants.length !== 1 ? 's' : ''} and {lowStock.abutments.length} abutment{lowStock.abutments.length !== 1 ? 's' : ''} running low.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
              className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all"
              style={{
                background: tab === t.key ? 'rgba(79,209,255,0.12)' : 'transparent',
                color: tab === t.key ? '#4FD1FF' : 'rgba(255,255,255,0.4)',
              }}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── IMPLANTS TABLE ─── */}
      {tab === 'implants' && (
        <div className="rounded-[22px] overflow-hidden"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            <div className="flex-[2]">Brand</div>
            <div className="flex-[2]">Size</div>
            <div className="flex-[1.5]">Qty</div>
            <div className="flex-[2]">Status</div>
            <div className="w-20">Actions</div>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {loadI ? (
              <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" /></div>
            ) : errI ? (
              <div className="py-16 text-center text-sm" style={{ color: '#FF6B6B' }}>Failed to load. <button onClick={() => refI()} className="underline" style={{ color: '#4FD1FF' }}>Retry</button></div>
            ) : implants.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No implants in inventory.</div>
            ) : implants.map(i => (
              <div key={i.id} className="flex items-center px-6 py-4">
                <div className="flex-[2] text-sm font-medium text-white">{i.brand}</div>
                <div className="flex-[2] text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{i.size}</div>
                <div className="flex-[1.5]"><span className="text-sm font-bold text-white">{i.quantity}</span></div>
                <div className="flex-[2]">
                  {i.quantity === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Out Of Stock</span>
                  ) : i.quantity <= 3 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(255,193,7,0.15)', color: '#FFC107' }}>Low Stock</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(0,229,168,0.12)', color: '#00E5A8' }}>In Stock</span>
                  )}
                </div>
                <div className="w-20 flex items-center gap-1">
                  <button onClick={() => setAdjustModal({ id: i.id, type: 'implant', label: `${i.brand} ${i.size}` })}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(255,255,255,0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit('implant', i)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(255,255,255,0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm('Delete this implant?')) deleteImplantMut.mutate(i.id); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(239,68,68,0.1]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── ABUTMENTS TABLE ─── */}
      {tab === 'abutments' && (
        <div className="rounded-[22px] overflow-hidden"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            <div className="flex-[3]">Type</div>
            <div className="flex-[1.5]">Qty</div>
            <div className="flex-[2]">Status</div>
            <div className="w-20">Actions</div>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {loadA ? (
              <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" /></div>
            ) : errA ? (
              <div className="py-16 text-center text-sm" style={{ color: '#FF6B6B' }}>Failed to load. <button onClick={() => refA()} className="underline" style={{ color: '#4FD1FF' }}>Retry</button></div>
            ) : abutments.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No abutments in inventory.</div>
            ) : abutments.map(a => (
              <div key={a.id} className="flex items-center px-6 py-4">
                <div className="flex-[3] text-sm font-medium text-white">{a.type}</div>
                <div className="flex-[1.5]"><span className="text-sm font-bold text-white">{a.quantity}</span></div>
                <div className="flex-[2]">
                  {a.quantity === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Out Of Stock</span>
                  ) : a.quantity <= 3 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(255,193,7,0.15)', color: '#FFC107' }}>Low Stock</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(0,229,168,0.12)', color: '#00E5A8' }}>In Stock</span>
                  )}
                </div>
                <div className="w-20 flex items-center gap-1">
                  <button onClick={() => setAdjustModal({ id: a.id, type: 'abutment', label: a.type })}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(255,255,255,0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit('abutment', a)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(255,255,255,0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm('Delete this abutment?')) deleteAbutMut.mutate(a.id); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(239,68,68,0.1]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TRANSACTIONS TABLE ─── */}
      {tab === 'transactions' && (
        <div className="rounded-[22px] overflow-hidden"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          {/* Filters */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-[rgba(255,255,255,0.05)] overflow-x-auto">
            <Filter className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
            {(['all', 'implant', 'abutment', 'add', 'deduct'] as TxFilter[]).map(f => (
              <button key={f} onClick={() => { setTxFilter(f); setPage(1); }}
                className="h-7 px-3 rounded-lg text-[10px] font-semibold transition-all"
                style={{
                  background: txFilter === f ? 'rgba(79,209,255,0.12)' : 'rgba(255,255,255,0.03)',
                  color: txFilter === f ? '#4FD1FF' : 'rgba(255,255,255,0.4)',
                  border: txFilter === f ? '1px solid rgba(79,209,255,0.2)' : '1px solid transparent',
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            <div className="flex-[1.5]">Item</div>
            <div className="flex-[1]">Type</div>
            <div className="flex-[1]">Qty</div>
            <div className="flex-[1.5]">Patient</div>
            <div className="flex-[1.5]">Procedure</div>
            <div className="flex-[1.5]">Date</div>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {loadT ? (
              <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" /></div>
            ) : errT ? (
              <div className="py-16 text-center text-sm" style={{ color: '#FF6B6B' }}>Failed to load. <button onClick={() => refT()} className="underline" style={{ color: '#4FD1FF' }}>Retry</button></div>
            ) : pagedTxs.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No transactions found.</div>
            ) : pagedTxs.map(tx => (
              <div key={tx.id} className="flex items-center px-6 py-4">
                <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {tx.item_type === 'implant' ? 'Implant' : 'Abutment'}
                </div>
                <div className="flex-[1]">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tx.type === 'add' ? 'bg-[rgba(0,229,168,0.12)] text-[#00E5A8]' : 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'
                  }`}>
                    {tx.type === 'add' ? 'Add' : 'Deduct'}
                  </span>
                </div>
                <div className="flex-[1] text-sm font-bold text-white">{tx.quantity}</div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {tx.patient_id ? (patientMap.get(tx.patient_id) || '—') : '—'}
                </div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {tx.procedure_id ? (procedureMap.get(tx.procedure_id) || '—') : '—'}
                </div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {filteredTxs.length > perPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── CREATE/EDIT MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetModal(); } }}>
          <div className="w-full max-w-md rounded-[24px]" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-white">
                {editId ? `Edit ${modalMode === 'implant' ? 'Implant' : 'Abutment'}` : `Add ${modalMode === 'implant' ? 'Implant' : 'Abutment'}`}
              </h2>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {modalMode === 'implant' ? (
                <>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Brand</label>
                    {!customBrand ? (
                      <div className="flex gap-2">
                        <select value={modalForm.brand} onChange={e => { const v = e.target.value; if (v === '__new__') setCustomBrand(true); else setModalForm(f => ({ ...f, brand: v })); }}
                          className={inputCls + ' cursor-pointer appearance-none flex-1'}>
                          <option value="" style={{ background: '#0D1B2A' }}>Select brand...</option>
                          {[...new Set(implants.map(i => i.brand))].sort().map(b => (
                            <option key={b} value={b} style={{ background: '#0D1B2A' }}>{b}</option>
                          ))}
                          <option value="__new__" style={{ background: '#0D1B2A', color: '#4FD1FF' }}>— New Brand —</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input value={modalForm.brand} onChange={e => setModalForm(f => ({ ...f, brand: e.target.value }))}
                          placeholder="Type new brand name..." className={inputCls + ' flex-1'} autoFocus />
                        <button onClick={() => { setCustomBrand(false); setModalForm(f => ({ ...f, brand: '' })); }}
                          className="h-10 px-3 rounded-xl text-xs font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>Back</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Size</label>
                    {!customSize ? (
                      <div className="flex gap-2">
                        <select value={modalForm.size} onChange={e => { const v = e.target.value; if (v === '__new__') setCustomSize(true); else setModalForm(f => ({ ...f, size: v })); }}
                          disabled={!modalForm.brand}
                          className={inputCls + ' cursor-pointer appearance-none flex-1'}>
                          <option value="" style={{ background: '#0D1B2A' }}>{modalForm.brand ? 'Select size...' : 'Select a brand first'}</option>
                          {implants.filter(i => i.brand === modalForm.brand).map(i => (
                            <option key={i.id} value={i.size} style={{ background: '#0D1B2A' }}>{i.size}</option>
                          ))}
                          {modalForm.brand && <option value="__new__" style={{ background: '#0D1B2A', color: '#4FD1FF' }}>— New Size —</option>}
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input value={modalForm.size} onChange={e => setModalForm(f => ({ ...f, size: e.target.value }))}
                          placeholder="e.g. 4.3 x 10mm" className={inputCls + ' flex-1'} autoFocus />
                        <button onClick={() => { setCustomSize(false); setModalForm(f => ({ ...f, size: '' })); }}
                          className="h-10 px-3 rounded-xl text-xs font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>Back</button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Type</label>
                  {!customType ? (
                    <div className="flex gap-2">
                      <select value={modalForm.type} onChange={e => { const v = e.target.value; if (v === '__new__') setCustomType(true); else setModalForm(f => ({ ...f, type: v })); }}
                        className={inputCls + ' cursor-pointer appearance-none flex-1'}>
                        <option value="" style={{ background: '#0D1B2A' }}>Select type...</option>
                        {abutments.map(a => (
                          <option key={a.id} value={a.type} style={{ background: '#0D1B2A' }}>{a.type}</option>
                        ))}
                        <option value="__new__" style={{ background: '#0D1B2A', color: '#4FD1FF' }}>— New Type —</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input value={modalForm.type} onChange={e => setModalForm(f => ({ ...f, type: e.target.value }))}
                        placeholder="Type new abutment type..." className={inputCls + ' flex-1'} autoFocus />
                      <button onClick={() => { setCustomType(false); setModalForm(f => ({ ...f, type: '' })); }}
                        className="h-10 px-3 rounded-xl text-xs font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>Back</button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Quantity</label>
                <input type="number" min="0" value={modalForm.quantity} onChange={e => setModalForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className={inputCls} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
              <button onClick={() => { setShowModal(false); resetModal(); }} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => {
                if (editId) {
                  modalMode === 'implant' ? updateImplantMut.mutate() : updateAbutMut.mutate();
                } else {
                  modalMode === 'implant' ? upsertImplantMut.mutate() : upsertAbutMut.mutate();
                }
              }}
                disabled={upsertImplantMut.isPending || updateImplantMut.isPending || upsertAbutMut.isPending || updateAbutMut.isPending}
                className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {editId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STOCK ADJUST MODAL ─── */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setAdjustModal(null); setAdjustQty(0); setAdjustNotes(''); } }}>
          <div className="w-full max-w-sm rounded-[24px] p-6" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-sm font-bold text-white mb-1">Adjust Stock</h3>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>{adjustModal.label}</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Quantity Change</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))}
                  placeholder="Use positive to add, negative to deduct" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Notes (optional)</label>
                <input value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder="Reason for adjustment" className={inputCls} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => { setAdjustModal(null); setAdjustQty(0); setAdjustNotes(''); }} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
              <button onClick={() => adjustMut.mutate()} disabled={adjustQty === 0 || adjustMut.isPending}
                className="h-10 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
                {adjustMut.isPending ? 'Adjusting...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
