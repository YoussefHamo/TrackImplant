import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Clock, CalendarDays, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { appointmentService } from '../../services/appointmentService';
import { patientService } from '../../services/patientService';
import type { Appointment } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function buildCalendar(year: number, month: number) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) week.push(null);
  for (let d = 1; d <= totalDays; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

const statusStyles: Record<string, { bg: string; text: string; glow: string }> = {
  scheduled: { bg: 'rgba(79,209,255,0.15)', text: '#4FD1FF', glow: 'rgba(79,209,255,0.3)' },
  confirmed: { bg: 'rgba(0,229,168,0.15)', text: '#00E5A8', glow: 'rgba(0,229,168,0.3)' },
  checked_in: { bg: 'rgba(255,152,0,0.15)', text: '#FF9800', glow: 'rgba(255,152,0,0.3)' },
  working: { bg: 'rgba(156,39,176,0.15)', text: '#9C27B0', glow: 'rgba(156,39,176,0.3)' },
  completed: { bg: 'rgba(76,175,80,0.15)', text: '#4CAF50', glow: 'rgba(76,175,80,0.3)' },
  cancelled: { bg: 'rgba(158,158,158,0.15)', text: '#9E9E9E', glow: 'rgba(158,158,158,0.3)' },
  no_show: { bg: 'rgba(244,67,54,0.15)', text: '#F44336', glow: 'rgba(244,67,54,0.3)' },
  postponed: { bg: 'rgba(255,193,7,0.15)', text: '#FFC107', glow: 'rgba(255,193,7,0.3)' },
};

export default function Appointments() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today.getDate());
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Month');
  const [form, setForm] = useState({ patient_id: '', appointment_date: '' });
  const { t } = useLanguage();
  const { user } = useAuth();
  const MONTHS_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const DAYS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => {
      if (user?.role === 'Doctor') {
        return appointmentService.getByDoctor(user.id);
      }
      return appointmentService.getAll();
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });

  const calendar = buildCalendar(year, month);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const events: Record<number, { id: string; label: string; status: string }[]> = {};
  appointments.forEach(apt => {
    const date = new Date(apt.appointment_date);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const d = date.getDate();
      if (!events[d]) events[d] = [];
      const patient = patients.find(p => p.id === apt.patient_id);
      events[d].push({
        id: apt.id,
        label: patient?.full_name || t('common.unknown'),
        status: apt.status,
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: () => {
      return appointmentService.create({
        patient_id: form.patient_id || undefined,
        appointment_date: form.appointment_date
          ? new Date(form.appointment_date).toISOString()
          : new Date().toISOString(),
        status: 'scheduled',
      });
    },
    onSuccess: () => {
      toast.success(t('appointments.toast_booked'));
      setForm({ patient_id: '', appointment_date: '' });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, change_reason, reason_category }: { id: string; change_reason?: string; reason_category?: string }) =>
      appointmentService.updateStatus(id, 'cancelled', change_reason, reason_category),
    onSuccess: () => {
      toast.success(t('appointments.toast_cancelled'));
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id || !form.appointment_date) { toast.error(t('appointments.toast_required')); return; }
    createMutation.mutate();
  };

  return (
    <div className="font-sans select-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#4FD1FF]" />
            <h1 className="text-2xl font-bold text-white">{t('appointments.month_' + MONTHS_KEYS[month])} {year}</h1>
          </div>
          <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['Day', 'Week', 'Month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3.5 py-1.5 rounded-[10px] text-xs font-medium transition-all duration-200"
                style={{
                  background: view === v ? 'rgba(79,209,255,0.12)' : 'transparent',
                  border: view === v ? '1px solid rgba(79,209,255,0.2)' : '1px solid transparent',
                  color: view === v ? '#4FD1FF' : 'rgba(255,255,255,0.4)',
                }}>
                {t('appointments.' + v.toLowerCase())}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDate(d.getDate()); }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            {t('appointments.today')}
          </button>
          <button onClick={nextMonth}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-[24px] p-5"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="grid grid-cols-7 mb-3">
            {DAYS_KEYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider py-2"
                style={{ color: 'rgba(255,255,255,0.25)' }}>{t('appointments.' + d)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {calendar.flat().map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="min-h-[90px] sm:min-h-[110px]" />;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDate;
              const dayEvents = events[day] || [];
              return (
                <div key={day} onClick={() => setSelectedDate(day)}
                  className="min-h-[90px] sm:min-h-[110px] p-1.5 rounded-lg cursor-pointer transition-all duration-200 flex flex-col group relative"
                  style={{
                    background: isSelected ? 'rgba(79,209,255,0.06)' : 'transparent',
                    border: isToday ? '1px solid rgba(79,209,255,0.25)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div className="flex items-center justify-center mb-auto">
                    <span className="text-sm font-medium"
                      style={{ color: isToday ? '#4FD1FF' : 'rgba(255,255,255,0.7)', fontWeight: isToday ? 700 : 400 }}>{day}</span>
                  </div>
                  <div className="space-y-0.5 mt-auto">
                    {dayEvents.slice(0, 2).map(ev => {
                      const s = statusStyles[ev.status] || statusStyles.scheduled;
                      return (
                        <div key={ev.id}
                          className="group/event flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] truncate leading-tight"
                          style={{ background: s.bg, color: s.text, boxShadow: `0 0 6px ${s.glow}` }}>
                          <span className="flex-1 truncate">{ev.label}</span>
                          <button onClick={(e) => { e.stopPropagation(); cancelMutation.mutate({ id: ev.id }); }}
                            className="hidden group-hover/event:block text-[#ef4444] hover:text-red-300 transition-colors flex-shrink-0">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {t('appointments.more_count', { count: dayEvents.length - 2 })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[22px] p-5"
            style={{ background: 'rgba(13,24,40,0.82)', borderTop: '2px solid rgba(79,209,255,0.3)', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-4 h-4 text-[#4FD1FF]" />
              <h3 className="text-sm font-semibold text-white">{t('appointments.quick_booking')}</h3>
            </div>
            <form onSubmit={handleBook} className="space-y-3.5">
              <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}
                className="w-full h-[44px] px-4 rounded-xl text-sm outline-none cursor-pointer appearance-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: form.patient_id ? 'white' : 'rgba(255,255,255,0.4)' }}>
                <option value="" style={{ background: '#0D1B2A' }}>{t('appointments.select_patient')}</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#0D1B2A' }}>{p.full_name}</option>
                ))}
              </select>
              <input type="datetime-local" value={form.appointment_date}
                onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))}
                className="w-full h-[44px] px-4 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }} />
              <button type="submit" disabled={createMutation.isPending}
                className="w-full h-[44px] rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
                {createMutation.isPending ? t('appointments.booking') : t('appointments.book_appointment')}
              </button>
            </form>
          </div>

          <div className="rounded-[22px] p-5"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4FD1FF]" />
                <h3 className="text-sm font-semibold text-white">{t('appointments.all_appointments')}</h3>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
                {t('appointments.total_count', { count: appointments.length })}
              </span>
            </div>
            <div className="space-y-2">
              {appointments.slice(0, 8).map(apt => {
                const patient = patients.find(p => p.id === apt.patient_id);
                return (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[rgba(255,255,255,0.02)]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      background: (statusStyles[apt.status] || statusStyles.scheduled).text,
                      boxShadow: `0 0 6px ${(statusStyles[apt.status] || statusStyles.scheduled).glow}`,
                    }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{patient?.full_name || t('common.unknown')}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(apt.appointment_date).toLocaleDateString()} &bull; {new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                      background: apt.status === 'confirmed' ? 'rgba(0,229,168,0.1)' : 'rgba(255,255,255,0.05)',
                      color: apt.status === 'confirmed' ? '#00E5A8' : 'rgba(255,255,255,0.3)',
                    }}>
                      {apt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
