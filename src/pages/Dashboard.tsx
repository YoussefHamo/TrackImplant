import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { financialRecordService } from '../services/financialRecordService';
import { patientService } from '../services/patientService';
import { procedureService } from '../services/procedureService';
import { followUpService } from '../services/followUpService';
import { appointmentService } from '../services/appointmentService';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, DollarSign, Activity, Calendar, Clock,
  ChevronRight
} from 'lucide-react';

const fetchAnalyticsData = async () => {
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
};

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

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: fetchAnalyticsData,
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

  return (
    <div className="space-y-6 font-sans select-none">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Inter','SF Pro Display',sans-serif" }}>
            Clinical Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {patientStats.total > 0 ? `Real-time metrics across ${patientStats.total} patients.` : 'No patients yet. Add one to get started.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium"
            style={{
              background: 'rgba(0,229,168,0.08)',
              border: '1px solid rgba(0,229,168,0.15)',
              color: '#00E5A8',
            }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00E5A8', boxShadow: '0 0 8px rgba(0,229,168,0.6)' }} />
            System Online
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
            }}>
            <Calendar className="w-3.5 h-3.5" style={{ color: '#4FD1FF' }} />
            {today}
          </div>
        </div>
      </div>

      {/* ===== STATS CARDS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Patients */}
        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: 'rgba(13,24,40,0.82)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 32px rgba(79,209,255,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)' }}>
              <Activity className="w-5 h-5 text-[#4FD1FF]" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#00E5A8]">
              {patientStats.newThisMonth > 0 && <TrendingUp className="w-3 h-3" />}{patientStats.newThisMonth > 0 ? `+${patientStats.newThisMonth} new` : ''}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{patientStats.total || 0}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>TOTAL PATIENTS</div>
          {patientStats.total > 0 && (
            <div className="mt-3 w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (patientStats.newThisMonth / Math.max(1, patientStats.total)) * 100)}%`, background: 'linear-gradient(90deg, #4FD1FF, #45D6FF)', boxShadow: '0 0 8px rgba(79,209,255,0.3)' }} />
            </div>
          )}
        </div>

        {/* Card 2: Follow-ups */}
        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: 'rgba(13,24,40,0.82)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,193,7,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.12)' }}>
              <Clock className="w-5 h-5 text-[#FFC107]" />
            </div>
            <span className={`text-[11px] font-medium ${followStats.critical > 0 ? 'text-[#FF6B6B]' : 'text-[#00E5A8]'}`}>
              {followStats.critical > 0 ? `${followStats.critical} Critical` : 'All stable'}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{followStats.total || 0}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>FOLLOW-UPS</div>
          {followStats.total > 0 ? (
            <div className="mt-3 flex items-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Avg Health: <span className="text-[#4FD1FF] font-semibold ml-1">{Math.round(followStats.avgHealth)}%</span>
              <span className="mx-2">·</span>
              Avg Pain: <span className="text-[#FF6B6B] font-semibold ml-1">{followStats.avgPain.toFixed(1)}/10</span>
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No follow-ups recorded</div>
          )}
        </div>

        {/* Card 3: Monthly Revenue */}
        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: 'rgba(13,24,40,0.82)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,229,168,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,229,168,0.1)', border: '1px solid rgba(0,229,168,0.12)' }}>
              <DollarSign className="w-5 h-5 text-[#00E5A8]" />
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>This Month</span>
          </div>
          <div className="text-2xl font-bold text-white">${invStats.totalRevenue.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>TOTAL COLLECTED</div>
          {invStats.totalRevenue > 0 ? (
            <div className="mt-3 flex items-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              MTD: <span className="text-[#00E5A8] font-semibold ml-1">${invStats.monthlyCollected.toLocaleString()}</span>
              {invStats.monthlyGrowth !== 0 && (
                <><span className="mx-2">·</span>Growth: <span className={`font-semibold ml-1 ${invStats.monthlyGrowth >= 0 ? 'text-[#00E5A8]' : 'text-[#FF6B6B]'}`}>{invStats.monthlyGrowth >= 0 ? '+' : ''}{invStats.monthlyGrowth}%</span></>
              )}
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No payments collected yet</div>
          )}
        </div>

        {/* Card 4: Procedures */}
        <div className="group rounded-[22px] p-5 transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: 'rgba(13,24,40,0.82)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,255,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.12)' }}>
              <TrendingUp className="w-5 h-5 text-[#7C5CFF]" />
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{procStats.total} procedures</span>
          </div>
          <div className="text-2xl font-bold text-white">{procStats.total || 0}</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>TOTAL PROCEDURES</div>
          {procStats.total > 0 ? (
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(Object.entries(procStats.byStatus) as [string, number][]).slice(0, 3).map(([status, count]) => (
                  <span key={status} className="text-[10px] px-2 py-0.5 rounded-full" style={{
                    background: 'rgba(79,209,255,0.1)',
                    border: '1px solid rgba(79,209,255,0.12)',
                    color: '#4FD1FF',
                  }}>
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No procedures yet</div>
          )}
        </div>
      </div>

      {/* ===== BOTTOM GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Procedures Table (spans 2 cols) */}
        <div className="lg:col-span-2 rounded-[22px] p-6"
          style={{
            background: 'rgba(13,24,40,0.82)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Recent Procedures</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{procedures.length > 0 ? 'Latest patient procedures and status updates' : 'No procedures recorded'}</p>
            </div>
            <Link to="/dashboard/cases"
              className="flex items-center gap-1.5 text-xs font-medium transition-all duration-200"
              style={{ color: '#4FD1FF' }}>
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {procedures.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              No procedures yet. Start by creating a new procedure.
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="flex text-[11px] font-semibold uppercase tracking-wider pb-3 border-b border-[rgba(255,255,255,0.05)]"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                <div className="flex-[2]">Patient ID</div>
                <div className="flex-[1.5]">Procedure</div>
                <div className="flex-[1]">Date</div>
                <div className="flex-[1]">Status</div>
                <div className="flex-[0.5] text-right">Tooth</div>
              </div>

              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {procedures.slice(0, 6).map((p) => (
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

        {/* Right Column: Next 24h + Revenue */}
        <div className="space-y-6">
          {/* Next 24h */}
          <div className="rounded-[22px] p-6"
            style={{
              background: 'rgba(13,24,40,0.82)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">Next 24h</h3>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{
                background: 'rgba(79,209,255,0.1)',
                border: '1px solid rgba(79,209,255,0.12)',
                color: '#4FD1FF',
              }}>
                {next24h.length} Appointment{next24h.length !== 1 ? 's' : ''}
              </span>
            </div>

            {next24h.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No appointments in the next 24 hours
              </div>
            ) : (
              <div className="space-y-3">
                {next24h.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="flex items-start gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-[rgba(255,255,255,0.03)]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                      <div className="text-[11px] font-semibold text-[#4FD1FF]">{new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="w-[1px] h-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{apt.patient_id ? `Patient #${apt.patient_id.slice(0, 6)}` : 'Unknown'}</div>
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
              style={{
                background: 'rgba(79,209,255,0.06)',
                border: '1px solid rgba(79,209,255,0.1)',
                color: '#4FD1FF',
              }}>
              View Full Calendar
            </Link>
          </div>

          {/* Revenue Trend */}
          <div className="rounded-[22px] p-6"
            style={{
              background: 'rgba(13,24,40,0.82)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Revenue Trend</h3>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{
                background: invStats.monthlyCollected > 0 ? 'rgba(0,229,168,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${invStats.monthlyCollected > 0 ? 'rgba(0,229,168,0.12)' : 'rgba(255,255,255,0.06)'}`,
                color: invStats.monthlyCollected > 0 ? '#00E5A8' : 'rgba(255,255,255,0.3)',
              }}>
                ${invStats.monthlyCollected.toLocaleString()} MTD
              </span>
            </div>

            {revenueData.length === 0 || revenueData.every(d => d.revenue === 0) ? (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No payments collected yet</p>
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
                    <Tooltip contentStyle={{
                      background: 'rgba(8,15,25,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '12px',
                    }} />
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
