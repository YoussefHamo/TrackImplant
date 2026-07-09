import { useMemo } from 'react';
import AppointmentBlock from './AppointmentBlock';
import type { Appointment, DoctorSchedule } from '../../../types';

interface WeekViewProps {
  startDate: Date;
  appointments: Appointment[];
  doctors: { id: string; name: string }[];
  doctorSchedules?: Record<string, DoctorSchedule[]>;
  onAppointmentClick: (app: Appointment) => void;
  onAppointmentContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  onSlotClick: (date: string, doctorId: string) => void;
  onAppointmentDrop?: (appointmentId: string, newDate: string, doctorId?: string) => void;
  onResize?: (appointmentId: string, newDuration: number) => void;
  zoomLevel?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeekView({ startDate, appointments, doctors, doctorSchedules, onAppointmentClick, onAppointmentContextMenu, onSlotClick, onAppointmentDrop, onResize, zoomLevel }: WeekViewProps) {
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

  function isWorkingHour(doctorId: string, day: Date, hour: number): boolean {
    const scheds = doctorSchedules?.[doctorId];
    if (!scheds || scheds.length === 0) return true; // No schedule = always available
    const dayOfWeek = day.getDay();
    const daySchedule = scheds.find(s => s.day_of_week === dayOfWeek);
    if (!daySchedule) return false; // Doctor doesn't work this day
    const startH = parseInt(daySchedule.start_time.split(':')[0]);
    const endH = parseInt(daySchedule.end_time.split(':')[0]);
    return hour >= startH && hour < endH;
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, day: Date, doctorId: string, hour: number) => {
    e.preventDefault();
    if (!onAppointmentDrop) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const newDate = new Date(day);
      newDate.setHours(hour, 0, 0, 0);
      onAppointmentDrop(data.id, newDate.toISOString(), doctorId);
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header: Day columns */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-16 shrink-0" />
        {days.map((day, i) => {
          const isOff = doctors.length > 0 && doctors.every(doc => {
            const scheds = doctorSchedules?.[doc.id];
            return scheds && scheds.length > 0 && !scheds.find(s => s.day_of_week === day.getDay());
          });
          return (
            <div key={i} className="flex-1 text-center py-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', opacity: isOff ? 0.4 : 1 }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{DAY_NAMES[day.getDay()]}</div>
              <div className="text-sm font-bold text-white">{day.getDate()}</div>
            </div>
          );
        })}
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
          <div key={hour} className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: Math.round(60 * (zoomLevel || 1)) }}>
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
                  const isOff = !isWorkingHour(doc.id, day, hour);
                  return (
                    <div
                      key={doc.id}
                      className="flex-1 relative transition-colors"
                      style={{
                        borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                        background: isOff ? 'rgba(255,255,255,0.02)' : 'transparent',
                        opacity: isOff ? 0.35 : 1,
                        cursor: onAppointmentDrop ? 'pointer' : 'default',
                      }}
                      onClick={() => onSlotClick(slotDate.toISOString(), doc.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day, doc.id, hour)}
                    >
                      {appts.map(app => (
                        <AppointmentBlock key={app.id} appointment={app} onClick={onAppointmentClick} onContextMenu={onAppointmentContextMenu} onDrop={onAppointmentDrop} onResize={onResize} />
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
