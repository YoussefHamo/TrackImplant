import { useRef, useCallback, useEffect, useState } from 'react';
import AppointmentBlock from './AppointmentBlock';
import type { Appointment, DoctorSchedule } from '../../../types';

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  doctors: { id: string; name: string }[];
  doctorSchedules?: Record<string, DoctorSchedule[]>;
  onAppointmentClick: (app: Appointment) => void;
  onAppointmentContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  onSlotClick: (date: string, doctorId: string) => void;
  onAppointmentDrop?: (appointmentId: string, newDate: string, doctorId?: string) => void;
  onResize?: (appointmentId: string, newDuration: number) => void;
  zoomLevel?: number;
  selectedAppointmentId?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getCurrentTimePosition(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function formatCurrentTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatHour(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getDoctorStats(doctorId: string, appointments: Appointment[], date: Date) {
  const dayAppts = appointments.filter(a => {
    const d = new Date(a.appointment_date);
    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear() && a.doctor_id === doctorId;
  });
  return {
    total: dayAppts.length,
    completed: dayAppts.filter(a => a.status === 'completed').length,
    waiting: dayAppts.filter(a => a.status === 'scheduled' || a.status === 'checked_in').length,
    working: dayAppts.filter(a => a.status === 'working').length,
    cancelled: dayAppts.filter(a => a.status === 'cancelled' || a.status === 'no_show').length,
  };
}

function getWorkingHours(doctorId: string, schedules: Record<string, DoctorSchedule[]>, dayOfWeek: number): { start: string; end: string } | null {
  const scheds = schedules[doctorId];
  if (!scheds || scheds.length === 0) return null;
  const daySchedule = scheds.find(s => s.day_of_week === dayOfWeek);
  if (!daySchedule) return null;
  return { start: daySchedule.start_time.slice(0, 5), end: daySchedule.end_time.slice(0, 5) };
}

function isOffDay(doctorId: string, schedules: Record<string, DoctorSchedule[]>, dayOfWeek: number): boolean {
  const hours = getWorkingHours(doctorId, schedules, dayOfWeek);
  if (hours) return false;
  const scheds = schedules[doctorId];
  return scheds && scheds.length > 0;
}

function isWorkingHour(doctorId: string, schedules: Record<string, DoctorSchedule[]>, dayOfWeek: number, hour: number): boolean {
  const hours = getWorkingHours(doctorId, schedules, dayOfWeek);
  if (!hours) return true;
  const startH = parseInt(hours.start.split(':')[0]);
  const endH = parseInt(hours.end.split(':')[0]);
  return hour >= startH && hour < endH;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const DOCTOR_COLORS = ['#4FD1FF', '#FF9800', '#9C27B0', '#4CAF50', '#FF6B6B', '#FFC107', '#E040FB', '#00BCD4'];

export default function DayView({
  date, appointments, doctors, doctorSchedules, onAppointmentClick, onAppointmentContextMenu,
  onSlotClick, onAppointmentDrop, onResize, zoomLevel = 1, selectedAppointmentId,
}: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(getCurrentTimePosition());
  const today = isToday(date);
  const dayOfWeek = date.getDay();

  // Update current time every minute
  useEffect(() => {
    if (!today) return;
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimePosition());
    }, 60000);
    return () => clearInterval(interval);
  }, [today]);

  // Scroll to current time on mount if today (re-triggers when date changes, e.g. clicking Today)
  useEffect(() => {
    if (!today || !scrollRef.current) return;
    const currentHour = new Date().getHours();
    const rowHeight = Math.round(60 * zoomLevel);
    scrollRef.current.scrollTop = Math.max(0, currentHour * rowHeight - 100);
  }, [today, zoomLevel, date]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, doctorId: string, hour: number) => {
    e.preventDefault();
    if (!onAppointmentDrop) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const newDate = new Date(date);
      newDate.setHours(hour, 0, 0, 0);
      onAppointmentDrop(data.id, newDate.toISOString(), doctorId);
    } catch { /* ignore */ }
  }, [date, onAppointmentDrop]);

  const rowHeight = Math.round(60 * zoomLevel);
  const timeIndicatorTop = currentTime * rowHeight;

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="px-5 py-3 text-sm font-semibold flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-white">{dateStr}</span>
        {today && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(244,67,54,0.15)', color: '#F44336' }}>
            Today
          </span>
        )}
      </div>

      {/* Doctor Headers with Stats */}
      <div className="sticky top-0 z-20" style={{ background: 'rgba(5,11,20,0.98)', backdropFilter: 'blur(12px)' }}>
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Sticky time column spacer in header */}
          <div className="w-16 shrink-0 sticky left-0 z-10" style={{ background: 'rgba(5,11,20,0.98)' }} />
          {doctors.map((doc, di) => {
            const off = isOffDay(doc.id, doctorSchedules || {}, dayOfWeek);
            const hours = getWorkingHours(doc.id, doctorSchedules || {}, dayOfWeek);
            const docColor = DOCTOR_COLORS[di % DOCTOR_COLORS.length];
            const stats = getDoctorStats(doc.id, appointments, date);
            return (
              <div key={doc.id} className="min-w-[200px] flex-1 px-2 py-2.5 relative" style={{ borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: off ? 0.5 : 1 }} role="columnheader" aria-label={`Doctor: ${doc.name}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${docColor}20`, color: docColor }}>
                    {getInitials(doc.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{doc.name}</div>
                    <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {off ? 'Day Off' : hours ? `${hours.start} - ${hours.end}` : 'No Schedule'}
                    </div>
                  </div>
                  {off && (
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(244,67,54,0.2)', color: '#F44336' }}>OFF</span>
                  )}
                </div>
                {!off && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(79,209,255,0.12)', color: '#4FD1FF' }}>{stats.total} appts</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(76,175,80,0.12)', color: '#4CAF50' }}>{stats.completed} done</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,152,0,0.12)', color: '#FF9800' }}>{stats.waiting} wait</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(156,39,176,0.12)', color: '#9C27B0' }}>{stats.working} work</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(244,67,54,0.12)', color: '#F44336' }}>{stats.cancelled} cancel</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Grid */}
      <div ref={scrollRef} className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 320px)', scrollBehavior: 'smooth' }}>
        {HOURS.map(hour => {
          const isCurrentHour = today && hour === Math.floor(currentTime);
          return (
            <div key={hour} className="flex relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: rowHeight }}>
              {/* Sticky Time Label */}
              <div className="w-16 shrink-0 sticky left-0 z-10 flex items-start justify-center pt-1" style={{ background: 'rgba(5,11,20,0.96)' }}>
                <span className="text-[10px] font-mono" style={{ color: isCurrentHour ? '#4FD1FF' : 'rgba(255,255,255,0.3)', fontWeight: isCurrentHour ? 700 : 400 }}>
                  {formatHour(hour)}
                </span>
              </div>

              {/* Doctor Columns */}
              {doctors.map((doc, di) => {
                const isOff = !isWorkingHour(doc.id, doctorSchedules || {}, dayOfWeek, hour);
                const isDocOffDay = isOffDay(doc.id, doctorSchedules || {}, dayOfWeek);
                const appts = appointments.filter(a => {
                  const d = new Date(a.appointment_date);
                  return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear() && d.getHours() === hour && a.doctor_id === doc.id;
                });

                return (
                  <div
                    key={doc.id}
                    className="min-w-[200px] flex-1 relative transition-colors"
                    style={{
                      borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                      background: isDocOffDay
                        ? 'rgba(0,0,0,0.35)'
                        : isOff
                          ? 'rgba(0,0,0,0.2)'
                          : isCurrentHour
                            ? 'rgba(79,209,255,0.04)'
                            : 'transparent',
                      opacity: isDocOffDay ? 0.25 : isOff ? 0.45 : 1,
                      cursor: 'pointer',
                    }}
                    onClick={() => onSlotClick(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).toISOString(), doc.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, doc.id, hour)}
                    role="gridcell"
                    aria-label={`${doc.name} at ${formatHour(hour)}`}
                  >
                    {isDocOffDay && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                        <span className="text-[48px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.03)' }}>OFF</span>
                      </div>
                    )}
                    {appts.map(app => (
                      <AppointmentBlock
                        key={app.id}
                        appointment={app}
                        onClick={onAppointmentClick}
                        onContextMenu={onAppointmentContextMenu}
                        onDrop={onAppointmentDrop}
                        onResize={onResize}
                        selected={app.id === selectedAppointmentId}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Current Time Indicator */}
        {today && (
          <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: timeIndicatorTop }}>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full shrink-0 ml-1" style={{ background: '#F44336', boxShadow: '0 0 6px rgba(244,67,54,0.8)' }} />
              <div className="flex-1" style={{ height: '2px', background: '#F44336' }} />
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-l-none rounded-r ml-0" style={{ background: '#F44336', color: 'white' }}>
                {formatCurrentTime()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
