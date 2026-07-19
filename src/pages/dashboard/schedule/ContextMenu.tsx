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
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleEsc); };
  }, [onClose]);

  const itemCount = sections.flatMap(s => s.items).filter(i => !i.adminOnly || isAdmin).length;
  const adjustedX = Math.min(x, window.innerWidth - 230);
  const adjustedY = Math.min(y, window.innerHeight - (itemCount * 38 + sections.length * 4 + 16));

  return (
    <div
      ref={ref}
      className="fixed z-[var(--z-max)] rounded-xl py-1 shadow-2xl min-w-[210px] max-h-[90vh] overflow-y-auto glass-strong font-sans"
      style={{ left: adjustedX, top: adjustedY }}
      role="menu"
      aria-label="Appointment context menu"
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && (
            <div className="mx-3 my-1 h-px" style={{ background: 'var(--app-border)' }} role="separator" />
          )}
          {section.items.map((item, i) => {
            if (item.adminOnly && !isAdmin) return null;
            return (
              <button
                key={i}
                onClick={() => { item.onClick(); onClose(); }}
                disabled={item.disabled}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset hover:bg-[var(--app-hover)] cursor-pointer font-sans"
                style={{ color: item.danger ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}
                role="menuitem"
                tabIndex={0}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0"
                    style={{ color: item.danger ? 'var(--color-error)' : 'var(--app-text-muted)' }}>
                    {item.icon}
                  </span>
                )}
                <span className="flex-1 text-sm">{item.label}</span>
                {item.disabled && <span className="text-[9px] opacity-50">Unavailable</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
