import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: 'blue' | 'green' | 'teal' | 'amber' | 'red' | 'purple';
}

const colorMap = {
  blue: 'border-l-blue-600',
  green: 'border-l-green-500',
  teal: 'border-l-teal-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  purple: 'border-l-purple-500',
};

const iconColorMap = {
  blue: 'bg-blue-100 text-brand-blue',
  green: 'bg-green-100 text-green-600',
  teal: 'bg-teal-100 text-teal-600',
  amber: 'bg-amber-100 text-amber-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
};

export function MetricCard({ title, value, icon, color }: MetricCardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-slate-200 shadow-sm p-5 border-l-[3px]', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-[28px] font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconColorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
