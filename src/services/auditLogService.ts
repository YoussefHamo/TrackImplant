import { supabase } from '../integrations/supabase/client';
import type { AuditLog, AuditAction } from '../types';

function rowToLog(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    user_name: row.user_name as string,
    action: row.action as AuditAction,
    table_name: row.table_name as string,
    record_id: row.record_id as string,
    old_data: row.old_data as Record<string, unknown> | undefined,
    new_data: row.new_data as Record<string, unknown> | undefined,
    created_at: row.created_at as string | undefined,
  };
}

/** Look up the currently authenticated user's public.users id and username */
export async function getCurrentUserInfo(): Promise<{ user_id: string; user_name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id, username').eq('auth_user_id', user.id).single();
  if (!data) return null;
  return { user_id: data.id as string, user_name: data.username as string };
}

export const auditLogService = {
  async getAll(options?: {
    search?: string;
    action?: AuditAction;
    table?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 50;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase.from('audit_logs').select('*', { count: 'exact' });

    if (options?.action) query = query.eq('action', options.action);
    if (options?.table) query = query.eq('table_name', options.table);
    if (options?.search) {
      query = query.or(`user_name.ilike.%${options.search}%,table_name.ilike.%${options.search}%,action.ilike.%${options.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);

    return {
      logs: (data || []).map(rowToLog),
      total: count ?? 0,
    };
  },

  async log(entry: {
    user_id: string;
    user_name: string;
    action: AuditAction;
    table_name: string;
    record_id: string;
    old_data?: Record<string, unknown> | null;
    new_data?: Record<string, unknown> | null;
  }): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert([{
      user_id: entry.user_id,
      user_name: entry.user_name,
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id,
      old_data: entry.old_data ?? null,
      new_data: entry.new_data ?? null,
    }]);
    if (error) console.error('Audit log insert error:', error.message);
  },
};
