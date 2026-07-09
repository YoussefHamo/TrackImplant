import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: { label: string; icon?: string; onClick: () => void; danger?: boolean; adminOnly?: boolean; }[];
  isAdmin: boolean;
}

export default function ContextMenu({ x, y, onClose, items, isAdmin }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] rounded-xl py-1 shadow-2xl min-w-[180px]"
      style={{ left: x, top: y, background: 'rgba(13,24,40,0.97)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
    >
      {items.map((item, i) => {
        if (item.adminOnly && !isAdmin) return null;
        return (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-all"
            style={{ color: item.danger ? '#ef4444' : 'rgba(255,255,255,0.75)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {item.icon && <span className="w-4 text-center">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
