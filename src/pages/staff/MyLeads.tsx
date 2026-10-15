import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { LEAD_PROJECT_LIST_PARAMS, getProjectId, isProjectSelectableForNewLead } from '@/lib/leadProjectOptions';
import { leadService, projectService, userService, channelPartnerService } from '@/services';
import type { CheckPhoneLead } from '@/services/leads';
import type { Lead, Project, User, LeadStatus } from '@/types';
import { Search, Phone, MapPin, Calendar, MessageSquare, ChevronLeft, ChevronRight, Plus, ExternalLink, AlertTriangle, X } from 'lucide-react';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { useExportContext } from '@/context/ExportContext';
import { getMaxDobStr, formatSource } from '@/lib/utils';
import { CardSkeletonGrid } from '@/components/shared/SkeletonLoader';

const tabs: { key: string; label: string }[] = [
  { key: 'All', label: 'All Leads' },
  { key: 'Reserved', label: 'Reserved' },
  { key: 'Qualified', label: 'Qualified Leads' },
  { key: 'Unqualified', label: 'Unqualified' },
  { key: 'Customer', label: 'Customers' },
];

export default function StaffMyLeads() {
  const { userId, user } = useAuth();
  const { setExportInfo, triggerDownload } = useExportContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [leadList, setLeadList] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (urlTab) {
      const found = tabs.find(t => t.key.toLowerCase() === urlTab.toLowerCase());
      if (found) return found.key;
    }
    return 'Reserved';
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const PAGE_LIMIT = 12;

  const [whatsAppLead, setWhatsAppLead] = useState<{ phone: string; name: string; projectName?: string } | null>(null);

  // State for qualify / unqualify confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ type: 'qualify' | 'unqualify'; lead: Lead } | null>(null);

  // Tab counts state
  const [counts, setCounts] = useState<{ [key: string]: number }>({
    All: 0,
    Reserved: 0,
    Qualified: 0,
    Unqualified: 0,
    Customer: 0,
  });

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

  // Follow-up modal
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpOutcome, setFollowUpOutcome] = useState('Interested');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);

  // Create lead form states
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cCity, setCCity] = useState('Hyderabad');
  const [cNotes, setCNotes] = useState('');
  const [cSourceType, setCSourceType] = useState<string>('Direct');
  const [cSourceName, setCSourceName] = useState('Direct Intake');
  const [cProjectId, setCProjectId] = useState('');
  const [cAssigneeId, setCAssigneeId] = useState(userId || '');
  const [cStatus, setCStatus] = useState<LeadStatus>('Open');
  const [cPaymentStatus, setCPaymentStatus] = useState<'Not Paid' | 'Partially Paid' | 'Fully Paid'>('Not Paid');
  const [cDob, setCDob] = useState('');
  const [cBudget, setCBudget] = useState('');
  const [cCategory, setCCategory] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch tab summary counts
  const fetchCounts = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await leadService.getCounts({
        assignedTo: userId,
        search: debouncedSearch.trim() || undefined,
      });
      const data = res.data || res;
      const allCount = (data as any).All ?? (data as any).all ?? 0;
      const reservedCount = (data as any).Reserved ?? (data as any).reserved ?? 0;
      const qualCount = (data as any).Qualified ?? (data as any).qualified ?? 0;
      const custCount = (data as any).Customer ?? (data as any).customer ?? 0;
      const unqualCount = (data as any).Unqualified ?? (data as any).unqualified ?? 0;

      setCounts({
        All: allCount,
        Reserved: reservedCount,
        Qualified: qualCount,
        Unqualified: unqualCount,
        Customer: custCount,
      });
    } catch { /* ignore */ }
  }, [userId, debouncedSearch]);

  // Fetch backend-driven paginated leads whenever activeTab, page, or search changes
  const fetchLeads = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const pRes = await projectService.getAll({ ...LEAD_PROJECT_LIST_PARAMS });
      setProjects(pRes.data || []);

      const queryParams: Record<string, any> = {
        assignedTo: userId,
        page,
        limit: PAGE_LIMIT,
        sort: '-createdAt',
      };

      if (activeTab === 'Reserved') {
        queryParams.status = 'Open';
      } else if (activeTab === 'Qualified') {
        queryParams.status = 'Qualified';
      } else if (activeTab === 'Unqualified') {
        queryParams.status = 'Unqualified';
      } else if (activeTab === 'Customer') {
        queryParams.status = 'Customer';
        queryParams.groupBy = 'customer';
      } else if (activeTab === 'All') {
        queryParams.groupBy = 'customer';
      }

      if (debouncedSearch.trim()) {
        queryParams.search = debouncedSearch.trim();
      }

      const lRes = await leadService.getAll(queryParams);
      const filtered = lRes.data || [];
      setLeadList(filtered);
      setTotalLeads(lRes.total ?? lRes.count ?? filtered.length);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load leads');
    }
    setLoading(false);
  }, [userId, activeTab, page, debouncedSearch]);

  // Synchronize export info with current tab, filters, and search
  useEffect(() => {
    if (!userId) return;
    const params: Record<string, string> = {
      assignedTo: userId,
    };
    if (activeTab === 'Reserved') {
      params.status = 'Open';
    } else if (activeTab === 'Qualified') {
      params.status = 'Qualified';
    } else if (activeTab === 'Unqualified') {
      params.status = 'Unqualified';
    } else if (activeTab === 'Customer') {
      params.status = 'Customer';
      params.groupBy = 'customer';
    } else if (activeTab === 'All') {
      params.groupBy = 'customer';
    }
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    setExportInfo({
      endpoint: '/export/leads',
      filename: `my-leads-${activeTab.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`,
      params,
    });
  }, [userId, activeTab, debouncedSearch, setExportInfo]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const match = tabs.find(t => t.key.toLowerCase() === tabParam.toLowerCase());
      if (match && match.key !== activeTab) {
        setActiveTab(match.key);
        setPage(1);
        setLoading(true);
      }
    }
  }, [searchParams]);

  // Handle Tab Switch — Reset page to 1 and trigger loading spinner
  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    setLoading(true);
    setActiveTab(newTab);
    setPage(1);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    fetchLeads();
    fetchCounts();
  }, [fetchLeads, fetchCounts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    userService.getAll({ role: 'staff', limit: 100 }).then(r => setStaffUsers(r.data || [])).catch(() => {});
  }, []);

  const totalPages = Math.ceil(totalLeads / PAGE_LIMIT);

  // Build page numbers array with ellipsis
  const pageNumbers = useMemo<(number | 'left-ellipsis' | 'right-ellipsis')[]>(() => {
    if (totalPages <= 1) return [];
    const SIBLING = 2;
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

  // Duplicate phone state
  const [duplicateLead, setDuplicateLead] = useState<CheckPhoneLead | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const lastCheckedPhoneRef = useRef<string>('');

  const handlePhoneChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setCPhone(clean);

    if (clean.length === 10) {
      if (lastCheckedPhoneRef.current === clean) return;
      lastCheckedPhoneRef.current = clean;
      setCheckingPhone(true);
      try {
        const res = await leadService.checkPhone(clean);
        if (res.exists && res.lead) {
          setDuplicateLead(res.lead);
        } else {
          setDuplicateLead(null);
        }
      } catch {
        setDuplicateLead(null);
      } finally {
        setCheckingPhone(false);
      }
    } else {
      lastCheckedPhoneRef.current = '';
      setDuplicateLead(null);
    }
  };

  const handleClearPhone = () => {
    setCPhone('');
    lastCheckedPhoneRef.current = '';
    setDuplicateLead(null);
  };

  const [channelPartners, setChannelPartners] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    channelPartnerService.getAll({ limit: 200 }).then(r => setChannelPartners(r.data || [])).catch(() => {});
  }, []);

  const handleCreateLead = async () => {
    if (!cName.trim() || !cPhone.trim()) {
      setFormError('Name and Phone Number are mandatory.');
      return;
    }

    const phoneDigits = cPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (duplicateLead) {
      setFormError(`Phone number belongs to an existing lead: ${duplicateLead.customerName} (ID: ${duplicateLead.id}). Click "Clear Number" to enter a different phone number.`);
      return;
    }

    if (!cEmail.trim()) {
      setFormError('Email is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cEmail.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (cDob) {
      const selectedDate = new Date(cDob);
      const maxDobDate = new Date();
      maxDobDate.setFullYear(maxDobDate.getFullYear() - 18);
      maxDobDate.setHours(23, 59, 59, 999);
      if (selectedDate > maxDobDate) {
        setFormError('Date of Birth indicates age must be at least 18 years.');
        return;
      }
    }

    if (cSourceType === 'Staff' && !cSourceName.trim()) {
      setFormError('Please select a Staff Member for lead source.');
      return;
    }

    if (cSourceType === 'Channel Partner' && !cSourceName.trim()) {
      setFormError('Please select a Channel Partner for lead source.');
      return;
    }

    if ((cSourceType === 'Office Referral' || cSourceType === 'Client Referral') && !cSourceName.trim()) {
      setFormError('Please enter the Referrer Name for lead source.');
      return;
    }

    setFormError('');

    const projectId = cProjectId || undefined;
    const project = projects.find(p => (p.id || (p as unknown as {_id:string})._id) === cProjectId);
    const staff = staffUsers.find(s => (s.id || (s as unknown as {_id:string})._id) === cAssigneeId);

    const sourceVal = (cSourceType === 'Staff' || cSourceType === 'Channel Partner' || cSourceType === 'Office Referral' || cSourceType === 'Client Referral')
      ? (cSourceName.trim() || cSourceType)
      : cSourceType;

    // Only auto-assign to self when sourceType is 'Staff'.
    // For any other source, the lead should go to the unassigned Open pool —
    // NOT to this staff member's Reserved bucket.
    const isStaffSource = cSourceType === 'Staff';

    const newLead: any = {
      customerName: cName.trim(),
      phone: cPhone.trim(),
      email: cEmail.trim().toLowerCase() || undefined,
      city: cCity,
      dob: cDob,
      budget: cBudget.trim() || undefined,
      category: cCategory || undefined,
      propertyInterest: project ? project.category || 'Open Plots' : (cCategory || 'General Interest'),
      notes: cNotes.trim() || 'Direct lead creation by Staff',
      source: sourceVal,
      sourceType: cSourceType,
      assignedTo: isStaffSource ? userId : undefined,
      assignedToName: isStaffSource ? (user?.name || undefined) : undefined,
      status: isStaffSource ? 'Open' : cStatus,
      dateAdded: new Date().toISOString().split('T')[0],
      projectId: projectId,
      paymentStatus: cPaymentStatus,
    };

    try {
      await leadService.create(newLead);
      toast.success('Lead created successfully!');
      fetchLeads();
      fetchCounts();
      logActivity({ id: userId!, name: user?.name || 'Staff', role: 'staff', initials: user?.initials }, `Created lead "${cName.trim()}"`, 'Created', 'Lead', '', cName.trim());

      // Reset fields only after success
      setCName('');
      setCPhone('');
      setCEmail('');
      setCCity('Hyderabad');
      setCNotes('');
      setCSourceType('Direct');
      setCSourceName('Direct Intake');
      setCProjectId('');
      setCAssigneeId(userId || '');
      setCStatus('Open');
      setCPaymentStatus('Not Paid');
      setCDob('');
      setFormError('');
      setCreateOpen(false);
    } catch (err: any) {
      const msg = err.message || 'Failed to create lead';
      setFormError(msg);
      toast.error(msg);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpLead) return;
    const lid = followUpLead.id || (followUpLead as unknown as { _id: string })._id;
    const newFollowUp = {
      id: `fu-${Date.now()}`,
      date: followUpDate,
      nextFollowUpDate: nextFollowUpDate || undefined,
      notes: followUpNotes,
      outcome: followUpOutcome,
      nextAction: 'Follow up again',
    };
    const existingFollowUps = followUpLead.followUps || [];
    try {
      await leadService.update(lid, {
        nextFollowUpDate: nextFollowUpDate || undefined,
        followUps: [...existingFollowUps, newFollowUp]
      } as any);
      setLeadList(prev => prev.map(l => {
        const id = l.id || (l as unknown as { _id: string })._id;
        if (id === lid) return { ...l, nextFollowUpDate: nextFollowUpDate || undefined, followUps: [...existingFollowUps, newFollowUp] };
        return l;
      }));
      toast.success('Follow-up logged!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save follow-up');
    }
    setFollowUpLead(null);
    setFollowUpNotes('');
    setFollowUpOutcome('Interested');
    setNextFollowUpDate('');
  };

  const handleMarkQualified = async (lead: Lead) => {
    const lid = lead.id || (lead as unknown as { _id: string })._id;
    try {
      await leadService.update(lid, { status: 'Qualified' } as any);
      toast.success('Lead marked as qualified');
      logActivity({ id: userId!, name: user?.name || 'Staff', role: 'staff', initials: user?.initials }, `Qualified lead "${lead.customerName}"`, 'Status Change', 'Lead', lid, lead.customerName);
      fetchLeads();
      fetchCounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleMarkUnqualified = async (lead: Lead) => {
    const lid = lead.id || (lead as unknown as { _id: string })._id;
    try {
      await leadService.update(lid, { status: 'Unqualified' } as any);
      toast.success('Lead marked as unqualified');
      logActivity({ id: userId!, name: user?.name || 'Staff', role: 'staff', initials: user?.initials }, `Unqualified lead "${lead.customerName}"`, 'Status Change', 'Lead', lid, lead.customerName);
      fetchLeads();
      fetchCounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleMarkOpen = async (lead: Lead) => {
    const lid = lead.id || (lead as unknown as { _id: string })._id;
    try {
      await leadService.update(lid, { status: 'Open', assignedTo: null, assignedToName: null, assignedToDisplayId: null } as any);
      toast.success('Lead moved back to Open (unassigned)');
      logActivity({ id: userId!, name: user?.name || 'Staff', role: 'staff', initials: user?.initials }, `Re-opened lead "${lead.customerName}"`, 'Status Change', 'Lead', lid, lead.customerName);
      fetchLeads();
      fetchCounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Leads</h1>
          <p className="text-xs text-slate-500 mt-1">{totalLeads} leads assigned to you</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label} <span className="ml-1 text-xs text-slate-400">({counts[tab.key] || 0})</span>
          </button>
        ))}
      </div>

      {/* Search and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or Lead ID (L-...)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none bg-white"
          />
          {search !== debouncedSearch && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerDownload}
            className="flex items-center justify-center px-4 py-2 border border-slate-200 bg-white text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 transition-all shrink-0"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              setCAssigneeId(userId || '');
              setFormError('');
              setCreateOpen(true);
            }}
            className="flex items-center justify-center px-4 py-2 bg-brand-green text-white text-sm font-semibold rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all shrink-0"
          >
            <Plus size={16} /><span className="ml-1.5">Add New Lead</span>
          </button>
        </div>
      </div>

      {/* Loader or Lead Cards Grid */}
      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : leadList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-400 text-sm">No leads in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {leadList.map(lead => {
            const lid = lead.id || (lead as unknown as { _id: string })._id;
            const project = projects.find(p => (p.id || (p as unknown as { _id: string })._id) === lead.projectId);
            const latestFollowUp = lead.followUps && lead.followUps.length > 0 ? lead.followUps[lead.followUps.length - 1] : null;

            return (
              <div key={lid} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar initials={getInitials(lead.customerName)} size="lg" bg={getAvatarColor(lead.customerName)} />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate">{lead.customerName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 font-medium">{lead.phone}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWhatsAppLead({
                                phone: lead.phone,
                                name: lead.customerName,
                                projectName: project?.name || ''
                              });
                            }}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded transition-colors shrink-0"
                            title="Chat on WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.291 5.3 0 11.799 0c3.148.001 6.108 1.228 8.334 3.457 2.227 2.229 3.452 5.19 3.45 8.34-.004 6.502-5.302 11.793-11.8 11.793a11.72 11.72 0 0 1-5.905-1.582L0 24zm6.549-3.791c1.472.873 2.924 1.34 4.703 1.341 5.485 0 9.948-4.457 9.951-9.94.002-2.656-1.03-5.153-2.905-7.03C16.48 2.705 13.987 1.666 11.797 1.667c-5.49 0-9.952 4.453-9.955 9.937-.001 1.83.483 3.61 1.4 5.161l-.979 3.57 3.655-.959c1.488.81 2.927 1.233 4.689 1.233zm11.302-7.608c-.307-.154-1.821-.899-2.101-.998-.28-.1-.484-.15-.688.156-.204.307-.79.99-.968 1.2-.178.209-.356.234-.664.08-1.124-.564-1.868-.93-2.613-2.204-.199-.34-.199-.546-.073-.728.115-.164.307-.356.462-.534.156-.178.208-.303.312-.507.105-.205.052-.385-.026-.539-.078-.154-.688-1.659-.942-2.27-.247-.595-.5-.515-.688-.525-.178-.009-.382-.01-.587-.01-.205 0-.539.077-.821.385-.282.307-1.078 1.053-1.078 2.569 0 1.516 1.102 2.985 1.256 3.19.154.205 2.169 3.312 5.254 4.643.734.317 1.307.506 1.754.648.74.235 1.414.201 1.947.122.593-.088 1.821-.745 2.076-1.463.254-.718.254-1.333.178-1.463-.076-.13-.28-.205-.588-.359z"/>
                            </svg>
                          </button>
                        </div>
                        <p className="text-xs text-slate-550 font-bold mt-0.5">
                          ID: {lead.displayId || lid}
                          {((lead as any).relatedLeadDisplayIds && (lead as any).relatedLeadDisplayIds.length > 1) && (
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              (+{(lead as any).relatedLeadDisplayIds.length - 1} more)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>

                  {/* Badges & Meta Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {((lead as any).relatedBookingCount && (lead as any).relatedBookingCount > 1) && (
                        <span
                          className="inline-flex items-center text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded"
                          title={`Bookings: ${(lead as any).relatedLeadDisplayIds?.join(', ') || ''}`}
                        >
                          {(lead as any).relatedBookingCount} Bookings
                        </span>
                      )}
                      {lead.city && (
                        <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          <MapPin size={11} className="text-slate-400" />
                          {lead.city}
                        </span>
                      )}
                      {project && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const pid = project.id || (project as any)._id;
                            if (pid) navigate(`/staff/projects/${pid}`);
                          }}
                          className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer group"
                          title="View Project Details & Plot Layout Map"
                        >
                          <span className="underline underline-offset-2 decoration-blue-400 group-hover:decoration-blue-700">{project.name}</span>
                          <ExternalLink size={12} className="text-blue-600 shrink-0" />
                        </button>
                      )}
                      {lead.source && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                          {formatSource(lead.sourceType, lead.source)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Added {formatDate(lead.dateAdded)}
                      </span>
                      {lead.followUps && lead.followUps.length > 0 && (
                        <span className="text-brand-blue font-medium flex items-center gap-1">
                          <MessageSquare size={12} />
                          {lead.followUps.length} Follow-up{lead.followUps.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Latest Follow-up Snippet */}
                  {latestFollowUp && (
                    <div className="bg-slate-50 rounded-lg p-2.5 mb-4 text-xs border border-slate-100">
                      <p className="font-semibold text-slate-700 flex items-center justify-between">
                        <span>Latest: {latestFollowUp.outcome}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{formatDate(latestFollowUp.date)}</span>
                      </p>
                      {latestFollowUp.notes && (
                        <p className="text-slate-500 mt-1 line-clamp-2">{latestFollowUp.notes}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {activeTab !== 'Customer' && (
                    <button
                      onClick={() => setFollowUpLead(lead)}
                      className="flex-1 py-1.5 px-3 bg-brand-green hover:bg-brand-darkgreen text-white text-xs font-semibold rounded-lg transition-colors text-center"
                    >
                      Log Follow-up
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/staff/leads/${lid}`)}
                    className="flex-1 py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors text-center"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Backend-Driven React Page-Number Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{(page - 1) * PAGE_LIMIT + 1}</span> to{' '}
            <span className="font-semibold text-slate-700">{Math.min(page * PAGE_LIMIT, totalLeads)}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalLeads}</span> leads
          </p>

          <div className="flex items-center gap-1 flex-wrap justify-center">
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>

            {/* Page Numbers */}
            {pageNumbers.map((p, idx) => {
              if (p === 'left-ellipsis' || p === 'right-ellipsis') {
                return (
                  <span key={p} className="flex items-center justify-center w-8 h-8 text-slate-400 text-sm select-none">
                    &hellip;
                  </span>
                );
              }
              return (
                <button
                  key={`page-${p}`}
                  onClick={() => setPage(p)}
                  className={`flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium transition-all border ${
                    p === page
                      ? 'bg-brand-green text-white border-brand-green shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Qualify / Unqualify Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === 'qualify') {
            handleMarkQualified(confirmAction.lead);
          } else {
            handleMarkUnqualified(confirmAction.lead);
          }
          setConfirmAction(null);
        }}
        title={confirmAction?.type === 'qualify' ? 'Mark Lead as Qualified' : 'Mark Lead as Unqualified'}
        message={
          confirmAction?.type === 'qualify'
            ? `Are you sure you want to mark "${confirmAction?.lead?.customerName || 'this lead'}" as Qualified? This lead will be moved to the Converted tab.`
            : `Are you sure you want to mark "${confirmAction?.lead?.customerName || 'this lead'}" as Unqualified?`
        }
        confirmLabel={confirmAction?.type === 'qualify' ? 'Yes, Mark Qualified' : 'Yes, Mark Unqualified'}
        variant={confirmAction?.type === 'qualify' ? 'warning' : 'danger'}
      />

      {/* Follow-up Modal */}
      <Modal open={!!followUpLead} onClose={() => { setFollowUpLead(null); setNextFollowUpDate(''); }} title="Log Follow-up">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Follow-up Date</label>
              <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Next Follow-up Date (Optional)</label>
              <input type="date" value={nextFollowUpDate} onChange={e => setNextFollowUpDate(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Outcome</label>
            <select value={followUpOutcome} onChange={e => setFollowUpOutcome(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white">
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Call Back Later">Call Back Later</option>
              <option value="No Answer">No Answer</option>
              <option value="Site Visit Scheduled">Site Visit Scheduled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
            <textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} rows={3} placeholder="Add notes about the conversation..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setFollowUpLead(null); setNextFollowUpDate(''); }} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleFollowUp} className="px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-darkgreen">Save Follow-up</button>
          </div>
        </div>
      </Modal>

      {/* Create Lead Modal */}
      {createOpen && (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Create New Lead"
          size="md"
        >
          <div className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-md">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Name <span className="text-red-500">*</span></label>
              <input type="text" value={cName} onChange={e => setCName(e.target.value)} placeholder="Enter customer name" className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Phone Number <span className="text-red-500">*</span>
                {checkingPhone && <span className="ml-2 text-[10px] text-blue-500 font-normal">Checking availability...</span>}
              </label>
              <input
                type="tel"
                maxLength={10}
                value={cPhone}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="Enter phone number"
                className={`w-full h-10 px-3 border rounded-lg text-sm outline-none transition-all ${
                  duplicateLead ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 focus:border-brand-green'
                }`}
              />
              {duplicateLead && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-2 text-amber-900 shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                      <span>Phone Number Already Exists!</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPhone}
                      className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    >
                      <X size={13} /> Clear Number
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white/80 p-2.5 rounded border border-amber-200/60">
                    <div>
                      <span className="text-slate-500 font-medium">Customer Name:</span>{' '}
                      <span className="font-bold text-slate-900">{duplicateLead.customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Status:</span>{' '}
                      <span className="font-semibold text-slate-800">{duplicateLead.status}</span>
                    </div>
                    <div className="min-w-0 flex items-center gap-1">
                      <span className="text-slate-500 font-medium shrink-0">Lead ID:</span>{' '}
                      <span className="font-mono text-slate-700 font-semibold truncate inline-block max-w-[160px]" title={duplicateLead.displayId || duplicateLead.id}>
                        {duplicateLead.displayId || (duplicateLead.id.startsWith('L') ? duplicateLead.id : `L-${duplicateLead.id.slice(-4).toUpperCase()}`)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Assigned To:</span>{' '}
                      <span className="font-semibold text-slate-800">{duplicateLead.assignedToName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800 font-medium italic">
                    Click "Clear Number" above to enter a new mobile number.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address <span className="text-red-500 font-bold">*</span></label>
              <input type="email" value={cEmail} onChange={e => setCEmail(e.target.value.toLowerCase())} placeholder="Enter email address" className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
              <input type="text" value={cCity} onChange={e => setCCity(e.target.value)} placeholder="Enter city" className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
              <input
                type="date"
                max={getMaxDobStr()}
                value={cDob}
                onChange={e => {
                  const val = e.target.value;
                  if (val && val > getMaxDobStr()) {
                    toast.error('Date of Birth indicates age must be at least 18 years.');
                    setCDob('');
                  } else {
                    setCDob(val);
                  }
                }}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred Project</label>
              <select value={cProjectId} onChange={e => setCProjectId(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none">
                <option value="">No specific project selected</option>
                {projects.filter(p => isProjectSelectableForNewLead(p, cProjectId)).map(p => {
                  const pid = getProjectId(p);
                  return <option key={pid} value={pid}>{p.name} ({p.location})</option>;
                })}
              </select>
            </div>
            {/* Budget & Category (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Budget (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ₹50,00,000 or 50 Lakhs"
                  value={cBudget}
                  onChange={e => setCBudget(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category (Optional)</label>
                <select
                  value={cCategory}
                  onChange={e => setCCategory(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none"
                >
                  <option value="">Select Category...</option>
                  <option value="Open Plots">Open Plots</option>
                  <option value="Villas">Villas</option>
                  <option value="Apartments">Apartments</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Farm Land">Farm Land</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lead Source</label>
              <select value={cSourceType} onChange={e => {
                const val = e.target.value;
                setCSourceType(val);
                if (val === 'Staff') {
                  setCSourceName(user?.name || 'Staff');
                  setCStatus('Open');
                } else {
                  setCSourceName('');
                }
              }} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none">
                <option value="Direct">Direct Lead</option>
                <option value="Staff">Staff</option>
                <option value="Channel Partner">Channel Partner</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Office Referral">Office Referral</option>
                <option value="Client Referral">Client Referral</option>
                <option value="Digital Marketing">Digital Marketing</option>
              </select>
            </div>
            {cSourceType === 'Channel Partner' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Channel Partner (Source) <span className="text-red-500">*</span></label>
                <select value={cSourceName} onChange={e => setCSourceName(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none">
                  <option value="">Choose Channel Partner...</option>
                  {channelPartners.map(cp => (
                    <option key={cp.id} value={cp.name}>{cp.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(cSourceType === 'Office Referral' || cSourceType === 'Client Referral') && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Referrer Name <span className="text-red-500">*</span></label>
                <input type="text" value={cSourceName} onChange={e => setCSourceName(e.target.value)} placeholder="Enter referrer name" className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none" />
              </div>
            )}
            {cSourceType !== 'Staff' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Phase</label>
                <select value={cStatus} onChange={e => setCStatus(e.target.value as LeadStatus)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none">
                  <option value="Open">Open Lead</option>
                  <option value="Qualified">Qualified Lead</option>
                  <option value="Unqualified">Unqualified</option>
                  <option value="Customer">Customer</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
              <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} rows={3} placeholder="Enter notes..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none resize-none" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreateLead} className="px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-darkgreen">Create Lead</button>
            </div>
          </div>
        </Modal>
      )}

      {whatsAppLead && (
        <WhatsAppChatModal
          open={!!whatsAppLead}
          onClose={() => setWhatsAppLead(null)}
          phone={whatsAppLead.phone}
          name={whatsAppLead.name}
          projectName={whatsAppLead.projectName}
        />
      )}
    </div>
  );
}
