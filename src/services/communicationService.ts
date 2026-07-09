import { supabase } from '../integrations/supabase/client';
import { timelineEventService } from './timelineEventService';
import type { Communication, CommunicationType, CommunicationDirection } from '../types';

function commFromRow(row: Record<string, unknown>): Communication {
  const staff = row.staff as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    type: row.type as CommunicationType,
    direction: row.direction as CommunicationDirection,
    subject: row.subject as string | undefined,
    content: row.content as string | undefined,
    staff_id: row.staff_id as string | undefined,
    created_at: row.created_at as string | undefined,
    staff_name: staff?.full_name as string | undefined,
  };
}

export const communicationService = {
  async getByPatient(patientId: string): Promise<Communication[]> {
    const { data, error } = await supabase
      .from('communications')
      .select('*, staff:staff_id(full_name)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(r => commFromRow(r as Record<string, unknown>));
  },

  async create(data: {
    patient_id: string;
    type: CommunicationType;
    direction: CommunicationDirection;
    subject?: string;
    content?: string;
    branch_id?: string;
  }): Promise<Communication> {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = { ...data, staff_id: user?.id };
    delete payload.branch_id;
    payload.branch_id = data.branch_id || null;
    const { data: inserted, error } = await supabase
      .from('communications')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Write timeline event
    timelineEventService.write({
      patient_id: data.patient_id,
      event_type: 'communication_added',
      description: `${data.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${data.type}: ${data.subject || '(no subject)'}`,
      related_entity_type: 'communication',
      related_entity_id: inserted.id,
      branch_id: data.branch_id || undefined,
      metadata: { type: data.type, direction: data.direction, subject: data.subject },
    }).catch(() => {});

    return commFromRow(inserted);
  },

  async update(id: string, updates: { subject?: string; content?: string }): Promise<void> {
    const { error } = await supabase.from('communications').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('communications').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getPatientTimeline(patientId: string): Promise<(Communication & { type_label: string })[]> {
    const comms = await this.getByPatient(patientId);
    return comms.map(c => ({ ...c, type_label: c.type }));
  },
};
