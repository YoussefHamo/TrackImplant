import { X, Phone, Clock, User, Syringe, Calendar, MapPin, Edit3, ChevronRight, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import Portal from '../../../components/ui/Portal';
import type { Appointment } from '../../../types';

interface AppointmentDetailsPanelProps {
  appointment: Appointment;
  onClose: () => void;
  onEdit: (app: Appointment) => void;
  onStatusUpdate: (id: string, status: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#4FD1FF',
  checked_in: '#FF9800',
  working: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#9E9E9E',
  no_show: '#F44336',
  postponed: '#FFC107',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  checked_in: 'Checked In',
  working: 'Working',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  postponed: 'Postponed',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AppointmentDetailsPanel({ appointment, onClose, onEdit, onStatusUpdate }: AppointmentDetailsPanelProps) {
  const color = STATUS_COLORS[appointment.status] || '#4FD1FF';
  const start = new Date(appointment.appointment_date);
  const end = appointment.duration_minutes ? new Date(start.getTime() + appointment.duration_minutes * 60000) : null;

  const statusActions = getStatusActions(appointment.status);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="absolute inset-0" style={{ background: 'rgba(5,11,20,0.5)' }} onClick={onClose} />
        <div
          className="relative w-full max-w-md h-full overflow-y-auto animate-slide-in-right"
          style={{
            background: 'rgba(13,24,40,0.98)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5" style={{ background: 'rgba(13,24,40,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-base font-bold text-white">Appointment Details</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: `${color}20`, color }}>
                {STATUS_LABELS[appointment.status] || appointment.status}
              </span>
            </div>

            {/* Patient Section */}
            <div>
              <h3 className="text-lg font-bold text-white">{appointment.patient_name || 'Unknown Patient'}</h3>
              {appointment.patient_phone && (
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <a href={`tel:${appointment.patient_phone}`} className="text-sm" style={{ color: '#4FD1FF' }}>
                    {appointment.patient_phone}
                  </a>
                </div>
              )}
            </div>

            {/* Procedure */}
            {appointment.procedure_name && (
              <div className="flex items-center gap-2">
                <Syringe className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span className="text-sm text-white/80">{appointment.procedure_name}</span>
              </div>
            )}

            {/* Details Grid */}
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <div>
                  <div className="text-sm text-white font-medium">{formatDate(appointment.appointment_date)}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {formatTime(appointment.appointment_date)}
                    {end && ` - ${formatTime(end.toISOString())}`}
                    {' · '}{appointment.duration_minutes || 30} min
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <span className="text-sm text-white/80">{appointment.doctor_name || 'Not assigned'}</span>
              </div>

              {appointment.branch_id && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <span className="text-sm text-white/80">Branch ID: {appointment.branch_id.slice(0, 8)}...</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Notes</label>
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            )}

            {/* Status Actions */}
            {statusActions.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Actions</label>
                <div className="flex flex-wrap gap-2">
                  {statusActions.map(action => (
                    <button
                      key={action.status}
                      onClick={() => onStatusUpdate(appointment.id, action.status)}
                      className="h-10 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5"
                      style={{ background: `${action.color}18`, color: action.color, border: `1px solid ${action.color}30` }}
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Button */}
            <div className="pt-2">
              <button
                onClick={() => onEdit(appointment)}
                className="w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF', border: '1px solid rgba(79,209,255,0.2)' }}
              >
                <Edit3 className="w-4 h-4" /> Edit Appointment
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </Portal>
  );
}

interface StatusAction {
  status: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

function getStatusActions(currentStatus: string): StatusAction[] {
  switch (currentStatus) {
    case 'scheduled':
      return [
        { status: 'checked_in', label: 'Check In', icon: <ChevronRight className="w-3.5 h-3.5" />, color: '#FF9800' },
        { status: 'cancelled', label: 'Cancel', icon: <XCircle className="w-3.5 h-3.5" />, color: '#F44336' },
      ];
    case 'checked_in':
      return [
        { status: 'working', label: 'Start Treatment', icon: <PlayCircle className="w-3.5 h-3.5" />, color: '#9C27B0' },
        { status: 'cancelled', label: 'Cancel', icon: <XCircle className="w-3.5 h-3.5" />, color: '#F44336' },
      ];
    case 'working':
      return [
        { status: 'completed', label: 'Complete', icon: <CheckCircle className="w-3.5 h-3.5" />, color: '#4CAF50' },
        { status: 'cancelled', label: 'Cancel', icon: <XCircle className="w-3.5 h-3.5" />, color: '#F44336' },
      ];
    case 'postponed':
      return [
        { status: 'scheduled', label: 'Reschedule', icon: <Clock className="w-3.5 h-3.5" />, color: '#4FD1FF' },
        { status: 'cancelled', label: 'Cancel', icon: <XCircle className="w-3.5 h-3.5" />, color: '#F44336' },
      ];
    default:
      return [];
  }
}
