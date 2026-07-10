import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export default function TimePicker({ value, onChange, className = '' }: TimePickerProps) {
  const [hours, minutes] = (value || '00:00').split(':').map(Number);
  const [focusPart, setFocusPart] = useState<'h' | 'm' | null>(null);
  const hrsRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const setHour = useCallback((h: number) => {
    const clamped = clamp(h, 0, 23);
    onChange(`${String(clamped).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  }, [minutes, onChange]);

  const setMinute = useCallback((m: number) => {
    const clamped = clamp(m, 0, 59);
    onChange(`${String(hours).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`);
  }, [hours, onChange]);

  useEffect(() => {
    if (focusPart === 'h') hrsRef.current?.focus();
    if (focusPart === 'm') minRef.current?.focus();
  }, [focusPart]);

  function startHold(cb: () => void) {
    cb();
    holdTimer.current = setInterval(cb, 150);
  }
  function stopHold() {
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; }
  }

  function handleHrsKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') { e.preventDefault(); setHour(hours + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHour(hours - 1); }
    if (e.key === 'ArrowRight') { setFocusPart('m'); }
  }
  function handleMinKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') { e.preventDefault(); setMinute(minutes + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setMinute(minutes - 1); }
    if (e.key === 'ArrowLeft') { setFocusPart('h'); }
  }

  const btnCls = 'flex items-center justify-center h-5 rounded-lg transition-all cursor-pointer select-none hover:bg-[rgba(79,209,255,0.12)] active:scale-[0.92]';
  const activePart = 'ring-1 ring-[rgba(79,209,255,0.3)] bg-[rgba(79,209,255,0.06)]';

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {/* Hours */}
      <div className="flex flex-col items-center" ref={hrsRef} tabIndex={0} onFocus={() => setFocusPart('h')} onBlur={() => setFocusPart(null)} onKeyDown={handleHrsKey} style={{ outline: 'none' }}>
        <button type="button" className={btnCls} style={{ color: 'rgba(255,255,255,0.3)' }} onMouseDown={() => startHold(() => setHour(hours + 1))} onMouseUp={stopHold} onMouseLeave={stopHold} aria-label="Increase hour">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <div className={`w-12 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono transition-all ${focusPart === 'h' ? activePart : ''}`} style={{ color: focusPart === 'h' ? '#4FD1FF' : 'white', background: focusPart === 'h' ? 'rgba(79,209,255,0.04)' : 'rgba(255,255,255,0.03)' }}>
          {String(hours).padStart(2, '0')}
        </div>
        <button type="button" className={btnCls} style={{ color: 'rgba(255,255,255,0.3)' }} onMouseDown={() => startHold(() => setHour(hours - 1))} onMouseUp={stopHold} onMouseLeave={stopHold} aria-label="Decrease hour">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Separator */}
      <span className="text-sm font-bold font-mono pb-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center" ref={minRef} tabIndex={0} onFocus={() => setFocusPart('m')} onBlur={() => setFocusPart(null)} onKeyDown={handleMinKey} style={{ outline: 'none' }}>
        <button type="button" className={btnCls} style={{ color: 'rgba(255,255,255,0.3)' }} onMouseDown={() => startHold(() => setMinute(minutes + 1))} onMouseUp={stopHold} onMouseLeave={stopHold} aria-label="Increase minute">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <div className={`w-12 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono transition-all ${focusPart === 'm' ? activePart : ''}`} style={{ color: focusPart === 'm' ? '#4FD1FF' : 'white', background: focusPart === 'm' ? 'rgba(79,209,255,0.04)' : 'rgba(255,255,255,0.03)' }}>
          {String(minutes).padStart(2, '0')}
        </div>
        <button type="button" className={btnCls} style={{ color: 'rgba(255,255,255,0.3)' }} onMouseDown={() => startHold(() => setMinute(minutes + 1))} onMouseUp={stopHold} onMouseLeave={stopHold} aria-label="Decrease minute">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
