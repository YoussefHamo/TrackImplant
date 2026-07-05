import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

export default function Portal({ children }: PortalProps) {
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) {
    console.warn('[Portal] #portal-root not found, rendering inline');
    return <>{children}</>;
  }
  return createPortal(children, portalRoot);
}
