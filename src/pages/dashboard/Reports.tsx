import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useBranch } from '../../context/BranchContext';
import { BarChart3, TrendingUp, Users, Activity, ShieldCheck, FileSpreadsheet, FileText, Building2, UserCheck, Calendar } from 'lucide-react';
import { branchService } from '../../services/branchService';
import { financialRecordService } from '../../services/financialRecordService';
import { getItemDisplayName } from '../../utils/inventory';
import { procedureService } from '../../services/procedureService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { appointmentService } from '../../services/appointmentService';
import { appointmentAnalyticsService } from '../../services/appointmentAnalyticsService';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ReportData {
  dailyRevenue: { day: string; revenue: number }[];
  monthlyRevenue: { name: string; collected: number; pending: number }[];
  revenueByBranch: { branch: string; revenue: number }[];
  revenueByDoctor: { doctor: string; revenue: number }[];
  outstandingBalance: number;
  totalProcedures: number;
  procedureByStatus: Record<string, number>;
  healingStats: { total: number; onTrack: number; critical: number; failure: number };
  lowStockItems: { name: string; quantity: number; minStock: number }[];
  topImplants: { name: string; count: number }[];
  inventoryValue: number;
  branchConsumption: { branch: string; count: number }[];
  cbRequests: { total: number; approved: number; rejected: number; pending: number; completed: number };
  deliveryPerformance: { branch: string; avg_days: number }[];
  newPatients: number;
  returningPatients: number;
  activePatients: number;
  branchProcedures: {
    branchId: string;
    branchName: string;
    total: number;
    byStatus: Record<string, number>;
    topImplants: { name: string; count: number }[];
  }[];
  doctorPerformance: {
    doctorId: string;
    doctorName: string;
    total: number;
    byStatus: Record<string, number>;
    commonProcedures: { name: string; count: number }[];
    completedProcedures: number;
    consultationCount: number;
    surgeryCount: number;
    healingCount: number;
    completedCount: number;
    failureCount: number;
    successRate: number;
    healingRate: number;
    implantsPlaced: number;
    abutmentsUsed: number;
    revenueGenerated: number;
    revenueCollected: number;
    pendingRevenue: number;
    monthlyTrend: { month: string; revenue: number }[];
  }[];
}

export default function Reports() {
  const { activeBranchId } = useBranch();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [doctorsList, setDoctorsList] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branchId: activeBranchId || '', doctorId: '' });
  const [report, setReport] = useState<ReportData | null>(null);
  const [activeSection, setActiveSection] = useState<string>('financial');

  useEffect(() => {
    branchService.getAll().then(b => setBranches(b.filter(x => x.is_active)));
    supabase.from('users').select('id, full_name').eq('role', 'Doctor').eq('is_active', true).then(({ data }) => {
      if (data) setDoctorsList(data.map((d: any) => ({ id: d.id, name: d.full_name })));
    });
  }, []);

  useEffect(() => {
    if (activeBranchId) setFilters(f => ({ ...f, branchId: activeBranchId }));
  }, [activeBranchId]);

  async function fetchReportData() {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    setLoading(true);
    try {
      const { branchId } = filters;
      const dailyRevenue = await financialRecordService.getDailyRevenue(7);
      const monthlyRevenue = await financialRecordService.getMonthlyBreakdown();
      const analytics = await financialRecordService.getAnalytics();
      const { totalPending } = analytics;

      let procQuery = supabase.from('procedures').select('id, status, branch_id, implant_brand, implant_size, procedure_name, procedure_date, implant_system, abutment_type').eq('is_deleted', false);
      if (branchId) procQuery = procQuery.eq('branch_id', branchId);
      if (filters.dateFrom) procQuery = procQuery.gte('procedure_date', filters.dateFrom);
      if (filters.dateTo) procQuery = procQuery.lte('procedure_date', filters.dateTo);
      const { data: procedures } = await procQuery;
      const byStatus: Record<string, number> = {};
      let totalProcedures = 0;
      (procedures || []).forEach((p: any) => {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        totalProcedures++;
      });

      const { data: followUps } = await supabase.from('follow_ups').select('healing_status, procedure_id');
      let onTrack = 0, critical = 0, failure = 0;
      (followUps || []).forEach((f: any) => {
        if (f.healing_status === 'OnTrack') onTrack++;
        else if (f.healing_status === 'Critical' || f.healing_status === 'Failure') critical++;
        if (f.healing_status === 'Failure') failure++;
      });

      const { data: invItems } = await supabase
        .from('inventory_items')
        .select('name, subcategory, category, quantity, minimum_stock');
      const lowStockItems = (invItems || [])
        .filter((i: any) => i.quantity <= (i.minimum_stock || 0) && i.minimum_stock > 0)
        .map((i: any) => ({ name: getItemDisplayName(i), quantity: i.quantity, minStock: i.minimum_stock }))
        .slice(0, 10);
      const inventoryValue = (invItems || []).reduce((sum: number, i: any) => sum + (i.quantity || 0) * 10, 0);

      const { data: transactions } = await supabase
        .from('inventory_transactions')
        .select('item_name, quantity')
        .eq('operation_type', 'issue')
        .order('created_at', { ascending: false })
        .limit(100);
      const implantCount: Record<string, number> = {};
      (transactions || []).forEach((tx: any) => {
        const name = tx.item_name || 'Unknown';
        implantCount[name] = (implantCount[name] || 0) + (tx.quantity || 0);
      });
      const topImplants = Object.entries(implantCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      const { data: cbReqs } = await supabase.from('cross_branch_requests').select('status');
      const cbStats = { total: 0, approved: 0, rejected: 0, pending: 0, completed: 0 };
      (cbReqs || []).forEach((r: any) => {
        cbStats.total++;
        if (r.status === 'approved') cbStats.approved++;
        else if (r.status === 'rejected') cbStats.rejected++;
        else if (r.status === 'pending') cbStats.pending++;
        else if (r.status === 'completed') cbStats.completed++;
      });

      const { data: allPatients } = await supabase.from('patients').select('id, created_at, full_name');
      const dateFrom = filters.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const dateTo = filters.dateTo || new Date().toISOString().split('T')[0];
      const { data: rangeAppts } = await supabase
        .from('appointments')
        .select('patient_id')
        .gte('appointment_date', dateFrom)
        .lte('appointment_date', dateTo);
      const activePatientIds = new Set((rangeAppts || []).map((a: any) => a.patient_id));
      const newPatientsSet = new Set(
        (allPatients || []).filter((p: any) => {
          const created = p.created_at?.split('T')[0];
          return created && created >= dateFrom && created <= dateTo;
        }).map((p: any) => p.id)
      );
      const newPatientsCount = newPatientsSet.size;
      const activePatientsCount = activePatientIds.size;
      const returningPatientsCount = [...activePatientIds].filter(id => !newPatientsSet.has(id)).length;

      const branchAgg: Record<string, { total: number; byStatus: Record<string, number>; topImplants: Record<string, number> }> = {};
      (procedures || []).forEach((p: any) => {
        const bid = p.branch_id || 'unknown';
        if (!branchAgg[bid]) branchAgg[bid] = { total: 0, byStatus: {}, topImplants: {} };
        branchAgg[bid].total++;
        branchAgg[bid].byStatus[p.status] = (branchAgg[bid].byStatus[p.status] || 0) + 1;
        const implantKey = [p.implant_brand, p.implant_size].filter(Boolean).join(' - ');
        if (implantKey) {
          branchAgg[bid].topImplants[implantKey] = (branchAgg[bid].topImplants[implantKey] || 0) + 1;
        }
      });
      const branchProcedures = Object.entries(branchAgg).map(([bid, d]) => ({
        branchId: bid,
        branchName: branches.find(b => b.id === bid)?.name || (bid === 'unknown' ? 'Unknown' : bid),
        total: d.total,
        byStatus: d.byStatus,
        topImplants: Object.entries(d.topImplants).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count })),
      }));

      let docQuery = supabase.from('users').select('auth_user_id, full_name').eq('role', 'Doctor').eq('is_active', true);
      if (branchId) docQuery = docQuery.eq('branch_id', branchId);
      const { data: doctors } = await docQuery;
      const { data: procDoctors } = await supabase.from('procedure_doctors').select('procedure_id, doctor_id');
      const procMap = new Map((procedures || []).map((p: any) => [p.id, p]));

      const docProcIds: Record<string, Set<string>> = {};
      (procDoctors || []).forEach((pd: any) => {
        if (!docProcIds[pd.doctor_id]) docProcIds[pd.doctor_id] = new Set();
        docProcIds[pd.doctor_id].add(pd.procedure_id);
      });

      const procFollowUps: Record<string, any[]> = {};
      (followUps || []).forEach((f: any) => {
        if (f.procedure_id) {
          if (!procFollowUps[f.procedure_id]) procFollowUps[f.procedure_id] = [];
          procFollowUps[f.procedure_id].push(f);
        }
      });

      const docAgg: Record<string, any> = {};
      (doctors || []).forEach((d: any) => {
        const uuid = d.auth_user_id;
        docAgg[uuid] = {
          doctorId: uuid, doctorName: d.full_name, total: 0, byStatus: {}, commonProcedures: {},
          completedProcedures: 0, consultationCount: 0, surgeryCount: 0,
          healingCount: 0, completedCount: 0, failureCount: 0,
          implantsPlaced: 0, abutmentsUsed: 0,
        };
      });
      (procDoctors || []).forEach((pd: any) => {
        const entry = docAgg[pd.doctor_id];
        if (!entry) return;
        const proc = procMap.get(pd.procedure_id);
        if (!proc) return;
        entry.total++;
        entry.byStatus[proc.status] = (entry.byStatus[proc.status] || 0) + 1;
        if (proc.procedure_name) {
          entry.commonProcedures[proc.procedure_name] = (entry.commonProcedures[proc.procedure_name] || 0) + 1;
        }
        if (proc.status === 'Completed') entry.completedProcedures++;
        if (proc.status === 'Consultation') entry.consultationCount++;
        if (proc.status === 'Surgery') entry.surgeryCount++;
        if (proc.status === 'Healing') entry.healingCount++;
        if (proc.status === 'Completed') entry.completedCount++;
        if (proc.implant_system) entry.implantsPlaced++;
        if (proc.abutment_type) entry.abutmentsUsed++;
        const fus = procFollowUps[pd.procedure_id] || [];
        fus.forEach((f: any) => { if (f.healing_status === 'Failure') entry.failureCount++; });
      });

      const revMap: Record<string, { totalRevenue: number; collected: number; pending: number }> = {};
      const docIds = (doctors || []).map((d: any) => d.auth_user_id);
      await Promise.all(docIds.map(async (docId: string) => {
        try { revMap[docId] = await procedureService.getRevenueByDoctor(docId, filters.dateFrom || undefined, filters.dateTo || undefined); }
        catch { revMap[docId] = { totalRevenue: 0, collected: 0, pending: 0 }; }
      }));

      const doctorPerformance = Object.values(docAgg).map((d: any) => {
        const rev = revMap[d.doctorId] || { totalRevenue: 0, collected: 0, pending: 0 };
        const pids = docProcIds[d.doctorId];
        let totalFU = 0, onTrackFU = 0;
        if (pids) {
          pids.forEach(pid => {
            const fus = procFollowUps[pid] || [];
            totalFU += fus.length;
            fus.forEach((f: any) => { if (f.healing_status === 'OnTrack') onTrackFU++; });
          });
        }
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const trendMonths: { month: string; revenue: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
          trendMonths.push({ month: months[m.getMonth()], revenue: 0 });
        }
        if (rev.totalRevenue > 0) {
          const perMonth = Math.round(rev.totalRevenue / 6);
          trendMonths.forEach(t => { t.revenue = perMonth; });
        }
        return {
          ...d,
          commonProcedures: Object.entries(d.commonProcedures as Record<string, number>).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([name, count]) => ({ name, count })),
          successRate: d.total > 0 ? parseFloat(((d.completedProcedures / d.total) * 100).toFixed(1)) : 0,
          healingRate: totalFU > 0 ? parseFloat(((onTrackFU / totalFU) * 100).toFixed(1)) : 0,
          revenueGenerated: rev.totalRevenue,
          revenueCollected: rev.collected,
          pendingRevenue: rev.pending,
          monthlyTrend: trendMonths,
        };
      });

      setReport({
        dailyRevenue, monthlyRevenue,
        revenueByBranch: [], revenueByDoctor: [],
        outstandingBalance: totalPending || 0,
        totalProcedures,
        procedureByStatus: byStatus,
        healingStats: { total: followUps?.length || 0, onTrack, critical, failure },
        lowStockItems, topImplants, inventoryValue, branchConsumption: [],
        cbRequests: cbStats, deliveryPerformance: [],
        newPatients: newPatientsCount,
        returningPatients: returningPatientsCount,
        activePatients: activePatientsCount,
        branchProcedures,
        doctorPerformance,
      });
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  useEffect(() => {
    const id = setTimeout(() => fetchReportData(), 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function exportExcel(data: Record<string, unknown>[], filename: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  function exportPDF(title: string, headers: string[], rows: string[][], filename: string) {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(title, 14, 20);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({ head: [headers], body: rows, startY: 30 });
    doc.save(`${filename}.pdf`);
  }

  const sections = [
    { id: 'financial', label: 'Financial', icon: TrendingUp },
    { id: 'clinical', label: 'Clinical', icon: Activity },
    { id: 'inventory', label: 'Inventory', icon: ShieldCheck },
    { id: 'cross_branch', label: 'Cross-Branch', icon: BarChart3 },
    { id: 'branch_procedures', label: 'Branch Procedures', icon: Building2 },
    { id: 'doctor_performance', label: 'Doctors', icon: UserCheck },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
  ];

  const BtnExportExcel = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="btn-secondary btn-xs flex items-center gap-1.5">
      <FileSpreadsheet className="w-3 h-3" /> Export Excel
    </button>
  );
  const BtnExportPDF = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="btn-ghost btn-xs flex items-center gap-1.5" style={{ color: '#ef4444' }}>
      <FileText className="w-3 h-3" /> Export PDF
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-cyber flex items-center gap-3">
        <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
        <h1 className="text-xl font-bold text-[var(--color-on-surface)]">Enterprise Reports</h1>
      </div>

      {/* Filters */}
      <div className="card-cyber">
        <div className="flex flex-wrap items-end gap-3">
          <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
          <div>
            <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>From</label>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="input-cyber" />
          </div>
          <div>
            <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>To</label>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className="input-cyber" />
          </div>
          <div>
            <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Branch</label>
            <select value={filters.branchId} onChange={e => setFilters(f => ({ ...f, branchId: e.target.value }))} className="input-cyber cursor-pointer">
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Doctor</label>
            <select value={filters.doctorId} onChange={e => setFilters(f => ({ ...f, doctorId: e.target.value }))} className="input-cyber cursor-pointer">
              <option value="">All Doctors</option>
              {doctorsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className="h-8 px-4 rounded-xl text-xs font-semibold transition-all"
            style={{ background: activeSection === s.id ? 'var(--color-primary-container)' : 'rgba(255,255,255,0.04)', color: activeSection === s.id ? 'var(--color-primary)' : 'var(--app-text-dim)' }}>
            <s.icon className="w-3 h-3 inline mr-1.5" />{s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>Loading reports...</div>
      ) : report && (
        <div className="space-y-6">
          {/* ── Financial Section ── */}
          {activeSection === 'financial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Outstanding Balance</div>
                  <div className="text-2xl font-bold mt-1 font-mono" style={{ color: 'var(--color-warning)' }}>{report.outstandingBalance.toLocaleString()} EGP</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Monthly Collected</div>
                  <div className="text-2xl font-bold mt-1 font-mono" style={{ color: 'var(--color-primary)' }}>
                    {report.monthlyRevenue.reduce((s, m) => s + m.collected, 0).toLocaleString()} EGP
                  </div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Daily Revenue (7d)</div>
                  <div className="text-2xl font-bold mt-1 font-mono" style={{ color: 'var(--color-success)' }}>
                    {report.dailyRevenue.reduce((s, d) => s + d.revenue, 0).toLocaleString()} EGP
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <BtnExportExcel onClick={() => exportExcel(report.dailyRevenue.map(d => ({ Day: d.day, Revenue: d.revenue })), 'daily_revenue')} />
                <BtnExportPDF onClick={() => { const rows = report.dailyRevenue.map(d => [d.day, d.revenue.toLocaleString()]); exportPDF('Daily Revenue Report', ['Day', 'Revenue'], rows, 'daily_revenue'); }} />
              </div>
            </div>
          )}

          {/* ── Clinical Section ── */}
          {activeSection === 'clinical' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Total Procedures</div>
                  <div className="text-2xl font-bold mt-1 text-[var(--color-on-surface)]">{report.totalProcedures}</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>On Track</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{report.healingStats.onTrack}</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Critical</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-warning)' }}>{report.healingStats.critical}</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Failure Rate</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-error)' }}>
                    {report.healingStats.total > 0 ? ((report.healingStats.failure / report.healingStats.total) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
              </div>
              <div className="card-cyber">
                <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Procedure Status Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(report.procedureByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-xs w-32" style={{ color: 'var(--app-text-dim)' }}>{status}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(count / report.totalProcedures) * 100}%`, background: 'var(--color-primary)' }} />
                      </div>
                      <span className="text-xs font-bold text-[var(--color-on-surface)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Inventory Section ── */}
          {activeSection === 'inventory' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Low Stock Items</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-error)' }}>{report.lowStockItems.length}</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Inventory Value (est.)</div>
                  <div className="text-2xl font-bold mt-1 font-mono" style={{ color: 'var(--color-success)' }}>{report.inventoryValue.toLocaleString()} EGP</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Top Implants Used</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{report.topImplants.length}</div>
                </div>
              </div>
              {report.lowStockItems.length > 0 && (
                <div className="card-cyber p-0 overflow-hidden">
                  <div className="flex text-[10px] font-semibold uppercase tracking-wider px-5 py-3 border-b" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                    <div className="flex-[2]">Item</div>
                    <div className="flex-[1]">Current</div>
                    <div className="flex-[1]">Min Stock</div>
                  </div>
                  {report.lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center px-5 py-3 text-sm" style={{ borderBottom: i < report.lowStockItems.length - 1 ? '1px solid var(--app-border)' : 'none' }}>
                      <div className="flex-[2] text-[var(--color-on-surface)]">{item.name}</div>
                      <div className="flex-[1]" style={{ color: 'var(--color-error)' }}>{item.quantity}</div>
                      <div className="flex-[1]" style={{ color: 'var(--app-text-dim)' }}>{item.minStock}</div>
                    </div>
                  ))}
                </div>
              )}
              {report.topImplants.length > 0 && (
                <div className="card-cyber">
                  <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Top Used Implants</h3>
                  <div className="space-y-2">
                    {report.topImplants.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <span className="text-sm text-[var(--color-on-surface)]">{item.name}</span>
                        <span className="font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Cross-Branch Section ── */}
          {activeSection === 'cross_branch' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total', value: report.cbRequests.total, color: 'var(--color-on-surface)' },
                  { label: 'Approved', value: report.cbRequests.approved, color: 'var(--color-success)' },
                  { label: 'Pending', value: report.cbRequests.pending, color: 'var(--color-warning)' },
                  { label: 'Rejected', value: report.cbRequests.rejected, color: 'var(--color-error)' },
                  { label: 'Completed', value: report.cbRequests.completed, color: 'var(--color-secondary)' },
                ].map(s => (
                  <div key={s.label} className="card-cyber">
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>{s.label}</div>
                    <div className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Branch Procedures Section ── */}
          {activeSection === 'branch_procedures' && (
            <div className="space-y-4">
              {report.branchProcedures.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No procedure data available.</div>
              ) : report.branchProcedures.map(bp => (
                <div key={bp.branchId} className="card-cyber">
                  <h3 className="text-base font-bold text-[var(--color-on-surface)] mb-3">{bp.branchName} <span style={{ color: 'var(--color-primary)' }} className="text-sm font-normal">({bp.total} procedures)</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-muted)' }}>Status Breakdown</h4>
                      <div className="space-y-1.5">
                        {Object.entries(bp.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-2 text-xs">
                            <span className="w-24" style={{ color: 'var(--app-text-dim)' }}>{status}</span>
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full" style={{ width: `${(count / bp.total) * 100}%`, background: 'var(--color-primary)' }} />
                            </div>
                            <span className="font-bold text-[var(--color-on-surface)]">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {bp.topImplants.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-muted)' }}>Top Implant Brands / Sizes</h4>
                        <div className="space-y-1.5">
                          {bp.topImplants.map((imp, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span style={{ color: 'var(--app-text-dim)' }}>{imp.name}</span>
                              <span className="font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{imp.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Doctor Performance Section ── */}
          {activeSection === 'doctor_performance' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <BtnExportExcel onClick={() => {
                  const flat = report.doctorPerformance.map(d => ({
                    Doctor: d.doctorName, Total: d.total, Completed: d.completedProcedures,
                    Consultations: d.consultationCount, Surgery: d.surgeryCount, Healing: d.healingCount,
                    'Success Rate': d.successRate + '%', 'Healing Rate': d.healingRate + '%',
                    'Implants Placed': d.implantsPlaced, 'Abutments Used': d.abutmentsUsed,
                    'Revenue Generated': d.revenueGenerated, 'Revenue Collected': d.revenueCollected,
                    'Pending Revenue': d.pendingRevenue, Failures: d.failureCount,
                  }));
                  exportExcel(flat, 'doctor_performance');
                }} />
                <BtnExportPDF onClick={() => {
                  const headers = ['Doctor', 'Total', 'Completed', 'Consultations', 'Surgery', 'Healing', 'Success Rate', 'Healing Rate', 'Implants', 'Abutments', 'Revenue Gen.', 'Revenue Coll.', 'Pending Rev.', 'Failures'];
                  const rows = report.doctorPerformance.map(d => [
                    d.doctorName, String(d.total), String(d.completedProcedures), String(d.consultationCount),
                    String(d.surgeryCount), String(d.healingCount), d.successRate + '%', d.healingRate + '%',
                    String(d.implantsPlaced), String(d.abutmentsUsed), String(d.revenueGenerated),
                    String(d.revenueCollected), String(d.pendingRevenue), String(d.failureCount),
                  ]);
                  exportPDF('Doctor Performance Report', headers, rows, 'doctor_performance');
                }} />
              </div>
              {report.doctorPerformance.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No doctor data available.</div>
              ) : report.doctorPerformance.filter(d => !filters.doctorId || d.doctorId === filters.doctorId).map(doc => (
                <div key={doc.doctorId} className="card-cyber">
                  <h3 className="text-base font-bold text-[var(--color-on-surface)] mb-3">{doc.doctorName} <span style={{ color: 'var(--color-primary)' }} className="text-sm font-normal">({doc.total} procedures)</span></h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Completed</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{doc.completedProcedures}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Success Rate</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{doc.successRate}%</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Healing Rate</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-secondary)' }}>{doc.healingRate}%</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Failures</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-error)' }}>{doc.failureCount}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Implants</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{doc.implantsPlaced}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Abutments</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{doc.abutmentsUsed}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--app-text-muted)' }}>Revenue</div>
                      <div className="text-lg font-bold font-mono" style={{ color: 'var(--color-success)' }}>{doc.revenueGenerated.toLocaleString()} EGP</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Consultation', value: doc.consultationCount, color: 'var(--color-primary)' },
                      { label: 'Surgery', value: doc.surgeryCount, color: 'var(--color-warning)' },
                      { label: 'Healing', value: doc.healingCount, color: 'var(--color-secondary)' },
                      { label: 'Completed', value: doc.completedCount, color: 'var(--color-success)' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--app-border)' }}>
                        <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>{s.label}</span>
                        <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-muted)' }}>Status Breakdown</h4>
                      <div className="space-y-1.5">
                        {Object.entries(doc.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-2 text-xs">
                            <span className="w-24" style={{ color: 'var(--app-text-dim)' }}>{status}</span>
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full" style={{ width: `${(count / doc.total) * 100}%`, background: 'var(--color-primary)' }} />
                            </div>
                            <span className="font-bold text-[var(--color-on-surface)]">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-muted)' }}>Revenue</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--app-text-dim)' }}>Generated</span>
                          <span className="font-bold font-mono" style={{ color: 'var(--color-success)' }}>{doc.revenueGenerated.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--app-text-dim)' }}>Collected</span>
                          <span className="font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{doc.revenueCollected.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--app-text-dim)' }}>Pending</span>
                          <span className="font-bold font-mono" style={{ color: 'var(--color-warning)' }}>{doc.pendingRevenue.toLocaleString()} EGP</span>
                        </div>
                      </div>
                      {doc.monthlyTrend.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-text-muted)' }}>Monthly Trend</h4>
                          <div className="flex items-end gap-1 h-12">
                            {doc.monthlyTrend.map(t => {
                              const maxRev = Math.max(...doc.monthlyTrend.map(x => x.revenue), 1);
                              return (
                                <div key={t.month} className="flex flex-col items-center flex-1">
                                  <div className="w-full rounded-t" style={{ height: `${(t.revenue / maxRev) * 100}%`, background: 'rgba(79,209,255,0.6)', minHeight: t.revenue > 0 ? '4px' : '0px' }} />
                                  <span className="text-[8px] mt-0.5" style={{ color: 'var(--app-text-dim)' }}>{t.month}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {doc.commonProcedures.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-muted)' }}>Common Procedures</h4>
                        <div className="space-y-1.5">
                          {doc.commonProcedures.map((cp, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span style={{ color: 'var(--app-text-dim)' }}>{cp.name}</span>
                              <span className="font-bold" style={{ color: 'var(--color-success)' }}>{cp.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Patients Section ── */}
          {activeSection === 'patients' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>New Patients</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{report.newPatients}</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Returning Patients</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{report.returningPatients}</div>
                </div>
                <div className="card-cyber">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Active Patients</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-secondary)' }}>{report.activePatients}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Schedule Section ── */}
          {activeSection === 'schedule' && (
            <ScheduleReportsSection fromDate={filters.dateFrom} toDate={filters.dateTo} branchId={filters.branchId} doctorId={filters.doctorId} />
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleReportsSection({ fromDate, toDate, branchId, doctorId }: { fromDate: string; toDate: string; branchId: string; doctorId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let appointments: any[];
        if (fromDate && toDate) {
          appointments = await appointmentService.getByDateRange(fromDate, toDate, branchId || null);
        } else {
          appointments = await appointmentService.getAll(branchId || null);
        }
        if (doctorId) {
          appointments = appointments.filter(a => a.doctor_id === doctorId);
        }

        const { data: doctors } = await supabase
          .from('users')
          .select('auth_user_id, full_name')
          .eq('role', 'Doctor')
          .eq('is_active', true);

        const analytics = await appointmentAnalyticsService.getAnalytics(
          fromDate || undefined, toDate || undefined, branchId || null, doctorId || undefined
        );

        const docCountMap = new Map<string, { name: string; count: number }>();
        for (const a of appointments) {
          if (!a.doctor_id) continue;
          const existing = docCountMap.get(a.doctor_id);
          if (existing) { existing.count++; }
          else {
            const doc = (doctors || []).find((d: any) => d.auth_user_id === a.doctor_id);
            docCountMap.set(a.doctor_id, { name: doc?.full_name || a.doctor_name || 'Unknown', count: 1 });
          }
        }
        const appointmentsByDoctor = Array.from(docCountMap.values()).sort((a, b) => b.count - a.count);

        const statusCounts: Record<string, number> = {};
        for (const a of appointments) {
          statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        }
        const appointmentsByStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

        if (!cancelled) {
          setData({ analytics, appointmentsByDoctor, appointmentsByStatus, cancelledList: appointments.filter((a: any) => a.status === 'cancelled'), noShowList: appointments.filter((a: any) => a.status === 'no_show'), total: appointments.length });
        }
      } catch (err) {
        console.error('Schedule report error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fromDate, toDate, branchId, doctorId]);

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>Loading schedule reports...</div>;
  if (!data) return <div className="py-20 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No data available</div>;

  const { analytics } = data;
  const STATUS_COLORS: Record<string, string> = {
    scheduled: '#4FD1FF', checked_in: '#FF9800', working: '#9C27B0',
    completed: '#4CAF50', postponed: '#FFC107', cancelled: '#9E9E9E', no_show: '#F44336',
  };
  const peakHoursSorted = [...analytics.peakHours].sort((a: any, b: any) => a.hour - b.hour);
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const peakDaysSorted = [...analytics.peakDays].sort((a: any, b: any) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Total Appointments</div>
          <div className="text-xl font-bold mt-1 text-[var(--color-on-surface)]">{data.total}</div>
        </div>
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Cancellation Rate</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--color-error)' }}>{analytics.cancellationRate}%</div>
        </div>
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>No Show Rate</div>
          <div className="text-xl font-bold mt-1" style={{ color: '#FF9800' }}>{analytics.noShowRate}%</div>
        </div>
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Completion Rate</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{analytics.completionRate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Avg Wait Time</div>
          <div className="text-lg font-bold mt-1 font-mono" style={{ color: 'var(--color-primary)' }}>{analytics.averageWaitingTime} min</div>
        </div>
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Avg Treatment Time</div>
          <div className="text-lg font-bold mt-1 font-mono" style={{ color: 'var(--color-secondary)' }}>{analytics.averageTreatmentTime} min</div>
        </div>
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Working Time</div>
          <div className="text-lg font-bold mt-1 font-mono" style={{ color: 'var(--color-success)' }}>{analytics.workingTime} hrs</div>
        </div>
        <div className="card-cyber">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>Idle Time</div>
          <div className="text-lg font-bold mt-1 font-mono" style={{ color: 'var(--color-warning)' }}>{analytics.idleTime} hrs</div>
        </div>
      </div>

      <div className="card-cyber">
        <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Appointments by Doctor</h3>
        {data.appointmentsByDoctor.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.appointmentsByDoctor.length * 50)}>
            <BarChart data={data.appointmentsByDoctor} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
              <XAxis type="number" stroke="var(--app-text-muted)" />
              <YAxis type="category" dataKey="name" stroke="var(--app-text-muted)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)', borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-cyber">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Appointments by Status</h3>
          {data.appointmentsByStatus.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.appointmentsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.appointmentsByStatus.map((entry: any, i: number) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || '#666'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-cyber">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Cancellation Report</h3>
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-error)' }}>{analytics.cancelledAppointments} cancelled</div>
          <div className="text-xs mb-3" style={{ color: 'var(--app-text-dim)' }}>{analytics.cancellationRate}% cancellation rate</div>
          {data.cancelledList.length === 0 ? (
            <div className="py-4 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No cancellations</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.cancelledList.slice(0, 20).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[var(--color-on-surface)]">{a.patient_name || 'Unknown'}</span>
                  <span style={{ color: 'var(--app-text-dim)' }}>{new Date(a.appointment_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-cyber">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">No Show Report</h3>
          <div className="text-2xl font-bold mb-1" style={{ color: '#FF9800' }}>{analytics.noShowAppointments} no shows</div>
          <div className="text-xs mb-3" style={{ color: 'var(--app-text-dim)' }}>{analytics.noShowRate}% no show rate</div>
          {data.noShowList.length === 0 ? (
            <div className="py-4 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No no-shows</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.noShowList.slice(0, 20).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[var(--color-on-surface)]">{a.patient_name || 'Unknown'}</span>
                  <span style={{ color: 'var(--app-text-dim)' }}>{new Date(a.appointment_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-cyber">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Doctor Utilization</h3>
          {analytics.doctorUtilization.length === 0 ? (
            <div className="py-4 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No data</div>
          ) : (
            <div className="space-y-3">
              {analytics.doctorUtilization.map((d: any) => (
                <div key={d.doctor_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--color-on-surface)]">{d.doctor_name}</span>
                    <span className="font-bold" style={{ color: d.utilization > 80 ? 'var(--color-success)' : d.utilization > 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>{d.utilization}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(d.utilization, 100)}%`, background: d.utilization > 80 ? 'var(--color-success)' : d.utilization > 50 ? 'var(--color-warning)' : 'var(--color-error)' }} />
                  </div>
                  <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                    <span>{d.total_appointments} appointments</span>
                    <span>{d.total_hours} hrs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-cyber">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Peak Hours</h3>
          {peakHoursSorted.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakHoursSorted}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
                <XAxis dataKey="hour" stroke="var(--app-text-muted)" tickFormatter={(h: number) => `${h}:00`} />
                <YAxis stroke="var(--app-text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)', borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card-cyber">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)] mb-3">Peak Days</h3>
          {peakDaysSorted.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakDaysSorted}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
                <XAxis dataKey="day" stroke="var(--app-text-muted)" />
                <YAxis stroke="var(--app-text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--app-surface-modal)', border: '1px solid var(--app-border-light)', borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
