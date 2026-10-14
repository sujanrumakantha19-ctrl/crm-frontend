import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Phone, Mail, Building2, FileText, Banknote, Tag, Hash } from 'lucide-react';
import { leadService, projectService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/shared/Modal';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { formatDate, formatSource } from '@/lib/utils';
import { CardSkeletonGrid, InfiniteScrollSpinner } from '@/components/shared/SkeletonLoader';
import type { Lead, Project } from '@/types';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';

export default function StaffLeadsPool() {
  const { userId, user } = useAuth();
  const [openLeads, setOpenLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [reserving, setReserving] = useState<string | null>(null);
  const [whatsAppLead, setWhatsAppLead] = useState<{ phone: string; name: string } | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [projects, setProjects] = useState<Project[]>([]);

  // Server pagination state
  const pageRef = useRef(1);
  const totalRef = useRef(0);
  const hasMoreRef = useRef(true);
  const LIMIT = 100;

  // Fetch projects list for project filter dropdown
  useEffect(() => {
    projectService.getAll({ limit: 100 }).then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  // Helper to format ISO date string cleanly
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.split('T')[0];
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr.split('T')[0];
    }
  };

  // 500ms Debounce effect for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch leads based on debounced search query & project filter (sorted newest first)
  useEffect(() => {
    setLoading(true);
    pageRef.current = 1;
    hasMoreRef.current = true;
    const params: any = { status: 'Open', limit: LIMIT, sort: '-createdAt' };
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    if (projectFilter !== 'all') {
      params.projectId = projectFilter;
    }

    leadService.getAll(params)
      .then(res => {
        const raw = res.data || [];
        const isUnassigned = (l: Lead) => !l.assignedTo || (typeof l.assignedTo === 'object' && !(l.assignedTo as any)._id && !(l.assignedTo as any).id);
        totalRef.current = res.total ?? raw.length;
        setOpenLeads(raw.filter(isUnassigned));
        hasMoreRef.current = raw.length >= LIMIT;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch, projectFilter]);

  // Fetch next page when trigger is visible
  useEffect(() => {
    const trigger = document.getElementById('infinite-scroll-trigger');
    if (!trigger || loading || !hasMoreRef.current || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingMore) {
        setLoadingMore(true);
        const nextPage = pageRef.current + 1;
        const params: any = { status: 'Open', limit: LIMIT, page: nextPage, sort: '-createdAt' };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        if (projectFilter !== 'all') params.projectId = projectFilter;

        leadService.getAll(params)
          .then(res => {
            const raw = res.data || [];
            const isUnassigned = (l: Lead) => !l.assignedTo || (typeof l.assignedTo === 'object' && !(l.assignedTo as any)._id && !(l.assignedTo as any).id);
            pageRef.current = nextPage;
            hasMoreRef.current = raw.length >= LIMIT;
            totalRef.current = res.total ?? (pageRef.current * LIMIT);
            setOpenLeads(prev => [...prev, ...raw.filter(isUnassigned)]);
          })
          .catch(() => { hasMoreRef.current = false; })
          .finally(() => setLoadingMore(false));
      }
    }, { threshold: 0.1, rootMargin: '200px' });

    observer.observe(trigger);
    return () => observer.disconnect();
  }, [loading, loadingMore, debouncedSearch, projectFilter]);

  const handleReserve = async (lead: Lead) => {
    const id = lead.id || (lead as any)._id;
    const uId = userId || user?.id || (user as any)?._id;
    if (!uId) {
      const { toast } = await import('sonner');
      toast.error('Session error: Unable to determine staff ID. Please re-login.');
      return;
    }
    if (reserving) return;
    setReserving(id);
    // Optimistic: remove from pool immediately
    setOpenLeads(prev => prev.filter(l => (l.id || (l as any)._id) !== id));
    try {
      await leadService.update(id, { assignedTo: uId, assignedToName: user?.name || 'Staff' } as any);
      setReserved(prev => new Set([...prev, id]));
      const { toast } = await import('sonner');
      toast.success('Lead reserved successfully!');
    } catch (err: any) {
      // Rollback: add the lead back
      setOpenLeads(prev => [...prev, lead]);
      const { toast } = await import('sonner');
      const apiMsg = err?.response?.data?.message || err?.message;
      toast.error(apiMsg || 'Failed to reserve lead. It may have been taken by another staff member.');
    }
    setReserving(null);
  };

  const hasMore = hasMoreRef.current;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Open Leads Pool</h1>
          <p className="text-sm text-slate-500 mt-1">{totalRef.current} leads available</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              placeholder="Search by name, phone, or Lead ID (L-...)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <div className="absolute left-3 top-2.5 text-slate-400">
              <Search size={16} />
            </div>
            {searchQuery !== debouncedSearch && (
              <div className="absolute right-3 top-2.5">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent w-full sm:w-48"
          >
            <option value="all">All Projects</option>
            {projects.map(p => {
              const pid = p.id || (p as any)._id;
              return <option key={pid} value={pid}>{p.name}</option>;
            })}
          </select>
        </div>
      </div>

      {loading && openLeads.length === 0 ? (
        <CardSkeletonGrid count={6} />
      ) : openLeads.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-3 border border-slate-100">
            <Search size={22} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No leads found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms or project filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {openLeads.map(lead => {
            const lid = lead.id || (lead as unknown as {_id:string})._id;
            const projName = lead.projectId && typeof lead.projectId === 'object' ? (lead.projectId as any).name : undefined;
            return (
              <div
                key={lid}
                onClick={() => setSelectedLead(lead)}
                className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
              >
                <h3 className="text-base font-bold text-slate-900">{lead.customerName}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-xs text-slate-500">{lead.phone}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWhatsAppLead({ phone: lead.phone, name: lead.customerName });
                    }}
                    className="p-0.5 hover:bg-emerald-50 rounded text-emerald-600 transition-colors flex items-center justify-center shrink-0"
                    title="Chat on WhatsApp"
                  >
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.291 5.3 0 11.799 0c3.148.001 6.108 1.228 8.334 3.457 2.227 2.229 3.452 5.19 3.45 8.34-.004 6.502-5.302 11.793-11.8 11.793a11.72 11.72 0 0 1-5.905-1.582L0 24zm6.549-3.791c1.472.873 2.924 1.34 4.703 1.341 5.485 0 9.948-4.457 9.951-9.94.002-2.656-1.03-5.153-2.905-7.03C16.48 2.705 13.987 1.666 11.797 1.667c-5.49 0-9.952 4.453-9.955 9.937-.001 1.83.483 3.61 1.4 5.161l-.979 3.57 3.655-.959c1.488.81 2.927 1.233 4.689 1.233zm11.302-7.608c-.307-.154-1.821-.899-2.101-.998-.28-.1-.484-.15-.688.156-.204.307-.79.99-.968 1.2-.178.209-.356.234-.664.08-1.124-.564-1.868-.93-2.613-2.204-.199-.34-.199-.546-.073-.728.115-.164.307-.356.462-.534.156-.178.208-.303.312-.507.105-.205.052-.385-.026-.539-.078-.154-.688-1.659-.942-2.27-.247-.595-.5-.515-.688-.525-.178-.009-.382-.01-.587-.01-.205 0-.539.077-.821.385-.282.307-1.078 1.053-1.078 2.569 0 1.516 1.102 2.985 1.256 3.19.154.205 2.169 3.312 5.254 4.643.734.317 1.307.506 1.754.648.74.235 1.414.201 1.947.122.593-.088 1.821-.745 2.076-1.463.254-.718.254-1.333.178-1.463-.076-.13-.28-.205-.588-.359z"/>
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-slate-550 font-bold mt-0.5">ID: {lead.displayId || lid}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400"><MapPin size={11} /> {lead.city || '—'}</div>

                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span className="inline-flex items-center text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {formatSource(lead.sourceType, lead.source)}
                  </span>
                  {projName && <span className="inline-flex text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">{projName}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-2">Added {formatDate(lead.dateAdded)}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReserve(lead);
                  }}
                  disabled={reserving === lid}
                  className={`w-full mt-4 py-2 text-white text-sm font-medium rounded active:scale-[0.98] transition-all ${reserving === lid ? 'bg-amber-300 cursor-wait' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                  {reserving === lid ? 'Reserving...' : 'Reserve Lead'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      {!loading && hasMore && (
        <div id="infinite-scroll-trigger" className="w-full mt-6">
          <InfiniteScrollSpinner text="Loading more pool leads..." />
        </div>
      )}
      {!hasMore && openLeads.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-6 italic">All leads loaded</p>
      )}

      {/* Lead Details Modal */}
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
                  <span className="text-xs text-slate-400">Added {formatDate(selectedLead.dateAdded)}</span>
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
                  <p className="text-sm font-medium text-slate-800">{formatSource(selectedLead.sourceType, selectedLead.source)}</p>
                </div>
              </div>
              {selectedLead.propertyInterest && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Property Interest</p>
                    <p className="text-sm font-medium text-slate-800">{selectedLead.propertyInterest}</p>
                  </div>
                </div>
              )}
              {selectedLead.projectId && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Hash size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Project</p>
                    <p className="text-sm font-medium text-slate-800">{typeof selectedLead.projectId === 'object' ? (selectedLead.projectId as any).name : 'Selected'}</p>
                  </div>
                </div>
              )}
              {(selectedLead.budgetMin || selectedLead.budgetMax) && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Banknote size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Budget</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedLead.budgetMin ? `₹${selectedLead.budgetMin.toLocaleString()}` : ''}
                      {selectedLead.budgetMin && selectedLead.budgetMax ? ' — ' : ''}
                      {selectedLead.budgetMax ? `₹${selectedLead.budgetMax.toLocaleString()}` : ''}
                    </p>
                  </div>
                </div>
              )}
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

            {/* Action Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  const leadToReserve = selectedLead;
                  setSelectedLead(null);
                  handleReserve(leadToReserve);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-lg transition-colors"
              >
                Reserve Lead
              </button>
            </div>
          </div>
        )}
      </Modal>

      {whatsAppLead && (
        <WhatsAppChatModal
          open={!!whatsAppLead}
          onClose={() => setWhatsAppLead(null)}
          phone={whatsAppLead.phone}
          name={whatsAppLead.name}
        />
      )}
    </div>
  );
}
