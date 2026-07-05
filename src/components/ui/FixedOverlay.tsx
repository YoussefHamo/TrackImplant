import { type ReactNode, type CSSProperties } from 'react';
import Portal from './Portal';

interface FixedOverlayProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  style?: CSSProperties;
}

export default function FixedOverlay({ children, onClose, className = '', style }: FixedOverlayProps) {
  return (
    <Portal>
      <div
        className={`fixed inset-0 ${className}`}
        style={{ zIndex: 'var(--z-dialog-overlay)', ...style }}
        onClick={e => { if (onClose && e.target === e.currentTarget) onClose(); }}
      >
        {children}
      </div>
    </Portal>
  );
}
