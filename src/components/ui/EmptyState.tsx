import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title = 'No data', description = 'Nothing to show here yet.', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon ? (
        <div className="text-5xl mb-4">{icon}</div>
      ) : (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <Inbox className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.15)' }} />
        </div>
      )}
      <h3 className="text-base font-semibold text-white/60 mb-1">{title}</h3>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
