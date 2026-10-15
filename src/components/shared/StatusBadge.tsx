import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusMap: Record<string, { bg: string; text: string }> = {
  'Active': { bg: 'bg-green-100', text: 'text-green-700' },
  'Inactive': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Upcoming': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Planning': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Completed': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'On Hold': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Open': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Qualified': { bg: 'bg-green-100', text: 'text-green-700' },
  'Unqualified': { bg: 'bg-red-100', text: 'text-red-700' },
  'Customer': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Present': { bg: 'bg-green-100', text: 'text-green-700' },
  'Absent': { bg: 'bg-rose-100', text: 'text-rose-700' },
  'Not Joined': { bg: 'bg-slate-100', text: 'text-slate-500' },
  'Weekly Off': { bg: 'bg-slate-100', text: 'text-slate-600' },
  'Scheduled': { bg: 'bg-sky-50', text: 'text-sky-700' },
  'Needs Review': { bg: 'bg-amber-100', text: 'text-amber-800' },
  'Half Day': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Below 4 Hours': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Available': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Booked': { bg: 'bg-green-100', text: 'text-green-700' },
  'Registered': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Reserved': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Canceled': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Cancelled': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Pending': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'To Do': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'In Progress': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'In Review': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Done': { bg: 'bg-green-100', text: 'text-green-700' },
  'Low': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Medium': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'High': { bg: 'bg-red-100', text: 'text-red-700' },
  'Pending Review': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Unassigned': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Advance Paid': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Advance Not Paid': { bg: 'bg-rose-100', text: 'text-rose-700' },
  'Paid': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Not Paid': { bg: 'bg-rose-100', text: 'text-rose-700' },
  'Partially Paid': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Fully Paid': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const style = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  const displayLabel = status === 'Canceled' ? 'Cancelled' : status;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2.5 py-0.5 font-medium',
        size === 'sm' ? 'text-xs' : 'text-sm',
        style.bg,
        style.text,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
