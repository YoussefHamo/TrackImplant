import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2, Search, X, Calendar, CalendarDays, Printer, Filter, RotateCcw, ExternalLink, FileText, ArrowRight, Copy, Clock, Phone, MessageSquare, Mail, XCircle, Trash2, History, Download } from 'lucide-react';
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
import AppointmentDetailsPanel from './AppointmentDetailsPanel';
import EmptyState from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { Appointment, DoctorSchedule } from '../../../types';

const VIEW_OPTIONS = ['Day', 'Week', 'Month'] as const;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay(); }

function MiniCalendar({
  year, month, selectedDate, onDateSelect, onMonthChange,
}: {
  year: number; month: number; selectedDate: Date; onDateSelect: (d: Date) => void; onMonthChange: (y: number, m: number) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) week.push(null);
  for (let d = 1; d <= totalDays; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => { const d = new Date(year, month - 1); onMonthChange(d.getFullYear(), d.getMonth()); }} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-white/70">
          {new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button onClick={() => { const d = new Date(year, month + 1); onMonthChange(d.getFullYear(), d.getMonth()); }} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[8px] font-semibold uppercase py-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{d}</div>
        ))}
        {weeks.map((week, wi) => week.map((day, di) => {
          if (day === null) return <div key={`e-${wi}-${di}`} />;
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
          return (
            <button
              key={`${wi}-${di}`}
              onClick={() => onDateSelect(new Date(year, month, day))}
              className="w-full text-center text-[10px] py-1 rounded transition-all"
              style={{
                background: isSelected ? '#4FD1FF' : isToday ? 'rgba(79,209,255,0.15)' : 'transparent',
                color: isSelected ? '#050B14' : isToday ? '#4FD1FF' : 'rgba(255,255,255,0.5)',
                fontWeight: isSelected || isToday ? 700 : 400,
              }}
            >
              {day}
            </button>
          );
        }))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [detailsPanelAppointment, setDetailsPanelAppointment] = useState<Appointment | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterBranch, setFilterBranch] = useState(activeBranchId || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterProcedure, setFilterProcedure] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileDoctor, setMobileDoctor] = useState('');

  // Mini calendar
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [miniYear, setMiniYear] = useState(today.getFullYear());
  const [miniMonth, setMiniMonth] = useState(today.getMonth());

  // Sync filterBranch whenever activeBranchId changes
  useEffect(() => {
    setFilterBranch(activeBranchId || '');
  }, [activeBranchId]);

  // Responsive
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dialogs
  const [bookingOpen, setBookingOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [defaultSlotDate, setDefaultSlotDate] = useState<string | undefined>();
  const [defaultSlotDoctorId, setDefaultSlotDoctorId] = useState<string | undefined>();

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appointment: Appointment } | null>(null);

  // Zoom
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (bookingOpen || scheduleOpen || contextMenu) return;
      if (e.key === 'Escape') {
        setSelectedAppointment(null);
        setSelectedAppointmentId(null);
        return;
      }
      switch (e.key) {
        case 'n':
        case 'N':
          setEditingAppointment(null); setDefaultSlotDate(undefined); setDefaultSlotDoctorId(undefined); setBookingOpen(true);
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
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); setShowFilters(p => !p); }
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingOpen, scheduleOpen, contextMenu]);

  // Fetch data
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: () => userService.getAll() });
  const doctors = useMemo(() => (allUsers || []).filter(u => u.role === 'Doctor').map(d => ({ id: d.auth_user_id || d.id, name: d.full_name || d.username })), [allUsers]);

  // Auto-select mobile doctor after doctors are loaded
  useEffect(() => {
    if (isMobile && !mobileDoctor && doctors.length > 0) {
      setMobileDoctor(doctors[0].id);
    }
  }, [isMobile, doctors, mobileDoctor]);

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => branchService.getAll() });

  const { data: allSchedules } = useQuery({
    queryKey: ['doctor-schedules-all'],
    queryFn: () => doctorScheduleService.getAll(),
  });

  const doctorSchedulesMap: Record<string, DoctorSchedule[]> = useMemo(() => {
    const map: Record<string, DoctorSchedule[]> = {};
    (allSchedules || []).forEach(s => {
      if (!map[s.doctor_id]) map[s.doctor_id] = [];
      map[s.doctor_id].push(s);
    });
    return map;
  }, [allSchedules]);

  // Date range
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

  const dateRange = useMemo(() => getDateRange(), [getDateRange]);

  // Fetch appointments
  const { data: appointments = [], isLoading: apptsLoading } = useQuery({
    queryKey: ['appointments-schedule', dateRange, filterDoctor, filterBranch, filterStatus],
    queryFn: () => appointmentService.getByDateRange(dateRange.from, dateRange.to, filterBranch || null),
  });

  // Filter
  const filteredAppointments = useMemo(() => appointments.filter(a => {
    if (filterDoctor && a.doctor_id !== filterDoctor) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterProcedure && !a.procedure_name?.toLowerCase().includes(filterProcedure.toLowerCase())) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const patientMatch = a.patient_name?.toLowerCase().includes(q);
      const doctorMatch = a.doctor_name?.toLowerCase().includes(q);
      const notesMatch = a.notes?.toLowerCase().includes(q);
      const idMatch = a.id?.toLowerCase().includes(q);
      const procMatch = a.procedure_name?.toLowerCase().includes(q);
      return patientMatch || doctorMatch || notesMatch || idMatch || procMatch;
    }
    return true;
  }), [appointments, filterDoctor, filterStatus, filterSearch, filterProcedure]);

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (filterDoctor) {
      const doc = doctors.find(d => d.id === filterDoctor);
      if (doc) chips.push({ key: 'doctor', label: `Dr. ${doc.name}` });
    }
    if (filterBranch && filterBranch !== activeBranchId) {
      const branch = (branches || []).find((b: any) => b.id === filterBranch);
      if (branch) chips.push({ key: 'branch', label: branch.name });
    }
    if (filterStatus) {
      chips.push({ key: 'status', label: filterStatus.replace('_', ' ') });
    }
    if (filterProcedure) {
      chips.push({ key: 'procedure', label: `Proc: ${filterProcedure}` });
    }
    if (filterSearch) chips.push({ key: 'search', label: `"${filterSearch}"` });
    return chips;
  }, [filterDoctor, filterBranch, filterStatus, filterSearch, filterProcedure, doctors, branches, activeBranchId]);

  function clearFilter(key: string) {
    switch (key) {
      case 'doctor': setFilterDoctor(''); break;
      case 'branch': setFilterBranch(activeBranchId || ''); break;
      case 'status': setFilterStatus(''); break;
      case 'procedure': setFilterProcedure(''); break;
      case 'search': setFilterSearch(''); break;
    }
  }

  function resetAllFilters() {
    setFilterDoctor('');
    setFilterBranch(activeBranchId || '');
    setFilterStatus('');
    setFilterProcedure('');
    setFilterSearch('');
  }

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

  // Drag & Drop
  const handleAppointmentDrop = useCallback(async (appointmentId: string, newDate: string, doctorId?: string) => {
    const updates: Partial<Appointment> = { appointment_date: newDate };
    if (doctorId) updates.doctor_id = doctorId;
    try { await updateMut.mutateAsync({ id: appointmentId, updates }); } catch { /* */ }
  }, [updateMut]);

  // Resize
  const handleResizeAppointment = useCallback(async (appointmentId: string, newDuration: number) => {
    try { await updateMut.mutateAsync({ id: appointmentId, updates: { duration_minutes: newDuration } }); } catch { /* */ }
  }, [updateMut]);

  // Navigation
  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (view === 'Day') d.setDate(d.getDate() + dir);
    else if (view === 'Week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function goToday() {
    setCurrentDate(new Date());
    const now = new Date();
    setMiniYear(now.getFullYear());
    setMiniMonth(now.getMonth());
  }

  // Export as CSV
  function handleExportSchedule() {
    const rows = [['Date', 'Time', 'Patient', 'Doctor', 'Status', 'Duration', 'Notes']];
    filteredAppointments.forEach(a => {
      const d = new Date(a.appointment_date);
      rows.push([
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        a.patient_name || '',
        a.doctor_name || '',
        a.status,
        String(a.duration_minutes || 30),
        a.notes || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const label = view === 'Day'
      ? currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : view === 'Week'
        ? `Week_of_${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    link.download = `schedule_${label}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  // Print
  function handlePrintSchedule() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const title = view === 'Day'
      ? `Schedule - ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
      : view === 'Week'
        ? `Schedule - Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
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
  async function handleSave(data: { patient_id: string; doctor_id: string; appointment_date: string; duration_minutes: number; status: string; procedure_name?: string; notes?: string; branch_id?: string }) {
    if (editingAppointment) {
      await updateMut.mutateAsync({ id: editingAppointment.id, updates: data });
    } else {
      await createMut.mutateAsync(data);
    }
  }

  function handleSlotClick(date: string, doctorId: string) {
    setEditingAppointment(null);
    setDefaultSlotDate(date);
    setDefaultSlotDoctorId(doctorId);
    setBookingOpen(true);
  }

  function handleAppointmentClick(app: Appointment) {
    setSelectedAppointmentId(app.id);
    setDetailsPanelAppointment(app);
  }

  function handleAppointmentSelect(app: Appointment | null) {
    if (app) {
      setSelectedAppointmentId(app.id);
      setSelectedAppointment(app);
    } else {
      setSelectedAppointment(null);
      setSelectedAppointmentId(null);
    }
  }

  function handleAppointmentDoubleClick(app: Appointment) {
    setSelectedAppointmentId(app.id);
    setDetailsPanelAppointment(app);
  }

  function handleSelectionQuickAction(id: string, action: string) {
    updateStatusMut.mutate({ id, status: action });
    setSelectedAppointment(null);
    setSelectedAppointmentId(null);
  }

  function handleEditFromPanel(app: Appointment) {
    setDetailsPanelAppointment(null);
    setEditingAppointment(app);
    setDefaultSlotDate(undefined);
    setBookingOpen(true);
  }

  function handleDateClick(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00');
    if (view === 'Month') { setCurrentDate(d); setView('Day'); }
  }

  // Quick actions
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

  // Context menu sections (new grouped format)
  const contextSections = contextMenu && app ? [
    {
      items: [
        { label: 'Open Patient', icon: <ExternalLink className="w-3.5 h-3.5" />, onClick: () => window.open(`/dashboard/patients/${app.patient_id || ''}/profile`, '_blank'), disabled: !app.patient_id },
        { label: 'View History', icon: <History className="w-3.5 h-3.5" />, onClick: () => window.open(`/dashboard/patients/${app.patient_id || ''}/profile`, '_blank'), disabled: !app.patient_id },
        { label: 'Documents', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => window.open(`/dashboard/patients/${app.patient_id || ''}/profile`, '_blank'), disabled: !app.patient_id },
      ],
    },
    {
      items: [
        { label: 'Edit Appointment', icon: <Calendar className="w-3.5 h-3.5" />, onClick: () => { setContextMenu(null); setDetailsPanelAppointment(app); } },
        { label: 'Reschedule', icon: <ArrowRight className="w-3.5 h-3.5" />, onClick: () => { setContextMenu(null); setEditingAppointment(app); setDefaultSlotDate(undefined); setBookingOpen(true); } },
        { label: 'Duplicate', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => handleDuplicateAppointment(app) },
        { label: 'Print', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => handlePrintAppointment(app) },
      ],
    },
    {
      items: [
        { label: 'Check In', icon: <ChevronRight className="w-3.5 h-3.5" />, onClick: () => updateStatusMut.mutate({ id: app.id, status: 'checked_in' }) },
        { label: 'Start Working', icon: <Clock className="w-3.5 h-3.5" />, onClick: () => updateStatusMut.mutate({ id: app.id, status: 'working' }) },
        { label: 'Complete', icon: <CalendarDays className="w-3.5 h-3.5" />, onClick: () => updateStatusMut.mutate({ id: app.id, status: 'completed' }) },
        { label: 'Postpone', icon: <ChevronRight className="w-3.5 h-3.5" />, onClick: () => updateStatusMut.mutate({ id: app.id, status: 'postponed' }) },
      ],
    },
    {
      items: [
        { label: 'Call Patient', icon: <Phone className="w-3.5 h-3.5" />, onClick: () => { if (app.patient_name) window.open(`tel:${app.patient_name}`, '_blank'); }, disabled: !app.patient_name },
        { label: 'WhatsApp', icon: <MessageSquare className="w-3.5 h-3.5" />, onClick: () => { if (app.patient_name) window.open(`https://wa.me/${app.patient_name}`, '_blank'); }, disabled: !app.patient_name },
        { label: 'Send Email', icon: <Mail className="w-3.5 h-3.5" />, onClick: () => { if (app.patient_name) window.open(`mailto:${app.patient_name}`); }, disabled: !app.patient_name },
      ],
    },
    {
      items: [
        { label: 'Cancel Appointment', icon: <XCircle className="w-3.5 h-3.5" />, onClick: () => updateStatusMut.mutate({ id: app.id, status: 'cancelled' }), danger: true },
        { label: 'Delete Appointment', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => deleteMut.mutate(app.id), danger: true, adminOnly: true },
      ],
    },
  ] : [];

  // View label
  const viewLabel = view === 'Day'
    ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : view === 'Week'
      ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Button styles
  const btnCls = 'h-9 px-3 rounded-xl text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1.5';
  const inputCls = 'h-9 px-3 rounded-xl text-xs outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 focus:border-[rgba(79,209,255,0.3)] focus:ring-1 focus:ring-[rgba(79,209,255,0.2)] transition-all';

  return (
    <div className="space-y-4" ref={mainRef}>
      {/* ===== TOOLBAR ===== */}
      <div className="flex items-center gap-2 flex-wrap" role="toolbar" aria-label="Schedule toolbar">
        {/* View Selector */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} role="radiogroup" aria-label="Calendar view">
          {VIEW_OPTIONS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: view === v ? '#4FD1FF' : 'transparent', color: view === v ? '#050B14' : 'rgba(255,255,255,0.5)' }}
              role="radio"
              aria-checked={view === v}
              aria-label={`${v} view`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }} aria-label="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="px-3 h-8 rounded-xl text-xs font-medium" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }} aria-label="Go to today">
            Today
          </button>
          <button onClick={() => navigate(1)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }} aria-label="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date label */}
        <h2 className="text-sm font-bold text-white min-w-[140px]" aria-live="polite">{viewLabel}</h2>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom */}
        <div className="relative">
          <button
            onClick={() => setShowZoomMenu(p => !p)}
            className={`${btnCls} h-8`}
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
            aria-label={`Zoom: ${Math.round(zoomLevel * 100)}%`}
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          {showZoomMenu && (
            <div className="absolute top-full mt-1 right-0 z-30 rounded-xl py-1 shadow-2xl min-w-[100px]" style={{ background: 'rgba(13,24,40,0.97)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {ZOOM_PRESETS.map(z => (
                <button
                  key={z}
                  onClick={() => { setZoomLevel(z); setShowZoomMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs transition-all"
                  style={{ color: zoomLevel === z ? '#4FD1FF' : 'rgba(255,255,255,0.6)', background: zoomLevel === z ? 'rgba(79,209,255,0.08)' : 'transparent' }}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <button onClick={handleExportSchedule} className={`${btnCls} h-8`} style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }} aria-label="Export schedule as CSV">
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Print */}
        <button onClick={handlePrintSchedule} className={`${btnCls} h-8`} style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }} aria-label="Print schedule">
          <Printer className="w-3.5 h-3.5" />
        </button>

        {/* Mini Calendar Toggle */}
        <button onClick={() => setShowMiniCalendar(p => !p)} className={`${btnCls} h-8`} style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }} aria-label="Toggle mini calendar">
          <Calendar className="w-3.5 h-3.5" />
        </button>

        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} aria-hidden="true" />
          <input
            type="search"
            placeholder="Patient, doctor, notes..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className={inputCls + ' pl-8 w-36 lg:w-48'}
            aria-label="Search appointments"
          />
        </div>

        {/* Filter Toggle */}
        <button onClick={() => setShowFilters(p => !p)} className={`${btnCls} h-8`} style={{ background: showFilters ? 'rgba(79,209,255,0.1)' : 'rgba(255,255,255,0.04)', color: showFilters ? '#4FD1FF' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }} aria-label="Toggle filters">
          <Filter className="w-3.5 h-3.5" />
        </button>

        {/* Settings (Admin) */}
        {isAdmin && (
          <button onClick={() => setScheduleOpen(true)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }} aria-label="Doctor schedule settings">
            <Settings2 className="w-4 h-4" />
          </button>
        )}

        {/* New Appointment */}
        <button
          onClick={() => { setEditingAppointment(null); setDefaultSlotDate(undefined); setDefaultSlotDoctorId(undefined); setBookingOpen(true); }}
          className={`${btnCls} h-9 px-4 font-bold`}
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}
          aria-label="Create new appointment"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* ===== FILTER CHIPS ===== */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeFilters.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
              style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF', border: '1px solid rgba(79,209,255,0.2)' }}
            >
              {chip.label}
              <button onClick={() => clearFilter(chip.key)} className="hover:opacity-70" aria-label={`Remove ${chip.key} filter`}>
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button onClick={resetAllFilters} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-full" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        </div>
      )}

      {/* ===== EXPANDED FILTERS ===== */}
      {showFilters && !(user?.role === 'Doctor') && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} className={inputCls} aria-label="Filter by doctor">
            <option value="" style={{ background: '#0D1B2A', color: '#888' }}>All Doctors</option>
            {doctors.map(d => <option key={d.id} value={d.id} style={{ background: '#0D1B2A', color: 'white' }}>{d.name}</option>)}
          </select>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className={inputCls} aria-label="Filter by branch">
            <option value="" style={{ background: '#0D1B2A', color: '#888' }}>All Branches</option>
            {(branches || []).map((b: any) => <option key={b.id} value={b.id} style={{ background: '#0D1B2A', color: 'white' }}>{b.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls} aria-label="Filter by status">
            <option value="" style={{ background: '#0D1B2A', color: '#888' }}>All Status</option>
            {['scheduled', 'checked_in', 'working', 'completed', 'cancelled', 'no_show', 'postponed'].map(s => (
              <option key={s} value={s} style={{ background: '#0D1B2A', color: 'white' }}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Procedure..."
            value={filterProcedure}
            onChange={e => setFilterProcedure(e.target.value)}
            className={inputCls + ' w-32'}
            aria-label="Filter by procedure"
          />
          <button onClick={resetAllFilters} className={`${btnCls} h-8`} style={{ color: 'rgba(255,255,255,0.5)' }}>
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}

      {/* ===== MOBILE DOCTOR SELECTOR ===== */}
      {isMobile && (view === 'Day' || view === 'Week') && doctors.length > 1 && (
        <select
          value={mobileDoctor}
          onChange={e => setMobileDoctor(e.target.value)}
          className={inputCls + ' w-full'}
          aria-label="Select doctor"
        >
          {doctors.map(d => (
            <option key={d.id} value={d.id} style={{ background: '#0D1B2A', color: 'white' }}>{d.name}</option>
          ))}
        </select>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex gap-4">
        {/* Mini Calendar Sidebar */}
        {showMiniCalendar && (
          <div className="w-52 shrink-0 hidden lg:block">
            <MiniCalendar
              year={miniYear}
              month={miniMonth}
              selectedDate={currentDate}
              onDateSelect={(d) => { setCurrentDate(d); setMiniYear(d.getFullYear()); setMiniMonth(d.getMonth()); }}
              onMonthChange={(y, m) => { setMiniYear(y); setMiniMonth(m); }}
            />
          </div>
        )}

        {/* Calendar Views */}
        <div className="flex-1 min-w-0">
          {apptsLoading ? (
            <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="p-4 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-5 w-16 shrink-0" />
                    <Skeleton className="h-5 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredAppointments.length === 0 && !apptsLoading ? (
            <div className="rounded-[20px]" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <EmptyState
                title="No appointments"
                description={filterSearch || filterDoctor || filterStatus ? 'Try adjusting your filters.' : 'No appointments scheduled for this period.'}
                action={{ label: 'Create Appointment', onClick: () => { setEditingAppointment(null); setDefaultSlotDate(undefined); setDefaultSlotDoctorId(undefined); setBookingOpen(true); } }}
              />
            </div>
          ) : (
            <>
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
                  appointments={isMobile && mobileDoctor ? filteredAppointments.filter(a => a.doctor_id === mobileDoctor) : filteredAppointments}
                  doctors={isMobile ? doctors.filter(d => d.id === mobileDoctor) : doctors}
                  doctorSchedules={doctorSchedulesMap}
                  onAppointmentClick={handleAppointmentClick}
                  onAppointmentDoubleClick={handleAppointmentDoubleClick}
                  onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
                  onSlotClick={handleSlotClick}
                  onAppointmentDrop={handleAppointmentDrop}
                  onResize={handleResizeAppointment}
                  zoomLevel={zoomLevel}
                  selectedAppointmentId={selectedAppointmentId || undefined}
                  onSelectAppointment={handleAppointmentSelect}
                />
              )}
              {view === 'Day' && (
                <DayView
                  date={currentDate}
                  appointments={isMobile && mobileDoctor ? filteredAppointments.filter(a => a.doctor_id === mobileDoctor) : filteredAppointments}
                  doctors={isMobile ? doctors.filter(d => d.id === mobileDoctor) : doctors}
                  doctorSchedules={doctorSchedulesMap}
                  onAppointmentClick={handleAppointmentClick}
                  onAppointmentDoubleClick={handleAppointmentDoubleClick}
                  onAppointmentContextMenu={(e, app) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, appointment: app }); }}
                  onSlotClick={handleSlotClick}
                  onAppointmentDrop={handleAppointmentDrop}
                  onResize={handleResizeAppointment}
                  zoomLevel={zoomLevel}
                  selectedAppointmentId={selectedAppointmentId || undefined}
                  onSelectAppointment={handleAppointmentSelect}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== DIALOGS ===== */}
      <BookingDialog
        isOpen={bookingOpen}
        onClose={() => { setBookingOpen(false); setEditingAppointment(null); setSelectedAppointment(null); setSelectedAppointmentId(null); setDefaultSlotDoctorId(undefined); }}
        onSave={handleSave}
        appointment={editingAppointment}
        defaultDate={defaultSlotDate ? new Date(defaultSlotDate).toISOString().split('T')[0] : undefined}
        defaultDoctorId={defaultSlotDoctorId}
      />

      <DoctorScheduleManager isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} />

      {/* ===== CONTEXT MENU ===== */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          sections={contextSections}
          isAdmin={isAdmin}
        />
      )}

      {/* ===== QUICK ACTION BAR ===== */}
      {selectedAppointment && !detailsPanelAppointment && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3" style={{ zIndex: 100 }}>
          <div className="max-w-3xl mx-auto rounded-2xl p-3 flex items-center gap-3 flex-wrap shadow-2xl" style={{ background: 'rgba(13,24,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">{selectedAppointment.patient_name || 'Unknown'}</div>
              {selectedAppointment.status && (
                <span className="text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0" style={{
                  background: selectedAppointment.status === 'scheduled' ? 'rgba(79,209,255,0.15)' : selectedAppointment.status === 'checked_in' ? 'rgba(255,152,0,0.15)' : selectedAppointment.status === 'working' ? 'rgba(156,39,176,0.15)' : 'rgba(76,175,80,0.15)',
                  color: selectedAppointment.status === 'scheduled' ? '#4FD1FF' : selectedAppointment.status === 'checked_in' ? '#FF9800' : selectedAppointment.status === 'working' ? '#9C27B0' : '#4CAF50',
                }}>
                  {selectedAppointment.status.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedAppointment.status === 'scheduled' && (
                <button onClick={() => handleSelectionQuickAction(selectedAppointment.id, 'checked_in')} className="h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5" style={{ background: 'rgba(255,152,0,0.15)', color: '#FF9800' }}>
                  <ChevronRight className="w-3 h-3" /> Check In
                </button>
              )}
              {selectedAppointment.status === 'checked_in' && (
                <button onClick={() => handleSelectionQuickAction(selectedAppointment.id, 'working')} className="h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5" style={{ background: 'rgba(156,39,176,0.15)', color: '#9C27B0' }}>
                  <Clock className="w-3 h-3" /> Start
                </button>
              )}
              {selectedAppointment.status === 'working' && (
                <button onClick={() => handleSelectionQuickAction(selectedAppointment.id, 'completed')} className="h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5" style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}>
                  <CalendarDays className="w-3 h-3" /> Complete
                </button>
              )}
              {!['completed', 'cancelled', 'no_show'].includes(selectedAppointment.status) && (
                <button onClick={() => handleSelectionQuickAction(selectedAppointment.id, 'cancelled')} className="h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5" style={{ background: 'rgba(244,67,54,0.12)', color: '#F44336' }}>
                  <XCircle className="w-3 h-3" /> Cancel
                </button>
              )}
              <button onClick={() => { setSelectedAppointment(null); setSelectedAppointmentId(null); setEditingAppointment(selectedAppointment); setDefaultSlotDate(undefined); setBookingOpen(true); }} className="h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] flex items-center gap-1.5" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>
                <Calendar className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => { setSelectedAppointment(null); setSelectedAppointmentId(null); }} className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DETAILS PANEL ===== */}
      {detailsPanelAppointment && (
        <AppointmentDetailsPanel
          appointment={detailsPanelAppointment}
          onClose={() => { setDetailsPanelAppointment(null); setSelectedAppointmentId(null); }}
          onEdit={handleEditFromPanel}
          onStatusUpdate={(id, status) => updateStatusMut.mutate({ id, status })}
        />
      )}

      {/* ===== STATUS LEGEND ===== */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl flex-wrap" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }} aria-label="Status legend">Legend:</span>
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
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
          </div>
        ))}
        <div className="flex-1" />
        <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }} role="status" aria-live="polite">
          {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
