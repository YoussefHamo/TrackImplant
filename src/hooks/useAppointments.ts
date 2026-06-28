import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../services/appointmentService';
import type { Appointment } from '../types';

export function useAppointments() {
  const queryClient = useQueryClient();

  // 1. جلب البيانات تلقائياً مع ميزة الـ Caching الكامل تحت مفتاح 'appointments'
  const { data: appointments = [], isLoading: loading, error } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: appointmentService.getAll
  });

  // 2. الـ Mutation الخاص بالإرسال مع ميزة الـ Cache Invalidation (تحديث الكاش فوراً)
  const createMutation = useMutation({
    mutationFn: appointmentService.create,
    onSuccess: () => {
      // ⚡ السحر هنا: بنقول للسيستم إن الكاش القديم انتهت صلاحيته، فيعيد الجلب في الخلفية فوراً بدون ريفريش!
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const addAppointment = async (newApp: Omit<Appointment, 'id'>) => {
    return createMutation.mutateAsync(newApp);
  };

  return {
    appointments,
    loading,
    error: error ? (error as Error).message : null,
    addAppointment,
    isSubmitting: createMutation.isPending // شغال حالياً في الإرسال للـ Database
  };
}