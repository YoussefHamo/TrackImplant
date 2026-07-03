import { supabase } from '../integrations/supabase/client';
import { getItemDisplayName } from '../utils/inventory';
import type { InventoryCountSession, InventoryCountItem, CountSessionStatus } from '../types';

function sessionFromRow(row: Record<string, unknown>): InventoryCountSession {
  const branch = row.branches as Record<string, unknown> | undefined;
  const creator = row.creator as Record<string, unknown> | undefined;
  const approver = row.approver as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    branch_id: row.branch_id as string,
    status: row.status as CountSessionStatus,
    notes: row.notes as string | undefined,
    created_by: row.created_by as string | undefined,
    approved_by: row.approved_by as string | undefined,
    approved_at: row.approved_at as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    branch_name: branch?.name as string | undefined,
    creator_name: creator?.full_name as string | undefined,
    approver_name: approver?.full_name as string | undefined,
  };
}

function countItemFromRow(row: Record<string, unknown>): InventoryCountItem {
  const item = row.inventory_items as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    item_id: row.item_id as string,
    system_quantity: row.system_quantity as number,
    actual_quantity: row.actual_quantity as number,
    difference: row.difference as number,
    reason: row.reason as string | undefined,
    created_at: row.created_at as string | undefined,
    item_name: getItemDisplayName(item),
    item_category: item?.category as string | undefined,
  };
}

export const inventoryCountService = {
  async getSessions(branchId?: string): Promise<InventoryCountSession[]> {
    let query = supabase
      .from('inventory_count_sessions')
      .select('*, branches(name), creator:created_by(full_name), approver:approved_by(full_name)');
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(r => sessionFromRow(r as Record<string, unknown>));
  },

  async getSession(id: string): Promise<InventoryCountSession | null> {
    const { data, error } = await supabase
      .from('inventory_count_sessions')
      .select('*, branches(name), creator:created_by(full_name), approver:approved_by(full_name)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return sessionFromRow(data as Record<string, unknown>);
  },

  async createSession(data: { branch_id: string; notes?: string }): Promise<InventoryCountSession> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from('inventory_count_sessions')
      .insert([{ ...data, created_by: user?.id }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sessionFromRow(inserted);
  },

  async updateSessionStatus(id: string, status: CountSessionStatus): Promise<void> {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'approved') {
      const { data: { user } } = await supabase.auth.getUser();
      updates.approved_by = user?.id;
      updates.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('inventory_count_sessions').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteSession(id: string): Promise<void> {
    const { error } = await supabase.from('inventory_count_sessions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Count Items
  async getItems(sessionId: string): Promise<InventoryCountItem[]> {
    const { data, error } = await supabase
      .from('inventory_count_items')
      .select('*, inventory_items(name, subcategory, category)')
      .eq('session_id', sessionId);
    if (error) throw new Error(error.message);
    return (data || []).map(r => countItemFromRow(r as Record<string, unknown>));
  },

  async upsertItem(item: {
    session_id: string;
    item_id: string;
    system_quantity: number;
    actual_quantity: number;
    reason?: string;
  }): Promise<InventoryCountItem> {
    // Check if item exists first (no unique constraint on session_id+item_id)
    const { data: existing } = await supabase
      .from('inventory_count_items')
      .select('id')
      .eq('session_id', item.session_id)
      .eq('item_id', item.item_id)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase
        .from('inventory_count_items')
        .update({
          system_quantity: item.system_quantity,
          actual_quantity: item.actual_quantity,
          reason: item.reason || null,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return countItemFromRow(data);
    }
    const { data, error } = await supabase
      .from('inventory_count_items')
      .insert({
        session_id: item.session_id,
        item_id: item.item_id,
        system_quantity: item.system_quantity,
        actual_quantity: item.actual_quantity,
        reason: item.reason || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return countItemFromRow(data);
  },

  async batchInsertItems(items: { session_id: string; item_id: string; system_quantity: number; actual_quantity: number }[]): Promise<void> {
    if (items.length === 0) return;
    const { error } = await supabase.from('inventory_count_items').insert(items);
    if (error) throw new Error(error.message);
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase.from('inventory_count_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
