import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Search, Award, AlertTriangle, ChevronLeft, ChevronRight, Download, Filter, RotateCcw, Pencil, Clock } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { Modal } from '@/components/shared/Modal';
import { useAuth } from '@/context/AuthContext';
import { getAvatarColor, getInitials } from '@/data/mockData';
import { leadService } from '@/services';
import { useExportContext } from '@/context/ExportContext';

const PER_PAGE = 15;

export default function StaffFollowUps() {
  const navigate = useNavigate();
  const { userId, role } = useAuth();

  // Search & Debounce
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 1000);
  const { triggerDownload } = useExportContext();

  // Filters
  const [dateFilter, setDateFilter] = useState<'all' | 'pending' | 'today' | 'yesterday' | 'week' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'positive' | 'negative'>('all');

  // Pagination & Data
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalCount: 0, positiveCount: 0, negativeCount: 0, pendingCount: 0 });

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Follow-up modal state
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editOutcome, setEditOutcome] = useState('Interested');
  const [editNextAction, setEditNextAction] = useState('Follow up again');
  const [editNextFollowUpDate, setEditNextFollowUpDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEditFollowUp = (item: any) => {
    setEditingItem(item);
    setEditDate(item.date ? item.date : new Date().toISOString().split('T')[0]);
    setEditOutcome(item.outcome || 'Interested');
    setEditNextAction(item.nextAction || 'Follow up again');
    setEditNextFollowUpDate(item.nextFollowUpDate || '');
    setEditNotes(item.notes || '');
    setEditModalOpen(true);
  };

  const handleSaveEditFollowUp = async () => {
    if (!editingItem || !editingItem.leadId) return;
    setSavingEdit(true);
    try {
      const leadRes: any = await leadService.getById(editingItem.leadId);
      const lead = leadRes.data;
      if (!lead) throw new Error('Lead not found');

      const targetId = editingItem.followUpId || editingItem._id || editingItem.id;
      let updatedFollowUps = [...(lead.followUps || [])];

      if (updatedFollowUps.length > 0) {
        let matched = false;
        updatedFollowUps = updatedFollowUps.map((fu: any) => {
          const fuId = fu._id || fu.id;
          if (fuId && targetId && String(fuId) === String(targetId)) {
            matched = true;
            return {
              ...fu,
              date: editDate,
              outcome: editOutcome,
              notes: editNotes,
              nextAction: editNextAction,
              nextFollowUpDate: editNextFollowUpDate || undefined,
            };
          }
          return fu;
        });

        if (!matched) {
          toast.error('Could not identify the follow-up to update. Please refresh and try again.');
          setSavingEdit(false);
          return;
        }
      } else {
        updatedFollowUps = [{
          date: editDate,
          outcome: editOutcome,
          notes: editNotes,
          nextAction: editNextAction,
          nextFollowUpDate: editNextFollowUpDate || undefined,
        }];
      }

      await leadService.update(editingItem.leadId, {
        followUps: updatedFollowUps,
        nextFollowUpDate: editNextFollowUpDate || null,
      });

      toast.success('Follow-up updated successfully!');
      setEditModalOpen(false);
      setEditingItem(null);
      fetchFollowUps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update follow-up');
    } finally {
      setSavingEdit(false);
    }
  };

  // Fetch follow-ups from backend whenever filters or page change
  const fetchFollowUps = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res: any = await leadService.getFollowUps({
        page,
        limit: PER_PAGE,
        assignedTo: userId, // Staff persona: filter ONLY staff's assigned follow-ups
        search: debouncedSearch || undefined,
        date: dateFilter !== 'all' && dateFilter !== 'custom' ? dateFilter : undefined,
        dateFrom: dateFilter === 'custom' ? (customFrom || undefined) : undefined,
        dateTo: dateFilter === 'custom' ? (customTo || undefined) : undefined,
        outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
      });

      setFollowUps(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch {
      setFollowUps([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, debouncedSearch, dateFilter, customFrom, customTo, outcomeFilter]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  // Reset page to 1 whenever a filter or search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFilter, customFrom, customTo, outcomeFilter]);

  const handleRowClick = (item: any) => {
    if (!item.leadId) return;
    navigate(`/${role}/leads/${item.leadId}?highlightFollowups=true`);
  };

  const clearFilters = () => {
    setSearchInput('');
    setDateFilter('all');
    setCustomFrom('');
    setCustomTo('');
    setOutcomeFilter('all');
    setPage(1);
  };

  const isFiltered = !!(searchInput || dateFilter !== 'all' || customFrom || customTo || outcomeFilter !== 'all');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Follow Ups</h1>
          <p className="text-xs text-slate-500 mt-1">Manage and track your customer follow-ups and activity outcomes</p>
        </div>
        <button
          onClick={triggerDownload}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => { setOutcomeFilter('all'); setDateFilter('all'); }}
          className={`text-left border rounded-lg p-3.5 sm:p-5 shadow-sm transition-all ${
            outcomeFilter === 'all' && dateFilter !== 'pending'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Total Follow Ups</span>
            <CalendarDays size={16} className="text-slate-400 shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{stats.totalCount}</p>
          <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1 block">Click to view all</span>
        </button>

        <button
          onClick={() => { setDateFilter('pending'); setOutcomeFilter('all'); }}
          className={`text-left border rounded-lg p-3.5 sm:p-5 shadow-sm transition-all ${
            dateFilter === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-amber-800 uppercase tracking-wide">Pending</span>
            <Clock size={16} className="text-amber-600 shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-700 mt-1">{stats.pendingCount || 0}</p>
          <span className="text-[9px] sm:text-[10px] text-amber-600 mt-1 block font-medium">Overdue dates</span>
        </button>

        <button
          onClick={() => { setOutcomeFilter('positive'); setDateFilter('all'); }}
          className={`text-left border rounded-lg p-3.5 sm:p-5 shadow-sm transition-all ${
            outcomeFilter === 'positive'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Positive</span>
            <Award size={16} className="text-emerald-500 shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">{stats.positiveCount}</p>
          <span className="text-[9px] sm:text-[10px] text-emerald-500 mt-1 block">Filter positive</span>
        </button>

        <button
          onClick={() => { setOutcomeFilter('negative'); setDateFilter('all'); }}
          className={`text-left border rounded-lg p-3.5 sm:p-5 shadow-sm transition-all ${
            outcomeFilter === 'negative'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Negative</span>
            <AlertTriangle size={16} className="text-rose-500 shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-600 mt-1">{stats.negativeCount}</p>
          <span className="text-[9px] sm:text-[10px] text-rose-500 mt-1 block">Filter negative</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter size={16} className="text-brand-blue" />
            <span>Search & Date Filters</span>
          </div>
          {isFiltered && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
              <RotateCcw size={12} /> Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          {/* Debounced Search Input (500ms) */}
          <div className="md:col-span-5 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name or phone number..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
          </div>

          {/* Date Filter Dropdown */}
          <div className="md:col-span-3">
            <select
              value={dateFilter}
              onChange={e => {
                setDateFilter(e.target.value as any);
                setCustomFrom('');
                setCustomTo('');
              }}
              className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              <option value="all">All Dates</option>
              <option value="pending">Pending Follow-ups</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
            </select>
          </div>

          {/* Custom Date Range */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => { setCustomFrom(e.target.value); setDateFilter('all'); }}
              className="h-9 w-full px-2 border border-slate-200 rounded-md bg-white text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-brand-green"
              title="From Date"
            />
            <input
              type="date"
              value={customTo}
              onChange={e => { setCustomTo(e.target.value); setDateFilter('all'); }}
              className="h-9 w-full px-2 border border-slate-200 rounded-md bg-white text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-brand-green"
              title="To Date"
            />
          </div>

          {/* Outcome Filter Dropdown */}
          <div className="md:col-span-3">
            <select
              value={outcomeFilter}
              onChange={e => setOutcomeFilter(e.target.value as any)}
              className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-brand-green cursor-pointer"
            >
              <option value="all">All Outcomes</option>
              <option value="positive">Positive / Interested</option>
              <option value="negative">Negative / Not Interested</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Customer Name', 'Followup Date', 'Next Followup Date', 'Outcome', 'Notes', 'Actions'].map(header => (
                    <th key={header} className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followUps.map(item => (
                  <tr
                    key={`${item.leadId}-${item.followUpId || item.id}`}
                    onClick={() => handleRowClick(item)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar initials={getInitials(item.leadName)} bg={getAvatarColor(item.leadName)} size="sm" />
                        <div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}
                            className="text-sm font-bold text-brand-blue hover:underline text-left block"
                          >
                            <NameTag name={item.leadName} displayId={item.displayId} />
                          </button>
                          <p className="text-xs text-slate-400">{item.phone} {item.city ? `• ${item.city}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {item.date}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {item.nextFollowUpDate ? (
                        (() => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isPending = item.nextFollowUpDate < todayStr;
                          return (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                              isPending
                                ? 'text-amber-800 bg-amber-50 border-amber-200/90 font-bold'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}>
                              {isPending ? <Clock size={13} className="text-amber-600 shrink-0" /> : <CalendarDays size={13} className="text-emerald-600 shrink-0" />}
                              {item.nextFollowUpDate} {isPending ? '(Pending)' : ''}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.outcome} />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 max-w-xs truncate">{item.notes || '-'}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditFollowUp(item); }}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-blue hover:text-brand-darkblue bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-md transition-all inline-flex items-center gap-1"
                        title="Edit Follow-up"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {followUps.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">No follow-ups match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {followUps.map(item => (
              <div
                key={`${item.leadId}-${item.followUpId || item.id}`}
                onClick={() => handleRowClick(item)}
                className="p-4 space-y-2 hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar initials={getInitials(item.leadName)} bg={getAvatarColor(item.leadName)} size="sm" />
                    <div>
                      <p className="text-sm font-bold text-brand-blue"><NameTag name={item.leadName} displayId={item.displayId} /></p>
                      <p className="text-xs text-slate-400">{item.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.outcome} />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditFollowUp(item); }}
                      className="p-1 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded transition-colors"
                      title="Edit Follow-up"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Log: <strong>{item.date}</strong></span>
                  <span>Next: <strong className="text-emerald-700">{item.nextFollowUpDate || '—'}</strong></span>
                </div>
              </div>
            ))}
            {followUps.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">No follow-ups match the selected filters.</div>
            )}
          </div>
        </div>
      )}

      {/* Edit Follow-up Modal */}
      {editModalOpen && (
        <Modal
          open={editModalOpen}
          onClose={() => { setEditModalOpen(false); setEditingItem(null); }}
          title="Edit Follow-up"
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-up Date 📅</label>
                <input
                  type="date"
                  value={editNextFollowUpDate}
                  onChange={e => setEditNextFollowUpDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outcome</label>
              <select
                value={editOutcome}
                onChange={e => setEditOutcome(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none bg-white focus:border-brand-green"
              >
                <option value="Interested">Interested</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Call Back Later">Call Back Later</option>
                <option value="No Answer">No Answer</option>
                <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                <option value="Plot Booked">Plot Booked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Action</label>
              <input
                type="text"
                value={editNextAction}
                onChange={e => setEditNextAction(e.target.value)}
                placeholder="e.g. Schedule site visit / Send brochure"
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Discussion Details</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Details of conversation..."
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green resize-y min-h-[80px]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setEditModalOpen(false); setEditingItem(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditFollowUp}
                disabled={savingEdit}
                className="px-4 py-2 bg-brand-green text-white text-sm font-semibold rounded-lg hover:bg-brand-darkgreen disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {savingEdit ? 'Updating...' : 'Update Follow-up'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Backend-driven Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 font-medium">
            Page <span className="font-semibold text-slate-900">{page}</span> of <span className="font-semibold text-slate-900">{totalPages}</span>
            <span className="text-slate-400 ml-2">({total} total follow-ups)</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
