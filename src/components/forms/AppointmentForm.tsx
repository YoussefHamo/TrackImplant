import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, User, AlertCircle } from 'lucide-react';
import type { Patient } from '../../types';

const appointmentSchema = z.object({
  patient_id: z.string().min(1, { message: 'Please select a patient' }),
  appointment_date: z
    .string()
    .min(1, { message: 'Please select a date' })
    .refine((date) => new Date(date) >= new Date(new Date().setHours(0,0,0,0)), {
      message: 'Cannot book in the past',
    }),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  patients: Patient[];
  onSubmit: (data: { patient_id: string; appointment_date: string }) => Promise<void>;
  isSubmitting?: boolean;
}

export default function AppointmentForm({ patients, onSubmit, isSubmitting }: AppointmentFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    mode: 'onChange',
  });

  const handleFormSubmit = async (data: AppointmentFormData) => {
    await onSubmit(data);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 bg-[#16191e] border border-[#222630] rounded-xl p-6 shadow-xl font-mono text-white max-w-lg mx-auto">
      <div className="border-b border-[#222630] pb-3 mb-2">
        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Book Appointment</h3>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-gray-400 uppercase tracking-wider block">Patient</label>
        <div className="relative">
          <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
          <select
            {...register('patient_id')}
            className={`w-full bg-[#0d0f12] border ${errors.patient_id ? 'border-red-500/60' : 'border-[#222630]'} focus:border-cyan-500 rounded-lg pl-10 pr-4 py-2.5 text-xs outline-none transition-all text-gray-300 appearance-none`}
          >
            <option value="" style={{ background: '#0d0f12' }}>Select Patient</option>
            {patients.map(p => (
              <option key={p.id} value={p.id} style={{ background: '#0d0f12' }}>{p.full_name}</option>
            ))}
          </select>
        </div>
        {errors.patient_id && (
          <p className="text-[10px] text-red-400 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.patient_id.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-gray-400 uppercase tracking-wider block">Appointment Date</label>
        <div className="relative">
          <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
          <input
            {...register('appointment_date')}
            type="datetime-local"
            className={`w-full bg-[#0d0f12] border ${errors.appointment_date ? 'border-red-500/60' : 'border-[#222630]'} focus:border-cyan-500 rounded-lg pl-10 pr-4 py-2.5 text-xs outline-none transition-all text-gray-300`}
          />
        </div>
        {errors.appointment_date && (
          <p className="text-[10px] text-red-400 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.appointment_date.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-800 disabled:text-gray-400 text-[#0d0f12] font-bold py-3 rounded-lg uppercase tracking-wider text-xs transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-[#0d0f12] border-t-transparent rounded-full animate-spin"></span>
            Booking...
          </span>
        ) : (
          'Book Appointment'
        )}
      </button>
    </form>
  );
}
