import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { AppUser, UserRole } from '../types';

function rowToUser(row: Record<string, unknown>): AppUser {
  return {
    id: row.id as string,
    auth_user_id: row.auth_user_id as string,
    username: row.username as string,
    full_name: row.full_name as string,
    email: row.email as string | undefined,
    role: row.role as UserRole,
    is_active: row.is_active as boolean,
    branch_id: row.branch_id as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

export const userService = {
  async getAll(): Promise<AppUser[]> {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToUser);
  },

  async getById(id: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async getByAuthId(authUserId: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('auth_user_id', authUserId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async getByUsername(username: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async getByEmail(email: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async create(data: {
    username: string;
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    branch_id?: string;
  }): Promise<AppUser> {
    const username = data.username.trim();
    const fullName = data.full_name.trim();
    const email = data.email.trim();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          username,
          full_name: fullName,
          email,
          password: data.password,
          role: data.role,
          branch_id: data.branch_id || null,
        }),
      },
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Failed to create user');
    }

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'USER_CREATED',
        table_name: 'users',
        record_id: result.user.id,
        new_data: { username, full_name: fullName, email, role: data.role, branch_id: data.branch_id },
      });
    }

    return rowToUser(result.user);
  },

  async update(id: string, updates: {
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
    branch_id?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: updates.role ? 'ROLE_CHANGED' : 'UPDATE',
        table_name: 'users',
        record_id: id,
        new_data: updates as Record<string, unknown>,
      });
    }
  },

  async updateByAuthId(authUserId: string, updates: {
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
    branch_id?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from('users').update(updates).eq('auth_user_id', authUserId);
    if (error) throw new Error(error.message);
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  },

  async getCurrentBranchId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('users')
      .select('branch_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    return (data?.branch_id as string) || null;
  },
};
