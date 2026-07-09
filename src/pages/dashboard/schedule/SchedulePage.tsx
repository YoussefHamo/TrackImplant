import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appointmentService } from '../../../services/appointmentService';
import { userService } from '../../../services/userService';
import { branchService } from '../../../services/branchService';
import { useAuth } from '../../../context/AuthContext';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import BookingDialog from './BookingDialog';
import DoctorScheduleManager from './DoctorScheduleManager';
import ContextMenu from './ContextMenu';
import type { Appointment } from '../../../types';

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const today = new Date();

  // View state
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [currentDate, setCurrentDate] = useState(today);

  // Filters
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Dialogs
  const [bookingOpen, setBookingOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [defaultSlotDate, setDefaultSlotDate] = useState<string | undefined>();

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appointment: Appointment } | null>(null);

  // Fetch doctors
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });
  const doctors = (allUsers || []).filter(u => u.role === 'Doctor').map(d => ({ id: d.auth_user_id || d.id, name: d.full_name || d.username }));

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => branchService.getAll() });

  // Calculate date range based on view
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
    // Month
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

  // Navigation
  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (view === 'Day') d.setDate(d.getDate() + dir);
    else if (view === 'Week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function goToday() { setCurrentDate(new Date()); }

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

  // Context menu actions
  const isAdmin = user?.role === 'Admin';
  const contextItems = contextMenu ? [
    { label: 'Open Patient', icon: '👤', onClick: () => window.open(`/dashboard/patients/${contextMenu.appointment.patient_id}/profile`, '_blank') },
    { label: 'Edit Appointment', icon: '✏️', onClick: () => { setEditingAppointment(contextMenu.appointment); setBookingOpen(true); } },
    { label: 'Check In', icon: '✅', onClick: () => updateStatusMut.mutate({ id: contextMenu.appointment.id, status: 'checked_in' }) },
    { label: 'Start Working', icon: '🔧', onClick: () => updateStatusMut.mutate({ id: contextMenu.appointment.id, status: 'working' }) },
    { label: 'Complete', icon: '✔️', onClick: () => updateStatusMut.mutate({ id: contextMenu.appointment.id, status: 'completed' }) },
    { label: 'Postpone', icon: '⏰', onClick: () => updateStatusMut.mutate({ id: contextMenu.appointment.id, status: 'postponed' }) },
    { label: 'Cancel', icon: '✖️', onClick: () => updateStatusMut.mutate({ id: contextMenu.appointment.id, status: 'cancelled' }), danger: true },
    { label: 'Reschedule', icon: '📅', onClick: () => handleAppointmentClick(contextMenu.appointment) },
    { label: 'Delete', icon: '🗑️', onClick: () => deleteMut.mutate(contextMenu.appointment.id), danger: true, adminOnly: true },
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

        <h2 className="text-base font-bold text-white flex-1">{viewLabel}</h2>

        <div className="flex items-center gap-2">
          {!(user?.role === 'Doctor') && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input type="text" placeholder="Search..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className={inputCls + ' pl-8 w-36'} />
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
          onAppointmentClick={handleAppointmentClick}
          onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
          onSlotClick={handleSlotClick}
        />
      )}
      {view === 'Day' && (
        <DayView
          date={currentDate}
          appointments={filteredAppointments}
          doctors={doctors}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
          onSlotClick={handleSlotClick}
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
