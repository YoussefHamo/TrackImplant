import type { Appointment } from '../../../types';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#4FD1FF',
  checked_in: '#FF9800',
  working: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#9E9E9E',
  no_show: '#F44336',
  postponed: '#FFC107',
};

interface AppointmentBlockProps {
  appointment: Appointment;
  onClick: (app: Appointment) => void;
  onContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  compact?: boolean;
}

export default function AppointmentBlock({ appointment, onClick, onContextMenu, compact }: AppointmentBlockProps) {
  const color = STATUS_COLORS[appointment.status] || '#4FD1FF';
  const start = new Date(appointment.appointment_date);
  const timeStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      onClick={() => onClick(appointment)}
      onContextMenu={(e) => onContextMenu(e, appointment)}
      style={{ borderLeft: `3px solid ${color}`, background: `${color}15`, cursor: 'pointer' }}
      className="rounded-lg px-2 py-1 text-xs hover:brightness-110 transition-all truncate select-none mb-0.5"
    >
      {compact ? (
        <span className="text-white/90 font-medium truncate">{appointment.patient_name || 'Unknown'}</span>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono" style={{ color }}>{timeStr}</span>
            <span className="text-white/80 font-medium truncate">{appointment.patient_name || 'Unknown'}</span>
          </div>
          {appointment.doctor_name && (
            <div className="text-[10px] text-white/40 truncate">{appointment.doctor_name}</div>
          )}
        </>
      )}
    </div>
  );
}

export { STATUS_COLORS };
