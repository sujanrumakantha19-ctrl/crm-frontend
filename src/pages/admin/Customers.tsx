import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Phone, MapPin, UserCheck, Pencil, Building2, ChevronLeft, ChevronRight, ArrowUpDown, Home, X, CreditCard, Calendar, SlidersHorizontal, Clock } from 'lucide-react';
import { Drawer } from '@/components/shared/Drawer';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { leadService, projectService, plotService, userService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { toast } from 'sonner';
import { NameTag } from '@/components/shared/NameTag';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { FollowerAutocomplete } from '@/components/shared/FollowerAutocomplete';
import { useExportContext } from '@/context/ExportContext';
import { formatDate, getTodayStr } from '@/lib/utils';

/* ─── constants ─── */
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
];

const SORT_API_MAP: Record<SortOption, string> = {
  newest: '-createdAt,-dateAdded,-_id',
  oldest: 'createdAt,dateAdded,_id',
  name_asc: 'customerName',
  name_desc: '-customerName',
};

interface Filters {
  search: string;
  bankFilter: string;
  projectFilter: string;
  paymentStatusFilter: string;
  bookedByFilter: string;
  loanStageFilter: string;
  sortBy: SortOption;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  bankFilter: 'All',
  projectFilter: 'All',
  paymentStatusFilter: 'All',
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

/* ─── component ─── */
export default function AdminCustomers() {
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const { triggerDownload } = useExportContext();

  /* ── filter state (consolidated) ── */
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const debouncedSearch = useDebounce(filters.search);

  /* ── helper to format ISO date string cleanly ── */
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

  /* ── derived "committed" filters used for API calls ── */
  const committedFilters = useMemo<Filters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  /* ── data state ── */
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [allBanks, setAllBanks] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allPlots, setAllPlots] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<{ phone: string; name: string } | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  /* ── stable refs to avoid stale-closure issues in fetch ── */
  const filtersRef = useRef(committedFilters);
  filtersRef.current = committedFilters;
  const roleRef = useRef(role);
  roleRef.current = role;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const itemsLengthRef = useRef(0);
  itemsLengthRef.current = items.length;

  /* ── fetch projects, plots & users for lookup (once) ── */
  useEffect(() => {
    Promise.all([
      projectService.getAll({ limit: 100 }).catch(() => ({ data: [] })),
      plotService.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      userService.getAll({ role: 'admin', limit: 100 }).catch(() => ({ data: [] })),
      userService.getAll({ role: 'staff', limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([pRes, plRes, adminRes, staffRes]) => {
      setAllProjects((pRes.data || []).map((p: any) => ({ ...p, id: p.id || p._id })));
      setAllPlots(plRes.data || []);
      const admins = (adminRes.data || []).map((u: any) => ({ id: u.id || u._id, name: u.name || u.displayId || '', role: 'admin' }));
      const staff = (staffRes.data || []).map((u: any) => ({ id: u.id || u._id, name: u.name || u.displayId || '', role: 'staff' }));
      setAllUsers([...admins, ...staff]);
    });
  }, []);

  const getProjectName = useCallback((c: any) => {
    if (!c) return '—';
    if (typeof c.projectId === 'object' && c.projectId !== null) {
      return c.projectId.name || '—';
    }
    if (typeof c.projectId === 'string' && c.projectId.trim()) {
      const projId = c.projectId.trim();
      const found = allProjects.find(p => String(p.id) === projId);
      if (found) return found.name;
      if (!/^[0-9a-fA-F]{24}$/.test(projId)) return projId;
    }
    // Try finding via booked plot
    const bookedPlot = allPlots.find(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );
    if (bookedPlot && bookedPlot.projectId) {
      if (typeof bookedPlot.projectId === 'object') return (bookedPlot.projectId as any).name || '—';
      const found = allProjects.find(p => String(p.id) === String(bookedPlot.projectId));
      if (found) return found.name;
    }
    return c.projectName || (typeof c.project === 'object' ? c.project?.name : c.project) || '—';
  }, [allProjects, allPlots]);

  const getProjectDisplayId = useCallback((c: any) => {
    if (!c) return '';
    if (typeof c.projectId === 'object' && c.projectId !== null) {
      return c.projectId.displayId || '';
    }
    if (typeof c.projectId === 'string' && c.projectId.trim()) {
      const projId = c.projectId.trim();
      const found = allProjects.find(p => String(p.id) === projId);
      if (found) return found.displayId || '';
    }
    const bookedPlot = allPlots.find(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );
    if (bookedPlot && bookedPlot.projectId) {
      if (typeof bookedPlot.projectId === 'object') return (bookedPlot.projectId as any).displayId || '';
      const found = allProjects.find(p => String(p.id) === String(bookedPlot.projectId));
      if (found) return found.displayId || '';
    }
    return (typeof c.project === 'object' ? c.project?.displayId : '') || '';
  }, [allProjects, allPlots]);

  const getPlotNumber = useCallback((c: any) => {
    if (!c) return '—';
    if (typeof c.plotId === 'object' && c.plotId !== null) {
      return c.plotId.plotNumber ?? '—';
    }
    if (c.plotNumber) return String(c.plotNumber);
    if (c.selectedPlot) return String(c.selectedPlot);
    if (c.plot) return typeof c.plot === 'object' ? String(c.plot.plotNumber ?? '—') : String(c.plot);
    if (typeof c.plotId === 'string' && c.plotId.trim() && !/^[0-9a-fA-F]{24}$/.test(c.plotId.trim())) {
      return c.plotId;
    }
    // Try finding via booked plot in allPlots
    const bookedPlot = allPlots.find(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );
    if (bookedPlot) return String(bookedPlot.plotNumber);
    return '—';
  }, [allPlots]);

  const getSurveyNumber = useCallback((c: any) => {
    if (!c) return '—';
    if (typeof c.projectId === 'object' && c.projectId !== null) {
      return c.projectId.surveyNumber || '—';
    }
    if (typeof c.projectId === 'string' && c.projectId.trim()) {
      const found = allProjects.find(p => String(p.id) === c.projectId.trim());
      if (found && (found as any).surveyNumber) return (found as any).surveyNumber;
    }
    const bookedPlot = allPlots.find(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );
    if (bookedPlot && bookedPlot.projectId && typeof bookedPlot.projectId === 'object') {
      return (bookedPlot.projectId as any).surveyNumber || '—';
    }
    return '—';
  }, [allProjects, allPlots]);

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getExpectedRegistrationDate = useCallback((c: any) => {
    if (!c) return '';
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const dates: string[] = [];
    if (c.expectedRegistrationDate) {
      dates.push(String(c.expectedRegistrationDate).split('T')[0]);
    }

    const customerPlots = allPlots.filter(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );

    customerPlots.forEach(p => {
      if (p.expectedRegistrationDate) {
        dates.push(String(p.expectedRegistrationDate).split('T')[0]);
      }
    });

    if (dates.length === 0) return '';

    const getRank = (exp: string) => {
      if (exp === todayStr) return 1;
      if (exp === tomorrowStr) return 2;
      if (exp > tomorrowStr) return 3; // Future
      return 4; // Past
    };

    dates.sort((a, b) => {
      const rA = getRank(a);
      const rB = getRank(b);
      if (rA !== rB) return rA - rB;
      if (rA === 3) return a.localeCompare(b);
      if (rA === 4) return b.localeCompare(a);
      return 0;
    });

    return dates[0];
  }, [allPlots]);

  const getCustomerProjects = useCallback((c: any) => {
    if (!c) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const customerPlots = allPlots.filter(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );

    const getPlotDateRank = (p: Plot) => {
      const exp = p.expectedRegistrationDate ? String(p.expectedRegistrationDate).split('T')[0] : '';
      if (!exp) return 5;
      if (exp === todayStr) return 1;
      if (exp === tomorrowStr) return 2;
      if (exp > tomorrowStr) return 3;
      return 4;
    };

    customerPlots.sort((a, b) => {
      const rA = getPlotDateRank(a);
      const rB = getPlotDateRank(b);
      if (rA !== rB) return rA - rB;
      const dateA = new Date(a.timeline?.[0]?.date || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.timeline?.[0]?.date || (b as any).createdAt || 0).getTime();
      return dateB - dateA;
    });

    const projMap = new Map<string, { project: Project; latestPlotNumber: string }>();

    customerPlots.forEach(p => {
      const pid = typeof p.projectId === 'object' ? (p.projectId as any)._id || (p.projectId as any).id : p.projectId;
      if (pid && !projMap.has(String(pid))) {
        const found = allProjects.find(pr => String(pr.id || (pr as any)._id) === String(pid));
        if (found) {
          projMap.set(String(pid), { project: found, latestPlotNumber: String(p.plotNumber) });
        }
      }
    });

    if (c.projectId) {
      const pid = typeof c.projectId === 'object' ? (c.projectId._id || c.projectId.id) : c.projectId;
      if (pid && !projMap.has(String(pid))) {
        const found = allProjects.find(pr => String(pr.id || (pr as any)._id) === String(pid));
        if (found) {
          projMap.set(String(pid), { project: found, latestPlotNumber: String(c.plotNumber || '—') });
        }
      }
    }

    return Array.from(projMap.values());
  }, [allPlots, allProjects]);

  /* ── fetch leads ── */
  const fetchLeads = useCallback(async (p = 1, { replace = true, showRefreshing = false } = {}) => {
    if (showRefreshing && itemsLengthRef.current > 0) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const f = filtersRef.current;
      const params: Record<string, any> = {
        status: 'Customer',
        page: p,
        limit: 10,
        sort: SORT_API_MAP[f.sortBy] || '-createdAt',
      };
      if (roleRef.current === 'staff' && userIdRef.current) params.assignedTo = userIdRef.current;
      if (f.search) params.search = f.search;
      if (f.bankFilter !== 'All') params.bank = f.bankFilter;
      if (f.projectFilter !== 'All') params.projectId = f.projectFilter;
      if (f.paymentStatusFilter !== 'All') params.paymentStatus = f.paymentStatusFilter;
      if (f.loanStageFilter !== 'All') params.loanStage = f.loanStageFilter;
      if (f.bookedByFilter !== 'All') {
        const u = allUsers.find(user => user.name === f.bookedByFilter);
        if (u) {
          params.assignedTo = u.id;
        } else {
          params.assignedToName = f.bookedByFilter;
        }
      }
      if (f.dateFrom) params['createdAt[gte]'] = `${f.dateFrom}T00:00:00.000Z`;
      if (f.dateTo) params['createdAt[lte]'] = `${f.dateTo}T23:59:59.999Z`;

      const res = await leadService.getAll(params) as ApiResponse<any[]>;
      const data = res.data || [];
      setItems(prev => replace ? data : [...prev, ...data]);
      const totalCount = res.total ?? data.length;
      setTotal(totalCount);
      setTotalPages(Math.max(1, Math.ceil(totalCount / 10)));
      setPage(p);

      // Collect bank names for filter dropdown
      const banks = data.map((l: any) => l.bank).filter((b: string | undefined) => !!b?.trim());
      setAllBanks(prev => [...new Set([...prev, ...banks])].sort());
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
      toast.error(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allUsers]);

  /* ── re-fetch when committed filters change ── */
  useEffect(() => { fetchLeads(1, { replace: true, showRefreshing: items.length > 0 }); }, [committedFilters, fetchLeads]);

  /* ── filtered list returned directly from DB ── */
  const searchFiltered = useMemo(() => {
    const f = committedFilters;
    if (f.loanStageFilter === 'All') return items;
    return items.filter(c => {
      const stage = c.loanStage || (c.bookedBy?.loanStage) || 'Not Applied';
      return stage === f.loanStageFilter;
    });
  }, [items, committedFilters]);

  const getCustomerBookedPlots = useCallback((c: any) => {
    if (!c) return [];
    return allPlots.filter(p =>
      (p.bookedBy?.name && c.customerName && p.bookedBy.name.toLowerCase() === c.customerName.toLowerCase()) ||
      (p.bookedBy?.phone && c.phone && p.bookedBy.phone === c.phone)
    );
  }, [allPlots]);

  /* ── per-row selected booking plot map ── */
  const [selectedPlotMap, setSelectedPlotMap] = useState<Record<string, string>>({});

  const getActivePlotForCustomer = (c: any) => {
    if (!c) return null;
    const lid = c.id || c._id;
    const plots = getCustomerBookedPlots(c);
    if (plots.length === 0) return null;
    const selectedPlotId = selectedPlotMap[lid];
    if (selectedPlotId) {
      const found = plots.find(p => String(p.id || (p as any)._id) === String(selectedPlotId));
      if (found) return found;
    }
    return plots[0];
  };

  /* ── edit modal state ── */
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editCustomerPlots, setEditCustomerPlots] = useState<Plot[]>([]);
  const [editSelectedPlotId, setEditSelectedPlotId] = useState<string>('lead_default');
  const [editPaymentStatus, setEditPaymentStatus] = useState('Not Paid');
  const [editBank, setEditBank] = useState('');
  const [editBankFollowerName, setEditBankFollowerName] = useState('');
  const [editBankFollowerPhone, setEditBankFollowerPhone] = useState('');
  const [editLoanStage, setEditLoanStage] = useState('Not Applied');
  const [editExpectedRegistrationDate, setEditExpectedRegistrationDate] = useState('');
  const [saving, setSaving] = useState(false);

  const formatPrice = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '—';
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Unique Bank Followers & Banks from existing customer data for smart auto-complete & auto-fill
  const existingBankFollowers = useMemo(() => {
    const map = new Map<string, { bank: string; name: string; phone: string }>();
    items.forEach(l => {
      if (l.bankFollowerName?.trim()) {
        const key = l.bankFollowerName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            bank: l.bank?.trim() || '',
            name: l.bankFollowerName.trim(),
            phone: l.bankFollowerPhone?.trim() || '',
          });
        }
      }
    });
    return Array.from(map.values());
  }, [items]);

  const existingBanks = useMemo(() => {
    const set = new Set<string>();
    items.forEach(l => {
      if (l.bank?.trim()) set.add(l.bank.trim());
    });
    return Array.from(set);
  }, [items]);

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

  const handleEditClick = (e: React.MouseEvent, customer: any) => {
    e.stopPropagation();
    const lid = customer.id || customer._id;
    setEditingCustomer({ ...customer, id: lid });

    const custPlots = getCustomerBookedPlots(customer);
    setEditCustomerPlots(custPlots);

    const activePlot = getActivePlotForCustomer(customer);
    const initialPlotId = activePlot ? (activePlot.id || (activePlot as any)._id) : (custPlots[0] ? (custPlots[0].id || (custPlots[0] as any)._id) : 'lead_default');
    setEditSelectedPlotId(initialPlotId);

    if (initialPlotId !== 'lead_default' && activePlot) {
      setEditPaymentStatus(activePlot.bookedBy?.paymentStatus || 'Not Paid');
      setEditBank(activePlot.bookedBy?.bank ?? '');
      setEditBankFollowerName(activePlot.bookedBy?.bankFollowerName ?? '');
      setEditBankFollowerPhone(activePlot.bookedBy?.bankFollowerPhone ?? '');
      setEditLoanStage(activePlot.bookedBy?.loanStage || 'Not Applied');
      setEditExpectedRegistrationDate(activePlot.expectedRegistrationDate ? String(activePlot.expectedRegistrationDate).split('T')[0] : '');
    } else {
      setEditPaymentStatus(customer.paymentStatus || 'Not Paid');
      setEditBank(customer.bank || '');
      setEditBankFollowerName(customer.bankFollowerName || '');
      setEditBankFollowerPhone(customer.bankFollowerPhone || '');
      setEditLoanStage(customer.loanStage || (customer.bookedBy?.loanStage) || 'Not Applied');
      setEditExpectedRegistrationDate(customer.expectedRegistrationDate ? String(customer.expectedRegistrationDate).split('T')[0] : '');
    }

    setEditModalOpen(true);
  };

  const handleSwitchEditBooking = (plotId: string) => {
    setEditSelectedPlotId(plotId);
    if (plotId === 'lead_default') {
      if (editingCustomer) {
        setEditPaymentStatus(editingCustomer.paymentStatus || 'Not Paid');
        setEditBank(editingCustomer.bank || '');
        setEditBankFollowerName(editingCustomer.bankFollowerName || '');
        setEditBankFollowerPhone(editingCustomer.bankFollowerPhone || '');
        setEditLoanStage(editingCustomer.loanStage || (editingCustomer.bookedBy?.loanStage) || 'Not Applied');
        setEditExpectedRegistrationDate(editingCustomer.expectedRegistrationDate ? String(editingCustomer.expectedRegistrationDate).split('T')[0] : '');
      }
    } else {
      const target = editCustomerPlots.find(p => String(p.id || (p as any)._id) === String(plotId));
      if (target) {
        setEditPaymentStatus(target.bookedBy?.paymentStatus || 'Not Paid');
        setEditBank(target.bookedBy?.bank ?? '');
        setEditBankFollowerName(target.bookedBy?.bankFollowerName ?? '');
        setEditBankFollowerPhone(target.bookedBy?.bankFollowerPhone ?? '');
        setEditLoanStage(target.bookedBy?.loanStage || 'Not Applied');
        setEditExpectedRegistrationDate(target.expectedRegistrationDate ? String(target.expectedRegistrationDate).split('T')[0] : '');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;

    const bName = editBank.trim();
    const bFollower = editBankFollowerName.trim();
    const bPhone = editBankFollowerPhone.trim();

    const hasAnyBankField = !!bName || !!bFollower || !!bPhone;
    const hasAllBankFields = !!bName && !!bFollower && !!bPhone;

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

    setSaving(true);
    try {
      // 1. Update Lead Profile
      await leadService.update(editingCustomer.id, {
        paymentStatus: editPaymentStatus,
        bank: bName,
        bankFollowerName: bFollower,
        bankFollowerPhone: bPhone,
        loanStage: editLoanStage,
        expectedRegistrationDate: editExpectedRegistrationDate,
      } as any);

      // 2. If a specific plot booking was selected, update plot record too
      if (editSelectedPlotId !== 'lead_default') {
        const targetPlot = editCustomerPlots.find(p => String(p.id || (p as any)._id) === String(editSelectedPlotId));
        if (targetPlot) {
          await plotService.update(editSelectedPlotId, {
            ...targetPlot,
            expectedRegistrationDate: editExpectedRegistrationDate || undefined,
            bookedBy: {
              ...targetPlot.bookedBy,
              paymentStatus: editPaymentStatus,
              bank: bName,
              bankFollowerName: bFollower,
              bankFollowerPhone: bPhone,
              loanStage: editLoanStage,
            },
          });
        }
      }

      toast.success('Customer updated successfully');
      setEditModalOpen(false);
      setEditingCustomer(null);
      const plotRes = await plotService.getAll({ limit: 500 }).catch(() => ({ data: [] }));
      if (plotRes.data) setAllPlots(plotRes.data);
      fetchLeads(page, { replace: true, showRefreshing: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  /* ── helpers ── */
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const hasActiveFilters = committedFilters.projectFilter !== 'All' || committedFilters.bankFilter !== 'All' || committedFilters.paymentStatusFilter !== 'All' || committedFilters.bookedByFilter !== 'All' || committedFilters.loanStageFilter !== 'All' || committedFilters.sortBy !== 'newest' || !!committedFilters.dateFrom || !!committedFilters.dateTo;
  const activeFilterCount = [committedFilters.projectFilter !== 'All', committedFilters.bankFilter !== 'All', committedFilters.paymentStatusFilter !== 'All', committedFilters.bookedByFilter !== 'All', committedFilters.loanStageFilter !== 'All', committedFilters.sortBy !== 'newest', !!committedFilters.dateFrom, !!committedFilters.dateTo].filter(Boolean).length;

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

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    fetchLeads(p, { replace: true, showRefreshing: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Loans</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total customers</p>
        </div>
        <button
          onClick={triggerDownload}
          className="flex items-center justify-center px-4 py-2 border border-slate-200 bg-white text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 transition-all shrink-0"
        >
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, project, plot..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-lg text-sm focus:border-brand-green focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
            />
            {!filters.search && (
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
              className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all w-full sm:w-auto"
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
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
          >
            <option value="All">All Projects</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{p.name} [{p.displayId}]</option>)}
          </select>

          <select
            value={filters.bankFilter}
            onChange={e => updateFilter('bankFilter', e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
          >
            <option value="All">All Banks</option>
            {allBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
          </select>

          <select
            value={filters.paymentStatusFilter}
            onChange={e => updateFilter('paymentStatusFilter', e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Advance Paid">Advance Paid</option>
            <option value="Advance Not Paid">Advance Not Paid</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Not Paid">Not Paid</option>
          </select>

          {/* Booked By filter — admin first, then staff */}
          {allUsers.length > 0 && (
            <select
              value={filters.bookedByFilter}
              onChange={e => updateFilter('bookedByFilter', e.target.value)}
              className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
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

          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors">
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && items.length === 0 ? (
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
                <div className="h-6 bg-slate-200 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-red-500 text-sm mb-2">{error}</p>
          <button onClick={() => fetchLeads(1)} className="text-sm text-brand-blue hover:underline">Retry</button>
        </div>
      ) : searchFiltered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <UserCheck size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">No loaned customers found</p>
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
                    {['Customer & Contact', 'Property / Plot', 'Location & Source', 'Assigned To', 'Loan Stage', 'Bank & Follower', 'Expected Reg. Date', 'Payment Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3.5 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchFiltered.map(c => {
                    const cId = c.id || c._id;
                    const custProjects = getCustomerProjects(c);
                    const primaryProj = custProjects[0]?.project;
                    const extraCount = custProjects.length > 1 ? custProjects.length - 1 : 0;
                    const extraNames = custProjects.slice(1).map(p => `${p.project.name} [${p.project.displayId || ''}]`).join(', ');

                    const pProjId = c.projectId ? (typeof c.projectId === 'object' ? c.projectId._id || c.projectId.id : c.projectId) : undefined;
                    const projObj = pProjId ? allProjects.find(pr => String(pr.id || pr._id) === String(pProjId)) : primaryProj;
                    const projName = projObj ? projObj.name : (primaryProj ? primaryProj.name : '—');
                    const projDisplayId = projObj ? (projObj.displayId || '') : (primaryProj ? (primaryProj.displayId || '') : '');
                    const plotNum = c.plotNumber || custProjects[0]?.latestPlotNumber || '—';

                    const expDate = getExpectedRegistrationDate(c);
                    const todayStr = getTodayStr();
                    const tomorrowStr = getTomorrowStr();
                    const isToday = expDate === todayStr;
                    const isTomorrow = expDate === tomorrowStr;

                    const loanStage = c.loanStage || (c.bookedBy?.loanStage) || 'Not Applied';
                    const activeBank = c.bank || (c.bookedBy?.bank) || '—';
                    const activeFollowerName = c.bankFollowerName || (c.bookedBy?.bankFollowerName) || '';
                    const activeFollowerPhone = c.bankFollowerPhone || (c.bookedBy?.bankFollowerPhone) || '';
                    const surveyNum = getSurveyNumber(c);
                    const activeExpDate = expDate;
                    const activePaymentStatus = c.paymentStatus || (c.bookedBy?.paymentStatus) || (c.advanceAmount && c.advanceAmount > 0 ? 'Advance Paid' : 'Advance Not Paid');
                    const lid = cId;

                    return (
                      <tr key={cId} className="hover:bg-slate-50/70 transition-colors cursor-pointer group" onClick={() => navigate(`/${role}/customers/${cId}`)}>
                        {/* 1. Customer & Contact */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${cId}`)}>
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={getInitials(c.customerName)} size="sm" bg={getAvatarColor(c.customerName)} />
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 group-hover:text-brand-blue transition-colors text-sm"><NameTag name={c.customerName} displayId={c.displayId} /></span>
                              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-0.5">
                                <Phone size={11} className="text-slate-400" />
                                <span>{c.phone || '—'}</span>
                                {c.phone && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setWhatsAppCustomer({ phone: c.phone, name: c.customerName }); }}
                                    className="p-0.5 hover:bg-emerald-50 rounded text-emerald-600 transition-colors ml-1"
                                    title="Chat on WhatsApp"
                                  >
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.291 5.3 0 11.799 0c3.148.001 6.108 1.228 8.334 3.457 2.227 2.229 3.452 5.19 3.45 8.34-.004 6.502-5.302 11.793-11.8 11.793a11.72 11.72 0 0 1-5.905-1.582L0 24zm6.549-3.791c1.472.873 2.924 1.34 4.703 1.341 5.485 0 9.948-4.457 9.951-9.94.002-2.656-1.03-5.153-2.905-7.03C16.48 2.705 13.987 1.666 11.797 1.667c-5.49 0-9.952 4.453-9.955 9.937-.001 1.83.483 3.61 1.4 5.161l-.979 3.57 3.655-.959c1.488.81 2.927 1.233 4.689 1.233zm11.302-7.608c-.307-.154-1.821-.899-2.101-.998-.28-.1-.484-.15-.688.156-.204.307-.79.99-.968 1.2-.178.209-.356.234-.664.08-1.124-.564-1.868-.93-2.613-2.204-.199-.34-.199-.546-.073-.728.115-.164.307-.356.462-.534.156-.178.208-.303.312-.507.105-.205.052-.385-.026-.539-.078-.154-.688-1.659-.942-2.27-.247-.595-.5-.515-.688-.525-.178-.009-.382-.01-.587-.01-.205 0-.539.077-.821.385-.282.307-1.078 1.053-1.078 2.569 0 1.516 1.102 2.985 1.256 3.19.154.205 2.169 3.312 5.254 4.643.734.317 1.307.506 1.754.648.74.235 1.414.201 1.947.122.593-.088 1.821-.745 2.076-1.463.254-.718.254-1.333.178-1.463-.076-.13-.28-.205-.588-.359z" /></svg>
                                  </button>
                                )}
                                {extraCount > 0 && (
                                  <span className="text-[10px] bg-blue-50 text-brand-blue font-bold px-1.5 py-0.5 rounded border border-blue-100/80 shrink-0"
                                    title={`Also in: ${extraNames}`}
                                  >
                                    +{extraCount} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Property / Plot */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${cId}`)}>
                          <div className="flex flex-col gap-0.5 max-w-[210px]" title={`${projName}${projDisplayId ? ` [${projDisplayId}]` : ''}${surveyNum && surveyNum !== '—' ? ` | Survey: ${surveyNum}` : ''}`}>
                            <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs truncate">
                              <Building2 size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate"><NameTag name={projName} displayId={projDisplayId} /></span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                              <span className="flex items-center gap-1 font-bold text-slate-700">
                                <Home size={10} className="text-slate-400" />
                                Plot {plotNum}
                              </span>
                              {surveyNum && surveyNum !== '—' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200" title="Survey Number">
                                  {surveyNum}
                                </span>
                              )}
                              {extraCount > 0 && (
                                <span className="text-[10px] bg-blue-50 text-brand-blue font-bold px-1.5 py-0.5 rounded border border-blue-100/80 shrink-0" title={`Also in: ${extraNames}`}>
                                  +{extraCount} more
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Location & Source */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${cId}`)}>
                          <div className="flex flex-col gap-0.5 max-w-[150px]" title={`${c.city || '—'} | ${c.source || '—'}`}>
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-800 truncate">
                              <MapPin size={11} className="text-amber-500 shrink-0" />
                              <span className="truncate">{c.city || '—'}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium truncate">{c.source || '—'}</span>
                          </div>
                        </td>

                        {/* 4. Assigned To */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-700" onClick={() => navigate(`/${role}/customers/${lid}`)}>
                          {c.assignedToDisplayId || c.assignedToName || '—'}
                        </td>

                        {/* 5. Loan Stage */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${lid}`)}>
                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${getLoanStageBadgeClass(loanStage)}`}>
                            {loanStage}
                          </span>
                        </td>

                        {/* 6. Bank & Follower */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${lid}`)}>
                          <div className="flex flex-col gap-0.5 max-w-[180px]" title={`${activeBank} - ${activeFollowerName} (${activeFollowerPhone})`}>
                            <span className="text-xs font-bold text-slate-900 truncate">{activeBank}</span>
                            {activeFollowerName ? (
                              <span className="text-[11px] text-slate-500 font-medium truncate">
                                {activeFollowerName} {activeFollowerPhone ? `(${activeFollowerPhone})` : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No Follower</span>
                            )}
                          </div>
                        </td>

                        {/* 7. Expected Reg. Date */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${lid}`)}>
                          {(() => {
                            const expDate = activeExpDate;
                            const todayStr = getTodayStr();
                            const tomorrowStr = getTomorrowStr();
                            const isToday = expDate === todayStr;
                            const isTomorrow = expDate === tomorrowStr;

                            return (
                              <div className="flex flex-col gap-0.5 items-start">
                                {expDate ? (
                                  <>
                                    <span className={`text-xs font-bold flex items-center gap-1 ${isToday ? 'text-emerald-700' : isTomorrow ? 'text-blue-700' : 'text-slate-800'}`}>
                                      <Calendar size={12} className={isToday ? 'text-emerald-600' : isTomorrow ? 'text-blue-500' : 'text-slate-400'} />
                                      {formatDate(expDate)}
                                    </span>
                                    {isToday && (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded shadow-xs">
                                        Today
                                      </span>
                                    )}
                                    {isTomorrow && (
                                      <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded shadow-xs">
                                        Tomorrow
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">--</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* 8. Payment Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap" onClick={() => navigate(`/${role}/customers/${lid}`)}>
                          <StatusBadge status={activePaymentStatus} />
                        </td>

                        {/* 9. Actions */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <button onClick={e => handleEditClick(e, c)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-brand-green hover:text-white hover:border-brand-green transition-all shadow-sm">
                            <Pencil size={12} /> Edit
                          </button>
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
            {searchFiltered.map(c => {
              const lid = c.id || c._id;
              return (
                <div key={lid} onClick={() => navigate(`/${role}/customers/${lid}`)} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar initials={getInitials(c.customerName)} size="sm" bg={getAvatarColor(c.customerName)} />
                      <span className="text-sm font-semibold text-slate-900"><NameTag name={c.customerName} displayId={c.displayId} /></span>
                    </div>
                    <StatusBadge status={c.paymentStatus || (c.advanceAmount && c.advanceAmount > 0 ? 'Advance Paid' : 'Advance Not Paid')} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Phone:</span> {c.phone}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setWhatsAppCustomer({ phone: c.phone, name: c.customerName }); }}
                        className="p-0.5 hover:bg-emerald-50 rounded text-emerald-600 transition-colors shrink-0"
                      >
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.291 5.3 0 11.799 0c3.148.001 6.108 1.228 8.334 3.457 2.227 2.229 3.452 5.19 3.45 8.34-.004 6.502-5.302 11.793-11.8 11.793a11.72 11.72 0 0 1-5.905-1.582L0 24zm6.549-3.791c1.472.873 2.924 1.34 4.703 1.341 5.485 0 9.948-4.457 9.951-9.94.002-2.656-1.03-5.153-2.905-7.03C16.48 2.705 13.987 1.666 11.797 1.667c-5.49 0-9.952 4.453-9.955 9.937-.001 1.83.483 3.61 1.4 5.161l-.979 3.57 3.655-.959c1.488.81 2.927 1.233 4.689 1.233zm11.302-7.608c-.307-.154-1.821-.899-2.101-.998-.28-.1-.484-.15-.688.156-.204.307-.79.99-.968 1.2-.178.209-.356.234-.664.08-1.124-.564-1.868-.93-2.613-2.204-.199-.34-.199-.546-.073-.728.115-.164.307-.356.462-.534.156-.178.208-.303.312-.507.105-.205.052-.385-.026-.539-.078-.154-.688-1.659-.942-2.27-.247-.595-.5-.515-.688-.525-.178-.009-.382-.01-.587-.01-.205 0-.539.077-.821.385-.282.307-1.078 1.053-1.078 2.569 0 1.516 1.102 2.985 1.256 3.19.154.205 2.169 3.312 5.254 4.643.734.317 1.307.506 1.754.648.74.235 1.414.201 1.947.122.593-.088 1.821-.745 2.076-1.463.254-.718.254-1.333.178-1.463-.076-.13-.28-.205-.588-.359z" /></svg>
                      </button>
                    </div>
                    <div><span className="text-slate-400">City:</span> {c.city || '—'}</div>
                    {(() => {
                      const custProjects = getCustomerProjects(c);
                      const primaryProj = custProjects[0]?.project;
                      const projName = primaryProj ? primaryProj.name : getProjectName(c);
                      const projDisplayId = primaryProj ? primaryProj.displayId : getProjectDisplayId(c);
                      const plotNum = custProjects[0]?.latestPlotNumber || getPlotNumber(c);
                      const extraCount = custProjects.length > 1 ? custProjects.length - 1 : 0;
                      const extraNames = custProjects.slice(1).map(p => `${p.project.name} [${p.project.displayId || ''}]`).join(', ');

                      return (
                        <>
                          <div className="col-span-2 flex items-center justify-between gap-1">
                            <span className="text-slate-400">Project:</span>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-slate-800 truncate"><NameTag name={projName} displayId={projDisplayId} /></span>
                              {extraCount > 0 && (
                                <span className="text-[10px] bg-blue-50 text-brand-blue font-bold px-1.5 py-0.5 rounded border border-blue-100/80 shrink-0" title={`Also in: ${extraNames}`}>
                                  +{extraCount} more
                                </span>
                              )}
                            </div>
                          </div>
                          <div><span className="text-slate-400">Plot:</span> <span className="font-medium text-slate-800">{plotNum}</span></div>
                        </>
                      );
                    })()}
                    <div><span className="text-slate-400">Source:</span> {c.source || '—'}</div>
                    <div><span className="text-slate-400">Assigned:</span> {c.assignedToDisplayId || c.assignedToName || '—'}</div>
                    <div className="col-span-2"><span className="text-slate-400 font-semibold">Bank:</span> <span className="font-semibold text-slate-800">{c.bank || '—'}</span></div>
                    <div className="col-span-2"><span className="text-slate-400 font-semibold">Bank Follower:</span> <span className="font-semibold text-slate-800">{c.bankFollowerName || '—'}</span>{c.bankFollowerPhone && <span className="text-slate-500 ml-1">({c.bankFollowerPhone})</span>}</div>
                    {(() => {
                      const expDate = getExpectedRegistrationDate(c);
                      const todayStr = getTodayStr();
                      const tomorrowStr = getTomorrowStr();
                      const isToday = expDate === todayStr;
                      const isTomorrow = expDate === tomorrowStr;

                      return (
                        <div className="col-span-2 flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                          <span className="text-slate-400 text-xs">Expected Reg Date:</span>
                          {expDate ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold flex items-center gap-1 ${isToday ? 'text-emerald-700' : isTomorrow ? 'text-blue-700' : 'text-slate-800'}`}>
                                <Calendar size={12} className={isToday ? 'text-emerald-600' : isTomorrow ? 'text-blue-500' : 'text-slate-400'} />
                                {formatDate(expDate)}
                              </span>
                              {isToday && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                                  Today
                                </span>
                              )}
                              {isTomorrow && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded">
                                  Tomorrow
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">--</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <button onClick={e => { e.stopPropagation(); handleEditClick(e, c); }} className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-brand-green hover:text-white hover:border-brand-green transition-all">
                      <Pencil size={12} /> Edit
                    </button>
                  </div>
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
      <Modal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingCustomer(null); }} title="Edit Customer">
        <div className="space-y-4">
          {editCustomerPlots.length > 0 && (
            <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
              <label className="block text-xs font-bold text-slate-800 mb-1">Select Booking / Plot to Edit</label>
              <select
                value={editSelectedPlotId}
                onChange={e => handleSwitchEditBooking(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-xs font-semibold bg-white text-slate-800 outline-none focus:border-brand-green"
              >
                <option value="lead_default">Lead Profile Defaults</option>
                {editCustomerPlots.map(p => {
                  const pProj = allProjects.find(pr => String(pr.id || (pr as any)._id) === String(typeof p.projectId === 'object' ? (p.projectId as any)._id : p.projectId));
                  return (
                    <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>
                      {pProj ? pProj.name : 'Project'} - Plot #{p.plotNumber}
                    </option>
                  );
                })}
              </select>
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
            <label className="block text-xs font-semibold text-slate-500 mb-1">Loan Stage</label>
            <select value={editLoanStage} onChange={e => setEditLoanStage(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium">
              {LOAN_STAGES.filter(s => s !== 'All').map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Registration Date</label>
            <input
              type="date"
              value={editExpectedRegistrationDate}
              onChange={e => setEditExpectedRegistrationDate(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Follower Name</label>
            <FollowerAutocomplete
              id="cust-follower-name"
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
              list="existing-banks-list"
              value={editBank}
              onChange={e => handleBankChange(e.target.value)}
              placeholder="Select existing or type new bank name..."
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
            />
            <datalist id="existing-banks-list">
              {existingBanks.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setEditModalOpen(false); setEditingCustomer(null); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-brand-green text-white rounded-lg text-sm font-semibold hover:bg-brand-green/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Side Slide Filter Drawer */}
      <Drawer open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} title="Filter Loans">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Loan Stage</label>
            <select
              value={filters.loanStageFilter}
              onChange={e => updateFilter('loanStageFilter', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-amber-50/60 text-amber-900 border-amber-200 focus:border-brand-green outline-none"
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
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
            >
              <option value="All">All Projects</option>
              {allProjects.map(p => <option key={p.id} value={p.id}>{p.name} [{p.displayId}]</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
            <select
              value={filters.bankFilter}
              onChange={e => updateFilter('bankFilter', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
            >
              <option value="All">All Banks</option>
              {allBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
            <select
              value={filters.paymentStatusFilter}
              onChange={e => updateFilter('paymentStatusFilter', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Advance Paid">Advance Paid</option>
              <option value="Advance Not Paid">Advance Not Paid</option>
              <option value="Fully Paid">Fully Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Not Paid">Not Paid</option>
            </select>
          </div>

          {allUsers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Booked By</label>
              <select
                value={filters.bookedByFilter}
                onChange={e => updateFilter('bookedByFilter', e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
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
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date Range (To)</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => updateFilter('dateTo', e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none"
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
