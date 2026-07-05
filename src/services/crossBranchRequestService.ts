import { supabase } from '../integrations/supabase/client';
import type { CrossBranchRequest, CrossBranchDelivery, RequestableItem, CrossBranchDeliveryStatus } from '../types';

function rowToRequest(row: Record<string, unknown>): CrossBranchRequest {
  return {
    id: row.id as string,
    from_branch_id: row.from_branch_id as string,
    to_branch_id: row.to_branch_id as string,
    item_id: row.item_id as string | undefined,
    item_name: row.item_name as string,
    item_category: row.item_category as string | undefined,
    quantity: row.quantity as number,
    status: row.status as CrossBranchRequest['status'],
    requested_by: row.requested_by as string | undefined,
    responded_by: row.responded_by as string | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    from_branch_name: row.from_branch_name as string | undefined,
    to_branch_name: row.to_branch_name as string | undefined,
    requester_name: row.requester_name as string | undefined,
    responder_name: row.responder_name as string | undefined,
    delivery_id: row.delivery_id as string | undefined,
    delivery_status: row.delivery_status as CrossBranchDeliveryStatus | undefined,
  };
}

function rowToDelivery(row: Record<string, unknown>): CrossBranchDelivery {
  return {
    id: row.id as string,
    request_id: row.request_id as string,
    status: row.status as CrossBranchDeliveryStatus,
    updated_by: row.updated_by as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export const crossBranchRequestService = {
  async getAll(): Promise<CrossBranchRequest[]> {
    const { data, error } = await supabase
      .from('cross_branch_requests')
      .select(`
        *,
        from_branch:from_branch_id(name),
        to_branch:to_branch_id(name),
        requester:requested_by(full_name),
        responder:responded_by(full_name)
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(r => rowToRequest({
      ...r,
      from_branch_name: r.from_branch?.name,
      to_branch_name: r.to_branch?.name,
      requester_name: r.requester?.full_name,
      responder_name: r.responder?.full_name,
    }));
  },

  async getByBranch(branchId: string): Promise<CrossBranchRequest[]> {
    const { data, error } = await supabase
      .from('cross_branch_requests')
      .select(`
        *,
        from_branch:from_branch_id(name),
        to_branch:to_branch_id(name),
        requester:requested_by(full_name),
        responder:responded_by(full_name)
      `)
      .or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(r => rowToRequest({
      ...r,
      from_branch_name: r.from_branch?.name,
      to_branch_name: r.to_branch?.name,
      requester_name: r.requester?.full_name,
      responder_name: r.responder?.full_name,
    }));
  },

  async getIncoming(branchId: string): Promise<CrossBranchRequest[]> {
    const { data, error } = await supabase
      .from('cross_branch_requests')
      .select(`
        *,
        from_branch:from_branch_id(name),
        to_branch:to_branch_id(name)
      `)
      .eq('from_branch_id', branchId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(r => rowToRequest({
      ...r,
      from_branch_name: r.from_branch?.name,
      to_branch_name: r.to_branch?.name,
    }));
  },

  async getRequestableItems(excludeBranchId: string, category?: string): Promise<RequestableItem[]> {
    const { data, error } = await supabase
      .rpc('get_requestable_items', { p_exclude_branch_id: excludeBranchId, p_category: category || null });
    if (error) throw new Error(error.message);
    return (data || []) as RequestableItem[];
  },

  async createFromWarehouse(params: {
    lookup_key: string;
    category: string;
    to_branch_id: string;
    item_name: string;
    quantity: number;
    notes?: string;
  }): Promise<CrossBranchRequest> {
    // Find the best source branch
    const { data: source, error: srcErr } = await supabase
      .rpc('find_best_source_branch', {
        p_lookup_key: params.lookup_key,
        p_category: params.category,
        p_exclude_branch_id: params.to_branch_id,
      });
    if (srcErr) throw new Error(srcErr.message);
    if (!source || source.length === 0) {
      throw new Error('No branch has this item in stock');
    }
    const bestSource = source[0] as { branch_id: string; item_id: string; available_qty: number };

    if (bestSource.available_qty < params.quantity) {
      throw new Error(`Insufficient stock. Only ${bestSource.available_qty} available`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from('cross_branch_requests')
      .insert({
        from_branch_id: bestSource.branch_id,
        to_branch_id: params.to_branch_id,
        item_id: bestSource.item_id,
        item_name: params.item_name,
        item_category: params.category,
        quantity: params.quantity,
        requested_by: user?.id || null,
        notes: params.notes || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToRequest(inserted);
  },

  async create(data: {
    from_branch_id: string;
    to_branch_id: string;
    item_id?: string;
    item_name: string;
    item_category?: string;
    quantity: number;
    notes?: string;
  }): Promise<CrossBranchRequest> {
    const { data: { user } } = await supabase.auth.getUser();

    // Resolve the correct item_id at the source branch
    let resolvedItemId = data.item_id || null;
    if (resolvedItemId && data.from_branch_id) {
      // Look up the item details from the passed item_id
      const { data: srcItem } = await supabase
        .from('inventory_items')
        .select('category, subcategory, name, brand, size')
        .eq('id', resolvedItemId)
        .maybeSingle();

      if (srcItem) {
        // Now find the matching item at the actual source branch
        let q = supabase.from('inventory_items').select('id').eq('branch_id', data.from_branch_id).eq('category', srcItem.category);
        if (srcItem.subcategory) q = q.eq('subcategory', srcItem.subcategory);
        if (srcItem.name) q = q.eq('name', srcItem.name);
        if (srcItem.brand) q = q.eq('brand', srcItem.brand);
        if (srcItem.size) q = q.eq('size', srcItem.size);
        const { data: branchItem } = await q.maybeSingle();
        if (branchItem) resolvedItemId = branchItem.id;
      }
    }

    const { data: inserted, error } = await supabase
      .from('cross_branch_requests')
      .insert({
        from_branch_id: data.from_branch_id,
        to_branch_id: data.to_branch_id,
        item_id: resolvedItemId,
        item_name: data.item_name,
        item_category: data.item_category || null,
        quantity: data.quantity,
        requested_by: user?.id || null,
        notes: data.notes || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToRequest(inserted);
  },

  async checkSufficientStock(itemId: string, branchId: string, quantity: number): Promise<{ sufficient: boolean; available: number }> {
    // First get the item's product variant info
    const { data: item } = await supabase
      .from('inventory_items')
      .select('category, subcategory, name, brand, size')
      .eq('id', itemId)
      .maybeSingle();
    if (!item) return { sufficient: false, available: 0 };

    // Look up the same product variant at the source branch
    let q = supabase.from('inventory_items').select('quantity').eq('branch_id', branchId).eq('category', item.category);
    if (item.subcategory) q = q.eq('subcategory', item.subcategory);
    if (item.name) q = q.eq('name', item.name);
    if (item.brand) q = q.eq('brand', item.brand);
    if (item.size) q = q.eq('size', item.size);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    const available = data?.quantity ?? 0;
    return { sufficient: available >= quantity, available };
  },

  async approveRequest(requestId: string, respondedBy?: string, change_reason?: string, reason_category?: string): Promise<void> {
    const { data: req, error: fetchErr } = await supabase
      .from('cross_branch_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!req) throw new Error('Request not found');

    if (req.item_id) {
      const stock = await this.checkSufficientStock(req.item_id, req.from_branch_id, req.quantity);
      if (!stock.sufficient) {
        throw new Error(`Insufficient stock. Only ${stock.available} available, requested ${req.quantity}`);
      }
    }

    await this.updateStatus(requestId, 'approved', respondedBy, change_reason, reason_category);
    await this.createDelivery(requestId);
  },

  async updateStatus(id: string, status: CrossBranchRequest['status'], respondedBy?: string, change_reason?: string, reason_category?: string): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (respondedBy) updates.responded_by = respondedBy;
    if (change_reason !== undefined) updates.change_reason = change_reason;
    if (reason_category !== undefined) updates.reason_category = reason_category;
    updates.updated_at = new Date().toISOString();
    const { error } = await supabase.from('cross_branch_requests').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ── Delivery methods ──

  async createDelivery(requestId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('cross_branch_deliveries')
      .insert({ request_id: requestId, status: 'preparing', updated_by: user?.id || null });
    if (error) throw new Error(error.message);
  },

  async updateDeliveryStatus(deliveryId: string, status: CrossBranchDeliveryStatus, change_reason?: string, reason_category?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const updates: Record<string, unknown> = { status, updated_by: user?.id || null, updated_at: new Date().toISOString() };
    if (change_reason !== undefined) updates.change_reason = change_reason;
    if (reason_category !== undefined) updates.reason_category = reason_category;
    const { error } = await supabase
      .from('cross_branch_deliveries')
      .update(updates)
      .eq('id', deliveryId);
    if (error) throw new Error(error.message);
  },

  async getDeliveriesForBranches(): Promise<(CrossBranchDelivery & { request: CrossBranchRequest })[]> {
    const { data, error } = await supabase
      .from('cross_branch_deliveries')
      .select(`
        *,
        request:request_id(
          *,
          from_branch:from_branch_id(name),
          to_branch:to_branch_id(name)
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => {
      const req = r.request as Record<string, unknown> || {};
      return {
        ...rowToDelivery(r),
        request: rowToRequest({
          ...req,
          from_branch_name: (req.from_branch as Record<string, unknown>)?.['name'],
          to_branch_name: (req.to_branch as Record<string, unknown>)?.['name'],
        }),
      };
    });
  },

  async getDeliveryByRequest(requestId: string): Promise<CrossBranchDelivery | null> {
    const { data, error } = await supabase
      .from('cross_branch_deliveries')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToDelivery(data) : null;
  },
};
