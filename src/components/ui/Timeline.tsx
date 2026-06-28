
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface TimelineItem {
  title: string;
  description: string;
  date?: string;
  status: 'completed' | 'current' | 'pending';
}

interface TimelineProps {
  items: TimelineItem[];
}

export default function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-6 font-mono">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        // تخصيص الأيقونات والألوان بناءً على حالة المرحلة
        let Icon = Circle;
        let colorClass = "text-gray-600 border-gray-700";
        let titleColor = "text-gray-500";

        if (item.status === 'completed') {
          Icon = CheckCircle2;
          colorClass = "text-emerald-400 bg-emerald-950/20 border-emerald-500/30";
          titleColor = "text-emerald-400";
        } else if (item.status === 'current') {
          Icon = Clock;
          colorClass = "text-cyan-400 bg-cyan-950/30 border-cyan-500/50 animate-pulse";
          titleColor = "text-white font-bold";
        }

        return (
          <div key={index} className="flex items-start space-x-4 relative group">
            
            {/* الخط الرابط العمودي بين المراحل */}
            {!isLast && (
              <span 
                className={`absolute left-[17px] top-9 w-[2px] h-[calc(100%+12px)] ${
                  item.status === 'completed' ? 'bg-emerald-500/30' : 'bg-[#222630]'
                }`} 
                aria-hidden="true" 
              />
            )}

            {/* أيقونة الحالة الدائرية */}
            <div className={`flex items-center justify-center w-9 h-9 rounded-xl border text-center z-10 shrink-0 transition-all ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* تفاصيل المرحلة */}
            <div className="flex-1 bg-[#16191e]/40 border border-[#1f242c] rounded-xl p-4 hover:border-[#2d3341] transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                <h4 className={`text-sm uppercase tracking-wider ${titleColor}`}>
                  {item.title}
                </h4>
                {item.date && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest bg-[#0d0f12] px-2 py-0.5 rounded border border-[#222630]">
                    {item.date}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {item.description}
              </p>
            </div>

          </div>
        );
      })}
    </div>
  );
}