import { supabase } from '../integrations/supabase/client';
import type { NotificationCategory } from './notificationService';

export interface NotificationPreference {
  id: string;
  user_id: string;
  category: NotificationCategory;
  email: boolean;
  in_app: boolean;
}

const CATEGORIES: NotificationCategory[] = [
  'appointment', 'procedure', 'invoice', 'payment', 'inventory',
  'stock_request', 'delivery', 'follow_up', 'reminder', 'crm',
  'system', 'general',
];

function rowToPref(row: Record<string, unknown>): NotificationPreference {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    category: row.category as NotificationCategory,
    email: row.email as boolean,
    in_app: row.in_app as boolean,
  };
}

export const notificationPreferenceService = {
  async getAll(userId: string): Promise<NotificationPreference[]> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return (data || []).map(rowToPref);
  },

  async getEnabledCategories(userId: string): Promise<NotificationCategory[]> {
    const prefs = await this.getAll(userId);
    if (prefs.length === 0) return [...CATEGORIES];
    return prefs.filter(p => p.in_app).map(p => p.category);
  },

  async upsert(userId: string, category: NotificationCategory, inApp: boolean): Promise<void> {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        category,
        in_app: inApp,
        email: true,
      }, { onConflict: 'user_id,category' });
    if (error) throw new Error(error.message);
  },

  async bulkInit(userId: string): Promise<void> {
    const existing = await this.getAll(userId);
    const existingCats = new Set(existing.map(p => p.category));
    const missing = CATEGORIES.filter(c => !existingCats.has(c));
    if (missing.length === 0) return;
    const inserts = missing.map(category => ({
      user_id: userId,
      category,
      email: true,
      in_app: true,
    }));
    const { error } = await supabase.from('notification_preferences').insert(inserts);
    if (error) console.error('Failed to init notification prefs:', error.message);
  },
};