import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { ImplantInventory, AbutmentInventory, InventoryTransaction, InventoryItemType, TransactionType } from '../types';

function implantFromRow(row: Record<string, unknown>): ImplantInventory {
  return {
    id: row.id as string,
    brand: row.brand as string,
    size: row.size as string,
    quantity: row.quantity as number,
    minimum_stock: row.minimum_stock as number | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function abutmentFromRow(row: Record<string, unknown>): AbutmentInventory {
  return {
    id: row.id as string,
    type: row.type as string,
    quantity: row.quantity as number,
    minimum_stock: row.minimum_stock as number | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function transactionFromRow(row: Record<string, unknown>): InventoryTransaction {
  return {
    id: row.id as string,
    item_type: row.item_type as InventoryItemType,
    item_id: row.item_id as string,
    type: row.type as TransactionType,
    quantity: row.quantity as number,
    patient_id: row.patient_id as string | undefined,
    procedure_id: row.procedure_id as string | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

// Normalize: trim, collapse whitespace, lowercase, title-case brand
function normalizeBrand(brand: string): string {
  return brand.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeSize(size: string): string {
  return size.trim().replace(/\s+/g, ' ').replace(/(\d+)x(\d+)/gi, '$1 x $2');
}

function normalizeType(type: string): string {
  return type.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const implantInventoryService = {
  // ── Implants ──
  async getImplants(): Promise<ImplantInventory[]> {
    const { data, error } = await supabase.from('implant_inventory').select('*').order('brand');
    if (error) throw new Error(error.message);
    return (data || []).map(implantFromRow);
  },

  // UPSERT: if (brand, size) exists → add to quantity; else → insert new row
  async upsertImplant(item: { brand: string; size: string; quantity: number }): Promise<ImplantInventory> {
    if (item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const brand = normalizeBrand(item.brand);
    const size = normalizeSize(item.size);
    if (!brand) throw new Error('Brand is required');
    if (!size) throw new Error('Size is required');

    const { data, error } = await supabase
      .from('implant_inventory')
      .upsert(
        { brand, size, quantity: item.quantity, updated_at: new Date().toISOString() },
        { onConflict: 'brand,size', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) {
      // Fallback: ON CONFLICT DO UPDATE as raw query if upsert doesn't add quantity
      const { data: existing } = await supabase
        .from('implant_inventory')
        .select('*')
        .eq('brand', brand)
        .eq('size', size)
        .single();

      if (existing) {
        const newQty = (existing.quantity as number) + item.quantity;
        const { data: updated, error: updErr } = await supabase
          .from('implant_inventory')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);
        return implantFromRow(updated);
      }

      const { data: inserted, error: insErr } = await supabase
        .from('implant_inventory')
        .insert([{ brand, size, quantity: item.quantity, updated_at: new Date().toISOString() }])
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      return implantFromRow(inserted);
    }

    return implantFromRow(data);
  },

  async updateImplant(id: string, updates: Partial<ImplantInventory>): Promise<void> {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.brand) payload.brand = normalizeBrand(updates.brand);
    if (updates.size) payload.size = normalizeSize(updates.size);
    const { error } = await supabase.from('implant_inventory').update(payload).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'implant_inventory',
        record_id: id,
        new_data: payload,
      });
    }
  },

  async deleteImplant(id: string): Promise<void> {
    const { error } = await supabase.from('implant_inventory').delete().eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'DELETE',
        table_name: 'implant_inventory',
        record_id: id,
      });
    }
  },

  // ── Abutments ──
  async getAbutments(): Promise<AbutmentInventory[]> {
    const { data, error } = await supabase.from('abutment_inventory').select('*').order('type');
    if (error) throw new Error(error.message);
    return (data || []).map(abutmentFromRow);
  },

  // UPSERT: if type exists → add to quantity; else → insert new row
  async upsertAbutment(item: { type: string; quantity: number }): Promise<AbutmentInventory> {
    if (item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const type = normalizeType(item.type);
    if (!type) throw new Error('Type is required');

    const { data, error } = await supabase
      .from('abutment_inventory')
      .upsert(
        { type, quantity: item.quantity, updated_at: new Date().toISOString() },
        { onConflict: 'type', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from('abutment_inventory')
        .select('*')
        .eq('type', type)
        .single();

      if (existing) {
        const newQty = (existing.quantity as number) + item.quantity;
        const { data: updated, error: updErr } = await supabase
          .from('abutment_inventory')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);
        return abutmentFromRow(updated);
      }

      const { data: inserted, error: insErr } = await supabase
        .from('abutment_inventory')
        .insert([{ type, quantity: item.quantity, updated_at: new Date().toISOString() }])
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      return abutmentFromRow(inserted);
    }

    return abutmentFromRow(data);
  },

  async updateAbutment(id: string, updates: Partial<AbutmentInventory>): Promise<void> {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.type) payload.type = normalizeType(updates.type);
    const { error } = await supabase.from('abutment_inventory').update(payload).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'abutment_inventory',
        record_id: id,
        new_data: payload,
      });
    }
  },

  async deleteAbutment(id: string): Promise<void> {
    const { error } = await supabase.from('abutment_inventory').delete().eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'DELETE',
        table_name: 'abutment_inventory',
        record_id: id,
      });
    }
  },

  // ── Transactions ──
  async getTransactions(): Promise<InventoryTransaction[]> {
    const { data, error } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(transactionFromRow);
  },

  async recordTransaction(tx: Omit<InventoryTransaction, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase.from('inventory_transactions').insert([tx]);
    if (error) throw new Error(error.message);
  },

  // ── Stock Adjustments ──
  async adjustImplantStock(id: string, quantityChange: number, notes?: string): Promise<void> {
    const { data: item } = await supabase.from('implant_inventory').select('*').eq('id', id).single();
    if (!item) throw new Error('Implant not found');
    const newQty = (item.quantity as number) + quantityChange;
    if (newQty < 0) throw new Error('Insufficient stock');
    const { error: updErr } = await supabase.from('implant_inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', id);
    if (updErr) throw new Error(updErr.message);
    await this.recordTransaction({
      item_type: 'implant', item_id: id,
      type: quantityChange > 0 ? 'add' : 'deduct',
      quantity: Math.abs(quantityChange),
      notes: notes || undefined,
    });

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INVENTORY_CHANGE',
        table_name: 'implant_inventory',
        record_id: id,
        new_data: { quantity: newQty, change: quantityChange, notes },
      });
    }
  },

  async adjustAbutmentStock(id: string, quantityChange: number, notes?: string): Promise<void> {
    const { data: item } = await supabase.from('abutment_inventory').select('*').eq('id', id).single();
    if (!item) throw new Error('Abutment not found');
    const newQty = (item.quantity as number) + quantityChange;
    if (newQty < 0) throw new Error('Insufficient stock');
    const { error: updErr } = await supabase.from('abutment_inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', id);
    if (updErr) throw new Error(updErr.message);
    await this.recordTransaction({
      item_type: 'abutment', item_id: id,
      type: quantityChange > 0 ? 'add' : 'deduct',
      quantity: Math.abs(quantityChange),
      notes: notes || undefined,
    });

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INVENTORY_CHANGE',
        table_name: 'abutment_inventory',
        record_id: id,
        new_data: { quantity: newQty, change: quantityChange, notes },
      });
    }
  },
};
