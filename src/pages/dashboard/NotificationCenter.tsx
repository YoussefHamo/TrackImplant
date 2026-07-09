import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Search, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { notificationPreferenceService } from '../../services/notificationPreferenceService';
import type { NotificationCategory } from '../../services/notificationService';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  appointment: { label: 'Appointments', icon: '📅', color: '#4FD1FF' },
  procedure: { label: 'Procedures', icon: '🔬', color: '#7C5CFF' },
  invoice: { label: 'Invoices', icon: '💰', color: '#00E5A8' },
  payment: { label: 'Payments', icon: '💵', color: '#4CAF50' },
  inventory: { label: 'Inventory', icon: '📦', color: '#FF9800' },
  stock_request: { label: 'Stock Requests', icon: '🔄', color: '#FFC107' },
  delivery: { label: 'Deliveries', icon: '🚚', color: '#4FD1FF' },
  follow_up: { label: 'Follow-ups', icon: '🩺', color: '#9C27B0' },
  reminder: { label: 'Reminders', icon: '🔔', color: '#FF9800' },
  crm: { label: 'CRM', icon: '💬', color: '#00E5A8' },
  system: { label: 'System', icon: '⚙️', color: '#9E9E9E' },
  general: { label: 'General', icon: '📋', color: '#4FD1FF' },
};

const TYPE_COLORS: Record<string, string> = {
  info: '#4FD1FF',
  warning: '#FFC107',
  critical: '#F44336',
  success: '#4CAF50',
};

const INPUT_CLS = 'h-9 px-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ALL_CATEGORIES: NotificationCategory[] = [
  'appointment', 'procedure', 'invoice', 'payment', 'inventory',
  'stock_request', 'delivery', 'follow_up', 'reminder', 'crm',
  'system', 'general',
];

const PAGE_SIZE = 15;

export default function NotificationCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | ''>('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState(0);

  const isRead = readFilter === 'all' ? undefined : readFilter === 'unread' ? false : true;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications-center', user?.id, categoryFilter, isRead, search, page],
    queryFn: () => notificationService.getFiltered(user!.id, {
      category: categoryFilter || undefined,
      is_read: isRead,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    enabled: !!user?.id,
  });

  const { data: enabledCategories } = useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: () => notificationPreferenceService.getEnabledCategories(user!.id),
    enabled: !!user?.id,
  });

  const { data: unreadByCategory = {} as Record<NotificationCategory, number> } = useQuery({
    queryKey: ['notifications-unread-category', user?.id],
    queryFn: () => notificationService.getUnreadByCategory(user!.id),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const notifications = data?.notifications ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-category'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-category'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => notificationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-category'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const totalUnread = ALL_CATEGORIES.reduce((sum, cat) => sum + ((unreadByCategory as Record<string, number>)[cat] ?? 0), 0);

  return (
    <div className="font-sans select-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.12)', border: '1px solid rgba(79,209,255,0.2)' }}>
            <Bell className="w-6 h-6 text-[#4FD1FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {totalUnread > 0
                ? `${totalUnread} unread · ${total} total`
                : `${total} notification${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {totalUnread > 0 && (
          <button
            onClick={() => markAllMut.mutate()}
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all"
            style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.2)', color: '#4FD1FF' }}
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2">
        {(enabledCategories || ALL_CATEGORIES).map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = (unreadByCategory as Record<string, number>)[cat] ?? 0;
          if (count === 0 && categoryFilter !== cat) return null;
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(isActive ? '' : cat)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isActive ? `${cfg.color}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? `${cfg.color}40` : 'rgba(255,255,255,0.06)'}`,
                color: isActive ? cfg.color : 'rgba(255,255,255,0.5)',
              }}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {count > 0 && (
                <span
                  className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: cfg.color, color: '#0a1628' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className={INPUT_CLS + ' w-full pl-9'}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
            </button>
          )}
        </div>

        <select
          value={readFilter}
          onChange={e => { setReadFilter(e.target.value as typeof readFilter); setPage(0); }}
          className={INPUT_CLS + ' min-w-[140px]'}
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Notifications list */}
      <div className="rounded-[22px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : isError ? (
          <EmptyState
            icon="⚠️"
            title="Failed to load"
            description="Something went wrong while loading notifications. Please try again."
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications"
            description={search || categoryFilter ? 'No matching notifications' : 'No notifications yet'}
          />
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {notifications.map(n => {
              const cfg = CATEGORY_CONFIG[n.category ?? 'general'] || CATEGORY_CONFIG.general;
              const borderColor = TYPE_COLORS[n.type] || '#4FD1FF';
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-4 px-6 py-4 transition-all hover:bg-[rgba(255,255,255,0.02)] relative"
                  style={{ opacity: n.is_read ? 0.55 : 1 }}
                >
                  {/* Type-colored left border */}
                  <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: borderColor, boxShadow: `0 0 6px ${borderColor}60` }} />

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-4 text-lg"
                    style={{ background: `${cfg.color}18` }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{n.title}</span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#4FD1FF] flex-shrink-0" />}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {n.category && (
                        <span className="text-[10px] font-medium" style={{ color: `${cfg.color}99` }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.is_read && (
                      <button
                        onClick={() => markReadMut.mutate(n.id)}
                        title="Mark as read"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(79,209,255,0.1)]"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMut.mutate(n.id)}
                      title="Delete"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[rgba(239,68,68,0.1)]"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Click link */}
                  {n.link && (
                    <a
                      href={n.link}
                      onClick={e => e.stopPropagation()}
                      className="absolute inset-0 z-0"
                      aria-label="Navigate"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: p === page ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.04)',
                    color: p === page ? '#4FD1FF' : 'rgba(255,255,255,0.5)',
                    border: p === page ? '1px solid rgba(79,209,255,0.3)' : '1px solid transparent',
                  }}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}