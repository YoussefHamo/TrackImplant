import { supabase } from '../integrations/supabase/client';

export type NotificationType = 'info' | 'warning' | 'critical' | 'success';

export type NotificationCategory =
  | 'appointment' | 'procedure' | 'invoice' | 'payment' | 'inventory'
  | 'stock_request' | 'delivery' | 'follow_up' | 'reminder' | 'crm'
  | 'system' | 'general';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  is_read: boolean;
  created_at?: string;
  category?: NotificationCategory;
  related_entity_type?: string;
  related_entity_id?: string;
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
    category: row.category as NotificationCategory | undefined,
    related_entity_type: row.related_entity_type as string | undefined,
    related_entity_id: row.related_entity_id as string | undefined,
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

  async getByCategory(userId: string, category: NotificationCategory): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('getByCategory error:', error.message);
      return [];
    }
    return (data || []).map(rowToNotification);
  },

  async getFiltered(
    userId: string,
    options: {
      category?: NotificationCategory;
      is_read?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ notifications: AppNotification[]; total: number }> {
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (options.category) {
      query = query.eq('category', options.category);
    }
    if (options.is_read !== undefined) {
      query = query.eq('is_read', options.is_read);
    }
    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,message.ilike.%${options.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options.offset !== undefined) {
      query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('getFiltered error:', error.message);
      return { notifications: [], total: 0 };
    }
    return {
      notifications: (data || []).map(rowToNotification),
      total: count ?? 0,
    };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    if (error) console.error('Notification delete error:', error.message);
  },

  async getUnreadByCategory(userId: string): Promise<Record<NotificationCategory, number>> {
    const categories: NotificationCategory[] = [
      'appointment', 'procedure', 'invoice', 'payment', 'inventory',
      'stock_request', 'delivery', 'follow_up', 'reminder', 'crm',
      'system', 'general',
    ];
    const counts: Record<string, number> = {};
    for (const cat of categories) counts[cat] = 0;

    const { data, error } = await supabase
      .from('notifications')
      .select('category')
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) {
      console.error('getUnreadByCategory error:', error.message);
      return counts as Record<NotificationCategory, number>;
    }
    for (const row of data || []) {
      const cat = row.category as NotificationCategory;
      if (cat && cat in counts) counts[cat]++;
    }
    return counts as Record<NotificationCategory, number>;
  },

  async createWithDetails(data: {
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    category?: NotificationCategory;
    link?: string;
    related_entity_type?: string;
    related_entity_id?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: data.user_id,
        title: data.title,
        message: data.message,
        type: data.type,
        category: data.category ?? null,
        link: data.link ?? null,
        related_entity_type: data.related_entity_type ?? null,
        related_entity_id: data.related_entity_id ?? null,
        is_read: false,
      }]);
    if (error) console.error('Notification createWithDetails error:', error.message);
  },
};
