import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
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
import { StatSkeleton } from '../components/ui/Skeleton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, DollarSign, Heart, Activity, Calendar, Clock, Users,
  ChevronRight, Plus, User, Package, AlertTriangle, Truck,
  ArrowLeftRight, Bell, BarChart3
} from 'lucide-react';

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

  return (
    <div className="space-y-6 font-sans select-auto">
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
            <Link to="/dashboard/schedule"
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
              <button onClick={() => navigate('/dashboard/schedule')}
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

      {/* Patient Status Widget */}
      <div className="rounded-[22px] p-6"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Patient Status</h3>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Waiting', key: 'scheduled', color: '#4FD1FF' },
            { label: 'Checked In', key: 'checked_in', color: '#FF9800' },
            { label: 'Working', key: 'working', color: '#9C27B0' },
            { label: 'Completed', key: 'completed', color: '#4CAF50' },
            { label: 'No Shows', key: 'no_show', color: '#F44336' },
          ].map(s => (
            <div key={s.key} className="text-center p-4 rounded-xl"
              style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
              <div className="text-xl font-bold" style={{ color: s.color }}>{patientStatusCounts[s.key]}</div>
              <div className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Outstanding Payments + Today's Follow-ups + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Outstanding Payments Card */}
        <div className="rounded-[22px] p-6"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.12)' }}>
              <DollarSign className="w-5 h-5 text-[#FFC107]" />
            </div>
            <h3 className="text-base font-semibold text-white">Outstanding Payments</h3>
          </div>
          <div className="text-3xl font-bold text-[#FFC107]">${outstandingPayments.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total pending balance across all patients</div>
          <button onClick={() => navigate('/dashboard/payments')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(255,193,7,0.06)', color: '#FFC107' }}>View Payments</button>
        </div>

        {/* Today's Follow-ups */}
        <div className="rounded-[22px] p-6"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,229,168,0.1)', border: '1px solid rgba(0,229,168,0.12)' }}>
              <Heart className="w-5 h-5 text-[#00E5A8]" />
            </div>
            <h3 className="text-base font-semibold text-white">Today's Follow-ups</h3>
          </div>
          {todayFollowUps.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No follow-ups scheduled today</div>
          ) : (
            <div className="space-y-2">
              {todayFollowUps.slice(0, 5).map(f => {
                const patient = patients.find(p => p.id === f.patient_id);
                return (
                  <div key={f.id}
                    onClick={() => navigate(`/dashboard/patients/${f.patient_id}/profile`)}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.03)]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'rgba(0,229,168,0.1)', color: '#00E5A8' }}>
                        {(patient?.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{patient?.full_name || 'Unknown'}</div>
                        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Health: {f.health_score ?? '—'} · Pain: {f.pain_level ?? '—'}/10
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: f.healing_status === 'OnTrack' ? 'rgba(0,229,168,0.12)' : f.healing_status === 'Critical' || f.healing_status === 'Failure' ? 'rgba(239,68,68,0.12)' : 'rgba(255,193,7,0.12)',
                        color: f.healing_status === 'OnTrack' ? '#00E5A8' : f.healing_status === 'Critical' || f.healing_status === 'Failure' ? '#ef4444' : '#FFC107',
                      }}>
                      {f.healing_status || 'Unknown'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications Widget */}
        <div className="rounded-[22px] p-6"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.12)' }}>
              <Activity className="w-5 h-5 text-[#7C5CFF]" />
            </div>
            <h3 className="text-base font-semibold text-white">Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No new notifications</div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map(n => (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: n.is_read ? 'rgba(255,255,255,0.05)' : 'rgba(79,209,255,0.1)', color: n.is_read ? 'rgba(255,255,255,0.3)' : '#4FD1FF' }}>
                    {(n.title || 'N')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{n.title}</div>
                    <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{n.message}</div>
                    <div className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: '#4FD1FF', boxShadow: '0 0 6px rgba(79,209,255,0.6)' }} />
                  )}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/logs')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(124,92,255,0.06)', color: '#7C5CFF' }}>View All Notifications</button>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className="rounded-[22px] p-6"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => navigate('/dashboard/patients')}
            className="flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(79,209,255,0.06)]"
            style={{ background: 'rgba(79,209,255,0.04)', border: '1px solid rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
            <User className="w-5 h-5" />
            <span>Quick Patient Reg.</span>
          </button>
          <button onClick={() => navigate('/dashboard/schedule')}
            className="flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(255,193,7,0.06)]"
            style={{ background: 'rgba(255,193,7,0.04)', border: '1px solid rgba(255,193,7,0.1)', color: '#FFC107' }}>
            <Calendar className="w-5 h-5" />
            <span>Quick Appointment</span>
          </button>
          <button onClick={() => navigate('/dashboard/patients')}
            className="flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(0,229,168,0.06)]"
            style={{ background: 'rgba(0,229,168,0.04)', border: '1px solid rgba(0,229,168,0.1)', color: '#00E5A8' }}>
            <Users className="w-5 h-5" />
            <span>Find Patient</span>
          </button>
          <button onClick={() => navigate('/dashboard/schedule')}
            className="flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(124,92,255,0.06)]"
            style={{ background: 'rgba(124,92,255,0.04)', border: '1px solid rgba(124,92,255,0.1)', color: '#7C5CFF' }}>
            <Clock className="w-5 h-5" />
            <span>View Schedule</span>
          </button>
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
  const { activeBranchId } = useBranch();
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

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="animate-pulse rounded-full w-8 h-8" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="animate-pulse rounded-xl h-4 w-3/4" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    <div className="animate-pulse rounded-xl h-3 w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="animate-pulse rounded-xl h-5 w-24 mb-5" style={{ background: 'rgba(255,255,255,0.04)' }} />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl h-12 w-full" style={{ background: 'rgba(255,255,255,0.02)' }} />
                ))}
              </div>
            </div>
            <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="animate-pulse rounded-xl h-5 w-20 mb-4" style={{ background: 'rgba(255,255,255,0.04)' }} />
              <div className="animate-pulse rounded-xl h-48 w-full" style={{ background: 'rgba(255,255,255,0.02)' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { invStats, patientStats, procStats, followStats, revenueData, procedures, next24h, insuranceRevenue = 0, cashRevenue = 0 } = data!;

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
    <div className="space-y-6 font-sans select-auto">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

        {/* Insurance Revenue Card */}
        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,157,0.1)', border: '1px solid rgba(255,107,157,0.12)' }}>
              <Heart className="w-5 h-5" style={{ color: '#ff6b9d' }} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('dashboard.total')}</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#ff6b9d' }}>${insuranceRevenue.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Insurance Revenue</div>
          <div className="mt-3 flex items-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Cash: <span className="text-[#00E5A8] font-semibold ml-1">${cashRevenue.toLocaleString()}</span>
          </div>
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
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
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
            <Link to="/dashboard/schedule"
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
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
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
  const pendingRequests = stockRequests.filter(r => r.status === 'pending');
  const lowStockItems = branchInventory.filter(i => (i.quantity - i.reserved) <= 3);
  const todayAppts = appointments.filter(a => new Date(a.appointment_date).toISOString().split('T')[0] === today);

  const { data: allProcedures = [] } = useQuery({
    queryKey: ['procedures-all', activeBranchId],
    queryFn: () => procedureService.getAll(activeBranchId),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-manager', user?.id],
    queryFn: () => user?.id ? notificationService.getByUser(user.id, 10) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const todayProcedures = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allProcedures.filter(p => p.procedure_date && new Date(p.procedure_date).toISOString().split('T')[0] === todayStr);
  }, [allProcedures]);

  const waitingPatients = todayAppts.filter(a => a.status === 'scheduled').length;
  const checkedInPatients = todayAppts.filter(a => a.status === 'checked_in').length;
  const workingPatients = todayAppts.filter(a => a.status === 'working').length;
  const completedToday = todayAppts.filter(a => a.status === 'completed').length;
  const noShows = todayAppts.filter(a => a.status === 'no_show').length;

  const branchRevenue = useMemo(() => {
    return analytics?.totalRevenue || 0;
  }, [analytics]);

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
    <div className="space-y-6 font-sans select-auto">
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

      {/* Today's Appointment Breakdown */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Today's Appointments</h3>
          <span className="text-sm font-bold text-[#4FD1FF]">{todayAppts.length} total</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {[
            { label: 'Scheduled', key: 'scheduled', color: '#4FD1FF' },
            { label: 'Checked In', key: 'checked_in', color: '#FF9800' },
            { label: 'Working', key: 'working', color: '#9C27B0' },
            { label: 'Completed', key: 'completed', color: '#4CAF50' },
            { label: 'No Show', key: 'no_show', color: '#F44336' },
            { label: 'Postponed', key: 'postponed', color: '#FFC107' },
            { label: 'Cancelled', key: 'cancelled', color: '#9E9E9E' },
          ].map(s => {
            const count = todayAppts.filter(a => a.status === s.key).length;
            return (
              <div key={s.key} className="text-center p-3 rounded-xl" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                <div className="text-lg font-bold" style={{ color: s.color }}>{count}</div>
                <div className="text-[9px] mt-0.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
              </div>
            );
          })}
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

      {/* Today's Operational Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-[18px] p-4 text-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-lg font-bold text-[#4FD1FF]">{todayProcedures.length}</div>
          <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Procedures Today</div>
        </div>
        <div className="rounded-[18px] p-4 text-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-lg font-bold text-[#4FD1FF]">{waitingPatients}</div>
          <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Waiting</div>
        </div>
        <div className="rounded-[18px] p-4 text-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-lg font-bold text-[#FF9800]">{checkedInPatients}</div>
          <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Checked In</div>
        </div>
        <div className="rounded-[18px] p-4 text-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-lg font-bold text-[#9C27B0]">{workingPatients}</div>
          <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Working</div>
        </div>
        <div className="rounded-[18px] p-4 text-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-lg font-bold text-[#4CAF50]">{completedToday}</div>
          <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Completed</div>
        </div>
        <div className="rounded-[18px] p-4 text-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-lg font-bold text-[#F44336]">{noShows}</div>
          <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>No Shows</div>
        </div>
      </div>

      {/* Branch Financial Overview + Doctor Performance + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch Financial Overview */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Branch Financial Overview</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(0,229,168,0.06)', border: '1px solid rgba(0,229,168,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-[#00E5A8]" />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Branch Revenue</span>
              </div>
              <div className="text-2xl font-bold text-[#00E5A8]">${branchRevenue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-[#4FD1FF]" />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Estimated Inventory Value</span>
              </div>
              <div className="text-2xl font-bold text-[#4FD1FF]">${inventoryValue.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                * Inventory value estimated at avg. $150/unit. Actual cost may vary.
              </p>
            </div>
          </div>
        </div>

        {/* Doctor Performance */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Doctor Performance</h3>
          {doctorPerformance.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No procedure data yet</div>
          ) : (
            <div className="space-y-2">
              {doctorPerformance.map((doc, i) => (
                <div key={doc.name} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-white">{doc.name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#4FD1FF]">{doc.count}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/cases')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Procedures</button>
        </div>

        {/* Notifications Widget */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Notifications</h3>
            <Bell className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No notifications yet</div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map(n => (
                <div key={n.id} className="p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      background: n.type === 'critical' ? '#ef4444' : n.type === 'warning' ? '#FFC107' : n.type === 'success' ? '#00E5A8' : '#4FD1FF',
                    }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{n.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{n.message}</div>
                      {n.created_at && (
                        <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => navigate('/dashboard/schedule')}
            className="flex items-center justify-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(79,209,255,0.08)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
            <Calendar className="w-5 h-5" /> New Appointment
          </button>
          <button onClick={() => navigate('/dashboard/inventory')}
            className="flex items-center justify-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(0,229,168,0.08)', border: '1px solid rgba(0,229,168,0.12)', color: '#00E5A8' }}>
            <Package className="w-5 h-5" /> View Inventory
          </button>
          <button onClick={() => navigate('/dashboard/reports')}
            className="flex items-center justify-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(124,92,255,0.08)', border: '1px solid rgba(124,92,255,0.12)', color: '#7C5CFF' }}>
            <BarChart3 className="w-5 h-5" /> Reports
          </button>
          <button onClick={() => navigate('/dashboard/inventory?tab=requests')}
            className="flex items-center justify-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.12)', color: '#FFC107' }}>
            <ArrowLeftRight className="w-5 h-5" /> Stock Request
          </button>
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
    <div className="space-y-6 font-sans select-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Doctor Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{today}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(79,209,255,0.1)' }}>
            <Calendar className="w-5 h-5 text-[#4FD1FF]" />
          </div>
          <div className="text-2xl font-bold text-white">{todayAppts.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Today's Appointments</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,193,7,0.1)' }}>
            <Clock className="w-5 h-5 text-[#FFC107]" />
          </div>
          <div className="text-2xl font-bold text-white">{upcomingAppointments.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Upcoming Appointments</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(0,229,168,0.1)' }}>
            <Activity className="w-5 h-5 text-[#00E5A8]" />
          </div>
          <div className="text-2xl font-bold text-white">{totalProcedures}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Procedures</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(124,92,255,0.1)' }}>
            <Users className="w-5 h-5 text-[#7C5CFF]" />
          </div>
          <div className="text-2xl font-bold text-white">{totalAppointments}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Appointments</div>
        </div>
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(0,229,168,0.1)' }}>
            <Heart className="w-5 h-5 text-[#00E5A8]" />
          </div>
          <div className="text-2xl font-bold text-white">{myFollowUps.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Follow-ups</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
          </div>
          <div className="text-2xl font-bold text-[#ef4444]">{criticalFollowUps.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Critical Follow-ups</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(124,92,255,0.1)' }}>
            <Users className="w-5 h-5 text-[#7C5CFF]" />
          </div>
          <div className="text-2xl font-bold text-white">{myPatientIds.length}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>My Patients</div>
        </div>
        <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(79,209,255,0.1)' }}>
            <DollarSign className="w-5 h-5 text-[#4FD1FF]" />
          </div>
          <div className="text-2xl font-bold text-white">${(doctorRevenue?.totalRevenue || 0).toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>My Revenue</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Today's Appointments</h3>
          {todayAppts.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No appointments today</div>
          ) : (
            <div className="space-y-2">
              {todayAppts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">{a.patient_id ? `Patient #${a.patient_id.slice(0, 6)}` : 'Unknown'}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/schedule')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Appointments</button>
        </div>

        {/* Upcoming Appointments */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Upcoming Appointments</h3>
          {upcomingAppointments.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No upcoming appointments</div>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center min-w-[40px]">
                      <span className="text-[10px] font-bold text-[#4FD1FF]">
                        {new Date(a.appointment_date).toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{a.patient_id ? `Patient #${a.patient_id.slice(0, 6)}` : 'Unknown'}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{a.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-ups & Critical */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Upcoming Follow-ups</h3>
          {myFollowUps.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No follow-ups found</div>
          ) : (
            <div className="space-y-2">
              {myFollowUps.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">Patient #{f.patient_id.slice(0, 6)}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Health: {f.health_score ?? '—'} · Pain: {f.pain_level ?? '—'}/10
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background: f.healing_status === 'OnTrack' ? 'rgba(0,229,168,0.12)' : f.healing_status === 'Critical' ? 'rgba(239,68,68,0.12)' : f.healing_status === 'Failure' ? 'rgba(239,68,68,0.2)' : 'rgba(255,193,7,0.12)',
                      color: f.healing_status === 'OnTrack' ? '#00E5A8' : f.healing_status === 'Critical' ? '#ef4444' : f.healing_status === 'Failure' ? '#ef4444' : '#FFC107',
                    }}>
                    {f.healing_status || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Critical Follow-ups</h3>
          {criticalFollowUps.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No critical follow-ups</div>
          ) : (
            <div className="space-y-2">
              {criticalFollowUps.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <div>
                    <div className="text-sm font-medium text-white">Patient #{f.patient_id.slice(0, 6)}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Health: {f.health_score ?? '—'} · Pain: {f.pain_level ?? '—'}/10
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      color: '#ef4444',
                    }}>
                    {f.healing_status}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/cases')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>View All Cases</button>
        </div>
      </div>

      {/* Today's Procedures */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Today's Procedures</h3>
        {todayProcedures.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No procedures today</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(todayProcsByStatus).map(([status, count]) => (
              <div key={status} className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
                <div className="text-lg font-bold text-[#4FD1FF]">{count}</div>
                <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{status}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => navigate('/dashboard/cases')}
          className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
          style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Procedures</button>
      </div>

      {/* Procedures Summary */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Procedures by Status</h3>
        {doctorProcedures.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No procedures found</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(procStatusMap).map(([status, count]) => (
              <div key={status} className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
                <div className="text-lg font-bold text-[#4FD1FF]">{count}</div>
                <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{status}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => navigate('/dashboard/cases')}
          className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
          style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Procedures</button>
      </div>

      {/* My Patients & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">My Patients</h3>
          {myPatientIds.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No patients yet</div>
          ) : (
            <div className="space-y-2">
              {doctorProcedures.filter((p, i, arr) => arr.findIndex(x => x.patient_id === p.patient_id) === i).slice(0, 6).map(p => (
                <div key={p.patient_id}
                  onClick={() => navigate(`/dashboard/patients/${p.patient_id}/profile`)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                    {p.patient_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Patient #{p.patient_id.slice(0, 6)}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.procedure_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/dashboard/patients')}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Patients</button>
        </div>
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Revenue from My Procedures</h3>
          <div className="flex flex-col gap-4">
            <div className="p-5 rounded-xl" style={{ background: 'rgba(0,229,168,0.06)', border: '1px solid rgba(0,229,168,0.1)' }}>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Revenue</div>
              <div className="text-2xl font-bold text-[#00E5A8]">${(doctorRevenue?.totalRevenue || 0).toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(79,209,255,0.06)', border: '1px solid rgba(79,209,255,0.1)' }}>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Collected</div>
                <div className="text-lg font-bold text-[#4FD1FF]">${(doctorRevenue?.collected || 0).toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.1)' }}>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Pending</div>
                <div className="text-lg font-bold text-[#FFC107]">${(doctorRevenue?.pending || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Procedures Chart */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Monthly Procedures</h3>
        {monthlyProcedures.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No procedure data yet</div>
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

      {/* Implant Success Rate & Quick Actions & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Success Rate Card */}
        <div className="rounded-[22px] p-6 flex flex-col items-center justify-center" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Implant Success Rate</h3>
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#00E5A8" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - implantSuccessRate / 100)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{implantSuccessRate}%</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span><span className="text-[#00E5A8] font-semibold">{completedProcedures}</span> Completed</span>
            <span><span className="text-white font-semibold">{totalProcedures}</span> Total</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button onClick={() => navigate('/dashboard/schedule')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(79,209,255,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#4FD1FF' }}>
              <Calendar className="w-4 h-4" /> Schedule Appointment
            </button>
            <button onClick={() => navigate('/dashboard/cases')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(0,229,168,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#00E5A8' }}>
              <Plus className="w-4 h-4" /> Record Procedure
            </button>
            <button onClick={() => navigate('/dashboard/patients')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(124,92,255,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#7C5CFF' }}>
              <Users className="w-4 h-4" /> View Patients
            </button>
            <button onClick={() => navigate('/dashboard/schedule')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all hover:bg-[rgba(255,193,7,0.06)]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#FFC107' }}>
              <Clock className="w-4 h-4" /> View Schedule
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-semibold text-white mb-4">Notifications</h3>
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No notifications</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notifications.slice(0, 6).map((n: any) => (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: n.read ? 'rgba(255,255,255,0.2)' : '#4FD1FF' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{n.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{n.message}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Procedures Enhanced */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-base font-semibold text-white mb-4">Today's Procedures Details</h3>
        {todayProcedures.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No procedures today</div>
        ) : (
          <div className="overflow-hidden">
            <div className="flex text-[11px] font-semibold uppercase tracking-wider pb-3 border-b border-[rgba(255,255,255,0.05)]"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              <div className="flex-[2]">Patient</div>
              <div className="flex-[1.5]">Procedure</div>
              <div className="flex-[1]">Status</div>
              <div className="flex-[0.75]">Tooth</div>
              <div className="flex-[1]">Time</div>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {todayProcedures.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center py-3.5 transition-all hover:bg-[rgba(255,255,255,0.02)] rounded-lg px-1 -mx-1">
                  <div className="flex-[2] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                      {(p.patient_id || '').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Patient #{p.patient_id.slice(0, 6)}</div>
                    </div>
                  </div>
                  <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{p.procedure_name}</div>
                  <div className="flex-[1]">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: p.status === 'Completed' ? 'rgba(0,229,168,0.12)' : p.status === 'Surgery' ? 'rgba(79,209,255,0.12)' : 'rgba(255,193,7,0.12)',
                        color: p.status === 'Completed' ? '#00E5A8' : p.status === 'Surgery' ? '#4FD1FF' : '#FFC107',
                      }}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex-[0.75] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{p.tooth_number || '—'}</div>
                  <div className="flex-[1] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => navigate('/dashboard/cases')}
          className="w-full mt-4 py-2.5 rounded-xl text-xs font-medium"
          style={{ background: 'rgba(79,209,255,0.06)', color: '#4FD1FF' }}>View All Procedures</button>
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
