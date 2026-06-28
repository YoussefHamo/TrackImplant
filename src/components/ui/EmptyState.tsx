
import { DatabaseZap } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  description?: string;
}

export default function EmptyState({ 
  message = "NO DATA NODES DETECTED", 
  description = "The data stream is currently empty. System is idling..." 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-[#16191e]/50 border border-dashed border-[#222630] rounded-xl text-center space-y-3 my-4">
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full animate-bounce">
        <DatabaseZap className="w-8 h-8 text-amber-400" />
      </div>
      <div className="space-y-1">
        <h3 className="font-mono text-sm font-bold tracking-widest text-amber-400 uppercase">
          // {message}
        </h3>
        <p className="font-mono text-xs text-gray-500 max-w-sm">
          {description}
        </p>
      </div>
    </div>
  );
}