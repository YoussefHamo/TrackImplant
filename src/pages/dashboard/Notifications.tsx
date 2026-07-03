import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
  success: CheckCircle,
};

const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
  info: { bg: 'rgba(79,209,255,0.1)', text: '#4FD1FF', icon: 'rgba(79,209,255,0.2)' },
  warning: { bg: 'rgba(255,193,7,0.1)', text: '#FFC107', icon: 'rgba(255,193,7,0.2)' },
  critical: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', icon: 'rgba(239,68,68,0.2)' },
  success: { bg: 'rgba(0,229,168,0.1)', text: '#00E5A8', icon: 'rgba(0,229,168,0.2)' },
};

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.getByUser(user!.id),
    enabled: !!user?.id,
  });

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

  const unread = notifications.filter(n => !n.is_read);

  return (
    <div className="font-sans select-none space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('notifications.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {t('notifications.subtitle', { unread: unread.length, total: notifications.length })}
          </p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllMut.mutate()}
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all"
            style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.2)', color: '#4FD1FF' }}>
            <CheckCheck className="w-4 h-4" />
            {t('notifications.mark_all_read')}
          </button>
        )}
      </div>

      <div className="rounded-[22px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Bell className="w-10 h-10 mb-4" style={{ color: 'rgba(255,255,255,0.12)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('notifications.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {notifications.map(n => {
              const Icon = typeIcons[n.type] || Info;
              const c = typeColors[n.type] || typeColors.info;
              return (
                <div key={n.id}
                  className="flex items-start gap-4 px-6 py-4 transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.02)]"
                  onClick={() => { if (!n.is_read) markOneMut.mutate(n.id); }}
                  style={{ opacity: n.is_read ? 0.6 : 1 }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: c.icon }}>
                    <Icon className="w-5 h-5" style={{ color: c.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{n.title}</span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#4FD1FF] flex-shrink-0" />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{n.message}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  {n.link && (
                    <a href={n.link}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                      {t('notifications.view')}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
