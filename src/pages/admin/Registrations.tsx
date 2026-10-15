import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Phone, Calendar, FileCheck, ChevronLeft, ChevronRight, Pencil, Building2, ArrowUpDown, Home, X, MapPin, AlertTriangle, Clock, SlidersHorizontal } from 'lucide-react';
import { Drawer } from '@/components/shared/Drawer';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/shared/Avatar';
import { Modal } from '@/components/shared/Modal';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { FollowerAutocomplete } from '@/components/shared/FollowerAutocomplete';
import { plotService, projectService, leadService, userService, taskService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { toast } from 'sonner';
import { getTodayStr } from '@/lib/utils';
import {
  relatedExtraFromPlot,
  asEntityId,
  formatBookingSelectLabel,
  resolveProjectForPlot,
  unionMergeByKeys,
  mergePlotCustomerRows,
  customerIdentityKeys,
} from '@/lib/customerBookingRows';
import type { Plot, Project } from '@/types';

/* ─── constants ─── */
type TabType = 'registered' | 'upcoming';
type SortOption = 'newest' | 'oldest' | 'customer_name' | 'expected_date';

const TABS: { key: TabType; label: string }[] = [
  { key: 'registered', label: 'Registered' },
  { key: 'upcoming', label: 'Upcoming' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'customer_name', label: 'Customer Name (A-Z)' },
  { value: 'expected_date', label: 'Expected Date' },
];

type LeadLike = { displayId?: string; customerName?: string; phone?: string; _id?: string; id?: string } | null;

function normPhone10(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

function plotRecordId(plot: Plot): string {
  return asEntityId(plot.id || (plot as { _id?: string })._id);
}

function uniquePlotsById(list: Plot[]): Plot[] {
  const seen = new Set<string>();
  const out: Plot[] = [];
  list.forEach((p) => {
    const id = plotRecordId(p);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(p);
  });
  return out;
}

function plotsForEditModal(source: Plot[], current: Plot, _tab?: TabType): Plot[] {
  return uniquePlotsById([current, ...source]).filter((p) =>
    ['Booked', 'Registered', 'Pending'].includes(p.status)
  );
}

function resolveCustomerDisplayId(
  plot: Plot,
  matchedLead: LeadLike,
  displayIdByPhone: Map<string, string>,
): string | undefined {
  const direct =
    matchedLead?.displayId ||
    (plot as { leadInfo?: { displayId?: string } }).leadInfo?.displayId;
  if (direct) return direct;

  const phone =
    plot.bookedBy?.phone ||
    matchedLead?.phone ||
    (plot as { leadInfo?: { phone?: string } }).leadInfo?.phone;
  const key = normPhone10(phone);
  if (key && displayIdByPhone.has(key)) return displayIdByPhone.get(key);
  return undefined;
}

interface Filters {
  search: string;
  projectFilter: string;
  paymentMethodFilter: string;
  paymentStatusFilter: string;
  bankFilter: string;
  bookedByFilter: string;
  loanStageFilter: string;
  sortBy: SortOption;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  projectFilter: 'All',
  paymentMethodFilter: 'All',
  paymentStatusFilter: 'All',
  bankFilter: 'All',
  bookedByFilter: 'All',
  loanStageFilter: 'All',
  sortBy: 'newest',
  dateFrom: '',
  dateTo: '',
};

const LOAN_STAGES = [
  'Not Applied',
  'Documentation Pending',
  'Applied',
  'In Progress',
  'Sanctioned',
  'Disbursed',
  'Rejected',
];

const getLoanStageBadgeClass = (stage?: string) => {
  switch (stage) {
    case 'Sanctioned':
    case 'Disbursed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'In Progress':
    case 'Applied':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Documentation Pending':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

/* ─── helpers ─── */
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0];
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr.split('T')[0] || '—';
  }
};

const formatSource = (sourceType?: string, source?: string) => {
  if (!sourceType && !source) return '—';
  if (sourceType && source) return `${sourceType} (${source})`;
  return sourceType || source || '—';
};

const getDaysPassedFromBooking = (plot: Plot, matchedLead?: any): number | null => {
  let bookingDateStr: string | undefined = undefined;

  if (plot.bookedBy?.bookingDate) bookingDateStr = String(plot.bookedBy.bookingDate);
  else if (plot.bookedBy?.bookedAt) bookingDateStr = String(plot.bookedBy.bookedAt);
  else if (plot.bookedBy?.date) bookingDateStr = String(plot.bookedBy.date);
  else if ((plot as any).bookedDate) bookingDateStr = String((plot as any).bookedDate);

  if (!bookingDateStr && plot.timeline && Array.isArray(plot.timeline)) {
    const bookingEvt = plot.timeline.find((t: any) =>
      t.type === 'plot_booked' ||
      t.type === 'booking_confirmed' ||
      t.type === 'booking_requested' ||
      (t.label && t.label.toLowerCase().includes('book'))
    );
    if (bookingEvt?.date) bookingDateStr = String(bookingEvt.date);
  }

  if (!bookingDateStr && matchedLead?.dateAdded) bookingDateStr = String(matchedLead.dateAdded);
  if (!bookingDateStr && matchedLead?.createdAt) bookingDateStr = String(matchedLead.createdAt);
  if (!bookingDateStr && (plot as any).createdAt) bookingDateStr = String((plot as any).createdAt);

  if (!bookingDateStr) return null;

  try {
    const bDate = new Date(bookingDateStr.split('T')[0]);
    if (isNaN(bDate.getTime())) return null;
    const today = new Date();
    bDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - bDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  } catch {
    return null;
  }
};

const isMongoHexId = (val?: any): boolean => {
  if (!val) return false;
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
};

interface ResolvedStaff {
  name: string;
  displayId?: string;
}

const resolveAssignedStaff = (
  plot: Plot,
  matchedLead?: any,
  users?: { id: string; name: string; displayId?: string; role: string }[]
): ResolvedStaff => {
  let name = '';
  let displayId = '';

  // 1. Direct bookedBy staff info
  const bStaffName = plot.bookedBy?.staffName?.trim();
  const bStaffDisplay = plot.bookedBy?.staffDisplayId?.trim();
  if (bStaffName && !isMongoHexId(bStaffName)) {
    name = bStaffName;
  }
  if (bStaffDisplay && !isMongoHexId(bStaffDisplay)) {
    displayId = bStaffDisplay;
  }

  // 2. Direct assignedToName on plot
  const pAssignedName = (plot as any).assignedToName?.trim();
  const pAssignedDisplay = (plot as any).assignedToDisplayId?.trim();
  if (!name && pAssignedName && !isMongoHexId(pAssignedName)) {
    name = pAssignedName;
  }
  if (!displayId && pAssignedDisplay && !isMongoHexId(pAssignedDisplay)) {
    displayId = pAssignedDisplay;
  }

  // 3. Matched lead staff info
  const lStaffName = matchedLead?.assignedToName?.trim();
  const lStaffDisplay = matchedLead?.assignedToDisplayId?.trim();
  if (!name && lStaffName && !isMongoHexId(lStaffName)) {
    name = lStaffName;
  }
  if (!displayId && lStaffDisplay && !isMongoHexId(lStaffDisplay)) {
    displayId = lStaffDisplay;
  }

  // 4. Candidate user IDs lookup in users (matching by ObjectId, displayId, or id)
  const candidateIds = [
    plot.assignedTo,
    plot.bookedBy?.staffId,
    matchedLead?.assignedTo,
    displayId,
  ].filter(Boolean).map(id => String(id).trim());

  if (users && users.length > 0) {
    for (const cand of candidateIds) {
      const found = users.find(u =>
        String(u.id) === cand ||
        (u.displayId && u.displayId.toUpperCase() === cand.toUpperCase())
      );
      if (found) {
        if (!name && found.name && !isMongoHexId(found.name)) {
          name = found.name.trim();
        }
        if (!displayId && found.displayId) {
          displayId = found.displayId.trim();
        }
      }
    }
  }

  // 5. If name is still missing, but displayId is like "STAFF-1", try searching users by displayId
  if (!name && displayId && users && users.length > 0) {
    const foundByDisplay = users.find(u => u.displayId && u.displayId.toUpperCase() === displayId.toUpperCase());
    if (foundByDisplay && foundByDisplay.name && !isMongoHexId(foundByDisplay.name)) {
      name = foundByDisplay.name.trim();
    }
  }

  // 6. Fallback if name is raw assigned string (non-hex, not STAFF-)
  const rawAssigned = String(plot.assignedTo || '').trim();
  if (!name && rawAssigned && !isMongoHexId(rawAssigned) && !rawAssigned.toUpperCase().startsWith('STAFF-')) {
    name = rawAssigned;
  }

  // Safety: never return raw hex as displayId or name
  if (isMongoHexId(name)) name = '';
  if (isMongoHexId(displayId)) displayId = '';

  return { name, displayId: displayId || undefined };
};

/* ─── component ─── */
export default function AdminRegistrations() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, userId, user } = useAuth();

  /* ── tabs & filter state ── */
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const search = location.search || (typeof window !== 'undefined' ? window.location.search : '');
    const p = new URLSearchParams(search).get('tab');
    if (p === 'upcoming' || p === 'registered') return p as TabType;
    return 'registered';
  });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Edit payment status modal state for registered tab
  const [editingPaymentPlot, setEditingPaymentPlot] = useState<Plot | null>(null);
  const [editPaymentStatusVal, setEditPaymentStatusVal] = useState<string>('Fully Paid');
  const [savingPaymentStatus, setSavingPaymentStatus] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab') as TabType;
    const fromDateParam = params.get('fromDate') || params.get('dateFrom');
    const toDateParam = params.get('toDate') || params.get('dateTo');
    const paymentStatusParam = params.get('paymentStatus');

    if (tabParam === 'upcoming' || tabParam === 'registered') {
      setActiveTab(tabParam);
    }
    if (fromDateParam || toDateParam || paymentStatusParam) {
      setFilters(prev => ({
        ...prev,
        dateFrom: fromDateParam || prev.dateFrom,
        dateTo: toDateParam || prev.dateTo,
        paymentStatusFilter: paymentStatusParam === 'pending' || paymentStatusParam === 'not_fully_paid' ? 'Pending Payment' : (paymentStatusParam || prev.paymentStatusFilter),
      }));
    }
  }, [location.search]);

  const debouncedSearch = useDebounce(filters.search, 500);

  const committedFilters = useMemo<Filters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  /* ── data state ── */
  const [plots, setPlots] = useState<Plot[]>([]);
  const [allBanks, setAllBanks] = useState<string[]>([]);
  const [allPlots, setAllPlots] = useState<Plot[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; displayId?: string; role: string }[]>([]);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<{ phone: string; name: string } | null>(null);

  /* ── confirm registration modal states ── */
  const [confirmingRegPlot, setConfirmingRegPlot] = useState<Plot | null>(null);
  const [confirmRegDate, setConfirmRegDate] = useState(() => getTodayStr());
  const [submittingConfirmReg, setSubmittingConfirmReg] = useState(false);

  /* ── stable refs ── */
  const plotsRef = useRef<Plot[]>([]);
  plotsRef.current = plots;
  const filtersRef = useRef(committedFilters);
  filtersRef.current = committedFilters;
  const roleRef = useRef(role);
  roleRef.current = role;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  /* ── fetch projects & all plots ── */
  useEffect(() => {
    projectService.getAll({ limit: 100 }).then(res => {
      setAllProjects((res.data || []).map((p: any) => ({
        id: p.id || p._id,
        _id: p.id || p._id,
        name: p.name,
        displayId: p.displayId,
        location: p.location,
        surveyNumber: p.surveyNumber
      })));
    }).catch(() => {});

    plotService.getAll({ limit: 500 }).then(res => {
      if (res.data) setAllPlots(res.data);
    }).catch(() => {});

    leadService.getAll({ limit: 500 }).then(res => {
      if (res.data) setAllLeads(res.data);
    }).catch(() => {});

    Promise.all([
      userService.getAll({ role: 'admin', limit: 100 }).catch(() => ({ data: [] })),
      userService.getAll({ role: 'staff', limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([adminRes, staffRes]) => {
      const admins = (adminRes.data || []).map((u: any) => ({ id: String(u.id || u._id), name: u.name || '', displayId: u.displayId || '', role: 'admin' }));
      const staff = (staffRes.data || []).map((u: any) => ({ id: String(u.id || u._id), name: u.name || '', displayId: u.displayId || '', role: 'staff' }));
      setAllUsers([...admins, ...staff]);
    });
  }, []);

  const getLeadForPlot = useCallback((plot: Plot) => {
    const custName = plot.bookedBy?.name || (plot as any).leadInfo?.customerName || '';
    const custPhone = plot.bookedBy?.phone || (plot as any).leadInfo?.phone || '';
    const bLeadId = plot.bookedBy?.leadId || (plot as any).leadId || (plot as any).leadInfo?._id;

    if (bLeadId) {
      const found = allLeads.find(l => String(l.id || l._id) === String(bLeadId));
      if (found) return found;
    }
    const phone10 = custPhone ? normPhone10(custPhone) : '';
    if (phone10) {
      const matches = allLeads.filter(
        (l) => l.phone && normPhone10(l.phone) === phone10,
      );
      if (matches.length) {
        return matches.find((l) => l.displayId) || matches[0];
      }
    }
    if (custName) {
      const found = allLeads.find(l => l.customerName && l.customerName.toLowerCase().trim() === custName.toLowerCase().trim());
      if (found) return found;
    }

    if ((plot as any).leadInfo) {
      const info = (plot as any).leadInfo;
      const fromList = bLeadId ? allLeads.find(l => String(l.id || l._id) === String(bLeadId)) : null;
      return fromList
        ? { ...info, ...fromList, displayId: fromList.displayId || info.displayId }
        : info;
    }
    return null;
  }, [allLeads]);

  /** Same customer on multiple plots: share one L- ID when any row/plot has it */
  const customerDisplayIdByPhone = useMemo(() => {
    const map = new Map<string, string>();
    const add = (phone?: string, displayId?: string) => {
      if (!displayId) return;
      const key = normPhone10(phone);
      if (key) map.set(key, displayId);
    };

    allLeads.forEach((l) => add(l.phone, l.displayId));
    const ingestPlot = (p: Plot) => {
      const info = (p as { leadInfo?: { phone?: string; displayId?: string } }).leadInfo;
      add(p.bookedBy?.phone, info?.displayId);
      add(info?.phone, info?.displayId);
    };
    plots.forEach(ingestPlot);
    allPlots.forEach(ingestPlot);
    return map;
  }, [allLeads, plots, allPlots]);

  /* ── stable fetch ── */
  const fetchPlots = useCallback(async (p = 1, { replace = true, showRefreshing = false } = {}) => {
    const f = filtersRef.current;
    const tab = activeTabRef.current;
    const isStaff = roleRef.current === 'staff';

    if (showRefreshing && plotsRef.current.length > 0) setRefreshing(true);
    else setLoading(true);

    try {
      const params: Record<string, any> = { page: p, limit: 10 };

      if (tab === 'registered') {
        params.status = 'Registered';
      } else {
        params.status = 'Booked';
      }

      if (f.projectFilter !== 'All') params.projectId = f.projectFilter;
      if (f.paymentMethodFilter !== 'All') params['bookedBy.paymentMethod'] = f.paymentMethodFilter;
      if (f.paymentMethodFilter === 'LOAN' && f.bankFilter && f.bankFilter !== 'All') {
        params['bookedBy.bank'] = f.bankFilter;
      }
      if (f.search) params.search = f.search;
      params.groupBy = 'customer';


      if (f.sortBy) {
        if (f.sortBy === 'oldest') params.sort = 'createdAt';
        else if (f.sortBy === 'customer_name') params.sort = 'bookedBy.name';
        else params.sort = '-createdAt';
      }

      if (f.dateFrom || f.dateTo) {
        const dateField = tab === 'registered' ? 'registrationDate' : 'expectedRegistrationDate';
        if (f.dateFrom) params[`${dateField}[gte]`] = f.dateFrom;
        if (f.dateTo) params[`${dateField}[lte]`] = f.dateTo;
      }

      if (f.paymentStatusFilter !== 'All') {
        params.paymentStatusFilter = f.paymentStatusFilter;
      }

      let res: any;
      if (isStaff) {
        params.assignedTo = userIdRef.current;
        res = await plotService.getMyBookings(params);
      } else {
        res = await plotService.getAll(params);
      }

      // Discard stale response if active tab changed while request was in-flight
      if (activeTabRef.current !== tab) return;

      const rawData = (res?.data || []) as Plot[];
      const data = rawData.filter(item => {
        const itemStatus = item.status || (item.registrationDate ? 'Registered' : 'Booked');
        return tab === 'registered' ? itemStatus === 'Registered' : itemStatus === 'Booked';
      });
      setPlots(prev => {
        const combined = replace ? data : [...prev, ...data];
        const seenIds = new Set<string>();
        return combined.filter(p => {
          const pid = String(p.id || (p as any)._id || '');
          if (!pid || seenIds.has(pid)) return false;
          seenIds.add(pid);
          return true;
        });
      });
      const totalCount = res?.total ?? res?.count ?? data.length;
      setTotal(totalCount);
      setTotalPages(Math.max(1, Math.ceil(totalCount / 10)));
      setPage(p);

      const banks = data.map((p: any) => p.bookedBy?.bank).filter((b: string | undefined) => !!b && !!b.trim());
      setAllBanks(prev => Array.from(new Set([...prev, ...banks])).sort());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allUsers]);

  useEffect(() => {
    if (activeTab === 'registered' && filters.sortBy === 'expected_date') {
      setFilters(prev => ({ ...prev, sortBy: 'newest' }));
    }
  }, [activeTab, filters.sortBy]);

  useEffect(() => {
    fetchPlots(1);
  }, [activeTab, committedFilters, fetchPlots]);

  /* ── multi-booking helpers ── */
  const getCustomerBookedPlots = useCallback((customerName?: string, phone?: string, leadId?: string) => {
    const nameLower = customerName?.toLowerCase().trim() || '';
    const phone10 = normPhone10(phone);
    const lid = asEntityId(leadId);
    if (!nameLower && !phone10 && !lid) return [];

    const pool = uniquePlotsById([...plots, ...allPlots]);
    return pool.filter(p => {
      const pLead = asEntityId(p.bookedBy?.leadId);
      const pPhone = normPhone10(p.bookedBy?.phone || (p as any).leadInfo?.phone);
      const pName = (p.bookedBy?.name || (p as any).leadInfo?.customerName || '').toLowerCase().trim();
      const pDisplay = ((p as any).leadInfo?.displayId || '').toUpperCase().trim();
      
      const match = (lid && pLead && pLead === lid)
        || (phone10 && pPhone && pPhone === phone10)
        || (nameLower && pName && pName === nameLower);
        // Note: we don't have displayId from the arguments here, but we check name correctly now.
        
      return Boolean(match);
    });
  }, [allPlots, plots]);

  const getCustomerProjects = useCallback((customerName?: string, phone?: string) => {
    const custPlots = getCustomerBookedPlots(customerName, phone);
    const projMap = new Map<string, { project: any; latestPlotNumber: string }>();

    custPlots.forEach(p => {
      const pid = typeof p.projectId === 'object' ? (p.projectId as any)._id || (p.projectId as any).id : p.projectId;
      if (pid && !projMap.has(String(pid))) {
        const found = allProjects.find(pr => String(pr.id || pr._id) === String(pid));
        if (found) {
          projMap.set(String(pid), { project: found, latestPlotNumber: String(p.plotNumber) });
        }
      }
    });

    return Array.from(projMap.values());
  }, [getCustomerBookedPlots, allProjects]);

  const getCustomerTabBookings = useCallback(
    (customerName?: string, phone?: string) => {
      const plots = getCustomerBookedPlots(customerName, phone);
      if (activeTab === 'registered') return plots.filter((p) => p.status === 'Registered');
      if (activeTab === 'upcoming') return plots.filter((p) => p.status === 'Booked');
      return plots;
    },
    [getCustomerBookedPlots, activeTab]
  );

  const goToRegistrationDetail = useCallback(
    (plot: Plot, matchedLead: LeadLike) => {
      const plotId = asEntityId(plot.id || (plot as { _id?: string })._id);
      const leadId =
        asEntityId(matchedLead?.id) ||
        asEntityId(matchedLead?._id) ||
        asEntityId(plot.bookedBy?.leadId) ||
        asEntityId((plot as { leadInfo?: { _id?: string; id?: string } }).leadInfo?._id) ||
        asEntityId((plot as { leadInfo?: { _id?: string; id?: string } }).leadInfo?.id) ||
        plotId;
      const phone =
        String(plot.bookedBy?.phone || (plot as { leadInfo?: { phone?: string } }).leadInfo?.phone || matchedLead?.phone || '')
          .replace(/\D/g, '')
          .slice(-10);
      const qs = new URLSearchParams({ tab: activeTab, plotId });
      if (phone.length === 10) qs.set('phone', phone);
      navigate(`/${role}/registrations/${leadId}?${qs.toString()}`);
    },
    [navigate, role, activeTab]
  );

  /* ── client filter & sort ── */
  /* ── filtered list returned directly from DB ── */
  const filtered = useMemo(() => {
    // Deduplicate by plot ID first
    const seenIds = new Set<string>();
    let result = plots.filter(p => {
      const pid = String(p.id || (p as any)._id || '');
      if (!pid || seenIds.has(pid)) return false;
      seenIds.add(pid);
      return true;
    });

    // Strictly enforce active tab status: Registered plots NEVER show in Upcoming, and Booked plots NEVER show in Registered
    result = result.filter(p => {
      const pStatus = p.status || (p.registrationDate ? 'Registered' : (p.expectedRegistrationDate ? 'Booked' : ''));
      if (activeTab === 'registered') return pStatus === 'Registered';
      if (activeTab === 'upcoming') return pStatus === 'Booked';
      return true;
    });

    // Text search runs on the server (name, phone, project, customer ID L-912 / 912).
    // Client re-filter was dropping rows (e.g. multi-plot customers missing displayId on one row).

    // Payment status is filtered server-side via paymentStatusFilter param

    if (filters.dateFrom || filters.dateTo) {
      result = result.filter(p => {
        const rawDate = activeTab === 'registered' ? p.registrationDate : p.expectedRegistrationDate;
        if (!rawDate) return false;
        const dStr = String(rawDate).split('T')[0];
        if (filters.dateFrom && dStr < filters.dateFrom) return false;
        if (filters.dateTo && dStr > filters.dateTo) return false;
        return true;
      });
    }

    // Apply Booked By filter
    if (filters.bookedByFilter !== 'All') {
      const filterVal = filters.bookedByFilter.toLowerCase().trim();
      const targetUser = allUsers.find(u => u.name.toLowerCase().trim() === filterVal);
      const targetId = targetUser?.id ? String(targetUser.id).toLowerCase() : '';

      result = result.filter(plot => {
        const matchedLead = getLeadForPlot(plot);
        const assignedStaffObj = resolveAssignedStaff(plot, matchedLead, allUsers);
        const assignedToText = (assignedStaffObj.name ? `${assignedStaffObj.name} ${assignedStaffObj.displayId || ''}` : (assignedStaffObj.displayId || '')).toLowerCase().trim();

        const pAssignedTo = plot.assignedTo ? String(plot.assignedTo).toLowerCase().trim() : '';
        const pAssignedToName = (plot as any).assignedToName ? String((plot as any).assignedToName).toLowerCase().trim() : '';
        const lAssignedToId = matchedLead?.assignedTo ? String(matchedLead.assignedTo).toLowerCase().trim() : '';
        const lAssignedToDisplayId = matchedLead?.assignedToDisplayId ? String(matchedLead.assignedToDisplayId).toLowerCase().trim() : '';
        const lAssignedToName = matchedLead?.assignedToName ? String(matchedLead.assignedToName).toLowerCase().trim() : '';

        return (
          assignedToText.includes(filterVal) ||
          (targetId && (pAssignedTo === targetId || lAssignedToId === targetId)) ||
          (pAssignedTo && pAssignedTo === filterVal) ||
          (pAssignedToName && pAssignedToName === filterVal) ||
          (lAssignedToDisplayId && lAssignedToDisplayId === filterVal) ||
          (lAssignedToName && lAssignedToName === filterVal)
        );
      });
    }
    if (filters.loanStageFilter !== 'All') {
      result = result.filter(plot => {
        const matchedLead = getLeadForPlot(plot);
        const stage = plot.bookedBy?.loanStage || matchedLead?.loanStage || 'Not Applied';
        return stage === filters.loanStageFilter;
      });
    }

    const todayStr = getTodayStr();

    // Get expected reg date for sorting (works for both tabs)
    const getExpDate = (p: Plot): string => {
      const d = p.expectedRegistrationDate ? String(p.expectedRegistrationDate).split('T')[0] : '';
      return d;
    };

    const urgencyScore = (p: Plot): number => {
      const d = getExpDate(p);
      if (!d) return 9999;
      if (d < todayStr) {
        // Past overdue: highest priority, most overdue first
        const diffDays = Math.floor((new Date(todayStr).getTime() - new Date(d).getTime()) / (1000 * 3600 * 24));
        return -10000 + diffDays;
      }
      const diffFuture = Math.floor((new Date(d).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
      return diffFuture;
    };

    // One customer row: extra plots AND extra projects show as +N, not extra table rows.
    result = unionMergeByKeys(
      result,
      (p) => {
        const lead = getLeadForPlot(p);
        const info = (p as { leadInfo?: { phone?: string; displayId?: string; customerName?: string } }).leadInfo;
        return customerIdentityKeys({
          name: p.bookedBy?.name || lead?.customerName || info?.customerName,
          phone: p.bookedBy?.phone || lead?.phone || info?.phone,
          displayId: lead?.displayId || info?.displayId || customerDisplayIdByPhone.get(normPhone10(p.bookedBy?.phone || lead?.phone || info?.phone)),
          leadId: asEntityId(p.bookedBy?.leadId || lead?.id || lead?._id || (info as any)?._id),
        });
      },
      (existing, next) => mergePlotCustomerRows(existing, next, (a, b) => {
        if (activeTab === 'registered') {
          const existingDate = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
          const newDate = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
          return newDate > existingDate ? b : a;
        }
        const aCount = (a as Plot & { relatedBookingCount?: number }).relatedBookingCount || 1;
        const bCount = (b as Plot & { relatedBookingCount?: number }).relatedBookingCount || 1;
        if (bCount > aCount) return b;
        return urgencyScore(b) < urgencyScore(a) ? b : a;
      })
    );

    // Apply sorting selection dynamically based on user choice
    const sortBy = filters.sortBy;
    if (sortBy === 'customer_name') {
      result.sort((a, b) => {
        const nameA = (a.bookedBy?.name || (a as any).leadInfo?.customerName || '').toLowerCase().trim();
        const nameB = (b.bookedBy?.name || (b as any).leadInfo?.customerName || '').toLowerCase().trim();
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => {
        const dateA = activeTab === 'registered' 
          ? (a.registrationDate ? new Date(a.registrationDate).getTime() : new Date((a as any).createdAt || 0).getTime())
          : (a.expectedRegistrationDate ? new Date(a.expectedRegistrationDate).getTime() : new Date((a as any).createdAt || 0).getTime());
        const dateB = activeTab === 'registered' 
          ? (b.registrationDate ? new Date(b.registrationDate).getTime() : new Date((b as any).createdAt || 0).getTime())
          : (b.expectedRegistrationDate ? new Date(b.expectedRegistrationDate).getTime() : new Date((b as any).createdAt || 0).getTime());
        return dateA - dateB;
      });
    } else if (sortBy === 'newest') {
      result.sort((a, b) => {
        const dateA = activeTab === 'registered' 
          ? (a.registrationDate ? new Date(a.registrationDate).getTime() : new Date((a as any).createdAt || 0).getTime())
          : (a.expectedRegistrationDate ? new Date(a.expectedRegistrationDate).getTime() : new Date((a as any).createdAt || 0).getTime());
        const dateB = activeTab === 'registered' 
          ? (b.registrationDate ? new Date(b.registrationDate).getTime() : new Date((b as any).createdAt || 0).getTime())
          : (b.expectedRegistrationDate ? new Date(b.expectedRegistrationDate).getTime() : new Date((b as any).createdAt || 0).getTime());
        return dateB - dateA;
      });
    } else if (sortBy === 'expected_date') {
      result.sort((a, b) => urgencyScore(a) - urgencyScore(b));
    } else {
      if (activeTab === 'upcoming') {
        result.sort((a, b) => urgencyScore(a) - urgencyScore(b));
      } else {
        result.sort((a, b) => {
          const dateA = a.registrationDate ? new Date(a.registrationDate).getTime() : new Date((a as any).createdAt || 0).getTime();
          const dateB = b.registrationDate ? new Date(b.registrationDate).getTime() : new Date((b as any).createdAt || 0).getTime();
          return dateB - dateA;
        });
      }
    }

    const collapsed = new Map<string, typeof result[0]>();
    result.forEach((p) => {
      const lead = getLeadForPlot(p);
      const info = (p as { leadInfo?: { phone?: string } }).leadInfo;
      const phone = normPhone10(p.bookedBy?.phone || lead?.phone || info?.phone);
      const displayId = (resolveCustomerDisplayId(p, lead, customerDisplayIdByPhone) || '').toUpperCase();
      const key = phone ? `p:${phone}` : displayId ? `d:${displayId}` : plotRecordId(p);
      const existing = collapsed.get(key);
      if (!existing) {
        collapsed.set(key, p);
        return;
      }
      collapsed.set(key, mergePlotCustomerRows(existing, p, (a, b) => a));
    });
    const byDisplay = new Map<string, typeof result[0]>();
    Array.from(collapsed.values()).forEach((p) => {
      const lead = getLeadForPlot(p);
      const displayId = (resolveCustomerDisplayId(p, lead, customerDisplayIdByPhone) || '').toUpperCase();
      const phone = normPhone10(p.bookedBy?.phone || lead?.phone || (p as { leadInfo?: { phone?: string } }).leadInfo?.phone);
      const key = displayId ? `d:${displayId}` : phone ? `p:${phone}` : plotRecordId(p);
      const existing = byDisplay.get(key);
      if (!existing) {
        byDisplay.set(key, p);
        return;
      }
      byDisplay.set(key, mergePlotCustomerRows(existing, p, (a, b) => a));
    });
    return Array.from(byDisplay.values());
  }, [plots, activeTab, filters.sortBy, debouncedSearch, allProjects, getLeadForPlot, customerDisplayIdByPhone]);

  /* ── per-row selected booking plot map ── */
  const [selectedPlotMap, setSelectedPlotMap] = useState<Record<string, string>>({});

  /* ── edit modal ── */
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [editCustomerPlots, setEditCustomerPlots] = useState<Plot[]>([]);
  const [editSelectedPlotId, setEditSelectedPlotId] = useState<string>('lead_default');
  const [editPlotsLoading, setEditPlotsLoading] = useState(false);
  const editPlotsLoadSeq = useRef(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState('Not Paid');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'LOAN'>('CASH');
  const [editInitialPaymentMethod, setEditInitialPaymentMethod] = useState<'CASH' | 'LOAN'>('CASH');
  const [editBank, setEditBank] = useState('');
  const [editBankFollowerName, setEditBankFollowerName] = useState('');
  const [editBankFollowerPhone, setEditBankFollowerPhone] = useState('');
  const [editLoanStage, setEditLoanStage] = useState('Not Applied');
  const [editDate, setEditDate] = useState('');
  const [editRegistrationDate, setEditRegistrationDate] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-complete datalists for Bank & Follower
  const existingBankFollowers = useMemo(() => {
    const map = new Map<string, { bank: string; name: string; phone: string }>();
    allPlots.forEach(p => {
      if (p.bookedBy?.bankFollowerName?.trim()) {
        const key = p.bookedBy.bankFollowerName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            bank: p.bookedBy.bank?.trim() || '',
            name: p.bookedBy.bankFollowerName.trim(),
            phone: p.bookedBy.bankFollowerPhone?.trim() || '',
          });
        }
      }
    });
    return Array.from(map.values());
  }, [allPlots]);

  const existingBanks = useMemo(() => {
    const set = new Set<string>();
    allPlots.forEach(p => {
      if (p.bookedBy?.bank?.trim()) set.add(p.bookedBy.bank.trim());
    });
    return Array.from(set);
  }, [allPlots]);

  const handleBankFollowerNameChange = (val: string) => {
    setEditBankFollowerName(val);
    const matched = existingBankFollowers.find(
      f => f.name.toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      if (matched.bank) setEditBank(matched.bank);
      if (matched.phone) setEditBankFollowerPhone(matched.phone);
    }
  };

  const handleBankChange = (val: string) => {
    setEditBank(val);
    const matchedFollowers = existingBankFollowers.filter(
      f => f.bank.toLowerCase() === val.trim().toLowerCase()
    );
    if (matchedFollowers.length === 1) {
      setEditBankFollowerName(matchedFollowers[0].name);
      if (matchedFollowers[0].phone) setEditBankFollowerPhone(matchedFollowers[0].phone);
    }
  };

  const handleSavePaymentStatus = async () => {
    if (!editingPaymentPlot) return;
    setSavingPaymentStatus(true);
    try {
      const plotId = editingPaymentPlot.id || (editingPaymentPlot as any)._id;
      const updatedBookedBy = editingPaymentPlot.bookedBy ? {
        ...editingPaymentPlot.bookedBy,
        paymentStatus: editPaymentStatusVal as any,
      } : { paymentStatus: editPaymentStatusVal as any };

      await plotService.update(plotId, { bookedBy: updatedBookedBy } as any);

      const matchedLead = getLeadForPlot(editingPaymentPlot);
      if (matchedLead) {
        const leadId = matchedLead.id || (matchedLead as any)._id;
        await leadService.update(leadId, { paymentStatus: editPaymentStatusVal } as any).catch(() => {});
      }

      toast.success('Payment status updated successfully!');
      setEditingPaymentPlot(null);
      void fetchPlots(page, { replace: true, showRefreshing: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment status');
    } finally {
      setSavingPaymentStatus(false);
    }
  };

  const handleConfirmRegisterPlot = async () => {
    if (!confirmingRegPlot) return;
    if (!confirmRegDate) {
      toast.error('Please select a registration date.');
      return;
    }
    setSubmittingConfirmReg(true);
    try {
      const plotId = confirmingRegPlot.id || (confirmingRegPlot as any)._id;

      await plotService.registerPlot(plotId, { registrationDate: confirmRegDate });

      // Resolve staff member assigned to this lead/customer
      let assigneeId: string | undefined = undefined;
      let assigneeInitials = 'AD';

      let targetLead: any = null;
      const leadIdCandidate = (confirmingRegPlot.bookedBy as any)?.leadId || (confirmingRegPlot.pendingApproval as any)?.leadId;

      if (leadIdCandidate) {
        try {
          const lRes = await leadService.getById(leadIdCandidate);
          targetLead = lRes.data || lRes;
        } catch (e) {}
      }

      if (!targetLead && plotId) {
        try {
          const lRes = await leadService.getAll({ plotId: plotId, limit: 1 });
          if (lRes.data && lRes.data.length > 0) targetLead = lRes.data[0];
        } catch (e) {}
      }

      if (targetLead && targetLead.assignedTo) {
        const rawAssignedTo = targetLead.assignedTo;
        const aId = typeof rawAssignedTo === 'object' && rawAssignedTo !== null
          ? (rawAssignedTo._id || rawAssignedTo.id)
          : rawAssignedTo;
        const aName = targetLead.assignedToName || (typeof rawAssignedTo === 'object' && rawAssignedTo !== null ? rawAssignedTo.name : undefined);

        if (aId) {
          assigneeId = String(aId);
          assigneeInitials = aName
            ? String(aName).split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2)
            : 'ST';
        }
      }

      if (!assigneeId) {
        const staffIdCandidate = confirmingRegPlot.assignedTo || (confirmingRegPlot.bookedBy as any)?.staffId;
        const staffNameCandidate = (confirmingRegPlot as any).assignedToName || (confirmingRegPlot.bookedBy as any)?.staffName;
        if (staffIdCandidate) {
          assigneeId = String(staffIdCandidate);
          assigneeInitials = staffNameCandidate
            ? String(staffNameCandidate).split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2)
            : 'ST';
        } else {
          assigneeId = user?.id;
          assigneeInitials = user?.initials || 'AD';
        }
      }

      const custName = confirmingRegPlot.bookedBy?.name || 'Customer';
      const pNum = confirmingRegPlot.plotNumber;
      const projId = confirmingRegPlot.projectId;

      const tasksToCreate = [
        {
          title: `Gift handover - Plot #${pNum}`,
          description: `Gift handover for customer ${custName} of Plot #${pNum}.`,
          status: 'To Do',
          priority: 'Medium',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: projId,
          customerName: custName,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Document handover - Plot #${pNum}`,
          description: `Document handover for customer ${custName} of Plot #${pNum}.`,
          status: 'To Do',
          priority: 'High',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: projId,
          customerName: custName,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Balance payment - Plot #${pNum}`,
          description: `Balance payment for customer ${custName} of Plot #${pNum}.`,
          status: 'To Do',
          priority: 'High',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: projId,
          customerName: custName,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Individual chitta and patta - Plot #${pNum}`,
          description: `Individual chitta and patta transfer for customer ${custName} of Plot #${pNum}.`,
          status: 'To Do',
          priority: 'Medium',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: projId,
          customerName: custName,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        }
      ];

      await Promise.allSettled(tasksToCreate.map(t => taskService.create(t as any)));

      toast.success('This plot is registered. Other bookings for this customer stay in Upcoming.');
      setConfirmingRegPlot(null);
      void fetchPlots(page, { replace: true, showRefreshing: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm registration');
    } finally {
      setSubmittingConfirmReg(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, plot: Plot) => {
    e.stopPropagation();
    setEditingPlot(plot);

    const pid = plotRecordId(plot);
    setEditSelectedPlotId(pid);

    setEditPaymentStatus(plot.bookedBy?.paymentStatus || 'Not Paid');
    const method = plot.bookedBy?.paymentMethod === 'LOAN' ? 'LOAN' : 'CASH';
    setEditPaymentMethod(method);
    setEditInitialPaymentMethod(method);
    setEditBank(plot.bookedBy?.bank ?? '');
    setEditBankFollowerName(plot.bookedBy?.bankFollowerName ?? '');
    setEditBankFollowerPhone(plot.bookedBy?.bankFollowerPhone ?? '');
    const matchedL = getLeadForPlot(plot);
    setEditLoanStage(plot.bookedBy?.loanStage || matchedL?.loanStage || 'Not Applied');

    const targetDate = activeTab === 'registered' ? plot.registrationDate : plot.expectedRegistrationDate;
    setEditDate(targetDate ? String(targetDate).split('T')[0] : '');
    setEditRegistrationDate(plot.registrationDate ? String(plot.registrationDate).split('T')[0] : '');

    const localSiblings = getCustomerBookedPlots(
      plot.bookedBy?.name,
      plot.bookedBy?.phone,
      asEntityId(plot.bookedBy?.leadId)
    );
    setEditCustomerPlots(plotsForEditModal(localSiblings, plot, activeTab));
    setEditModalOpen(true);

    const seq = ++editPlotsLoadSeq.current;
    setEditPlotsLoading(true);
    plotService.getCustomerBookings({
      plotId: pid || undefined,
      phone: plot.bookedBy?.phone || (plot as { leadInfo?: { phone?: string } }).leadInfo?.phone || undefined,
      leadId: asEntityId(plot.bookedBy?.leadId) || undefined,
    }).then((res) => {
      if (seq !== editPlotsLoadSeq.current) return;
      setEditCustomerPlots(plotsForEditModal(res.data || [], plot, activeTab));
    }).catch(() => {
      // Keep local siblings when the customer-bookings lookup fails.
    }).finally(() => {
      if (seq === editPlotsLoadSeq.current) setEditPlotsLoading(false);
    });
  };

  const handleSwitchEditBooking = (plotId: string) => {
    setEditSelectedPlotId(plotId);
    const target = editCustomerPlots.find(p => plotRecordId(p) === String(plotId));
    if (target) {
      setEditPaymentStatus(target.bookedBy?.paymentStatus || 'Not Paid');
      const method = target.bookedBy?.paymentMethod === 'LOAN' ? 'LOAN' : 'CASH';
      setEditPaymentMethod(method);
      setEditInitialPaymentMethod(method);
      setEditBank(target.bookedBy?.bank ?? '');
      setEditBankFollowerName(target.bookedBy?.bankFollowerName ?? '');
      setEditBankFollowerPhone(target.bookedBy?.bankFollowerPhone ?? '');
      const matchedL = getLeadForPlot(target);
      setEditLoanStage(target.bookedBy?.loanStage || matchedL?.loanStage || 'Not Applied');

      const targetDate = activeTab === 'registered' ? target.registrationDate : target.expectedRegistrationDate;
      setEditDate(targetDate ? String(targetDate).split('T')[0] : '');
      setEditRegistrationDate(target.registrationDate ? String(target.registrationDate).split('T')[0] : '');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPlot) return;

    const bName = editBank.trim();
    const bFollower = editBankFollowerName.trim();
    const bPhone = editBankFollowerPhone.trim();

    const hasAnyBankField = !!bName || !!bFollower || !!bPhone;
    const hasAllBankFields = !!bName && !!bFollower && !!bPhone;
    const switchedToLoan = editPaymentMethod === 'LOAN' && editInitialPaymentMethod !== 'LOAN';

    if (switchedToLoan && !hasAllBankFields) {
      toast.error('Bank Name, Follower Name, and Follower Mobile are required when switching to Loan payment mode.');
      return;
    }

    if (editPaymentMethod === 'LOAN') {
      if (hasAnyBankField && !hasAllBankFields) {
        toast.error('If filling Bank details, Bank Name, Follower Name, and Follower Mobile are all mandatory.');
        return;
      }

      if (bPhone) {
        const digits = bPhone.replace(/\D/g, '');
        if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
          toast.error('Please enter a valid 10-digit mobile number starting with 6-9 for Bank Follower.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const targetId = editSelectedPlotId !== 'lead_default' ? editSelectedPlotId : plotRecordId(editingPlot);
      const targetPlot = editCustomerPlots.find(p => plotRecordId(p) === String(targetId)) || editingPlot;

      const willRegister = activeTab === 'upcoming' && !!editRegistrationDate && targetPlot.status === 'Booked';

      await plotService.update(targetId, {
        ...targetPlot,
        ...(activeTab === 'registered'
          ? { registrationDate: editDate }
          : {
              expectedRegistrationDate: editDate,
              ...(editRegistrationDate ? { registrationDate: editRegistrationDate } : {}),
            }),
        bookedBy: {
          ...targetPlot.bookedBy,
          paymentStatus: editPaymentStatus,
          paymentMethod: editPaymentMethod,
          loanStage: editLoanStage,
          ...(editPaymentMethod === 'LOAN' ? {
            bank: bName,
            bankFollowerName: bFollower,
            bankFollowerPhone: bPhone,
          } : {}),
        },
      } as any);

      if (willRegister) {
        await plotService.registerPlot(targetId, {
          registrationDate: editRegistrationDate,
          paymentStatus: editPaymentStatus,
        }).catch(() => {});
      }

      const matchedLead = getLeadForPlot(editingPlot);
      if (matchedLead) {
        const leadId = matchedLead.id || (matchedLead as any)._id;
        await leadService.update(leadId, {
          paymentStatus: editPaymentStatus,
          paymentMethod: editPaymentMethod,
          loanStage: editLoanStage,
          ...(editPaymentMethod === 'LOAN' ? {
            bank: bName,
            bankFollowerName: bFollower,
            bankFollowerPhone: bPhone,
          } : {}),
        } as any).catch(() => {});
      }

      toast.success(
        willRegister
          ? 'This plot moved to Registered. Any other bookings for this customer stay in Upcoming.'
          : 'Updated successfully'
      );
      setEditModalOpen(false);
      setEditingPlot(null);

      const resAll = await plotService.getAll({ limit: 500 }).catch(() => ({ data: [] }));
      if (resAll.data) setAllPlots(resAll.data);
      fetchPlots(page, { replace: true, showRefreshing: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  /* ── helpers ── */
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const hasActiveFilters = committedFilters.projectFilter !== 'All' || committedFilters.paymentMethodFilter !== 'All' || committedFilters.paymentStatusFilter !== 'All' || committedFilters.bankFilter !== 'All' || committedFilters.bookedByFilter !== 'All' || committedFilters.loanStageFilter !== 'All' || committedFilters.sortBy !== 'newest' || !!committedFilters.dateFrom || !!committedFilters.dateTo;
  const activeFilterCount = [committedFilters.projectFilter !== 'All', committedFilters.paymentMethodFilter !== 'All', committedFilters.paymentStatusFilter !== 'All', committedFilters.bankFilter !== 'All', committedFilters.bookedByFilter !== 'All', committedFilters.loanStageFilter !== 'All', committedFilters.sortBy !== 'newest', !!committedFilters.dateFrom, !!committedFilters.dateTo].filter(Boolean).length;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    fetchPlots(p, { replace: true, showRefreshing: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  const showDateFilters = true;

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{role === 'staff' ? 'My Registrations' : 'Registrations'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total plots</p>
        </div>
      </div>

      {/* Tabs (admin only) */}
      {role !== 'staff' && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === activeTab) return;
                setActiveTab(tab.key);
                setPlots([]);
                setTotal(0);
                setTotalPages(1);
                setPage(1);
              }}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'upcoming' && role !== 'staff' && (
        <p className="text-xs text-slate-400 -mt-3">
          Plots that are booked with an expected registration date appear here.
        </p>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, Customer ID (L-...), Staff ID (STAFF-...), mobile, or project..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-lg text-sm focus:border-brand-green focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
            />
            {(refreshing || (filters.search !== debouncedSearch && filters.search.trim())) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!refreshing && filters.search === debouncedSearch && filters.search && (
              <button onClick={() => updateFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer relative"
              title="Open Side Filters Drawer"
            >
              <SlidersHorizontal size={14} className="text-brand-blue" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-brand-green text-white rounded-full text-[10px] font-extrabold flex items-center justify-center ml-1">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <ArrowUpDown size={14} className="text-slate-400 shrink-0 ml-1" />
            <select
              value={filters.sortBy}
              onChange={e => updateFilter('sortBy', e.target.value as SortOption)}
              className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all w-full sm:w-auto cursor-pointer"
            >
              {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
          <select
            value={filters.loanStageFilter}
            onChange={e => updateFilter('loanStageFilter', e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-amber-50/60 text-amber-900 border-amber-200 focus:border-brand-green outline-none cursor-pointer"
          >
            <option value="All">All Loan Stages</option>
            {LOAN_STAGES.filter(s => s !== 'All').map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>

          <select
            value={filters.projectFilter}
            onChange={e => updateFilter('projectFilter', e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
          >
            <option value="All">All Projects</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Payment Status Filter */}
          <select
            value={filters.paymentStatusFilter}
            onChange={e => updateFilter('paymentStatusFilter', e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Pending Payment">Not Fully Paid / Pending</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="Advance Paid">Advance Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Not Paid">Not Paid</option>
          </select>

          {/* Loan vs Ready Cash Filter */}
          <select
            value={filters.paymentMethodFilter}
            onChange={e => {
              const val = e.target.value;
              setFilters(prev => ({
                ...prev,
                paymentMethodFilter: val,
                ...(val !== 'LOAN' ? { bankFilter: 'All' } : {})
              }));
            }}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
          >
            <option value="All">All Payment Methods</option>
            <option value="LOAN">Bank Loan</option>
            <option value="CASH">Ready Cash</option>
          </select>

          {/* Conditional Bank Filter when Payment Method is LOAN */}
          {filters.paymentMethodFilter === 'LOAN' && (
            <select
              value={filters.bankFilter}
              onChange={e => updateFilter('bankFilter', e.target.value)}
              className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
            >
              <option value="All">All Banks</option>
              {allBanks.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          {/* Booked By filter — admin first, then staff */}
          {allUsers.length > 0 && (
            <select
              value={filters.bookedByFilter}
              onChange={e => updateFilter('bookedByFilter', e.target.value)}
              className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
            >
              <option value="All">All (Booked By)</option>
              {allUsers.filter(u => u.role === 'admin').length > 0 && (
                <optgroup label="── Admin ──">
                  {allUsers.filter(u => u.role === 'admin').map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </optgroup>
              )}
              {allUsers.filter(u => u.role === 'staff').length > 0 && (
                <optgroup label="── Staff ──">
                  {allUsers.filter(u => u.role === 'staff').map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}

          {showDateFilters && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">From:</span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => updateFilter('dateFrom', e.target.value)}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">To:</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => updateFilter('dateTo', e.target.value)}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>
            </>
          )}

          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors">
              <X size={13} /> Clear Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && plots.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="animate-pulse">
            <div className="h-12 bg-slate-100 border-b border-slate-200" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-slate-100">
                <div className="w-8 h-8 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/6" />
                </div>
                <div className="h-6 bg-slate-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FileCheck size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">
            {hasActiveFilters ? 'No records found matching filters' : activeTab === 'registered' ? 'No registered plots found' : 'No upcoming registrations found'}
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-brand-blue hover:underline mt-2 font-medium">Clear all filters</button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    {(activeTab === 'registered' ?
                      ['Customer & Contact', 'Property & Plot', 'Location & Source', 'Assigned To', 'Payment Method', 'Bank & Follower', 'Registration Date', 'Payment Status', 'Actions'] :
                      ['Customer & Contact', 'Property & Plot', 'Location & Source', 'Assigned To', 'Payment Method', 'Bank & Follower', 'Expected Reg. Date', 'Payment Status', 'Actions']
                    ).map(h => (
                      <th key={h} className="text-left px-4 py-3.5 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(plot => {
                    const pid = plot.id || (plot as any)._id;
                    const custName = plot.bookedBy?.name || (plot as any).leadInfo?.customerName || 'Customer';
                    const custPhone = plot.bookedBy?.phone || (plot as any).leadInfo?.phone || '';

                    const matchedLead = getLeadForPlot(plot);
                    const { extraCount, extraLabels } = relatedExtraFromPlot(plot as Plot & { relatedBookingCount?: number; relatedBookings?: { plotNumber?: string | number; projectName?: string; projectDisplayId?: string }[] });
                    const pProjId = typeof plot.projectId === 'object' ? (plot.projectId as any)._id : plot.projectId;
                    const projObj = (typeof plot.projectId === 'object' && (plot.projectId as any)?.name) ? plot.projectId : allProjects.find(pr => String(pr.id || pr._id) === String(pProjId));
                    const projName = projObj ? projObj.name : '—';
                    const projDisplayId = projObj ? (projObj.displayId || '') : '';
                    const plotNum = plot.plotNumber || '—';
                    const openDetail = () => goToRegistrationDetail(plot, matchedLead);
                    const expDate = plot.expectedRegistrationDate ? String(plot.expectedRegistrationDate).split('T')[0] : '';
                    const regDate = plot.registrationDate ? String(plot.registrationDate).split('T')[0] : '';
                    const todayStr = getTodayStr();
                    const isUpcomingPast = activeTab === 'upcoming' && !!expDate && expDate < todayStr;
                    const locationCity = matchedLead?.city || (plot as any).city || '—';
                    const leadSourceType = matchedLead?.sourceType || (plot as any).sourceType;
                    const leadSource = matchedLead?.source || (plot as any).source;
                    const formattedSource = formatSource(leadSourceType, leadSource);
                    const assignedStaff = resolveAssignedStaff(plot, matchedLead, allUsers);
                    const daysPassedFromBooking = getDaysPassedFromBooking(plot, matchedLead);

                    return (
                      <tr key={pid} className={`transition-colors cursor-pointer group ${isUpcomingPast ? 'bg-rose-50/40 hover:bg-rose-50/80 border-l-4 border-l-rose-500' : 'hover:bg-slate-50/70'}`}>
                        {/* 1. Customer & Contact */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={getInitials(custName)} size="sm" bg={getAvatarColor(custName)} />
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 group-hover:text-brand-blue transition-colors text-sm">
                                <NameTag name={custName} displayId={resolveCustomerDisplayId(plot, matchedLead, customerDisplayIdByPhone)} />
                              </span>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                                <Phone size={11} className="text-slate-400" />
                                <span>{custPhone || '—'}</span>
                                {custPhone && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setWhatsAppCustomer({ phone: custPhone, name: custName }); }}
                                    className="p-0.5 hover:bg-emerald-50 rounded text-emerald-600 transition-colors ml-1"
                                    title="Chat on WhatsApp"
                                  >
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.291 5.3 0 11.799 0c3.148.001 6.108 1.228 8.334 3.457 2.227 2.229 3.452 5.19 3.45 8.34-.004 6.502-5.302 11.793-11.8 11.793a11.72 11.72 0 0 1-5.905-1.582L0 24zm6.549-3.791c1.472.873 2.924 1.34 4.703 1.341 5.485 0 9.948-4.457 9.951-9.94.002-2.656-1.03-5.153-2.905-7.03C16.48 2.705 13.987 1.666 11.797 1.667c-5.49 0-9.952 4.453-9.955 9.937-.001 1.83.483 3.61 1.4 5.161l-.979 3.57 3.655-.959c1.488.81 2.927 1.233 4.689 1.233zm11.302-7.608c-.307-.154-1.821-.899-2.101-.998-.28-.1-.484-.15-.688.156-.204.307-.79.99-.968 1.2-.178.209-.356.234-.664.08-1.124-.564-1.868-.93-2.613-2.204-.199-.34-.199-.546-.073-.728.115-.164.307-.356.462-.534.156-.178.208-.303.312-.507.105-.205.052-.385-.026-.539-.078-.154-.688-1.659-.942-2.27-.247-.595-.5-.515-.688-.525-.178-.009-.382-.01-.587-.01-.205 0-.539.077-.821.385-.282.307-1.078 1.053-1.078 2.569 0 1.516 1.102 2.985 1.256 3.19.154.205 2.169 3.312 5.254 4.643.734.317 1.307.506 1.754.648.74.235 1.414.201 1.947.122.593-.088 1.821-.745 2.076-1.463.254-.718.254-1.333.178-1.463-.076-.13-.28-.205-.588-.359z" /></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Property & Plot */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          <div className="flex flex-col gap-0.5 max-w-[210px]" title={`${projName} [${projDisplayId}]${extraLabels ? ` (More: ${extraLabels})` : ''}`}>
                            <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs truncate">
                              <Building2 size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate"><NameTag name={projName} displayId={projDisplayId} /></span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                              <span className="flex items-center gap-1 font-bold text-slate-700">
                                <Home size={10} className="text-slate-400" />
                                Plot {plotNum}
                              </span>
                              {(projObj?.surveyNumber || (plot.projectId as any)?.surveyNumber) && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {projObj?.surveyNumber || (plot.projectId as any)?.surveyNumber}
                                </span>
                              )}
                              {extraCount > 0 && (
                                <span className="text-[10px] bg-blue-50 text-brand-blue font-bold px-1.5 py-0.5 rounded border border-blue-100/80 shrink-0" title={`Also booked: ${extraLabels}`}>
                                  +{extraCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Location & Source */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          <div className="flex flex-col gap-0.5 max-w-[150px]">
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-800 truncate">
                              <MapPin size={11} className="text-amber-500 shrink-0" />
                              <span className="truncate">{locationCity}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium truncate">{formattedSource}</span>
                          </div>
                        </td>

                        {/* 4. Assigned To */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-700" onClick={openDetail}>
                          {assignedStaff.name ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-xs">{assignedStaff.name}</span>
                              {assignedStaff.displayId && (
                                <span className="text-[10px] text-slate-400 font-medium">{assignedStaff.displayId}</span>
                              )}
                            </div>
                          ) : assignedStaff.displayId ? (
                            <span className="font-semibold text-slate-700">{assignedStaff.displayId}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 5. Payment Method */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${(plot.bookedBy?.paymentMethod || 'CASH') === 'LOAN' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                            {plot.bookedBy?.paymentMethod || 'CASH'}
                          </span>
                        </td>

                        {/* 6. Bank & Follower */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          {(plot.bookedBy?.paymentMethod || 'CASH') === 'LOAN' ? (
                            <div className="flex flex-col gap-0.5 max-w-[180px]">
                              <span className="text-xs font-bold text-slate-900 truncate">{plot.bookedBy?.bank || 'No Bank'}</span>
                              {plot.bookedBy?.bankFollowerName ? (
                                <span className="text-[11px] text-slate-500 font-medium truncate">
                                  {plot.bookedBy.bankFollowerName} {plot.bookedBy.bankFollowerPhone ? `(${plot.bookedBy.bankFollowerPhone})` : ''}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic font-medium">No Bank Follower</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">—</span>
                          )}
                        </td>

                        {/* 6. Expected / Registration Date */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          {activeTab === 'registered' ? (
                            regDate ? (
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                <Calendar size={12} className="text-slate-400" />
                                {formatDate(regDate)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">--</span>
                            )
                          ) : (
                            expDate ? (
                              <div className="flex flex-col gap-0.5 items-start">
                                <span className={`text-xs font-bold flex items-center gap-1 ${isUpcomingPast ? 'text-rose-700 font-extrabold' : 'text-slate-800'}`}>
                                  {isUpcomingPast ? (
                                    <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                                  ) : (
                                    <Calendar size={12} className="text-slate-400" />
                                  )}
                                  {formatDate(expDate)}
                                </span>
                                {daysPassedFromBooking !== null && (
                                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 mt-0.5">
                                    <Clock size={10} className="text-amber-600 shrink-0" /> {daysPassedFromBooking} {daysPassedFromBooking === 1 ? 'day' : 'days'} passed
                                  </span>
                                )}
                                {isUpcomingPast && (
                                  <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-200 font-extrabold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1">
                                    <Clock size={10} className="text-rose-600" /> Date Passed
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">--</span>
                            )
                          )}
                        </td>

                        {/* 7. Payment Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={openDetail}>
                          <StatusBadge status={plot.bookedBy?.paymentStatus || 'Not Paid'} />
                        </td>

                        {/* 8. Actions */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {activeTab === 'upcoming' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setConfirmingRegPlot(plot);
                                  setConfirmRegDate(plot.expectedRegistrationDate ? String(plot.expectedRegistrationDate).split('T')[0] : getTodayStr());
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-green text-white rounded-md text-xs font-bold hover:bg-brand-darkgreen transition-all cursor-pointer shadow-xs"
                              >
                                <FileCheck size={12} /> Confirm Register
                              </button>
                              <button onClick={e => handleEditClick(e, plot)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
                                <Pencil size={12} /> Edit
                              </button>
                            </div>
                          ) : (
                            plot.bookedBy?.paymentStatus !== 'Fully Paid' ? (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditingPaymentPlot(plot);
                                  setEditPaymentStatusVal(plot.bookedBy?.paymentStatus || 'Not Paid');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs"
                                title="Update Payment Status"
                              >
                                <Pencil size={12} /> Edit Payment
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">—</span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(plot => {
              const pid = plot.id || (plot as any)._id;
              const custName = plot.bookedBy?.name || (plot as any).leadInfo?.customerName || 'Customer';
              const custPhone = plot.bookedBy?.phone || (plot as any).leadInfo?.phone || '';

              const matchedLeadM = getLeadForPlot(plot);
              const { extraCount } = relatedExtraFromPlot(plot as Plot & { relatedBookingCount?: number });
              const openDetailM = () => goToRegistrationDetail(plot, matchedLeadM);

              const pProjId = typeof plot.projectId === 'object' ? (plot.projectId as any)._id : plot.projectId;
              const projObj = (typeof plot.projectId === 'object' && (plot.projectId as any)?.name) ? plot.projectId : allProjects.find(pr => String(pr.id || pr._id) === String(pProjId));
              const projName = projObj ? projObj.name : '—';
              const projDisplayId = projObj ? (projObj.displayId || '') : '';
              const plotNum = plot.plotNumber || '—';

              const expDate = plot.expectedRegistrationDate ? String(plot.expectedRegistrationDate).split('T')[0] : '';
              const regDate = plot.registrationDate ? String(plot.registrationDate).split('T')[0] : '';
              const todayStr = getTodayStr();
              const isUpcomingPastM = activeTab === 'upcoming' && !!expDate && expDate < todayStr;

              const locationCityM = matchedLeadM?.city || (plot as any).city || '—';
              const leadSourceTypeM = matchedLeadM?.sourceType || (plot as any).sourceType;
              const leadSourceM = matchedLeadM?.source || (plot as any).source;
              const formattedSourceM = formatSource(leadSourceTypeM, leadSourceM);
              const assignedStaffM = resolveAssignedStaff(plot, matchedLeadM, allUsers);
              const daysPassedFromBookingM = getDaysPassedFromBooking(plot, matchedLeadM);

              return (
                <div key={pid} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer hover:border-blue-200 transition-all" onClick={openDetailM}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar initials={getInitials(custName)} size="sm" bg={getAvatarColor(custName)} />
                      <span className="text-sm font-bold text-slate-900"><NameTag name={custName} displayId={resolveCustomerDisplayId(plot, matchedLeadM, customerDisplayIdByPhone)} /></span>
                    </div>
                    <StatusBadge status={plot.bookedBy?.paymentStatus || 'Not Paid'} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                    <div><span className="text-slate-400">Phone:</span> {custPhone || '—'}</div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-slate-400">Project:</span>
                      <span className="font-semibold text-slate-800 truncate">{projName}</span>
                      {extraCount > 0 && <span className="text-[10px] bg-blue-50 text-brand-blue font-bold px-1 py-0.5 rounded">+{extraCount}</span>}
                    </div>
                    <div><span className="text-slate-400">Plot #:</span> <span className="font-semibold text-slate-800">{plotNum}</span></div>
                    <div>
                      <span className="text-slate-400">Assigned:</span>{' '}
                      <span className="font-bold text-slate-800">
                        {assignedStaffM.name ? (
                          <>
                            <span>{assignedStaffM.name}</span>
                            {assignedStaffM.displayId && (
                              <span className="text-[10px] text-slate-400 font-medium ml-1">({assignedStaffM.displayId})</span>
                            )}
                          </>
                        ) : assignedStaffM.displayId || '—'}
                      </span>
                    </div>
                    <div><span className="text-slate-400">City:</span> <span className="font-semibold text-slate-800">{locationCityM}</span></div>
                    <div><span className="text-slate-400">Source:</span> <span className="font-semibold text-slate-800">{formattedSourceM}</span></div>
                    {activeTab === 'registered' && (
                      <>
                        <div><span className="text-slate-400">Payment Method:</span> <span className="font-bold text-slate-800">{plot.bookedBy?.paymentMethod || 'CASH'}</span></div>
                        <div><span className="text-slate-400">Bank:</span> <span className="font-semibold text-slate-800">{(plot.bookedBy?.paymentMethod || 'CASH') === 'LOAN' ? (plot.bookedBy?.bank || 'No Bank') : '—'}</span></div>
                        <div><span className="text-slate-400">Follower:</span> <span className="font-semibold text-slate-800">{(plot.bookedBy?.paymentMethod || 'CASH') === 'LOAN' ? (plot.bookedBy?.bankFollowerName || 'No Bank Follower') : '—'}</span></div>
                      </>
                    )}
                    {activeTab === 'upcoming' && daysPassedFromBookingM !== null && (
                      <div className="col-span-2 text-xs">
                        <span className="text-slate-400">Booking Age:</span>{' '}
                        <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] inline-flex items-center gap-1">
                          <Clock size={10} className="text-amber-600" /> {daysPassedFromBookingM} {daysPassedFromBookingM === 1 ? 'day' : 'days'} passed since booking
                        </span>
                      </div>
                    )}
                    <div className="col-span-2 flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        {activeTab === 'registered' ? 'Registration Date:' : 'Expected Reg Date:'}
                        {isUpcomingPastM && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-200 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 ml-1">
                            <AlertTriangle size={10} className="text-rose-600" /> Date Passed
                          </span>
                        )}
                      </span>
                      <span className={`font-bold ${isUpcomingPastM ? 'text-rose-700 font-extrabold' : 'text-slate-800'}`}>{formatDate(activeTab === 'registered' ? regDate : expDate)}</span>
                    </div>
                  </div>
                  {activeTab === 'upcoming' ? (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setConfirmingRegPlot(plot);
                          setConfirmRegDate(plot.expectedRegistrationDate ? String(plot.expectedRegistrationDate).split('T')[0] : getTodayStr());
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-green text-white rounded-md text-xs font-bold hover:bg-brand-darkgreen transition-all cursor-pointer shadow-xs"
                      >
                        <FileCheck size={12} /> Confirm Register
                      </button>
                      <button onClick={e => handleEditClick(e, plot)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
                        <Pencil size={12} /> Edit
                      </button>
                    </div>
                  ) : (
                    plot.bookedBy?.paymentStatus !== 'Fully Paid' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingPaymentPlot(plot);
                            setEditPaymentStatusVal(plot.bookedBy?.paymentStatus || 'Not Paid');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          <Pencil size={12} /> Edit Payment
                        </button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => goToPage(page - 1)} disabled={page === 1} className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors">
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((p, idx) => p === '...' ? (
                <span key={`dots-${idx}`} className="px-2 py-2 text-sm text-slate-400">...</span>
              ) : (
                <button key={p} onClick={() => goToPage(p as number)} className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-semibold transition-all ${page === p ? 'bg-brand-green text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => goToPage(page + 1)} disabled={page === totalPages} className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <Modal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingPlot(null); editPlotsLoadSeq.current += 1; }} title="Edit Registration">
        <div className="space-y-4">
          {(editCustomerPlots.length > 1 || editPlotsLoading) && (
            <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
              <label className="block text-xs font-bold text-slate-800 mb-1">Select Booking / Plot to Edit</label>
              <select
                value={editSelectedPlotId}
                onChange={e => handleSwitchEditBooking(e.target.value)}
                disabled={editPlotsLoading && editCustomerPlots.length <= 1}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-xs font-semibold bg-white text-slate-800 outline-none focus:border-brand-green disabled:opacity-60"
              >
                {editCustomerPlots.map(p => {
                  const pProj = resolveProjectForPlot(p, allProjects);
                  const projName = pProj?.name
                    || (typeof p.projectId === 'object' && p.projectId ? (p.projectId as { name?: string }).name : '')
                    || 'Project';
                  const displayId = pProj?.displayId
                    || (typeof p.projectId === 'object' && p.projectId ? (p.projectId as { displayId?: string }).displayId : undefined);
                  return (
                    <option key={plotRecordId(p)} value={plotRecordId(p)}>
                      {formatBookingSelectLabel(projName, displayId, p.plotNumber)}
                    </option>
                  );
                })}
              </select>
              {editPlotsLoading && (
                <p className="text-[11px] text-slate-400 mt-1">Loading this customer’s other plots…</p>
              )}
              {!editPlotsLoading && editCustomerPlots.length > 1 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  This customer has {editCustomerPlots.length} plots. Choose the one to update.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Status</label>
            <select value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium">
              <option value="Advance Paid">Advance Paid</option>
              <option value="Advance Not Paid">Advance Not Paid</option>
              <option value="Fully Paid">Fully Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Not Paid">Not Paid</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Mode</label>
            <select
              value={editPaymentMethod}
              onChange={e => setEditPaymentMethod(e.target.value as 'CASH' | 'LOAN')}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium"
            >
              <option value="CASH">Direct Cash</option>
              <option value="LOAN">Loan</option>
            </select>
          </div>

          {activeTab === 'upcoming' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Registration Date
              </label>
              <input
                type="date"
                value={editRegistrationDate}
                onChange={e => setEditRegistrationDate(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Only this selected plot is registered and moved to Registered. Other plots for this customer stay in Upcoming.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {activeTab === 'registered' ? 'Registration Date' : 'Expected Registration Date'}
            </label>
            <input
              type="date"
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium"
            />
          </div>

          {/* Bank & Follower Fields (Loan payment mode only) */}
          {editPaymentMethod === 'LOAN' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Follower Name</label>
                <FollowerAutocomplete
                  id="reg-follower-name"
                  value={editBankFollowerName}
                  onChange={setEditBankFollowerName}
                  onSelect={opt => {
                    setEditBankFollowerName(opt.name);
                    if (opt.bank) setEditBank(opt.bank);
                    if (opt.phone) setEditBankFollowerPhone(opt.phone);
                  }}
                  options={existingBankFollowers}
                  placeholder="Select existing or type new follower name..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Follower Mobile No</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editBankFollowerPhone}
                  onChange={e => setEditBankFollowerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number..."
                  maxLength={10}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Name</label>
                <input
                  type="text"
                  list="reg-banks-list"
                  value={editBank}
                  onChange={e => handleBankChange(e.target.value)}
                  placeholder="Select existing or type new bank name..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
                />
                <datalist id="reg-banks-list">
                  {existingBanks.map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Loan Stage</label>
            <select
              value={editLoanStage}
              onChange={e => setEditLoanStage(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium cursor-pointer"
            >
              {LOAN_STAGES.filter(s => s !== 'All').map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setEditModalOpen(false); setEditingPlot(null); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-brand-green text-white rounded-lg text-sm font-semibold hover:bg-brand-green/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Payment Status Modal for Registered Tab */}
      {editingPaymentPlot && (
        <Modal
          open={!!editingPaymentPlot}
          onClose={() => setEditingPaymentPlot(null)}
          title={`Update Payment Status — Plot #${editingPaymentPlot.plotNumber}`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Customer: <strong className="text-slate-800">{editingPaymentPlot.bookedBy?.name || 'Customer'}</strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Status <span className="text-red-500">*</span></label>
              <select
                value={editPaymentStatusVal}
                onChange={e => setEditPaymentStatusVal(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-semibold cursor-pointer"
              >
                <option value="Fully Paid">Fully Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Advance Paid">Advance Paid</option>
                <option value="Not Paid">Not Paid</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPaymentPlot(null)}
                disabled={savingPaymentStatus}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePaymentStatus}
                disabled={savingPaymentStatus}
                className="px-4 py-2 bg-brand-green text-white rounded-lg text-xs font-bold hover:bg-brand-darkgreen disabled:opacity-50"
              >
                {savingPaymentStatus ? 'Saving...' : 'Update Status'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Registration Modal for Upcoming Tab */}
      {confirmingRegPlot && (
        <Modal
          open={!!confirmingRegPlot}
          onClose={() => setConfirmingRegPlot(null)}
          title={`Confirm Registration — Plot #${confirmingRegPlot.plotNumber}`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Customer: <strong className="text-slate-900 font-bold">{confirmingRegPlot.bookedBy?.name || 'Customer'}</strong>
            </p>

            {confirmingRegPlot.bookedBy?.paymentStatus !== 'Fully Paid' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> Payment status for this plot is currently <strong>{confirmingRegPlot.bookedBy?.paymentStatus || 'Not Paid'}</strong>. You can select a registration date and proceed to confirm registration.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registration Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={confirmRegDate}
                onChange={e => setConfirmRegDate(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmingRegPlot(null)}
                disabled={submittingConfirmReg}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegisterPlot}
                disabled={submittingConfirmReg}
                className="px-4 py-2 bg-brand-green text-white rounded-lg text-xs font-bold hover:bg-brand-darkgreen disabled:opacity-50 transition-all shadow-xs"
              >
                {submittingConfirmReg ? 'Confirming...' : 'Confirm Registration'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Side Slide Filter Drawer */}
      <Drawer open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} title="Filter Registrations">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Loan Stage</label>
            <select
              value={filters.loanStageFilter}
              onChange={e => updateFilter('loanStageFilter', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-amber-50/60 text-amber-900 border-amber-200 focus:border-brand-green outline-none cursor-pointer"
            >
              <option value="All">All Loan Stages</option>
              {LOAN_STAGES.filter(s => s !== 'All').map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project</label>
            <select
              value={filters.projectFilter}
              onChange={e => updateFilter('projectFilter', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
            >
              <option value="All">All Projects</option>
              {allProjects.map(p => (
                <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>{p.name} [{p.displayId}]</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
            <select
              value={filters.paymentMethodFilter}
              onChange={e => {
                const val = e.target.value;
                setFilters(prev => ({
                  ...prev,
                  paymentMethodFilter: val,
                  ...(val !== 'LOAN' ? { bankFilter: 'All' } : {})
                }));
              }}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
            >
              <option value="All">All Payment Methods</option>
              <option value="LOAN">Bank Loan</option>
              <option value="CASH">Ready Cash</option>
            </select>
          </div>

          {filters.paymentMethodFilter === 'LOAN' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
              <select
                value={filters.bankFilter}
                onChange={e => updateFilter('bankFilter', e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
              >
                <option value="All">All Banks</option>
                {allBanks.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {allUsers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Booked By</label>
              <select
                value={filters.bookedByFilter}
                onChange={e => updateFilter('bookedByFilter', e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
              >
                <option value="All">All (Booked By)</option>
                {allUsers.filter(u => u.role === 'admin').length > 0 && (
                  <optgroup label="── Admin ──">
                    {allUsers.filter(u => u.role === 'admin').map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </optgroup>
                )}
                {allUsers.filter(u => u.role === 'staff').length > 0 && (
                  <optgroup label="── Staff ──">
                    {allUsers.filter(u => u.role === 'staff').map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date Range (From)</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => updateFilter('dateFrom', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date Range (To)</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => updateFilter('dateTo', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none cursor-pointer"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Clear All Filters
            </button>
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(false)}
              className="px-5 py-2 bg-brand-green text-white rounded-lg text-xs font-bold hover:bg-brand-green/90 transition-colors shadow-xs"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Drawer>

      {whatsAppCustomer && (
        <WhatsAppChatModal open={!!whatsAppCustomer} onClose={() => setWhatsAppCustomer(null)} phone={whatsAppCustomer.phone} name={whatsAppCustomer.name} />
      )}
    </div>
  );
}
