import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import { implantInventoryService } from './implantInventoryService';
import { timelineEventService } from './timelineEventService';
import { getItemDisplayName } from '../utils/inventory';
import type { Procedure, ProcedureKitItem, InventoryItem, ProcedureDoctor, FinancialRecord } from '../types';

function procedureFromRow(row: Record<string, unknown>): Procedure {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    procedure_name: row.procedure_name as string,
    tooth_number: row.tooth_number as string | undefined,
    implant_system: row.implant_system as string | undefined,
    implant_size: row.implant_size as string | undefined,
    implant_brand: row.implant_brand as string | undefined,
    procedure_date: row.procedure_date as string,
    status: row.status as string,
    doctor_name: row.doctor_name as string | undefined,
    notes: row.notes as string | undefined,
    bone_condition: row.bone_condition as string | undefined,
    bone_density: row.bone_density as string | undefined,
    bone_height: row.bone_height != null ? Number(row.bone_height) : undefined,
    bone_width: row.bone_width != null ? Number(row.bone_width) : undefined,
    pathology: row.pathology as string | undefined,
    ct_scan_notes: row.ct_scan_notes as string | undefined,
    chronic_disease: row.chronic_disease as string | undefined,
    medication: row.medication as string | undefined,
    implant_decision: row.implant_decision as Procedure['implant_decision'],
    extraction_needed: row.extraction_needed as boolean | undefined,
    abutment_type: row.abutment_type as string | undefined,
    kit_id: row.kit_id as string | undefined,
    kit_snapshot: row.kit_snapshot ? (typeof row.kit_snapshot === 'string' ? JSON.parse(row.kit_snapshot as string) : row.kit_snapshot as Record<string, unknown>) : undefined,
    branch_id: row.branch_id as string | null | undefined,
    is_deleted: row.is_deleted as boolean | undefined,
    deleted_at: row.deleted_at as string | null | undefined,
    created_at: row.created_at as string | undefined,
  };
}

function doctorFromRow(row: Record<string, unknown>): ProcedureDoctor {
  return {
    id: row.id as string,
    procedure_id: row.procedure_id as string,
    doctor_id: row.doctor_id as string,
    doctor_name: (row.users as { full_name?: string } | null)?.full_name || (row.doctor_id as string),
    role_in_procedure: (row.role_in_procedure as 'primary' | 'assistant') || 'assistant',
    display_order: (row.display_order as number) || 0,
  };
}

export const procedureService = {
  async getAll(branchId?: string | null): Promise<Procedure[]> {
    let q = supabase.from('procedures').select('*, patients(full_name)').eq('is_deleted', false).order('procedure_date', { ascending: false });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getByPatient(patientId: string): Promise<Procedure[]> {
    const { data, error } = await supabase.from('procedures').select('*').eq('patient_id', patientId).eq('is_deleted', false).order('procedure_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getById(id: string): Promise<Procedure | null> {
    const { data, error } = await supabase.from('procedures').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? procedureFromRow(data) : null;
  },

  async getDoctorsByProcedureIds(procedureIds: string[]): Promise<ProcedureDoctor[]> {
    if (procedureIds.length === 0) return [];
    const { data, error } = await supabase
      .from('procedure_doctors')
      .select('*, users:doctor_id(full_name)')
      .in('procedure_id', procedureIds)
      .order('display_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(doctorFromRow);
  },

  async getDoctors(procedureId: string): Promise<ProcedureDoctor[]> {
    const { data, error } = await supabase
      .from('procedure_doctors')
      .select('*, users:doctor_id(full_name)')
      .eq('procedure_id', procedureId)
      .order('display_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(doctorFromRow);
  },

  async assignDoctors(procedureId: string, doctors: { doctor_id: string; role_in_procedure: 'primary' | 'assistant'; display_order: number }[]): Promise<void> {
    await supabase.from('procedure_doctors').delete().eq('procedure_id', procedureId);
    if (doctors.length > 0) {
      const pct = Math.round((100 / doctors.length) * 100) / 100;
      const { error } = await supabase.from('procedure_doctors').insert(
        doctors.map(d => ({ procedure_id: procedureId, ...d, revenue_percentage: pct }))
      );
      if (error) throw new Error(error.message);
    }
  },

  async getInvoiceForProcedure(procedureId: string): Promise<FinancialRecord | null> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('procedure_id', procedureId)
      .eq('record_type', 'invoice')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? {
      id: data.id as string,
      patient_id: data.patient_id as string,
      patient_name: data.patient_name as string,
      record_type: data.record_type as FinancialRecord['record_type'],
      parent_invoice_id: data.parent_invoice_id as string | null | undefined,
      invoice_name: data.invoice_name as string | undefined,
      total_amount: Number(data.total_amount),
      amount: Number(data.amount),
      paid_so_far: Number(data.paid_so_far),
      remaining_amount: Number(data.remaining_amount),
      status: data.status as FinancialRecord['status'],
      payment_method: data.payment_method as FinancialRecord['payment_method'],
      notes: data.notes as string | undefined,
      created_at: data.created_at as string | undefined,
      procedure_id: data.procedure_id as string | null | undefined,
    } : null;
  },

  async getByDoctor(doctorId: string, branchId?: string | null): Promise<Procedure[]> {
    const { data: pd } = await supabase
      .from('procedure_doctors')
      .select('procedure_id')
      .eq('doctor_id', doctorId);
    const ids = (pd || []).map(r => r.procedure_id);
    if (ids.length === 0) return [];
    let q = supabase
      .from('procedures')
      .select('*')
      .in('id', ids)
      .eq('is_deleted', false)
      .order('procedure_date', { ascending: false });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getProceduresByDoctorForPeriod(doctorId: string, fromDate: string, toDate: string): Promise<Procedure[]> {
    const { data: pd } = await supabase
      .from('procedure_doctors')
      .select('procedure_id')
      .eq('doctor_id', doctorId);
    const ids = (pd || []).map(r => r.procedure_id);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('procedures')
      .select('*')
      .in('id', ids)
      .eq('is_deleted', false)
      .gte('procedure_date', fromDate)
      .lte('procedure_date', toDate)
      .order('procedure_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getProcedureStatsForDoctor(doctorId: string): Promise<{ total: number; byStatus: Record<string, number> }> {
    const { data: pd } = await supabase
      .from('procedure_doctors')
      .select('procedure_id')
      .eq('doctor_id', doctorId);
    const ids = (pd || []).map(r => r.procedure_id);
    if (ids.length === 0) return { total: 0, byStatus: {} };
    const { data } = await supabase
      .from('procedures')
      .select('status')
      .in('id', ids)
      .eq('is_deleted', false);
    const rows = (data || []) as { status: string }[];
    const byStatus: Record<string, number> = {};
    rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return { total: rows.length, byStatus };
  },

  async getRevenueByDoctor(doctorId: string, fromDate?: string, toDate?: string): Promise<{ totalRevenue: number; collected: number; pending: number }> {
    const pdQuery = supabase
      .from('procedure_doctors')
      .select('procedure_id, revenue_percentage')
      .eq('doctor_id', doctorId);
    const { data: pd } = await pdQuery;
    if (!pd || pd.length === 0) return { totalRevenue: 0, collected: 0, pending: 0 };

    const procedureIds = [...new Set(pd.map(r => r.procedure_id as string))];

    let procQuery = supabase
      .from('procedures')
      .select('id, procedure_date')
      .in('id', procedureIds)
      .eq('is_deleted', false);
    if (fromDate) procQuery = procQuery.gte('procedure_date', fromDate);
    if (toDate) procQuery = procQuery.lte('procedure_date', toDate);
    const { data: procedures } = await procQuery;

    if (!procedures || procedures.length === 0) return { totalRevenue: 0, collected: 0, pending: 0 };

    const filteredIds = procedures.map(p => p.id as string);

    const { data: invoices } = await supabase
      .from('financial_records')
      .select('id, total_amount, paid_so_far, remaining_amount, procedure_id')
      .in('procedure_id', filteredIds)
      .eq('record_type', 'invoice');

    if (!invoices || invoices.length === 0) return { totalRevenue: 0, collected: 0, pending: 0 };

    const invoiceByProc = new Map<string, { total_amount: number; paid_so_far: number; remaining_amount: number }>();
    invoices.forEach(inv => {
      if (inv.procedure_id) {
        invoiceByProc.set(inv.procedure_id as string, {
          total_amount: Number(inv.total_amount),
          paid_so_far: Number(inv.paid_so_far),
          remaining_amount: Number(inv.remaining_amount),
        });
      }
    });

    const procPct = new Map<string, number>();
    pd.forEach(r => {
      const pid = r.procedure_id as string;
      procPct.set(pid, Number(r.revenue_percentage) || 0);
    });

    let totalRevenue = 0;
    let collected = 0;
    let pending = 0;

    for (const procId of filteredIds) {
      const inv = invoiceByProc.get(procId);
      const pct = procPct.get(procId) || 0;
      if (inv) {
        totalRevenue += inv.total_amount * (pct / 100);
        collected += inv.paid_so_far * (pct / 100);
        pending += inv.remaining_amount * (pct / 100);
      }
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      collected: Math.round(collected * 100) / 100,
      pending: Math.round(pending * 100) / 100,
    };
  },

  async create(procedure: Omit<Procedure, 'id' | 'created_at'>, branchId?: string, kitItems?: ProcedureKitItem[], change_reason?: string, reason_category?: string): Promise<Procedure> {
    if (kitItems && kitItems.length > 0 && branchId) {
      const missingItems: string[] = [];
      const inventoryMap = new Map<string, InventoryItem>();

      for (const kitItem of kitItems) {
        const { data: item } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('branch_id', branchId)
          .eq('category', kitItem.category)
          .eq('brand', kitItem.brand || '')
          .eq('size', kitItem.size || '')
          .maybeSingle();

        if (!item || (item.quantity as number) < kitItem.quantity) {
          missingItems.push(`${getItemDisplayName(kitItem)} (need ${kitItem.quantity})`);
        } else {
          inventoryMap.set(kitItem.category + '|' + (kitItem.brand || '') + '|' + (kitItem.size || ''), item as InventoryItem);
        }
      }

      if (missingItems.length > 0) {
        throw new Error(`Not enough stock for: ${missingItems.join(', ')}. Please request from Main Warehouse.`);
      }
    } else if (branchId && procedure.implant_system && procedure.implant_size) {
      await implantInventoryService.checkProcedureStock(
        procedure.implant_system,
        procedure.implant_size,
        branchId,
      );
    }

    const { data, error } = await supabase.from('procedures').insert([procedure]).select().single();
    if (error) throw new Error(error.message);

    if (kitItems && kitItems.length > 0 && branchId) {
      for (const kitItem of kitItems) {
        try {
          const { data: item } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('branch_id', branchId)
            .eq('category', kitItem.category)
            .eq('brand', kitItem.brand || '')
            .eq('size', kitItem.size || '')
            .maybeSingle();

          if (item) {
            const newQty = (item.quantity as number) - kitItem.quantity;
            const newUsed = (item.used as number) + kitItem.quantity;
            await supabase.from('inventory_items').update({ quantity: newQty, used: newUsed, updated_at: new Date().toISOString() }).eq('id', item.id);

            await implantInventoryService.recordTransaction({
              item_type: kitItem.category === 'implant' ? 'implant' : 'abutment',
              item_id: item.id as string,
              type: 'deduct',
              operation_type: 'issue',
              quantity: kitItem.quantity,
              item_category: kitItem.category,
              item_name: getItemDisplayName(kitItem) || getItemDisplayName(item),
              patient_id: procedure.patient_id,
              procedure_id: data.id,
              notes: `Consumed from kit: ${getItemDisplayName(kitItem)}`,
            });
          }
        } catch {
          // Skip individual item errors
        }
      }
    } else if (branchId && procedure.implant_system && procedure.implant_size) {
      await implantInventoryService.consumeForProcedure({
        branchId,
        brand: procedure.implant_system,
        size: procedure.implant_size,
        patientId: procedure.patient_id,
        procedureId: data.id,
      });
    }

    if (branchId && procedure.abutment_type) {
      try {
        await implantInventoryService.consumeAbutmentForProcedure({
          branchId,
          abutmentType: procedure.abutment_type,
          patientId: procedure.patient_id,
          procedureId: data.id,
        });
      } catch {
        // Don't block procedure creation if abutment consumption fails
      }
    }

    // Write timeline event
    timelineEventService.write({
      patient_id: procedure.patient_id,
      event_type: 'procedure_created',
      description: `${procedure.procedure_name}${procedure.tooth_number ? ` (Tooth #${procedure.tooth_number})` : ''} — ${procedure.status}`,
      related_entity_type: 'procedure',
      related_entity_id: data.id,
      branch_id: procedure.branch_id || undefined,
      metadata: { status: procedure.status, tooth_number: procedure.tooth_number, implant_system: procedure.implant_system },
    }).catch(() => {});

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'procedures',
        record_id: data.id,
        new_data: data as Record<string, unknown>,
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }

    return procedureFromRow(data);
  },

  async updateStatus(id: string, status: string, change_reason?: string, reason_category?: string): Promise<void> {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (change_reason !== undefined) updates.change_reason = change_reason;
    if (reason_category !== undefined) updates.reason_category = reason_category;
    const { error } = await supabase.from('procedures').update(updates).eq('id', id);
    if (error) throw new Error(error.message);

    // Write timeline event
    const proc = await this.getById(id).catch(() => null);
    if (proc?.patient_id) {
      timelineEventService.write({
        patient_id: proc.patient_id,
        event_type: status === 'completed' ? 'procedure_completed' : `procedure_${status}`,
        description: `${proc.procedure_name}${proc.tooth_number ? ` (Tooth #${proc.tooth_number})` : ''} — ${status}`,
        related_entity_type: 'procedure',
        related_entity_id: id,
        branch_id: proc.branch_id || undefined,
        metadata: { status, previous_status: proc.status },
      }).catch(() => {});
    }

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'procedures',
        record_id: id,
        new_data: { status },
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },

  async update(id: string, updates: Partial<Procedure>, change_reason?: string, reason_category?: string): Promise<void> {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (change_reason !== undefined) payload.change_reason = change_reason;
    if (reason_category !== undefined) payload.reason_category = reason_category;
    const { error } = await supabase.from('procedures').update(payload).eq('id', id);
    if (error) throw new Error(error.message);

    // Write timeline event
    if (updates.status) {
      const proc2 = await this.getById(id).catch(() => null);
      if (proc2?.patient_id) {
        timelineEventService.write({
          patient_id: proc2.patient_id,
          event_type: updates.status === 'completed' ? 'procedure_completed' : `procedure_${updates.status}`,
          description: `${proc2.procedure_name}${proc2.tooth_number ? ` (Tooth #${proc2.tooth_number})` : ''} — ${updates.status}`,
          related_entity_type: 'procedure',
          related_entity_id: id,
          branch_id: proc2.branch_id || undefined,
          metadata: { status: updates.status },
        }).catch(() => {});
      }
    }

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'procedures',
        record_id: id,
        new_data: updates as Record<string, unknown>,
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },

  async delete(id: string, change_reason?: string, reason_category?: string): Promise<void> {
    // Check for linked invoice with payments
    const { data: invoice } = await supabase
      .from('financial_records')
      .select('id, paid_so_far, status')
      .eq('procedure_id', id)
      .eq('record_type', 'invoice')
      .maybeSingle();

    if (invoice) {
      const paidSoFar = Number(invoice.paid_so_far);
      if (paidSoFar > 0) {
        throw new Error(
          'This procedure has financial transactions. Void or resolve the invoice before deleting the procedure.'
        );
      }
      // Invoice exists with no payments → mark it as Cancelled
      await supabase
        .from('financial_records')
        .update({ status: 'Cancelled', notes: `Cancelled due to procedure deletion: ${change_reason || 'No reason provided'}` })
        .eq('id', invoice.id);
    }

    // Soft delete the procedure
    const { error } = await supabase
      .from('procedures')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);

    // Write timeline event
    const hasInvoice = !!invoice;
    const proc = await this.getById(id).catch(() => null);
    if (proc?.patient_id) {
      timelineEventService.write({
        patient_id: proc.patient_id,
        event_type: 'procedure_deleted',
        description: `${proc.procedure_name}${proc.tooth_number ? ` (Tooth #${proc.tooth_number})` : ''} — deleted${hasInvoice ? ' (invoice cancelled)' : ''}`,
        related_entity_type: 'procedure',
        related_entity_id: id,
        branch_id: proc.branch_id || undefined,
        metadata: { is_deleted: true, had_invoice: hasInvoice },
      }).catch(() => {});
    }

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'SOFT_DELETE',
        table_name: 'procedures',
        record_id: id,
        new_data: { is_deleted: true, deleted_at: new Date().toISOString() } as Record<string, unknown>,
        reason_category: reason_category || null,
        change_reason: change_reason || null,
      });
    }
  },

  async getStats(branchId?: string | null): Promise<{ total: number; byStatus: Record<string, number> }> {
    let q = supabase.from('procedures').select('status').eq('is_deleted', false);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q;
    const rows = (data || []) as { status: string }[];
    const byStatus: Record<string, number> = {};
    rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return { total: rows.length, byStatus };
  },
};
