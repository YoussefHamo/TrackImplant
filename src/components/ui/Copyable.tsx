import { useState, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';

export default function Copyable({ text, children }: { text: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* no-op */ }
  };

  return (
    <span className="group inline-flex items-center gap-1 cursor-pointer" onClick={copy}>
      {children || <span>{text}</span>}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {copied ? <Check className="w-3 h-3 text-[#00E5A8]" /> : <Copy className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />}
      </span>
    </span>
  );
}
