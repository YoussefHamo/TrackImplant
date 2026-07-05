import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '../../services/auditLogService';
import { branchService } from '../../services/branchService';
import {
  Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { AuditAction } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

const actionColors: Record<string, { bg: string; text: string }> = {
  INSERT: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8' },
  UPDATE: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF' },
  DELETE: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  LOGIN: { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF' },
  USER_CREATED: { bg: 'rgba(255,193,7,0.12)', text: '#FFC107' },
  ROLE_CHANGED: { bg: 'rgba(255,165,0,0.12)', text: '#FFA500' },
  INVENTORY_CHANGE: { bg: 'rgba(69,214,255,0.12)', text: '#45D6FF' },
  PAYMENT_CHANGE: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8' },
};

function ActionBadge({ action }: { action: string }) {
  const c = actionColors[action] || { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {action.replace('_', ' ')}
    </span>
  );
}

const inputCls = 'h-9 px-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white';

export default function AuditLogs() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 25;

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    branchService.getAll().then(b => setBranches(b.filter(x => x.is_active)));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, tableFilter, roleFilter, branchFilter, dateFrom, dateTo],
    queryFn: () => auditLogService.getAll({
      page,
      perPage,
      search: search || undefined,
      action: (actionFilter || undefined) as AuditAction | undefined,
      table: tableFilter || undefined,
      role: roleFilter || undefined,
      branchId: branchFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
  });

  const logs = useMemo(() => data?.logs ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const tables = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => set.add(l.table_name));
    return Array.from(set).sort();
  }, [logs]);

  const roleOptions = ['Admin', 'Manager', 'Doctor', 'Receptionist', 'Assistant'];

  return (
    <div className="font-sans select-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('logs.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {t('logs.subtitle', { count: total })}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-[20px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('logs.search_placeholder')}
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }} />
          </div>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[130px]">
            <option value="" style={{ background: '#0D1B2A' }}>{t('logs.action_filter')}</option>
            <option value="INSERT" style={{ background: '#0D1B2A' }}>{t('logs.action_insert')}</option>
            <option value="UPDATE" style={{ background: '#0D1B2A' }}>{t('logs.action_update')}</option>
            <option value="DELETE" style={{ background: '#0D1B2A' }}>{t('logs.action_delete')}</option>
            <option value="LOGIN" style={{ background: '#0D1B2A' }}>{t('logs.action_login')}</option>
            <option value="USER_CREATED" style={{ background: '#0D1B2A' }}>{t('logs.action_user_created')}</option>
            <option value="ROLE_CHANGED" style={{ background: '#0D1B2A' }}>{t('logs.action_role_changed')}</option>
            <option value="INVENTORY_CHANGE" style={{ background: '#0D1B2A' }}>{t('logs.action_inventory_change')}</option>
            <option value="PAYMENT_CHANGE" style={{ background: '#0D1B2A' }}>{t('logs.action_payment_change')}</option>
          </select>
          <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[130px]">
            <option value="" style={{ background: '#0D1B2A' }}>{t('logs.table_filter')}</option>
            {tables.map(t => (
              <option key={t} value={t} style={{ background: '#0D1B2A' }}>{t}</option>
            ))}
          </select>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[110px]">
            <option value="" style={{ background: '#0D1B2A' }}>All Roles</option>
            {roleOptions.map(r => (
              <option key={r} value={r} style={{ background: '#0D1B2A' }}>{r}</option>
            ))}
          </select>
          <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[130px]">
            <option value="" style={{ background: '#0D1B2A' }}>All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id} style={{ background: '#0D1B2A' }}>{b.name}</option>
            ))}
          </select>
          <div>
            <label className="text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>From</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>To</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-[20px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[2]">{t('logs.table_user')}</div>
          <div className="flex-[1]">Role</div>
          <div className="flex-[1.5]">{t('logs.table_action')}</div>
          <div className="flex-[1.5]">{t('logs.table_table')}</div>
          <div className="flex-[2]">{t('logs.table_record_id')}</div>
          <div className="flex-[1.5]">{t('logs.table_timestamp')}</div>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {search || actionFilter || tableFilter || roleFilter || branchFilter || dateFrom || dateTo ? 'No logs match filters' : t('logs.empty_all')}
            </div>
          ) : logs.map(log => (
            <div key={log.id}>
              <div onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="flex items-center px-6 py-3.5 transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.02)]">
                <div className="flex-[2] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
                    {(log.user_name ?? '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-medium text-white">{log.user_name}</span>
                </div>
                <div className="flex-[1] text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{log.role || '—'}</div>
                <div className="flex-[1.5]"><ActionBadge action={log.action} /></div>
                <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{log.table_name}</div>
                <div className="flex-[2] text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {log.record_id.slice(0, 8)}...
                </div>
                <div className="flex-[1.5] text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                </div>
              </div>
              {/* Expanded details */}
              {expandedId === log.id && (
                <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.03)]" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {log.old_data && Object.keys(log.old_data).length > 0 && (
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1.5" style={{ color: '#ef4444' }}>{t('logs.detail_old_data')}</span>
                        <pre className="p-3 rounded-lg overflow-x-auto" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_data && Object.keys(log.new_data).length > 0 && (
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1.5" style={{ color: '#00E5A8' }}>{t('logs.detail_new_data')}</span>
                        <pre className="p-3 rounded-lg overflow-x-auto" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,168,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('logs.detail_record_id')}</span>
                      <code className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{log.record_id}</code>
                    </div>
                    {log.branch_id && <div>
                      <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Branch</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{log.branch_id}</span>
                    </div>}
                    {log.reason_category && <div>
                      <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Reason Category</span>
                      <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: 'rgba(255,193,7,0.1)', color: '#FFC107' }}>{log.reason_category}</span>
                    </div>}
                    {log.change_reason && <div>
                      <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Reason</span>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{log.change_reason}</p>
                    </div>}
                    {log.ip_address && <div>
                      <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>IP</span>
                      <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>{log.ip_address}</span>
                    </div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {total > perPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {t('common.showing_entries', { start: (page - 1) * perPage + 1, end: Math.min(page * perPage, total), total })}
            </span>
            <div className="flex items-center gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                const n = idx + 1;
                return <button key={n} onClick={() => setPage(n)}
                  className="w-8 h-8 rounded-lg text-xs font-semibold"
                  style={{ background: page === n ? 'rgba(79,209,255,0.12)' : 'transparent', border: `1px solid ${page === n ? 'rgba(79,209,255,0.2)' : 'rgba(255,255,255,0.06)'}`, color: page === n ? '#4FD1FF' : 'rgba(255,255,255,0.4)' }}>{n}</button>;
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
