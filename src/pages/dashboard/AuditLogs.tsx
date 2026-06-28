import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '../../services/auditLogService';
import {
  Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { AuditAction } from '../../types';

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

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, tableFilter],
    queryFn: () => auditLogService.getAll({
      page,
      perPage,
      search: search || undefined,
      action: (actionFilter || undefined) as AuditAction | undefined,
      table: tableFilter || undefined,
    }),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const tables = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => set.add(l.table_name));
    return Array.from(set).sort();
  }, [logs]);

  return (
    <div className="font-sans select-none space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {total} event{total !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-[20px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users, tables, actions..."
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }} />
          </div>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[140px]">
            <option value="" style={{ background: '#0D1B2A' }}>All Actions</option>
            <option value="INSERT" style={{ background: '#0D1B2A' }}>INSERT</option>
            <option value="UPDATE" style={{ background: '#0D1B2A' }}>UPDATE</option>
            <option value="DELETE" style={{ background: '#0D1B2A' }}>DELETE</option>
            <option value="LOGIN" style={{ background: '#0D1B2A' }}>LOGIN</option>
            <option value="USER_CREATED" style={{ background: '#0D1B2A' }}>USER CREATED</option>
            <option value="ROLE_CHANGED" style={{ background: '#0D1B2A' }}>ROLE CHANGED</option>
            <option value="INVENTORY_CHANGE" style={{ background: '#0D1B2A' }}>INVENTORY CHANGE</option>
            <option value="PAYMENT_CHANGE" style={{ background: '#0D1B2A' }}>PAYMENT CHANGE</option>
          </select>
          <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(1); }}
            className="h-10 px-4 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white cursor-pointer appearance-none min-w-[140px]">
            <option value="" style={{ background: '#0D1B2A' }}>All Tables</option>
            {tables.map(t => (
              <option key={t} value={t} style={{ background: '#0D1B2A' }}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-[20px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div className="flex-[2]">User</div>
          <div className="flex-[1.5]">Action</div>
          <div className="flex-[1.5]">Table</div>
          <div className="flex-[2]">Record ID</div>
          <div className="flex-[1.5]">Timestamp</div>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {search || actionFilter || tableFilter ? 'No logs match your filters' : 'No audit logs yet.'}
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
                        <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1.5" style={{ color: '#ef4444' }}>Old Data</span>
                        <pre className="p-3 rounded-lg overflow-x-auto" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_data && Object.keys(log.new_data).length > 0 && (
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1.5" style={{ color: '#00E5A8' }}>New Data</span>
                        <pre className="p-3 rounded-lg overflow-x-auto" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,168,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Full Record ID</span>
                      <code className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{log.record_id}</code>
                    </div>
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
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
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
