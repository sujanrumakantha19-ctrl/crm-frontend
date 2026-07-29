import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { activityLogService } from '@/services';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { useDebounce } from '@/hooks/useDebounce';
import type { ActivityLog } from '@/types';

export default function AdminActivityLogs() {
  const [actorFilter, setActorFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 1000);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 15;

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    const params: Record<string, string | number | undefined> = {
      page: p,
      limit: perPage,
    };
    if (actorFilter !== 'All') params.actorRole = actorFilter;
    if (actionFilter !== 'All') params.actionType = actionFilter;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

    try {
      const res = await activityLogService.getAll(params);
      setLogs(res.data || []);
      setTotalCount(res.total ?? (res.pagination?.total || 0));
      setTotalPages(res.pagination?.pages || Math.ceil((res.total || 0) / perPage) || 1);
      setPage(p);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actorFilter, actionFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const actionColors: Record<string, string> = {
    'Created': 'border-l-emerald-400',
    'Updated': 'border-l-blue-400',
    'Deleted': 'border-l-red-400',
    'Status Change': 'border-l-amber-400',
  };

  const hasFilters = actorFilter !== 'All' || actionFilter !== 'All' || searchTerm.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Control Bar: Search & Dropdown Filters */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          {/* Search Box with 500ms Debounce */}
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, or action..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Actor Filter Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide shrink-0">Actor:</label>
            <select
              value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none w-full sm:w-44"
            >
              <option value="All">All Actors</option>
              <option value="Staff">Staff</option>
              <option value="Channel Partner">Channel Partner</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          {/* Action Filter Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide shrink-0">Action:</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none w-full sm:w-44"
            >
              <option value="All">All Actions</option>
              <option value="Created">Created</option>
              <option value="Updated">Updated</option>
              <option value="Deleted">Deleted</option>
              <option value="Status Change">Status Change</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={() => {
              setActorFilter('All');
              setActionFilter('All');
              setSearchTerm('');
            }}
            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors shrink-0"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Activity Logs Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const id = log.id || (log as unknown as { _id: string })._id;
            return (
              <div
                key={id}
                className={`bg-white rounded-lg border border-slate-200 shadow-sm p-4 border-l-[3px] ${
                  actionColors[log.actionType] || 'border-l-slate-300'
                } flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar
                    initials={log.actorInitials || getInitials(log.actorName)}
                    size="md"
                    bg={log.actorAvatarBg || getAvatarColor(log.actorName)}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{log.actorName}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">
                        {log.actorRole}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 font-medium">{log.action}</p>
                    {log.entityName && <p className="text-xs text-brand-blue mt-0.5 truncate">{log.entityName}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0 sm:ml-auto">
                  <p className="text-xs text-slate-400 font-semibold">
                    {new Date(log.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="bg-white rounded-lg border border-slate-200 py-16 text-center text-sm text-slate-400 shadow-sm">
              No activity logs match the selected filters or search terms.
            </div>
          )}
        </div>
      )}

      {/* Backend React Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
          <p className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{(page - 1) * perPage + 1}</span> to{' '}
            <span className="font-bold text-slate-800">{Math.min(page * perPage, totalCount)}</span> of{' '}
            <span className="font-bold text-slate-800">{totalCount}</span> activity logs
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => page > 1 && fetchLogs(page - 1)}
              disabled={page === 1}
              className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={13} /> Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pNum = idx + 1;
              if (totalPages > 5 && page > 3) {
                pNum = Math.min(totalPages, page - 2 + idx);
              }
              return (
                <button
                  key={pNum}
                  onClick={() => fetchLogs(pNum)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                    page === pNum
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
            <button
              onClick={() => page < totalPages && fetchLogs(page + 1)}
              disabled={page === totalPages}
              className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
