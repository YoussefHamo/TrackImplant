import { supabase } from '../integrations/supabase/client';
import { auditLogService, getCurrentUserInfo } from './auditLogService';
import type { FinancialRecord, PaymentStatus, PaymentMethod } from '../types';

function rowToRecord(row: Record<string, unknown>): FinancialRecord {
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
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

export const financialRecordService = {
  async getByPatient(patientId: string): Promise<FinancialRecord[]> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToRecord);
  },

  async getAllInvoices(): Promise<FinancialRecord[]> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
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

  async createInvoice(data: {
    patient_id: string;
    patient_name: string;
    invoice_name: string;
    total_amount: number;
    notes?: string;
  }): Promise<FinancialRecord> {
    const record = {
      patient_id: data.patient_id,
      patient_name: data.patient_name,
      record_type: 'invoice' as const,
      invoice_name: data.invoice_name,
      total_amount: data.total_amount,
      amount: 0,
      paid_so_far: 0,
      remaining_amount: data.total_amount,
      status: 'Pending' as PaymentStatus,
      notes: data.notes || null,
    };
    const { data: inserted, error } = await supabase
      .from('financial_records')
      .insert([record])
      .select()
      .single();
    if (error) throw new Error(error.message);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'INSERT',
        table_name: 'financial_records',
        record_id: inserted.id,
        new_data: inserted as Record<string, unknown>,
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
      notes: data.notes || null,
    };
    const { data: inserted, error } = await supabase
      .from('financial_records')
      .insert([record])
      .select()
      .single();
    if (error) throw new Error(error.message);

    await this.syncInvoice(data.invoice_id);

    const actor = await getCurrentUserInfo();
    if (actor) {
      auditLogService.log({
        user_id: actor.user_id,
        user_name: actor.user_name,
        action: 'PAYMENT_CHANGE',
        table_name: 'financial_records',
        record_id: inserted.id,
        new_data: data as unknown as Record<string, unknown>,
      });
    }

    return rowToRecord(inserted);
  },

  async updateInvoice(id: string, data: {
    invoice_name?: string;
    total_amount?: number;
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase.from('financial_records').update(data).eq('id', id).eq('record_type', 'invoice');
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
      });
    }
  },

  async deleteRecord(id: string): Promise<void> {
    const { data: rec } = await supabase.from('financial_records').select('record_type, parent_invoice_id').eq('id', id).single();
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
      });
    }
  },

  async getAnalytics(): Promise<{
    totalRevenue: number;
    totalPending: number;
    monthlyCollected: number;
    monthlyGrowth: number;
    invoiceCount: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
  }> {
    const { data: all } = await supabase
      .from('financial_records')
      .select('record_type, amount, paid_so_far, remaining_amount, status, created_at')
      .eq('record_type', 'invoice');

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

  async getDailyRevenue(days = 7): Promise<{ day: string; revenue: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await supabase
      .from('financial_records')
      .select('paid_so_far, created_at')
      .eq('record_type', 'invoice')
      .gte('created_at', since.toISOString());

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

  async getMonthlyBreakdown(): Promise<{ name: string; collected: number; pending: number }[]> {
    const { data } = await supabase
      .from('financial_records')
      .select('paid_so_far, remaining_amount, status, created_at')
      .eq('record_type', 'invoice');

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
};
