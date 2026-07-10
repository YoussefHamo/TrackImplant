import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

function to12(h: number) { return h === 0 ? 12 : h > 12 ? h - 12 : h; }
function ampm(h: number) { return h < 12 ? 'AM' : 'PM'; }

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ['00', '15', '30', '45'];

export default function TimePicker({ value, onChange, className = '' }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'h' | 'm'>('h');
  const ref = useRef<HTMLDivElement>(null);

  const parts = (value || '00:00').split(':');
  const h24 = parseInt(parts[0]) || 0;
  const m = parts[1] || '00';
  const h12 = to12(h24);
  const mer = ampm(h24);

  const display = `${h12}:${m} ${mer}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) { document.addEventListener('mousedown', handleClick); }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function selectHour(h: number) {
    let h24new = h;
    if (h === 12) {
      h24new = mer === 'AM' ? 0 : 12;
    } else {
      h24new = mer === 'AM' ? h : h + 12;
    }
    onChange(`${String(h24new).padStart(2, '0')}:${m}`);
    setStep('m');
  }

  function selectMinute(min: string) {
    onChange(`${String(h24).padStart(2, '0')}:${min}`);
    setOpen(false);
    setStep('h');
  }

  function toggleMer() {
    const newMer = mer === 'AM' ? 'PM' : 'AM';
    let h24new = h24;
    if (h24 === 0) h24new = 12;
    else if (h24 === 12) h24new = 0;
    else h24new = newMer === 'AM' ? h24 - 12 : h24 + 12;
    onChange(`${String(h24new).padStart(2, '0')}:${m}`);
  }

  const btnBase = 'px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.95] cursor-pointer';

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(p => !p)} className="flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-mono font-bold transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}>
        <Clock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
        {display}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full mt-1.5 z-50 rounded-2xl p-3 shadow-2xl min-w-[220px]" style={{ background: 'rgba(13,24,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
          {/* Step indicator + AM/PM */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              <button type="button" onClick={() => setStep('h')} className="text-xs font-bold px-2 py-1 rounded-lg transition-all" style={{ background: step === 'h' ? 'rgba(79,209,255,0.12)' : 'transparent', color: step === 'h' ? '#4FD1FF' : 'rgba(255,255,255,0.4)' }}>Hour</button>
              <button type="button" onClick={() => setStep('m')} className="text-xs font-bold px-2 py-1 rounded-lg transition-all" style={{ background: step === 'm' ? 'rgba(79,209,255,0.12)' : 'transparent', color: step === 'm' ? '#4FD1FF' : 'rgba(255,255,255,0.4)' }}>Min</button>
            </div>
            <button type="button" onClick={toggleMer} className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all" style={{ background: 'rgba(79,209,255,0.1)', color: '#4FD1FF' }}>{mer}</button>
          </div>

          {/* Hours Grid */}
          {step === 'h' && (
            <div className="grid grid-cols-4 gap-1.5">
              {HOURS_12.map(h => (
                <button key={h} type="button" onClick={() => selectHour(h)} className={`${btnBase} text-center`} style={{
                  background: h12 === h ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.03)',
                  color: h12 === h ? '#4FD1FF' : 'white',
                  border: h12 === h ? '1px solid rgba(79,209,255,0.2)' : '1px solid transparent',
                }}>
                  {h}
                </button>
              ))}
            </div>
          )}

          {/* Minutes */}
          {step === 'm' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-1.5">
                {MINUTES.map(min => (
                  <button key={min} type="button" onClick={() => selectMinute(min)} className={`${btnBase} text-center`} style={{
                    background: m === min ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.03)',
                    color: m === min ? '#4FD1FF' : 'white',
                    border: m === min ? '1px solid rgba(79,209,255,0.2)' : '1px solid transparent',
                  }}>
                    {min}
                  </button>
                ))}
              </div>
              {/* Compact minute list for 5-min intervals */}
              <div className="flex flex-wrap gap-1 justify-center mt-1">
                {Array.from({ length: 12 }, (_, i) => i * 5).map(min => (
                  <button key={min} type="button" onClick={() => selectMinute(String(min).padStart(2, '0'))} className="text-[10px] px-1.5 py-1 rounded-lg transition-all" style={{
                    background: m === String(min).padStart(2, '0') ? 'rgba(79,209,255,0.15)' : 'rgba(255,255,255,0.02)',
                    color: m === String(min).padStart(2, '0') ? '#4FD1FF' : 'rgba(255,255,255,0.5)',
                  }}>
                    {String(min).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
