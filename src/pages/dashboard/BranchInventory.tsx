import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { branchService } from '../../services/branchService';
import { useLanguage } from '../../context/LanguageContext';
import { Building2, Search, AlertTriangle } from 'lucide-react';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';

export default function BranchInventory() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getAll(),
  });

  const { data: branchInventory = [] } = useQuery({
    queryKey: ['branch-inventory-all'],
    queryFn: () => branchService.getAllBranchInventory(),
  });

  const filtered = useMemo(() => {
    let items = branchInventory;
    if (selectedBranch) {
      items = items.filter(i => i.branch_id === selectedBranch);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        (i.item_name || '').toLowerCase().includes(q) ||
        (i.branch_name || '').toLowerCase().includes(q) ||
        (i.item_category || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [branchInventory, selectedBranch, search]);

  return (
    <div className="font-sans select-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('branches.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {t('branches.subtitle', { count: branches.length })}
          </p>
        </div>
      </div>

      {/* Branch tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setSelectedBranch(null)}
          className={`flex-shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${!selectedBranch ? 'bg-[rgba(79,209,255,0.12)] text-[#4FD1FF]' : 'bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.06)]'}`}>
          {t('branches.all_branches')}
        </button>
        {branches.filter(b => b.is_active).map(b => (
          <button key={b.id} onClick={() => setSelectedBranch(b.id)}
            className={`flex-shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${selectedBranch === b.id ? 'bg-[rgba(79,209,255,0.12)] text-[#4FD1FF]' : 'bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.06)]'}`}>
            <Building2 className="w-3.5 h-3.5" /> {b.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('branches.search_placeholder')} className={inputCls + ' pl-10'} />
      </div>

      {/* Inventory table */}
      <div className="rounded-[22px] overflow-hidden"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[2]">{t('branches.col_branch')}</div>
          <div className="flex-[2]">{t('branches.col_item')}</div>
          <div className="flex-[1.5]">{t('branches.col_category')}</div>
          <div className="flex-[1]">{t('branches.col_quantity')}</div>
          <div className="flex-[1]">{t('branches.col_reserved')}</div>
          <div className="flex-[1.5]">{t('branches.col_status')}</div>
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('branches.empty')}
            </div>
          ) : filtered.map(item => {
            const available = item.quantity - item.reserved;
            const lowStock = available <= 3;
            return (
              <div key={item.id} className="flex items-center px-6 py-4">
                <div className="flex-[2] text-sm font-medium text-white">{item.branch_name || '—'}</div>
                <div className="flex-[2] text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.item_name || '—'}</div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.item_category || '—'}</div>
                <div className="flex-[1] text-sm font-bold text-white">{item.quantity}</div>
                <div className="flex-[1] text-sm" style={{ color: '#FFC107' }}>{item.reserved}</div>
                <div className="flex-[1.5]">
                  {item.quantity === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(239,68,68,0.15)] text-[#ef4444]">{t('branches.status_out')}</span>
                  ) : lowStock ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(255,193,7,0.15)] text-[#FFC107]">
                      <AlertTriangle className="w-3 h-3" /> {t('branches.status_low')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(0,229,168,0.12)] text-[#00E5A8]">{t('branches.status_ok')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary cards */}
      {selectedBranch && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(() => {
            const branchItems = branchInventory.filter(i => i.branch_id === selectedBranch);
            const totalItems = branchItems.length;
            const totalQty = branchItems.reduce((s, i) => s + i.quantity, 0);
            const lowItems = branchItems.filter(i => (i.quantity - i.reserved) <= 3).length;
            return (
              <>
                <div className="rounded-[18px] p-4" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-2xl font-bold text-white">{totalItems}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('branches.summary_items')}</div>
                </div>
                <div className="rounded-[18px] p-4" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-2xl font-bold text-[#4FD1FF]">{totalQty}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('branches.summary_total')}</div>
                </div>
                <div className="rounded-[18px] p-4" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-2xl font-bold text-[#FFC107]">{lowItems}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('branches.summary_low')}</div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
