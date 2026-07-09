import { useMemo } from 'react';
import AppointmentBlock from './AppointmentBlock';
import type { Appointment } from '../../../types';

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay(); }

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

interface MonthViewProps {
  year: number;
  month: number;
  appointments: Appointment[];
  onAppointmentClick: (app: Appointment) => void;
  onAppointmentContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  onDateClick: (date: string) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthView({ year, month, appointments, onAppointmentClick, onAppointmentContextMenu, onDateClick }: MonthViewProps) {
  const weeks = useMemo(() => buildCalendar(year, month), [year, month]);

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      const d = new Date(a.appointment_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="grid grid-cols-7">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7" style={{ borderBottom: wi < weeks.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          {week.map((day, di) => {
            if (day === null) return <div key={`e-${di}`} className="min-h-[100px] p-1" style={{ background: 'rgba(255,255,255,0.01)' }} />;
            const key = `${year}-${month}-${day}`;
            const dayApps = apptsByDay[`${year}-${month}-${day}`] || [];
            const isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day;
            return (
              <div
                key={key}
                onClick={() => onDateClick(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                className="min-h-[100px] p-1 cursor-pointer transition-colors"
                style={{ background: isToday ? 'rgba(79,209,255,0.05)' : 'transparent', borderRight: di < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded inline-block mb-0.5" style={{ color: isToday ? '#4FD1FF' : 'rgba(255,255,255,0.5)', background: isToday ? 'rgba(79,209,255,0.15)' : 'transparent' }}>
                  {day}
                </span>
                <div className="space-y-0.5">
                  {dayApps.slice(0, 3).map(app => (
                    <AppointmentBlock key={app.id} appointment={app} onClick={onAppointmentClick} onContextMenu={onAppointmentContextMenu} compact />
                  ))}
                  {dayApps.length > 3 && (
                    <div className="text-[10px] px-1" style={{ color: 'rgba(255,255,255,0.4)' }}>+{dayApps.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
