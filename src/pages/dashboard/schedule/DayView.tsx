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
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayView({ date, appointments, doctors, doctorSchedules, onAppointmentClick, onAppointmentContextMenu, onSlotClick, onAppointmentDrop, onResize, zoomLevel }: DayViewProps) {
  const getApptsForDoctor = (doctorId: string, hour: number) =>
    appointments.filter(a => {
      const d = new Date(a.appointment_date);
      return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear() && d.getHours() === hour && a.doctor_id === doctorId;
    });

  function isWorkingHour(doctorId: string, hour: number): boolean {
    const scheds = doctorSchedules?.[doctorId];
    if (!scheds || scheds.length === 0) return true;
    const dayOfWeek = date.getDay();
    const daySchedule = scheds.find(s => s.day_of_week === dayOfWeek);
    if (!daySchedule) return false;
    const startH = parseInt(daySchedule.start_time.split(':')[0]);
    const endH = parseInt(daySchedule.end_time.split(':')[0]);
    return hour >= startH && hour < endH;
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, doctorId: string, hour: number) => {
    e.preventDefault();
    if (!onAppointmentDrop) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const newDate = new Date(date);
      newDate.setHours(hour, 0, 0, 0);
      onAppointmentDrop(data.id, newDate.toISOString(), doctorId);
    } catch { /* ignore */ }
  };

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-3 text-sm font-semibold text-white" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {dateStr}
      </div>

      {doctors.length > 0 && (
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="w-16 shrink-0" />
          {doctors.map(doc => {
            const allOff = !doctorSchedules?.[doc.id]?.length || !doctorSchedules[doc.id].find(s => s.day_of_week === date.getDay());
            return (
              <div key={doc.id} className="flex-1 text-center py-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', opacity: allOff ? 0.4 : 1 }}>
                <span className="text-xs font-medium" style={{ color: allOff ? 'rgba(255,255,255,0.3)' : '#4FD1FF' }}>{doc.name}</span>
                {allOff && <div className="text-[9px] text-white/30">Off</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {HOURS.map(hour => (
          <div key={hour} className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: Math.round(60 * (zoomLevel || 1)) }}>
            <div className="w-16 shrink-0 flex items-start justify-center pt-1">
              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
            {doctors.map((doc, di) => {
              const isOff = !isWorkingHour(doc.id, hour);
              const appts = getApptsForDoctor(doc.id, hour);
              return (
                <div
                  key={doc.id}
                  className="flex-1 relative transition-colors"
                  style={{
                    borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                    background: isOff ? 'rgba(255,255,255,0.02)' : 'transparent',
                    opacity: isOff ? 0.35 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => onSlotClick(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).toISOString(), doc.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, doc.id, hour)}
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
    </div>
  );
}
