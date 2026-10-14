import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Building2, Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, AlertTriangle, Share2, Trash2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal } from '@/components/shared/Modal';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { CreateProjectModal } from '@/components/modals/CreateProjectModal';
import { ShareLocationModal } from '@/components/modals/ShareLocationModal';
import { SearchDropdown } from '@/components/shared/SearchDropdown';
import { projectService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { usePaginated } from '@/hooks/useApi';
import { getFileUrl } from '@/lib/api';
import { useExportContext } from '@/context/ExportContext';
import type { Project } from '@/types';
import { getProjectInventoryPlotTotal } from '@/lib/projectPlotCounts';

export default function AdminProjects() {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery);
  const { triggerDownload, setExportInfo } = useExportContext();
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    projectService.getLocations().then(r => setAllLocations(r.data || [])).catch(() => {});
  }, []);
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isPartner = role === 'partner';
  const isStaff = role === 'staff';

  const filters = useMemo(() => {
    const f: Record<string, string | number | undefined> = {};
    if (isPartner) {
      f['status[in]'] = 'Active,Upcoming,active,upcoming';
    } else if (isStaff) {
      if (statusFilter !== 'All') {
        f.status = statusFilter;
      } else {
        f['status[in]'] = 'Active,Upcoming,Completed,On Hold,active,upcoming,completed,on hold';
      }
    } else if (statusFilter !== 'All') {
      f.status = statusFilter;
    }
    if (locationFilter !== 'All') f.location = locationFilter;
    if (categoryFilter !== 'All') f.category = categoryFilter;
    if (debouncedSearchQuery.trim()) f.search = debouncedSearchQuery.trim();
    f.sort = 'statusPriority';
    f.select = 'name,displayId,location,district,totalPlots,totalLandArea,landAreaUnit,status,isEnabled,plotImages,images';
    return f;
  }, [role, isPartner, isStaff, statusFilter, locationFilter, categoryFilter, debouncedSearchQuery]);

  const PAGE_LIMIT = 10;

  const { data: projects, page, loading, hasNext, hasPrev, nextPage, prevPage, goToPage, total, refresh } = usePaginated<Project>(
    (params) => projectService.getAll(params), filters, { limit: PAGE_LIMIT }
  );

  const totalPages = useMemo(() => (total > 0 ? Math.ceil(total / PAGE_LIMIT) : 0), [total]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (isPartner) {
      params['status[in]'] = 'Active,Upcoming,active,upcoming';
    } else if (isStaff) {
      if (statusFilter !== 'All') {
        params.status = statusFilter;
      } else {
        params['status[in]'] = 'Active,Upcoming,Completed,On Hold,active,upcoming,completed,on hold';
      }
    } else if (statusFilter !== 'All') {
      params.status = statusFilter;
    }
    if (locationFilter !== 'All') params.location = locationFilter;
    if (categoryFilter !== 'All') params.category = categoryFilter;
    if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();

    setExportInfo({
      endpoint: '/export/projects',
      filename: 'projects',
      params,
    });
  }, [
    statusFilter,
    locationFilter,
    categoryFilter,
    debouncedSearchQuery,
    isPartner,
    isStaff,
    setExportInfo,
  ]);

  // Build page numbers array with ellipsis — memoised so it only recalculates when page/totalPages changes
  const pageNumbers = useMemo<(number | 'left-ellipsis' | 'right-ellipsis')[]>(() => {
    if (totalPages <= 1) return [];
    const SIBLING = 2; // how many pages to show on each side of current page
    const result: (number | 'left-ellipsis' | 'right-ellipsis')[] = [];
    const left = Math.max(2, page - SIBLING);
    const right = Math.min(totalPages - 1, page + SIBLING);

    result.push(1);
    if (left > 2) result.push('left-ellipsis');
    for (let i = left; i <= right; i++) result.push(i);
    if (right < totalPages - 1) result.push('right-ellipsis');
    if (totalPages > 1) result.push(totalPages);
    return result;
  }, [page, totalPages]);

  // Locations fetched from API on mount


  const handleCreateProject = useCallback(async (newProj: Partial<Project>) => {
    try {
      await projectService.create(newProj);
      toast.success('Project created successfully!');
      refresh();
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  }, [refresh]);

  const handleDeleteClick = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, name: projectName });
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await projectService.delete(projectToDelete.id);
      toast.success(`Project "${projectToDelete.name}" deleted successfully`);
      setDeleteConfirmOpen(false);
      setProjectToDelete(null);
      setDeleteConfirmText('');
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by name, ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none transition-all" />
          {loading && projects.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerDownload}
            className="flex items-center justify-center px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-all shrink-0"
          >
            Export CSV
          </button>
          {!isPartner && (
            <button
              onClick={() => setFilterMenuOpen(true)}
              className={`flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 border text-sm font-medium rounded-md active:scale-[0.98] transition-all shrink-0 ${
                (statusFilter !== 'All' || categoryFilter !== 'All' || locationFilter !== 'All')
                  ? 'bg-blue-50 border-brand-blue text-brand-blue font-semibold shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={16} className={(statusFilter !== 'All' || categoryFilter !== 'All' || locationFilter !== 'All') ? 'text-brand-blue' : ''} />
              <span className="hidden sm:inline ml-1.5">Filters</span>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setModalOpen(true)} className="flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-brand-green text-white text-sm font-medium rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all shrink-0">
              <Plus size={16} /><span className="hidden sm:inline ml-1.5">Create New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Pills Bar */}
      {!isPartner && (statusFilter !== 'All' || categoryFilter !== 'All' || locationFilter !== 'All' || searchQuery.trim()) && (
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
          <span className="text-xs font-semibold text-brand-blue">Active Filters:</span>
          {statusFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border border-blue-300 text-brand-blue px-2.5 py-1 rounded-full font-semibold shadow-xs">
              Status: {statusFilter}
              <button onClick={() => setStatusFilter('All')} className="hover:text-blue-800 ml-0.5"><X size={12} /></button>
            </span>
          )}
          {categoryFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border border-blue-300 text-brand-blue px-2.5 py-1 rounded-full font-semibold shadow-xs">
              Category: {categoryFilter}
              <button onClick={() => setCategoryFilter('All')} className="hover:text-blue-800 ml-0.5"><X size={12} /></button>
            </span>
          )}
          {locationFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border border-blue-300 text-brand-blue px-2.5 py-1 rounded-full font-semibold shadow-xs">
              Location: {locationFilter}
              <button onClick={() => setLocationFilter('All')} className="hover:text-blue-800 ml-0.5"><X size={12} /></button>
            </span>
          )}
          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border border-blue-300 text-brand-blue px-2.5 py-1 rounded-full font-semibold shadow-xs">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-blue-800 ml-0.5"><X size={12} /></button>
            </span>
          )}
          <button
            onClick={() => { setStatusFilter('All'); setCategoryFilter('All'); setLocationFilter('All'); setSearchQuery(''); }}
            className="text-xs text-brand-blue hover:underline font-semibold ml-auto"
          >
            Clear All
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-pulse">
              <div className="h-40 bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-200 rounded w-1/4" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 bg-slate-200 rounded w-16" />
                  <div className="h-6 bg-slate-200 rounded w-20" />
                  <div className="h-6 bg-slate-200 rounded w-16" />
                </div>
                <div className="h-9 bg-slate-200 rounded mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No projects match your filters</p>
          <button onClick={() => { setSearchQuery(''); setStatusFilter('All'); setLocationFilter('All'); setCategoryFilter('All'); }} className="text-brand-blue text-sm mt-2 hover:underline">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => {
              const id = project.id || (project as unknown as { _id: string })._id;
              const displayId = project.displayId || '—';
              const heroImg = (project.images && project.images.length > 0 ? project.images[0] : null) ||
                              (project.plotImages && project.plotImages.length > 0 ? project.plotImages[0] : null);
              return (
                <div key={id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
                  <div className="h-40 bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center relative overflow-hidden">
                    {heroImg ? (
                      <img
                        src={getFileUrl(heroImg)}
                        alt={`${project.name} [${displayId}]`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Building2 size={32} className="text-slate-300" />
                    )}
                    <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                      <StatusBadge status={project.status} />
                      {project.isEnabled === false && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Disabled</span>}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-bold text-slate-900">{project.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-400"><MapPin size={13} /><span className="text-xs">{project.location}</span></div>
                    <p className="text-xs text-slate-550 font-bold mt-1">ID: {displayId}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">{project.totalLandArea} {project.landAreaUnit}</span>
                      <span className="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">{getProjectInventoryPlotTotal(project)} Total Plots</span>
                      <span className="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">{project.availablePlots !== undefined ? project.availablePlots : '-'} Available</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button onClick={() => navigate(`/${role}/projects/${id}`)} className="flex-1 min-w-[120px] py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors">View Details</button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareProject(project);
                          setShareModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-semibold rounded-md transition-colors shrink-0"
                        title="Share Location to Leads"
                      >
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, id, project.name)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-semibold rounded-md transition-colors shrink-0"
                          title="Delete Project"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex flex-col items-center gap-3 mt-6">
              {/* Results count — always visible */}
              <p className="text-xs text-slate-400">
                Showing page{' '}
                <span className="font-semibold text-slate-700">{page}</span>
                {totalPages > 0 && (
                  <> of <span className="font-semibold text-slate-700">{totalPages}</span></>
                )}
                {' '}&mdash;{' '}
                <span className="font-semibold text-slate-700">{total}</span> total projects
              </p>

              {/* Page buttons — only show if more than 1 page */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {/* Prev */}
                  <button
                    onClick={prevPage}
                    disabled={!hasPrev}
                    className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {/* Page numbers with ellipsis */}
                  {pageNumbers.map((p, idx) => {
                    if (p === 'left-ellipsis' || p === 'right-ellipsis') {
                      return (
                        <span
                          key={p}
                          className="flex items-center justify-center w-8 h-8 text-slate-400 text-sm select-none"
                        >
                          &hellip;
                        </span>
                      );
                    }
                    return (
                      <button
                        key={`page-${p}`}
                        onClick={() => goToPage(p)}
                        className={`flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium transition-all border ${
                          p === page
                            ? 'bg-brand-green text-white border-brand-green shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                        aria-label={`Go to page ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    );
                  })}

                  {/* Next */}
                  <button
                    onClick={nextPage}
                    disabled={!hasNext}
                    className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Next page"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CreateProjectModal open={modalOpen && isAdmin} onClose={() => setModalOpen(false)} onSave={handleCreateProject} />
      <ShareLocationModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} project={shareProject} />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => { if (!deleting) { setDeleteConfirmOpen(false); setProjectToDelete(null); setDeleteConfirmText(''); } }}
        title="Delete Project"
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setDeleteConfirmOpen(false); setProjectToDelete(null); setDeleteConfirmText(''); }}
              disabled={deleting}
              className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting || deleteConfirmText !== 'delete'}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {deleting ? (
                <>Deleting...</>
              ) : (
                <>Delete Project</>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-800">Warning: This action cannot be undone!</p>
              <p className="text-xs text-red-700">
                You are about to permanently delete the project <strong>"{projectToDelete?.name}"</strong>.
                This will also remove all associated plots and data linked to this project.
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-2">
              Type <strong className="text-slate-900">delete</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder='Type "delete" to confirm'
              className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-red-400 outline-none transition-colors"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Slide-over Filter Menu */}
      {filterMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setFilterMenuOpen(false)} />
          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Filters</h2>
              <button onClick={() => setFilterMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${statusFilter !== 'All' ? 'text-brand-blue font-semibold' : 'text-slate-700'}`}>Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`w-full h-10 px-3 border rounded-md text-sm outline-none transition-colors ${statusFilter !== 'All' ? 'border-brand-blue bg-blue-50/50 text-brand-blue font-semibold' : 'border-slate-200 bg-white focus:border-brand-green'}`}>
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Completed">Completed</option>
                  {!isStaff && <option value="On Hold">On Hold</option>}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${categoryFilter !== 'All' ? 'text-brand-blue font-semibold' : 'text-slate-700'}`}>Category</label>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={`w-full h-10 px-3 border rounded-md text-sm outline-none transition-colors ${categoryFilter !== 'All' ? 'border-brand-blue bg-blue-50/50 text-brand-blue font-semibold' : 'border-slate-200 bg-white focus:border-brand-green'}`}>
                  <option value="All">All Categories</option>
                  <option value="Open Plots">Open Plots</option>
                  <option value="Villas">Villas</option>
                  <option value="Apartments">Apartments</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Farm Land">Farm Land</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${locationFilter !== 'All' ? 'text-brand-blue font-semibold' : 'text-slate-700'}`}>Location</label>
                <SearchDropdown options={[{ value: 'All', label: 'All Locations' }, ...allLocations.map(l => ({ value: l, label: l }))]} value={locationFilter} onChange={v => setLocationFilter(v)} placeholder="All Locations" className={`h-10 ${locationFilter !== 'All' ? 'border-brand-blue bg-blue-50/50 text-brand-blue font-semibold' : ''}`} />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100">
              <button onClick={() => { setStatusFilter('All'); setLocationFilter('All'); setCategoryFilter('All'); }} className="w-full py-2 text-sm text-brand-blue font-medium hover:bg-blue-50 rounded-md transition-colors">Clear All Filters</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}