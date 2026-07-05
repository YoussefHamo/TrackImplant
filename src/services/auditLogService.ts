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
    role: row.role as string | undefined,
    branch_id: row.branch_id as string | undefined,
    ip_address: row.ip_address as string | undefined,
    user_agent: row.user_agent as string | undefined,
    os: row.os as string | undefined,
    session_id: row.session_id as string | undefined,
    created_at: row.created_at as string | undefined,
    reason_category: row.reason_category as string | null | undefined,
    change_reason: row.change_reason as string | null | undefined,
  };
}

/** Look up the currently authenticated user's public.users id and username */
export async function getCurrentUserInfo(): Promise<{ user_id: string; user_name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id, username, role, branch_id').eq('auth_user_id', user.id).maybeSingle();
  if (!data) return null;
  return { user_id: data.id as string, user_name: data.username as string };
}

/** Get extended user info for audit logging */
export async function getCurrentUserExtendedInfo(): Promise<{
  user_id: string;
  user_name: string;
  role?: string;
  branch_id?: string;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id, username, role, branch_id').eq('auth_user_id', user.id).maybeSingle();
  if (!data) return null;
  return {
    user_id: data.id as string,
    user_name: data.username as string,
    role: data.role as string | undefined,
    branch_id: data.branch_id as string | undefined,
  };
}

function getBrowserInfo(): { user_agent: string; os: string } {
  const ua = navigator.userAgent || '';
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';
  return { user_agent: ua, os };
}

export const auditLogService = {
  async getAll(options?: {
    search?: string;
    action?: AuditAction;
    table?: string;
    role?: string;
    branchId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
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
    if (options?.role) query = query.eq('role', options.role);
    if (options?.branchId) query = query.eq('branch_id', options.branchId);
    if (options?.userId) query = query.eq('user_id', options.userId);
    if (options?.dateFrom) query = query.gte('created_at', options.dateFrom);
    if (options?.dateTo) query = query.lte('created_at', options.dateTo);
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
    role?: string;
    branch_id?: string;
    reason_category?: string | null;
    change_reason?: string | null;
  }): Promise<void> {
    const { user_agent, os } = getBrowserInfo();
    const { error } = await supabase.from('audit_logs').insert([{
      user_id: entry.user_id,
      user_name: entry.user_name,
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id,
      old_data: entry.old_data ?? null,
      new_data: entry.new_data ?? null,
      role: entry.role ?? null,
      branch_id: entry.branch_id ?? null,
      ip_address: null,
      user_agent,
      os,
      session_id: null,
      reason_category: entry.reason_category ?? null,
      change_reason: entry.change_reason ?? null,
    }]);
    if (error) console.error('Audit log insert error:', error.message);
  },
};
