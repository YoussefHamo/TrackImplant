import { supabase } from '../integrations/supabase/client';

export interface PatientTimelineEvent {
  id: string;
  patient_id: string;
  event_type: string;
  description: string;
  user_id?: string;
  user_name?: string;
  branch_id?: string;
  branch_name?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface TimelineEventWrite {
  patient_id: string;
  event_type: string;
  description: string;
  user_id?: string;
  user_name?: string;
  branch_id?: string;
  branch_name?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export const timelineEventService = {
  async write(event: TimelineEventWrite): Promise<void> {
    if (!event.user_id) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        event.user_id = user.id;
        if (!event.user_name) {
          const { data: userData } = await supabase.from('users').select('username').eq('auth_user_id', user.id).maybeSingle();
          if (userData) event.user_name = userData.username as string;
        }
      }
    }
    const { error } = await supabase
      .from('patient_timeline_events')
      .insert([{
        patient_id: event.patient_id,
        event_type: event.event_type,
        description: event.description,
        user_id: event.user_id || null,
        user_name: event.user_name || null,
        branch_id: event.branch_id || null,
        branch_name: event.branch_name || null,
        related_entity_type: event.related_entity_type || null,
        related_entity_id: event.related_entity_id || null,
        metadata: event.metadata || {},
        created_at: event.created_at || new Date().toISOString(),
      }]);
    if (error) console.error('Failed to write timeline event:', error.message);
  },

  async getByPatient(patientId: string): Promise<PatientTimelineEvent[]> {
    const { data, error } = await supabase
      .from('patient_timeline_events')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      id: r.id,
      patient_id: r.patient_id,
      event_type: r.event_type,
      description: r.description,
      user_id: r.user_id,
      user_name: r.user_name,
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      related_entity_type: r.related_entity_type,
      related_entity_id: r.related_entity_id,
      metadata: r.metadata || {},
      created_at: r.created_at,
    }));
  },
};