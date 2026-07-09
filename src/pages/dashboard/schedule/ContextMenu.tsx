import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  adminOnly?: boolean;
  separator?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
  isAdmin: boolean;
}

export default function ContextMenu({ x, y, onClose, items, isAdmin }: ContextMenuProps) {
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

  return (
    <div
      ref={ref}
      className="fixed z-[9999] rounded-xl py-1.5 shadow-2xl min-w-[200px] max-h-[90vh] overflow-y-auto"
      style={{ left: x, top: y, background: 'rgba(13,24,40,0.97)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
    >
      {items.map((item, i) => {
        if (item.adminOnly && !isAdmin) return null;
        if (item.separator) {
          return <div key={i} className="mx-3 my-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />;
        }
        return (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            disabled={item.disabled}
            className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: item.danger ? '#ef4444' : 'rgba(255,255,255,0.75)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {item.icon && <span className="w-4 text-center text-base">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
