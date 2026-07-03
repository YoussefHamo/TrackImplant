import { supabase } from '../integrations/supabase/client';
import { getItemDisplayName } from '../utils/inventory';
import type { Branch, BranchInventory } from '../types';

function branchFromRow(row: Record<string, unknown>): Branch {
  return {
    id: row.id as string,
    name: row.name as string,
    address: row.address as string | undefined,
    phone: row.phone as string | undefined,
    is_active: row.is_active as boolean,
    created_at: row.created_at as string | undefined,
  };
}

function branchInventoryFromRow(row: Record<string, unknown>): BranchInventory {
  return {
    id: row.id as string,
    branch_id: row.branch_id as string,
    item_id: row.item_id as string,
    quantity: row.quantity as number,
    reserved: row.reserved as number,
    updated_at: row.updated_at as string | undefined,
    branch_name: row.branch_name as string | undefined,
    item_name: row.item_name as string | undefined,
    item_category: row.item_category as string | undefined,
  };
}

let _branchNameCache: Map<string, string> | null = null;
async function getBranchNameMap(): Promise<Map<string, string>> {
  if (_branchNameCache) return _branchNameCache;
  const { data } = await supabase.from('branches').select('id, name');
  _branchNameCache = new Map((data || []).map((r: Record<string, unknown>) => [r.id as string, r.name as string]));
  return _branchNameCache;
}

export const branchService = {
  async getAll(): Promise<Branch[]> {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data || []).map(branchFromRow);
  },

  async getById(id: string): Promise<Branch | null> {
    const { data, error } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? branchFromRow(data) : null;
  },

  async create(branch: { name: string; address?: string; phone?: string }): Promise<Branch> {
    const { data, error } = await supabase.from('branches').insert([branch]).select().single();
    if (error) throw new Error(error.message);
    return branchFromRow(data);
  },

  async update(id: string, updates: Partial<Branch>): Promise<void> {
    const { error } = await supabase.from('branches').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getInventory(branchId: string): Promise<BranchInventory[]> {
    const { data, error } = await supabase
      .rpc('get_aggregated_inventory', { p_category: null, p_branch_id: branchId });
    if (error) throw new Error(error.message);
    const branchMap = await getBranchNameMap();
    return (data || []).map((r: Record<string, unknown>) => {
      const id = r.id as string;
      const branch_id = r.branch_id as string;
      return branchInventoryFromRow({ id, branch_id, item_id: id, quantity: r.quantity, reserved: r.reserved, updated_at: r.updated_at, branch_name: branchMap.get(branch_id), item_name: getItemDisplayName(r), item_category: r.category });
    });
  },

  async getAllBranchInventory(): Promise<BranchInventory[]> {
    const { data, error } = await supabase
      .rpc('get_aggregated_inventory', { p_category: null, p_branch_id: null });
    if (error) throw new Error(error.message);
    const branchMap = await getBranchNameMap();
    return (data || []).map((r: Record<string, unknown>) => {
      const id = r.id as string;
      const branch_id = r.branch_id as string;
      return branchInventoryFromRow({ id, branch_id, item_id: id, quantity: r.quantity, reserved: r.reserved, updated_at: r.updated_at, branch_name: branchMap.get(branch_id), item_name: getItemDisplayName(r), item_category: r.category });
    });
  },

  async adjustBranchStock(branchId: string, itemId: string, quantityChange: number): Promise<void> {
    const { data: existing } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('branch_id', branchId)
      .eq('id', itemId)
      .maybeSingle();

    if (existing) {
      const newQty = (existing.quantity as number) + quantityChange;
      if (newQty < 0) throw new Error('Insufficient stock at branch');
      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      throw new Error('Item not found at this branch');
    }
  },
};
