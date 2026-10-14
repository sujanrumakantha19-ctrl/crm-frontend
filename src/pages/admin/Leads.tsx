import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Search, Users, Plus, AlertTriangle, X, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { Avatar } from '@/components/shared/Avatar';
import { Modal } from '@/components/shared/Modal';
import { useNotifications } from '@/context/NotificationContext';
import { useExportContext } from '@/context/ExportContext';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { LEAD_PROJECT_LIST_PARAMS, getProjectId, isProjectSelectableForNewLead } from '@/lib/leadProjectOptions';
import { leadService, userService, projectService, channelPartnerService } from '@/services';
import type { CheckPhoneLead } from '@/services/leads';
import { getInitials, getAvatarColor } from '@/data/mockData';
import type { LeadStatus, Lead, User, Project } from '@/types';
import { Empty, EmptyTitle, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { getMaxDobStr, formatSource } from '@/lib/utils';
import { CardSkeletonGrid, InfiniteScrollSpinner } from '@/components/shared/SkeletonLoader';
import { normPhone10 } from '@/lib/customerBookingRows';

const tabs: { key: string; label: string }[] = [
  { key: 'All', label: 'All Leads' },
  { key: 'Open', label: 'Open Leads' },
  { key: 'Reserved', label: 'Reserved' },
  { key: 'Qualified', label: 'Qualified Leads' },
  { key: 'Unqualified', label: 'Unqualified' },
  { key: 'Customer', label: 'Customers' },
];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const isMongoHexId = (val?: any): boolean => {
  if (!val) return false;
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
};

export interface ResolvedLeadStaff {
  name: string;
  displayId?: string;
}

export function resolveLeadRep(lead: any, users?: User[]): ResolvedLeadStaff | null {
  if (!lead) return null;
  let name = '';
  let displayId = '';

  const lName = lead.assignedToName?.trim();
  const lDisplay = lead.assignedToDisplayId?.trim();
  if (lName && !isMongoHexId(lName)) name = lName;
  if (lDisplay && !isMongoHexId(lDisplay)) displayId = lDisplay;

  if (lead.assignedTo && typeof lead.assignedTo === 'object') {
    const obj = lead.assignedTo as any;
    if (!name && obj.name && !isMongoHexId(obj.name)) name = obj.name.trim();
    if (!displayId && obj.displayId && !isMongoHexId(obj.displayId)) displayId = obj.displayId.trim();
  }

  const rawAssignedId = typeof lead.assignedTo === 'string' ? lead.assignedTo.trim() : '';

  if (users && users.length > 0) {
    const candidateIds = [rawAssignedId, lDisplay, displayId].filter(Boolean);
    for (const cand of candidateIds) {
      const found = users.find(u =>
        String(u.id) === cand ||
        (u as any)._id === cand ||
        (u.displayId && u.displayId.toUpperCase() === cand.toUpperCase())
      );
      if (found) {
        if (!name && found.name && !isMongoHexId(found.name)) name = found.name.trim();
        if (!displayId && found.displayId) displayId = found.displayId.trim();
      }
    }
  }

  if (!name && rawAssignedId && !isMongoHexId(rawAssignedId) && !rawAssignedId.toUpperCase().startsWith('STAFF-')) {
    name = rawAssignedId;
  }

  if (!name && !displayId) {
    if (lead.assignedTo || lead.assignedToName || lead.assignedToDisplayId) {
      return { name: 'Assigned' };
    }
    return null;
  }

  return { name, displayId };
}

export interface CollapsedLead extends Lead {
  relatedBookingCount?: number;
  relatedLeadDisplayIds?: string[];
  relatedLeadIds?: string[];
}

export function collapseCustomerLeads(leads: Lead[]): CollapsedLead[] {
  if (!leads || leads.length <= 1) {
    return leads.map(l => ({
      ...l,
      relatedBookingCount: (l as any).relatedBookingCount || 1,
      relatedLeadDisplayIds: (l as any).relatedLeadDisplayIds || (l.displayId ? [l.displayId] : []),
      relatedLeadIds: (l as any).relatedLeadIds || [String(l.id || (l as any)._id || '')],
    }));
  }
  const groups = new Map<string, CollapsedLead>();
  for (const lead of leads) {
    const rawDigits = normPhone10(lead.phone);
    let key = '';
    if (rawDigits && rawDigits !== '0000000000') {
      key = `p:${rawDigits}`;
    } else if (lead.displayId) {
      key = `d:${String(lead.displayId).trim().toUpperCase()}`;
    } else {
      key = `n:${String(lead.customerName || '').toLowerCase().trim()}`;
    }

    if (!groups.has(key)) {
      const item: CollapsedLead = {
        ...lead,
        relatedBookingCount: (lead as any).relatedBookingCount || 1,
        relatedLeadDisplayIds: (lead as any).relatedLeadDisplayIds || (lead.displayId ? [lead.displayId] : []),
        relatedLeadIds: (lead as any).relatedLeadIds || [String(lead.id || (lead as any)._id || '')],
      };
      groups.set(key, item);
    } else {
      const existing = groups.get(key)!;
      existing.relatedBookingCount = (existing.relatedBookingCount || 1) + 1;
      const dId = lead.displayId;
      if (dId && !existing.relatedLeadDisplayIds?.includes(dId)) {
        existing.relatedLeadDisplayIds?.push(dId);
      }
      const lid = String(lead.id || (lead as any)._id || '');
      if (lid && !existing.relatedLeadIds?.includes(lid)) {
        existing.relatedLeadIds?.push(lid);
      }
      if (!existing.assignedTo && lead.assignedTo) {
        existing.assignedTo = lead.assignedTo;
        existing.assignedToName = lead.assignedToName;
        existing.assignedToDisplayId = lead.assignedToDisplayId;
      }
    }
  }
  return Array.from(groups.values());
}

export default function AdminLeads() {
  const PAGE_SIZE = 25;
  const { addNotification } = useNotifications();
  const { userId, user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (urlTab) {
      const found = tabs.find(t => t.key.toLowerCase() === urlTab.toLowerCase());
      if (found) return found.key;
    }
    return 'Open';
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [whatsAppLead, setWhatsAppLead] = useState<{ phone: string; name: string; projectName?: string } | null>(null);
  const [leadList, setLeadList] = useState<Lead[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { setExportInfo, triggerDownload } = useExportContext();
  const [confirmUnqualify, setConfirmUnqualify] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const fetchTokenRef = useRef(0);

  // Tab counts state for pre-fetched badge counters
  const [tabCounts, setTabCounts] = useState<{ [key: string]: number }>({
    All: 0,
    Open: 0,
    Reserved: 0,
    Qualified: 0,
    Unqualified: 0,
    Customer: 0,
  });

  const fetchCounts = useCallback(async () => {
    try {
      const res: any = await leadService.getCounts({
        search: debouncedSearch.trim() || undefined,
      });
      const data = res.data || res;
      const open = data.Open ?? 0;
      const reserved = data.Reserved ?? 0;
      const qual = data.Qualified ?? 0;
      const unqual = data.Unqualified ?? 0;
      const cust = data.Customer ?? 0;
      setTabCounts({
        All: data.All ?? (open + reserved + qual + unqual + cust),
        Open: open,
        Reserved: reserved,
        Qualified: qual,
        Unqualified: unqual,
        Customer: cust,
      });
    } catch {}
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const activeStaffUsers = useMemo(() => {
    return staffUsers.filter(s => s.isActive !== false);
  }, [staffUsers]);

  // Filtered leads calculation
  const filtered = useMemo(() => {
    return leadList.filter(l => {
      const hasAssignee = !!(l.assignedTo && l.assignedTo !== undefined && l.assignedTo !== null);
      let matchesTab = false;
      if (activeTab === 'All') {
        matchesTab = true;
      } else if (activeTab === 'Open') {
        matchesTab = l.status === 'Open' && !hasAssignee;
      } else if (activeTab === 'Reserved') {
        matchesTab = l.status === 'Open' && hasAssignee;
      } else {
        matchesTab = l.status === activeTab;
      }
      if (!debouncedSearch.trim()) return matchesTab;
      const searchLower = debouncedSearch.trim().toLowerCase();
      const searchDigits = debouncedSearch.replace(/\D/g, '');
      const leadIdLower = l.displayId ? l.displayId.toLowerCase() : '';
      const leadIdDigits = l.displayId ? l.displayId.replace(/\D/g, '') : '';

      const rep = resolveLeadRep(l, staffUsers);
      const staffIdLower = (rep?.displayId || l.assignedToDisplayId || '').toLowerCase();
      const staffIdDigits = (rep?.displayId || l.assignedToDisplayId || '').replace(/\D/g, '');
      const staffNameLower = (rep?.name || l.assignedToName || '').toLowerCase();

      const staffPrefixMatch = searchLower.match(/^(?:staff|emp)[\s-]*0*(\d+)$/);
      const isStaffQuery = !!staffPrefixMatch;
      const targetStaffNum = staffPrefixMatch ? staffPrefixMatch[1] : '';

      const matchesStaffId = (
        (staffIdLower && staffIdLower.includes(searchLower)) ||
        (staffIdLower && staffIdLower.replace(/[\s-_]/g, '').includes(searchLower.replace(/[\s-_]/g, ''))) ||
        (isStaffQuery && staffIdDigits === targetStaffNum) ||
        (searchDigits !== '' && staffIdDigits === searchDigits)
      );
      const matchesStaffName = staffNameLower.includes(searchLower);

      const custPrefixMatch = searchLower.match(/^(?:l|c|cust|customer)[\s-]*0*(\d+)$/);
      const targetCustNum = custPrefixMatch ? custPrefixMatch[1] : '';

      const matchesLeadId = (
        (leadIdLower && leadIdLower.includes(searchLower)) ||
        (targetCustNum !== '' && leadIdDigits === targetCustNum) ||
        (searchDigits !== '' && leadIdDigits === searchDigits)
      );

      const matchesSearch =
        (l.customerName && l.customerName.toLowerCase().includes(searchLower)) ||
        (l.phone && l.phone.includes(searchLower)) ||
        matchesLeadId ||
        matchesStaffId ||
        matchesStaffName;
      return matchesTab && matchesSearch;
    });

    if (activeTab === 'Customer') {
      return collapseCustomerLeads(matched);
    }
    if (activeTab === 'All' && debouncedSearch.trim()) {
      const custs = matched.filter(l => l.status === 'Customer');
      const nonCusts = matched.filter(l => l.status !== 'Customer');
      return [...collapseCustomerLeads(custs), ...nonCusts];
    }
    return matched;
  }, [leadList, activeTab, debouncedSearch, staffUsers]);

  const tabCount = (key: string) => {
    return leadList.filter(l => {
      if (key === 'All') return true;
      const hasAssignee = !!(l.assignedTo && l.assignedTo !== undefined && l.assignedTo !== null);
      if (key === 'Open') return l.status === 'Open' && !hasAssignee;
      if (key === 'Reserved') return l.status === 'Open' && hasAssignee;
      return l.status === key;
    }).length;
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const match = tabs.find(t => t.key.toLowerCase() === tabParam.toLowerCase());
      if (match && match.key !== activeTab) {
        setActiveTab(match.key);
        setLeadList([]);
        setPage(1);
        setHasMore(false);
        setLoading(true);
      }
    }
  }, [searchParams]);

  const handleTabChange = (key: string) => {
    if (key === activeTab) return;
    setActiveTab(key);
    setLeadList([]);
    setPage(1);
    setHasMore(false);
    setLoading(true);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', key);
      return next;
    }, { replace: true });
  };

  const fetchLeads = useCallback(async (pageToLoad = 1, replace = false) => {
    const requestToken = ++fetchTokenRef.current;
    if (pageToLoad === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const queryParams: any = {
        limit: PAGE_SIZE,
        page: pageToLoad,
        sort: '-createdAt',
        search: debouncedSearch.trim() || undefined,
      };
      if (activeTab === 'Open') {
        queryParams.status = 'Open';
        queryParams.assignedTo = 'unassigned';
      } else if (activeTab === 'Reserved') {
        queryParams.status = 'Open';
        queryParams.assignedTo = 'assigned';
      } else if (activeTab === 'Customer') {
        queryParams.status = 'Customer';
        queryParams.groupBy = 'customer';
      } else if (activeTab !== 'All') {
        queryParams.status = activeTab;
      }
      const res = await leadService.getAll(queryParams);
      if (fetchTokenRef.current !== requestToken) {
        return;
      }
      const nextLeads = res.data || [];
      setLeadList(prev => replace ? nextLeads : [...prev, ...nextLeads]);
      setPage(pageToLoad);

      const pagination = (res as any).pagination;
      const nextExists = !!pagination?.next;
      setHasMore(nextExists || nextLeads.length === PAGE_SIZE);
    } catch {
      if (fetchTokenRef.current === requestToken) {
        setHasMore(false);
      }
    } finally {
      if (fetchTokenRef.current === requestToken) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeTab, debouncedSearch]);

  useEffect(() => {
    setLeadList([]);
    setPage(1);
    setHasMore(false);
    void fetchLeads(1, true);
  }, [fetchLeads]);

  // Infinite scroll observer
  useEffect(() => {
    if (loading || loadingMore || !hasMore || leadList.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && hasMore) {
        void fetchLeads(page + 1, false);
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    const target = loaderRef.current;
    if (target) observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [loading, loadingMore, hasMore, page, fetchLeads, leadList.length]);

  useEffect(() => {
    userService.getAll({ role: 'staff', limit: 100 }).then(r => setStaffUsers(r.data || [])).catch(() => {});
    projectService.getAll({ ...LEAD_PROJECT_LIST_PARAMS }).then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setExportInfo({
      endpoint: '/export/leads',
      filename: 'leads',
      params: {
        status: activeTab,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      },
    });
  }, [activeTab, debouncedSearch, setExportInfo]);

  // Modals state
  const [assignLead, setAssignLead] = useState<any | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [reassignNote, setReassignNote] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);

  // Create lead form states
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cCity, setCCity] = useState('Hyderabad');
  const [cNotes, setCNotes] = useState('');
  const [cSourceType, setCSourceType] = useState<string>('Direct');
  const [cSourceName, setCSourceName] = useState('Direct Intake');
  const [cProjectId, setCProjectId] = useState('');
  const [cAssigneeId, setCAssigneeId] = useState('');
  const [cStatus, setCStatus] = useState<LeadStatus>('Open');
  const [cPaymentStatus, setCPaymentStatus] = useState<'Not Paid' | 'Partially Paid' | 'Fully Paid'>('Not Paid');
  const [cDob, setCDob] = useState('');
  const [cGender, setCGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [cBudget, setCBudget] = useState('');
  const [cCategory, setCCategory] = useState('');

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

  // Handle lead assignment
  const handleAssignLead = async () => {
    if (!assignLead) return;
    if (!selectedStaffId) {
      toast.error('Please select a representative to assign this lead.');
      return;
    }
    const staff = staffUsers.find(s => (s.id || (s as unknown as {_id:string})._id) === selectedStaffId);
    if (!staff) {
      toast.error('Selected representative not found. Please re-select.');
      return;
    }

    const leadId = assignLead.id || (assignLead as unknown as {_id:string})._id;
    const noteText = reassignNote.trim() ? `\n\n[Reassigned by Admin]: ${reassignNote.trim()}` : '';

    try {
      await leadService.update(leadId, {
        assignedTo: selectedStaffId,
        assignedToName: staff.name,
        assignedToDisplayId: staff.displayId,
        notes: assignLead.notes ? `${assignLead.notes}${noteText}` : reassignNote.trim(),
      } as any);

      setLeadList(prev => prev.map(l => {
        const lid = l.id || (l as unknown as {_id:string})._id;
        if (lid === leadId) return { ...l, assignedTo: selectedStaffId, assignedToName: staff.name, assignedToDisplayId: staff.displayId };
        return l;
      }));

      addNotification({ type: 'task_assigned', message: `Assigned lead "${assignLead.displayId || assignLead.customerName}" to ${staff.name}`, actorName: 'Admin', entityId: leadId, entityType: 'Lead', userId: selectedStaffId });
      toast.success(`Lead assigned to ${staff.name}`);
      logActivity({ id: userId!, name: user!.name, role: role!, initials: user!.initials }, `Assigned lead "${assignLead.displayId || assignLead.customerName}" to ${staff.name}`, 'Updated', 'Lead', leadId, assignLead.displayId || assignLead.customerName);
      fetchCounts();
      void fetchLeads(1, true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign lead');
    }

    setAssignLead(null);
    setSelectedStaffId('');
    setReassignNote('');
  };

  const [channelPartners, setChannelPartners] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    channelPartnerService.getAll({ limit: 200 })
      .then(r => setChannelPartners(r.data || []))
      .catch(() => {});
  }, []);

  // Handle lead creation
  const [formError, setFormError] = useState('');
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
      setFormError(`Phone number belongs to an existing lead: ${duplicateLead.displayId || duplicateLead.customerName}. Click "Clear Number" to enter a different phone number.`);
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

    if (!cGender) {
      setFormError('Gender is a mandatory field.');
      return;
    }

    setFormError('');

    const projectId = cProjectId || undefined;
    const project = projects.find(p => (p.id || (p as unknown as {_id:string})._id) === cProjectId);
    const staff = staffUsers.find(s => (s.id || (s as unknown as {_id:string})._id) === cAssigneeId);

    const sourceVal = (cSourceType === 'Staff' || cSourceType === 'Channel Partner' || cSourceType === 'Office Referral' || cSourceType === 'Client Referral')
      ? (cSourceName.trim() || cSourceType)
      : cSourceType;

    const newLead: any = {
      customerName: cName.trim(),
      phone: cPhone.trim(),
      email: cEmail.trim().toLowerCase() || undefined,
      city: cCity,
      gender: cGender,
      dob: cDob,
      budget: cBudget.trim() || undefined,
      category: cCategory || undefined,
      propertyInterest: project ? project.category || 'Open Plots' : (cCategory || 'General Interest'),
      notes: cNotes.trim() || 'Direct lead creation by Admin',
      source: sourceVal,
      sourceType: cSourceType,
      assignedTo: staff ? (staff.id || (staff as unknown as {_id:string})._id) : undefined,
      assignedToName: staff?.name || undefined,
      assignedToDisplayId: staff?.displayId || undefined,
      status: cSourceType === 'Staff' ? 'Open' : cStatus,
      dateAdded: new Date().toISOString().split('T')[0],
      projectId: projectId,
      paymentStatus: cPaymentStatus,
    };

    try {
      await leadService.create(newLead);
      toast.success('Lead created successfully!');
      setLeadList([]);
      setPage(1);
      setHasMore(true);
      fetchCounts();
      await fetchLeads(1, true);
      logActivity({ id: userId!, name: user!.name, role: role!, initials: user!.initials }, `Created lead`, 'Created', 'Lead', '', cName.trim());

      // Notify assignee
      if (staff) {
        addNotification({
          type: 'task_assigned',
          message: `You have been assigned a new lead`,
          actorName: user?.name || 'Admin',
          entityType: 'Lead',
          userId: cAssigneeId,
        });
      }

      // Reset fields only after success
      setCName('');
      setCPhone('');
      setCEmail('');
      setCCity('Hyderabad');
      setCNotes('');
      setCSourceType('Direct');
      setCSourceName('Direct Intake');
      setCProjectId('');
      setCAssigneeId('');
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

  // Mark lead as qualified
  const handleMarkQualified = async (lead: Lead) => {
    const lid = lead.id || (lead as unknown as {_id: string})._id;
    try {
      await leadService.update(lid, { status: 'Qualified' } as any);
      setLeadList(prev => prev.map(l => (l.id || (l as unknown as {_id:string})._id) === lid ? { ...l, status: 'Qualified' } : l));
      toast.success('Lead marked as Qualified');
      logActivity(
        { id: user?.id || 'admin', name: user?.name || 'Admin', role: 'admin', initials: user?.initials },
        `Marked lead "${lead.displayId || lead.customerName}" as Qualified`,
        'Updated',
        'Lead',
        lid,
        lead.displayId || lead.customerName
      );
      fetchCounts();
      void fetchLeads(1, true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead');
    }
  };

  // Re-open unqualified lead
  const handleMarkUnqualified = async () => {
    if (!confirmUnqualify) return;
    try {
      await leadService.update(confirmUnqualify, { status: 'Unqualified' } as any);
      setLeadList(prev => prev.map(l => (l.id || (l as unknown as {_id:string})._id) === confirmUnqualify ? { ...l, status: 'Unqualified' } : l));
      toast.success('Lead marked unqualified');
      setConfirmUnqualify(null);
      fetchCounts();
      void fetchLeads(1, true);
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleReopen = async (leadId: string, clearAssignment = false) => {
    try {
      const payload: any = { status: 'Open' };
      if (clearAssignment) {
        payload.assignedTo = null;
        payload.assignedToName = null;
        payload.assignedToDisplayId = null;
      }
      await leadService.update(leadId, payload);
      setLeadList(prev => prev.map(l => {
        const lid = l.id || (l as unknown as {_id:string})._id;
        if (lid !== leadId) return l;
        if (clearAssignment) return { ...l, status: 'Open', assignedTo: undefined, assignedToName: undefined, assignedToDisplayId: undefined };
        return { ...l, status: 'Open' };
      }));
      toast.success(clearAssignment ? 'Lead moved back to Open (unassigned)' : 'Lead re-opened');
      fetchCounts();
      void fetchLeads(1, true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to re-open lead');
    }
  };

  return (
    <div>
      {/* Top Header Bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, Lead ID (L-...), or Staff ID (STAFF-...)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 w-full border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
          {loading && leadList.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button 
          onClick={() => { setFormError(''); setCreateOpen(true); }}
          className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-brand-green text-white text-sm font-semibold rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
        >
          <Plus size={16} /><span className="hidden sm:inline ml-1.5">Add New Lead</span>
        </button>
        {role === 'admin' && (
          <button
            onClick={triggerDownload}
            className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 border border-slate-200 bg-white rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download size={14} /><span className="hidden sm:inline ml-1.5">Export CSV</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-green text-brand-blue font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label} <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full ml-1 font-semibold">{tabCounts[tab.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Leads Content */}
      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : filtered.length === 0 ? (
        <Empty className="bg-white border border-slate-200 py-16">
          <EmptyHeader>
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2 mx-auto">
              <Users className="text-slate-400" size={24} />
            </div>
            <EmptyTitle>No {activeTab.toLowerCase()} leads found</EmptyTitle>
            <EmptyDescription>
              We couldn't find any {activeTab.toLowerCase()} leads matching your search criteria.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(lead => (
            <div key={lead.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <Avatar initials={getInitials(lead.customerName)} size="lg" bg={getAvatarColor(lead.customerName)} />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{lead.customerName}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-slate-500">{lead.phone}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWhatsAppLead({
                              phone: lead.phone,
                              name: lead.customerName,
                              projectName: (() => { const p = projects.find(pj => pj.id === lead.projectId); return p ? `${p.name} [${p.displayId}]` : '' })()
                            });
                          }}
                          className="p-1 hover:bg-emerald-50 rounded text-emerald-600 transition-colors flex items-center justify-center shrink-0"
                          title="Chat on WhatsApp"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-slate-550 font-bold">
                        ID: {lead.displayId || lead.id}
                        {((lead as any).relatedLeadDisplayIds && (lead as any).relatedLeadDisplayIds.length > 1) && (
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            (+{(lead as any).relatedLeadDisplayIds.length - 1} more)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={lead.status} size="sm" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      Source: {formatSource(lead.sourceType, lead.source)}
                    </span>
                    {((lead as any).relatedBookingCount && (lead as any).relatedBookingCount > 1) ? (
                      <span
                        className="inline-flex items-center text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded"
                        title={`Bookings: ${(lead as any).relatedLeadDisplayIds?.join(', ') || ''}`}
                      >
                        {(lead as any).relatedBookingCount} Bookings
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Referred on {formatDate(lead.dateAdded)}</span>
                    {(() => {
                      const rep = resolveLeadRep(lead, staffUsers);
                      if (!rep) {
                        return (
                          <span className="text-amber-600 font-semibold bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-xs">
                            Unassigned
                          </span>
                        );
                      }
                      return (
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 max-w-[200px] truncate" title={rep.name && rep.displayId ? `${rep.name} (${rep.displayId})` : (rep.name || rep.displayId)}>
                          <span className="text-slate-500 font-normal">Rep:</span>
                          <span className="text-slate-900 font-bold truncate">{rep.name || rep.displayId}</span>
                          {rep.name && rep.displayId && (
                            <span className="text-slate-500 font-medium text-[11px] shrink-0">({rep.displayId})</span>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {activeTab === 'Open' && (
                  <>
                    <button 
                      onClick={() => { setAssignLead(lead); setSelectedStaffId(lead.assignedTo || ''); }}
                      className="flex-1 py-1.5 bg-brand-green hover:bg-brand-darkgreen text-white text-xs font-semibold rounded active:scale-[0.98] transition-all text-center"
                    >
                      Assign
                    </button>
                    <button 
                      onClick={() => navigate(`/admin/leads/${lead.id || (lead as any)._id}`)}
                      className="flex-1 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded hover:bg-slate-50 active:scale-[0.98] transition-all text-center"
                    >
                      View
                    </button>
                  </>
                )}
                {activeTab === 'Reserved' && (
                  <>
                    <button 
                      onClick={() => { setAssignLead(lead); setSelectedStaffId(lead.assignedTo || ''); }}
                      className="flex-1 py-1.5 bg-brand-green hover:bg-brand-darkgreen text-white text-xs font-semibold rounded active:scale-[0.98] transition-all text-center"
                    >
                      Reassign
                    </button>
                    <button 
                      onClick={() => navigate(`/admin/leads/${lead.id || (lead as any)._id}`)}
                      className="flex-1 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded hover:bg-slate-50 active:scale-[0.98] transition-all text-center"
                    >
                      View
                    </button>
                  </>
                )}
                {(activeTab === 'All' || activeTab === 'Qualified' || activeTab === 'Unqualified') && (
                  <button 
                    onClick={() => navigate(`/admin/leads/${lead.id || (lead as any)._id}`)}
                    className="w-full py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded hover:bg-slate-50 transition-colors text-center"
                  >
                    View
                  </button>
                )}
                {activeTab === 'Customer' && (
                  <button 
                    onClick={() => navigate(`/admin/leads/${lead.id || (lead as any)._id}`)}
                    className="w-full py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded hover:bg-slate-50 transition-colors text-center"
                  >
                    View Customer Profile
                  </button>
                )}
              </div>
            </div>
          ))}
          {hasMore && filtered.length > 0 && (
            <div ref={loaderRef} className="col-span-full">
              <InfiniteScrollSpinner text="Loading more leads..." />
            </div>
          )}
        </div>
      )}

      {/* Modal: Assign Lead */}
      {assignLead && (
        <Modal
          open={!!assignLead}
          onClose={() => { setAssignLead(null); setSelectedStaffId(''); setReassignNote(''); }}
          title={`Assign Representative — ${assignLead.displayId || assignLead.customerName}`}
          size="md"
          footer={
            <>
              <button 
                onClick={() => { setAssignLead(null); setSelectedStaffId(''); setReassignNote(''); }} 
                className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleAssignLead}
                className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
              >
                Save
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select which sales representative will handle lead follow-up, coordinate plot site visits, and manage document conversion.
            </p>

            {/* Display Prior Follow-up History if any */}
            {assignLead.followUps && assignLead.followUps.length > 0 && (
              <div className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Prior Follow-up History ({assignLead.followUps.length})</h4>
                <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                  {assignLead.followUps.map((fu: any) => (
                    <div key={fu.id} className="text-xs border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                        <span>{formatDate(fu.date)}</span>
                        <span className="bg-slate-200 text-slate-700 px-1 rounded-sm">{fu.outcome}</span>
                      </div>
                      <p className="text-slate-700 font-medium">{fu.notes}</p>
                      {fu.nextAction && <p className="text-[10px] text-slate-400 mt-0.5">Next: {fu.nextAction}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Staff Representative</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all"
              >
                <option value="">Choose representative...</option>
                {activeStaffUsers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Assignment/Reassignment Note</label>
              <textarea
                value={reassignNote}
                onChange={e => setReassignNote(e.target.value)}
                placeholder="Enter context, transfer reasons, or instructions for the representative..."
                className="w-full p-2.5 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all resize-none h-20"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Create/Intake Lead */}
      {createOpen && (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Add New Lead & Customer Booking"
          size="md"
          footer={
            <>
              <button 
                onClick={() => setCreateOpen(false)} 
                className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateLead}
                className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
              >
                Create Lead
              </button>
            </>
          }
        >
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {formError && (
              <div className="mb-4 p-3 bg-red-55 border border-red-200 text-red-650 rounded text-xs font-bold">
                ⚠️ {formError}
              </div>
            )}
            
            {/* Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer Name <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={cName}
                  onChange={e => setCName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Phone Number <span className="text-red-500 font-bold">*</span>
                  {checkingPhone && <span className="ml-2 text-[10px] text-blue-500 font-normal">Checking availability...</span>}
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="Enter phone number"
                  value={cPhone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  className={`w-full h-9 px-3 border rounded text-xs outline-none transition-all bg-white ${
                    duplicateLead ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 focus:border-brand-green'
                  }`}
                />
              </div>

              {duplicateLead && (
                <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-2 text-amber-900 shadow-sm animate-fadeIn">
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
                        <span className="text-slate-500 font-medium">Customer:</span>{' '}
                        <NameTag name={duplicateLead.customerName} displayId={duplicateLead.displayId} className="font-bold text-slate-900" />
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
                      <span className="font-semibold text-slate-800">
                        {(() => {
                          const rep = resolveLeadRep(duplicateLead as any, staffUsers);
                          if (!rep) return 'Unassigned';
                          return rep.name && rep.displayId ? `${rep.name} (${rep.displayId})` : (rep.name || rep.displayId);
                        })()}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800 font-medium italic">
                    Click "Clear Number" above to enter a new mobile number.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Address <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={cEmail}
                  onChange={e => setCEmail(e.target.value.toLowerCase())}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">City</label>
                <input
                  type="text"
                  placeholder="Enter city"
                  value={cCity}
                  onChange={e => setCCity(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gender <span className="text-red-500">*</span></label>
                <select
                  value={cGender}
                  onChange={e => setCGender(e.target.value as 'Male' | 'Female' | 'Other')}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all cursor-pointer font-medium"
                  required
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date of Birth</label>
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
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Source Type</label>
                <select
                  value={cSourceType}
                  onChange={e => {
                    const val = e.target.value;
                    setCSourceType(val);
                    setCSourceName('');
                    if (val === 'Staff') {
                      setCStatus('Open');
                    }
                  }}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value="Direct">Direct</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Website">Website</option>
                  <option value="Leads Portal">Leads Portal</option>
                  <option value="Own Client">Own Client</option>
                  <option value="Channel Partner">Channel Partner</option>
                  <option value="Staff">Staff</option>
                  <option value="Office Referral">Office Referral</option>
                  <option value="Client Referral">Client Referral</option>
                </select>
              </div>
            </div>

            {/* Conditionally Render Source Name / Staff / CP selection */}
            {cSourceType === 'Staff' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Staff Member (Source) <span className="text-red-500">*</span></label>
                <select
                  value={cSourceName}
                  onChange={e => setCSourceName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value="">Choose Staff Member...</option>
                  {activeStaffUsers.map(s => (
                    <option key={s.id || (s as any)._id} value={s.name}>{s.name}{s.displayId ? ` [${s.displayId}]` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {cSourceType === 'Channel Partner' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Channel Partner (Source) <span className="text-red-500">*</span></label>
                <select
                  value={cSourceName}
                  onChange={e => setCSourceName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value="">Choose Channel Partner...</option>
                  {channelPartners.map(cp => (
                    <option key={cp.id || (cp as any)._id} value={cp.name}>{cp.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(cSourceType === 'Office Referral' || cSourceType === 'Client Referral') && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Referral Source Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Enter referrer name..."
                  value={cSourceName}
                  onChange={e => setCSourceName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all bg-white"
                />
              </div>
            )}

            {/* Assignments & Status */}
            <div className={`grid grid-cols-1 ${cSourceType !== 'Staff' ? 'sm:grid-cols-2' : ''} gap-3 mb-4`}>
              {cSourceType !== 'Staff' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status Phase</label>
                  <select
                    value={cStatus}
                    onChange={e => setCStatus(e.target.value as LeadStatus)}
                    className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
                  >
                    <option value="Open">Open Lead</option>
                    <option value="Qualified">Qualified Lead</option>
                    <option value="Unqualified">Unqualified</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Assign Representative</label>
                <select
                  value={cAssigneeId}
                  onChange={e => setCAssigneeId(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value="">Choose Staff...</option>
                  {activeStaffUsers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.displayId ? ` [${s.displayId}]` : ''} — {s.designation}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferred Project */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Preferred Project</label>
              <select
                value={cProjectId}
                onChange={e => setCProjectId(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
              >
                <option value="">General (No specific project)</option>
                {projects.filter(p => isProjectSelectableForNewLead(p, cProjectId)).map(p => (
                  <option key={getProjectId(p)} value={getProjectId(p)}>{p.name}{p.displayId ? ` [${p.displayId}]` : ''}</option>
                ))}
              </select>
            </div>

            {/* Budget & Category (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Budget (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ₹50,00,000 or 50 Lakhs"
                  value={cBudget}
                  onChange={e => setCBudget(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Category (Optional)</label>
                <select
                  value={cCategory}
                  onChange={e => setCCategory(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
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
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Note</label>
              <textarea
                placeholder="Submit notes or special requirements..."
                value={cNotes}
                onChange={e => setCNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs focus:border-brand-green outline-none transition-all resize-none bg-white"
              />
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmUnqualify}
        onClose={() => setConfirmUnqualify(null)}
        onConfirm={handleMarkUnqualified}
        title="Mark Lead as Unqualified?"
        message="This lead will be moved to the Unqualified tab and removed from active pipelines. This action can be reversed by re-opening the lead."
        confirmLabel="Mark Unqualified"
      />

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
