

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  // وميض مخصص متناسق مع هوية النيون للسيستم
  return (
    <div className={`animate-pulse bg-[#1f242c] border border-[#2d3341]/40 rounded ${className}`} />
  );
}