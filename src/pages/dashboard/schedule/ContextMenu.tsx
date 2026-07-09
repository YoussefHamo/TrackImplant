import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  adminOnly?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuSection {
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  sections: ContextMenuSection[];
  isAdmin: boolean;
}

export default function ContextMenu({ x, y, onClose, sections, isAdmin }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - (sections.flatMap(s => s.items).filter(i => !i.adminOnly || isAdmin).length * 36 + sections.length * 4 + 16));

  return (
    <div
      ref={ref}
      className="fixed z-[9999] rounded-xl py-1 shadow-2xl min-w-[210px] max-h-[90vh] overflow-y-auto"
      style={{
        left: adjustedX,
        top: adjustedY,
        background: 'rgba(10,20,35,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
      }}
      role="menu"
      aria-label="Appointment context menu"
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && (
            <div className="mx-3 my-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} role="separator" />
          )}
          {section.items.map((item, i) => {
            if (item.adminOnly && !isAdmin) return null;
            return (
              <button
                key={i}
                onClick={() => { item.onClick(); onClose(); }}
                disabled={item.disabled}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-all disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset"
                style={{
                  color: item.danger ? '#ef4444' : 'rgba(255,255,255,0.8)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                role="menuitem"
                tabIndex={0}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0" style={{ color: item.danger ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.disabled && <span className="text-[9px] opacity-50">Unavailable</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
