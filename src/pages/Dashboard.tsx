import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { financialRecordService } from '../services/financialRecordService';
import { patientService } from '../services/patientService';
import { procedureService } from '../services/procedureService';
import { followUpService } from '../services/followUpService';
import { appointmentService } from '../services/appointmentService';
import { implantInventoryService } from '../services/implantInventoryService';
import { deliveryService } from '../services/deliveryService';
import { branchService } from '../services/branchService';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, DollarSign, Activity, Calendar, Clock, Users,
  ChevronRight, Plus, User, Package, AlertTriangle, Truck
} from 'lucide-react';

/* ════════════════════════════════════════════
   RECEPTION DASHBOARD
   ════════════════════════════════════════════ */
function ReceptionDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [since] = useState(() => Date.now() - 24 * 60 * 60 * 1000);
  const [now] = useState(() => Date.now());

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });
  const { data: allAppointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentService.getAll(),
  });
  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => procedureService.getAll(),
  });
  const { data: analytics } = useQuery({
    queryKey: ['financial-analytics'],
    queryFn: () => financialRecordService.getAnalytics(),
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

  return (
    <div className="space-y-6 font-sans select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t('dashboard.reception_title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {today} · {t('dashboard.today_plural', { today: patients.length, count: patients.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/patients"
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
            <Plus className="w-4 h-4" /> {t('nav.add_patient')}
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[22px] p-5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)' }}>
            <Users className="w-5 h-5 text-[#4FD1FF]" />
          </div>
          <div className="text-2xl font-bold text-white">{todayPatients.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_new_patients')}</div>
        </div>

        <div className="rounded-[22px] p-5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.12)' }}>
            <Calendar className="w-5 h-5 text-[#FFC107]" />
          </div>
          <div className="text-2xl font-bold text-white">{todayAppointments.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_appointments')}</div>
        </div>

        <div className="rounded-[22px] p-5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.12)' }}>
            <Activity className="w-5 h-5 text-[#7C5CFF]" />
          </div>
          <div className="text-2xl font-bold text-white">{todayProcedures.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_procedures')}</div>
        </div>

        <div className="rounded-[22px] p-5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(0,229,168,0.1)', border: '1px solid rgba(0,229,168,0.12)' }}>
            <DollarSign className="w-5 h-5 text-[#00E5A8]" />
          </div>
          <div className="text-2xl font-bold text-white">${todayRevenue.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_revenue')}</div>
        </div>
      </div>

      {/* Clients Last 24h */}
      <div className="rounded-[22px] p-6"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">{t('dashboard.last_24h_title')}</h3>
          <Link to="/dashboard/patients"
            className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#4FD1FF' }}>
            {t('dashboard.view_all')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {clientsLast24h.length === 0 ? (
          <div className="py-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.last_24h_empty')}</div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {clientsLast24h.slice(0, 8).map(p => (
              <div key={p.id}
                onClick={() => navigate(`/dashboard/patients/${p.id}/profile`)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl cursor-pointer transition-all hover:bg-[rgba(79,209,255,0.06)]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                  {p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[11px] font-medium text-white whitespace-nowrap max-w-[72px] truncate">{p.full_name}</span>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <div className="lg:col-span-2 rounded-[22px] p-6"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">{t('dashboard.today_appointments')}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {t('dashboard.appointments_scheduled', { count: todayAppointments.length })}
              </p>
            </div>
            <Link to="/dashboard/appointments"
              className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#4FD1FF' }}>
              {t('dashboard.view_all')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('dashboard.no_appointments_today')}
            </div>
          ) : (
            <div className="space-y-2">
              {todayAppointments.slice(0, 5).map(a => {
                const patient = patients.find(p => p.id === a.patient_id);
                return (
                  <div key={a.id}
                    onClick={() => navigate(`/dashboard/patients/${a.patient_id}/profile`)}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.03)]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                        {(patient?.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{patient?.full_name || t('common.unknown')}</div>
                        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: a.status === 'confirmed' ? 'rgba(0,229,168,0.12)' : 'rgba(255,193,7,0.12)',
                        color: a.status === 'confirmed' ? '#00E5A8' : '#FFC107',
                      }}>
                      {a.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions & Next Appointments */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-[22px] p-6"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
            <h3 className="text-base font-semibold text-white mb-4">{t('dashboard.quick_actions')}</h3>
            <div className="space-y-2">
              <button onClick={() => navigate('/dashboard/patients')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(79,209,255,0.06)]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#4FD1FF' }}>
                <User className="w-4 h-4" /> {t('dashboard.find_patient')}
              </button>
              <button onClick={() => navigate('/dashboard/appointments')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(255,193,7,0.06)]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#FFC107' }}>
                <Calendar className="w-4 h-4" /> {t('dashboard.schedule_appointment')}
              </button>
              <button onClick={() => navigate('/dashboard/inventory')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(79,209,255,0.06)]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#4FD1FF' }}>
                <Package className="w-4 h-4" /> {t('nav.inventory')}
              </button>
            </div>
          </div>

          {/* Next Appointments */}
          <div className="rounded-[22px] p-6"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
            <h3 className="text-base font-semibold text-white mb-4">{t('dashboard.upcoming')}</h3>
            {nextAppointments.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {t('dashboard.no_upcoming')}
              </div>
            ) : (
              <div className="space-y-2">
                {nextAppointments.map(a => {
                  const patient = patients.find(p => p.id === a.patient_id);
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex flex-col items-center min-w-[40px]">
                        <span className="text-[10px] font-bold text-[#4FD1FF]">
                          {new Date(a.appointment_date).toLocaleDateString([], { weekday: 'short' })}
                        </span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
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
    </div>
  );
}

/* ════════════════════════════════════════════
   CLINICAL DASHBOARD (original - for Admin/Doctor)
   ════════════════════════════════════════════ */
function ClinicalDashboard() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const [invStats, patientStats, procStats, followStats, revenueData, procedures, appointments] = await Promise.all([
        financialRecordService.getAnalytics().catch(() => ({ totalRevenue: 0, totalPending: 0, monthlyCollected: 0, invoiceCount: 0, paidCount: 0, pendingCount: 0, partialCount: 0, monthlyGrowth: 0 })),
        patientService.getStats().catch(() => ({ total: 0, newThisMonth: 0 })),
        procedureService.getStats().catch(() => ({ total: 0, byStatus: {} })),
        followUpService.getStats().catch(() => ({ total: 0, critical: 0, avgPain: 0, avgHealth: 0 })),
        financialRecordService.getDailyRevenue(7).catch(() => []),
        procedureService.getAll().catch(() => []),
        appointmentService.getAll().catch(() => []),
      ]);
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const next24h = appointments.filter(a => {
        const d = new Date(a.appointment_date);
        return d >= now && d <= tomorrow;
      });
      return { invStats, patientStats, procStats, followStats, revenueData, procedures, next24h };
    },
    refetchInterval: 1000 * 30,
  });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const { invStats, patientStats, procStats, followStats, revenueData, procedures, next24h } = data!;

  const procStatusColors: Record<string, { bg: string; text: string; dot: string }> = {
    Surgery: { bg: 'rgba(79,209,255,0.12)', text: '#4FD1FF', dot: '#4FD1FF' },
    Healing: { bg: 'rgba(0,229,168,0.12)', text: '#00E5A8', dot: '#00E5A8' },
    Consultation: { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.3)' },
    Completed: { bg: 'rgba(124,92,255,0.12)', text: '#7C5CFF', dot: '#7C5CFF' },
  };

  function StatusBadge({ status }: { status: string }) {
    const colors = procStatusColors[status] || procStatusColors.Consultation;
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide"
        style={{ background: colors.bg, color: colors.text }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.dot, boxShadow: `0 0 6px ${colors.dot}` }} />
        {status}
      </span>
    );
  }

  function Avatar({ name }: { name: string }) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: 'rgba(79,209,255,0.12)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
        {initials}
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('dashboard.clinical_title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {patientStats.total > 0 ? t('dashboard.clinical_subtitle', { count: patientStats.total }) : t('dashboard.clinical_subtitle_empty')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(0,229,168,0.08)', border: '1px solid rgba(0,229,168,0.15)', color: '#00E5A8' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00E5A8', boxShadow: '0 0 8px rgba(0,229,168,0.6)' }} />
            {t('dashboard.system_online')}
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <Calendar className="w-3.5 h-3.5" style={{ color: '#4FD1FF' }} />
            {today}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)' }}>
              <Activity className="w-5 h-5 text-[#4FD1FF]" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#00E5A8]">
              {patientStats.newThisMonth > 0 && <TrendingUp className="w-3 h-3" />}{patientStats.newThisMonth > 0 ? t('dashboard.new_count', { count: patientStats.newThisMonth }) : ''}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{patientStats.total || 0}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_total_patients')}</div>
        </div>

        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.12)' }}>
              <Clock className="w-5 h-5 text-[#FFC107]" />
            </div>
            <span className={`text-[11px] font-medium ${followStats.critical > 0 ? 'text-[#FF6B6B]' : 'text-[#00E5A8]'}`}>
              {followStats.critical > 0 ? t('dashboard.critical_count', { count: followStats.critical }) : t('dashboard.all_stable')}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{followStats.total || 0}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_follow_ups')}</div>
          {followStats.total > 0 ? (
            <div className="mt-3 flex items-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('dashboard.avg_health')}: <span className="text-[#4FD1FF] font-semibold ml-1">{Math.round(followStats.avgHealth)}%</span>
              <span className="mx-2">·</span>
              {t('dashboard.avg_pain')}: <span className="text-[#FF6B6B] font-semibold ml-1">{followStats.avgPain.toFixed(1)}/10</span>
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{t('dashboard.no_follow_ups')}</div>
          )}
        </div>

        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,229,168,0.1)', border: '1px solid rgba(0,229,168,0.12)' }}>
              <DollarSign className="w-5 h-5 text-[#00E5A8]" />
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.this_month')}</span>
          </div>
          <div className="text-2xl font-bold text-white">${invStats.totalRevenue.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_total_collected')}</div>
          {invStats.totalRevenue > 0 ? (
            <div className="mt-3 flex items-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('dashboard.mtd')}: <span className="text-[#00E5A8] font-semibold ml-1">${invStats.monthlyCollected.toLocaleString()}</span>
              {invStats.monthlyGrowth !== 0 && (
                <><span className="mx-2">·</span>{t('dashboard.growth')}: <span className={`font-semibold ml-1 ${invStats.monthlyGrowth >= 0 ? 'text-[#00E5A8]' : 'text-[#FF6B6B]'}`}>{invStats.monthlyGrowth >= 0 ? '+' : ''}{invStats.monthlyGrowth}%</span></>
              )}
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{t('dashboard.no_payments_yet')}</div>
          )}
        </div>

        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.12)' }}>
              <TrendingUp className="w-5 h-5 text-[#7C5CFF]" />
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.recent_procedures_desc', { count: procStats.total })}</span>
          </div>
          <div className="text-2xl font-bold text-white">{procStats.total || 0}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('dashboard.stat_total_procedures')}</div>
          {procStats.total > 0 ? (
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(Object.entries(procStats.byStatus) as [string, number][]).slice(0, 3).map(([status, count]) => (
                  <span key={status} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{t('dashboard.no_procedures_yet')}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-[22px] p-6"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">{t('dashboard.recent_procedures')}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{procedures.length > 0 ? t('dashboard.recent_procedures_desc') : t('dashboard.no_procedures_recorded')}</p>
            </div>
            <Link to="/dashboard/cases"
              className="flex items-center gap-1.5 text-xs font-medium transition-all duration-200" style={{ color: '#4FD1FF' }}>
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {procedures.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.no_procedures_recorded')}</div>
          ) : (
            <div className="overflow-hidden">
              <div className="flex text-[11px] font-semibold uppercase tracking-wider pb-3 border-b border-[rgba(255,255,255,0.05)]"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                <div className="flex-[2]">{t('dashboard.patient_id_header')}</div>
                <div className="flex-[1.5]">{t('dashboard.procedure_header')}</div>
                <div className="flex-[1]">Date</div>
                <div className="flex-[1]">Status</div>
                <div className="flex-[0.5] text-right">{t('dashboard.tooth_header')}</div>
              </div>
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {procedures.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center py-3.5 transition-all duration-150 hover:bg-[rgba(255,255,255,0.02)] rounded-lg px-1 -mx-1">
                    <div className="flex-[2] flex items-center gap-3">
                      <Avatar name={p.doctor_name || 'Dr. '} />
                      <div>
                        <div className="text-sm font-medium text-white">{(p.doctor_name || 'Dr.')}</div>
                        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>#{(p.id || '').slice(0, 6).toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{p.procedure_name}</div>
                    <div className="flex-[1] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{new Date(p.procedure_date).toLocaleDateString()}</div>
                    <div className="flex-[1]"><StatusBadge status={p.status} /></div>
                    <div className="flex-[0.5] text-right text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{p.tooth_number || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[22px] p-6"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">{t('dashboard.next_24h')}</h3>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
                {t('dashboard.appointments_count', { count: next24h.length })}
              </span>
            </div>
            {next24h.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.no_appointments_24h')}</div>
            ) : (
              <div className="space-y-3">
                {next24h.slice(0, 5).map(apt => (
                  <div key={apt.id} className="flex items-start gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-[rgba(255,255,255,0.03)]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                      <div className="text-[11px] font-semibold text-[#4FD1FF]">{new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="w-[1px] h-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{apt.patient_id ? `Patient #${apt.patient_id.slice(0, 6)}` : t('common.unknown')}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{apt.status}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{
                      background: apt.status === 'confirmed' ? '#00E5A8' : 'rgba(255,255,255,0.2)',
                      boxShadow: apt.status === 'confirmed' ? '0 0 6px rgba(0,229,168,0.6)' : 'none',
                    }} />
                  </div>
                ))}
              </div>
            )}
            <Link to="/dashboard/appointments"
              className="flex items-center justify-center w-full mt-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
              style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
              {t('dashboard.view_full_calendar')}
            </Link>
          </div>

          <div className="rounded-[22px] p-6"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">{t('dashboard.revenue_trend')}</h3>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{
                background: invStats.monthlyCollected > 0 ? 'rgba(0,229,168,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${invStats.monthlyCollected > 0 ? 'rgba(0,229,168,0.12)' : 'rgba(255,255,255,0.06)'}`,
                color: invStats.monthlyCollected > 0 ? '#00E5A8' : 'rgba(255,255,255,0.3)',
              }}>
                ${invStats.monthlyCollected.toLocaleString()} {t('dashboard.mtd')}
              </span>
            </div>
            {revenueData.length === 0 || revenueData.every(d => d.revenue === 0) ? (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.chart_no_data')}</p>
                </div>
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={revenueData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4FD1FF" stopOpacity={0.25} /><stop offset="100%" stopColor="#4FD1FF" stopOpacity={0} /></linearGradient></defs>
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
    </div>
  );
}

/* ════════════════════════════════════════════
   MANAGER DASHBOARD
   ════════════════════════════════════════════ */
function ManagerDashboard() {
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
    queryKey: ['appointments'],
    queryFn: () => appointmentService.getAll(),
  });
  const pendingRequests = stockRequests.filter(r => r.status === 'pending');
  const lowStockItems = branchInventory.filter(i => (i.quantity - i.reserved) <= 3);
  const todayAppts = appointments.filter(a => new Date(a.appointment_date).toISOString().split('T')[0] === today);

  return (
    <div className="space-y-6 font-sans select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Manager Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{today}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,193,7,0.1)' }}>
            <Clock className="w-5 h-5 text-[#FFC107]" />
          </div>
          <div className="text-2xl font-bold text-white">{pendingRequests.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Pending Stock Requests</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
          </div>
          <div className="text-2xl font-bold text-[#ef4444]">{lowStockItems.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Low Stock Items</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(79,209,255,0.1)' }}>
            <Truck className="w-5 h-5 text-[#4FD1FF]" />
          </div>
          <div className="text-2xl font-bold text-white">{deliveries.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Deliveries</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(0,229,168,0.1)' }}>
            <Calendar className="w-5 h-5 text-[#00E5A8]" />
          </div>
          <div className="text-2xl font-bold text-white">{todayAppts.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Today's Appointments</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Pending Stock Requests</h3>
          {pendingRequests.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No pending requests</div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">{r.item_name}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Qty: {r.quantity}</div>
                  </div>
                  <button onClick={() => navigate('/dashboard/inventory?tab=requests')}
                    className="h-7 px-3 rounded-lg text-[10px] font-semibold"
                    style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>Review</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/inventory')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Inventory</button>
        </div>

        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Low Stock Alerts</h3>
          {lowStockItems.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>All items well-stocked</div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">{item.item_name}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.branch_name}</div>
                  </div>
                  <span className="text-sm font-bold text-[#ef4444]">{item.quantity}</span>
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
  return <ClinicalDashboard />;
}
