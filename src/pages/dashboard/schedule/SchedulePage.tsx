import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appointmentService } from '../../../services/appointmentService';
import { userService } from '../../../services/userService';
import { branchService } from '../../../services/branchService';
import { doctorScheduleService } from '../../../services/doctorScheduleService';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import BookingDialog from './BookingDialog';
import DoctorScheduleManager from './DoctorScheduleManager';
import ContextMenu from './ContextMenu';
import type { Appointment, DoctorSchedule } from '../../../types';

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const today = new Date();

  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [currentDate, setCurrentDate] = useState(today);

  // Filters
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterBranch, setFilterBranch] = useState(activeBranchId || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Sync filterBranch whenever activeBranchId changes (e.g. Admin switches branch)
  useEffect(() => {
    setFilterBranch(activeBranchId || '');
  }, [activeBranchId]);

  // Dialogs
  const [bookingOpen, setBookingOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [defaultSlotDate, setDefaultSlotDate] = useState<string | undefined>();

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appointment: Appointment } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (bookingOpen || scheduleOpen || contextMenu) return;
      switch (e.key) {
        case 'n':
        case 'N':
          setEditingAppointment(null);
          setDefaultSlotDate(undefined);
          setBookingOpen(true);
          break;
        case 't':
        case 'T':
          goToday();
          break;
        case '1':
          setView('Day');
          break;
        case '2':
          setView('Week');
          break;
        case '3':
          setView('Month');
          break;
        case 'ArrowLeft':
          navigate(-1);
          break;
        case 'ArrowRight':
          navigate(1);
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingOpen, scheduleOpen, contextMenu]);

  // Fetch doctors
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });
  const doctors = (allUsers || []).filter(u => u.role === 'Doctor').map(d => ({ id: d.auth_user_id || d.id, name: d.full_name || d.username }));

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => branchService.getAll() });

  // Fetch doctor schedules
  const { data: allSchedules } = useQuery({
    queryKey: ['doctor-schedules-all'],
    queryFn: () => doctorScheduleService.getAll(),
  });

  const doctorSchedulesMap: Record<string, DoctorSchedule[]> = {};
  (allSchedules || []).forEach(s => {
    if (!doctorSchedulesMap[s.doctor_id]) doctorSchedulesMap[s.doctor_id] = [];
    doctorSchedulesMap[s.doctor_id].push(s);
  });

  // Calculate date range
  const getDateRange = useCallback(() => {
    const start = new Date(currentDate);
    if (view === 'Day') {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (view === 'Week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [currentDate, view]);

  const dateRange = getDateRange();

  // Fetch appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-schedule', dateRange, filterDoctor, filterBranch, filterStatus],
    queryFn: () => appointmentService.getByDateRange(dateRange.from, dateRange.to, filterBranch || null),
  });

  // Filter
  const filteredAppointments = appointments.filter(a => {
    if (filterDoctor && a.doctor_id !== filterDoctor) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!a.patient_name?.toLowerCase().includes(q) && !a.doctor_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof appointmentService.create>[0]) => appointmentService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments-schedule'] }); toast.success('Appointment created'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Appointment> }) => appointmentService.update(id, updates),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments-schedule'] }); toast.success('Appointment updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentService.updateStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments-schedule'] }); queryClient.invalidateQueries({ queryKey: ['appointments-today'] }); toast.success('Status updated'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => appointmentService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments-schedule'] }); toast.success('Appointment deleted'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Drag & Drop handler
  const handleAppointmentDrop = useCallback(async (appointmentId: string, newDate: string, doctorId?: string) => {
    const updates: Partial<Appointment> = { appointment_date: newDate };
    if (doctorId) updates.doctor_id = doctorId;
    try {
      await updateMut.mutateAsync({ id: appointmentId, updates });
    } catch { /* toast handled by mutation */ }
  }, [updateMut]);

  // Resize handler
  const handleResizeAppointment = useCallback(async (appointmentId: string, newDuration: number) => {
    try {
      await updateMut.mutateAsync({ id: appointmentId, updates: { duration_minutes: newDuration } });
    } catch { /* toast handled by mutation */ }
  }, [updateMut]);

  // Navigation
  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (view === 'Day') d.setDate(d.getDate() + dir);
    else if (view === 'Week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function goToday() { setCurrentDate(new Date()); }

  function handlePrintSchedule() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const title = view === 'Day' ? `Schedule - ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
      : view === 'Week' ? `Schedule - Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : `Schedule - ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const rows = filteredAppointments.map(a => {
      const d = new Date(a.appointment_date);
      return `<tr><td>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td><td>${a.patient_name || 'N/A'}</td><td>${a.doctor_name || 'N/A'}</td><td>${a.status}</td></tr>`;
    }).join('');
    printWindow.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:sans-serif;padding:40px}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd}th{background:#f5f5f5}h1{font-size:20px;margin-bottom:20px}</style></head>
      <body><h1>${title}</h1><table><thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  // Booking
  async function handleSave(data: { patient_id: string; doctor_id: string; appointment_date: string; duration_minutes: number; status: string; notes?: string; branch_id?: string }) {
    if (editingAppointment) {
      await updateMut.mutateAsync({ id: editingAppointment.id, updates: data });
    } else {
      await createMut.mutateAsync(data);
    }
  }

  function handleSlotClick(date: string, _doctorId: string) {
    setEditingAppointment(null);
    setDefaultSlotDate(date);
    setBookingOpen(true);
  }

  function handleAppointmentClick(app: Appointment) {
    setEditingAppointment(app);
    setDefaultSlotDate(undefined);
    setBookingOpen(true);
  }

  function handleDateClick(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00');
    if (view === 'Month') { setCurrentDate(d); setView('Day'); }
  }

  // Quick action handlers
  function handleDuplicateAppointment(app: Appointment) {
    createMut.mutate({
      patient_id: app.patient_id || '',
      doctor_id: app.doctor_id || '',
      appointment_date: new Date(new Date(app.appointment_date).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      duration_minutes: app.duration_minutes || 30,
      status: 'scheduled',
      notes: app.notes ? `Duplicate: ${app.notes}` : 'Duplicate appointment',
    });
  }

  function handlePrintAppointment(app: Appointment) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const d = new Date(app.appointment_date);
    printWindow.document.write(`
      <html><head><title>Appointment - ${app.patient_name || 'Unknown'}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:auto}
      h1{font-size:24px;margin-bottom:4px}
      .info{color:#666;margin-bottom:20px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
      .label{font-weight:600}</style></head>
      <body>
      <h1>Appointment</h1>
      <div class="info">${d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div class="row"><span class="label">Patient</span><span>${app.patient_name || 'N/A'}</span></div>
      <div class="row"><span class="label">Doctor</span><span>${app.doctor_name || 'N/A'}</span></div>
      <div class="row"><span class="label">Time</span><span>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="row"><span class="label">Duration</span><span>${app.duration_minutes || 30} min</span></div>
      <div class="row"><span class="label">Status</span><span>${app.status}</span></div>
      ${app.notes ? `<div class="row"><span class="label">Notes</span><span>${app.notes}</span></div>` : ''}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  const isAdmin = user?.role === 'Admin';
  const app = contextMenu?.appointment;
  const contextItems = contextMenu && app ? [
    { label: 'Open Patient', icon: '👤', onClick: () => window.open(`/dashboard/patients/${app.patient_id || ''}/profile`, '_blank') },
    { label: 'Open Procedure', icon: '🔬', onClick: () => window.open(`/dashboard/cases`, '_blank'), disabled: !app.patient_id },
    { label: 'Open Invoice', icon: '💰', onClick: () => window.open(`/dashboard/payments`, '_blank'), disabled: !app.patient_id },
    { separator: true, label: '', icon: undefined, onClick: () => {} } as any,
    { label: 'Call Patient', icon: '📞', onClick: () => { if (app.patient_name) window.open(`tel:${app.patient_name}`, '_blank'); }, disabled: !app.patient_name },
    { label: 'WhatsApp Patient', icon: '💬', onClick: () => { if (app.patient_name) window.open(`https://wa.me/${app.patient_name}`, '_blank'); }, disabled: !app.patient_name },
    { separator: true, label: '', icon: undefined, onClick: () => {} } as any,
    { label: 'Check In', icon: '✅', onClick: () => updateStatusMut.mutate({ id: app.id, status: 'checked_in' }) },
    { label: 'Start Working', icon: '🔧', onClick: () => updateStatusMut.mutate({ id: app.id, status: 'working' }) },
    { label: 'Complete', icon: '✔️', onClick: () => updateStatusMut.mutate({ id: app.id, status: 'completed' }) },
    { label: 'Postpone', icon: '⏰', onClick: () => updateStatusMut.mutate({ id: app.id, status: 'postponed' }) },
    { label: 'Cancel', icon: '✖️', onClick: () => updateStatusMut.mutate({ id: app.id, status: 'cancelled' }), danger: true },
    { separator: true, label: '', icon: undefined, onClick: () => {} } as any,
    { label: 'Reschedule', icon: '📅', onClick: () => handleAppointmentClick(app) },
    { label: 'Duplicate Appointment', icon: '📋', onClick: () => handleDuplicateAppointment(app) },
    { label: 'Print Appointment', icon: '🖨️', onClick: () => handlePrintAppointment(app) },
    { label: 'Assign Doctor', icon: '👨‍⚕️', onClick: () => { setEditingAppointment(app); setBookingOpen(true); } },
    { label: 'Create Procedure', icon: '🔬', onClick: () => { if (app.patient_id) window.open(`/dashboard/cases?patientId=${app.patient_id}`, '_blank'); }, disabled: !app.patient_id },
    { separator: true, label: '', icon: undefined, onClick: () => {} } as any,
    { label: 'Delete', icon: '🗑️', onClick: () => deleteMut.mutate(app.id), danger: true, adminOnly: true },
  ] : [];

  const viewLabel = view === 'Day' ? currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : view === 'Week' ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const inputCls = 'h-9 px-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['Day', 'Week', 'Month'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: view === v ? '#4FD1FF' : 'transparent', color: view === v ? '#050B14' : 'rgba(255,255,255,0.5)' }}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="px-3 h-8 rounded-xl text-xs font-medium" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>Today</button>
          <button onClick={() => navigate(1)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-2">
          <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>−</button>
          <span className="text-xs font-mono w-8 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.25))} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>+</button>
        </div>

        <button onClick={handlePrintSchedule} className="h-9 px-3 rounded-xl text-xs font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          🖨️ Print
        </button>

        <h2 className="text-base font-bold text-white flex-1">{viewLabel}</h2>

        <div className="flex items-center gap-2">
          {!(user?.role === 'Doctor') && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input type="text" placeholder="Search patient/doctor..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className={inputCls + ' pl-8 w-40'} />
              </div>
              <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} className={inputCls}>
                <option value="" style={{ background: '#0D1B2A', color: '#888' }}>All Doctors</option>
                {doctors.map(d => <option key={d.id} value={d.id} style={{ background: '#0D1B2A', color: 'white' }}>{d.name}</option>)}
              </select>
              <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className={inputCls}>
                <option value="" style={{ background: '#0D1B2A', color: '#888' }}>All Branches</option>
                {(branches || []).map((b: any) => <option key={b.id} value={b.id} style={{ background: '#0D1B2A', color: 'white' }}>{b.name}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
                <option value="" style={{ background: '#0D1B2A', color: '#888' }}>All Status</option>
                <option value="scheduled" style={{ background: '#0D1B2A', color: 'white' }}>Scheduled</option>
                <option value="checked_in" style={{ background: '#0D1B2A', color: 'white' }}>Checked In</option>
                <option value="working" style={{ background: '#0D1B2A', color: 'white' }}>Working</option>
                <option value="completed" style={{ background: '#0D1B2A', color: 'white' }}>Completed</option>
                <option value="cancelled" style={{ background: '#0D1B2A', color: 'white' }}>Cancelled</option>
                <option value="no_show" style={{ background: '#0D1B2A', color: 'white' }}>No Show</option>
                <option value="postponed" style={{ background: '#0D1B2A', color: 'white' }}>Postponed</option>
              </select>
            </>
          )}
          {user?.role === 'Admin' && (
            <button onClick={() => setScheduleOpen(true)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
              <Settings2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => { setEditingAppointment(null); setDefaultSlotDate(undefined); setBookingOpen(true); }}
            className="h-9 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
            <Plus className="w-3.5 h-3.5 inline mr-1" />New
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'Month' && (
        <MonthView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          appointments={filteredAppointments}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
          onDateClick={handleDateClick}
        />
      )}
      {view === 'Week' && (
        <WeekView
          startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - currentDate.getDay())}
          appointments={filteredAppointments}
          doctors={doctors}
          doctorSchedules={doctorSchedulesMap}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
          onSlotClick={handleSlotClick}
          onAppointmentDrop={handleAppointmentDrop}
          onResize={handleResizeAppointment}
          zoomLevel={zoomLevel}
        />
      )}
      {view === 'Day' && (
        <DayView
          date={currentDate}
          appointments={filteredAppointments}
          doctors={doctors}
          doctorSchedules={doctorSchedulesMap}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
          onSlotClick={handleSlotClick}
          onAppointmentDrop={handleAppointmentDrop}
          onResize={handleResizeAppointment}
          zoomLevel={zoomLevel}
        />
      )}

      {/* Dialogs */}
      <BookingDialog
        isOpen={bookingOpen}
        onClose={() => { setBookingOpen(false); setEditingAppointment(null); }}
        onSave={handleSave}
        appointment={editingAppointment}
        defaultDate={defaultSlotDate ? new Date(defaultSlotDate).toISOString().split('T')[0] : undefined}
      />

      <DoctorScheduleManager isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextItems}
          isAdmin={isAdmin}
        />
      )}

      {/* Status Legend */}
      <div className="flex items-center gap-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Legend:</span>
        {[
          { label: 'Scheduled', color: '#4FD1FF' },
          { label: 'Checked In', color: '#FF9800' },
          { label: 'Working', color: '#9C27B0' },
          { label: 'Completed', color: '#4CAF50' },
          { label: 'Postponed', color: '#FFC107' },
          { label: 'Cancelled', color: '#9E9E9E' },
          { label: 'No Show', color: '#F44336' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
