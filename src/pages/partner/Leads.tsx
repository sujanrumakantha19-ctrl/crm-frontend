import { useCallback, useEffect, useState } from 'react';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { CardSkeletonGrid, InfiniteScrollSpinner } from '@/components/shared/SkeletonLoader';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { leadService, projectService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import { Phone, Mail, MapPin, Building2, FileText, Calendar, UserCheck, Banknote, Tag, Hash } from 'lucide-react';
import type { Lead, Project } from '@/types';

export default function PartnerLeads() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Fetch projects list for filter dropdown
  useEffect(() => {
    projectService.getAll({ limit: 100 }).then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Backend-driven fetch function
  const fetchFn = useCallback(async (page: number, limit: number) => {
    const queryParams: any = {
      sourceType: 'Channel Partner',
      source: user?.name,
      page,
      limit,
      sort: '-createdAt'
    };
    if (debouncedSearch.trim()) {
      queryParams.search = debouncedSearch.trim();
    }
    if (statusFilter !== 'all') {
      queryParams.status = statusFilter;
    }
    if (projectFilter !== 'all') {
      queryParams.projectId = projectFilter;
    }
    return await leadService.getAll(queryParams);
  }, [user?.name, debouncedSearch, statusFilter, projectFilter]);

  const { items, loading, hasMore, error, loaderRef } = useInfiniteScroll({
    fetchFn,
    limit: 20,
    deps: [user?.name, debouncedSearch, statusFilter, projectFilter]
  });

  const getProjectName = (projId: any) => {
    if (!projId) return undefined;
    if (typeof projId === 'object' && projId.name) return projId.name;
    const found = projects.find(p => (p.id || (p as any)._id) === String(projId));
    if (found) return found.name;
    if (typeof projId === 'string' && !/^[0-9a-fA-F]{24}$/.test(projId)) return projId;
    return undefined;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Leads</h1>
          <p className="text-xs text-slate-500 mt-1">{items.length} leads matching filters</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="h-9 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green w-full sm:w-60 bg-white"
          />

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white outline-none focus:border-brand-green w-full sm:w-48"
          >
            <option value="all">All Projects</option>
            {projects.map(p => {
              const pid = p.id || (p as any)._id;
              return <option key={pid} value={pid}>{p.name}</option>;
            })}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white outline-none focus:border-brand-green w-full sm:w-36"
          >
            <option value="all">All Status</option>
            <option value="Open">Open</option>
            <option value="Qualified">Qualified</option>
            <option value="Unqualified">Unqualified</option>
            <option value="Customer">Customer</option>
          </select>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <CardSkeletonGrid count={6} />
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500">No leads match your search criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map(lead => {
              const lid = lead.id || (lead as unknown as {_id:string})._id;
              const projName = getProjectName(lead.projectId);
              return (
                <button
                  key={lid}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow text-left w-full"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar initials={getInitials(lead.customerName)} size="lg" bg={getAvatarColor(lead.customerName)} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">{lead.customerName}</h3>
                      <p className="text-xs text-slate-500">{lead.phone}</p>
                      <p className="text-xs text-slate-400">{lead.city}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Submitted by You</span>
                      {projName && <span className="inline-flex text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">{projName}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={lead.status} />
                      <span className="text-xs text-slate-400">{formatDate((lead as any).createdAt || lead.dateAdded)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div ref={loaderRef}>
              <InfiniteScrollSpinner text="Loading more leads..." />
            </div>
          )}
          {!hasMore && items.length > 0 && <p className="text-center text-xs text-slate-400 mt-4">All leads loaded</p>}
        </>
      )}

      <Modal open={!!selectedLead} onClose={() => setSelectedLead(null)} title="Lead Details" size="lg">
        {selectedLead && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
              <Avatar initials={getInitials(selectedLead.customerName)} size="xl" bg={getAvatarColor(selectedLead.customerName)} />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900">{selectedLead.customerName}</h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <StatusBadge status={selectedLead.status} />
                  <span className="text-xs text-slate-400">Submitted {formatDate((selectedLead as any).createdAt || selectedLead.dateAdded)}</span>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Phone</p>
                  <p className="text-sm font-medium text-slate-800">{selectedLead.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Email</p>
                  <p className="text-sm font-medium text-slate-800 break-all">{selectedLead.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <UserCheck size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Gender</p>
                  <p className="text-sm font-medium text-slate-800">{(selectedLead as any).gender || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Calendar size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Date of Birth</p>
                  <p className="text-sm font-medium text-slate-800">{(selectedLead as any).dob ? formatDate((selectedLead as any).dob) : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <MapPin size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">City</p>
                  <p className="text-sm font-medium text-slate-800">{selectedLead.city || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Tag size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Source</p>
                  <p className="text-sm font-medium text-slate-800">{selectedLead.source || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Hash size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Preferred Project</p>
                  <p className="text-sm font-medium text-slate-800">{getProjectName(selectedLead.projectId) || '—'}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedLead.notes && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" /> Notes
                </h4>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{selectedLead.notes}</p>
              </div>
            )}

            {/* Follow-ups */}
            {selectedLead.followUps && selectedLead.followUps.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" /> Follow-ups ({selectedLead.followUps.length})
                </h4>
                <div className="space-y-2">
                  {selectedLead.followUps.map((fu, idx) => (
                    <div key={fu.id || idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-brand-green mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-700">{fu.date}</span>
                          {fu.outcome && <span className="text-[10px] text-slate-400">— {fu.outcome}</span>}
                        </div>
                        {fu.notes && <p className="text-xs text-slate-600 mt-0.5">{fu.notes}</p>}
                        {fu.nextAction && <p className="text-xs text-brand-blue mt-0.5">Next: {fu.nextAction}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
