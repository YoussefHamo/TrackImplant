import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import Portal from './Portal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4 font-mono select-none"
        style={{ zIndex: 'var(--z-dialog-overlay)' }}>
        <div 
          className="absolute inset-0 bg-[#07080a]/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        <div className="relative w-full max-w-2xl bg-[#16191e] border border-[#2d3341] rounded-xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden transform scale-100 transition-all">
          
          <div className="flex items-center justify-between p-5 border-b border-[#222630] bg-[#1a1e24]">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="text-cyan-500">//</span> <span>{title}</span>
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white bg-[#0d0f12] p-1.5 rounded-lg border border-transparent hover:border-[#2d3341] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar bg-[#111318]">
            {children}
          </div>

        </div>
      </div>
    </Portal>
  );
}