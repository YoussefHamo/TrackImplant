import type { Appointment } from '../../../types';

interface DoubleBookingWarningProps {
  conflictingAppointments: Appointment[];
  doctorName: string;
  onContinue: () => void;
  onCancel: () => void;
}

export default function DoubleBookingWarning({
  conflictingAppointments,
  doctorName,
  onContinue,
  onCancel,
}: DoubleBookingWarningProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999, background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-[24px] p-6" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-lg font-bold text-white mb-2">Warning</h3>
        <p className="text-sm text-white/70 mb-4">
          Dr. {doctorName} already has an appointment{conflictingAppointments.length > 1 ? 's' : ''} at this time:
        </p>
        <div className="space-y-2 mb-4">
          {conflictingAppointments.map((app) => {
            const t = new Date(app.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            return (
              <div key={app.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
                <div className="text-sm text-white font-medium">{app.patient_name || 'Unknown Patient'}</div>
                <div className="text-xs text-white/50">at {t}</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-white/40 mb-5">
          Creating this appointment may cause a scheduling conflict. Do you want to continue anyway?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="h-10 px-5 rounded-xl text-sm font-medium transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button onClick={onContinue}
            className="h-10 px-5 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white' }}>
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
