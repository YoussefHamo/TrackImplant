import { useState, useRef, useCallback, memo } from 'react';
import { Clock, User, Syringe, MapPin, Phone } from 'lucide-react';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { Appointment } from '../../../types';

export const STATUS_COLORS: Record<string, string> = {
  scheduled: '#4FD1FF',
  checked_in: '#FF9800',
  working: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#9E9E9E',
  no_show: '#F44336',
  postponed: '#FFC107',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  checked_in: 'Checked In',
  working: 'Working',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  postponed: 'Postponed',
};

interface AppointmentBlockProps {
  appointment: Appointment;
  onClick: (app: Appointment) => void;
  onDoubleClick?: (app: Appointment) => void;
  onContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  compact?: boolean;
  selected?: boolean;
  onDrop?: (appointmentId: string, newDate: string, doctorId?: string) => void;
  onResize?: (appointmentId: string, newDuration: number) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const PatientTooltip = memo(function PatientTooltip({ appointment }: { appointment: Appointment }) {
  const start = new Date(appointment.appointment_date);
  const end = appointment.duration_minutes ? new Date(start.getTime() + appointment.duration_minutes * 60000) : undefined;
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[var(--z-tooltip)] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}>
      <div className="rounded-xl py-2.5 px-3.5 min-w-[200px] glass-strong">
        <div className="text-sm font-bold text-[var(--app-text)] mb-1.5 font-sans">{appointment.patient_name || 'Unknown'}</div>
        {appointment.patient_phone && (
          <div className="flex items-center gap-2 mb-1.5" style={{ color: 'var(--app-text-dim)' }}>
            <Phone className="w-3 h-3" />
            <span className="text-xs font-mono">{appointment.patient_phone}</span>
          </div>
        )}
        <div className="space-y-1 text-[11px] font-sans">
          <div className="flex items-center gap-2" style={{ color: 'var(--app-text-dim)' }}>
            <Clock className="w-3 h-3" />
            <span className="font-mono">{formatTime(start)}{end ? ` - ${formatTime(end)}` : ''} ({appointment.duration_minutes || 30} min)</span>
          </div>
          {appointment.doctor_name && (
            <div className="flex items-center gap-2" style={{ color: 'var(--app-text-dim)' }}>
              <User className="w-3 h-3" />
              <span>{appointment.doctor_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[appointment.status] || '#4FD1FF' }} />
            <span style={{ color: 'var(--app-text-dim)' }}>{STATUS_LABELS[appointment.status] || appointment.status}</span>
          </div>
          {appointment.notes && (
            <div className="flex items-start gap-2" style={{ color: 'var(--app-text-dim)' }}>
              <span className="text-[10px] leading-tight line-clamp-2">{appointment.notes}</span>
            </div>
          )}
          {appointment.branch_id && (
            <div className="flex items-center gap-2" style={{ color: 'var(--app-text-dim)' }}>
              <MapPin className="w-3 h-3" />
              <span className="font-mono text-[10px]">Branch: {appointment.branch_id.slice(0, 8)}...</span>
            </div>
          )}
        </div>
      </div>
      <div className="w-3 h-3 rotate-45 mx-auto -mt-1.5 rounded-sm" style={{ background: 'rgba(13,24,40,0.95)', borderRight: '1px solid var(--app-border-light)', borderBottom: '1px solid var(--app-border-light)' }} />
    </div>
  );
});

const AppointmentBlock = memo(function AppointmentBlock({ appointment, onClick, onDoubleClick, onContextMenu, compact, selected, onDrop, onResize }: AppointmentBlockProps) {
  const color = STATUS_COLORS[appointment.status] || '#4FD1FF';
  const start = new Date(appointment.appointment_date);
  const timeStr = formatTime(start);

  const [isResizing, setIsResizing] = useState(false);
  const [dragDuration, setDragDuration] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
    clickTimer.current = setTimeout(() => { clickTimer.current = null; onClick(appointment); }, 200);
  }, [onClick, appointment]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    onDoubleClick?.(appointment);
  }, [onDoubleClick, appointment]);

  const blockRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsResizing(true);
    const startY = e.clientY;
    const startDuration = appointment.duration_minutes || 30;
    const blockEl = blockRef.current;
    function handleMouseMove(ev: MouseEvent) {
      if (!blockEl) return;
      const deltaY = ev.clientY - startY;
      const newDur = Math.max(15, Math.min(240, Math.round(startDuration + deltaY / 2)));
      setDragDuration(newDur);
      blockEl.style.minHeight = `${newDur * 2}px`;
    }
    function handleMouseUp(ev: MouseEvent) {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      const deltaY = ev.clientY - startY;
      const newDur = Math.max(15, Math.min(240, Math.round(startDuration + deltaY / 2)));
      if (newDur !== startDuration && onResize) onResize(appointment.id, newDur);
      setDragDuration(null);
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [appointment, onResize]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: appointment.id, doctor_id: appointment.doctor_id, duration: appointment.duration_minutes || 30 }));
    e.dataTransfer.effectAllowed = 'move';
  }, [appointment]);

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  if (compact) {
    return (
      <div ref={blockRef} className="relative group cursor-pointer select-none mb-0.5"
        onClick={handleClick} onDoubleClick={handleDoubleClick} onContextMenu={(e) => onContextMenu(e, appointment)}
        style={{ borderLeft: `2px solid ${color}` }}
        role="button" tabIndex={0}
        aria-label={`${appointment.patient_name || 'Unknown'} - ${STATUS_LABELS[appointment.status] || appointment.status}`}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick(appointment); }}>
        <PatientTooltip appointment={appointment} />
        <span className="block text-[9px] text-[var(--app-text)] font-medium truncate px-1 py-0.5 rounded-sm font-sans"
          style={{ background: `${color}18` }}>
          {appointment.patient_name || 'Unknown'}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={blockRef} draggable={!!onDrop}
      onClick={handleClick} onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => onContextMenu(e, appointment)}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}
      className="relative group cursor-pointer select-none mb-1 transition-all duration-150 font-sans"
      style={{
        borderLeft: `3px solid ${color}`,
        background: selected ? `${color}25` : `${color}12`,
        borderRadius: '10px',
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 4px 12px ${color}30`
          : isDragging ? '0 8px 24px rgba(0,0,0,0.3)' : isHovered ? '0 4px 16px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.15)',
        transform: isDragging ? 'scale(0.98) rotate(-1deg)' : (selected || isHovered) ? 'scale(1.02)' : 'scale(1)',
      }}
      role="button" tabIndex={0}
      aria-label={`${appointment.patient_name || 'Unknown'} - ${STATUS_LABELS[appointment.status] || appointment.status} - ${timeStr}`}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(appointment); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PatientTooltip appointment={appointment} />

      {/* Top row: Time + Patient */}
      <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5">
        <span className="text-[10px] font-mono font-semibold shrink-0" style={{ color }}>{timeStr}</span>
        {appointment.duration_minutes && appointment.duration_minutes !== 30 && (
          <span className="text-[9px] font-mono px-1 rounded" style={{ background: `${color}20`, color: 'var(--app-text-dim)' }}>
            {appointment.duration_minutes}m
          </span>
        )}
        <span className="text-[11px] font-bold text-[var(--app-text)] truncate flex-1 font-sans">{appointment.patient_name || 'Unknown'}</span>
      </div>

      {/* Phone + Procedure row */}
      {(appointment.patient_phone || appointment.procedure_name) && (
        <div className="flex items-center gap-2 px-2 pb-0.5">
          {appointment.patient_phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-2 h-2 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
              <span className="text-[9px] font-mono" style={{ color: 'var(--app-text-dim)' }}>{appointment.patient_phone}</span>
            </div>
          )}
          {appointment.procedure_name && (
            <div className="flex items-center gap-1">
              <Syringe className="w-2.5 h-2.5 shrink-0" style={{ color: 'rgba(255,107,107,0.6)' }} />
              <span className="text-[9px] truncate font-sans" style={{ color: 'var(--app-text-dim)' }}>{appointment.procedure_name}</span>
            </div>
          )}
        </div>
      )}

      {/* Doctor name */}
      {appointment.doctor_name && (
        <div className="flex items-center gap-1 px-2 pb-0.5">
          <User className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
          <span className="text-[9px] truncate font-sans" style={{ color: 'var(--app-text-dim)' }}>{appointment.doctor_name}</span>
        </div>
      )}

      {/* Status Badge */}
      <div className="flex flex-wrap gap-1 px-2 pb-1.5 mt-0.5">
        <StatusBadge status={STATUS_LABELS[appointment.status] || appointment.status} />
      </div>

      {/* Resize handle */}
      <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg"
        style={{ background: `linear-gradient(transparent, ${color}50)` }}
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize duration"
        aria-label="Resize appointment duration"
      />

      {/* Resize indicator */}
      {isResizing && dragDuration && (
        <div className="absolute -top-7 right-2 px-2 py-0.5 rounded-lg text-[10px] font-mono shadow-lg glass-strong"
          style={{ color: 'var(--color-primary)', zIndex: 10 }}>
          {dragDuration}min
        </div>
      )}
    </div>
  );
});

export default AppointmentBlock;
