import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { BarChart3, TrendingUp, Users, Activity, ShieldCheck, FileSpreadsheet, FileText, Building2, UserCheck } from 'lucide-react';
import { branchService } from '../../services/branchService';
import { financialRecordService } from '../../services/financialRecordService';
import { getItemDisplayName } from '../../utils/inventory';
import { procedureService } from '../../services/procedureService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ReportData {
  // Financial
  dailyRevenue: { day: string; revenue: number }[];
  monthlyRevenue: { name: string; collected: number; pending: number }[];
  revenueByBranch: { branch: string; revenue: number }[];
  revenueByDoctor: { doctor: string; revenue: number }[];
  outstandingBalance: number;
  // Clinical
  totalProcedures: number;
  procedureByStatus: Record<string, number>;
  healingStats: { total: number; onTrack: number; critical: number; failure: number };
  // Inventory
  lowStockItems: { name: string; quantity: number; minStock: number }[];
  topImplants: { name: string; count: number }[];
  inventoryValue: number;
  branchConsumption: { branch: string; count: number }[];
  // Cross Branch
  cbRequests: { total: number; approved: number; rejected: number; pending: number; completed: number };
  deliveryPerformance: { branch: string; avg_days: number }[];
  // Patient
  newPatients: number;
  returningPatients: number;
  // Branch Procedures
  branchProcedures: {
    branchId: string;
    branchName: string;
    total: number;
    byStatus: Record<string, number>;
    topImplants: { name: string; count: number }[];
  }[];
  // Doctor Performance
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

const inputCls = 'h-9 px-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [doctorsList, setDoctorsList] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branchId: '', doctorId: '' });
  const [report, setReport] = useState<ReportData | null>(null);
  const [activeSection, setActiveSection] = useState<string>('financial');

  useEffect(() => {
    branchService.getAll().then(b => setBranches(b.filter(x => x.is_active)));
    supabase.from('users').select('id, full_name').eq('role', 'Doctor').eq('is_active', true).then(({ data }) => {
      if (data) setDoctorsList(data.map((d: any) => ({ id: d.id, name: d.full_name })));
    });
  }, []);

  async function fetchReportData() {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    setLoading(true);
    try {
      const { branchId } = filters;

      // Financial
      const dailyRevenue = await financialRecordService.getDailyRevenue(7);
      const monthlyRevenue = await financialRecordService.getMonthlyBreakdown();
      const analytics = await financialRecordService.getAnalytics();
      const { totalPending } = analytics;

      // Procedures
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

      // Follow-ups for healing stats
      const { data: followUps } = await supabase.from('follow_ups').select('healing_status, procedure_id');
      let onTrack = 0, critical = 0, failure = 0;
      (followUps || []).forEach((f: any) => {
        if (f.healing_status === 'OnTrack') onTrack++;
        else if (f.healing_status === 'Critical' || f.healing_status === 'Failure') critical++;
        if (f.healing_status === 'Failure') failure++;
      });

      // Inventory - low stock
      const { data: invItems } = await supabase
        .from('inventory_items')
        .select('name, subcategory, category, quantity, minimum_stock');
      const lowStockItems = (invItems || [])
        .filter((i: any) => i.quantity <= (i.minimum_stock || 0) && i.minimum_stock > 0)
        .map((i: any) => ({ name: getItemDisplayName(i), quantity: i.quantity, minStock: i.minimum_stock }))
        .slice(0, 10);

      // Inventory value (estimate)
      const inventoryValue = (invItems || []).reduce((sum: number, i: any) => sum + (i.quantity || 0) * 10, 0);

      // Top used implants from transactions
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

      // Cross-branch requests
      const { data: cbReqs } = await supabase.from('cross_branch_requests').select('status');
      const cbStats = { total: 0, approved: 0, rejected: 0, pending: 0, completed: 0 };
      (cbReqs || []).forEach((r: any) => {
        cbStats.total++;
        if (r.status === 'approved') cbStats.approved++;
        else if (r.status === 'rejected') cbStats.rejected++;
        else if (r.status === 'pending') cbStats.pending++;
        else if (r.status === 'completed') cbStats.completed++;
      });

      // Patient stats
      const { data: allPatients } = await supabase.from('patients').select('id, created_at');
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
      const recentPatients = (allPatients || []).filter((p: any) => new Date(p.created_at) >= monthAgo).length;
      const newPatientsCount = recentPatients;
      const returningPatientsCount = (allPatients?.length || 0) - newPatientsCount;

      // ── Branch Procedures ──
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
        topImplants: Object.entries(d.topImplants)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
      }));

      // ── Doctor Performance ──
      let docQuery = supabase.from('users').select('auth_user_id, full_name').eq('role', 'Doctor').eq('is_active', true);
      if (branchId) docQuery = docQuery.eq('branch_id', branchId);
      const { data: doctors } = await docQuery;
      const { data: procDoctors } = await supabase.from('procedure_doctors').select('procedure_id, doctor_id');
      const procMap = new Map((procedures || []).map((p: any) => [p.id, p]));

      // Build doctor→procedureIds map
      const docProcIds: Record<string, Set<string>> = {};
      (procDoctors || []).forEach((pd: any) => {
        if (!docProcIds[pd.doctor_id]) docProcIds[pd.doctor_id] = new Set();
        docProcIds[pd.doctor_id].add(pd.procedure_id);
      });

      // Build procedure→follow-ups map
      const procFollowUps: Record<string, any[]> = {};
      (followUps || []).forEach((f: any) => {
        if (f.procedure_id) {
          if (!procFollowUps[f.procedure_id]) procFollowUps[f.procedure_id] = [];
          procFollowUps[f.procedure_id].push(f);
        }
      });

      const docAgg: Record<string, {
        doctorId: string; doctorName: string; total: number;
        byStatus: Record<string, number>; commonProcedures: Record<string, number>;
        completedProcedures: number; consultationCount: number; surgeryCount: number;
        healingCount: number; completedCount: number; failureCount: number;
        implantsPlaced: number; abutmentsUsed: number;
      }> = {};
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

      // Fetch revenue per doctor
      const revMap: Record<string, { totalRevenue: number; collected: number; pending: number }> = {};
      const docIds = (doctors || []).map((d: any) => d.auth_user_id);
      await Promise.all(docIds.map(async (docId: string) => {
        try {
          revMap[docId] = await procedureService.getRevenueByDoctor(docId, filters.dateFrom || undefined, filters.dateTo || undefined);
        } catch { revMap[docId] = { totalRevenue: 0, collected: 0, pending: 0 }; }
      }));

      const doctorPerformance = Object.values(docAgg).map(d => {
        const rev = revMap[d.doctorId] || { totalRevenue: 0, collected: 0, pending: 0 };
        // Healing rate per doctor
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
          commonProcedures: Object.entries(d.commonProcedures)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count })),
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

  // ── Export Functions ──
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
    { id: 'patients', label: 'Patients', icon: Users },
  ];

  return (
    <div className="p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '20px 24px' }}>
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-[#4FD1FF]" />
          <h1 className="text-xl font-bold">Enterprise Reports</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-[22px]"
        style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <FileSpreadsheet className="w-4 h-4 text-[rgba(255,255,255,0.3)]" />
        <div>
          <label className="text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>From</label>
          <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>To</label>
          <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Branch</label>
          <select value={filters.branchId} onChange={e => setFilters(f => ({ ...f, branchId: e.target.value }))} className={inputCls + ' cursor-pointer'}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Doctor</label>
          <select value={filters.doctorId} onChange={e => setFilters(f => ({ ...f, doctorId: e.target.value }))} className={inputCls + ' cursor-pointer'}>
            <option value="">All Doctors</option>
            {doctorsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className="h-8 px-4 rounded-xl text-xs font-semibold transition-all"
            style={{ background: activeSection === s.id ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.04)', color: activeSection === s.id ? '#4FD1FF' : 'rgba(255,255,255,0.5)' }}>
            <s.icon className="w-3 h-3 inline mr-1.5" />{s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading reports...</div>
      ) : report && (
        <div className="space-y-6">
          {/* ── Financial Section ── */}
          {activeSection === 'financial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Total Revenue</div>
                  <div className="text-2xl font-bold mt-1 text-[#00E5A8]">{report.outstandingBalance.toLocaleString()} EGP</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Outstanding</div>
                  <div className="text-2xl font-bold mt-1 text-[#FFC107]">{report.outstandingBalance.toLocaleString()} EGP</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Monthly Revenue</div>
                  <div className="text-2xl font-bold mt-1 text-[#4FD1FF]">
                    {report.monthlyRevenue.reduce((s, m) => s + m.collected, 0).toLocaleString()} EGP
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportExcel(report.dailyRevenue.map(d => ({ Day: d.day, Revenue: d.revenue })), 'daily_revenue')}
                  className="h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5" style={{ background: 'rgba(69,214,255,0.1)', color: '#4FD1FF' }}>
                  <FileSpreadsheet className="w-3 h-3" /> Export Excel
                </button>
                <button onClick={() => {
                  const headers = ['Day', 'Revenue'];
                  const rows = report.dailyRevenue.map(d => [d.day, d.revenue.toLocaleString()]);
                  exportPDF('Daily Revenue Report', headers, rows, 'daily_revenue');
                }} className="h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <FileText className="w-3 h-3" /> Export PDF
                </button>
              </div>
            </div>
          )}

          {/* ── Clinical Section ── */}
          {activeSection === 'clinical' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Total Procedures</div>
                  <div className="text-2xl font-bold mt-1 text-white">{report.totalProcedures}</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>On Track</div>
                  <div className="text-2xl font-bold mt-1 text-[#00E5A8]">{report.healingStats.onTrack}</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Critical</div>
                  <div className="text-2xl font-bold mt-1 text-[#FFC107]">{report.healingStats.critical}</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Failure Rate</div>
                  <div className="text-2xl font-bold mt-1 text-[#ef4444]">
                    {report.healingStats.total > 0 ? ((report.healingStats.failure / report.healingStats.total) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Procedure Status Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(report.procedureByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-xs w-32" style={{ color: 'rgba(255,255,255,0.6)' }}>{status}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full bg-[#4FD1FF]" style={{ width: `${(count / report.totalProcedures) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold">{count}</span>
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
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Low Stock Items</div>
                  <div className="text-2xl font-bold mt-1 text-[#ef4444]">{report.lowStockItems.length}</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Inventory Value (est.)</div>
                  <div className="text-2xl font-bold mt-1 text-[#00E5A8]">{report.inventoryValue.toLocaleString()} EGP</div>
                </div>
              </div>
              {report.lowStockItems.length > 0 && (
                <div className="rounded-[22px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex text-[10px] font-semibold uppercase tracking-wider px-5 py-3 border-b border-[rgba(255,255,255,0.05)]"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <div className="flex-[2]">Item</div>
                    <div className="flex-[1]">Current</div>
                    <div className="flex-[1]">Min Stock</div>
                  </div>
                  {report.lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center px-5 py-3 text-sm">
                      <div className="flex-[2] text-white">{item.name}</div>
                      <div className="flex-[1] text-[#ef4444]">{item.quantity}</div>
                      <div className="flex-[1]" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.minStock}</div>
                    </div>
                  ))}
                </div>
              )}
              {report.topImplants.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Top Used Implants</h3>
                  <div className="rounded-[22px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {report.topImplants.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 text-sm border-b border-[rgba(255,255,255,0.04)]">
                        <span className="text-white">{item.name}</span>
                        <span className="font-bold text-[#4FD1FF]">{item.count}</span>
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
                  { label: 'Total', value: report.cbRequests.total, color: 'text-white' },
                  { label: 'Approved', value: report.cbRequests.approved, color: 'text-[#00E5A8]' },
                  { label: 'Pending', value: report.cbRequests.pending, color: 'text-[#FFC107]' },
                  { label: 'Rejected', value: report.cbRequests.rejected, color: 'text-[#ef4444]' },
                  { label: 'Completed', value: report.cbRequests.completed, color: 'text-[#7C5CFF]' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
                    <div className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Branch Procedures Section ── */}
          {activeSection === 'branch_procedures' && (
            <div className="space-y-4">
              {report.branchProcedures.length === 0 && (
                <div className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No procedure data available.</div>
              )}
              {report.branchProcedures.map(bp => (
                <div key={bp.branchId} className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 className="text-base font-bold mb-3">{bp.branchName} <span className="text-[#4FD1FF] text-sm font-normal">({bp.total} procedures)</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Status Breakdown</h4>
                      <div className="space-y-1.5">
                        {Object.entries(bp.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-2 text-xs">
                            <span className="w-24" style={{ color: 'rgba(255,255,255,0.6)' }}>{status}</span>
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full bg-[#4FD1FF]" style={{ width: `${(count / bp.total) * 100}%` }} />
                            </div>
                            <span className="font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {bp.topImplants.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Top Implant Brands / Sizes</h4>
                        <div className="space-y-1.5">
                          {bp.topImplants.map((imp, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{imp.name}</span>
                              <span className="font-bold text-[#4FD1FF]">{imp.count}</span>
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
                <button onClick={() => {
                  const flat = report.doctorPerformance.map(d => ({
                    Doctor: d.doctorName,
                    Total: d.total,
                    Completed: d.completedProcedures,
                    Consultations: d.consultationCount,
                    Surgery: d.surgeryCount,
                    Healing: d.healingCount,
                    'Success Rate': d.successRate + '%',
                    'Healing Rate': d.healingRate + '%',
                    'Implants Placed': d.implantsPlaced,
                    'Abutments Used': d.abutmentsUsed,
                    'Revenue Generated': d.revenueGenerated,
                    'Revenue Collected': d.revenueCollected,
                    'Pending Revenue': d.pendingRevenue,
                    Failures: d.failureCount,
                  }));
                  exportExcel(flat, 'doctor_performance');
                }} className="h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5" style={{ background: 'rgba(69,214,255,0.1)', color: '#4FD1FF' }}>
                  <FileSpreadsheet className="w-3 h-3" /> Export Excel
                </button>
                <button onClick={() => {
                  const headers = ['Doctor', 'Total', 'Completed', 'Consultations', 'Surgery', 'Healing', 'Success Rate', 'Healing Rate', 'Implants', 'Abutments', 'Revenue Gen.', 'Revenue Coll.', 'Pending Rev.', 'Failures'];
                  const rows = report.doctorPerformance.map(d => [
                    d.doctorName, String(d.total), String(d.completedProcedures), String(d.consultationCount),
                    String(d.surgeryCount), String(d.healingCount), d.successRate + '%', d.healingRate + '%',
                    String(d.implantsPlaced), String(d.abutmentsUsed), String(d.revenueGenerated),
                    String(d.revenueCollected), String(d.pendingRevenue), String(d.failureCount),
                  ]);
                  exportPDF('Doctor Performance Report', headers, rows, 'doctor_performance');
                }} className="h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <FileText className="w-3 h-3" /> Export PDF
                </button>
              </div>
              {report.doctorPerformance.length === 0 && (
                <div className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No doctor data available.</div>
              )}
              {report.doctorPerformance
                .filter(d => !filters.doctorId || d.doctorId === filters.doctorId)
                .map(doc => (
                <div key={doc.doctorId} className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 className="text-base font-bold mb-3">{doc.doctorName} <span className="text-[#4FD1FF] text-sm font-normal">({doc.total} procedures)</span></h3>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Completed</div>
                      <div className="text-lg font-bold text-[#00E5A8]">{doc.completedProcedures}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Success Rate</div>
                      <div className="text-lg font-bold text-[#4FD1FF]">{doc.successRate}%</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Healing Rate</div>
                      <div className="text-lg font-bold text-[#7C5CFF]">{doc.healingRate}%</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Failures</div>
                      <div className="text-lg font-bold text-[#ef4444]">{doc.failureCount}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Implants</div>
                      <div className="text-lg font-bold text-[#FFC107]">{doc.implantsPlaced}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Abutments</div>
                      <div className="text-lg font-bold text-[#FFC107]">{doc.abutmentsUsed}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Revenue</div>
                      <div className="text-lg font-bold text-[#00E5A8]">{doc.revenueGenerated.toLocaleString()} EGP</div>
                    </div>
                  </div>
                  {/* Status breakdown cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Consultation', value: doc.consultationCount, color: '#4FD1FF' },
                      { label: 'Surgery', value: doc.surgeryCount, color: '#FFC107' },
                      { label: 'Healing', value: doc.healingCount, color: '#7C5CFF' },
                      { label: 'Completed', value: doc.completedCount, color: '#00E5A8' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl flex items-center justify-between"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
                        <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Status Breakdown</h4>
                      <div className="space-y-1.5">
                        {Object.entries(doc.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-2 text-xs">
                            <span className="w-24" style={{ color: 'rgba(255,255,255,0.6)' }}>{status}</span>
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full bg-[#4FD1FF]" style={{ width: `${(count / doc.total) * 100}%` }} />
                            </div>
                            <span className="font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Revenue</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Generated</span>
                          <span className="font-bold text-[#00E5A8]">{doc.revenueGenerated.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Collected</span>
                          <span className="font-bold text-[#4FD1FF]">{doc.revenueCollected.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Pending</span>
                          <span className="font-bold text-[#FFC107]">{doc.pendingRevenue.toLocaleString()} EGP</span>
                        </div>
                      </div>
                      {/* Monthly trend */}
                      {doc.monthlyTrend.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Monthly Trend</h4>
                          <div className="flex items-end gap-1 h-12">
                            {doc.monthlyTrend.map(t => {
                              const maxRev = Math.max(...doc.monthlyTrend.map(x => x.revenue), 1);
                              return (
                                <div key={t.month} className="flex flex-col items-center flex-1">
                                  <div className="w-full rounded-t" style={{
                                    height: `${(t.revenue / maxRev) * 100}%`,
                                    background: 'rgba(79,209,255,0.6)',
                                    minHeight: t.revenue > 0 ? '4px' : '0px',
                                  }} />
                                  <span className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.month}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {doc.commonProcedures.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Common Procedures</h4>
                        <div className="space-y-1.5">
                          {doc.commonProcedures.map((cp, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{cp.name}</span>
                              <span className="font-bold text-[#00E5A8]">{cp.count}</span>
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
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>New Patients (30d)</div>
                  <div className="text-2xl font-bold mt-1 text-[#4FD1FF]">{report.newPatients}</div>
                </div>
                <div className="p-5 rounded-[22px]" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Returning Patients</div>
                  <div className="text-2xl font-bold mt-1 text-[#00E5A8]">{report.returningPatients}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
