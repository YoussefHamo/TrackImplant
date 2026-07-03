import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { BarChart3, TrendingUp, Users, Activity, ShieldCheck, FileSpreadsheet, FileText } from 'lucide-react';
import { branchService } from '../../services/branchService';
import { financialRecordService } from '../../services/financialRecordService';
import { getItemDisplayName } from '../../utils/inventory';
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
}

const inputCls = 'h-9 px-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branchId: '', doctorId: '' });
  const [report, setReport] = useState<ReportData | null>(null);
  const [activeSection, setActiveSection] = useState<string>('financial');

  useEffect(() => {
    branchService.getAll().then(b => setBranches(b.filter(x => x.is_active)));
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
      let procQuery = supabase.from('procedures').select('status');
      if (branchId) {
        const { data: branchUsers } = await supabase.from('users').select('auth_user_id').eq('branch_id', branchId);
        const branchUserIds = (branchUsers || []).map(u => (u as any).auth_user_id);
        procQuery = procQuery.in('created_by', branchUserIds);
      }
      const { data: procedures } = await procQuery;
      const byStatus: Record<string, number> = {};
      let totalProcedures = 0;
      (procedures || []).forEach((p: any) => {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        totalProcedures++;
      });

      // Follow-ups for healing stats
      const { data: followUps } = await supabase.from('follow_ups').select('healing_status');
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
