export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.04)', ...style }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <Skeleton className="w-10 h-10 rounded-xl mb-3" />
      <Skeleton className="h-8 w-24 mb-1" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-[22px] p-5" style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <Skeleton className="w-10 h-10 rounded-xl mb-3" />
      <Skeleton className="h-8 w-20 mb-1" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}
