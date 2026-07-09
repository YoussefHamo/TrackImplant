import { timelineEventService } from './timelineEventService';
import type { TimelineEventWrite } from './timelineEventService';

export interface TimelineEvent {
  id: string;
  event_type: string;
  description: string;
  date: string;
  time: string;
  user_name?: string;
  branch_name?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  icon: string;
  metadata?: Record<string, unknown>;
}

function getIconForEventType(eventType: string): string {
  if (eventType.startsWith('appointment_')) {
    const map: Record<string, string> = {
      appointment_scheduled: '📅', appointment_checked_in: '✅',
      appointment_working: '🔧', appointment_completed: '✔️',
      appointment_cancelled: '✖️', appointment_no_show: '🚫',
      appointment_postponed: '⏰',
    };
    return map[eventType] || '📅';
  }
  if (eventType.startsWith('procedure_')) return eventType.includes('deleted') ? '🗑️' : eventType.includes('completed') ? '✅' : '🔬';
  if (eventType.startsWith('invoice')) return '💰';
  if (eventType.startsWith('payment')) return '💵';
  if (eventType.startsWith('refund')) return '↩️';
  if (eventType.startsWith('communication')) return '📝';
  if (eventType.startsWith('follow_up')) return '🩺';
  if (eventType.startsWith('reminder')) return '🔔';
  return '📋';
}

function formatTime(isoString?: string): string {
  if (!isoString) return '00:00';
  try {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '00:00';
  }
}

export const timelineService = {
  async getByPatient(patientId: string): Promise<TimelineEvent[]> {
    try {
      const events = await timelineEventService.getByPatient(patientId);
      if (events.length > 0) {
        return events.map(e => ({
        id: `tl-${e.id}`,
        event_type: e.event_type,
        description: e.description,
        date: e.created_at,
        time: formatTime(e.created_at),
        user_name: e.user_name,
        branch_name: e.branch_name,
        related_entity_type: e.related_entity_type,
        related_entity_id: e.related_entity_id,
        icon: getIconForEventType(e.event_type),
        metadata: e.metadata,
      }));
      }
    } catch { /* fall through to legacy */ }

    const { communicationService } = await import('./communicationService');
    const { appointmentService } = await import('./appointmentService');
    const { procedureService } = await import('./procedureService');
    const { financialRecordService } = await import('./financialRecordService');
    const { reminderService } = await import('./reminderService');
    const { followUpService } = await import('./followUpService');

    const [comms, appts, procs, finRecords, reminders, followUps] = await Promise.all([
      communicationService.getByPatient(patientId).catch(() => []),
      appointmentService.getByPatient(patientId).catch(() => []),
      procedureService.getByPatient(patientId).catch(() => []),
      financialRecordService.getByPatient(patientId).catch(() => []),
      reminderService.getByPatient(patientId).catch(() => []),
      followUpService.getByPatient(patientId).catch(() => []),
    ]);

    const result: TimelineEvent[] = [];

    for (const c of comms) {
      result.push({
        id: `comm-${c.id}`, event_type: 'communication_added',
        description: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${c.type}: ${c.subject || '(no subject)'}`,
        date: c.created_at || '', time: formatTime(c.created_at),
        user_name: c.staff_name, icon: c.type === 'call' ? '📞' : c.type === 'whatsapp' ? '💬' : c.type === 'sms' ? '✉️' : c.type === 'email' ? '📧' : '📝',
        related_entity_type: 'communication', related_entity_id: c.id,
        metadata: { type: c.type, direction: c.direction },
      });
    }

    for (const a of appts) {
      result.push({
        id: `appt-${a.id}`, event_type: `appointment_${a.status}`,
        description: `Appointment ${a.status}${a.doctor_name ? ` with Dr. ${a.doctor_name}` : ''}`,
        date: a.appointment_date || '', time: formatTime(a.appointment_date),
        user_name: a.doctor_name, icon: getIconForEventType(`appointment_${a.status}`),
        related_entity_type: 'appointment', related_entity_id: a.id,
        metadata: { status: a.status },
      });
    }

    for (const p of procs) {
      const et = p.is_deleted ? 'procedure_deleted' : p.status === 'completed' ? 'procedure_completed' : 'procedure_created';
      result.push({
        id: `proc-${p.id}`, event_type: et,
        description: `${p.procedure_name}${p.tooth_number ? ` (Tooth #${p.tooth_number})` : ''} — ${p.status}`,
        date: p.deleted_at || p.procedure_date || p.created_at || '', time: formatTime(p.deleted_at || p.created_at),
        user_name: p.doctor_name, icon: getIconForEventType(et),
        related_entity_type: 'procedure', related_entity_id: p.id,
        metadata: { status: p.status, is_deleted: p.is_deleted, tooth_number: p.tooth_number },
      });
    }

    for (const r of finRecords) {
      const et = r.record_type === 'invoice' ? 'invoice_created' : r.amount < 0 ? 'refund_created' : 'payment_added';
      result.push({
        id: `fin-${r.id}`, event_type: et,
        description: r.record_type === 'invoice' ? `Invoice: ${r.invoice_name || r.id} — $${r.total_amount.toFixed(2)} (${r.status})` : `${r.amount < 0 ? 'Refund' : 'Payment'}: $${Math.abs(r.amount).toFixed(2)}`,
        date: r.created_at || '', time: formatTime(r.created_at),
        branch_name: r.branch_name || undefined, icon: getIconForEventType(et),
        related_entity_type: 'financial_record', related_entity_id: r.id,
        metadata: { record_type: r.record_type, amount: r.amount },
      });
    }

    for (const r of reminders) {
      result.push({
        id: `rem-${r.id}`, event_type: 'reminder_sent',
        description: r.title + (r.message ? `: ${r.message}` : ''),
        date: r.sent_at || r.scheduled_for || r.created_at || '', time: formatTime(r.sent_at || r.created_at),
        icon: '🔔', related_entity_type: 'reminder', related_entity_id: r.id,
        metadata: { reminder_type: r.reminder_type },
      });
    }

    for (const f of followUps) {
      result.push({
        id: `fu-${f.id}`, event_type: 'follow_up_created',
        description: `Follow-up — Healing: ${f.healing_status || 'unknown'}${f.health_score != null ? `, Health: ${f.health_score}` : ''}`,
        date: f.created_at || '', time: formatTime(f.created_at),
        icon: '🩺', related_entity_type: 'follow_up', related_entity_id: f.id,
        metadata: { healing_status: f.healing_status, health_score: f.health_score, pain_level: f.pain_level },
      });
    }

    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  },

  async write(event: TimelineEventWrite): Promise<void> {
    return timelineEventService.write(event);
  },
};

export type { TimelineEventWrite } from './timelineEventService';