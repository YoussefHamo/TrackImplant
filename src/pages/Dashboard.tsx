import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { useLanguage } from '../context/LanguageContext';
import { financialRecordService } from '../services/financialRecordService';
import { patientService } from '../services/patientService';
import { procedureService } from '../services/procedureService';
import { followUpService } from '../services/followUpService';
import { appointmentService } from '../services/appointmentService';
import { implantInventoryService } from '../services/implantInventoryService';
import { deliveryService } from '../services/deliveryService';
import { branchService } from '../services/branchService';
import { notificationService } from '../services/notificationService';
import { StatSkeleton, Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Heart, Activity, Calendar, Clock, Users,
  ChevronRight, Plus, User, Package, AlertTriangle, Truck,
  ArrowLeftRight, Bell, BarChart3, Search, Stethoscope,
  Syringe, Minus,
  type LucideIcon
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Shared UI primitives
   ═══════════════════════════════════════════════════════════════ */

function StatCard({
  icon: Icon,
  iconBg,
  iconBorder,
  iconColor,
  value,
  label,
  trend,
  trendLabel,
  trendDirection,
  role = 'status',
}: {
  icon: LucideIcon;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  value: string | number;
  label: string;
  trend?: number;
  trendLabel?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  role?: string;
}) {
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColor = trendDirection === 'up' ? 'text-success' : trendDirection === 'down' ? 'text-error' : 'text-on-surface-variant/50';
  return (
    <div className="card-cyber group hover:border-primary/20 transition-all duration-300" role={role} aria-label={`${label}: ${value}`}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
          style={{ background: iconBg, border: iconBorder }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-[11px] font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {trend > 0 ? '+' : ''}{trend}%
            {trendLabel && <span className="hidden sm:inline ml-0.5 opacity-60">{trendLabel}</span>}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white font-mono tracking-tight">{value}</div>
      <div className="text-xs mt-1 text-on-surface-variant/60">{label}</div>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  onClick,
  color = '#4FD1FF',
  bgColor = 'rgba(79,209,255,0.08)',
  borderColor = 'rgba(79,209,255,0.12)',
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  color?: string;
  bgColor?: string;
  borderColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="card-cyber flex flex-col items-center justify-center gap-2.5 py-5 px-3 cursor-pointer
        hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 min-h-[88px]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ background: bgColor, borderColor }}
    >
      <Icon className="w-5 h-5" style={{ color }} />
      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {label}
      </span>
    </button>
  );
}

function NotificationItem({ notification }: { notification: any }) {
  const borderColor =
    notification.type === 'critical' ? '#F43F5E'
    : notification.type === 'warning' ? '#FBBF24'
    : notification.type === 'success' ? '#34D399'
    : '#4FD1FF';

  const dotColor = notification.is_read ? 'rgba(255,255,255,0.15)' : borderColor;

  return (
    <div
      className="flex items-start gap-3 p-3.5 rounded-xl transition-all duration-150"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: dotColor, boxShadow: !notification.is_read ? `0 0 8px ${dotColor}` : 'none' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{notification.title || 'Notification'}</div>
        <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{notification.message || ''}</div>
        <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  dateLabel,
  primaryCta,
}: {
  title: string;
  subtitle?: string;
  dateLabel?: string;
  primaryCta?: { label: string; onClick: () => void; icon?: LucideIcon };
}) {
  const CtaIcon = primaryCta?.icon || Plus;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{title}</h1>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary-container border border-primary/10 text-primary">
            <Calendar className="w-3 h-3" />
            {today}
          </div>
        </div>
        {subtitle && (
          <p className="text-sm text-on-surface-variant/60">{subtitle}</p>
        )}
        {dateLabel && (
          <p className="text-xs text-on-surface-variant/40">{dateLabel}</p>
        )}
      </div>
      {primaryCta && (
        <button
          onClick={primaryCta.onClick}
          className="btn-primary btn-sm md:btn-primary"
          aria-label={primaryCta.label}
        >
          <CtaIcon className="w-4 h-4" />
          <span>{primaryCta.label}</span>
        </button>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs mt-0.5 text-on-surface-variant/50">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          aria-label={action.label}
        >
          {action.label} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'xs' }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    Surgery: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF', dot: '#4FD1FF' },
    Healing: { bg: 'rgba(52,211,153,0.12)', text: '#34D399', dot: '#34D399' },
    Consultation: { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.3)' },
    Completed: { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF', dot: '#7C5CFF' },
    scheduled: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF', dot: '#4FD1FF' },
    checked_in: { bg: 'rgba(251,191,36,0.12)', text: '#FBBF24', dot: '#FBBF24' },
    working: { bg: 'rgba(156,39,176,0.12)', text: '#9C27B0', dot: '#9C27B0' },
    completed: { bg: 'rgba(76,175,80,0.12)', text: '#4CAF50', dot: '#4CAF50' },
    no_show: { bg: 'rgba(244,67,54,0.12)', text: '#F44336', dot: '#F44336' },
    cancelled: { bg: 'rgba(158,158,158,0.12)', text: '#9E9E9E', dot: '#9E9E9E' },
    postponed: { bg: 'rgba(255,193,7,0.12)', text: '#FFC107', dot: '#FFC107' },
    OnTrack: { bg: 'rgba(52,211,153,0.12)', text: '#34D399', dot: '#34D399' },
    Critical: { bg: 'rgba(244,67,54,0.12)', text: '#F44336', dot: '#F44336' },
    Failure: { bg: 'rgba(239,68,68,0.2)', text: '#ef4444', dot: '#ef4444' },
  };
  const c = colors[status] || { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.4)', dot: 'rgba(255,255,255,0.2)' };
  const cls = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 ${cls} rounded-full font-semibold tracking-wide`}
      style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
      {status}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const cls = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <div className={`${cls} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{ background: 'rgba(79,209,255,0.12)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
      {initials}
    </div>
  );
}

/* ── Appointment Status Counts ── */
const STATUS_LABELS = [
  { label: 'Waiting', key: 'scheduled', color: '#4FD1FF' },
  { label: 'Checked In', key: 'checked_in', color: '#FF9800' },
  { label: 'Working', key: 'working', color: '#9C27B0' },
  { label: 'Completed', key: 'completed', color: '#4CAF50' },
  { label: 'No Shows', key: 'no_show', color: '#F44336' },
];

/* ════════════════════════════════════════════
   RECEPTION DASHBOARD
   ════════════════════════════════════════════ */
function ReceptionDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const navigate = useNavigate();
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [since] = useState(() => Date.now() - 24 * 60 * 60 * 1000);
  const [now] = useState(() => Date.now());

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });
  const { data: allAppointments = [] } = useQuery({
    queryKey: ['appointments', activeBranchId],
    queryFn: () => appointmentService.getAll(activeBranchId),
  });
  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures', activeBranchId],
    queryFn: () => procedureService.getAll(activeBranchId),
  });
  const { data: analytics } = useQuery({
    queryKey: ['financial-analytics', activeBranchId],
    queryFn: () => financialRecordService.getAnalytics(activeBranchId),
  });
  const { data: followUps = [] } = useQuery({
    queryKey: ['follow-ups-all'],
    queryFn: () => followUpService.getAll(),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-reception', user?.id],
    queryFn: () => user?.id ? notificationService.getByUser(user.id, 10) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const clientsLast24h = useMemo(() => {
    const _since = new Date(since);
    return patients.filter(p => p.created_at && new Date(p.created_at) >= _since);
  }, [patients, since]);

  const todayPatients = useMemo(() => {
    return patients.filter(p => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at).toISOString().split('T')[0];
      return d === today;
    });
  }, [patients, today]);

  const todayAppointments = useMemo(() => {
    return allAppointments.filter(a => {
      const d = new Date(a.appointment_date).toISOString().split('T')[0];
      return d === today;
    });
  }, [allAppointments, today]);

  const nextAppointments = useMemo(() => {
    const _now = new Date(now);
    return allAppointments
      .filter(a => new Date(a.appointment_date) >= _now)
      .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
      .slice(0, 5);
  }, [allAppointments, now]);

  const todayProcedures = useMemo(() => {
    return procedures.filter(p => {
      const d = new Date(p.procedure_date).toISOString().split('T')[0];
      return d === today;
    });
  }, [procedures, today]);

  const todayRevenue = useMemo(() => {
    const a = analytics;
    if (!a) return 0;
    return a.monthlyCollected || 0;
  }, [analytics]);

  const outstandingPayments = analytics?.totalPending || 0;

  const todayFollowUps = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return (followUps || []).filter(f => f.created_at && new Date(f.created_at).toISOString().split('T')[0] === todayStr);
  }, [followUps]);

  const patientStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { scheduled: 0, checked_in: 0, working: 0, completed: 0, no_show: 0 };
    allAppointments.forEach(a => {
      const d = new Date(a.appointment_date).toISOString().split('T')[0];
      if (d === today && counts.hasOwnProperty(a.status)) counts[a.status]++;
    });
    return counts;
  }, [allAppointments, today]);

  const quickActions = [
    { icon: User, label: 'Quick Patient Reg.', onClick: () => navigate('/dashboard/patients'), color: '#4FD1FF', bg: 'rgba(79,209,255,0.06)', border: 'rgba(79,209,255,0.1)' },
    { icon: Calendar, label: 'New Appointment', onClick: () => navigate('/dashboard/schedule'), color: '#FBBF24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.1)' },
    { icon: Users, label: 'Find Patient', onClick: () => navigate('/dashboard/patients'), color: '#34D399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.1)' },
    { icon: Clock, label: 'View Schedule', onClick: () => navigate('/dashboard/schedule'), color: '#7C5CFF', bg: 'rgba(124,92,255,0.06)', border: 'rgba(124,92,255,0.1)' },
    { icon: Bell, label: 'Notifications', onClick: () => navigate('/dashboard/logs'), color: '#4FD1FF', bg: 'rgba(79,209,255,0.06)', border: 'rgba(79,209,255,0.1)' },
    { icon: BarChart3, label: 'Reports', onClick: () => navigate('/dashboard/reports'), color: '#FBBF24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.1)' },
  ];

  return (
    <div className="space-y-8 font-mono select-auto">
      <PageHeader
        title={t('dashboard.reception_title')}
        subtitle={`${patients.length} total patients · ${todayAppointments.length} appointments today`}
        primaryCta={{ label: t('nav.add_patient'), onClick: () => navigate('/dashboard/patients'), icon: Plus }}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {quickActions.map((a, i) => (
          <QuickActionCard key={i} {...a} />
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users} value={todayPatients.length} label={t('dashboard.stat_new_patients')}
          iconBg="rgba(79,209,255,0.1)" iconBorder="1px solid rgba(79,209,255,0.12)" iconColor="#4FD1FF"
        />
        <StatCard
          icon={Calendar} value={todayAppointments.length} label={t('dashboard.stat_appointments')}
          iconBg="rgba(251,191,36,0.1)" iconBorder="1px solid rgba(251,191,36,0.12)" iconColor="#FBBF24"
        />
        <StatCard
          icon={Activity} value={todayProcedures.length} label={t('dashboard.stat_procedures')}
          iconBg="rgba(124,92,255,0.1)" iconBorder="1px solid rgba(124,92,255,0.12)" iconColor="#7C5CFF"
        />
        <StatCard
          icon={DollarSign} value={`$${todayRevenue.toLocaleString()}`} label={t('dashboard.stat_revenue')}
          iconBg="rgba(52,211,153,0.1)" iconBorder="1px solid rgba(52,211,153,0.12)" iconColor="#34D399"
        />
      </div>

      {/* Patients Last 24h */}
      <div className="card-cyber">
        <SectionHeader
          title={t('dashboard.last_24h_title')}
          subtitle={`${clientsLast24h.length} new patients`}
          action={{ label: t('dashboard.view_all'), onClick: () => navigate('/dashboard/patients') }}
        />
        {clientsLast24h.length === 0 ? (
          <EmptyState title="No new patients" description="No patients registered in the last 24 hours." />
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {clientsLast24h.slice(0, 8).map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/dashboard/patients/${p.id}/profile`)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl cursor-pointer transition-all
                  hover:bg-[rgba(79,209,255,0.06)] active:scale-[0.98]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                aria-label={`View patient ${p.full_name}`}
              >
                <Avatar name={p.full_name} size="sm" />
                <span className="text-[11px] font-medium text-white whitespace-nowrap max-w-[72px] truncate">{p.full_name}</span>
                <span className="text-[9px] text-on-surface-variant/50">
                  {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Appointments + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <div className="lg:col-span-2 card-cyber">
          <SectionHeader
            title={t('dashboard.today_appointments')}
            subtitle={t('dashboard.appointments_scheduled', { count: todayAppointments.length })}
            action={{ label: t('dashboard.view_all'), onClick: () => navigate('/dashboard/schedule') }}
          />
          {todayAppointments.length === 0 ? (
            <EmptyState title="No appointments today" description="Schedule the first appointment to get started." action={{ label: 'New Appointment', onClick: () => navigate('/dashboard/schedule') }} />
          ) : (
            <div className="space-y-2">
              {todayAppointments.slice(0, 6).map(a => {
                const patient = patients.find(p => p.id === a.patient_id);
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/dashboard/patients/${a.patient_id}/profile`)}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all
                      hover:bg-[rgba(255,255,255,0.03)] active:scale-[0.99]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                    aria-label={`Appointment with ${patient?.full_name || 'Unknown'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={patient?.full_name || '??'} />
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">{patient?.full_name || t('common.unknown')}</div>
                        <div className="text-[11px] text-on-surface-variant/50">
                          {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={a.status} size="xs" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card-cyber">
            <SectionHeader title={t('dashboard.quick_actions')} />
            <div className="space-y-2">
              <button onClick={() => navigate('/dashboard/patients')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-primary-container"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#4FD1FF' }}
                aria-label="Find patient">
                <Search className="w-4 h-4" /> {t('dashboard.find_patient')}
              </button>
              <button onClick={() => navigate('/dashboard/schedule')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(251,191,36,0.06)]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#FBBF24' }}
                aria-label="Schedule appointment">
                <Calendar className="w-4 h-4" /> {t('dashboard.schedule_appointment')}
              </button>
              <button onClick={() => navigate('/dashboard/inventory')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-primary-container"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#4FD1FF' }}
                aria-label="View inventory">
                <Package className="w-4 h-4" /> {t('nav.inventory')}
              </button>
            </div>
          </div>

          {/* Next Appointments */}
          <div className="card-cyber">
            <SectionHeader title={t('dashboard.upcoming')} />
            {nextAppointments.length === 0 ? (
              <p className="text-sm text-on-surface-variant/40 text-center py-6">{t('dashboard.no_upcoming')}</p>
            ) : (
              <div className="space-y-2">
                {nextAppointments.map(a => {
                  const patient = patients.find(p => p.id === a.patient_id);
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex flex-col items-center min-w-[44px]">
                        <span className="text-[10px] font-bold text-primary">
                          {new Date(a.appointment_date).toLocaleDateString([], { weekday: 'short' })}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/50">
                          {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-xs text-white truncate flex-1">{patient?.full_name || t('common.unknown')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Status Widget */}
      <div className="card-cyber">
        <SectionHeader title="Patient Status" subtitle="Today's appointment breakdown" />
        <div className="grid grid-cols-5 gap-3">
          {STATUS_LABELS.map(s => (
            <div key={s.key} className="text-center p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
              <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{patientStatusCounts[s.key]}</div>
              <div className="text-[10px] mt-1 uppercase tracking-widest text-on-surface-variant/50">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Outstanding Payments */}
        <div className="card-cyber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <DollarSign className="w-5 h-5 text-[#FBBF24]" />
            </div>
            <h3 className="text-base font-semibold text-white">Outstanding Payments</h3>
          </div>
          <div className="text-3xl font-bold text-[#FBBF24] font-mono">${outstandingPayments.toLocaleString()}</div>
          <div className="text-xs mt-1 text-on-surface-variant/50">Total pending balance</div>
          <button onClick={() => navigate('/dashboard/payments')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-secondary btn-sm" aria-label="View payments">
            View Payments
          </button>
        </div>

        {/* Today's Follow-ups */}
        <div className="card-cyber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.12)' }}>
              <Heart className="w-5 h-5 text-[#34D399]" />
            </div>
            <h3 className="text-base font-semibold text-white">Today's Follow-ups</h3>
          </div>
          {todayFollowUps.length === 0 ? (
            <p className="text-sm text-on-surface-variant/40 text-center py-8">No follow-ups scheduled today</p>
          ) : (
            <div className="space-y-2">
              {todayFollowUps.slice(0, 5).map(f => {
                const patient = patients.find(p => p.id === f.patient_id);
                return (
                  <button
                    key={f.id}
                    onClick={() => navigate(`/dashboard/patients/${f.patient_id}/profile`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all
                      hover:bg-[rgba(255,255,255,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                    aria-label={`Follow-up for ${patient?.full_name || 'Unknown'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={patient?.full_name || '??'} size="sm" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">{patient?.full_name || 'Unknown'}</div>
                        <div className="text-[10px] text-on-surface-variant/50">
                          Health: {f.health_score ?? '—'} · Pain: {f.pain_level ?? '—'}/10
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={f.healing_status || 'Unknown'} size="xs" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card-cyber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.12)' }}>
              <Bell className="w-5 h-5 text-[#7C5CFF]" />
            </div>
            <h3 className="text-base font-semibold text-white">Notifications</h3>
            {notifications.some(n => !n.is_read) && (
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(79,209,255,0.6)]" />
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-on-surface-variant/40 text-center py-8">No new notifications</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {notifications.slice(0, 5).map(n => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/logs')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-ghost btn-sm" aria-label="View all notifications">
            View All Notifications
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   CLINICAL DASHBOARD (Admin)
   ════════════════════════════════════════════ */
function ClinicalDashboard() {
  const { t } = useLanguage();
  const { activeBranchId, currentBranchName, branchLoading } = useBranch();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics', activeBranchId],
    queryFn: async () => {
      const [invStats, patientStats, procStats, followStats, revenueData, procedures, appointments, insuranceRevenue, cashRevenue] = await Promise.all([
        financialRecordService.getAnalytics(activeBranchId).catch(() => ({ totalRevenue: 0, totalPending: 0, monthlyCollected: 0, invoiceCount: 0, paidCount: 0, pendingCount: 0, partialCount: 0, monthlyGrowth: 0 })),
        patientService.getStats().catch(() => ({ total: 0, newThisMonth: 0 })),
        procedureService.getStats(activeBranchId).catch(() => ({ total: 0, byStatus: {} })),
        followUpService.getStats().catch(() => ({ total: 0, critical: 0, avgPain: 0, avgHealth: 0 })),
        financialRecordService.getDailyRevenue(7, activeBranchId).catch(() => []),
        procedureService.getAll(activeBranchId).catch(() => []),
        appointmentService.getAll(activeBranchId).catch(() => []),
        financialRecordService.getInsuranceRevenue().catch(() => 0),
        financialRecordService.getCashRevenue().catch(() => 0),
      ]);
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const next24h = appointments.filter(a => {
        const d = new Date(a.appointment_date);
        return d >= now && d <= tomorrow;
      });
      return { invStats, patientStats, procStats, followStats, revenueData, procedures, next24h, insuranceRevenue, cashRevenue };
    },
    refetchInterval: 1000 * 30,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 font-mono select-auto">
        <PageHeader title={t('dashboard.clinical_title')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-cyber">
            <TableSkeleton rows={4} />
          </div>
          <div className="space-y-6">
            <div className="card-cyber">
              <Skeleton className="h-5 w-24 mb-5" />
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)}
            </div>
            <div className="card-cyber">
              <Skeleton className="h-5 w-20 mb-4" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { invStats, patientStats, procStats, followStats, revenueData, procedures, next24h, insuranceRevenue = 0, cashRevenue = 0 } = data!;

  const monthlyGrowth = invStats.monthlyGrowth ?? 0;

  return (
    <div className="space-y-8 font-mono select-auto">
      <PageHeader
        title={t('dashboard.clinical_title')}
        subtitle={branchLoading ? '' : `${currentBranchName || 'All Branches'} · ${patientStats.total > 0 ? t('dashboard.clinical_subtitle', { count: patientStats.total }) : t('dashboard.clinical_subtitle_empty')}`}
        primaryCta={{ label: 'New Procedure', onClick: () => navigate('/dashboard/cases'), icon: Plus }}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <QuickActionCard icon={User} label="New Patient" onClick={() => navigate('/dashboard/patients')} color="#4FD1FF" bgColor="rgba(79,209,255,0.06)" borderColor="rgba(79,209,255,0.1)" />
        <QuickActionCard icon={Calendar} label="Appointment" onClick={() => navigate('/dashboard/schedule')} color="#FBBF24" bgColor="rgba(251,191,36,0.06)" borderColor="rgba(251,191,36,0.1)" />
        <QuickActionCard icon={Stethoscope} label="Procedure" onClick={() => navigate('/dashboard/cases')} color="#34D399" bgColor="rgba(52,211,153,0.06)" borderColor="rgba(52,211,153,0.1)" />
        <QuickActionCard icon={BarChart3} label="Reports" onClick={() => navigate('/dashboard/reports')} color="#7C5CFF" bgColor="rgba(124,92,255,0.06)" borderColor="rgba(124,92,255,0.1)" />
        <QuickActionCard icon={Package} label="Inventory" onClick={() => navigate('/dashboard/inventory')} color="#4FD1FF" bgColor="rgba(79,209,255,0.06)" borderColor="rgba(79,209,255,0.1)" />
        <QuickActionCard icon={Clock} label="Schedule" onClick={() => navigate('/dashboard/schedule')} color="#FBBF24" bgColor="rgba(251,191,36,0.06)" borderColor="rgba(251,191,36,0.1)" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Users} value={patientStats.total || 0} label={t('dashboard.stat_total_patients')}
          trend={patientStats.newThisMonth > 0 ? patientStats.newThisMonth : undefined}
          trendDirection={patientStats.newThisMonth > 0 ? 'up' : undefined}
          trendLabel="new this month"
          iconBg="rgba(79,209,255,0.1)" iconBorder="1px solid rgba(79,209,255,0.12)" iconColor="#4FD1FF"
        />
        <StatCard
          icon={Heart} value={followStats.total || 0} label={t('dashboard.stat_follow_ups')}
          trend={followStats.critical > 0 ? followStats.critical : undefined}
          trendDirection={followStats.critical > 0 ? 'down' : 'up'}
          trendLabel={followStats.critical > 0 ? 'critical' : t('dashboard.all_stable')}
          iconBg="rgba(251,191,36,0.1)" iconBorder="1px solid rgba(251,191,36,0.12)" iconColor="#FBBF24"
        />
        <StatCard
          icon={DollarSign} value={`$${invStats.totalRevenue.toLocaleString()}`} label={t('dashboard.stat_total_collected')}
          trend={monthlyGrowth}
          trendDirection={monthlyGrowth >= 0 ? 'up' : 'down'}
          trendLabel="MTD"
          iconBg="rgba(52,211,153,0.1)" iconBorder="1px solid rgba(52,211,153,0.12)" iconColor="#34D399"
        />
        <StatCard
          icon={Heart} value={`$${insuranceRevenue.toLocaleString()}`} label="Insurance Revenue"
          iconBg="rgba(255,107,157,0.1)" iconBorder="1px solid rgba(255,107,157,0.12)" iconColor="#ff6b9d"
        />
        <StatCard
          icon={Activity} value={procStats.total || 0} label={t('dashboard.stat_total_procedures')}
          iconBg="rgba(124,92,255,0.1)" iconBorder="1px solid rgba(124,92,255,0.12)" iconColor="#7C5CFF"
        />
      </div>

      {/* Procedure Stats Chips */}
      {procStats.total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(Object.entries(procStats.byStatus) as [string, number][]).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(79,209,255,0.08)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
              {status}: <strong>{count}</strong>
            </span>
          ))}
          <span className="text-xs text-on-surface-variant/40 ml-1">Cash: ${cashRevenue.toLocaleString()}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Procedures */}
        <div className="lg:col-span-2 card-cyber">
          <SectionHeader
            title={t('dashboard.recent_procedures')}
            subtitle={procedures.length > 0 ? `${procedures.length} total` : t('dashboard.no_procedures_recorded')}
            action={{ label: 'View All', onClick: () => navigate('/dashboard/cases') }}
          />
          {procedures.length === 0 ? (
            <EmptyState title="No procedures" description="Record your first procedure to populate this view." action={{ label: 'New Procedure', onClick: () => navigate('/dashboard/cases') }} />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="flex text-[11px] font-semibold uppercase tracking-wider pb-3 border-b border-white/5 text-on-surface-variant/40">
                  <div className="flex-[2]">Doctor</div>
                  <div className="flex-[1.5]">Procedure</div>
                  <div className="flex-[1]">Date</div>
                  <div className="flex-[1]">Status</div>
                  <div className="flex-[0.5] text-right">Tooth</div>
                </div>
                <div className="divide-y divide-white/5">
                  {procedures.slice(0, 6).map(p => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/dashboard/cases?patient=${p.patient_id}`)}
                      className="w-full flex items-center py-3.5 transition-all duration-150 hover:bg-white/2 rounded-lg px-1 -mx-1
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label={`Procedure ${p.procedure_name}`}
                    >
                      <div className="flex-[2] flex items-center gap-3">
                        <Avatar name={p.doctor_name || 'Dr.'} />
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">{p.doctor_name || 'Dr.'}</div>
                          <div className="text-[11px] text-on-surface-variant/50">#{(p.id || '').slice(0, 6).toUpperCase()}</div>
                        </div>
                      </div>
                      <div className="flex-[1.5] text-sm text-on-surface/80">{p.procedure_name}</div>
                      <div className="flex-[1] text-sm text-on-surface-variant/60">{new Date(p.procedure_date).toLocaleDateString()}</div>
                      <div className="flex-[1]"><StatusBadge status={p.status} size="xs" /></div>
                      <div className="flex-[0.5] text-right text-sm text-on-surface-variant/60">{p.tooth_number || '—'}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Next 24h Appointments */}
          <div className="card-cyber">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">{t('dashboard.next_24h')}</h3>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary-container border border-primary/10 text-primary">
                {next24h.length} appointments
              </span>
            </div>
            {next24h.length === 0 ? (
              <p className="text-sm text-on-surface-variant/40 text-center py-8">{t('dashboard.no_appointments_24h')}</p>
            ) : (
              <div className="space-y-3">
                {next24h.slice(0, 5).map(apt => (
                  <div key={apt.id} className="flex items-start gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-white/3"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                      <div className="text-[11px] font-semibold text-primary">
                        {new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="w-[1px] h-8 bg-white/5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{apt.patient_id ? `Patient #${apt.patient_id.slice(0, 6)}` : t('common.unknown')}</div>
                      <div className="text-[11px] mt-0.5 text-on-surface-variant/50">{apt.status}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{
                      background: apt.status === 'confirmed' || apt.status === 'scheduled' ? '#34D399' : 'rgba(255,255,255,0.15)',
                      boxShadow: apt.status === 'confirmed' || apt.status === 'scheduled' ? '0 0 6px rgba(52,211,153,0.6)' : 'none',
                    }} />
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => navigate('/dashboard/schedule')}
              className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-secondary btn-sm" aria-label="View full calendar">
              {t('dashboard.view_full_calendar')}
            </button>
          </div>

          {/* Revenue Trend */}
          <div className="card-cyber">
            <SectionHeader
              title={t('dashboard.revenue_trend')}
              subtitle={`$${invStats.monthlyCollected.toLocaleString()} MTD`}
            />
            {revenueData.length === 0 || revenueData.every(d => d.revenue === 0) ? (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-white/15" />
                  <p className="text-sm text-on-surface-variant/40">{t('dashboard.chart_no_data')}</p>
                </div>
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={revenueData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4FD1FF" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4FD1FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(8,15,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#4FD1FF" strokeWidth={2} fillOpacity={1} fill="url(#revenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Follow-ups Stats Summary */}
      {followStats.total > 0 && (
        <div className="card-cyber">
          <SectionHeader title="Follow-up Analytics" subtitle="Current patient healing status" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.1)' }}>
              <div className="text-xs text-on-surface-variant/50">Average Health</div>
              <div className="text-xl font-bold text-[#34D399] font-mono">{Math.round(followStats.avgHealth)}%</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.1)' }}>
              <div className="text-xs text-on-surface-variant/50">Average Pain</div>
              <div className="text-xl font-bold text-[#F44336] font-mono">{followStats.avgPain.toFixed(1)}/10</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)' }}>
              <div className="text-xs text-on-surface-variant/50">Critical Cases</div>
              <div className="text-xl font-bold text-[#FBBF24] font-mono">{followStats.critical}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   MANAGER DASHBOARD
   ════════════════════════════════════════════ */
function ManagerDashboard() {
  const { user } = useAuth();
  const { activeBranchId, currentBranchName } = useBranch();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: stockRequests = [] } = useQuery({
    queryKey: ['stock-requests'],
    queryFn: () => implantInventoryService.getStockRequests(),
  });
  const { data: branchInventory = [] } = useQuery({
    queryKey: ['branch-inventory-all'],
    queryFn: () => branchService.getAllBranchInventory(),
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => deliveryService.getDeliveries(),
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', activeBranchId],
    queryFn: () => appointmentService.getAll(activeBranchId),
  });
  const { data: analytics } = useQuery({
    queryKey: ['analytics', activeBranchId],
    queryFn: () => financialRecordService.getAnalytics(activeBranchId),
  });
  const { data: allProcedures = [] } = useQuery({
    queryKey: ['procedures-all', activeBranchId],
    queryFn: () => procedureService.getAll(activeBranchId),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-manager', user?.id],
    queryFn: () => user?.id ? notificationService.getByUser(user.id, 10) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const pendingRequests = stockRequests.filter(r => r.status === 'pending');
  const lowStockItems = branchInventory.filter(i => (i.quantity - i.reserved) <= 3);
  const todayAppts = appointments.filter(a => new Date(a.appointment_date).toISOString().split('T')[0] === today);

  const todayProcedures = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allProcedures.filter(p => p.procedure_date && new Date(p.procedure_date).toISOString().split('T')[0] === todayStr);
  }, [allProcedures]);

  const waitingPatients = todayAppts.filter(a => a.status === 'scheduled').length;
  const checkedInPatients = todayAppts.filter(a => a.status === 'checked_in').length;
  const workingPatients = todayAppts.filter(a => a.status === 'working').length;
  const completedToday = todayAppts.filter(a => a.status === 'completed').length;
  const noShows = todayAppts.filter(a => a.status === 'no_show').length;

  const branchRevenue = analytics?.totalRevenue || 0;

  const inventoryValue = useMemo(() => {
    const avgPrice = 150;
    return branchInventory.reduce((sum, i) => sum + (i.quantity * avgPrice), 0);
  }, [branchInventory]);

  const doctorPerformance = useMemo(() => {
    const docCounts: Record<string, { name: string; count: number }> = {};
    allProcedures.forEach(p => {
      if (p.doctor_name) {
        if (!docCounts[p.doctor_name]) docCounts[p.doctor_name] = { name: p.doctor_name, count: 0 };
        docCounts[p.doctor_name].count++;
      }
    });
    return Object.values(docCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [allProcedures]);

  return (
    <div className="space-y-8 font-mono select-auto">
      <PageHeader
        title="Manager Dashboard"
        subtitle={currentBranchName}
        primaryCta={{ label: 'New Appointment', onClick: () => navigate('/dashboard/schedule'), icon: Plus }}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickActionCard icon={Calendar} label="New Appointment" onClick={() => navigate('/dashboard/schedule')} color="#4FD1FF" bgColor="rgba(79,209,255,0.06)" borderColor="rgba(79,209,255,0.1)" />
        <QuickActionCard icon={Package} label="View Inventory" onClick={() => navigate('/dashboard/inventory')} color="#34D399" bgColor="rgba(52,211,153,0.06)" borderColor="rgba(52,211,153,0.1)" />
        <QuickActionCard icon={BarChart3} label="Reports" onClick={() => navigate('/dashboard/reports')} color="#7C5CFF" bgColor="rgba(124,92,255,0.06)" borderColor="rgba(124,92,255,0.1)" />
        <QuickActionCard icon={ArrowLeftRight} label="Stock Request" onClick={() => navigate('/dashboard/inventory?tab=requests')} color="#FBBF24" bgColor="rgba(251,191,36,0.06)" borderColor="rgba(251,191,36,0.1)" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock} value={pendingRequests.length} label="Pending Stock Requests"
          iconBg="rgba(251,191,36,0.1)" iconBorder="1px solid rgba(251,191,36,0.12)" iconColor="#FBBF24"
          trend={pendingRequests.length > 0 ? pendingRequests.length : undefined}
          trendDirection={pendingRequests.length > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          icon={AlertTriangle} value={lowStockItems.length} label="Low Stock Items"
          iconBg="rgba(244,67,54,0.1)" iconBorder="1px solid rgba(244,67,54,0.12)" iconColor="#F44336"
          trend={lowStockItems.length > 0 ? lowStockItems.length : undefined}
          trendDirection={lowStockItems.length > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          icon={Truck} value={deliveries.length} label="Total Deliveries"
          iconBg="rgba(79,209,255,0.1)" iconBorder="1px solid rgba(79,209,255,0.12)" iconColor="#4FD1FF"
        />
        <StatCard
          icon={Calendar} value={todayAppts.length} label="Today's Appointments"
          iconBg="rgba(52,211,153,0.1)" iconBorder="1px solid rgba(52,211,153,0.12)" iconColor="#34D399"
        />
      </div>

      {/* Today's Operational Stats */}
      <div className="card-cyber">
        <SectionHeader title="Today's Operations" subtitle={`${todayAppts.length} appointments today`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Procedures', value: todayProcedures.length, color: '#4FD1FF' },
            { label: 'Waiting', value: waitingPatients, color: '#4FD1FF' },
            { label: 'Checked In', value: checkedInPatients, color: '#FF9800' },
            { label: 'Working', value: workingPatients, color: '#9C27B0' },
            { label: 'Completed', value: completedToday, color: '#4CAF50' },
            { label: 'No Shows', value: noShows, color: '#F44336' },
          ].map(s => (
            <div key={s.label} className="text-center p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
              <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] mt-1 uppercase tracking-widest text-on-surface-variant/50">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Appointment Breakdown */}
      <div className="card-cyber">
        <SectionHeader title="Appointment Status Breakdown" />
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {[
            { label: 'Scheduled', key: 'scheduled', color: '#4FD1FF' },
            { label: 'Checked In', key: 'checked_in', color: '#FF9800' },
            { label: 'Working', key: 'working', color: '#9C27B0' },
            { label: 'Completed', key: 'completed', color: '#4CAF50' },
            { label: 'No Show', key: 'no_show', color: '#F44336' },
            { label: 'Postponed', key: 'postponed', color: '#FBBF24' },
            { label: 'Cancelled', key: 'cancelled', color: '#9E9E9E' },
          ].map(s => {
            const count = todayAppts.filter(a => a.status === s.key).length;
            return (
              <div key={s.key} className="text-center p-3 rounded-xl transition-all hover:scale-[1.02]"
                style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{count}</div>
                <div className="text-[9px] mt-0.5 uppercase tracking-widest text-on-surface-variant/50">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 3-col Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Stock Requests */}
        <div className="card-cyber">
          <SectionHeader
            title="Pending Stock Requests"
            subtitle={`${pendingRequests.length} pending`}
            action={pendingRequests.length > 0 ? { label: 'Review All', onClick: () => navigate('/dashboard/inventory?tab=requests') } : undefined}
          />
          {pendingRequests.length === 0 ? (
            <EmptyState title="All clear" description="No pending stock requests." />
          ) : (
            <div className="space-y-2">
              {pendingRequests.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">{r.item_name}</div>
                    <div className="text-[11px] text-on-surface-variant/50">Qty: {r.quantity}</div>
                  </div>
                  <button onClick={() => navigate('/dashboard/inventory?tab=requests')}
                    className="btn-xs rounded-lg font-semibold"
                    style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}
                    aria-label="Review request">Review</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/inventory')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-ghost btn-sm" aria-label="View all inventory">
            View All Inventory
          </button>
        </div>

        {/* Low Stock Alerts */}
        <div className="card-cyber">
          <SectionHeader
            title="Low Stock Alerts"
            subtitle={`${lowStockItems.length} items low`}
          />
          {lowStockItems.length === 0 ? (
            <EmptyState title="Well-stocked" description="All items have sufficient quantity." />
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">{item.item_name}</div>
                    <div className="text-[11px] text-on-surface-variant/50">{item.branch_name}</div>
                  </div>
                  <span className="text-sm font-bold text-[#F44336] font-mono">{item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card-cyber">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Notifications</h3>
            <Bell className="w-4 h-4 text-on-surface-variant/40" />
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-on-surface-variant/40 text-center py-8">No notifications yet</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {notifications.slice(0, 6).map(n => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom 2-col: Branch Finances + Doctor Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Financial Overview */}
        <div className="card-cyber">
          <SectionHeader title="Branch Financial Overview" />
          <div className="space-y-4">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-[#34D399]" />
                <span className="text-xs text-on-surface-variant/50">Branch Revenue</span>
              </div>
              <div className="text-2xl font-bold text-[#34D399] font-mono">${branchRevenue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-[#4FD1FF]" />
                <span className="text-xs text-on-surface-variant/50">Estimated Inventory Value</span>
              </div>
              <div className="text-2xl font-bold text-[#4FD1FF] font-mono">${inventoryValue.toLocaleString()}</div>
            </div>
            <p className="text-[10px] text-on-surface-variant/30 italic">* Estimated at avg. $150/unit. Actual cost may vary.</p>
          </div>
        </div>

        {/* Doctor Performance */}
        <div className="card-cyber">
          <SectionHeader
            title="Doctor Performance"
            subtitle="Top doctors by procedure count"
            action={{ label: 'View All', onClick: () => navigate('/dashboard/cases') }}
          />
          {doctorPerformance.length === 0 ? (
            <EmptyState title="No data" description="No procedure data yet for this branch." />
          ) : (
            <div className="space-y-2">
              {doctorPerformance.map((doc, i) => (
                <div key={doc.name} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: i < 3 ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.05)', color: i < 3 ? '#4FD1FF' : 'rgba(255,255,255,0.4)' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-white">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (doc.count / Math.max(...doctorPerformance.map(d => d.count))) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-primary font-mono">{doc.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   DOCTOR DASHBOARD
   ════════════════════════════════════════════ */
function DoctorDashboard() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: doctorAppointments = [] } = useQuery({
    queryKey: ['doctor-appointments', user?.id, activeBranchId],
    queryFn: () => appointmentService.getByDoctor(user!.id, activeBranchId),
    enabled: !!user?.id,
  });
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['doctor-upcoming', user?.id],
    queryFn: () => appointmentService.getUpcomingByDoctor(user!.id, 5),
    enabled: !!user?.id,
  });
  const { data: doctorProcedures = [] } = useQuery({
    queryKey: ['doctor-procedures', user?.id, activeBranchId],
    queryFn: () => procedureService.getByDoctor(user!.id, activeBranchId),
    enabled: !!user?.id,
  });
  const { data: allFollowUps = [] } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => followUpService.getAll(),
    enabled: !!user?.id,
  });
  const { data: doctorRevenue } = useQuery({
    queryKey: ['doctor-revenue', user?.id],
    queryFn: () => procedureService.getRevenueByDoctor(user!.id),
    enabled: !!user?.id,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-doctor', user?.id],
    queryFn: () => user?.id ? notificationService.getByUser(user.id, 10) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const todayAppts = useMemo(() => {
    return doctorAppointments.filter(a => {
      const d = new Date(a.appointment_date).toISOString().split('T')[0];
      return d === today;
    });
  }, [doctorAppointments, today]);

  const procStatusMap = useMemo(() => {
    const map: Record<string, number> = {};
    doctorProcedures.forEach(p => {
      const s = p.status || 'Unknown';
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [doctorProcedures]);

  const totalProcedures = doctorProcedures.length;
  const totalAppointments = doctorAppointments.length;

  const myPatientIds = useMemo(() => {
    return [...new Set(doctorProcedures.map(p => p.patient_id))];
  }, [doctorProcedures]);

  const myFollowUps = useMemo(() => {
    const patientSet = new Set(myPatientIds);
    return allFollowUps.filter(f => patientSet.has(f.patient_id));
  }, [allFollowUps, myPatientIds]);

  const criticalFollowUps = useMemo(() => {
    return myFollowUps.filter(f => f.healing_status === 'Failure');
  }, [myFollowUps]);

  const todayProcedures = useMemo(() => {
    return doctorProcedures.filter(p => {
      const d = new Date(p.procedure_date).toISOString().split('T')[0];
      return d === today;
    });
  }, [doctorProcedures, today]);

  const todayProcsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    todayProcedures.forEach(p => {
      const s = p.status || 'Unknown';
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [todayProcedures]);

  const monthlyProcedures = useMemo(() => {
    const months: Record<string, number> = {};
    doctorProcedures.forEach(p => {
      if (p.created_at) {
        const m = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        months[m] = (months[m] || 0) + 1;
      }
    });
    return Object.entries(months).map(([name, count]) => ({ name, count }));
  }, [doctorProcedures]);

  const completedProcedures = doctorProcedures.filter(p => p.status === 'Completed').length;
  const implantSuccessRate = totalProcedures > 0 ? Math.round((completedProcedures / totalProcedures) * 100) : 0;

  return (
    <div className="space-y-8 font-mono select-auto">
      <PageHeader
        title="Doctor Dashboard"
        subtitle={`${totalProcedures} total procedures · ${myPatientIds.length} patients`}
        primaryCta={{ label: 'Schedule Appointment', onClick: () => navigate('/dashboard/schedule'), icon: Plus }}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickActionCard icon={Calendar} label="Schedule Appointment" onClick={() => navigate('/dashboard/schedule')} color="#4FD1FF" bgColor="rgba(79,209,255,0.06)" borderColor="rgba(79,209,255,0.1)" />
        <QuickActionCard icon={Syringe} label="Record Procedure" onClick={() => navigate('/dashboard/cases')} color="#34D399" bgColor="rgba(52,211,153,0.06)" borderColor="rgba(52,211,153,0.1)" />
        <QuickActionCard icon={Users} label="View Patients" onClick={() => navigate('/dashboard/patients')} color="#7C5CFF" bgColor="rgba(124,92,255,0.06)" borderColor="rgba(124,92,255,0.1)" />
        <QuickActionCard icon={Clock} label="View Schedule" onClick={() => navigate('/dashboard/schedule')} color="#FBBF24" bgColor="rgba(251,191,36,0.06)" borderColor="rgba(251,191,36,0.1)" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} value={todayAppts.length} label="Today's Appointments"
          iconBg="rgba(79,209,255,0.1)" iconBorder="1px solid rgba(79,209,255,0.12)" iconColor="#4FD1FF" />
        <StatCard icon={Clock} value={upcomingAppointments.length} label="Upcoming"
          iconBg="rgba(251,191,36,0.1)" iconBorder="1px solid rgba(251,191,36,0.12)" iconColor="#FBBF24" />
        <StatCard icon={Activity} value={totalProcedures} label="Total Procedures"
          iconBg="rgba(52,211,153,0.1)" iconBorder="1px solid rgba(52,211,153,0.12)" iconColor="#34D399" />
        <StatCard icon={Users} value={totalAppointments} label="Total Appointments"
          iconBg="rgba(124,92,255,0.1)" iconBorder="1px solid rgba(124,92,255,0.12)" iconColor="#7C5CFF" />
      </div>

      {/* Second Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Heart} value={myFollowUps.length} label="Follow-ups"
          iconBg="rgba(52,211,153,0.1)" iconBorder="1px solid rgba(52,211,153,0.12)" iconColor="#34D399" />
        <StatCard icon={AlertTriangle} value={criticalFollowUps.length} label="Critical Follow-ups"
          iconBg="rgba(244,67,54,0.1)" iconBorder="1px solid rgba(244,67,54,0.12)" iconColor="#F44336" />
        <StatCard icon={Users} value={myPatientIds.length} label="My Patients"
          iconBg="rgba(124,92,255,0.1)" iconBorder="1px solid rgba(124,92,255,0.12)" iconColor="#7C5CFF" />
        <StatCard icon={DollarSign} value={`$${(doctorRevenue?.totalRevenue || 0).toLocaleString()}`} label="My Revenue"
          iconBg="rgba(79,209,255,0.1)" iconBorder="1px solid rgba(79,209,255,0.12)" iconColor="#4FD1FF" />
      </div>

      {/* Appointments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="card-cyber">
          <SectionHeader
            title="Today's Appointments"
            subtitle={`${todayAppts.length} today`}
            action={{ label: 'View All', onClick: () => navigate('/dashboard/schedule') }}
          />
          {todayAppts.length === 0 ? (
            <EmptyState title="No appointments today" description="Your schedule is clear for today." />
          ) : (
            <div className="space-y-2">
              {todayAppts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center min-w-[44px]">
                      <span className="text-[11px] font-bold text-primary">
                        {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{a.patient_id ? `Patient #${a.patient_id.slice(0, 6)}` : 'Unknown'}</div>
                    </div>
                  </div>
                  <StatusBadge status={a.status} size="xs" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="card-cyber">
          <SectionHeader title="Upcoming Appointments" subtitle={`${upcomingAppointments.length} upcoming`} />
          {upcomingAppointments.length === 0 ? (
            <EmptyState title="No upcoming" description="No future appointments scheduled." />
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center min-w-[44px]">
                      <span className="text-[10px] font-bold text-primary">
                        {new Date(a.appointment_date).toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/50">
                        {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{a.patient_id ? `Patient #${a.patient_id.slice(0, 6)}` : 'Unknown'}</div>
                      <div className="text-[11px] text-on-surface-variant/50">{a.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-ups Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-cyber">
          <SectionHeader
            title="Upcoming Follow-ups"
            subtitle={`${myFollowUps.length} total`}
            action={{ label: 'View All', onClick: () => navigate('/dashboard/cases') }}
          />
          {myFollowUps.length === 0 ? (
            <EmptyState title="No follow-ups" description="No follow-ups recorded for your patients." />
          ) : (
            <div className="space-y-2">
              {myFollowUps.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">Patient #{f.patient_id.slice(0, 6)}</div>
                    <div className="text-[11px] text-on-surface-variant/50">
                      Health: {f.health_score ?? '—'} · Pain: {f.pain_level ?? '—'}/10
                    </div>
                  </div>
                  <StatusBadge status={f.healing_status || 'Unknown'} size="xs" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-cyber">
          <SectionHeader title="Critical Follow-ups" subtitle={`${criticalFollowUps.length} requiring attention`} />
          {criticalFollowUps.length === 0 ? (
            <EmptyState title="All stable" description="No critical follow-ups to address." />
          ) : (
            <div className="space-y-2">
              {criticalFollowUps.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.12)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">Patient #{f.patient_id.slice(0, 6)}</div>
                    <div className="text-[11px] text-on-surface-variant/50">
                      Health: {f.health_score ?? '—'} · Pain: {f.pain_level ?? '—'}/10
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: 'rgba(244,67,54,0.15)', color: '#F44336' }}>
                    {f.healing_status}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/cases')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-ghost btn-sm" aria-label="View all cases">
            View All Cases
          </button>
        </div>
      </div>

      {/* Today's Procedures Summary */}
      <div className="card-cyber">
        <SectionHeader title="Today's Procedures" subtitle={`${todayProcedures.length} procedures performed`} />
        {todayProcedures.length === 0 ? (
          <EmptyState title="No procedures today" description="No procedures recorded for today." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(todayProcsByStatus).map(([status, count]) => (
              <div key={status} className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
                <div className="text-lg font-bold text-primary font-mono">{count}</div>
                <div className="text-[11px] mt-1 text-on-surface-variant/60">{status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Procedures by Status */}
      <div className="card-cyber">
        <SectionHeader title="Procedures by Status" subtitle={`${totalProcedures} total procedures`} />
        {doctorProcedures.length === 0 ? (
          <EmptyState title="No procedures" description="Record your first procedure to see stats here." action={{ label: 'Record Procedure', onClick: () => navigate('/dashboard/cases') }} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(procStatusMap).map(([status, count]) => (
              <div key={status} className="p-4 rounded-xl text-center transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
                <div className="text-lg font-bold text-primary font-mono">{count}</div>
                <div className="text-[11px] mt-1 text-on-surface-variant/60">{status}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => navigate('/dashboard/cases')}
          className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-ghost btn-sm" aria-label="View all procedures">
          View All Procedures
        </button>
      </div>

      {/* Patients & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-cyber">
          <SectionHeader
            title="My Patients"
            subtitle={`${myPatientIds.length} unique patients`}
            action={{ label: 'View All', onClick: () => navigate('/dashboard/patients') }}
          />
          {myPatientIds.length === 0 ? (
            <EmptyState title="No patients yet" description="Patients will appear here after procedures." />
          ) : (
            <div className="space-y-2">
              {doctorProcedures.filter((p, i, arr) => arr.findIndex(x => x.patient_id === p.patient_id) === i).slice(0, 6).map(p => (
                <button
                  key={p.patient_id}
                  onClick={() => navigate(`/dashboard/patients/${p.patient_id}/profile`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/3
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  aria-label={`View patient ${p.patient_id}`}
                >
                  <Avatar name={p.patient_id || '??'} size="sm" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Patient #{p.patient_id.slice(0, 6)}</div>
                    <div className="text-[11px] text-on-surface-variant/50">{p.procedure_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Revenue */}
        <div className="card-cyber">
          <SectionHeader title="Revenue from My Procedures" subtitle="All procedures combined" />
          <div className="flex flex-col gap-4">
            <div className="p-5 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.1)' }}>
              <div className="text-xs text-on-surface-variant/50">Total Revenue</div>
              <div className="text-2xl font-bold text-[#34D399] font-mono">${(doctorRevenue?.totalRevenue || 0).toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
                <div className="text-xs text-on-surface-variant/50">Collected</div>
                <div className="text-lg font-bold text-primary font-mono">${(doctorRevenue?.collected || 0).toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)' }}>
                <div className="text-xs text-on-surface-variant/50">Pending</div>
                <div className="text-lg font-bold text-[#FBBF24] font-mono">${(doctorRevenue?.pending || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Procedures Chart */}
      <div className="card-cyber">
        <SectionHeader title="Monthly Procedures" subtitle={`${monthlyProcedures.length} months of data`} />
        {monthlyProcedures.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-white/15" />
              <p className="text-sm text-on-surface-variant/40">No procedure data yet</p>
            </div>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={monthlyProcedures} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'rgba(8,15,25,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#4FD1FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Success Rate + Quick Actions + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Implant Success Rate */}
        <div className="card-cyber flex flex-col items-center justify-center py-8">
          <SectionHeader title="Implant Success Rate" />
          <div className="relative w-28 h-28 flex items-center justify-center my-4">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#34D399" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - implantSuccessRate / 100)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-white font-mono">{implantSuccessRate}%</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant/50">
            <span><span className="text-[#34D399] font-semibold">{completedProcedures}</span> Completed</span>
            <span><span className="text-white font-semibold">{totalProcedures}</span> Total</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card-cyber">
          <SectionHeader title="Quick Actions" />
          <div className="space-y-2">
            <button onClick={() => navigate('/dashboard/schedule')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-primary-container"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#4FD1FF' }}
              aria-label="Schedule appointment">
              <Calendar className="w-4 h-4" /> Schedule Appointment
            </button>
            <button onClick={() => navigate('/dashboard/cases')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(52,211,153,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#34D399' }}
              aria-label="Record procedure">
              <Syringe className="w-4 h-4" /> Record Procedure
            </button>
            <button onClick={() => navigate('/dashboard/patients')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(124,92,255,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#7C5CFF' }}
              aria-label="View patients">
              <Users className="w-4 h-4" /> View Patients
            </button>
            <button onClick={() => navigate('/dashboard/schedule')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(251,191,36,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#FBBF24' }}
              aria-label="View schedule">
              <Clock className="w-4 h-4" /> View Schedule
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="card-cyber">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Notifications</h3>
            {notifications.some(n => !n.is_read) && (
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(79,209,255,0.6)]" />
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-on-surface-variant/40 text-center py-8">No notifications</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {notifications.slice(0, 6).map((n: any) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/logs')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium btn-ghost btn-sm" aria-label="View all">
            View All Notifications
          </button>
        </div>
      </div>

      {/* Today's Procedures Details Table */}
      <div className="card-cyber">
        <SectionHeader
          title="Today's Procedures Details"
          subtitle={`${todayProcedures.length} procedures today`}
          action={{ label: 'View All', onClick: () => navigate('/dashboard/cases') }}
        />
        {todayProcedures.length === 0 ? (
          <EmptyState title="No procedures today" description="Your procedure log is empty for today." />
        ) : (
          <div className="overflow-hidden">
            <div className="flex text-[11px] font-semibold uppercase tracking-wider pb-3 border-b border-white/5 text-on-surface-variant/40">
              <div className="flex-[2]">Patient</div>
              <div className="flex-[1.5]">Procedure</div>
              <div className="flex-[1]">Status</div>
              <div className="flex-[0.75]">Tooth</div>
              <div className="flex-[1]">Time</div>
            </div>
            <div className="divide-y divide-white/5">
              {todayProcedures.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center py-3.5 transition-all hover:bg-white/2 rounded-lg px-1 -mx-1">
                  <div className="flex-[2] flex items-center gap-3">
                    <Avatar name={p.patient_id || '??'} size="sm" />
                    <div className="text-sm font-medium text-white">Patient #{p.patient_id.slice(0, 6)}</div>
                  </div>
                  <div className="flex-[1.5] text-sm text-on-surface/80">{p.procedure_name}</div>
                  <div className="flex-[1]"><StatusBadge status={p.status} size="xs" /></div>
                  <div className="flex-[0.75] text-sm text-on-surface-variant/60">{p.tooth_number || '—'}</div>
                  <div className="flex-[1] text-sm text-on-surface-variant/60">
                    {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN DASHBOARD EXPORT (role-aware)
   ════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'Receptionist') {
    return <ReceptionDashboard />;
  }
  if (user?.role === 'Manager') {
    return <ManagerDashboard />;
  }
  if (user?.role === 'Doctor') {
    return <DoctorDashboard />;
  }
  return <ClinicalDashboard />;
}
