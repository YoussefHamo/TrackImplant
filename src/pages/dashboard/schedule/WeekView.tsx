import { useMemo } from 'react';
import AppointmentBlock from './AppointmentBlock';
import type { Appointment } from '../../../types';

interface WeekViewProps {
  startDate: Date;
  appointments: Appointment[];
  doctors: { id: string; name: string }[];
  onAppointmentClick: (app: Appointment) => void;
  onAppointmentContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  onSlotClick: (date: string, doctorId: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeekView({ startDate, appointments, doctors, onAppointmentClick, onAppointmentContextMenu, onSlotClick }: WeekViewProps) {
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [startDate]);

  const apptsByDayDoctor = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      const d = new Date(a.appointment_date);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const docKey = a.doctor_id || 'none';
      const key = `${dayKey}-${docKey}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  function getAppts(day: Date, doctorId: string) {
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${doctorId}`;
    return apptsByDayDoctor[key] || [];
  }

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header: Doctor columns */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-16 shrink-0" />
        {days.map((day, i) => (
          <div key={i} className="flex-1 text-center py-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{DAY_NAMES[day.getDay()]}</div>
            <div className="text-sm font-bold text-white">{day.getDate()}</div>
          </div>
        ))}
      </div>
      {/* Sub-header: Doctor names under each day */}
      {doctors.length > 0 && (
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="w-16 shrink-0" />
          {days.map((_day, di) => (
            <div key={di} className="flex-1 flex" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
              {doctors.map(doc => (
                <div key={doc.id} className="flex-1 text-center py-1.5">
                  <span className="text-[10px] font-medium truncate block px-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{doc.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        {HOURS.map(hour => (
          <div key={hour} className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: 60 }}>
            <div className="w-16 shrink-0 flex items-start justify-center pt-1">
              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
            {days.map((day, di) => (
              <div key={di} className="flex-1 flex" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {doctors.map(doc => {
                  const slotDate = new Date(day);
                  slotDate.setHours(hour, 0, 0, 0);
                  const appts = getAppts(day, doc.id).filter(a => {
                    const ah = new Date(a.appointment_date).getHours();
                    return ah === hour;
                  });
                  return (
                    <div
                      key={doc.id}
                      className="flex-1 relative cursor-pointer hover:bg-[rgba(79,209,255,0.03)] transition-colors"
                      style={{ borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none' }}
                      onClick={() => onSlotClick(slotDate.toISOString(), doc.id)}
                    >
                      {appts.map(app => (
                        <AppointmentBlock key={app.id} appointment={app} onClick={onAppointmentClick} onContextMenu={onAppointmentContextMenu} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
