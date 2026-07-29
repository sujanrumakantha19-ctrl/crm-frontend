export interface TimelineItem {
  id?: string;
  color?: string;
  text?: string;
  label?: string;
  action?: string;
  actor?: string;
  timestamp?: string;
  date?: string;
  actionType?: string;
  entityType?: string;
  entityName?: string;
  projectName?: string;
  isToday?: boolean;
  details?: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400 italic">
        No activity history recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      {items.map((item, i) => {
        const dotColor = item.color || 'bg-brand-blue';
        const displayLabel = item.text || item.label || item.action || 'Activity logged';
        const displayDate = item.date || item.timestamp || '';

        return (
          <div key={item.id || i} className="relative pb-5 last:pb-0">
            {i < items.length - 1 && (
              <div className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />
            )}
            <div className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <p className="text-sm text-slate-800">
                    {item.actor && <span className="font-semibold text-slate-900">{item.actor} </span>}
                    <span className="font-medium">{displayLabel}</span>
                    {item.entityName && <span className="text-slate-600 font-semibold"> — {item.entityName}</span>}
                  </p>
                  {displayDate && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-xs shrink-0">
                      {displayDate}
                    </span>
                  )}
                </div>
                {item.details && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.details}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {item.isToday && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                      Today
                    </span>
                  )}
                  {item.actionType && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      {item.actionType}
                    </span>
                  )}
                  {item.entityType && item.entityType.toLowerCase() !== 'project' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                      {item.entityType}
                    </span>
                  )}
                </div>
                {item.projectName && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-amber-900 font-medium">
                    <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Project:</span>
                    <span>{item.projectName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
