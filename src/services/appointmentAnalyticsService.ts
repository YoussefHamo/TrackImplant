import { appointmentService } from './appointmentService';
import type { Appointment } from '../types';

export interface AppointmentAnalytics {
  averageWaitingTime: number;
  averageTreatmentTime: number;
  appointmentDuration: { avg: number; min: number; max: number };
  doctorUtilization: { doctor_id: string; doctor_name: string; utilization: number; total_appointments: number; total_hours: number }[];
  peakHours: { hour: number; count: number }[];
  peakDays: { day: string; count: number }[];
  cancellationRate: number;
  noShowRate: number;
  completionRate: number;
  totalAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completedAppointments: number;
  workingTime: number;
  idleTime: number;
}

const EMPTY_ANALYTICS: AppointmentAnalytics = {
  averageWaitingTime: 0,
  averageTreatmentTime: 0,
  appointmentDuration: { avg: 0, min: 0, max: 0 },
  doctorUtilization: [],
  peakHours: [],
  peakDays: [],
  cancellationRate: 0,
  noShowRate: 0,
  completionRate: 0,
  totalAppointments: 0,
  cancelledAppointments: 0,
  noShowAppointments: 0,
  completedAppointments: 0,
  workingTime: 0,
  idleTime: 0,
};

function parseMinutes(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

export const appointmentAnalyticsService = {
  async getAnalytics(fromDate?: string, toDate?: string, branchId?: string | null, doctorId?: string): Promise<AppointmentAnalytics> {
    try {
      const appointments = await appointmentService.getAll();

      let filtered: Appointment[] = appointments;

      if (branchId) {
        filtered = filtered.filter(a => a.branch_id === branchId);
      }
      if (doctorId) {
        filtered = filtered.filter(a => a.doctor_id === doctorId);
      }
      if (fromDate) {
        filtered = filtered.filter(a => a.appointment_date >= fromDate);
      }
      if (toDate) {
        filtered = filtered.filter(a => a.appointment_date <= toDate);
      }

      const total = filtered.length;
      if (total === 0) return { ...EMPTY_ANALYTICS };

      // Status counts
      const cancelledAppointments = filtered.filter(a => a.status === 'cancelled').length;
      const noShowAppointments = filtered.filter(a => a.status === 'no_show').length;
      const completedAppointments = filtered.filter(a => a.status === 'completed').length;

      // Average waiting time
      const waitingTimes: number[] = [];
      for (const a of filtered) {
        const raw = a as unknown as Record<string, unknown>;
        const wm = parseMinutes(raw.waiting_time_minutes);
        if (wm != null) {
          waitingTimes.push(wm);
        } else {
          const checkedIn = safeDate(raw.checked_in_at);
          const apptDate = safeDate(a.appointment_date);
          if (checkedIn && apptDate) {
            const diff = (checkedIn.getTime() - apptDate.getTime()) / 60000;
            if (diff >= 0) waitingTimes.push(diff);
          }
        }
      }
      const averageWaitingTime = waitingTimes.length > 0
        ? waitingTimes.reduce((s, v) => s + v, 0) / waitingTimes.length
        : 0;

      // Average treatment time
      const treatmentTimes: number[] = [];
      for (const a of filtered) {
        const raw = a as unknown as Record<string, unknown>;
        const tm = parseMinutes(raw.treatment_time_minutes);
        if (tm != null) {
          treatmentTimes.push(tm);
        } else {
          const started = safeDate(raw.started_at);
          const completed = safeDate(raw.completed_at);
          if (started && completed) {
            const diff = (completed.getTime() - started.getTime()) / 60000;
            if (diff >= 0) treatmentTimes.push(diff);
          }
        }
      }
      const averageTreatmentTime = treatmentTimes.length > 0
        ? treatmentTimes.reduce((s, v) => s + v, 0) / treatmentTimes.length
        : 0;

      // Appointment duration aggregates
      const durations = filtered
        .map(a => a.duration_minutes)
        .filter((d): d is number => d != null && d > 0);
      const appointmentDuration = durations.length > 0
        ? {
            avg: durations.reduce((s, v) => s + v, 0) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
          }
        : { avg: 0, min: 0, max: 0 };

      // Doctor utilization
      const doctorMap = new Map<string, { name: string; appointments: Appointment[] }>();
      for (const a of filtered) {
        if (!a.doctor_id) continue;
        if (!doctorMap.has(a.doctor_id)) {
          doctorMap.set(a.doctor_id, { name: a.doctor_name || 'Unknown', appointments: [] });
        }
        doctorMap.get(a.doctor_id)!.appointments.push(a);
      }
      const doctorUtilization = Array.from(doctorMap.entries()).map(([doctor_id, info]) => {
        const totalMinutes = info.appointments.reduce((s, a) => s + (a.duration_minutes || 30), 0);
        const totalHours = totalMinutes / 60;
        const uniqueDays = new Set(info.appointments.map(a => a.appointment_date?.split('T')[0])).size;
        const availableMinutes = uniqueDays * 8 * 60;
        const utilization = availableMinutes > 0 ? (totalMinutes / availableMinutes) * 100 : 0;
        return {
          doctor_id,
          doctor_name: info.name,
          utilization: Math.round(utilization * 100) / 100,
          total_appointments: info.appointments.length,
          total_hours: Math.round(totalHours * 100) / 100,
        };
      });

      // Peak hours
      const hourCounts: Record<number, number> = {};
      for (const a of filtered) {
        const hour = new Date(a.appointment_date).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      const peakHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: Number(hour), count }))
        .sort((a, b) => b.count - a.count);

      // Peak days
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayCounts: Record<string, number> = {};
      for (const a of filtered) {
        const day = dayNames[new Date(a.appointment_date).getDay()];
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
      const peakDays = Object.entries(dayCounts)
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => b.count - a.count);

      // Rates
      const cancellationRate = (cancelledAppointments / total) * 100;
      const noShowRate = (noShowAppointments / total) * 100;
      const completionRate = (completedAppointments / total) * 100;

      // Working time: sum duration_minutes for active statuses
      const workingTime = filtered
        .filter(a => ['working', 'completed', 'checked_in'].includes(a.status))
        .reduce((s, a) => s + (a.duration_minutes || 30), 0) / 60;

      // Idle time: gaps between consecutive appointments per doctor
      let idleTotalMinutes = 0;
      for (const [, info] of doctorMap) {
        const sorted = [...info.appointments].sort(
          (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
        );
        for (let i = 1; i < sorted.length; i++) {
          const prevEnd = new Date(sorted[i - 1].appointment_date).getTime()
            + (sorted[i - 1].duration_minutes || 30) * 60000;
          const currStart = new Date(sorted[i].appointment_date).getTime();
          const gap = (currStart - prevEnd) / 60000;
          if (gap > 0 && gap < 480) {
            idleTotalMinutes += gap;
          }
        }
      }
      const idleTime = idleTotalMinutes / 60;

      return {
        averageWaitingTime: Math.round(averageWaitingTime * 100) / 100,
        averageTreatmentTime: Math.round(averageTreatmentTime * 100) / 100,
        appointmentDuration: {
          avg: Math.round(appointmentDuration.avg * 100) / 100,
          min: appointmentDuration.min,
          max: appointmentDuration.max,
        },
        doctorUtilization,
        peakHours,
        peakDays,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        noShowRate: Math.round(noShowRate * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        totalAppointments: total,
        cancelledAppointments,
        noShowAppointments,
        completedAppointments,
        workingTime: Math.round(workingTime * 100) / 100,
        idleTime: Math.round(idleTime * 100) / 100,
      };
    } catch (error) {
      console.error('Error fetching appointment analytics:', error);
      return { ...EMPTY_ANALYTICS };
    }
  },
};
