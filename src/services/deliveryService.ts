import { supabase } from '../integrations/supabase/client';
import type { InventoryDelivery, InventoryReturn } from '../types';

function deliveryFromRow(row: Record<string, unknown>): InventoryDelivery {
  const branch = row.branches as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    from_location: row.from_location as string,
    to_type: row.to_type as 'warehouse' | 'branch',
    to_branch_id: row.to_branch_id as string | undefined,
    item_id: row.item_id as string | undefined,
    item_name: row.item_name as string,
    quantity: row.quantity as number,
    notes: row.notes as string | undefined,
    received_by: row.received_by as string | undefined,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
    branch_name: branch?.name as string | undefined,
  };
}

function returnFromRow(row: Record<string, unknown>): InventoryReturn {
  const branch = row.branches as Record<string, unknown> | undefined;
  const reviewer = row.reviewer as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    from_location: row.from_location as 'warehouse' | 'branch' | 'patient',
    from_branch_id: row.from_branch_id as string | undefined,
    item_id: row.item_id as string | undefined,
    item_name: row.item_name as string,
    quantity: row.quantity as number,
    reason: row.reason as string,
    notes: row.notes as string | undefined,
    status: row.status as InventoryReturn['status'],
    branch_id: row.branch_id as string | undefined,
    reviewed_by: row.reviewed_by as string | undefined,
    reviewed_at: row.reviewed_at as string | undefined,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    branch_name: branch?.name as string | undefined,
    reviewer_name: reviewer?.full_name as string | undefined,
  };
}

export const deliveryService = {
  async getDeliveries(): Promise<InventoryDelivery[]> {
    const { data, error } = await supabase
      .from('inventory_deliveries')
      .select('*, branches!to_branch_id(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => deliveryFromRow(r as Record<string, unknown>));
  },

  async createDelivery(delivery: {
    to_type: 'warehouse' | 'branch';
    to_branch_id?: string;
    item_id?: string;
    item_name: string;
    quantity: number;
    notes?: string;
    received_by?: string;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('inventory_deliveries').insert([{
      ...delivery,
      from_location: 'supplier',
      created_by: user?.id,
    }]);
    if (error) throw new Error(error.message);

    // If delivering to a branch, update branch inventory
    if (delivery.to_type === 'branch' && delivery.to_branch_id && delivery.item_id) {
      const { data: existing } = await supabase
        .from('branch_inventory')
        .select('*')
        .eq('branch_id', delivery.to_branch_id)
        .eq('item_id', delivery.item_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('branch_inventory')
          .update({ quantity: (existing.quantity as number) + delivery.quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('branch_inventory')
          .insert([{ branch_id: delivery.to_branch_id, item_id: delivery.item_id, quantity: delivery.quantity, reserved: 0 }]);
      }
    }
  },

  async getReturns(branchId?: string, status?: string): Promise<InventoryReturn[]> {
    let query = supabase
      .from('inventory_returns')
      .select('*, branches!from_branch_id(name), reviewer:reviewed_by(full_name)');
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => returnFromRow(r));
  },

  async createReturn(ret: {
    from_location: 'warehouse' | 'branch' | 'patient';
    from_branch_id?: string;
    item_id?: string;
    item_name: string;
    quantity: number;
    reason: string;
    notes?: string;
    branch_id?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<InventoryReturn> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from('inventory_returns')
      .insert([{
        from_location: ret.from_location,
        from_branch_id: ret.from_branch_id || null,
        item_id: ret.item_id || null,
        item_name: ret.item_name,
        quantity: ret.quantity,
        reason: ret.reason,
        notes: ret.notes || null,
        branch_id: ret.branch_id || ret.from_branch_id || null,
        created_by: user?.id,
        status: 'pending',
        change_reason: ret.change_reason || null,
        reason_category: ret.reason_category || null,
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return returnFromRow(inserted as Record<string, unknown>);
  },

  async updateReturnStatus(id: string, status: 'approved' | 'rejected', change_reason?: string, reason_category?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const updates: Record<string, unknown> = { status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (change_reason !== undefined) updates.change_reason = change_reason;
    if (reason_category !== undefined) updates.reason_category = reason_category;
    const { error } = await supabase
      .from('inventory_returns')
      .update(updates)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};
