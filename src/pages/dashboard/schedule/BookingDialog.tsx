import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientService } from '../../../services/patientService';
import { userService } from '../../../services/userService';
import { appointmentService } from '../../../services/appointmentService';
import { doctorScheduleService } from '../../../services/doctorScheduleService';
import Portal from '../../../components/ui/Portal';
import { useBranch } from '../../../context/BranchContext';
import DoubleBookingWarning from './DoubleBookingWarning';
import TimePicker from '../../../components/ui/TimePicker';
import type { Appointment } from '../../../types';

interface BookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    duration_minutes: number;
    status: string;
    procedure_name?: string;
    notes?: string;
    branch_id?: string;
  }) => Promise<void>;
  appointment?: Appointment | null;
  defaultDate?: string;
  defaultDoctorId?: string;
}

export default function BookingDialog({ isOpen, onClose, onSave, appointment, defaultDate, defaultDoctorId }: BookingDialogProps) {
  const { activeBranchId } = useBranch();
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [procedureName, setProcedureName] = useState('');
  const [notes, setNotes] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [conflictApps, setConflictApps] = useState<Appointment[]>([]);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  const { data: patients } = useQuery({ queryKey: ['patients'], queryFn: () => patientService.getAll() });
  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: () => userService.getAll().then(users => users.filter(u => u.role === 'Doctor')) });

  const { data: doctorSchedule } = useQuery({
    queryKey: ['doctor-schedule', doctorId],
    queryFn: () => doctorScheduleService.getByDoctor(doctorId),
    enabled: !!doctorId,
  });

  useEffect(() => {
    if (appointment) {
      setPatientId(appointment.patient_id || '');
      setDoctorId(appointment.doctor_id || '');
      const d = new Date(appointment.appointment_date);
      setDate(d.toISOString().split('T')[0]);
      setTime(d.toTimeString().slice(0, 5));
      setDuration(appointment.duration_minutes || 30);
      setProcedureName(appointment.procedure_name || '');
      setNotes(appointment.notes || '');
    } else { resetForm(); }
  }, [appointment, isOpen]);

  function resetForm() {
    setPatientId('');
    setDoctorId(defaultDoctorId || '');
    setDate(defaultDate || new Date().toISOString().split('T')[0]);
    setTime('09:00');
    setDuration(30);
    setProcedureName('');
    setNotes('');
    setScheduleWarning(null);
    setShowWarning(false);
  }

  const selectedDoctor = doctors?.find(d => d.auth_user_id === doctorId);
  const selectedDoctorName = selectedDoctor?.full_name || selectedDoctor?.username || 'Doctor';

  function checkSchedule() {
    if (!doctorSchedule || doctorSchedule.length === 0 || !date || !time) return;
    const dayOfWeek = new Date(date + 'T' + time).getDay();
    const daySchedule = doctorSchedule.find(s => s.day_of_week === dayOfWeek);
    if (!daySchedule) { setScheduleWarning(`Dr. ${selectedDoctorName} does not work on this day.`); return; }
    const apptTime = time;
    if (apptTime < daySchedule.start_time.slice(0, 5) || apptTime >= daySchedule.end_time.slice(0, 5)) {
      setScheduleWarning(`This appointment is outside Dr. ${selectedDoctorName}'s normal working hours (${daySchedule.start_time.slice(0, 5)} - ${daySchedule.end_time.slice(0, 5)}).`);
    } else { setScheduleWarning(null); }
  }

  useEffect(() => { checkSchedule(); }, [doctorId, date, time, doctorSchedule]);

  async function handleSubmit() {
    if (!patientId || !doctorId || !date || !time) return;
    const appointmentDate = new Date(`${date}T${time}:00`).toISOString();
    try {
      const { hasOverlap, appointments: conflicts } = await appointmentService.checkOverlap(doctorId, appointmentDate, duration, appointment?.id);
      if (hasOverlap) { setConflictApps(conflicts); setShowWarning(true); return; }
    } catch { toast.error('Could not verify schedule — please try again'); return; }
    try {
      await onSave({ patient_id: patientId, doctor_id: doctorId, appointment_date: appointmentDate, duration_minutes: duration, status: appointment?.status || 'scheduled', procedure_name: procedureName || undefined, notes, branch_id: activeBranchId || undefined });
      resetForm(); onClose();
    } catch { /* onError handled by mutation */ }
  }

  async function handleContinueAnyway() {
    setShowWarning(false);
    try {
      await onSave({ patient_id: patientId, doctor_id: doctorId, appointment_date: new Date(`${date}T${time}:00`).toISOString(), duration_minutes: duration, status: appointment?.status || 'scheduled', procedure_name: procedureName || undefined, notes, branch_id: activeBranchId || undefined });
      resetForm(); onClose();
    } catch { /* onError handled by mutation */ }
  }

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 'var(--z-dialog-overlay)', background: 'var(--app-overlay)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget && !showWarning) onClose(); }}>
        <div className="w-full max-w-md rounded-[24px] max-h-[90vh] overflow-y-auto glass-strong">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderBottom: '1px solid var(--app-border)' }}>
            <h2 className="text-lg font-bold text-[var(--app-text)] font-sans">{appointment ? 'Edit Appointment' : 'New Appointment'}</h2>
            <button onClick={onClose} className="btn-ghost btn-xs w-8 h-8 rounded-xl p-0 flex items-center justify-center" aria-label="Close dialog">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {/* Patient */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Patient *</label>
              <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input-cyber" aria-label="Select patient">
                <option value="">Select patient...</option>
                {(patients || []).map((p: any) => (<option key={p.id} value={p.id}>{p.full_name}</option>))}
              </select>
            </div>

            {/* Doctor */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Doctor *</label>
              <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input-cyber" aria-label="Select doctor">
                <option value="">Select doctor...</option>
                {(doctors || []).map((d: any) => (<option key={d.auth_user_id} value={d.auth_user_id}>{d.full_name || d.username}</option>))}
              </select>
            </div>

            {/* Date + Time */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-cyber" aria-label="Appointment date" />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Time *</label>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="input-cyber" aria-label="Appointment duration">
                {[15, 30, 45, 60, 90, 120].map(m => (<option key={m} value={m}>{m} min</option>))}
              </select>
            </div>

            {/* Procedure */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Procedure</label>
              <input type="text" value={procedureName} onChange={e => setProcedureName(e.target.value)} placeholder="e.g. Implant, Crown, Cleaning..." className="input-cyber" aria-label="Procedure name" />
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block font-sans" style={{ color: 'var(--app-text-muted)' }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-cyber h-20 pt-2 resize-none" rows={2} aria-label="Appointment notes" />
            </div>

            {/* Schedule Warning */}
            {scheduleWarning && (
              <div className="p-3 rounded-xl text-xs flex items-start gap-2 font-sans"
                style={{ background: 'var(--color-warning-container)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--color-warning)' }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{scheduleWarning}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderTop: '1px solid var(--app-border)' }}>
            <button onClick={onClose} className="btn-ghost h-10 px-5 rounded-xl text-sm font-medium">
              Cancel
            </button>
            <button onClick={handleSubmit} className="btn-primary h-10 px-6 rounded-xl text-sm font-bold">
              {appointment ? 'Save Changes' : 'Book Appointment'}
            </button>
          </div>
        </div>
      </div>

      {showWarning && (
        <DoubleBookingWarning
          conflictingAppointments={conflictApps}
          doctorName={selectedDoctorName}
          onContinue={handleContinueAnyway}
          onCancel={() => { setShowWarning(false); }}
        />
      )}
    </Portal>
  );
}
