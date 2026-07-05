import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../services/appointmentService';
import type { Appointment } from '../types';

export function useAppointments() {
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading: loading, error } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => appointmentService.getAll()
  });

  const createMutation = useMutation({
    mutationFn: (appointmentOrReason?: Omit<Appointment, 'id'> | { change_reason?: string; reason_category?: string }) => {
      if (typeof appointmentOrReason === 'object' && 'change_reason' in appointmentOrReason) {
        // Check if it's reason info
        return appointmentService.create(
          { patient_id: (appointmentOrReason as any).patient_id || undefined,
            appointment_date: (appointmentOrReason as any).appointment_date
              ? (appointmentOrReason as any).appointment_date
              : new Date().toISOString(),
            status: 'scheduled',
          },
          (appointmentOrReason as any).change_reason,
          (appointmentOrReason as any).reason_category,
        );
      } else {
        // Check if it's an appointment
        return appointmentService.create(appointmentOrReason as Omit<Appointment, 'id'>);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: Error) => console.error('Appointment creation error:', err.message),
  });

  const addAppointment = async (newApp: Omit<Appointment, 'id'>) => {
    return createMutation.mutateAsync(newApp);
  };

  return {
    appointments,
    loading,
    error: error ? (error as Error).message : null,
    addAppointment,
    isSubmitting: createMutation.isPending
  };
}