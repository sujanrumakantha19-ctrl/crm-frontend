import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Mail, MapPin, Phone, TrendingUp, Calendar, FileText, ChevronLeft, ChevronRight, User as UserIcon, Pencil, AlertCircle } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Timeline } from '@/components/shared/Timeline';
import { Modal } from '@/components/shared/Modal';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { DetailSkeletonPage } from '@/components/shared/SkeletonLoader';
import { channelPartnerService, userService, leadService, activityLogService } from '@/services';
import type { ActivityLog, ChannelPartner, Lead } from '@/types';
import { NameTag } from '@/components/shared/NameTag';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminChannelPartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const [partner, setPartner] = useState<ChannelPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'activity'>('overview');

  // Summary counts
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeads: 0,
    openLeads: 0,
    qualifiedLeads: 0,
    customers: 0,
    unqualified: 0,
  });

  // Overview Active Leads Tab
  const [activeLeadsList, setActiveLeadsList] = useState<Lead[]>([]);
  const [totalActiveLeads, setTotalActiveLeads] = useState(0);
  const [activeLeadsPage, setActiveLeadsPage] = useState(1);
  const [activeLeadsLoading, setActiveLeadsLoading] = useState(false);

  // All Leads Tab
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [totalAllLeads, setTotalAllLeads] = useState(0);
  const [allLeadsPage, setAllLeadsPage] = useState(1);
  const [allLeadsLoading, setAllLeadsLoading] = useState(false);

  // Activity History Tab
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [totalActivityLogs, setTotalActivityLogs] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

  const itemsPerPage = 10;

  // Initial Mount: Fetch Partner Profile and Overview Summary
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      let p: any = null;
      try {
        const cpRes = await channelPartnerService.getById(id);
        if (cpRes && cpRes.data) p = cpRes.data;
      } catch {
        try {
          const uRes = await userService.getById(id);
          if (uRes && uRes.data) {
            p = {
              ...uRes.data,
              companyName: uRes.data.companyName || (uRes.data as any).firmName || 'Channel Partner Firm',
            };
          }
        } catch { /* silent */ }
      }

      if (p) {
        if (!p.id) p.id = p._id;
        setPartner(p);

        // Fetch metrics for partner leads
        try {
          const pName = p.name || p.companyName || '';
          const lRes = await leadService.getAll({ source: pName, limit: 200 });
          const allPLeads = lRes.data || [];
          setSummaryMetrics({
            totalLeads: lRes.total ?? allPLeads.length,
            openLeads: allPLeads.filter(l => l.status === 'Open').length,
            qualifiedLeads: allPLeads.filter(l => l.status === 'Qualified').length,
            customers: allPLeads.filter(l => l.status === 'Customer').length,
            unqualified: allPLeads.filter(l => l.status === 'Unqualified').length,
          });
        } catch { /* silent */ }
      }

      setLoading(false);
    })();
  }, [id]);

  // Lazy Load Overview Active Leads
  const fetchActiveLeads = useCallback(async () => {
    if (!partner) return;
    setActiveLeadsLoading(true);
    try {
      const pName = partner.name || partner.companyName || '';
      const res = await leadService.getAll({ source: pName, page: activeLeadsPage, limit: itemsPerPage });
      const items = res.data || [];
      setActiveLeadsList(items.filter(l => l.status === 'Open' || l.status === 'Qualified'));
      setTotalActiveLeads(res.total ?? items.length);
    } catch {
      // silent
    } finally {
      setActiveLeadsLoading(false);
    }
  }, [partner, activeLeadsPage]);

  useEffect(() => {
    if (activeTab === 'overview') fetchActiveLeads();
  }, [activeTab, fetchActiveLeads]);

  // Lazy Load All Leads Tab
  const fetchAllLeadsTab = useCallback(async () => {
    if (!partner) return;
    setAllLeadsLoading(true);
    try {
      const pName = partner.name || partner.companyName || '';
      const res = await leadService.getAll({ source: pName, page: allLeadsPage, limit: itemsPerPage });
      setAllLeads(res.data || []);
      setTotalAllLeads(res.total ?? (res.pagination?.total || (res.data || []).length));
    } catch {
      // silent
    } finally {
      setAllLeadsLoading(false);
    }
  }, [partner, allLeadsPage]);

  useEffect(() => {
    if (activeTab === 'leads') fetchAllLeadsTab();
  }, [activeTab, fetchAllLeadsTab]);

  // Lazy Load Activity Logs Tab
  const fetchActivityTab = useCallback(async () => {
    if (!partner) return;
    setActivityLoading(true);
    try {
      const pid = partner.id || (partner as any)._id;
      const res = await activityLogService.getAll({ actorId: pid, page: activityPage, limit: itemsPerPage });
      setActivityLogs(res.data || []);
      setTotalActivityLogs(res.total ?? (res.pagination?.total || (res.data || []).length));
    } catch {
      // silent
    } finally {
      setActivityLoading(false);
    }
  }, [partner, activityPage]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityTab();
  }, [activeTab, fetchActivityTab]);

  const totalActiveLeadsPages = Math.ceil(totalActiveLeads / itemsPerPage) || 1;
  const totalAllLeadsPages = Math.ceil(totalAllLeads / itemsPerPage) || 1;
  const totalActivityPages = Math.ceil(totalActivityLogs / itemsPerPage) || 1;

  // Edit Partner state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editDob, setEditDob] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const handleOpenEdit = () => {
    if (!partner) return;
    setEditName(partner.name || '');
    setEditPhone(partner.phone || '');
    setEditEmail(partner.email || '');
    setEditCity(partner.city || '');
    setEditGender(partner.gender || 'Male');
    setEditDob(partner.dob ? new Date(partner.dob).toISOString().split('T')[0] : '');
    setEditIsActive(partner.isActive ?? true);
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!partner) return;
    if (!editName.trim() || !editPhone.trim()) {
      setEditError('Partner Name and Phone Number are required.');
      return;
    }
    const cleanPhone = editPhone.trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setEditError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    setSavingEdit(true);
    setEditError('');

    if (editDob) {
      const selectedDate = new Date(editDob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate >= today) {
        setEditError('Date of Birth cannot be today or a future date.');
        setSavingEdit(false);
        return;
      }
    }
    const pid = partner.id || (partner as any)._id;
    try {
      const updatedData = {
        name: editName.trim(),
        companyName: editName.trim(),
        phone: cleanPhone,
        email: editEmail.trim() || undefined,
        city: editCity.trim() || undefined,
        gender: editGender,
        dob: editDob || undefined,
        isActive: editIsActive,
        initials: editName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      };
      const res = await channelPartnerService.update(pid, updatedData);
      setPartner(prev => prev ? { ...prev, ...res.data } : null);
      setEditOpen(false);
      const { toast } = await import('sonner');
      toast.success('Channel partner updated successfully!');
    } catch (err: any) {
      setEditError(err.message || 'Failed to update channel partner');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <DetailSkeletonPage />;

  if (!partner) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <p className="text-slate-500">Channel Partner not found.</p>
        <Link to="/admin/channel-partners" className="text-brand-blue text-sm font-semibold mt-2 inline-block">Back to Partners</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/channel-partners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft size={15} /> Back to Channel Partners
      </Link>

      {/* Profile Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar initials={partner.initials || getInitials(partner.name)} bg={partner.avatarBg || getAvatarColor(partner.name)} size="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{partner.name}</h1>
                <StatusBadge status={partner.isActive ? 'Active' : 'Inactive'} />
              </div>
              {partner.companyName && <p className="text-sm text-slate-500 mt-0.5">{partner.companyName}</p>}
              <p className="text-xs text-slate-400 mt-0.5">{(partner as any).partnerId || ''}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{partner.phone}</span>
                <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{partner.email}</span>
                <span className="inline-flex items-center gap-1.5"><UserIcon size={14} className="text-slate-400" />Gender: {partner.gender || 'Male'}</span>
                {partner.city && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{partner.city}</span>}
                {partner.reraId && <span className="inline-flex items-center gap-1.5"><FileText size={14} className="text-slate-400" />RERA: {partner.reraId}</span>}
                {partner.dob && <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" />DOB: {partner.dob}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 bg-white text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all shadow-xs shrink-0 self-start lg:self-auto"
          >
            <Pencil size={14} className="text-slate-500" /> Edit Partner
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Leads" value={summaryMetrics.totalLeads} color="blue" />
        <StatCard label="Open" value={summaryMetrics.openLeads} color="slate" />
        <StatCard label="Qualified" value={summaryMetrics.qualifiedLeads} color="emerald" />
        <StatCard label="Customers" value={summaryMetrics.customers} color="green" />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label="Unqualified" value={summaryMetrics.unqualified} color="red" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'leads' as const, label: `My Leads (${summaryMetrics.totalLeads})` },
            { key: 'activity' as const, label: 'Activity History' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-brand-green text-brand-blue font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Lead Pipeline */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-brand-blue" /> Partner Lead Pipeline</h3>
            <div className="space-y-3">
              <PipelineBar label="Open" count={summaryMetrics.openLeads} total={summaryMetrics.totalLeads} color="bg-blue-500" />
              <PipelineBar label="Qualified" count={summaryMetrics.qualifiedLeads} total={summaryMetrics.totalLeads} color="bg-emerald-500" />
              <PipelineBar label="Customer" count={summaryMetrics.customers} total={summaryMetrics.totalLeads} color="bg-green-600" />
              <PipelineBar label="Unqualified" count={summaryMetrics.unqualified} total={summaryMetrics.totalLeads} color="bg-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* All Leads Tab */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
          {allLeadsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Customer</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Phone</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">City</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allLeads.map(lead => {
                      const lid = lead.id || (lead as any)._id;
                      return (
                        <tr key={lid} className="hover:bg-slate-50">
                          <td className="px-4 py-3"><Link to={`/admin/leads/${lid}`} className="font-medium text-slate-900 hover:text-brand-blue"><NameTag name={lead.customerName} displayId={lead.displayId} /></Link></td>
                          <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                          <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                          <td className="px-4 py-3 text-slate-600">{lead.city || '-'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(lead.dateAdded)}</td>
                        </tr>
                      );
                    })}
                    {allLeads.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No leads brought by partner</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {allLeads.map(lead => {
                  const lid = lead.id || (lead as any)._id;
                  return (
                    <div key={lid} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-start mb-2">
                        <Link to={`/admin/leads/${lid}`} className="font-semibold text-slate-900"><NameTag name={lead.customerName} displayId={lead.displayId} /></Link>
                        <StatusBadge status={lead.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{lead.phone}</p>
                      <p className="text-[11px] text-slate-400">Added: {formatDate(lead.dateAdded)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalAllLeadsPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-800">{(allLeadsPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-semibold text-slate-800">{Math.min(allLeadsPage * itemsPerPage, totalAllLeads)}</span> of{' '}
                    <span className="font-semibold text-slate-800">{totalAllLeads}</span> leads
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={allLeadsPage === 1}
                      onClick={() => setAllLeadsPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      disabled={allLeadsPage === totalAllLeadsPages}
                      onClick={() => setAllLeadsPage(p => Math.min(totalAllLeadsPages, p + 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Activity History Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
          {activityLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <Timeline items={activityLogs.map(l => ({
                id: l.id || (l as any)._id,
                actor: l.actorName,
                action: l.action,
                actionType: l.actionType,
                entityType: l.entityType,
                entityName: l.entityName,
                timestamp: formatDate(l.timestamp),
                details: l.details,
              }))} />

              {/* Pagination */}
              {totalActivityPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Page <span className="font-semibold text-slate-800">{activityPage}</span> of <span className="font-semibold text-slate-800">{totalActivityPages}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={activityPage === 1}
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      disabled={activityPage === totalActivityPages}
                      onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Edit Partner Modal */}
      {editOpen && (
        <Modal 
          open={editOpen} 
          onClose={() => { if (!savingEdit) setEditOpen(false); }} 
          title={`Edit Channel Partner — ${partner?.name}`} 
          size="md" 
          footer={
            <>
              <button onClick={() => setEditOpen(false)} disabled={savingEdit} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                {savingEdit && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          }
        >
          {editError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{editError}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name <span className="text-red-500 font-bold">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Partner name" 
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone <span className="text-red-500 font-bold">*</span>
              </label>
              <input 
                type="tel" 
                maxLength={10}
                placeholder="10-digit mobile number" 
                value={editPhone}
                onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input 
                type="email" 
                placeholder="email@example.com" 
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
              <input 
                type="text" 
                placeholder="City" 
                value={editCity}
                onChange={e => setEditCity(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Gender <span className="text-red-500 font-bold">*</span>
              </label>
              <select
                value={editGender}
                onChange={e => setEditGender(e.target.value as 'Male' | 'Female' | 'Other')}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all cursor-pointer"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
              <input 
                type="date" 
                max={getYesterdayStr()}
                value={editDob}
                onChange={e => {
                  const val = e.target.value;
                  if (val && val > getYesterdayStr()) {
                    toast.error('Date of Birth cannot be today or a future date.');
                    setEditDob('');
                  } else {
                    setEditDob(val);
                  }
                }}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Status</label>
              <select
                value={editIsActive ? 'active' : 'inactive'}
                onChange={e => setEditIsActive(e.target.value === 'active')}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`p-4 rounded-lg border shadow-sm text-center ${bgColors[color] || 'bg-slate-50 text-slate-700'}`}>
      <span className="text-2xl font-extrabold block">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wider block mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

function PipelineBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-medium mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-500">{count} ({pct}%)</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
