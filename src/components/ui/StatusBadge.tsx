

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  // دالة ذكية لتحويل الكلمة لـ الستايل واللون المناسب لها في عالم السايبر
  const getStatusStyles = (text: string) => {
    const cleanStatus = text.toLowerCase().trim();

    switch (cleanStatus) {
      // حالات النجاح / المدفوع / المكتمل
      case 'paid':
      case 'completed':
      case 'active':
      case 'confirmed':
        return {
          bg: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-500'
        };
      
      // حالات الانتظار / تحت المعالجة / قيد التنفيذ
      case 'pending':
      case 'processing':
      case 'scheduled':
      case 'waiting':
        return {
          bg: 'bg-amber-950/30 border-amber-500/40 text-amber-400',
          dot: 'bg-amber-500'
        };

      // حالات الإلغاء / الفشل / الديون
      case 'cancelled':
      case 'failed':
      case 'overdue':
      case 'rejected':
        return {
          bg: 'bg-red-950/30 border-red-500/40 text-red-400',
          dot: 'bg-red-500'
        };

      // حالات خاصة بالزراعة والمتابعة (مرحلة أولى، فحص، إلخ)
      default:
        return {
          bg: 'bg-cyan-950/30 border-cyan-500/40 text-cyan-400',
          dot: 'bg-cyan-500'
        };
    }
  };

  const styles = getStatusStyles(status);

  return (
    <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${styles.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${styles.dot}`}></span>
      <span>{status}</span>
    </span>
  );
}