import { supabase } from '../integrations/supabase/client';

export type NotificationType = 'info' | 'warning' | 'critical' | 'success';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  is_read: boolean;
  created_at?: string;
}

function rowToNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string,
    message: row.message as string,
    type: row.type as NotificationType,
    link: row.link as string | undefined,
    is_read: row.is_read as boolean,
    created_at: row.created_at as string | undefined,
  };
}

export const notificationService = {
  async getByUser(userId: string, limit = 20): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(rowToNotification);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw new Error(error.message);
  },

  async create(notification: {
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .insert([{ ...notification, is_read: false }]);
    if (error) console.error('Notification insert error:', error.message);
  },

  async createForRole(
    role: string,
    notification: {
      title: string;
      message: string;
      type: NotificationType;
      link?: string;
    },
  ): Promise<void> {
    const { data: users } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('role', role)
      .eq('is_active', true);
    if (!users) return;
    for (const user of users) {
      await this.create({ ...notification, user_id: user.auth_user_id as string });
    }
  },
};
