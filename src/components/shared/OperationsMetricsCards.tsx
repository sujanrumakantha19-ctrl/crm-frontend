import { CreditCard, FileCheck, Home, Landmark, Users } from 'lucide-react';

export interface OperationsMetricsData {
  totalLoans: number;
  totalCustomers?: number;
  registrationPending: number;
  totalBookings: number;
  bookingPayments: {
    notPaid: number;
    partiallyPaid: number;
    advancePaid: number;
    advanceNotPaid: number;
  };
}

interface OperationsMetricsCardsProps {
  metrics: OperationsMetricsData | null;
  loading?: boolean;
  role: string;
  onNavigate: (path: string) => void;
  totalCustomers?: number;
}

function MetricSkeleton() {
  return <div className="w-12 h-8 bg-slate-100 animate-pulse rounded" />;
}

export function OperationsMetricsCards({
  metrics,
  loading = false,
  role,
  onNavigate,
  totalCustomers,
}: OperationsMetricsCardsProps) {
  const m = metrics || {
    totalLoans: 0,
    totalCustomers: 0,
    registrationPending: 0,
    totalBookings: 0,
    bookingPayments: { notPaid: 0, partiallyPaid: 0, advancePaid: 0, advanceNotPaid: 0 },
  };

  const totalCustomersCount = totalCustomers !== undefined ? totalCustomers : (m.totalCustomers ?? 0);

  const cardClass =
    'bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2 text-left hover:shadow-md transition-all';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
      <button
        type="button"
        onClick={() => onNavigate(`/${role}/customers`)}
        className={`${cardClass} hover:border-teal-300 cursor-pointer group`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight group-hover:text-teal-700">
            Total Loans
          </p>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <Landmark size={14} className="text-teal-600" />
          </div>
        </div>
        {loading ? (
          <MetricSkeleton />
        ) : (
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{m.totalLoans}</p>
        )}
        <span className="text-[10px] text-teal-600 font-semibold group-hover:underline">View Loans &rarr;</span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate(role === 'staff' ? '/staff/my-leads?tab=Customer' : '/admin/leads?tab=Customer')}
        className={`${cardClass} hover:border-blue-300 cursor-pointer group`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight group-hover:text-blue-700">
            Total Customers
          </p>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Users size={14} className="text-blue-600" />
          </div>
        </div>
        {loading ? (
          <MetricSkeleton />
        ) : (
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{totalCustomersCount}</p>
        )}
        <span className="text-[10px] text-blue-600 font-semibold group-hover:underline">View Customers &rarr;</span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate(`/${role}/registrations?tab=upcoming`)}
        className={`${cardClass} hover:border-purple-300 cursor-pointer group`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight group-hover:text-purple-600">
            Registration Pending
          </p>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <FileCheck size={14} className="text-purple-500" />
          </div>
        </div>
        {loading ? (
          <MetricSkeleton />
        ) : (
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{m.registrationPending}</p>
        )}
        <span className="text-[10px] text-purple-600 font-semibold group-hover:underline">View Upcoming &rarr;</span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate(`/${role}/registrations`)}
        className={`${cardClass} hover:border-amber-300 cursor-pointer group`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight group-hover:text-amber-700">
            Total Bookings
          </p>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Home size={14} className="text-amber-500" />
          </div>
        </div>
        {loading ? (
          <MetricSkeleton />
        ) : (
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{m.totalBookings}</p>
        )}
        <span className="text-[10px] text-amber-600 font-semibold group-hover:underline">View Registrations &rarr;</span>
      </button>

      <div className={`${cardClass} border-l-4 border-l-amber-500`}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">
            Booking Payments
          </p>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <CreditCard size={14} className="text-amber-600" />
          </div>
        </div>
        {loading ? (
          <MetricSkeleton />
        ) : (
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Not Paid</span>
              <span className="font-bold text-slate-900">{m.bookingPayments.notPaid}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Partially Paid</span>
              <span className="font-bold text-slate-900">{m.bookingPayments.partiallyPaid}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Advance Paid</span>
              <span className="font-bold text-slate-900">{m.bookingPayments.advancePaid}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Advance Not Paid</span>
              <span className="font-bold text-slate-900">{m.bookingPayments.advanceNotPaid}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onNavigate(`/${role}/customers`)}
          className="text-[10px] text-amber-600 font-semibold hover:underline text-left mt-1"
        >
          View Loans &rarr;
        </button>
      </div>
    </div>
  );
}
