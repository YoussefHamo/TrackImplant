import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';
import EmptyState from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

const categoryConfig: Record<string, { label: string; icon: string; color: string }> = {
  appointment: { label: 'Appointments', icon: '\uD83D\uDCC5', color: 'var(--color-primary)' },
  procedure: { label: 'Procedures', icon: '\uD83D\uDD2C', color: 'var(--color-secondary)' },
  invoice: { label: 'Invoices', icon: '\uD83D\uDCB0', color: 'var(--color-success)' },
  payment: { label: 'Payments', icon: '\uD83D\uDCB5', color: 'var(--color-success)' },
  inventory: { label: 'Inventory', icon: '\uD83D\uDCE6', color: '#FFC107' },
  stock_request: { label: 'Stock Requests', icon: '\uD83D\uDD04', color: 'var(--color-warning)' },
  delivery: { label: 'Deliveries', icon: '\uD83D\uDE9A', color: 'var(--color-primary)' },
  follow_up: { label: 'Follow-ups', icon: '\uD83D\uDC89', color: 'var(--color-secondary)' },
  reminder: { label: 'Reminders', icon: '\uD83D\uDD14', color: 'var(--color-warning)' },
  crm: { label: 'CRM', icon: '\uD83D\uDCAC', color: 'var(--color-primary)' },
  system: { label: 'System', icon: '\u2699\uFE0F', color: 'var(--app-text-dim)' },
  general: { label: 'General', icon: '\uD83D\uDCCB', color: 'var(--app-text-muted)' },
};

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
  success: CheckCircle,
};

const typeColors: Record<string, { bg: string; text: string }> = {
  info: { bg: 'var(--color-primary-container)', text: 'var(--color-primary)' },
  warning: { bg: 'var(--color-warning-container)', text: 'var(--color-warning)' },
  critical: { bg: 'var(--color-error-container)', text: 'var(--color-error)' },
  success: { bg: 'var(--color-success-container)', text: 'var(--color-success)' },
};

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.getByUser(user!.id),
    enabled: !!user?.id,
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length };
    const unreadCounts: Record<string, number> = { all: notifications.filter(n => !n.is_read).length };
    notifications.forEach(n => {
      const cat = n.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
      if (!n.is_read) unreadCounts[cat] = (unreadCounts[cat] || 0) + 1;
    });
    return { counts, unreadCounts };
  }, [notifications]);

  const filtered = useMemo(() => {
    let list = notifications;
    if (categoryFilter !== 'all') list = list.filter(n => (n.category || 'general') === categoryFilter);
    if (readFilter === 'unread') list = list.filter(n => !n.is_read);
    if (readFilter === 'read') list = list.filter(n => n.is_read);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, categoryFilter, readFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const unread = notifications.filter(n => !n.is_read);

  const markAllMut = useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => {
      toast.success(t('notifications.toast_marked_read'));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => notificationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-on-surface)]">{t('notifications.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>
            {t('notifications.subtitle', { unread: unread.length, total: notifications.length })}
          </p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllMut.mutate()} className="btn-secondary btn-sm">
            <CheckCheck className="w-4 h-4" />
            {t('notifications.mark_all_read')}
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="card-cyber">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search notifications..." className="input-cyber pl-10" />
          </div>
          <select value={readFilter} onChange={e => { setReadFilter(e.target.value as typeof readFilter); setPage(1); }}
            className="input-cyber cursor-pointer appearance-none min-w-[120px]">
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries({ all: { label: 'All', icon: '\uD83D\uDD14', color: 'var(--color-primary)' }, ...categoryConfig }).map(([cat, cfg]) => {
          const count = categoryCounts.unreadCounts[cat] || 0;
          const isActive = categoryFilter === cat;
          return (
            <button key={cat} onClick={() => { setCategoryFilter(cat); setPage(1); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isActive ? cfg.color + '1A' : 'rgba(255,255,255,0.04)',
                color: isActive ? cfg.color : 'var(--app-text-dim)',
                border: `1px solid ${isActive ? cfg.color + '33' : 'var(--app-border)'}`,
              }}>
              <span>{cfg.icon}</span>
              {cfg.label}
              {count > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: cfg.color, color: '#050B14' }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="card-cyber p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <EmptyState
            icon={'\uD83D\uDD14'}
            title="No notifications"
            description={searchQuery || categoryFilter !== 'all' || readFilter !== 'all' ? "Try adjusting your filters." : "You're all caught up!"}
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
            {paged.map(n => {
              const Icon = typeIcons[n.type] || Info;
              const c = typeColors[n.type] || typeColors.info;
              const catCfg = categoryConfig[n.category || 'general'] || categoryConfig.general;
              return (
                <div key={n.id}
                  className="flex items-start gap-4 px-6 py-4 transition-all cursor-pointer hover:bg-[var(--app-table-hover)]"
                  onClick={() => { if (!n.is_read) markOneMut.mutate(n.id); }}
                  style={{ opacity: n.is_read ? 0.6 : 1, borderLeft: `3px solid ${c.text}33` }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: c.bg }}>
                    <Icon className="w-5 h-5" style={{ color: c.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-on-surface)]">{n.title}</span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} flex-shrink-0 />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-dim)' }}>{n.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: catCfg.color + '1A', color: catCfg.color }}>
                        {catCfg.icon} {catCfg.label}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--app-text-dim)' }}>
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {n.link && (
                      <a href={n.link}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg btn-sm"
                        style={{ background: 'var(--color-primary-container)', color: 'var(--color-primary)' }}>
                        {t('notifications.view')}
                      </a>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteMut.mutate(n.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(244,63,94,0.1)]"
                      style={{ color: 'var(--app-text-dim)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > perPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
            <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>
              Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}
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
  );
}
