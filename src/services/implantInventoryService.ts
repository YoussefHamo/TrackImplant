import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import { getItemDisplayName } from '../utils/inventory';
import type { ImplantInventory, AbutmentInventory, InventoryTransaction, InventoryItemType, TransactionType, InventoryItem, StockRequest, InventoryCategory, OperationType, StockRequestStatus, ProductCatalogItem } from '../types';

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
    operation_type: (row.operation_type as OperationType) || 'add',
    quantity: row.quantity as number,
    item_category: row.item_category as string | undefined,
    item_name: row.item_name as string | undefined,
    patient_id: row.patient_id as string | undefined,
    procedure_id: row.procedure_id as string | undefined,
    notes: row.notes as string | undefined,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

function inventoryItemFromRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    branch_id: row.branch_id as string | undefined,
    category: row.category as InventoryCategory,
    subcategory: row.subcategory as string | undefined,
    name: row.name as string | undefined,
    brand: row.brand as string | undefined,
    size: row.size as string | undefined,
    unit: (row.unit as string) || 'piece',
    quantity: row.quantity as number,
    reserved: row.reserved as number,
    used: row.used as number,
    minimum_stock: row.minimum_stock as number | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function stockRequestFromRow(row: Record<string, unknown>): StockRequest {
  return {
    id: row.id as string,
    item_id: row.item_id as string | undefined,
    item_name: row.item_name as string,
    item_category: row.item_category as string | undefined,
    quantity: row.quantity as number,
    requested_by: row.requested_by as string | undefined,
    requested_by_name: row.requested_by_name as string | undefined,
    approved_by: row.approved_by as string | undefined,
    approved_by_name: row.approved_by_name as string | undefined,
    status: row.status as StockRequestStatus,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
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

async function syncImplantToInventory(branchId: string, brand: string, size: string, quantity: number, reserved = 0, used = 0, minStock = 0): Promise<void> {
  const { data: existing } = await supabase.from('inventory_items').select('id').eq('category', 'implant').eq('brand', brand).eq('size', size).eq('branch_id', branchId).maybeSingle();
  if (existing) {
    await supabase.from('inventory_items').update({ quantity, reserved, used, minimum_stock: minStock, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('inventory_items').insert({ category: 'implant', name: `${brand} ${size}`, brand, size, quantity, reserved, used, minimum_stock: minStock, branch_id: branchId }).select().single();
  }
}

async function syncAbutmentToInventory(branchId: string, type: string, quantity: number, reserved = 0, used = 0, minStock = 0): Promise<void> {
  const { data: existing } = await supabase.from('inventory_items').select('id').eq('category', 'abutment').eq('subcategory', type).eq('branch_id', branchId).maybeSingle();
  if (existing) {
    await supabase.from('inventory_items').update({ quantity, reserved, used, minimum_stock: minStock, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('inventory_items').insert({ category: 'abutment', name: type, subcategory: type, quantity, reserved, used, minimum_stock: minStock, branch_id: branchId }).select().single();
  }
}

async function removeImplantFromInventory(branchId: string, brand: string, size: string): Promise<void> {
  const { data: item } = await supabase.from('inventory_items').select('id').eq('category', 'implant').eq('brand', brand).eq('size', size).eq('branch_id', branchId).maybeSingle();
  if (item) {
    await supabase.from('inventory_items').delete().eq('id', item.id);
  }
}

async function removeAbutmentFromInventory(branchId: string, type: string): Promise<void> {
  const { data: item } = await supabase.from('inventory_items').select('id').eq('category', 'abutment').eq('subcategory', type).eq('branch_id', branchId).maybeSingle();
  if (item) {
    await supabase.from('inventory_items').delete().eq('id', item.id);
  }
}

export const implantInventoryService = {
  // ── Product Catalog (distinct items, no branch duplication) ──
  async getProductCatalog(category?: string): Promise<ProductCatalogItem[]> {
    const { data, error } = await supabase.rpc('get_product_catalog', {
      p_category: category || null,
    });
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      category: row.category as InventoryCategory,
      subcategory: row.subcategory as string | null,
      name: row.name as string | null,
      brand: row.brand as string | null,
      size: row.size as string | null,
      unit: row.unit as string | null,
    }));
  },

  // ── Shared Aggregated Inventory ──
  // Single source: v_inventory_all view via get_aggregated_inventory() RPC.
  // All inventory pages must use this method.
  async getAggregatedInventory(category?: string, branchId?: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase.rpc('get_aggregated_inventory', {
      p_category: category || null,
      p_branch_id: branchId || null,
    });
    if (error) throw new Error(error.message);
    return (data || []).map(inventoryItemFromRow);
  },

  // ── Implants ──
  async getImplants(branchId?: string): Promise<ImplantInventory[]> {
    const items = await this.getAggregatedInventory('implant', branchId);
    return items.map(i => ({
      id: i.id,
      brand: i.brand || '',
      size: i.size || '',
      quantity: i.quantity,
      reserved: i.reserved,
      used: i.used,
      minimum_stock: i.minimum_stock,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }));
  },

  // UPSERT: if (brand, size) exists → add to quantity; else → insert new row
  async upsertImplant(item: { brand: string; size: string; quantity: number; branch_id?: string }): Promise<ImplantInventory> {
    if (item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const brand = normalizeBrand(item.brand);
    const size = normalizeSize(item.size);
    if (!brand) throw new Error('Brand is required');
    if (!size) throw new Error('Size is required');

    const { data, error } = await supabase
      .from('implant_inventory')
      .upsert(
        { brand, size, quantity: item.quantity, branch_id: item.branch_id, updated_at: new Date().toISOString() },
        { onConflict: 'branch_id,brand,size', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) {
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
          .update({ quantity: newQty, branch_id: item.branch_id, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);
        await syncImplantToInventory(item.branch_id!, brand, size, newQty);
        return implantFromRow(updated);
      }

      const { data: inserted, error: insErr } = await supabase
        .from('implant_inventory')
        .insert([{ brand, size, quantity: item.quantity, branch_id: item.branch_id, updated_at: new Date().toISOString() }])
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      return implantFromRow(inserted);
    }

    await syncImplantToInventory(item.branch_id!, brand, size, item.quantity);
    return implantFromRow(data);
  },

  async updateImplant(id: string, updates: Partial<ImplantInventory>): Promise<void> {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.brand) payload.brand = normalizeBrand(updates.brand);
    if (updates.size) payload.size = normalizeSize(updates.size);
    const { error } = await supabase.from('implant_inventory').update(payload).eq('id', id);
    if (error) throw new Error(error.message);

    const { data: updated } = await supabase.from('implant_inventory').select('*').eq('id', id).single();
    if (updated) {
      await syncImplantToInventory(updated.branch_id as string, updated.brand as string, updated.size as string, updated.quantity as number, updated.reserved as number, updated.used as number, updated.minimum_stock as number);
    }

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
    const { data: item } = await supabase.from('implant_inventory').select('brand,size,branch_id').eq('id', id).single();
    const { error } = await supabase.from('implant_inventory').delete().eq('id', id);
    if (error) throw new Error(error.message);
    if (item) await removeImplantFromInventory(item.branch_id as string, item.brand as string, item.size as string);

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
  async getAbutments(branchId?: string): Promise<AbutmentInventory[]> {
    const items = await this.getAggregatedInventory('abutment', branchId);
    return items.map(i => ({
      id: i.id,
      type: i.subcategory || i.name || '',
      quantity: i.quantity,
      reserved: i.reserved,
      used: i.used,
      minimum_stock: i.minimum_stock,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }));
  },

  // UPSERT: if type exists → add to quantity; else → insert new row
  async upsertAbutment(item: { type: string; quantity: number; branch_id?: string }): Promise<AbutmentInventory> {
    if (item.quantity <= 0) throw new Error('Quantity must be greater than 0');
    const type = normalizeType(item.type);
    if (!type) throw new Error('Type is required');

    const { data, error } = await supabase
      .from('abutment_inventory')
      .upsert(
        { type, quantity: item.quantity, branch_id: item.branch_id, updated_at: new Date().toISOString() },
        { onConflict: 'branch_id,type', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from('abutment_inventory')
        .select('*')
        .eq('type', type)
        .eq('branch_id', item.branch_id)
        .single();

      if (existing) {
        const newQty = (existing.quantity as number) + item.quantity;
        const { data: updated, error: updErr } = await supabase
          .from('abutment_inventory')
          .update({ quantity: newQty, branch_id: item.branch_id, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);
        await syncAbutmentToInventory(item.branch_id!, type, newQty);
        return abutmentFromRow(updated);
      }

      const { data: inserted, error: insErr } = await supabase
        .from('abutment_inventory')
        .insert([{ type, quantity: item.quantity, branch_id: item.branch_id, updated_at: new Date().toISOString() }])
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      return abutmentFromRow(inserted);
    }

    await syncAbutmentToInventory(item.branch_id!, type, item.quantity);
    return abutmentFromRow(data);
  },

  async updateAbutment(id: string, updates: Partial<AbutmentInventory>): Promise<void> {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.type) payload.type = normalizeType(updates.type);
    const { error } = await supabase.from('abutment_inventory').update(payload).eq('id', id);
    if (error) throw new Error(error.message);

    const { data: updated } = await supabase.from('abutment_inventory').select('*').eq('id', id).single();
    if (updated) {
      await syncAbutmentToInventory(updated.branch_id as string, updated.type as string, updated.quantity as number, updated.reserved as number, updated.used as number, updated.minimum_stock as number);
    }

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
    const { data: item } = await supabase.from('abutment_inventory').select('type,branch_id').eq('id', id).single();
    const { error } = await supabase.from('abutment_inventory').delete().eq('id', id);
    if (error) throw new Error(error.message);
    if (item) await removeAbutmentFromInventory(item.branch_id as string, item.type as string);

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
    const { error } = await supabase.from('inventory_transactions').insert([{ ...tx, operation_type: tx.operation_type || 'add' }]);
    if (error) throw new Error(error.message);
  },

  // ── Stock Adjustments ──
  async adjustImplantStock(id: string, quantityChange: number, notes?: string, change_reason?: string, reason_category?: string): Promise<void> {
    const { data: item } = await supabase.from('implant_inventory').select('*').eq('id', id).single();
    if (!item) throw new Error('Implant not found');
    const newQty = (item.quantity as number) + quantityChange;
    if (newQty < 0) throw new Error('Insufficient stock');
    const { error: updErr } = await supabase.from('implant_inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', id);
    if (updErr) throw new Error(updErr.message);
    await syncImplantToInventory(item.branch_id as string, item.brand as string, item.size as string, newQty, item.reserved as number, item.used as number, item.minimum_stock as number);
    await this.recordTransaction({
      item_type: 'implant', item_id: id,
      type: quantityChange > 0 ? 'add' : 'deduct',
      operation_type: 'adjust',
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
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },

  async adjustAbutmentStock(id: string, quantityChange: number, notes?: string, change_reason?: string, reason_category?: string): Promise<void> {
    const { data: item } = await supabase.from('abutment_inventory').select('*').eq('id', id).single();
    if (!item) throw new Error('Abutment not found');
    const newQty = (item.quantity as number) + quantityChange;
    if (newQty < 0) throw new Error('Insufficient stock');
    const { error: updErr } = await supabase.from('abutment_inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', id);
    if (updErr) throw new Error(updErr.message);
    await syncAbutmentToInventory(item.branch_id as string, item.type as string, newQty, item.reserved as number, item.used as number, item.minimum_stock as number);
    await this.recordTransaction({
      item_type: 'abutment', item_id: id,
      type: quantityChange > 0 ? 'add' : 'deduct',
      operation_type: 'adjust',
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
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },

  // ════════════════════════════════════════════════════════════
  // NEW: Unified Inventory Items (categories: implant, abutment, prosthetic, material)
  // ════════════════════════════════════════════════════════════

  async getInventoryItems(category?: InventoryCategory, branchId?: string): Promise<InventoryItem[]> {
    return this.getAggregatedInventory(category, branchId);
  },

  async getBranchItems(branchId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase.rpc('get_branch_inventory_items', { p_branch_id: branchId });
    if (error) throw new Error(error.message);
    return (data || []).map(inventoryItemFromRow);
  },

  async getInventoryItem(id: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase.from('inventory_items').select('*').eq('id', id).single();
    if (error) return null;
    return inventoryItemFromRow(data);
  },

  async upsertInventoryItem(item: {
    category: InventoryCategory;
    subcategory?: string;
    name?: string;
    brand?: string;
    size?: string;
    quantity: number;
    minimum_stock?: number;
  }): Promise<InventoryItem> {
    if (item.quantity < 0) throw new Error('Quantity cannot be negative');
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{ ...item, updated_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inventoryItemFromRow(data);
  },

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<void> {
    const { error } = await supabase
      .from('inventory_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteInventoryItem(id: string): Promise<void> {
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ════════════════════════════════════════════════════════════
  // NEW: Stock Operations (Issue / Return / Adjust)
  // ════════════════════════════════════════════════════════════

  async issueStock(id: string, quantity: number, opts?: {
    patient_id?: string;
    procedure_id?: string;
    notes?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<void> {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    const { data: item, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !item) throw new Error('Item not found');
    const available = (item.quantity as number) - (item.reserved as number);
    if (available < quantity) throw new Error(`Insufficient available stock. Available: ${available}`);

    const newQty = (item.quantity as number) - quantity;
    const newUsed = (item.used as number) + quantity;
    const { error: updErr } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty, used: newUsed, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) throw new Error(updErr.message);

    await this.recordTransaction({
      item_type: 'implant',
      item_id: id,
      type: 'deduct',
      operation_type: 'issue',
      quantity,
      item_category: item.category as string,
      item_name: getItemDisplayName(item),
      patient_id: opts?.patient_id,
      procedure_id: opts?.procedure_id,
      notes: opts?.notes,
    });
  },

  async checkProcedureStock(brand: string, size: string, branchId: string): Promise<void> {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .select('quantity')
      .eq('branch_id', branchId)
      .eq('category', 'implant')
      .eq('brand', brand)
      .eq('size', size)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item || (item.quantity as number) <= 0) {
      throw new Error('Not enough stock. Please request this item from the Main Warehouse.');
    }
  },

  async consumeForProcedure(params: {
    branchId: string;
    brand: string;
    size: string;
    patientId?: string;
    procedureId?: string;
  }): Promise<void> {
    // Read current item
    const { data: item, error: readErr } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, used')
      .eq('branch_id', params.branchId)
      .eq('category', 'implant')
      .eq('brand', params.brand)
      .eq('size', params.size)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!item || (item.quantity as number) < 1) {
      throw new Error('Not enough stock. Please request this item from the Main Warehouse.');
    }

    // Atomic update with optimistic lock — only succeeds if quantity unchanged
    const { data: updated, error: updErr } = await supabase
      .from('inventory_items')
      .update({
        quantity: (item.quantity as number) - 1,
        used: ((item.used as number) || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('quantity', item.quantity)
      .select()
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!updated) {
      throw new Error('Concurrent stock change detected. Please retry the procedure.');
    }

    await this.recordTransaction({
      item_type: 'implant',
      item_id: item.id as string,
      type: 'deduct',
      operation_type: 'issue',
      quantity: 1,
      item_category: 'implant',
      item_name: getItemDisplayName(item) || `${params.brand} ${params.size}`,
      patient_id: params.patientId,
      procedure_id: params.procedureId,
      notes: 'Auto-consumed for implant procedure',
    });
  },

  async returnStock(id: string, quantity: number, opts?: {
    notes?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<void> {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    const { data: item, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !item) throw new Error('Item not found');

    const newQty = (item.quantity as number) + quantity;
    const newUsed = Math.max(0, (item.used as number) - quantity);
    const { error: updErr } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty, used: newUsed, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) throw new Error(updErr.message);

    await this.recordTransaction({
      item_type: 'implant',
      item_id: id,
      type: 'add',
      operation_type: 'return',
      quantity,
      item_category: item.category as string,
      item_name: getItemDisplayName(item),
      notes: opts?.notes,
    });
  },

  async adjustStock(id: string, quantityChange: number, notes?: string, change_reason?: string, reason_category?: string): Promise<void> {
    const { data: item, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !item) throw new Error('Item not found');
    const newQty = (item.quantity as number) + quantityChange;
    if (newQty < 0) throw new Error('Insufficient stock');
    const { error: updErr } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) throw new Error(updErr.message);

    await this.recordTransaction({
      item_type: 'implant',
      item_id: id,
      type: quantityChange > 0 ? 'add' : 'deduct',
      operation_type: 'adjust',
      quantity: Math.abs(quantityChange),
      item_category: item.category as string,
      item_name: getItemDisplayName(item),
      notes: notes || undefined,
      change_reason: change_reason || null,
      reason_category: reason_category || null,
    });

    const actorAdjust = await getCurrentUserInfo();
    if (actorAdjust) {
      auditLogService.log({
        user_id: actorAdjust.user_id,
        user_name: actorAdjust.user_name,
        action: 'INVENTORY_CHANGE',
        table_name: 'inventory_items',
        record_id: id,
        new_data: { quantity: (item.quantity as number) + quantityChange, change: quantityChange, notes },
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },

  async addStockToBranch(params: {
    category: string;
    subcategory?: string;
    name?: string;
    brand?: string;
    size?: string;
    unit?: string;
    branch_id: string;
    quantity: number;
    notes?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<void> {
    // Find existing item for this branch + product variant
    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('branch_id', params.branch_id)
      .eq('category', params.category)
      .eq('unit', params.unit || 'piece');

    if (params.subcategory) query = query.eq('subcategory', params.subcategory);
    if (params.name) query = query.eq('name', params.name);
    if (params.brand) query = query.eq('brand', params.brand);
    if (params.size) query = query.eq('size', params.size);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const newQty = (existing.quantity as number) + params.quantity;
      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('inventory_items')
        .insert({
          branch_id: params.branch_id,
          category: params.category,
          subcategory: params.subcategory || null,
          name: params.name || null,
          brand: params.brand || null,
          size: params.size || null,
          unit: params.unit || 'piece',
          quantity: params.quantity,
          reserved: 0,
          used: 0,
          minimum_stock: 0,
        });
      if (error) throw new Error(error.message);
    }

    await this.recordTransaction({
      item_type: params.category === 'implant' ? 'implant' : 'abutment',
      item_id: existing?.id || 'new',
      type: 'add',
      operation_type: 'adjust',
      quantity: params.quantity,
      item_category: params.category,
      item_name: getItemDisplayName({ name: params.name, subcategory: params.subcategory, category: params.category }),
      notes: params.notes || `Added stock to branch ${params.branch_id}`,
    });
  },

  // ════════════════════════════════════════════════════════════
  // NEW: Stock Requests
  // ════════════════════════════════════════════════════════════

  async getStockRequests(): Promise<StockRequest[]> {
    const { data, error } = await supabase
      .from('stock_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(stockRequestFromRow);
  },

  async createStockRequest(req: {
    item_id?: string;
    item_name: string;
    item_category?: string;
    quantity: number;
    notes?: string;
  }): Promise<void> {
    const actor = await getCurrentUserInfo();
    const { error } = await supabase.from('stock_requests').insert([{
      ...req,
      requested_by: actor?.user_id || undefined,
      requested_by_name: actor?.user_name || undefined,
      status: 'pending',
    }]);
    if (error) throw new Error(error.message);
  },

  async updateStockRequestStatus(id: string, status: StockRequestStatus, notes?: string): Promise<void> {
    const actor = await getCurrentUserInfo();
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'approved') {
      payload.approved_by = actor?.user_id;
      payload.approved_by_name = actor?.user_name;
    }
    if (notes) payload.notes = notes;
    const { error } = await supabase.from('stock_requests').update(payload).eq('id', id);
    if (error) throw new Error(error.message);

    // If approved, also issue from inventory
    if (status === 'approved') {
      const { data: req } = await supabase.from('stock_requests').select('*').eq('id', id).single();
      if (req?.item_id) {
        await this.issueStock(req.item_id as string, req.quantity as number, { notes: `Stock request #${id.slice(0, 6)}` });
      }
    }
  },
};
