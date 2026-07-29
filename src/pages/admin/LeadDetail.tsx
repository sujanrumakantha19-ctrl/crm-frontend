import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Mail, MapPin, Phone, Tag, UserRound, Calendar, Edit, ChevronDown, ChevronUp, AlertCircle, Plus, ExternalLink, AlertTriangle, X, Pencil, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { getAvatarColor, getInitials } from '@/data/mockData';
import { leadService, projectService, plotService, userService, channelPartnerService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import type { LeadStatus, Lead, Project, Plot, User } from '@/types';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { NameTag } from '@/components/shared/NameTag';
import { getYesterdayStr, formatSource } from '@/lib/utils';
import { DetailSkeletonPage } from '@/components/shared/SkeletonLoader';

export default function AdminLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const backPath = `/${role}/leads`;

  const [leadState, setLeadState] = useState<Lead | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allPlots, setAllPlots] = useState<Record<string, Plot[]>>({});
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [channelPartners, setChannelPartners] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const followUpSectionRef = useRef<HTMLDivElement>(null);
  const [highlightFollowUps, setHighlightFollowUps] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('highlightFollowups') === 'true' || params.get('tab') === 'followups' || params.get('from') === 'followups') {
      setHighlightFollowUps(true);
      if (!loading) {
        const scrollTimer = setTimeout(() => {
          followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);

        const clearTimer = setTimeout(() => {
          setHighlightFollowUps(false);
        }, 5000);

        return () => {
          clearTimeout(scrollTimer);
          clearTimeout(clearTimer);
        };
      }
    }
  }, [location.search, loading]);

  // Follow-up Modal states
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [followUpOutcome, setFollowUpOutcome] = useState('Interested');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpNextAction, setFollowUpNextAction] = useState('Follow up again');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

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

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      const [lRes, pRes, sRes, plRes, cpRes] = await Promise.allSettled([
        leadService.getById(id),
        projectService.getAll({ limit: 100 }),
        userService.getAll({ role: 'staff', limit: 100 }),
        plotService.getAll({ limit: 100 }),
        channelPartnerService.getAll({ limit: 100 }),
      ]);

      if (lRes.status === 'fulfilled') setLeadState(lRes.value.data as Lead);
      if (pRes.status === 'fulfilled') setProjects(pRes.value.data || []);
      if (sRes.status === 'fulfilled') setStaffUsers(sRes.value.data || []);
      if (cpRes.status === 'fulfilled') setChannelPartners(cpRes.value.data || []);

      if (plRes.status === 'fulfilled') {
        const allPlots = plRes.value.data || [];
        const plotsByProject: Record<string, Plot[]> = {};
        allPlots.forEach((p: Plot) => {
          const pid = typeof p.projectId === 'object' ? (p.projectId as any)._id || (p.projectId as any).id : p.projectId;
          if (pid) {
            if (!plotsByProject[pid]) plotsByProject[pid] = [];
            plotsByProject[pid].push(p);
          }
        });
        setAllPlots(plotsByProject);
      }
      setLoading(false);
    })();
  }, [id]);

  const [editOpen, setEditOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(true);

  // Edit form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceType, setSourceType] = useState('Direct');
  const [source, setSource] = useState('Direct Intake');
  const [assignedTo, setAssignedTo] = useState('');
  const [propertyInterest, setPropertyInterest] = useState('Residential Plot');
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<LeadStatus>('Open');
  const [paymentStatus, setPaymentStatus] = useState<'Not Paid' | 'Partially Paid' | 'Fully Paid'>('Not Paid');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');

  // Duplicate phone state
  const [duplicateLead, setDuplicateLead] = useState<{ id: string; displayId?: string; phone: string; status: string; assignedToName?: string; assignedToDisplayId?: string } | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const lastCheckedPhoneRef = useRef<string>('');

  const handlePhoneChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setPhone(clean);

    const currentId = leadState?.id || (leadState as any)?._id;

    if (clean.length === 10) {
      if (lastCheckedPhoneRef.current === clean) return;
      lastCheckedPhoneRef.current = clean;
      setCheckingPhone(true);
      try {
        const res = await leadService.checkPhone(clean);
        if (res.exists && res.lead && String(res.lead.id) !== String(currentId)) {
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
    setPhone('');
    lastCheckedPhoneRef.current = '';
    setDuplicateLead(null);
  };

  useEffect(() => {
    if (leadState) {
      setName(leadState.customerName || '');
      setPhone(leadState.phone || '');
      setEmail(leadState.email || '');
      setCity(leadState.city || '');
      setDob(leadState.dob || '');
      setNotes(leadState.notes || '');
      setSourceType(leadState.sourceType || 'Direct');
      setSource(leadState.source || 'Direct Intake');
      const assignedToId = typeof leadState.assignedTo === 'object' && leadState.assignedTo !== null ? (leadState.assignedTo as any)._id || (leadState.assignedTo as any).id : leadState.assignedTo;
      setAssignedTo(assignedToId || '');
      setPropertyInterest(leadState.propertyInterest || 'Residential Plot');
      setBudget(leadState.budget ? String(leadState.budget) : '');
      setCategory(leadState.category || '');
      setGender(leadState.gender || 'Male');
      setStatus(leadState.status || 'Open');
      setPaymentStatus(leadState.paymentStatus || 'Not Paid');
      setDuplicateLead(null);
    }
  }, [leadState]);

  const lead = leadState;
  const leadIdStr = leadState?.id || (leadState as any)?._id;
  const projectIdStr = typeof leadState?.projectId === 'object' && leadState?.projectId !== null ? (leadState.projectId as any)._id || (leadState.projectId as any).id : leadState?.projectId;
  const plotIdStr = typeof leadState?.plotId === 'object' && leadState?.plotId !== null ? (leadState.plotId as any)._id || (leadState.plotId as any).id : leadState?.plotId;

  const project = projects.find(p => (p.id || (p as unknown as {_id:string})._id) === projectIdStr);
  const plot = projectIdStr && plotIdStr ? (allPlots[projectIdStr as string] || []).find(p => (p.id || (p as unknown as {_id:string})._id) === plotIdStr) : undefined;

  // Search bookings across all projects
  const customerBookings = useMemo(() => {
    if (!leadState) return [];
    const list: any[] = [];
    projects.forEach(proj => {
      const plots = allPlots[proj.id || (proj as any)._id] || [];
      plots.forEach(p => {
        const leadNameStr = leadState.customerName ? leadState.customerName.toLowerCase() : '';
        const matchesName = (p.bookedBy?.name && p.bookedBy.name.toLowerCase() === leadNameStr) ||
                            (p.pendingApproval?.customerName && p.pendingApproval.customerName.toLowerCase() === leadNameStr);
        const matchesPhone = (p.bookedBy?.phone && p.bookedBy.phone === leadState.phone) ||
                             (p.pendingApproval?.phone && p.pendingApproval.phone === leadState.phone);
        
        if (matchesName || matchesPhone) {
          list.push({
            project: proj,
            plot: p,
            status: p.status,
            paymentStatus: p.bookedBy?.paymentStatus || p.pendingApproval?.paymentStatus || 'Not Paid',
            facing: p.facing,
            size: p.size,
            sizeUnit: p.sizeUnit
          });
        }
      });
    });
    if (list.length === 0 && project && plot) {
      list.push({
        project,
        plot,
        status: plot.status,
        paymentStatus: leadState.paymentStatus || 'Not Paid',
        facing: plot.facing,
        size: plot.size,
        sizeUnit: plot.sizeUnit,
      });
    }
    return list;
  }, [leadState, allPlots, projects, project, plot]);

  if (loading) return <DetailSkeletonPage />;

  if (!leadState) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <p className="text-slate-500">Lead not found.</p>
        <Link to={backPath} className="text-brand-blue text-sm font-semibold mt-2 inline-block">Back to Leads</Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (duplicateLead) {
      toast.error(`Phone number already belongs to existing lead ${duplicateLead.displayId || duplicateLead.id}. Click "Clear Number" to enter a different number.`);
      return;
    }

    if (dob) {
      const selectedDate = new Date(dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate >= today) {
        toast.error('Date of Birth cannot be today or a future date.');
        return;
      }
    }

    if (sourceType === 'Staff' && !source.trim()) {
      toast.error('Please select a Staff Member for lead source.');
      return;
    }

    if (sourceType === 'Channel Partner' && !source.trim()) {
      toast.error('Please select a Channel Partner for lead source.');
      return;
    }

    if ((sourceType === 'Office Referral' || sourceType === 'Client Referral') && !source.trim()) {
      toast.error('Please enter the Referrer Name for lead source.');
      return;
    }

    const staff = staffUsers.find(s => s.id === assignedTo);
    
    const finalSource = (sourceType === 'Staff' || sourceType === 'Channel Partner' || sourceType === 'Office Referral' || sourceType === 'Client Referral')
      ? (source.trim() || sourceType)
      : sourceType;

    const updated = {
      ...leadState,
      customerName: name,
      phone,
      email,
      city,
      gender,
      dob,
      notes,
      sourceType: sourceType as any,
      source: finalSource,
      assignedTo: assignedTo || undefined,
      assignedToName: staff ? staff.name : undefined,
      propertyInterest,
      budget: budget.trim() || undefined,
      category: category || undefined,
      status,
      paymentStatus
    };

    try {
      await leadService.update(leadIdStr, updated as any);
      setLeadState(updated);
      const { toast } = await import('sonner');
      toast.success('Lead updated successfully!');
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to update lead');
    }

    setEditOpen(false);
  };

  const handleOpenNewFollowUp = () => {
    setEditingFollowUp(null);
    setFollowUpDate(new Date().toISOString().split('T')[0]);
    setFollowUpOutcome('Interested');
    setFollowUpNotes('');
    setNextFollowUpDate('');
    setFollowUpNextAction('Follow up again');
    setFollowUpModalOpen(true);
  };

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
    if (!leadState) return;
    const targetLeadId = (leadState as any)._id || leadState.id || id;
    if (!targetLeadId) return;

    setSavingFollowUp(true);

    let updatedFollowUps: any[];
    if (editingFollowUp) {
      const targetId = editingFollowUp.id || editingFollowUp._id;
      updatedFollowUps = (leadState.followUps || []).map((fu: any, idx: number) => {
        const fuId = fu.id || fu._id || `fu-${idx}`;
        if (fuId === targetId || (editingFollowUp._index !== undefined && idx === editingFollowUp._index)) {
          return {
            ...fu,
            date: followUpDate || new Date().toISOString().split('T')[0],
            nextFollowUpDate: nextFollowUpDate || undefined,
            outcome: followUpOutcome || 'Interested',
            notes: followUpNotes || '',
            nextAction: followUpNextAction || 'Follow up again',
          };
        }
        return fu;
      });
    } else {
      const newFollowUp = {
        id: `fu-${Date.now()}`,
        date: followUpDate || new Date().toISOString().split('T')[0],
        nextFollowUpDate: nextFollowUpDate || undefined,
        outcome: followUpOutcome || 'Interested',
        notes: followUpNotes || '',
        nextAction: followUpNextAction || 'Follow up again',
      };
      updatedFollowUps = [...(leadState.followUps || []), newFollowUp];
    }

    try {
      const updateData: any = { followUps: updatedFollowUps };
      if (nextFollowUpDate) {
        updateData.nextFollowUpDate = nextFollowUpDate;
      }
      const res: any = await leadService.update(targetLeadId, updateData);
      if (res && res.data) {
        setLeadState(res.data as Lead);
      }
      toast.success(editingFollowUp ? 'Follow-up updated successfully!' : 'Follow-up logged successfully!');
      setFollowUpModalOpen(false);
      setEditingFollowUp(null);
      setFollowUpNotes('');
      setNextFollowUpDate('');
      setFollowUpOutcome('Interested');
      setFollowUpNextAction('Follow up again');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save follow-up');
    } finally {
      setSavingFollowUp(false);
    }
  };

  const inputClass = 'w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all';
  const selectClass = 'w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white';
  const textareaClass = 'w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-y min-h-[80px]';

  const assignedToId = typeof leadState?.assignedTo === 'object' && leadState?.assignedTo !== null ? (leadState.assignedTo as any)._id || (leadState.assignedTo as any).id : leadState?.assignedTo;
  const hasAssignee = !!assignedToId;

  const handleQuickStatusChange = async (newStatus: LeadStatus) => {
    if (!leadState) return;
    const leadIdStr = leadState.id || (leadState as any)._id;
    try {
      const payload: any = { status: newStatus };
      if (newStatus === 'Open') {
        payload.assignedTo = null;
        payload.assignedToName = null;
        payload.assignedToDisplayId = null;
      }
      const updated = {
        ...leadState,
        status: newStatus,
        ...(newStatus === 'Open' ? { assignedTo: undefined, assignedToName: undefined, assignedToDisplayId: undefined } : {})
      };
      await leadService.update(leadIdStr, payload);
      setLeadState(updated);
      toast.success(newStatus === 'Open' ? 'Lead moved back to Open (unassigned)' : `Lead marked as ${newStatus}`);
      
      if (newStatus === 'Open') {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate(role === 'staff' ? '/staff/my-leads' : '/admin/leads');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate(role === 'staff' ? '/staff/my-leads' : '/admin/leads');
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline cursor-pointer self-start"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end w-full sm:w-auto">
          {(leadState.status === 'Unqualified' || (leadState.status === 'Open' && hasAssignee)) && (
            <button
              onClick={() => handleQuickStatusChange('Qualified')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold hover:bg-emerald-100 active:scale-[0.98] transition-all"
            >
              <CheckCircle size={14} /> Mark Qualified
            </button>
          )}
          {(leadState.status === 'Qualified' || (leadState.status === 'Open' && hasAssignee)) && (
            <button
              onClick={() => handleQuickStatusChange('Unqualified')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold hover:bg-red-100 active:scale-[0.98] transition-all"
            >
              <XCircle size={14} /> Mark Unqualified
            </button>
          )}
          {leadState.status !== 'Customer' && (leadState.status === 'Qualified' || leadState.status === 'Unqualified' || hasAssignee) && (
            <button
              onClick={() => handleQuickStatusChange('Open')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold hover:bg-slate-200 active:scale-[0.98] transition-all"
              title="Remove assignment and move back to Open leads"
            >
              <RotateCcw size={14} /> Mark Open
            </button>
          )}
          <button
            onClick={() => {
              // Pre-populate fields
              setName(leadState.customerName);
              setPhone(leadState.phone);
              setEmail(leadState.email);
              setCity(leadState.city);
              setDob(leadState.dob || '');
              setNotes(leadState.notes || '');
              setSourceType(leadState.sourceType);
              setSource(leadState.source);
              const assignedToId = typeof leadState.assignedTo === 'object' && leadState.assignedTo !== null ? (leadState.assignedTo as any)._id || (leadState.assignedTo as any).id : leadState.assignedTo;
              setAssignedTo(assignedToId || '');
              setPropertyInterest(leadState.propertyInterest || 'Residential Plot');
              setBudget(leadState.budget ? String(leadState.budget) : '');
              setCategory(leadState.category || '');
              setStatus(leadState.status);
              setPaymentStatus(leadState.paymentStatus || 'Not Paid');
              setEditOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green text-white rounded-md text-xs font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
          >
            <Edit size={14} /> Edit Lead
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar initials={getInitials(leadState.customerName)} bg={getAvatarColor(leadState.customerName)} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words"><NameTag name={leadState.customerName} displayId={leadState.displayId} /></h1>
                <StatusBadge status={leadState.status} />
              </div>
              <p className="text-sm text-slate-500 mt-1">Lead ID: {leadState.displayId || leadIdStr} • added {formatDate(leadState.dateAdded || leadState.createdAt)}</p>
              <div className="flex flex-wrap gap-3 mt-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" /> 
                  {leadState.phone}
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
                </span>
                <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" /> {leadState.email}</span>

                <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {leadState.city}</span>
                {leadState.dob && (
                  <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> DOB: {leadState.dob}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px]">
            <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Source</span>
              <p className="text-sm font-bold text-slate-800 mt-1">{formatSource(leadState.sourceType, leadState.source)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assigned Representative</span>
              <p className="text-sm font-bold text-slate-800 mt-1">{leadState.assignedToDisplayId || leadState.assignedToName || (leadState.assignedTo && typeof leadState.assignedTo === 'object' ? (leadState.assignedTo as any).name : null) || 'Unassigned'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Lead Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ['Project', project ? `${project.name} [${project.displayId}]` : 'General', MapPin],
                ['Category', leadState.category || 'Not specified', Tag],
                ['Budget', leadState.budget ? String(leadState.budget) : (leadState.budgetMin || leadState.budgetMax ? `₹${leadState.budgetMin || 0} - ₹${leadState.budgetMax || 0}` : 'Not specified'), Tag],
                ['Representative', leadState.assignedToDisplayId || leadState.assignedToName || (leadState.assignedTo && typeof leadState.assignedTo === 'object' ? (leadState.assignedTo as any).name : null) || 'Unassigned', UserRound],
                ['Gender', leadState.gender || 'Male', UserRound],
                ['Date of Birth', leadState.dob || 'Not specified', Calendar],
                ['Source Name', leadState.source || 'Direct Intake', UserRound]
              ] as const).map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <Icon size={12} /> {label}
                  </span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{String(value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Note</span>
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-4">{leadState.notes || 'No notes added.'}</p>
            </div>
          </div>

          {/* Booking Details Accordion */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setAccordionOpen(!accordionOpen)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <h2 className="text-base font-semibold text-slate-900">Booking &amp; Plot Details</h2>
              {accordionOpen ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
            </button>
            
            {accordionOpen && (
              <div className="p-5">
                {customerBookings.length > 0 ? (
                  <div className="space-y-4">
                    {customerBookings.map((b, idx) => (
                      <div key={idx} className="border border-slate-100 rounded-lg p-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-slate-800 text-sm"><NameTag name={b.project.name} displayId={b.project.displayId} /></h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Plot #{b.plot.plotNumber}</span>
                            <span>•</span>
                            <span>{b.size} {b.sizeUnit}</span>
                            <span>•</span>
                            <span>{b.facing} facing</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 rounded text-[11px] font-bold ${
                              b.status === 'Registered' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              b.status === 'Booked' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {b.status}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-1">Payment: {b.paymentStatus}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const projId = b.project.id || (b.project as any)._id;
                              const plotId = b.plot.id || (b.plot as any)._id;
                              if (projId && plotId) {
                                navigate(`/${role}/projects/${projId}?plotId=${plotId}`);
                              } else if (projId) {
                                navigate(`/${role}/projects/${projId}`);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green hover:bg-brand-darkgreen text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98] shrink-0"
                            title={`Open ${b.project.name} layout and select Plot #${b.plot.plotNumber}`}
                          >
                            <ExternalLink size={13} /> Visit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <AlertCircle size={24} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">No plots booked or registered by this customer yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            ref={followUpSectionRef}
            className={`bg-white rounded-lg border shadow-sm p-5 transition-all duration-700 ${
              highlightFollowUps
                ? 'border-amber-400 ring-4 ring-amber-300/80 bg-amber-50/40 shadow-lg scale-[1.01]'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Follow-up History</h2>
                <span className="text-xs text-slate-400 font-medium">{(leadState.followUps || []).length} Total</span>
              </div>
              <button
                onClick={handleOpenNewFollowUp}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-green text-white rounded-md text-xs font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
              >
                <Plus size={14} /> Log Follow-up
              </button>
            </div>
            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3">
              {(leadState.followUps || []).map((followUp: any, fIdx) => (
                <div key={followUp.id || followUp._id || fIdx} className="rounded-lg border border-slate-100 p-4 bg-slate-50/50 hover:border-slate-200 transition-all">
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
              {(!leadState.followUps || leadState.followUps.length === 0) && (
                <p className="text-sm text-slate-400 py-8 text-center">No follow-ups logged yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Historical Timeline */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 h-fit">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-4 border-b border-slate-200 pb-2">
            <Clock size={14} className="text-blue-500" /> Historical Timeline
          </h2>
          <div className="max-h-[380px] overflow-y-auto pr-2">
            <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5 py-1">
              <div className="relative text-xs">
                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow" />
                <p className="font-semibold text-slate-800">Lead Created / Captured</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Source: {formatSource(leadState.sourceType, leadState.source)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Date: {formatDate(leadState.dateAdded || leadState.createdAt)}</p>
              </div>

              {leadState.assignedToName && (
                <div className="relative text-xs">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow" />
                  <p className="font-semibold text-slate-800">Reserved / Representative Assigned</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Reserved by staff representative {leadState.assignedToDisplayId || leadState.assignedToName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Date: {formatDate(leadState.assignedAt || leadState.dateAdded || leadState.createdAt)}</p>
                </div>
              )}

              {plot && (
                <div className="relative text-xs">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow" />
                  <p className="font-semibold text-slate-800">Plot Selected</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Plot #{plot.plotNumber} in {project?.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Date: {formatDate(plot.selectedAt || plot.createdAt || leadState.updatedAt || leadState.createdAt)}</p>
                </div>
              )}

              {(leadState.followUps || []).map((fu: any, fIdx: number) => (
                <div key={fu.id || fu._id || fIdx} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white shadow" />
                  <p className="font-semibold text-slate-800">Follow-up: {fu.outcome}</p>
                  {fu.notes && <p className="text-[10px] text-slate-600 mt-0.5">{fu.notes}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                    Date: {formatDate(fu.date)} {fu.nextAction ? `• Next: ${fu.nextAction}` : ''} {fu.nextFollowUpDate ? `(Scheduled: ${formatDate(fu.nextFollowUpDate)})` : ''}
                  </p>
                </div>
              ))}

              <div className="relative text-xs">
                <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow ${
                  leadState.status === 'Qualified' ? 'bg-blue-500' :
                  leadState.status === 'Unqualified' ? 'bg-red-500' :
                  leadState.status === 'Customer' ? 'bg-emerald-500' : 'bg-slate-400'
                }`} />
                <p className="font-semibold text-slate-800">Converted Phase: {leadState.status}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Lead is now in {leadState.status} state, assigned to {leadState.assignedToDisplayId || leadState.assignedToName || 'Unassigned'}.</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Date: {formatDate(leadState.updatedAt || leadState.createdAt || leadState.dateAdded)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Lead Details" size="md" footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-medium hover:bg-brand-darkgreen active:scale-[0.98] transition-all">
              Save Changes
            </button>
          </>
        }>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                  {checkingPhone && <span className="ml-2 text-[10px] text-blue-500 font-normal">Checking availability...</span>}
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  className={`${inputClass} ${duplicateLead ? 'border-amber-400 bg-amber-50/20' : ''}`}
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
                      <span className="font-semibold text-slate-800">{duplicateLead.assignedToDisplayId || duplicateLead.assignedToName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800 font-medium italic">
                    Click "Clear Number" above to enter a new mobile number.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender <span className="text-red-500">*</span></label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                  className={selectClass}
                  required
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input 
                  type="date" 
                  max={getYesterdayStr()} 
                  value={dob} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val && val > getYesterdayStr()) {
                      toast.error('Date of Birth cannot be today or a future date.');
                      setDob('');
                    } else {
                      setDob(val);
                    }
                  }} 
                  className={inputClass} 
                />
              </div>
            </div>

            {sourceType !== 'Staff' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Phase</label>
                  <select value={status} onChange={e => setStatus(e.target.value as LeadStatus)} className={selectClass}>
                    <option value="Open">Open</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Unqualified">Unqualified</option>
                    <option value="Customer">Customer</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source Type</label>
                <select value={sourceType} onChange={e => {
                  const val = e.target.value;
                  setSourceType(val);
                  if (val === 'Staff') {
                    if (role === 'staff') {
                      setSource(user?.name || 'Staff');
                    }
                    setStatus('Open');
                  }
                }} className={selectClass}>
                  <option value="Direct">Direct</option>
                  <option value="Staff">Staff</option>
                  <option value="Channel Partner">Channel Partner</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Website">Website</option>
                  <option value="Leads Portal">Leads Portal</option>
                  <option value="Own Client">Own Client</option>
                  <option value="Office Referral">Office Referral</option>
                  <option value="Client Referral">Client Referral</option>
                </select>
              </div>
              {role !== 'staff' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Representative Staff</label>
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={selectClass}>
                    <option value="">Unassigned</option>
                    {staffUsers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {sourceType === 'Staff' && role !== 'staff' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Staff Member (Source) <span className="text-red-500">*</span></label>
                <select value={source} onChange={e => setSource(e.target.value)} className={selectClass}>
                  <option value="">Choose Staff Member...</option>
                  {staffUsers.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.designation})</option>
                  ))}
                </select>
              </div>
            )}

            {sourceType === 'Channel Partner' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Channel Partner (Source) <span className="text-red-500">*</span></label>
                <select value={source} onChange={e => setSource(e.target.value)} className={selectClass}>
                  <option value="">Choose Channel Partner...</option>
                  {channelPartners.map(cp => (
                    <option key={cp.id} value={cp.name}>{cp.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(sourceType === 'Office Referral' || sourceType === 'Client Referral') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source Name / Referrer <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Budget (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ₹50,00,000"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category (Optional)</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={textareaClass} />
            </div>
          </div>
        </Modal>
      )}

      {whatsAppOpen && (
        <WhatsAppChatModal
          open={whatsAppOpen}
          onClose={() => setWhatsAppOpen(false)}
          phone={leadState.phone}
          name={leadState.customerName}
          projectName={project ? `${project.name} [${project.displayId}]` : ''}
        />
      )}

      {/* Log / Edit Follow-up Modal */}
      {followUpModalOpen && (
        <Modal
          open={followUpModalOpen}
          onClose={() => { setFollowUpModalOpen(false); setEditingFollowUp(null); }}
          title={editingFollowUp ? "Edit Follow-up" : "Log Follow-up"}
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
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-up Date 📅</label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={e => setNextFollowUpDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Outcome</label>
              <select
                value={followUpOutcome}
                onChange={e => setFollowUpOutcome(e.target.value)}
                className={selectClass}
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
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Discussion Details</label>
              <textarea
                value={followUpNotes}
                onChange={e => setFollowUpNotes(e.target.value)}
                rows={3}
                placeholder="Details of the conversation with customer..."
                className={textareaClass}
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
                {savingFollowUp ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingFollowUp ? 'Update Follow-up' : 'Save Follow-up'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
