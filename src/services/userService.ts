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
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async getByAuthId(authUserId: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('auth_user_id', authUserId).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async getByUsername(username: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async getByEmail(email: string): Promise<AppUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? rowToUser(data) : null;
  },

  async create(data: {
    username: string;
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<AppUser> {
    const username = data.username.trim();
    const fullName = data.full_name.trim();
    const email = data.email.trim();

    // Save admin token before signUp (signUp swaps the session)
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    // 1. Create the auth user via signUp using the real email
    const { data: authResult, error: signUpError } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: { full_name: fullName, username, role: data.role },
      },
    });

    // Restore admin session immediately
    if (adminSession) {
      await supabase.auth.setSession(adminSession).catch(() => {});
    }

    if (signUpError) throw new Error(signUpError.message);
    if (!authResult.user) throw new Error('Failed to create auth user');

    const authUserId = authResult.user.id;

    // 2. Upsert into public.users — guarantees the correct data regardless of trigger
    const { data: inserted, error: upsertErr } = await supabase
      .from('users')
      .upsert({
        auth_user_id: authUserId,
        username,
        full_name: fullName,
        email,
        role: data.role,
        is_active: true,
      }, { onConflict: 'auth_user_id' })
      .select()
      .single();

    if (upsertErr) throw new Error('Failed to save user: ' + upsertErr.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'USER_CREATED',
        table_name: 'users',
        record_id: inserted.id,
        new_data: { username, full_name: fullName, email, role: data.role },
      });
    }

    return rowToUser(inserted);
  },

  async update(id: string, updates: {
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
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
  }): Promise<void> {
    const { error } = await supabase.from('users').update(updates).eq('auth_user_id', authUserId);
    if (error) throw new Error(error.message);
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  },
};
