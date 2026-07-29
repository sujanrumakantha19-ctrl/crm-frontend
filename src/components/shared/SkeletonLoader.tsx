import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

export function CardSkeletonGrid({ count = 6, cols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' }: { count?: number; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-4 animate-pulse`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0 bg-slate-200" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 bg-slate-200" />
                <Skeleton className="h-3 w-20 bg-slate-200" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <Skeleton className="h-3 w-full bg-slate-200" />
            <Skeleton className="h-3 w-3/4 bg-slate-200" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-7 w-20 rounded bg-slate-200" />
            <Skeleton className="h-7 w-24 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-pulse space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <Skeleton className="h-5 w-40 bg-slate-200" />
        <Skeleton className="h-8 w-32 rounded bg-slate-200" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <Skeleton key={cIdx} className={`h-4 bg-slate-200 ${cIdx === 0 ? 'w-36' : cIdx === cols - 1 ? 'w-16' : 'w-24'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeletonPage() {
  return (
    <div className="space-y-6 animate-pulse p-2">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 bg-slate-200" />
              <Skeleton className="h-4 w-32 bg-slate-200" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-lg bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16 bg-slate-200" />
              <Skeleton className="h-5 w-24 bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Skeleton className="h-6 w-40 bg-slate-200 mb-4" />
          <Skeleton className="h-4 w-full bg-slate-200" />
          <Skeleton className="h-4 w-5/6 bg-slate-200" />
          <Skeleton className="h-4 w-4/6 bg-slate-200" />
        </div>
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Skeleton className="h-6 w-32 bg-slate-200 mb-4" />
          <Skeleton className="h-12 w-full bg-slate-200 rounded-lg" />
          <Skeleton className="h-12 w-full bg-slate-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function InfiniteScrollSpinner({ text = 'Loading more items...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-6 gap-2.5 text-sm text-slate-500 font-medium">
      <Spinner className="w-5 h-5 text-brand-green shrink-0" />
      <span>{text}</span>
    </div>
  );
}
