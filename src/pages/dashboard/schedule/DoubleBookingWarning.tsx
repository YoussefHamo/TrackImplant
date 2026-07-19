import { AlertTriangle, Clock, User } from 'lucide-react';
import type { Appointment } from '../../../types';

interface DoubleBookingWarningProps {
  conflictingAppointments: Appointment[];
  doctorName: string;
  onContinue: () => void;
  onCancel: () => void;
}

export default function DoubleBookingWarning({
  conflictingAppointments, doctorName, onContinue, onCancel,
}: DoubleBookingWarningProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-max)', background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-[24px] p-6 glass-strong font-sans">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-warning-container)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--app-text)]">Schedule Conflict</h3>
            <p className="text-sm" style={{ color: 'var(--app-text-dim)' }}>
              Dr. {doctorName} already has an appointment{conflictingAppointments.length > 1 ? 's' : ''} at this time:
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {conflictingAppointments.map((app) => {
            const t = new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            return (
              <div key={app.id} className="p-3 rounded-xl" style={{ background: 'var(--color-warning-container)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div className="flex items-center gap-2 text-sm text-[var(--app-text)] font-medium font-sans">
                  <User className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
                  <span>{app.patient_name || 'Unknown Patient'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--app-text-dim)' }}>
                  <Clock className="w-3 h-3" />
                  <span>at {t}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs font-sans mb-5" style={{ color: 'var(--app-text-muted)' }}>
          Creating this appointment may cause a scheduling conflict. Do you want to continue anyway?
        </p>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost h-10 px-5 rounded-xl text-sm font-medium">
            Cancel
          </button>
          <button onClick={onContinue} className="btn-secondary h-10 px-5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white', border: 'none' }}>
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
