import { supabase } from '../integrations/supabase/client';
import type { ProcedureKit, ProcedureKitItem, InventoryCategory } from '../types';

function kitFromRow(row: Record<string, unknown>): ProcedureKit {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    branch_id: row.branch_id as string | undefined,
    is_active: row.is_active as boolean,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function kitItemFromRow(row: Record<string, unknown>): ProcedureKitItem {
  return {
    id: row.id as string,
    kit_id: row.kit_id as string,
    category: row.category as InventoryCategory,
    subcategory: row.subcategory as string | undefined,
    brand: row.brand as string | undefined,
    size: row.size as string | undefined,
    name: row.name as string | undefined,
    quantity: row.quantity as number,
    created_at: row.created_at as string | undefined,
  };
}

export const procedureKitService = {
  async getAll(branchId?: string): Promise<ProcedureKit[]> {
    let query = supabase.from('procedure_kits').select('*');
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query.order('name');
    if (error) throw new Error(error.message);
    return (data || []).map(kitFromRow);
  },

  async getById(id: string): Promise<(ProcedureKit & { items: ProcedureKitItem[] }) | null> {
    const { data: kit, error: kitErr } = await supabase.from('procedure_kits').select('*').eq('id', id).maybeSingle();
    if (kitErr || !kit) return null;
    const { data: items } = await supabase.from('procedure_kit_items').select('*').eq('kit_id', id);
    return { ...kitFromRow(kit), items: (items || []).map(kitItemFromRow) };
  },

  async create(data: { name: string; description?: string; branch_id?: string }): Promise<ProcedureKit> {
    const { data: inserted, error } = await supabase.from('procedure_kits').insert([data]).select().single();
    if (error) throw new Error(error.message);
    return kitFromRow(inserted);
  },

  async update(id: string, updates: Partial<ProcedureKit>): Promise<void> {
    const { error } = await supabase.from('procedure_kits').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('procedure_kits').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Kit Items
  async getItems(kitId: string): Promise<ProcedureKitItem[]> {
    const { data, error } = await supabase.from('procedure_kit_items').select('*').eq('kit_id', kitId);
    if (error) throw new Error(error.message);
    return (data || []).map(kitItemFromRow);
  },

  async addItem(item: Omit<ProcedureKitItem, 'id' | 'created_at'>): Promise<ProcedureKitItem> {
    const { data, error } = await supabase.from('procedure_kit_items').insert([item]).select().single();
    if (error) throw new Error(error.message);
    return kitItemFromRow(data);
  },

  async updateItem(id: string, updates: Partial<ProcedureKitItem>): Promise<void> {
    const { error } = await supabase.from('procedure_kit_items').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase.from('procedure_kit_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
