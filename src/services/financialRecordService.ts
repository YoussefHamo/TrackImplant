import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import { timelineEventService } from './timelineEventService';
import type { FinancialRecord, PaymentStatus, PaymentMethod } from '../types';

function rowToRecord(row: Record<string, unknown>): FinancialRecord {
  const branchObj = row.branches as { name?: string } | null | undefined;
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    patient_name: row.patient_name as string,
    record_type: row.record_type as FinancialRecord['record_type'],
    parent_invoice_id: row.parent_invoice_id as string | null | undefined,
    invoice_name: row.invoice_name as string | undefined,
    total_amount: Number(row.total_amount),
    amount: Number(row.amount),
    paid_so_far: Number(row.paid_so_far),
    remaining_amount: Number(row.remaining_amount),
    status: row.status as PaymentStatus,
    payment_method: row.payment_method as PaymentMethod | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
    branch_id: row.branch_id as string | null | undefined,
    branch_name: branchObj?.name ?? null,
    procedure_id: row.procedure_id as string | null | undefined,
  };
}

export const financialRecordService = {
  async getByPatient(patientId: string): Promise<FinancialRecord[]> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*, branches:branch_id(name)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToRecord);
  },

  async getAllInvoices(): Promise<FinancialRecord[]> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*, branches:branch_id(name)')
      .eq('record_type', 'invoice')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToRecord);
  },

  async getInvoiceById(id: string): Promise<FinancialRecord | null> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('id', id)
      .eq('record_type', 'invoice')
      .single();
    if (error) throw new Error(error.message);
    return data ? rowToRecord(data) : null;
  },

  async getPaymentsByInvoice(invoiceId: string): Promise<FinancialRecord[]> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('parent_invoice_id', invoiceId)
      .eq('record_type', 'payment')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToRecord);
  },

  async syncInvoice(invoiceId: string): Promise<void> {
    const { data: invoice } = await supabase
      .from('financial_records')
      .select('total_amount')
      .eq('id', invoiceId)
      .single();
    if (!invoice) return;

    const { data: payments } = await supabase
      .from('financial_records')
      .select('amount')
      .eq('parent_invoice_id', invoiceId)
      .eq('record_type', 'payment');

    const totalPaid = ((payments || []) as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0);
    const totalAmount = Number((invoice as { total_amount: number }).total_amount);
    const remaining = Math.max(0, totalAmount - totalPaid);
    const paid = Math.min(totalPaid, totalAmount);
    let status: PaymentStatus;
    if (paid <= 0) status = 'Pending';
    else if (paid < totalAmount) status = 'Partial';
    else status = 'Paid';

    const { error } = await supabase
      .from('financial_records')
      .update({ paid_so_far: paid, remaining_amount: remaining, status })
      .eq('id', invoiceId);
    if (error) throw new Error(error.message);
  },

  async getByProcedure(procedureId: string): Promise<FinancialRecord | null> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*, branches:branch_id(name)')
      .eq('procedure_id', procedureId)
      .eq('record_type', 'invoice')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToRecord(data) : null;
  },

  async createInvoice(data: {
    patient_id: string;
    patient_name: string;
    invoice_name: string;
    total_amount: number;
    notes?: string;
    procedure_id?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<FinancialRecord> {
    const record: Record<string, unknown> = {
      patient_id: data.patient_id,
      patient_name: data.patient_name,
      record_type: 'invoice',
      invoice_name: data.invoice_name,
      total_amount: data.total_amount,
      amount: 0,
      paid_so_far: 0,
      remaining_amount: data.total_amount,
      status: 'Pending',
      notes: data.notes || null,
      change_reason: data.change_reason || null,
      reason_category: data.reason_category || null,
    };
    if (data.procedure_id) record.procedure_id = data.procedure_id;
    const { data: inserted, error } = await supabase
      .from('financial_records')
      .insert([record])
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Write timeline event
    timelineEventService.write({
      patient_id: data.patient_id,
      event_type: 'invoice_created',
      description: `Invoice: ${data.invoice_name} — $${data.total_amount.toFixed(2)} (Pending)`,
      related_entity_type: 'financial_record',
      related_entity_id: inserted.id,
      metadata: { record_type: 'invoice', total_amount: data.total_amount, invoice_name: data.invoice_name },
    }).catch(() => {});

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'financial_records',
        record_id: inserted.id,
        new_data: inserted as Record<string, unknown>,
        reason_category: data.reason_category || null,
        change_reason: data.change_reason || null,
      });
    }

    return rowToRecord(inserted);
  },

  async addPayment(data: {
    invoice_id: string;
    patient_id: string;
    patient_name: string;
    amount: number;
    payment_method?: PaymentMethod;
    notes?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<FinancialRecord> {
    const record = {
      patient_id: data.patient_id,
      patient_name: data.patient_name,
      record_type: 'payment' as const,
      parent_invoice_id: data.invoice_id,
      amount: data.amount,
      total_amount: 0,
      paid_so_far: 0,
      remaining_amount: 0,
      status: 'Paid' as PaymentStatus,
      payment_method: data.payment_method || 'cash',
      notes: data.notes || null,
      change_reason: data.change_reason || null,
      reason_category: data.reason_category || null,
    };
    const { data: inserted, error } = await supabase
      .from('financial_records')
      .insert([record])
      .select()
      .single();
    if (error) throw new Error(error.message);

    await this.syncInvoice(data.invoice_id);

    // Write timeline event
    timelineEventService.write({
      patient_id: data.patient_id,
      event_type: 'payment_added',
      description: `Payment: $${Math.abs(data.amount).toFixed(2)}${data.payment_method ? ` via ${data.payment_method}` : ''}`,
      related_entity_type: 'financial_record',
      related_entity_id: inserted.id,
      metadata: { record_type: 'payment', amount: data.amount, payment_method: data.payment_method },
    }).catch(() => {});

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'PAYMENT_CHANGE',
        table_name: 'financial_records',
        record_id: inserted.id,
        new_data: data as unknown as Record<string, unknown>,
        reason_category: data.reason_category || null,
        change_reason: data.change_reason || null,
      });
    }

    return rowToRecord(inserted);
  },

  async createRefund(data: {
    invoice_id: string;
    patient_id: string;
    patient_name: string;
    amount: number;
    payment_method?: string;
    refund_type?: 'insurance' | 'cash';
    notes?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<FinancialRecord> {
    const { data: invoice, error: invErr } = await supabase
      .from('financial_records')
      .select('*')
      .eq('id', data.invoice_id)
      .single();
    if (invErr || !invoice) throw new Error('Invoice not found');

    const paidSoFar = Number(invoice.paid_so_far);
    if (paidSoFar <= 0) throw new Error('No payments to refund');
    if (data.amount > paidSoFar) throw new Error('Refund amount exceeds paid amount');

    const refundType = data.refund_type || 'cash';
    const refundNotes = refundType === 'insurance'
      ? `[Insurance Refund] ${data.notes || ''}`
      : `[Cash Refund] ${data.notes || ''}`;

    const { data: refund, error } = await supabase
      .from('financial_records')
      .insert({
        patient_id: data.patient_id,
        patient_name: data.patient_name,
        record_type: 'payment',
        parent_invoice_id: data.invoice_id,
        amount: -Math.abs(data.amount),
        total_amount: 0,
        paid_so_far: 0,
        remaining_amount: 0,
        status: 'Paid',
        payment_method: data.payment_method || 'cash',
        notes: refundNotes.trim(),
        change_reason: data.change_reason || 'Refund processed',
        reason_category: data.reason_category || 'Refund Correction',
      })
      .select()
      .single();
    if (error) throw error;

    // Update paid_so_far without changing invoice status
    const newPaidSoFar = Math.max(0, paidSoFar - data.amount);
    const { error: updateErr } = await supabase
      .from('financial_records')
      .update({ paid_so_far: newPaidSoFar, remaining_amount: Math.max(0, Number(invoice.total_amount) - newPaidSoFar) })
      .eq('id', data.invoice_id);
    if (updateErr) throw updateErr;

    // Write timeline event
    timelineEventService.write({
      patient_id: data.patient_id,
      event_type: 'refund_created',
      description: `Refund: $${Math.abs(data.amount).toFixed(2)} via ${data.refund_type || data.payment_method || 'cash'}`,
      related_entity_type: 'financial_record',
      related_entity_id: refund.id,
      metadata: { record_type: 'payment', amount: -Math.abs(data.amount), refund_type: data.refund_type },
    }).catch(() => {});

    const actor = await getCurrentUserInfo();
    if (actor) {
      await auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'PAYMENT_CHANGE',
        table_name: 'financial_records',
        record_id: refund.id,
        new_data: refund,
        reason_category: data.reason_category || 'Refund Correction',
        change_reason: data.change_reason || 'Refund processed',
      });
    }

    return refund;
  },

  async updateInvoice(id: string, data: {
    invoice_name?: string;
    total_amount?: number;
    notes?: string;
    change_reason?: string;
    reason_category?: string;
  }): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.invoice_name !== undefined) updateData.invoice_name = data.invoice_name;
    if (data.total_amount !== undefined) updateData.total_amount = data.total_amount;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.change_reason !== undefined) updateData.change_reason = data.change_reason;
    if (data.reason_category !== undefined) updateData.reason_category = data.reason_category;
    const { error } = await supabase.from('financial_records').update(updateData).eq('id', id).eq('record_type', 'invoice');
    if (error) throw new Error(error.message);
    if (data.total_amount !== undefined) await this.syncInvoice(id);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'UPDATE',
        table_name: 'financial_records',
        record_id: id,
        new_data: data as unknown as Record<string, unknown>,
        reason_category: data.reason_category || null,
        change_reason: data.change_reason || null,
      });
    }
  },

  async deleteRecord(id: string, reason?: { change_reason?: string; reason_category?: string }): Promise<void> {
    const { data: rec } = await supabase.from('financial_records').select('record_type, parent_invoice_id, patient_id, amount, invoice_name, total_amount').eq('id', id).single();
    if (rec?.patient_id) {
      timelineEventService.write({
        patient_id: rec.patient_id as string,
        event_type: rec.record_type === 'invoice' ? 'invoice_deleted' : 'payment_removed',
        description: rec.record_type === 'invoice' ? `Invoice deleted: ${(rec.invoice_name as string) || id}` : `${Number(rec.amount) < 0 ? 'Refund' : 'Payment'} removed: $${Math.abs(Number(rec.amount)).toFixed(2)}`,
        related_entity_type: 'financial_record',
        related_entity_id: id,
        metadata: { record_type: rec.record_type, deleted: true },
      }).catch(() => {});
    }
    const { error } = await supabase.from('financial_records').delete().eq('id', id);
    if (error) throw new Error(error.message);
    if (rec && rec.record_type === 'payment' && rec.parent_invoice_id) {
      await this.syncInvoice(rec.parent_invoice_id);
    }

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'DELETE',
        table_name: 'financial_records',
        record_id: id,
        reason_category: reason?.reason_category || null,
        change_reason: reason?.change_reason || null,
      });
    }
  },

  async getAnalytics(branchId?: string | null): Promise<{
    totalRevenue: number;
    totalPending: number;
    monthlyCollected: number;
    monthlyGrowth: number;
    invoiceCount: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
  }> {
    let q = supabase
      .from('financial_records')
      .select('record_type, amount, paid_so_far, remaining_amount, status, created_at')
      .eq('record_type', 'invoice');
    if (branchId) q = q.eq('branch_id', branchId);
    const { data: all } = await q;

    const invoices = (all || []) as {
      amount: number; paid_so_far: number; remaining_amount: number; status: string; created_at: string
    }[];

    const totalRevenue = invoices.reduce((s, r) => s + Number(r.paid_so_far), 0);
    const totalPending = invoices.reduce((s, r) => s + Number(r.remaining_amount), 0);

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const monthlyCollected = invoices
      .filter(r => r.created_at >= firstOfMonth)
      .reduce((s, r) => s + Number(r.paid_so_far), 0);
    const lastMonthCollected = invoices
      .filter(r => r.created_at >= firstOfLastMonth && r.created_at < firstOfMonth)
      .reduce((s, r) => s + Number(r.paid_so_far), 0);
    const monthlyGrowth = lastMonthCollected > 0
      ? Math.round(((monthlyCollected - lastMonthCollected) / lastMonthCollected) * 100)
      : 0;

    return {
      totalRevenue,
      totalPending,
      monthlyCollected,
      monthlyGrowth,
      invoiceCount: invoices.length,
      paidCount: invoices.filter(r => r.status === 'Paid').length,
      partialCount: invoices.filter(r => r.status === 'Partial').length,
      pendingCount: invoices.filter(r => r.status === 'Pending').length,
    };
  },

  async getDailyRevenue(days = 7, branchId?: string | null): Promise<{ day: string; revenue: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    let q = supabase
      .from('financial_records')
      .select('paid_so_far, created_at')
      .eq('record_type', 'invoice')
      .gte('created_at', since.toISOString());
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q;

    const rows = (data || []) as { paid_so_far: number; created_at: string }[];
    const daily: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daily[d.toLocaleDateString('en', { weekday: 'short' })] = 0;
    }
    rows.forEach(r => {
      const key = new Date(r.created_at).toLocaleDateString('en', { weekday: 'short' });
      daily[key] = (daily[key] || 0) + Number(r.paid_so_far);
    });
    return Object.entries(daily).map(([day, revenue]) => ({ day, revenue }));
  },

  async getMonthlyBreakdown(branchId?: string | null): Promise<{ name: string; collected: number; pending: number }[]> {
    let q = supabase
      .from('financial_records')
      .select('paid_so_far, remaining_amount, status, created_at')
      .eq('record_type', 'invoice');
    if (branchId) q = q.eq('branch_id', branchId);
    const { data } = await q;

    const rows = (data || []) as {
      paid_so_far: number; remaining_amount: number; status: string; created_at: string
    }[];
    const months: Record<string, { collected: number; pending: number }> = {};

    rows.forEach(r => {
      const d = new Date(r.created_at);
      const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      if (!months[key]) months[key] = { collected: 0, pending: 0 };
      months[key].collected += Number(r.paid_so_far);
      months[key].pending += Number(r.remaining_amount);
    });

    return Object.entries(months).map(([name, val]) => ({ name, ...val }));
  },

  async getInsuranceRevenue(): Promise<number> {
    const { data: payments } = await supabase
      .from('financial_records')
      .select('amount')
      .eq('record_type', 'payment')
      .eq('payment_method', 'insurance')
      .gt('amount', 0);
    const { data: insuranceRefunds } = await supabase
      .from('financial_records')
      .select('amount')
      .eq('record_type', 'payment')
      .lt('amount', 0)
      .ilike('notes', '[Insurance Refund]%');
    const pos = (payments || []).reduce((s, r) => s + Number(r.amount), 0);
    const refundTotal = (insuranceRefunds || []).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    return pos + refundTotal;
  },

  async getCashRevenue(): Promise<number> {
    const { data: payments } = await supabase
      .from('financial_records')
      .select('amount')
      .eq('record_type', 'payment')
      .in('payment_method', ['cash', 'card', 'bank_transfer'])
      .gt('amount', 0);
    const { data: cashRefunds } = await supabase
      .from('financial_records')
      .select('amount')
      .eq('record_type', 'payment')
      .lt('amount', 0)
      .ilike('notes', '[Cash Refund]%');
    const { data: insuranceRefunds } = await supabase
      .from('financial_records')
      .select('amount')
      .eq('record_type', 'payment')
      .lt('amount', 0)
      .ilike('notes', '[Insurance Refund]%');
    const pos = (payments || []).reduce((s, r) => s + Number(r.amount), 0);
    const cashRefundTotal = (cashRefunds || []).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    const insuranceRefundTotal = (insuranceRefunds || []).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    return Math.max(0, pos - cashRefundTotal - insuranceRefundTotal);
  },
};
