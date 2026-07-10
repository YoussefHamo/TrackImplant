import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import AppointmentBlock from './AppointmentBlock';
import type { Appointment, DoctorSchedule } from '../../../types';

interface WeekViewProps {
  startDate: Date;
  appointments: Appointment[];
  doctors: { id: string; name: string }[];
  doctorSchedules?: Record<string, DoctorSchedule[]>;
  onAppointmentDoubleClick: (app: Appointment) => void;
  onAppointmentContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  onSlotClick: (date: string, doctorId: string) => void;
  onAppointmentDrop?: (appointmentId: string, newDate: string, doctorId?: string) => void;
  onResize?: (appointmentId: string, newDuration: number) => void;
  zoomLevel?: number;
  selectedAppointmentId?: string;
  onSelectAppointment?: (app: Appointment | null) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function getWorkingHours(doctorId: string, schedules: Record<string, DoctorSchedule[]>, dayOfWeek: number): { start: string; end: string } | null {
  const scheds = schedules[doctorId];
  if (!scheds || scheds.length === 0) return null;
  const daySchedule = scheds.find(s => s.day_of_week === dayOfWeek);
  if (!daySchedule) return null;
  return { start: daySchedule.start_time.slice(0, 5), end: daySchedule.end_time.slice(0, 5) };
}

function isOffDay(doctorId: string, schedules: Record<string, DoctorSchedule[]>, dayOfWeek: number): boolean {
  return !getWorkingHours(doctorId, schedules, dayOfWeek);
}

function isWorkingHour(doctorId: string, schedules: Record<string, DoctorSchedule[]>, dayOfWeek: number, hour: number): boolean {
  const hours = getWorkingHours(doctorId, schedules, dayOfWeek);
  if (!hours) return false;
  const startH = parseInt(hours.start.split(':')[0]);
  const endH = parseInt(hours.end.split(':')[0]);
  return hour >= startH && hour < endH;
}

function getDoctorStats(dayAppts: Appointment[]) {
  return {
    total: dayAppts.length,
    completed: dayAppts.filter(a => a.status === 'completed').length,
    waiting: dayAppts.filter(a => a.status === 'scheduled' || a.status === 'checked_in').length,
    working: dayAppts.filter(a => a.status === 'working').length,
    cancelled: dayAppts.filter(a => a.status === 'cancelled' || a.status === 'no_show').length,
  };
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const DOCTOR_COLORS = ['#4FD1FF', '#FF9800', '#9C27B0', '#4CAF50', '#FF6B6B', '#FFC107', '#E040FB', '#00BCD4'];

export default function WeekView({
  startDate, appointments, doctors, doctorSchedules, onAppointmentDoubleClick,
  onAppointmentContextMenu, onSlotClick, onAppointmentDrop, onResize, zoomLevel = 1,
  selectedAppointmentId, onSelectAppointment,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(getCurrentTimePosition());

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [startDate]);

  // Today index for current time indicator
  const todayIndex = useMemo(() => days.findIndex(d => isToday(d)), [days]);

  const rowHeight = Math.round(60 * zoomLevel);
  const pxPerMinute = rowHeight / 60;
  const totalHeight = 24 * rowHeight;

  // Update current time
  useEffect(() => {
    if (todayIndex === -1) return;
    const interval = setInterval(() => { setCurrentTime(getCurrentTimePosition()); }, 60000);
    return () => clearInterval(interval);
  }, [todayIndex]);

  // Scroll to working hours
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * rowHeight - 60;
    }
  }, [startDate, zoomLevel, rowHeight]);

  // Build appointment map: key = "dayIdx-doctorId"
  const apptsByDayDoctor = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      const d = new Date(a.appointment_date);
      let dayIdx = -1;
      for (let i = 0; i < days.length; i++) {
        if (d.getDate() === days[i].getDate() && d.getMonth() === days[i].getMonth() && d.getFullYear() === days[i].getFullYear()) {
          dayIdx = i;
          break;
        }
      }
      if (dayIdx === -1) return;
      const docKey = a.doctor_id || 'none';
      const key = `${dayIdx}-${docKey}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments, days]);

  function getAppts(dayIdx: number, doctorId: string) {
    return apptsByDayDoctor[`${dayIdx}-${doctorId}`] || [];
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, day: Date, doctorId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onAppointmentDrop || !scrollRef.current) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutesFromMidnight = Math.floor(y / pxPerMinute);
      const newDate = new Date(day);
      newDate.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0);
      onAppointmentDrop(data.id, newDate.toISOString(), doctorId);
    } catch (e) { console.error('Drop failed', e); }
  }, [onAppointmentDrop, pxPerMinute]);

  const handleSlotClickWithPos = useCallback((e: React.MouseEvent, day: Date, doctorIdx: number, slotHour: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetMinutes = Math.floor((e.clientY - rect.top) / pxPerMinute);
    const minute = Math.min(59, Math.max(0, offsetMinutes));
    const doctorId = doctors[doctorIdx]?.id;
    if (!doctorId) return;
    const slotDate = new Date(day);
    slotDate.setHours(slotHour, minute, 0, 0);
    onSlotClick(slotDate.toISOString(), doctorId);
  }, [doctors, pxPerMinute, onSlotClick]);

  const timeIndicatorTop = currentTime * 60 * pxPerMinute;

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Day Headers */}
      <div className="sticky top-0 z-20 flex" style={{ background: 'rgba(5,11,20,0.98)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-16 shrink-0 sticky left-0 z-10" style={{ background: 'rgba(5,11,20,0.98)' }} />
        {days.map((day, i) => {
          const today = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div key={i} className="flex-1 text-center py-2 relative" style={{
              borderLeft: '1px solid rgba(255,255,255,0.04)',
              background: today ? 'rgba(79,209,255,0.06)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: today ? '#4FD1FF' : 'rgba(255,255,255,0.4)' }}>{DAY_NAMES[day.getDay()]}</div>
              <div className={`text-sm font-bold ${today ? 'text-[#4FD1FF]' : 'text-white'}`}>{day.getDate()}</div>
              {today && <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: '#4FD1FF' }} />}
            </div>
          );
        })}
      </div>

      {/* Doctor Sub-headers per Day */}
      <div className="sticky top-[52px] z-20 flex" style={{ background: 'rgba(5,11,20,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-16 shrink-0 sticky left-0 z-10" style={{ background: 'rgba(5,11,20,0.96)' }} />
        {days.map((day, di) => {
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div key={di} className="flex-1 flex" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', background: isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              {doctors.map((doc, docIdx) => {
                const off = isOffDay(doc.id, doctorSchedules || {}, day.getDay());
                const hours = getWorkingHours(doc.id, doctorSchedules || {}, day.getDay());
                const docColor = DOCTOR_COLORS[docIdx % DOCTOR_COLORS.length];
                const dayAppts = getAppts(di, doc.id);
                const stats = getDoctorStats(dayAppts);
                return (
                  <div key={doc.id} className="min-w-[140px] flex-1 px-1.5 py-1.5 relative" style={{ opacity: off ? 0.45 : 1, borderLeft: docIdx > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0" style={{ background: `${docColor}20`, color: docColor }}>
                        {getInitials(doc.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold text-white truncate">{doc.name.split(' ')[0]}</div>
                        {off && <span className="text-[7px] font-bold uppercase px-1 rounded" style={{ background: 'rgba(244,67,54,0.2)', color: '#F44336' }}>OFF</span>}
                        {!off && hours && <div className="text-[7px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{hours.start}</div>}
                      </div>
                    </div>
                    {!off && stats.total > 0 && (
                      <div className="flex gap-1 mt-1">
                        <span className="text-[7px] px-1 py-0.5 rounded-full font-medium" style={{ background: 'rgba(79,209,255,0.12)', color: '#4FD1FF' }}>{stats.total}</span>
                        <span className="text-[7px] px-1 py-0.5 rounded-full font-medium" style={{ background: 'rgba(76,175,80,0.12)', color: '#4CAF50' }}>{stats.completed}</span>
                        <span className="text-[7px] px-1 py-0.5 rounded-full font-medium" style={{ background: 'rgba(156,39,176,0.12)', color: '#9C27B0' }}>{stats.working}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Time Grid */}
      <div ref={scrollRef} className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 360px)', scrollBehavior: 'smooth' }}>
        <div className="flex" style={{ height: totalHeight }}>
          {/* Sticky Time Labels */}
          <div className="w-16 shrink-0 sticky left-0 z-10" style={{ background: 'rgba(5,11,20,0.96)' }}>
            {HOURS.map(hour => (
              <div key={hour} className="flex items-start justify-center pt-1" style={{ height: rowHeight, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns with doctor sub-columns */}
          {days.map((day, di) => {
            const today = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={di} className="flex-1 flex" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', background: isWeekend ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                {doctors.map((doc, docIdx) => {
                  const off = isOffDay(doc.id, doctorSchedules || {}, day.getDay());
                  const dayAppts = getAppts(di, doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="min-w-[140px] flex-1 relative"
                      style={{
                        height: '100%',
                        borderLeft: '1px solid rgba(255,255,255,0.015)',
                        background: off ? 'rgba(0,0,0,0.35)' : 'transparent',
                        opacity: off ? 0.25 : 1,
                      }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day, doc.id)}
                    >
                      {/* Hour grid lines */}
                      {HOURS.map(hour => {
                        const currentHour = today && hour === Math.floor(currentTime);
                        const isOff = !isWorkingHour(doc.id, doctorSchedules || {}, day.getDay(), hour);
                        return (
                          <div
                            key={hour}
                            className="w-full cursor-pointer"
                            style={{
                              position: 'absolute',
                              top: hour * rowHeight,
                              height: rowHeight,
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              background: off
                                ? 'rgba(0,0,0,0.35)'
                                : isOff
                                  ? 'rgba(0,0,0,0.2)'
                                  : currentHour
                                    ? 'rgba(79,209,255,0.04)'
                                    : 'transparent',
                              opacity: off ? 0.25 : isOff ? 0.45 : 1,
                            }}
                            onClick={(e) => handleSlotClickWithPos(e, day, docIdx, hour)}
                          />
                        );
                      })}

                      {/* OFF watermark */}
                      {off && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
                          <span className="text-[36px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.02)' }}>OFF</span>
                        </div>
                      )}

                      {/* Appointments */}
                      {dayAppts.map(app => {
                        const start = new Date(app.appointment_date);
                        if (isNaN(start.getTime())) return null;
                        const mins = start.getHours() * 60 + start.getMinutes();
                        const dur = app.duration_minutes || 30;
                        return (
                          <div
                            key={app.id}
                            className="absolute left-0.5 right-0.5"
                            style={{
                              top: mins * (rowHeight / 60),
                              height: Math.max(18, dur * (rowHeight / 60)),
                              zIndex: 5,
                            }}
                          >
                            <AppointmentBlock
                              appointment={app}
                              onClick={(a) => { onSelectAppointment?.(a); }}
                              onDoubleClick={(a) => onAppointmentDoubleClick(a)}
                              onContextMenu={onAppointmentContextMenu}
                              onDrop={onAppointmentDrop}
                              onResize={onResize}
                              selected={app.id === selectedAppointmentId}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Current Time Indicator */}
        {todayIndex >= 0 && (
          <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: timeIndicatorTop }}>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full shrink-0 ml-[62px]" style={{ background: '#F44336', boxShadow: '0 0 6px rgba(244,67,54,0.8)' }} />
              <div className="flex-1" style={{ height: '2px', background: '#F44336' }} />
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 shrink-0" style={{ background: '#F44336', color: 'white' }}>
                {formatCurrentTime()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
