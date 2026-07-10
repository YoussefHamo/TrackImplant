import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import AppointmentBlock from './AppointmentBlock';
import type { Appointment, DoctorSchedule } from '../../../types';

interface DayViewProps {
  date: Date;
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
  onQuickAction?: (id: string, action: string) => void;
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
  date, appointments, doctors, doctorSchedules, onAppointmentDoubleClick,
  onAppointmentContextMenu, onSlotClick, onAppointmentDrop, onResize, zoomLevel = 1,
  selectedAppointmentId, onSelectAppointment,
}: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(getCurrentTimePosition());
  const today = isToday(date);
  const dayOfWeek = date.getDay();

  const rowHeight = Math.round(60 * zoomLevel);
  const pxPerMinute = rowHeight / 60;
  const totalHeight = 24 * rowHeight;

  // Update current time every minute
  useEffect(() => {
    if (!today) return;
    const interval = setInterval(() => { setCurrentTime(getCurrentTimePosition()); }, 60000);
    return () => clearInterval(interval);
  }, [today]);

  // Scroll to working hours (08:00) on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * rowHeight - 60;
    }
  }, [date, zoomLevel, rowHeight]);

  const handleGridClick = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current || !scrollRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const minutesFromMidnight = Math.floor(y / pxPerMinute);
    const hour = Math.min(23, Math.max(0, Math.floor(minutesFromMidnight / 60)));
    const minute = Math.min(59, minutesFromMidnight % 60);

    // Determine doctor from column hit-test
    let cumulative = 0;
    let doctorIndex = -1;
    for (let i = 0; i < doctors.length; i++) {
      const colEl = document.getElementById(`dayview-col-${doctors[i].id}`);
      if (colEl) {
        const colW = colEl.offsetWidth;
        if (x >= cumulative && x < cumulative + colW) {
          doctorIndex = i;
          break;
        }
        cumulative += colW;
      }
    }
    if (doctorIndex === -1) return;
    const doctorId = doctors[doctorIndex].id;
    const slotDate = new Date(date);
    slotDate.setHours(hour, minute, 0, 0);
    onSlotClick(slotDate.toISOString(), doctorId);
  }, [date, doctors, pxPerMinute, onSlotClick]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, doctorId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onAppointmentDrop || !scrollRef.current) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const minutesFromMidnight = Math.floor(y / pxPerMinute);
      const newDate = new Date(date);
      newDate.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0);
      onAppointmentDrop(data.id, newDate.toISOString(), doctorId);
    } catch (e) { console.error('Drop parse failed', e); }
  }, [date, onAppointmentDrop, pxPerMinute]);

  const timeIndicatorTop = currentTime * 60 * pxPerMinute;
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Group appointments by doctor for rendering
  const apptsByDoctor = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      const aid = a.doctor_id || 'none';
      if (!map[aid]) map[aid] = [];
      map[aid].push(a);
    });
    console.log('[DayView] doctors:', doctors.map(d => d.id), 'appt doctor_ids:', Object.keys(map), 'doctors with appts:', Object.keys(map).filter(k => map[k].length));
    return map;
  }, [appointments, doctors]);

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
          <div className="w-16 shrink-0 sticky left-0 z-10" style={{ background: 'rgba(5,11,20,0.98)' }} />
          {doctors.map((doc, di) => {
            const off = isOffDay(doc.id, doctorSchedules || {}, dayOfWeek);
            const hours = getWorkingHours(doc.id, doctorSchedules || {}, dayOfWeek);
            const docColor = DOCTOR_COLORS[di % DOCTOR_COLORS.length];
            const stats = getDoctorStats(doc.id, appointments, date);
            return (
              <div key={doc.id} id={`dayview-header-${doc.id}`} className="min-w-[200px] flex-1 px-2 py-2.5 relative" style={{ borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: off ? 0.5 : 1 }}>
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
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)', scrollBehavior: 'smooth', position: 'relative' }}>
        <div ref={gridRef} className="flex relative" style={{ height: totalHeight }} onClick={handleGridClick} onDragOver={handleDragOver}>
          {/* Sticky Time Labels */}
          <div className="w-16 shrink-0 sticky left-0 z-10" style={{ background: 'rgba(5,11,20,0.96)' }}>
            {HOURS.map(hour => {
              const isCurrentHour = today && hour === Math.floor(currentTime);
              return (
                <div key={hour} className="flex items-start justify-center pt-1" style={{ height: rowHeight, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span className="text-[10px] font-mono" style={{ color: isCurrentHour ? '#4FD1FF' : 'rgba(255,255,255,0.3)', fontWeight: isCurrentHour ? 700 : 400 }}>
                    {formatHour(hour)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Doctor Columns */}
          {doctors.map((doc, di) => {
            const off = isOffDay(doc.id, doctorSchedules || {}, dayOfWeek);
            const docAppts = apptsByDoctor[doc.id] || [];
            return (
              <div
                key={doc.id}
                id={`dayview-col-${doc.id}`}
                className="min-w-[200px] flex-1 relative"
                style={{
                  height: '100%',
                  borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                  background: off ? 'rgba(0,0,0,0.35)' : 'transparent',
                  opacity: off ? 0.25 : 1,
                }}
                onDrop={(e) => handleDrop(e, doc.id)}
              >
                {/* Hour grid lines + slot click zones */}
                {HOURS.map(hour => {
                  const isOff = !isWorkingHour(doc.id, doctorSchedules || {}, dayOfWeek, hour);
                  const isCurrentHour = today && hour === Math.floor(currentTime);
                  return (
                    <div
                      key={hour}
                      className="w-full"
                      style={{
                        position: 'absolute',
                        top: hour * rowHeight,
                        height: rowHeight,
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: off
                          ? 'rgba(0,0,0,0.35)'
                          : isOff
                            ? 'rgba(0,0,0,0.2)'
                            : isCurrentHour
                              ? 'rgba(79,209,255,0.04)'
                              : 'transparent',
                        opacity: off ? 0.25 : isOff ? 0.45 : 1,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}

                {/* OFF badge for full day off */}
                {off && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
                    <span className="text-[48px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.03)' }}>OFF</span>
                  </div>
                )}

                {/* Appointments - absolute positioned within doctor column */}
                {docAppts.map(app => {
                  const start = new Date(app.appointment_date);
                  if (isNaN(start.getTime())) return null;
                  const mins = start.getHours() * 60 + start.getMinutes();
                  const dur = app.duration_minutes || 30;
                  return (
                    <div
                      key={app.id}
                      className="absolute left-0.5 right-0.5"
                      style={{
                        top: mins * pxPerMinute,
                        height: Math.max(18, dur * pxPerMinute),
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

          {/* Current Time Indicator */}
          {today && (
            <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: timeIndicatorTop }}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F44336', boxShadow: '0 0 6px rgba(244,67,54,0.8)', marginLeft: '1px' }} />
                <div className="flex-1" style={{ height: '2px', background: '#F44336' }} />
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5" style={{ background: '#F44336', color: 'white' }}>
                  {formatCurrentTime()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
