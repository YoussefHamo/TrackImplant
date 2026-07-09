import AppointmentBlock from './AppointmentBlock';
import type { Appointment } from '../../../types';

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  doctors: { id: string; name: string }[];
  onAppointmentClick: (app: Appointment) => void;
  onAppointmentContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  onSlotClick: (date: string, doctorId: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayView({ date, appointments, doctors, onAppointmentClick, onAppointmentContextMenu, onSlotClick }: DayViewProps) {
  const getApptsForDoctor = (doctorId: string, hour: number) =>
    appointments.filter(a => {
      const d = new Date(a.appointment_date);
      return d.getHours() === hour && a.doctor_id === doctorId;
    });

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-3 text-sm font-semibold text-white" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {dateStr}
      </div>

      {/* Doctor column headers */}
      {doctors.length > 0 && (
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="w-16 shrink-0" />
          {doctors.map(doc => (
            <div key={doc.id} className="flex-1 text-center py-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-xs font-medium" style={{ color: '#4FD1FF' }}>{doc.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {HOURS.map(hour => (
          <div key={hour} className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: 60 }}>
            <div className="w-16 shrink-0 flex items-start justify-center pt-1">
              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
            {doctors.map((doc, di) => {
              const slotDate = new Date(date);
              slotDate.setHours(hour, 0, 0, 0);
              const appts = getApptsForDoctor(doc.id, hour);
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
    </div>
  );
}
