import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import { implantInventoryService } from './implantInventoryService';
import { getItemDisplayName } from '../utils/inventory';
import type { Procedure, ProcedureKitItem, InventoryItem } from '../types';

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
    created_at: row.created_at as string | undefined,
  };
}

export const procedureService = {
  async getAll(branchId?: string | null): Promise<Procedure[]> {
    let q = supabase.from('procedures').select('*, patients(full_name)').order('procedure_date', { ascending: false });
    if (branchId) q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getByPatient(patientId: string): Promise<Procedure[]> {
    const { data, error } = await supabase.from('procedures').select('*').eq('patient_id', patientId).order('procedure_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(procedureFromRow);
  },

  async getById(id: string): Promise<Procedure | null> {
    const { data, error } = await supabase.from('procedures').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? procedureFromRow(data) : null;
  },

  async create(procedure: Omit<Procedure, 'id' | 'created_at'>, branchId?: string, kitItems?: ProcedureKitItem[]): Promise<Procedure> {
    // If using a kit, check ALL items first
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
      // Single implant check (existing behavior)
      await implantInventoryService.checkProcedureStock(
        procedure.implant_system,
        procedure.implant_size,
        branchId,
      );
    }

    const { data, error } = await supabase.from('procedures').insert([procedure]).select().single();
    if (error) throw new Error(error.message);

    // Consume inventory
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
          // Skip individual item errors - pre-check already passed
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

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'procedures',
        record_id: data.id,
        new_data: data as Record<string, unknown>,
      });
    }

    return procedureFromRow(data);
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from('procedures').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'procedures',
        record_id: id,
        new_data: { status },
      });
    }
  },

  async update(id: string, updates: Partial<Procedure>): Promise<void> {
    const { error } = await supabase.from('procedures').update(updates).eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'procedures',
        record_id: id,
        new_data: updates as Record<string, unknown>,
      });
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('procedures').delete().eq('id', id);
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'DELETE',
        table_name: 'procedures',
        record_id: id,
      });
    }
  },

  async getStats(branchId?: string | null): Promise<{ total: number; byStatus: Record<string, number> }> {
    let q = supabase.from('procedures').select('status');
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q;
    const rows = (data || []) as { status: string }[];
    const byStatus: Record<string, number> = {};
    rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return { total: rows.length, byStatus };
  },
};
