import { supabase } from '../integrations/supabase/client';

export interface SearchResult {
  type: 'patient' | 'procedure';
  id: string;
  label: string;
  subtitle: string;
  url: string;
}

export const searchService = {
  async searchAll(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 1) return [];

    const results: SearchResult[] = [];

    try {
      const { data: patients } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);
      if (patients) {
        patients.forEach((p: Record<string, unknown>) => {
          results.push({
            type: 'patient' as const,
            id: p.id as string,
            label: p.full_name as string,
            subtitle: (p.phone || '') as string,
            url: `/dashboard/patients?selected=${p.id}`
          });
        });
      }
    } catch { /* table may not exist */ }

    try {
      const { data: procedures } = await supabase
        .from('procedures')
        .select('id, procedure_name, tooth_number, patient_id, status')
        .or(`procedure_name.ilike.%${query}%,tooth_number.ilike.%${query}%`)
        .limit(5);
      if (procedures) {
        procedures.forEach((p: Record<string, unknown>) => {
          results.push({
            type: 'procedure' as const,
            id: p.id as string,
            label: p.procedure_name as string,
            subtitle: `Tooth ${p.tooth_number || '—'} | ${p.status || ''}`,
            url: `/dashboard/cases?id=${p.id}`
          });
        });
      }
    } catch { /* table may not exist */ }

    return results;
  }
};
