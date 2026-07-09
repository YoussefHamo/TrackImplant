import { useState, useRef, useCallback } from 'react';
import type { Appointment } from '../../../types';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#4FD1FF',
  checked_in: '#FF9800',
  working: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#9E9E9E',
  no_show: '#F44336',
  postponed: '#FFC107',
};

interface AppointmentBlockProps {
  appointment: Appointment;
  onClick: (app: Appointment) => void;
  onContextMenu: (e: React.MouseEvent, app: Appointment) => void;
  compact?: boolean;
  onDrop?: (appointmentId: string, newDate: string, doctorId?: string) => void;
  onResize?: (appointmentId: string, newDuration: number) => void;
}

export default function AppointmentBlock({ appointment, onClick, onContextMenu, compact, onDrop, onResize }: AppointmentBlockProps) {
  const color = STATUS_COLORS[appointment.status] || '#4FD1FF';
  const start = new Date(appointment.appointment_date);
  const timeStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const [isResizing, setIsResizing] = useState(false);
  const [dragDuration, setDragDuration] = useState<number | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      if (newDur !== startDuration && onResize) {
        onResize(appointment.id, newDur);
      }
      setDragDuration(null);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [appointment, onResize]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: appointment.id, doctor_id: appointment.doctor_id, duration: appointment.duration_minutes || 30 }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      ref={blockRef}
      draggable={!!onDrop}
      onClick={() => onClick(appointment)}
      onContextMenu={(e) => onContextMenu(e, appointment)}
      onDragStart={handleDragStart}
      style={{ borderLeft: `3px solid ${color}`, background: `${color}15`, cursor: onDrop ? 'grab' : 'pointer', position: 'relative' }}
      className="rounded-lg px-2 py-1 text-xs hover:brightness-110 transition-all truncate select-none mb-0.5"
    >
      {compact ? (
        <span className="text-white/90 font-medium truncate">{appointment.patient_name || 'Unknown'}</span>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono" style={{ color }}>{timeStr}</span>
            <span className="text-white/80 font-medium truncate">{appointment.patient_name || 'Unknown'}</span>
          </div>
          {appointment.doctor_name && (
            <div className="text-[10px] text-white/40 truncate">{appointment.doctor_name}</div>
          )}
        </>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity rounded-b-lg"
        style={{ background: `${color}40` }}
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize duration"
      />
      {isResizing && dragDuration && (
        <div className="absolute -top-6 right-0 px-2 py-0.5 rounded-lg text-[10px] font-mono"
          style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)', color: '#4FD1FF', zIndex: 10 }}>
          {dragDuration}min
        </div>
      )}
    </div>
  );
}

export { STATUS_COLORS };
