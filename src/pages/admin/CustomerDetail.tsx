import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Building2, Home, Clock, ExternalLink, Pencil, CreditCard, FileCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { Modal } from '@/components/shared/Modal';
import { leadService, projectService, plotService, taskService, userService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { formatDate, formatSource } from '@/lib/utils';
import {
  formatBookingSelectLabel,
  resolveProjectForPlot,
  asEntityId,
} from '@/lib/customerBookingRows';
import { DetailSkeletonPage } from '@/components/shared/SkeletonLoader';
import { FollowerAutocomplete } from '@/components/shared/FollowerAutocomplete';
import type { Lead, Project, Plot } from '@/types';

const isMongoHexId = (val?: any): boolean => {
  if (!val) return false;
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
};

interface ResolvedStaff {
  name: string;
  displayId?: string;
}

const resolveAssignedStaff = (
  lead?: Lead | null,
  plot?: Plot | null,
  users?: { id: string; name: string; displayId?: string; role: string }[]
): ResolvedStaff => {
  let name = '';
  let displayId = '';

  // 1. Check plot bookedBy staff
  const bStaffName = plot?.bookedBy?.staffName?.trim();
  const bStaffDisplay = plot?.bookedBy?.staffDisplayId?.trim();
  if (bStaffName && !isMongoHexId(bStaffName)) name = bStaffName;
  if (bStaffDisplay && !isMongoHexId(bStaffDisplay)) displayId = bStaffDisplay;

  // 2. Check plot assignedToName / assignedToDisplayId
  const pAssignedName = (plot as any)?.assignedToName?.trim();
  const pAssignedDisplay = (plot as any)?.assignedToDisplayId?.trim();
  if (!name && pAssignedName && !isMongoHexId(pAssignedName)) name = pAssignedName;
  if (!displayId && pAssignedDisplay && !isMongoHexId(pAssignedDisplay)) displayId = pAssignedDisplay;

  // 3. Check lead assignedTo (if populated object)
  if (lead?.assignedTo && typeof lead.assignedTo === 'object') {
    const uObj = lead.assignedTo as any;
    if (!name && uObj.name && !isMongoHexId(uObj.name)) name = uObj.name.trim();
    if (!displayId && uObj.displayId && !isMongoHexId(uObj.displayId)) displayId = uObj.displayId.trim();
  }

  // 4. Check lead assignedToName / assignedToDisplayId
  const lStaffName = lead?.assignedToName?.trim();
  const lStaffDisplay = lead?.assignedToDisplayId?.trim();
  if (!name && lStaffName && !isMongoHexId(lStaffName)) name = lStaffName;
  if (!displayId && lStaffDisplay && !isMongoHexId(lStaffDisplay)) displayId = lStaffDisplay;

  // 5. Check in users list by candidate IDs
  const candidateIds = [
    typeof lead?.assignedTo === 'string' ? lead.assignedTo : (lead?.assignedTo as any)?._id || (lead?.assignedTo as any)?.id,
    plot?.assignedTo,
    plot?.bookedBy?.staffId,
    displayId,
  ].filter(Boolean).map(id => String(id).trim());

  if (users && users.length > 0) {
    for (const cand of candidateIds) {
      const found = users.find(u =>
        String(u.id) === cand ||
        (u.displayId && u.displayId.toUpperCase() === cand.toUpperCase())
      );
      if (found) {
        if (!name && found.name && !isMongoHexId(found.name)) name = found.name.trim();
        if (!displayId && found.displayId) displayId = found.displayId.trim();
      }
    }
  }

  // 6. If name still missing and displayId exists (e.g. STAFF-1), search in users
  if (!name && displayId && users && users.length > 0) {
    const found = users.find(u => u.displayId && u.displayId.toUpperCase() === displayId.toUpperCase());
    if (found?.name && !isMongoHexId(found.name)) name = found.name.trim();
  }

  // 7. Fallback if raw assigned is non-hex and not a STAFF- ID
  const rawAssigned = typeof lead?.assignedTo === 'string' ? lead.assignedTo.trim() : '';
  if (!name && rawAssigned && !isMongoHexId(rawAssigned) && !rawAssigned.toUpperCase().startsWith('STAFF-')) {
    name = rawAssigned;
  }

  if (isMongoHexId(name)) name = '';
  if (isMongoHexId(displayId)) displayId = '';

  return { name, displayId };
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

function PlotCard({ plot, role = 'admin' }: { plot: Plot; role?: string }) {
  const navigate = useNavigate();
  const projId = typeof plot.projectId === 'object' ? (plot.projectId as any)._id || (plot.projectId as any).id : plot.projectId;
  const plotId = plot.id || (plot as any)._id;

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Home size={14} className="text-brand-blue" /> Plot #{plot.plotNumber}</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={plot.status} />
            {projId && (
              <button
                type="button"
                onClick={() => navigate(`/${role}/projects/${projId}?plotId=${plotId}`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-brand-green hover:bg-brand-darkgreen text-white text-[11px] font-semibold rounded shadow-sm transition-all active:scale-[0.98]"
                title={`Open project layout and select Plot #${plot.plotNumber}`}
              >
                <ExternalLink size={12} /> Visit
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
          <div><span className="text-slate-400">Size:</span> <span className="font-semibold text-slate-800">{plot.size} {plot.sizeUnit}</span></div>
          <div><span className="text-slate-400">Facing:</span> <span className="font-semibold text-slate-800">{plot.facing}</span></div>
          <div><span className="text-slate-400">Type:</span> <span className="font-semibold text-slate-800">{plot.type}</span></div>
          <div>
            <span className="text-slate-400">Payment:</span>{' '}
            <span className={`font-bold ${plot.bookedBy?.paymentStatus === 'Fully Paid' ? 'text-emerald-700' : plot.bookedBy?.paymentStatus === 'Partially Paid' ? 'text-amber-700' : 'text-rose-600'}`}>
              {plot.bookedBy?.paymentStatus || 'Not Paid'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegistrationsView = location.pathname.includes('/registrations');
  const { role, user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allPlots, setAllPlots] = useState<Plot[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; displayId?: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const followUpSectionRef = useRef<HTMLDivElement>(null);
  const initializedIdRef = useRef<string | null>(null);
  const [highlightFollowUps, setHighlightFollowUps] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('highlightFollowups') === 'true' || params.get('tab') === 'followups') {
      setHighlightFollowUps(true);
      const scrollTimer = setTimeout(() => {
        followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);

      const clearTimer = setTimeout(() => {
        setHighlightFollowUps(false);
      }, 5000);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [location.search]);

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

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLead(null);
    setSelectedPlotId('');
    initializedIdRef.current = null;

    (async () => {
      const searchParams = new URLSearchParams(location.search || window.location.search);
      const plotIdFromQuery = searchParams.get('plotId') || '';
      const phoneFromQuery = searchParams.get('phone') || '';
      const tabFromQuery = searchParams.get('tab') || '';
      const reqStatus = isRegistrationsView
        ? (tabFromQuery === 'registered' ? 'Registered' : 'Booked')
        : undefined;

      const bookingParams: { leadId?: string; plotId?: string; phone?: string; status?: string } = {
        leadId: id,
        plotId: plotIdFromQuery || undefined,
        phone: phoneFromQuery || undefined,
        status: reqStatus,
      };

      const [lRes, pRes, bookingRes, plotRes, adminRes, staffRes] = await Promise.allSettled([
        leadService.getById(id),
        projectService.getAll({ limit: 200 }),
        plotService.getCustomerBookings(bookingParams),
        plotIdFromQuery ? plotService.getById(plotIdFromQuery) : Promise.resolve({ data: null as any }),
        userService.getAll({ role: 'admin', limit: 100 }),
        userService.getAll({ role: 'staff', limit: 200 }),
      ]);

      const admins = adminRes.status === 'fulfilled' ? (adminRes.value.data || []).map((u: any) => ({
        id: u.id || u._id,
        name: u.name || '',
        displayId: u.displayId || '',
        role: 'admin',
      })) : [];
      const staff = staffRes.status === 'fulfilled' ? (staffRes.value.data || []).map((u: any) => ({
        id: u.id || u._id,
        name: u.name || '',
        displayId: u.displayId || '',
        role: 'staff',
      })) : [];
      const fetchedUsers = [...admins, ...staff];

      const fetchedProjects = pRes.status === 'fulfilled' ? (pRes.value.data || []) : [];
      let fetchedLead: Lead | null =
        lRes.status === 'fulfilled' && lRes.value?.data ? (lRes.value.data as Lead) : null;
      let bookings: Plot[] = bookingRes.status === 'fulfilled' ? (bookingRes.value.data || []) : [];
      const singlePlot = plotRes.status === 'fulfilled' && plotRes.value?.data ? (plotRes.value.data as Plot) : null;

      const mergePlot = (plot: Plot) => {
        const sid = asEntityId(plot.id || (plot as { _id?: string })._id);
        if (!sid) return;
        if (!bookings.some((p) => asEntityId(p.id || (p as { _id?: string })._id) === sid)) {
          bookings = [...bookings, plot];
        }
      };

      if (singlePlot) mergePlot(singlePlot);

      const tryLeadId = (raw?: unknown) => asEntityId(raw);
      if (!fetchedLead) {
        const fromPlot = bookings[0] || singlePlot;
        const bLeadId = tryLeadId(
          (fromPlot as { bookedBy?: { leadId?: string }; leadId?: string } | null)?.bookedBy?.leadId
            || (fromPlot as { leadId?: string } | null)?.leadId
        );
        if (bLeadId && bLeadId !== id) {
          try {
            const bRes = await leadService.getById(bLeadId);
            if (bRes?.data) fetchedLead = bRes.data as Lead;
          } catch {
            // ignore
          }
        }
      }

      if (fetchedLead?.phone || phoneFromQuery || fetchedLead) {
        try {
          const more = await plotService.getCustomerBookings({
            leadId: asEntityId(fetchedLead?.id || (fetchedLead as { _id?: string } | null)?._id) || id,
            phone: fetchedLead?.phone || phoneFromQuery || undefined,
            plotId: plotIdFromQuery || undefined,
            status: reqStatus,
          });
          (more.data || []).forEach(mergePlot);
        } catch {
          // ignore
        }
      }

      if (!fetchedLead) {
        const fromPlot = bookings[0] || singlePlot;
        if (fromPlot?.bookedBy) {
          fetchedLead = {
            id: tryLeadId(fromPlot.bookedBy.leadId) || asEntityId(fromPlot.id || (fromPlot as { _id?: string })._id),
            customerName: fromPlot.bookedBy.name,
            phone: fromPlot.bookedBy.phone,
            paymentMethod: fromPlot.bookedBy.paymentMethod,
            paymentStatus: fromPlot.bookedBy.paymentStatus,
            loanStage: fromPlot.bookedBy.loanStage,
            bank: fromPlot.bookedBy.bank,
            bankFollowerName: fromPlot.bookedBy.bankFollowerName,
            bankFollowerPhone: fromPlot.bookedBy.bankFollowerPhone,
            status: 'Customer',
          } as Lead;
        }
      }

      if (cancelled) return;
      setProjects(fetchedProjects);
      setAllPlots(bookings);
      setAllUsers(fetchedUsers);
      setLead(fetchedLead);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, location.search]);

  // Find all plots booked by this customer (match by direct plotId link, plot id, name, or trailing 10-digit phone)
  const customerPlots = useMemo(() => {
    const tabParam = new URLSearchParams(location.search).get('tab');
    const seen = new Set<string>();
    let fromBookings = allPlots.filter((p) => {
      const pid = asEntityId(p.id || (p as { _id?: string })._id);
      if (!pid || seen.has(pid)) return false;
      if (isRegistrationsView) {
        if (tabParam === 'registered') {
          if (p.status !== 'Registered') return false;
        } else {
          if (!['Booked', 'Pending'].includes(p.status)) return false;
        }
      } else {
        if (!['Booked', 'Registered', 'Pending'].includes(p.status)) return false;
      }
      seen.add(pid);
      return true;
    });

    fromBookings.sort((a, b) => {
      const pa = resolveProjectForPlot(a, projects);
      const pb = resolveProjectForPlot(b, projects);
      const na = pa?.name || '';
      const nb = pb?.name || '';
      if (na !== nb) return na.localeCompare(nb);
      return String(a.plotNumber).localeCompare(String(b.plotNumber), undefined, { numeric: true });
    });

    if (fromBookings.length > 0) return fromBookings;
    if (!lead) return [];

    const directPlotId = typeof lead.plotId === 'object' ? (lead.plotId as any)?._id || (lead.plotId as any)?.id : lead.plotId;
    const fromPlotIds = (lead.plotIds || []).map((pid: any) =>
      String(typeof pid === 'object' ? pid._id || pid.id : pid)
    ).filter(Boolean);
    const plotIdSet = new Set<string>(fromPlotIds);
    if (directPlotId) plotIdSet.add(String(directPlotId));
    const leadPhone10 = lead.phone ? lead.phone.replace(/\D/g, '').slice(-10) : '';
    const leadName = lead.customerName ? lead.customerName.toLowerCase().trim() : '';

    return allPlots.filter(p => {
      if (isRegistrationsView) {
        if (tabParam === 'registered') {
          if (p.status !== 'Registered') return false;
        } else {
          if (!['Booked', 'Pending'].includes(p.status)) return false;
        }
      } else {
        if (!['Booked', 'Registered', 'Pending'].includes(p.status)) return false;
      }
      const pId = p.id || (p as any)._id;
      if (String(pId) === String(id)) return true;
      if (plotIdSet.has(String(pId))) return true;
      if (directPlotId && String(pId) === String(directPlotId)) return true;
      const pPhone10 = p.bookedBy?.phone ? p.bookedBy.phone.replace(/\D/g, '').slice(-10) : '';
      const phoneMatch = Boolean(pPhone10 && leadPhone10 && pPhone10 === leadPhone10);
      const nameMatch = Boolean(!leadPhone10 && p.bookedBy?.name && leadName && p.bookedBy.name.toLowerCase().trim() === leadName);
      return phoneMatch || nameMatch;
    });
  }, [allPlots, lead, id, location.search, isRegistrationsView, projects]);

  // Group plots by project
  const plotsByProject = useMemo(() => {
    const grouped: { project: Project; plots: Plot[] }[] = [];
    const projMap = new Map<string, Plot[]>();
    customerPlots.forEach(p => {
      const pid = typeof p.projectId === 'object' && p.projectId !== null
        ? String((p.projectId as any)._id || (p.projectId as any).id)
        : String(p.projectId || '');
      if (pid) {
        if (!projMap.has(pid)) projMap.set(pid, []);
        projMap.get(pid)!.push(p);
      }
    });
    projMap.forEach((plots, pid) => {
      let project = projects.find(pr => String(pr.id || (pr as unknown as {_id:string})._id) === pid);
      if (!project && plots[0] && typeof plots[0].projectId === 'object' && plots[0].projectId !== null) {
        project = plots[0].projectId as any;
      }
      if (!project) {
        project = {
          id: pid,
          name: 'Project',
          displayId: '',
          location: '',
          status: 'Active',
        } as Project;
      }
      grouped.push({ project, plots });
    });
    return grouped;
  }, [customerPlots, projects]);

  const [selectedPlotId, setSelectedPlotId] = useState<string>('');

  const activeSelectedPlot = useMemo(() => {
    if (!selectedPlotId) return null;
    return customerPlots.find((p) => String(p.id || (p as any)._id) === String(selectedPlotId)) || null;
  }, [customerPlots, selectedPlotId]);

  useEffect(() => {
    if (customerPlots.length === 0) return;

    const params = new URLSearchParams(location.search);
    const plotFromQuery = params.get('plotId');

    const hasPlot = (plotId: string) =>
      customerPlots.some((p) => String(p.id || (p as any)._id) === String(plotId));

    if (plotFromQuery && hasPlot(plotFromQuery)) {
      setSelectedPlotId(plotFromQuery);
      initializedIdRef.current = id || null;
      return;
    }
    if (id && hasPlot(id)) {
      setSelectedPlotId(String(id));
      initializedIdRef.current = id;
      return;
    }
    if (!selectedPlotId || !hasPlot(selectedPlotId)) {
      const first = customerPlots[0];
      setSelectedPlotId(String(first.id || (first as any)._id));
    }
  }, [customerPlots, id, location.search]);

  const showBankFollowerInDetail = useMemo(() => {
    if (!activeSelectedPlot) return false;
    const pMethod =
      activeSelectedPlot.bookedBy?.paymentMethod || lead?.paymentMethod || 'CASH';
    return pMethod === 'LOAN';
  }, [activeSelectedPlot, lead]);

  const showPaymentMethodInDetail = useMemo(() => Boolean(activeSelectedPlot), [activeSelectedPlot]);

  const isUpcomingView = useMemo(() => {
    return location.search.includes('tab=upcoming') || (activeSelectedPlot && activeSelectedPlot.status !== 'Registered');
  }, [location.search, activeSelectedPlot]);

  const daysPassedFromBooking = useMemo(() => {
    const p = activeSelectedPlot || customerPlots[0];
    let bStr: string | undefined = undefined;
    if (p?.bookedBy?.bookingDate) bStr = String(p.bookedBy.bookingDate);
    else if (p?.bookedBy?.bookedAt) bStr = String(p.bookedBy.bookedAt);
    else if (p?.bookedBy?.date) bStr = String(p.bookedBy.date);
    else if ((p as any)?.bookedDate) bStr = String((p as any).bookedDate);

    if (!bStr && p?.timeline && Array.isArray(p.timeline)) {
      const bEvt = p.timeline.find((t: any) =>
        t.type === 'plot_booked' ||
        t.type === 'booking_confirmed' ||
        t.type === 'booking_requested' ||
        (t.label && t.label.toLowerCase().includes('book'))
      );
      if (bEvt?.date) bStr = String(bEvt.date);
    }

    if (!bStr && lead?.dateAdded) bStr = String(lead.dateAdded);
    if (!bStr && (lead as any)?.createdAt) bStr = String((lead as any).createdAt);
    if (!bStr && (p as any)?.createdAt) bStr = String((p as any).createdAt);

    if (!bStr) return null;

    try {
      const bDate = new Date(bStr.split('T')[0]);
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
  }, [activeSelectedPlot, customerPlots, lead]);

  const filteredPlotsByProject = useMemo(() => {
    if (!selectedPlotId) return [];
    const result: { project: Project; plots: Plot[] }[] = [];
    plotsByProject.forEach((group) => {
      const matching = group.plots.filter(
        (p) => String(p.id || (p as any)._id) === String(selectedPlotId)
      );
      if (matching.length > 0) {
        result.push({ project: group.project, plots: matching });
      }
    });
    return result;
  }, [plotsByProject, selectedPlotId]);

  /* ── edit modal state ── */
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPaymentStatus, setEditPaymentStatus] = useState('Not Paid');
  const [editBank, setEditBank] = useState('');
  const [editBankFollowerName, setEditBankFollowerName] = useState('');
  const [editBankFollowerPhone, setEditBankFollowerPhone] = useState('');
  const [editLoanStage, setEditLoanStage] = useState('Not Applied');
  const [editExpectedRegistrationDate, setEditExpectedRegistrationDate] = useState('');
  const [editRegistrationDate, setEditRegistrationDate] = useState('');
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

  const handleOpenEditModal = () => {
    if (!activeSelectedPlot) return;
    setEditPaymentStatus(activeSelectedPlot.bookedBy?.paymentStatus || 'Advance Not Paid');
    setEditBank(activeSelectedPlot.bookedBy?.bank ?? '');
    setEditBankFollowerName(activeSelectedPlot.bookedBy?.bankFollowerName ?? '');
    setEditBankFollowerPhone(activeSelectedPlot.bookedBy?.bankFollowerPhone ?? '');
    setEditLoanStage(activeSelectedPlot.bookedBy?.loanStage || lead?.loanStage || 'Not Applied');
    setEditExpectedRegistrationDate(activeSelectedPlot.expectedRegistrationDate ? String(activeSelectedPlot.expectedRegistrationDate).split('T')[0] : '');
    setEditRegistrationDate(activeSelectedPlot.registrationDate ? String(activeSelectedPlot.registrationDate).split('T')[0] : '');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!activeSelectedPlot || !lead) return;

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
      const plotId = activeSelectedPlot.id || (activeSelectedPlot as any)._id;
      const willRegister = activeSelectedPlot.status === 'Booked' && !!editRegistrationDate;
      const updateRegistrationDate = willRegister
        || (activeSelectedPlot.status === 'Registered' && !!editRegistrationDate);
      await plotService.update(plotId, {
        ...activeSelectedPlot,
        expectedRegistrationDate: editExpectedRegistrationDate,
        ...(updateRegistrationDate ? { registrationDate: editRegistrationDate } : {}),
        bookedBy: {
          ...activeSelectedPlot.bookedBy,
          paymentStatus: editPaymentStatus,
          bank: editBank.trim(),
          bankFollowerName: editBankFollowerName.trim(),
          bankFollowerPhone: editBankFollowerPhone.trim(),
          loanStage: editLoanStage,
        },
      } as any);

      if (willRegister) {
        await plotService.registerPlot(plotId, {
          registrationDate: editRegistrationDate,
          paymentStatus: editPaymentStatus,
        }).catch(() => {});
      }

      // 2. Update lead profile
      await leadService.update(lead.id || (lead as any)._id, {
        paymentStatus: editPaymentStatus,
        bank: editBank.trim(),
        bankFollowerName: editBankFollowerName.trim(),
        bankFollowerPhone: editBankFollowerPhone.trim(),
        loanStage: editLoanStage,
        expectedRegistrationDate: editExpectedRegistrationDate,
      } as any);

      toast.success(willRegister ? 'This plot moved to Registered. Any other bookings stay in Upcoming.' : 'Booking updated successfully');
      setEditModalOpen(false);

      const [lRes, bookingRes] = await Promise.allSettled([
        leadService.getById(id!),
        plotService.getCustomerBookings({
          leadId: asEntityId(lead.id || (lead as { _id?: string })._id) || id,
          plotId,
          phone: lead.phone || undefined,
        }),
      ]);
      if (lRes.status === 'fulfilled') setLead(lRes.value.data as Lead);
      if (bookingRes.status === 'fulfilled') setAllPlots(bookingRes.value.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  /* ── confirm registration ── */
  const [confirmRegModalOpen, setConfirmRegModalOpen] = useState(false);
  const [confirmRegDate, setConfirmRegDate] = useState('');
  const [confirmingReg, setConfirmingReg] = useState(false);

  const handleConfirmRegister = async () => {
    if (!activeSelectedPlot || !lead) return;
    if (!confirmRegDate) {
      toast.error('Please select a registration date.');
      return;
    }
    setConfirmingReg(true);
    try {
      const plotId = activeSelectedPlot.id || (activeSelectedPlot as any)._id;
      await plotService.registerPlot(plotId, { registrationDate: confirmRegDate });

      // Assign post-registration tasks to the staff who booked/handled the plot/lead; fallback to admin if no staff or booked by admin
      let assigneeId: string | undefined = undefined;
      let assigneeInitials = 'AD';

      if (lead && lead.assignedTo) {
        const rawAssignedTo: any = lead.assignedTo;
        const aId = typeof rawAssignedTo === 'object' && rawAssignedTo !== null
          ? (rawAssignedTo._id || rawAssignedTo.id)
          : rawAssignedTo;
        const aName = lead.assignedToName || (typeof rawAssignedTo === 'object' && rawAssignedTo !== null ? rawAssignedTo.name : undefined);

        if (aId) {
          assigneeId = String(aId);
          assigneeInitials = aName
            ? String(aName).split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2)
            : 'ST';
        }
      }

      if (!assigneeId) {
        const staffIdCandidate = (activeSelectedPlot as any).assignedTo || (activeSelectedPlot.bookedBy as any)?.staffId;
        const staffNameCandidate = (activeSelectedPlot as any).assignedToName || (activeSelectedPlot.bookedBy as any)?.staffName;
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

      const cName = activeSelectedPlot.bookedBy?.name || lead.customerName;
      const cDispId = lead.displayId;
      const lId = lead.id || (lead as any)._id;

      // Create 4 post-registration tasks
      const tasksToCreate = [
        {
          title: `Gift handover - Plot #${activeSelectedPlot.plotNumber}`,
          description: `Gift handover for customer ${cName} of Plot #${activeSelectedPlot.plotNumber}.`,
          status: 'To Do',
          priority: 'Medium',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: activeSelectedPlot.projectId,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Document handover - Plot #${activeSelectedPlot.plotNumber}`,
          description: `Document handover for customer ${cName} of Plot #${activeSelectedPlot.plotNumber}.`,
          status: 'To Do',
          priority: 'High',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: activeSelectedPlot.projectId,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Balance payment - Plot #${activeSelectedPlot.plotNumber}`,
          description: `Balance payment for customer ${cName} of Plot #${activeSelectedPlot.plotNumber}.`,
          status: 'To Do',
          priority: 'High',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: activeSelectedPlot.projectId,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Individual chitta and patta - Plot #${activeSelectedPlot.plotNumber}`,
          description: `Individual chitta and patta transfer for customer ${cName} of Plot #${activeSelectedPlot.plotNumber}.`,
          status: 'To Do',
          priority: 'Medium',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: activeSelectedPlot.projectId,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        }
      ];

      await Promise.allSettled(tasksToCreate.map(t => taskService.create(t as any)));
      toast.success('This plot is registered. Other bookings for this customer stay in Upcoming.');
      setConfirmRegModalOpen(false);
      const [lRes, bookingRes] = await Promise.allSettled([
        leadService.getById(id!),
        plotService.getCustomerBookings({
          leadId: asEntityId(lead.id || (lead as { _id?: string })._id) || id,
          plotId: asEntityId(activeSelectedPlot.id || (activeSelectedPlot as { _id?: string })._id) || undefined,
          phone: lead.phone || undefined,
        }),
      ]);
      if (lRes.status === 'fulfilled') setLead(lRes.value.data as Lead);
      if (bookingRes.status === 'fulfilled') setAllPlots(bookingRes.value.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to register plot');
    } finally {
      setConfirmingReg(false);
    }
  };

  // Combine lead follow-ups, plot timelines, and lead creation into a single unified end-to-end timeline
  // Plot timeline events alone for Loaned Customer Details
  const combinedTimelineItems = useMemo(() => {
    if (!lead) return [];
    const items: any[] = [];

    const plotsToInclude = selectedPlotId
      ? customerPlots.filter((p) => String(p.id || (p as any)._id) === String(selectedPlotId))
      : [];

    plotsToInclude.forEach((p) => {
      const proj = resolveProjectForPlot(p, projects);
      const projName = proj ? `${proj.name} [${proj.displayId || ''}]` : 'Project';
      (p.timeline || []).forEach((t, tIdx) => {
        items.push({
          id: t.id || (t as any)._id || `pt-${p.plotNumber}-${tIdx}`,
          title: `Plot #${p.plotNumber} (${projName}) - ${t.label}`,
          subtitle: `${t.details ? `${t.details} • ` : ''}Logged on ${formatDate(t.date)}${t.actor ? ` by ${t.actor}` : ''}`,
          color: t.color === 'green' ? 'bg-emerald-500' :
                 t.color === 'blue' ? 'bg-blue-500' :
                 t.color === 'red' ? 'bg-rose-500' :
                 t.color === 'amber' ? 'bg-amber-500' : 'bg-slate-500',
          rawDate: new Date(t.date || Date.now()),
        });
      });
    });

    // Sort newest first
    items.sort((a, b) => {
      const dateA = a.rawDate.getTime();
      const dateB = b.rawDate.getTime();
      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });

    return items;
  }, [lead, customerPlots, projects, selectedPlotId]);

  // Separate Payment Timeline events
  const paymentTimelineItems = useMemo(() => {
    if (!lead) return [];
    const items: any[] = [];

    const plotsToInclude = selectedPlotId
      ? customerPlots.filter((p) => String(p.id || (p as any)._id) === String(selectedPlotId))
      : [];

    plotsToInclude.forEach((p) => {
      const proj = resolveProjectForPlot(p, projects);
      const projName = proj ? `${proj.name} [${proj.displayId || ''}]` : 'Project';
      
      if (p.bookedBy?.paymentStatus) {
        items.push({
          id: `pay-plot-${p.plotNumber}`,
          title: `Plot #${p.plotNumber} (${projName}) - Payment Status: ${p.bookedBy.paymentStatus}`,
          subtitle: `Plot Status: ${p.status} • Payment Method: ${p.bookedBy.paymentMethod || 'CASH'}`,
          color: p.bookedBy.paymentStatus === 'Fully Paid' ? 'bg-emerald-500' :
                 p.bookedBy.paymentStatus === 'Partially Paid' ? 'bg-amber-500' : 'bg-rose-500',
          rawDate: new Date((p.timeline?.[0]?.date) || (p as any).createdAt || Date.now()),
        });
      }

      // Filter payment details from plot timeline
      (p.timeline || []).forEach((t, tIdx) => {
        if (t.details && (t.details.toLowerCase().includes('advance') || t.details.toLowerCase().includes('payment'))) {
          items.push({
            id: `pay-tl-${p.plotNumber}-${tIdx}`,
            title: `Plot #${p.plotNumber} (${projName}) - ${t.label}`,
            subtitle: `${t.details}${t.actor ? ` by ${t.actor}` : ''}`,
            color: t.color === 'green' ? 'bg-emerald-500' : 'bg-blue-500',
            rawDate: new Date(t.date || Date.now()),
          });
        }
      });
    });

    // Sort newest first
    items.sort((a, b) => {
      const dateA = a.rawDate.getTime();
      const dateB = b.rawDate.getTime();
      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });

    return items;
  }, [lead, customerPlots, projects, selectedPlotId]);

  // Edit Follow-up Modal states for CustomerDetail
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [followUpOutcome, setFollowUpOutcome] = useState('Interested');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpNextAction, setFollowUpNextAction] = useState('Follow up again');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const handleEditFollowUp = (followUp: any) => {
    setEditingFollowUp(followUp);
    let dStr = new Date().toISOString().split('T')[0];
    if (followUp.date) {
      try {
        const d = new Date(followUp.date);
        if (!isNaN(d.getTime())) dStr = d.toISOString().split('T')[0];
      } catch {
        dStr = followUp.date;
      }
    }
    setFollowUpDate(dStr);
    setFollowUpOutcome(followUp.outcome || 'Interested');
    setFollowUpNotes(followUp.notes || '');
    let nextDStr = '';
    if (followUp.nextFollowUpDate) {
      try {
        const nd = new Date(followUp.nextFollowUpDate);
        if (!isNaN(nd.getTime())) nextDStr = nd.toISOString().split('T')[0];
      } catch {
        nextDStr = followUp.nextFollowUpDate;
      }
    }
    setNextFollowUpDate(nextDStr);
    setFollowUpNextAction(followUp.nextAction || 'Follow up again');
    setFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async () => {
    if (!lead || !id || !editingFollowUp) return;
    setSavingFollowUp(true);

    const targetId = editingFollowUp.id || editingFollowUp._id;
    const updatedFollowUps = (lead.followUps || []).map((fu: any, idx: number) => {
      const fuId = fu.id || fu._id || `fu-${idx}`;
      if (fuId === targetId || (editingFollowUp._index !== undefined && idx === editingFollowUp._index)) {
        return {
          ...fu,
          date: followUpDate,
          nextFollowUpDate: nextFollowUpDate || undefined,
          outcome: followUpOutcome,
          notes: followUpNotes,
          nextAction: followUpNextAction || 'Follow up again',
        };
      }
      return fu;
    });

    try {
      const updateData: any = { followUps: updatedFollowUps };
      if (nextFollowUpDate) {
        updateData.nextFollowUpDate = nextFollowUpDate;
      }
      const res = await leadService.update(id, updateData);
      setLead(res.data as any);
      toast.success('Follow-up updated successfully!');
      setFollowUpModalOpen(false);
      setEditingFollowUp(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save follow-up');
    } finally {
      setSavingFollowUp(false);
    }
  };

  if (loading) {
    return <DetailSkeletonPage />;
  }

  if (!lead) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <p className="text-slate-500">Customer not found.</p>
        <Link to={`/${role}/${isRegistrationsView ? 'registrations' : 'customers'}`} className="text-brand-blue text-sm font-semibold mt-2 inline-block">
          Back to {isRegistrationsView ? 'Registrations' : 'Loaned Customers'}
        </Link>
      </div>
    );
  }

  const projIdStr = typeof lead.projectId === 'object' ? (lead.projectId as any)?._id || (lead.projectId as any)?.id : lead.projectId;
  const project = (typeof lead.projectId === 'object' && (lead.projectId as any)?.name)
    ? lead.projectId
    : projects.find(p => String(p.id || (p as unknown as {_id:string})._id) === String(projIdStr));
  const searchParams = new URLSearchParams(location.search);
  const tabQuery = searchParams.get('tab');
  const isRegisteredTab = tabQuery === 'registered';
  const isUpcomingTab = tabQuery === 'upcoming' || (!isRegisteredTab && (activeSelectedPlot?.status === 'Booked' || (isRegistrationsView && activeSelectedPlot?.status !== 'Registered')));

  return (
    <div className="space-y-6 pb-12 max-w-full overflow-x-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(`/${role}/${isRegistrationsView ? 'registrations' : 'customers'}`);
              }
            }}
            className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-700 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {isRegisteredTab
              ? 'Registered Customer Details'
              : isUpcomingTab
              ? 'Upcoming Registration Details'
              : isRegistrationsView
              ? 'Registered Customer Details'
              : 'Loaned Customer Details'}
          </h1>
        </div>

        {customerPlots.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs min-w-0 w-full sm:w-auto">
              <Building2 size={16} className="text-brand-blue shrink-0" />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
                {customerPlots.length > 1 ? 'Project & Plot:' : 'Booking:'}
              </span>
              <select
                value={selectedPlotId}
                onChange={(e) => setSelectedPlotId(e.target.value)}
                className="h-8 min-w-0 flex-1 sm:min-w-[200px] sm:max-w-[360px] px-2.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-brand-green cursor-pointer shadow-2xs truncate"
              >
                {customerPlots.map((p) => {
                  const plotKey = String(p.id || (p as any)._id);
                  const proj = resolveProjectForPlot(p, projects);
                  const label = formatBookingSelectLabel(
                    proj?.name || 'Project',
                    proj?.displayId,
                    p.plotNumber
                  );
                  return (
                    <option key={plotKey} value={plotKey}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedPlotId && activeSelectedPlot && (
              <div className="flex items-center gap-2 shrink-0 justify-end sm:justify-start">
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 hover:bg-brand-green hover:text-white hover:border-brand-green shadow-xs transition-all cursor-pointer"
                >
                  <Pencil size={13} /> Edit
                </button>
                {activeSelectedPlot.status === 'Booked' && role !== 'staff' && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmRegDate(new Date().toISOString().split('T')[0]);
                      setConfirmRegModalOpen(true);
                    }}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-blue-200 bg-blue-50 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <FileCheck size={13} /> Confirm Register
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 min-w-0 overflow-hidden">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar initials={getInitials(lead.customerName)} size="lg" bg={getAvatarColor(lead.customerName)} />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 break-words"><NameTag name={lead.customerName} displayId={lead.displayId} /></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-slate-600 truncate">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{lead.phone}</span>
                <button
                  type="button"
                  onClick={() => setWhatsAppOpen(true)}
                  className="p-1 hover:bg-emerald-50 rounded text-emerald-600 transition-colors flex items-center justify-center shrink-0 ml-1"
                  title="Chat on WhatsApp"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.291 5.3 0 11.799 0c3.148.001 6.108 1.228 8.334 3.457 2.227 2.229 3.452 5.19 3.45 8.34-.004 6.502-5.302 11.793-11.8 11.793a11.72 11.72 0 0 1-5.905-1.582L0 24zm6.549-3.791c1.472.873 2.924 1.34 4.703 1.341 5.485 0 9.948-4.457 9.951-9.94.002-2.656-1.03-5.153-2.905-7.03C16.48 2.705 13.987 1.666 11.797 1.667c-5.49 0-9.952 4.453-9.955 9.937-.001 1.83.483 3.61 1.4 5.161l-.979 3.57 3.655-.959c1.488.81 2.927 1.233 4.689 1.233zm11.302-7.608c-.307-.154-1.821-.899-2.101-.998-.28-.1-.484-.15-.688.156-.204.307-.79.99-.968 1.2-.178.209-.356.234-.664.08-1.124-.564-1.868-.93-2.613-2.204-.199-.34-.199-.546-.073-.728.115-.164.307-.356.462-.534.156-.178.208-.303.312-.507.105-.205.052-.385-.026-.539-.078-.154-.688-1.659-.942-2.27-.247-.595-.5-.515-.688-.525-.178-.009-.382-.01-.587-.01-.205 0-.539.077-.821.385-.282.307-1.078 1.053-1.078 2.569 0 1.516 1.102 2.985 1.256 3.19.154.205 2.169 3.312 5.254 4.643.734.317 1.307.506 1.754.648.74.235 1.414.201 1.947.122.593-.088 1.821-.745 2.076-1.463.254-.718.254-1.333.178-1.463-.076-.13-.28-.205-.588-.359z"/>
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 truncate"><Mail size={14} className="text-slate-400 shrink-0" /><span className="truncate">{lead.email || '—'}</span></div>
              <div className="flex items-center gap-2 text-sm text-slate-600 truncate"><MapPin size={14} className="text-slate-400 shrink-0" /><span className="truncate">{lead.city || '—'}</span></div>
              {lead.dob && <div className="flex items-center gap-2 text-sm text-slate-600"><Calendar size={14} className="text-slate-400 shrink-0" />DOB: {formatDate(lead.dob)}</div>}
            </div>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        {/* Loan Details Grid matching active selected plot or lead */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100 min-w-0">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase">Location &amp; Source</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{lead.city ? `${lead.city} • ` : ''}{formatSource(lead.sourceType, lead.source)}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 font-medium uppercase">Assigned To</p>
            {(() => {
              const assigned = resolveAssignedStaff(lead, activeSelectedPlot, allUsers);
              return (
                <div className="mt-0.5">
                  {assigned.name ? (
                    <p className="text-sm font-bold text-slate-900">
                      {assigned.name}
                      {assigned.displayId && (
                        <span className="text-xs text-slate-400 font-medium ml-1.5">
                          ({assigned.displayId})
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-700">
                      {assigned.displayId || '—'}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {showPaymentMethodInDetail && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Payment Method</p>
              <p className={`text-sm font-bold mt-0.5 ${(activeSelectedPlot?.bookedBy?.paymentMethod || lead.paymentMethod) === 'LOAN' ? 'text-teal-600' : 'text-slate-800'}`}>{activeSelectedPlot?.bookedBy?.paymentMethod || lead.paymentMethod || 'CASH'}</p>
            </div>
          )}

          {showBankFollowerInDetail && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Bank &amp; Follower</p>
              {(() => {
                const bName = activeSelectedPlot
                  ? (activeSelectedPlot.bookedBy?.bank || '—')
                  : (lead.bank || '—');
                const fName = activeSelectedPlot
                  ? (activeSelectedPlot.bookedBy?.bankFollowerName || '')
                  : (lead.bankFollowerName || '');
                const fPhone = activeSelectedPlot
                  ? (activeSelectedPlot.bookedBy?.bankFollowerPhone || '')
                  : (lead.bankFollowerPhone || '');

                return (
                  <>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{bName}</p>
                    {fName ? (
                      <p className="text-xs text-slate-500 font-medium">
                        {fName} {fPhone ? `(${fPhone})` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic font-medium">No Follower</p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {((activeSelectedPlot?.bookedBy?.paymentMethod || lead?.paymentMethod) === 'LOAN' || (activeSelectedPlot?.bookedBy?.loanStage || lead?.loanStage)) && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Loan Stage</p>
              <div className="mt-0.5">
                <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${getLoanStageBadgeClass(activeSelectedPlot?.bookedBy?.loanStage || lead?.loanStage || 'Not Applied')}`}>
                  {activeSelectedPlot?.bookedBy?.loanStage || lead?.loanStage || 'Not Applied'}
                </span>
              </div>
            </div>
          )}

          {activeSelectedPlot && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Expected Reg. Date</p>
              {(() => {
                const expDate = activeSelectedPlot
                  ? (activeSelectedPlot.expectedRegistrationDate ? String(activeSelectedPlot.expectedRegistrationDate).split('T')[0] : '')
                  : (lead.expectedRegistrationDate ? String(lead.expectedRegistrationDate).split('T')[0] : '');
                const todayStr = new Date().toISOString().split('T')[0];
                const isToday = expDate === todayStr;
                return expDate ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-sm font-bold ${isToday ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {formatDate(expDate)}
                    </span>
                    {isToday && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 font-medium mt-0.5">--</p>
                );
              })()}
            </div>
          )}

          {activeSelectedPlot && isUpcomingView && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Days Since Booking</p>
              <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded w-fit mt-0.5 inline-flex items-center gap-1">
                <Clock size={12} className="text-amber-600" />
                {daysPassedFromBooking !== null ? `${daysPassedFromBooking} ${daysPassedFromBooking === 1 ? 'day' : 'days'} passed` : '—'}
              </p>
            </div>
          )}

          {activeSelectedPlot && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Payment Status</p>
              <div className="mt-1">
                <StatusBadge
                  status={
                    activeSelectedPlot
                      ? (activeSelectedPlot.bookedBy?.paymentStatus || 'Advance Not Paid')
                      : (lead.paymentStatus || (lead.advanceAmount && lead.advanceAmount > 0 ? 'Advance Paid' : 'Advance Not Paid'))
                  }
                />
              </div>
            </div>
          )}



          {activeSelectedPlot && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Date Added</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatDate(lead.dateAdded || (lead as any).createdAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Properties Container with fixed height and internal scroll */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
            <Building2 size={18} /> Selected booking
            {customerPlots.length > 1 && (
              <span className="text-xs font-semibold text-brand-blue ml-1">
                (+{customerPlots.length - 1} more in dropdown)
              </span>
            )}
          </h3>
        </div>
        {filteredPlotsByProject.length === 0 ? (
          <p className="text-sm text-slate-400">No plots found for the selected view.</p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-4">
            {filteredPlotsByProject.map(({ project: proj, plots }) => (
              <div key={proj.id || (proj as unknown as {_id:string})._id} className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-slate-50/50 min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 mb-3 min-w-0">
                  <Building2 size={16} className="text-brand-blue shrink-0" />
                  <span className="text-sm font-bold text-slate-800 break-words"><NameTag name={proj.name} displayId={proj.displayId} /></span>
                  <span className="text-xs text-slate-400 break-words">• {proj.location}</span>
                  <StatusBadge status={proj.status} />
                </div>
                <div className="space-y-3">
                  {plots.map(plot => {
                    const plotId = plot.id || (plot as unknown as {_id:string})._id;
                    return (
                      <PlotCard key={plotId} plot={plot} role={role || undefined} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-up History Container */}
      <div
        ref={followUpSectionRef}
        className={`bg-white rounded-lg border shadow-sm p-4 sm:p-6 min-w-0 overflow-hidden transition-all duration-700 ${
          highlightFollowUps
            ? 'border-amber-400 ring-4 ring-amber-300/80 bg-amber-50/40 shadow-lg scale-[1.01]'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={18} className="text-amber-500" /> Follow-up History
            </h3>
            <span className="text-xs text-slate-400 font-medium">{(lead.followUps || []).length} Total Follow-ups</span>
          </div>
        </div>

        {(!lead.followUps || lead.followUps.length === 0) ? (
          <p className="text-sm text-slate-400">No follow-ups recorded for this customer.</p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3">
            {lead.followUps.map((followUp: any, fIdx: number) => (
              <div key={followUp.id || followUp._id || fIdx} className="rounded-lg border border-slate-200 p-4 bg-slate-50/70 hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-800">{followUp.outcome}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {formatDate(followUp.date)}
                    </span>
                    <button
                      onClick={() => handleEditFollowUp({ ...followUp, _index: fIdx })}
                      className="p-1 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded transition-colors"
                      title="Edit Follow-up"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
                {followUp.notes && <p className="text-sm text-slate-600 mt-2">{followUp.notes}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-flex font-medium">Next: {followUp.nextAction || 'Follow up again'}</span>
                  {followUp.nextFollowUpDate && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 inline-flex items-center gap-1 font-semibold">
                      <Calendar size={12} className="text-emerald-600" /> Scheduled: {formatDate(followUp.nextFollowUpDate)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plot Timeline Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2 min-w-0">
            <Clock size={18} className="text-brand-blue shrink-0" /> Plot Timeline
            {activeSelectedPlot && (
              <span className="text-xs font-medium text-slate-500 break-words">
                — {formatBookingSelectLabel(
                  resolveProjectForPlot(activeSelectedPlot, projects)?.name || 'Project',
                  resolveProjectForPlot(activeSelectedPlot, projects)?.displayId,
                  activeSelectedPlot.plotNumber
                )}
              </span>
            )}
          </h3>
        </div>
        
        {combinedTimelineItems.length === 0 ? (
          <p className="text-sm text-slate-400">No plot timeline events recorded for this selection.</p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto pr-2">
            <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5 py-1">
              {combinedTimelineItems.map((item) => (
                <div key={item.id} className="relative text-xs">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow ${item.color}`} />
                  <p className="font-semibold text-slate-800 break-words">{item.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 break-words">{item.subtitle}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Date: {formatDate(item.rawDate ? item.rawDate.toISOString() : undefined)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Separate Payment Timeline Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard size={18} className="text-brand-green shrink-0" /> Payment Timeline
          </h3>
          <StatusBadge status={activeSelectedPlot?.bookedBy?.paymentStatus || lead.paymentStatus || 'Not Paid'} />
        </div>
        
        {paymentTimelineItems.length === 0 ? (
          <p className="text-sm text-slate-400">No payment timeline events recorded.</p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto pr-2">
            <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5 py-1">
              {paymentTimelineItems.map((item) => (
                <div key={item.id} className="relative text-xs">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow ${item.color}`} />
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Date: {formatDate(item.rawDate ? item.rawDate.toISOString() : undefined)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {whatsAppOpen && (
        <WhatsAppChatModal
          open={whatsAppOpen}
          onClose={() => setWhatsAppOpen(false)}
          phone={lead.phone}
          name={lead.customerName}
          projectName={project ? `${project.name} [${project.displayId}]` : ''}
        />
      )}

      {/* Edit Follow-up Modal */}
      {followUpModalOpen && (
        <Modal
          open={followUpModalOpen}
          onClose={() => { setFollowUpModalOpen(false); setEditingFollowUp(null); }}
          title="Edit Follow-up"
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-up Date 📅</label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={e => setNextFollowUpDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outcome</label>
              <select
                value={followUpOutcome}
                onChange={e => setFollowUpOutcome(e.target.value)}
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
                value={followUpNextAction}
                onChange={e => setFollowUpNextAction(e.target.value)}
                placeholder="e.g. Schedule site visit / Send brochure"
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Discussion Details</label>
              <textarea
                value={followUpNotes}
                onChange={e => setFollowUpNotes(e.target.value)}
                rows={3}
                placeholder="Details of the conversation..."
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green resize-y min-h-[80px]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setFollowUpModalOpen(false); setEditingFollowUp(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFollowUp}
                disabled={savingFollowUp}
                className="px-4 py-2 bg-brand-green text-white text-sm font-semibold rounded-lg hover:bg-brand-darkgreen disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {savingFollowUp ? 'Updating...' : 'Update Follow-up'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Booking Modal */}
      {editModalOpen && (
        <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Booking">
          <div className="space-y-4">
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
              <select value={editLoanStage} onChange={e => setEditLoanStage(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none font-medium cursor-pointer">
                {LOAN_STAGES.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>

            {(activeSelectedPlot?.status === 'Booked' || activeSelectedPlot?.status === 'Registered') && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Registration Date</label>
                <input
                  type="date"
                  value={editRegistrationDate}
                  onChange={e => setEditRegistrationDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none"
                />
                {activeSelectedPlot?.status === 'Booked' && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    If you set this date, only this plot is registered. Other bookings stay in Upcoming.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Registration Date</label>
              <input
                type="date"
                value={editExpectedRegistrationDate}
                onChange={e => setEditExpectedRegistrationDate(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none"
              />
            </div>

            {showBankFollowerInDetail && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Bank Follower Name</label>
                  <FollowerAutocomplete
                    id="cd-follower-name"
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
                    list="cd-banks-list"
                    value={editBank}
                    onChange={e => handleBankChange(e.target.value)}
                    placeholder="Select existing or type new bank name..."
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
                  />
                  <datalist id="cd-banks-list">
                    {existingBanks.map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-brand-green text-white rounded-lg text-sm font-semibold hover:bg-brand-green/90 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Register Modal */}
      {confirmRegModalOpen && (
        <Modal open={confirmRegModalOpen} onClose={() => setConfirmRegModalOpen(false)} title="Confirm Registration">
          <div className="space-y-5">
            {activeSelectedPlot?.bookedBy?.paymentStatus !== 'Fully Paid' && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
                <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Warning: Payment Not Fully Paid</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Customer payment status is currently <strong>{activeSelectedPlot?.bookedBy?.paymentStatus || 'Not Paid'}</strong>. You can still select the registration date below and confirm registration.
                  </p>
                </div>
              </div>
            )}

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <FileCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800">Confirm Plot Registration</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Plot #{activeSelectedPlot?.plotNumber} will be marked as <span className="font-bold">Registered</span>. Select the registration date below.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Registration Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={confirmRegDate}
                onChange={e => setConfirmRegDate(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-medium"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setConfirmRegModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegister}
                disabled={confirmingReg || !confirmRegDate}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <FileCheck size={14} />
                {confirmingReg ? 'Registering...' : 'Confirm Register'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
