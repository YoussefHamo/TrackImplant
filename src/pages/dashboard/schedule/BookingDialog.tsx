import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
    } else {
      resetForm();
    }
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
    if (!daySchedule) {
      setScheduleWarning(`Dr. ${selectedDoctorName} does not work on this day.`);
      return;
    }
    const apptTime = time;
    if (apptTime < daySchedule.start_time.slice(0, 5) || apptTime >= daySchedule.end_time.slice(0, 5)) {
      setScheduleWarning(`This appointment is outside Dr. ${selectedDoctorName}'s normal working hours (${daySchedule.start_time.slice(0, 5)} - ${daySchedule.end_time.slice(0, 5)}).`);
    } else {
      setScheduleWarning(null);
    }
  }

  useEffect(() => { checkSchedule(); }, [doctorId, date, time, doctorSchedule]);

  async function handleSubmit() {
    if (!patientId || !doctorId || !date || !time) return;

    const appointmentDate = new Date(`${date}T${time}:00`).toISOString();

    try {
      const { hasOverlap, appointments: conflicts } = await appointmentService.checkOverlap(doctorId, appointmentDate, duration, appointment?.id);
      if (hasOverlap) {
        setConflictApps(conflicts);
        setShowWarning(true);
        return;
      }
    } catch {
      toast.error('Could not verify schedule — please try again');
      return;
    }

    try {
      await onSave({ patient_id: patientId, doctor_id: doctorId, appointment_date: appointmentDate, duration_minutes: duration, status: appointment?.status || 'scheduled', procedure_name: procedureName || undefined, notes, branch_id: activeBranchId || undefined });
      resetForm();
      onClose();
    } catch {
      // onError handled by mutation's onError callback
    }
  }

  async function handleContinueAnyway() {
    setShowWarning(false);
    try {
      await onSave({ patient_id: patientId, doctor_id: doctorId, appointment_date: new Date(`${date}T${time}:00`).toISOString(), duration_minutes: duration, status: appointment?.status || 'scheduled', procedure_name: procedureName || undefined, notes, branch_id: activeBranchId || undefined });
      resetForm();
      onClose();
    } catch {
      // onError handled by mutation's onError callback
    }
  }

  const inputClass = 'w-full h-10 px-3 rounded-xl text-sm outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500';

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 'var(--z-dialog-overlay)', background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) { if (!showWarning) onClose(); } }}>
        <div className="w-full max-w-md rounded-[24px] max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(13,24,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
            <h2 className="text-lg font-bold text-white">{appointment ? 'Edit Appointment' : 'New Appointment'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Patient *</label>
              <select value={patientId} onChange={e => setPatientId(e.target.value)} className={inputClass}>
                <option value="" style={{ background: '#0D1B2A', color: '#888' }}>Select patient...</option>
                {(patients || []).map((p: any) => (
                  <option key={p.id} value={p.id} style={{ background: '#0D1B2A', color: 'white' }}>{p.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Doctor *</label>
              <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className={inputClass}>
                <option value="" style={{ background: '#0D1B2A', color: '#888' }}>Select doctor...</option>
                {(doctors || []).map((d: any) => (
                  <option key={d.auth_user_id} value={d.auth_user_id} style={{ background: '#0D1B2A', color: 'white' }}>{d.full_name || d.username}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Time *</label>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Duration (minutes)</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className={inputClass}>
                {[15, 30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m} style={{ background: '#0D1B2A', color: 'white' }}>{m} min</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Procedure</label>
              <input type="text" value={procedureName} onChange={e => setProcedureName(e.target.value)} placeholder="e.g. Implant, Crown, Cleaning..." className={inputClass} />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputClass + ' h-20 pt-2 resize-none'} rows={2} />
            </div>

            {scheduleWarning && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)', color: '#FFC107' }}>
                {scheduleWarning}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
            <button onClick={onClose} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
            <button onClick={handleSubmit} className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
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
