import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  
  // غلق المودال عند الضغط على زر Escape في الكيبورد حمايةً للمستخدم
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-mono select-none">
      {/* Backdrop الخلفية الشفافة المعتمة */}
      <div 
        className="absolute inset-0 bg-[#07080a]/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box صندوق المحتوى المستقبلي */}
      <div className="relative w-full max-w-2xl bg-[#16191e] border border-[#2d3341] rounded-xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden transform scale-100 transition-all">
        
        {/* Header الهيدر العلوي للمودال */}
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

        {/* Body محتوى الفورم أو البيانات الداخلي */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-[#111318]">
          {children}
        </div>

      </div>
    </div>
  );
}