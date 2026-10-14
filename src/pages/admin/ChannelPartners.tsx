import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Phone, Mail, MapPin, Search, Building2, Award, Activity, Clock, Percent, ChevronLeft, ChevronRight, Pencil, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal } from '@/components/shared/Modal';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { channelPartnerService, userService, leadService, activityLogService } from '@/services';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { useExportContext } from '@/context/ExportContext';
import { getMaxDobStr } from '@/lib/utils';
import { CardSkeletonGrid } from '@/components/shared/SkeletonLoader';

export default function AdminChannelPartners() {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const { triggerDownload } = useExportContext();
  const [partners, setPartners] = useState<ChannelPartner[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      channelPartnerService.getAll({ limit: 100 }).then(r => r.data || []),
      userService.getAll({ role: 'partner', limit: 100 }).then(r => r.data || []),
      userService.getAll({ role: 'channel_partner', limit: 100 }).then(r => r.data || []),
      leadService.getAll({ limit: 100 }).then(r => setLeads(r.data || [])).catch(() => {}),
      activityLogService.getAll({ limit: 100 }).then(r => setActivityLogs(r.data || [])).catch(() => {}),
    ]).then(([cpRes, uPartnerRes, uCPRes]) => {
      const cpDocs: any[] = cpRes.status === 'fulfilled' ? cpRes.value : [];
      const userPartners: any[] = uPartnerRes.status === 'fulfilled' ? uPartnerRes.value : [];
      const userCPs: any[] = uCPRes.status === 'fulfilled' ? uCPRes.value : [];

      const mergedMap = new Map<string, any>();

      // 1. Add all from ChannelPartner collection
      cpDocs.forEach(cp => {
        const id = cp.id || cp._id;
        mergedMap.set(id, {
          id,
          name: cp.name,
          companyName: cp.companyName || 'Channel Partner Firm',
          phone: cp.phone || '-',
          email: cp.email || '-',
          city: cp.city || 'Bangalore',
          reraId: cp.reraId || '',
          isActive: cp.isActive !== false,
          initials: cp.initials || getInitials(cp.name),
          avatarBg: cp.avatarBg || getAvatarColor(cp.name),
          ...cp,
        });
      });

      // 2. Add all Users with role 'partner' or 'channel_partner'
      [...userPartners, ...userCPs].forEach(u => {
        const id = u.id || u._id;
        const exists = Array.from(mergedMap.values()).some(
          existing => existing.id === id || (u.email && existing.email === u.email)
        );
        if (!exists) {
          mergedMap.set(id, {
            id,
            name: u.name,
            companyName: u.companyName || (u as any).firmName || 'Channel Partner Firm',
            phone: u.phone || '-',
            email: u.email || '-',
            city: u.city || 'Bangalore',
            reraId: u.reraId || '',
            isActive: u.isActive !== false,
            initials: u.initials || getInitials(u.name),
            avatarBg: u.avatarBg || getAvatarColor(u.name),
            role: u.role || 'partner',
            ...u,
          });
        }
      });

      setPartners(Array.from(mergedMap.values()));
    }).finally(() => setLoading(false));
  }, []);

  // Profile Modal State
  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'leads' | 'timeline'>('overview');

  // Add Partner form state
  const [cpName, setCpName] = useState('');
  const [cpCompanyName, setCpCompanyName] = useState('');
  const [cpPhone, setCpPhone] = useState('');
  const [cpEmail, setCpEmail] = useState('');
  const [cpCity, setCpCity] = useState('');
  const [cpReraId, setCpReraId] = useState('');
  const [cpNotes, setCpNotes] = useState('');
  const [cpDob, setCpDob] = useState('');
  const [cpGender, setCpGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [savingPartner, setSavingPartner] = useState(false);

  // Edit Partner form state
  const [editOpen, setEditOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editReraId, setEditReraId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleOpenEdit = (partner: any) => {
    setEditingPartner(partner);
    setEditName(partner.name || '');
    setEditCompanyName(partner.companyName || '');
    setEditPhone(partner.phone || '');
    setEditEmail(partner.email || '');
    setEditCity(partner.city || '');
    setEditReraId(partner.reraId || '');
    setEditNotes(partner.notes || '');
    setEditDob(partner.dob ? new Date(partner.dob).toISOString().split('T')[0] : '');
    setEditGender(partner.gender || 'Male');
    setEditIsActive(partner.isActive ?? true);
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEditPartner = async () => {
    if (!editingPartner) return;
    if (!editName.trim()) {
      setEditError('Partner Name is required.');
      return;
    }
    if (!editPhone.trim()) {
      setEditError('Phone Number is required.');
      return;
    }
    if (!editGender) {
      setEditError('Gender is required.');
      return;
    }
    setSavingEdit(true);
    setEditError('');

    if (editDob) {
      const selectedDate = new Date(editDob);
      const maxDobDate = new Date();
      maxDobDate.setFullYear(maxDobDate.getFullYear() - 18);
      maxDobDate.setHours(23, 59, 59, 999);
      if (selectedDate > maxDobDate) {
        setEditError('Date of Birth indicates age must be at least 18 years.');
        return;
      }
    }

    const pid = editingPartner.id || (editingPartner as any)._id;

    try {
      const updatedFields: any = {
        name: editName.trim(),
        companyName: editCompanyName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim().toLowerCase() || undefined,
        city: editCity.trim(),
        reraId: editReraId.trim(),
        notes: editNotes.trim(),
        gender: editGender,
        dob: editDob || undefined,
        isActive: editIsActive,
        initials: editName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      };

      let updatedData: any;
      if (editingPartner.role === 'partner' || editingPartner.role === 'channel_partner') {
        const res = await userService.update(pid, updatedFields);
        updatedData = res.data;
      } else {
        const res = await channelPartnerService.update(pid, updatedFields);
        updatedData = res.data;
      }

      setPartners(prev => prev.map(p => (p.id === pid || (p as any)._id === pid) ? { ...p, ...updatedFields, ...updatedData } : p));
      setEditOpen(false);
      setEditingPartner(null);
      const { toast } = await import('sonner');
      toast.success('Channel partner updated successfully!');
    } catch (err: any) {
      setEditError(err.message || 'Failed to update channel partner');
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = partners.filter(p =>
    !debouncedSearch ||
    (p.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (p.displayId || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (p.companyName || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (p.phone || '').includes(debouncedSearch)
  );

  const perPage = 12;
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const toggleStatus = async (id: string) => {
    const partner = partners.find(p => p.id === id || (p as any)._id === id);
    if (!partner) return;
    try {
      if (partner.role === 'partner' || partner.role === 'channel_partner') {
        await userService.update(id, { isActive: !partner.isActive });
      } else {
        await channelPartnerService.update(id, { isActive: !partner.isActive });
      }
      setPartners(prev => prev.map(p => (p.id === id || (p as any)._id === id) ? { ...p, isActive: !p.isActive } : p));
      const { toast } = await import('sonner');
      toast.success(`Partner ${!partner.isActive ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Compute channel partner performance dynamically based on referrals dataset
  const partnerPerformance = useMemo(() => {
    return partners.map(partner => {
      const partnerLeads = leads.filter(l => l.source === partner.name);
      const totalLeads = partnerLeads.length;
      const booked = partnerLeads.filter(l => l.status === 'Customer').length;
      const conversionRate = totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0;
      
      return {
        partner,
        totalLeads,
        booked,
        conversionRate,
      };
    }).sort((a, b) => b.booked - a.booked);
  }, [partners, leads]);

  const topConvertingPartners = useMemo(() => {
    return partnerPerformance.filter(item => item.booked > 0).slice(0, 3);
  }, [partnerPerformance]);

  // Resolve detailed metrics for selected partner modal
  const partnerDetails = useMemo(() => {
    if (!selectedPartner) return null;
    const partnerLeads = leads.filter(l => l.source === selectedPartner.name);
    const partnerLogs = activityLogs.filter(log => 
      log.entityName.includes(selectedPartner.name) || 
      log.action.includes(selectedPartner.name) ||
      log.actorName === selectedPartner.name
    );

    const total = partnerLeads.length;
    const booked = partnerLeads.filter(l => l.status === 'Customer').length;
    const active = partnerLeads.filter(l => l.status === 'Open' || l.status === 'Qualified').length;
    const unqualified = partnerLeads.filter(l => l.status === 'Unqualified').length;
    const conversionRate = total > 0 ? Math.round((booked / total) * 100) : 0;

    return {
      leads: partnerLeads,
      logs: partnerLogs,
      stats: {
        total,
        booked,
        active,
        unqualified,
        conversionRate,
      }
    };
  }, [selectedPartner]);

  if (loading && partners.length === 0) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search partners..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 h-9 w-full border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all"
            />
          {search !== debouncedSearch && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          onClick={triggerDownload}
          className="flex items-center justify-center h-9 px-3 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-all shrink-0"
        >
          Export CSV
        </button>
        <button onClick={() => setAddOpen(true)} className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-brand-green text-white text-sm font-medium rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all shrink-0">
          <UserPlus size={16} /><span className="hidden sm:inline ml-1.5">Add Partner</span>
        </button>
      </div>

      {/* Top Converting Partners Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Award className="text-white" size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Top Converting Channel Partners</h2>
            <p className="text-[11px] text-slate-500 font-medium">Ranked by referred leads booked successfully</p>
          </div>
        </div>

        <div className="px-6 pb-5 pt-2">
          {topConvertingPartners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topConvertingPartners.map((item, index) => {
                const rankColors = [
                  { border: 'border-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-400 text-amber-900', label: '1st Place' },
                  { border: 'border-slate-300', bg: 'bg-slate-50', badge: 'bg-slate-300 text-slate-800', label: '2nd Place' },
                  { border: 'border-orange-300', bg: 'bg-orange-50', badge: 'bg-orange-300 text-orange-900', label: '3rd Place' },
                ][index];

                return (
                  <div key={item.partner.id} className={`relative rounded-lg border-l-4 ${rankColors.border} ${rankColors.bg} p-4 flex flex-col justify-between hover:shadow-md transition-all`}>
                    <span className={`absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded ${rankColors.badge}`}>
                      {rankColors.label}
                    </span>

                    <div className="flex items-center gap-3 mb-4">
                      <Avatar initials={getInitials(item.partner.name)} name={item.partner.name} size="md" bg={item.partner.avatarBg} src={(item.partner as any).avatar} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{item.partner.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{item.partner.companyName}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">Booked:</span>
                        <span className="font-bold text-emerald-700">{item.booked} Booked</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 px-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Award size={20} />
              </div>
              <p className="text-sm font-semibold text-slate-700">No top converting channel partners yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Rankings will appear once referred leads are successfully booked.</p>
            </div>
          )}
        </div>
      </div>

      {/* Partners Cards Grid */}
      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginated.map(partner => {
          const perf = partnerPerformance.find(p => p.partner.id === partner.id);
          return (
            <div 
              key={partner.id} 
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar initials={getInitials(partner.name)} name={partner.name} size="lg" bg={partner.avatarBg} src={(partner as any).avatar} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">{partner.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Building2 size={11} /> {partner.companyName}
                      </div>
                    </div>
                  </div>
                  {perf && perf.booked > 0 && (
                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100 shrink-0">
                      🏆 {perf.booked} Booked
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={13} className="text-slate-400" /> {partner.phone}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                    {partner.displayId || (partner as any).partnerId || `CP-${idx + 1}`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={13} className="text-slate-400" /> {partner.city}
                  </div>
                  {partner.reraId && (
                    <p className="text-xs text-slate-400 font-medium">RERA ID: {partner.reraId}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => toggleStatus(partner.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    partner.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {partner.isActive ? 'Active' : 'Inactive'}
                </button>
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => handleOpenEdit(partner)}
                    className="text-xs text-slate-600 font-bold hover:text-brand-blue flex items-center gap-1"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button 
                    onClick={() => navigate(`/admin/channel-partners/${partner.id || (partner as any)._id}`)}
                    className="text-xs text-brand-blue font-bold hover:underline"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Edit Partner Modal */}
      {editOpen && (
        <Modal 
          open={editOpen} 
          onClose={() => { if (!savingEdit) setEditOpen(false); }} 
          title={`Edit Channel Partner — ${editingPartner?.name}`} 
          size="md" 
          footer={
            <>
              <button onClick={() => setEditOpen(false)} disabled={savingEdit} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveEditPartner} disabled={savingEdit} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
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
                onChange={e => setEditEmail(e.target.value.toLowerCase())}
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
                max={getMaxDobStr()}
                value={editDob}
                onChange={e => {
                  const val = e.target.value;
                  if (val && val > getMaxDobStr()) {
                    toast.error('Date of Birth indicates age must be at least 18 years.');
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
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea 
              placeholder="Additional notes..." 
              rows={3} 
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all resize-y min-h-[80px]" 
            />
          </div>
        </Modal>
      )}

      {/* Add Partner Modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setSavingPartner(false); }} title="Add Channel Partner" size="md" footer={
        <>
          <button onClick={() => { setAddOpen(false); setSavingPartner(false); }} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            type="button"
            disabled={savingPartner}
            onClick={async () => {
              if (savingPartner) return;
              const { toast } = await import('sonner');
              if (!cpName.trim()) {
                toast.error('Partner Name is required.');
                return;
              }
              if (!cpPhone.trim()) {
                toast.error('Phone Number is required.');
                return;
              }
              if (!cpEmail.trim()) {
                toast.error('Email is required.');
                return;
              }
              if (!cpGender) {
                toast.error('Gender is required.');
                return;
              }
              const cleanPhone = cpPhone.trim().replace(/\D/g, '');
              if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
                toast.error('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
                return;
              }
              if (cpDob) {
                const selectedDate = new Date(cpDob);
                const maxDobDate = new Date();
                maxDobDate.setFullYear(maxDobDate.getFullYear() - 18);
                maxDobDate.setHours(23, 59, 59, 999);
                if (selectedDate > maxDobDate) {
                  toast.error('Date of Birth indicates age must be at least 18 years.');
                  return;
                }
              }
              setSavingPartner(true);
              try {
                const res = await channelPartnerService.create({
                  name: cpName.trim(),
                  companyName: cpCompanyName.trim() || cpName.trim(),
                  phone: cleanPhone,
                  email: cpEmail.trim().toLowerCase(),
                  city: cpCity.trim(),
                  reraId: cpReraId.trim() || undefined,
                  notes: cpNotes.trim(),
                  gender: cpGender,
                  dob: cpDob,
                  isActive: true,
                  initials: cpName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
                });
                setPartners(prev => [...prev, res.data]);
                setCpName(''); setCpCompanyName(''); setCpPhone(''); setCpEmail(''); setCpCity(''); setCpReraId(''); setCpNotes(''); setCpDob('');
                setAddOpen(false);
                if (res.reused) {
                  toast.success('Channel partner added — linked to the existing partner account.');
                } else {
                  toast.success('Channel partner added — login credentials emailed to the partner.');
                }
                if (res.emailSent === false) {
                  toast.warning('Channel partner saved, but the login credentials email failed to send.');
                }
              } catch (err: any) {
                const { toast } = await import('sonner');
                toast.error(err.message || 'Failed to add channel partner');
              } finally {
                setSavingPartner(false);
              }
            }}
            className="px-4 py-2 bg-brand-green text-white rounded-md text-sm hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingPartner ? 'Saving...' : 'Save Partner'}
          </button>
        </>
      }>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name <span className="text-red-500 font-bold">*</span>
            </label>
            <input type="text" placeholder="Partner name" value={cpName} onChange={e => setCpName(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone <span className="text-red-500 font-bold">*</span>
            </label>
            <input type="tel" maxLength={10} placeholder="10-digit mobile number" value={cpPhone} onChange={e => setCpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email <span className="text-red-500 font-bold">*</span></label>
            <input type="email" placeholder="email@example.com" value={cpEmail} onChange={e => setCpEmail(e.target.value.toLowerCase())} required className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
            <input type="text" placeholder="City" value={cpCity} onChange={e => setCpCity(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Gender <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              value={cpGender}
              onChange={e => setCpGender(e.target.value as 'Male' | 'Female' | 'Other')}
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
              max={getMaxDobStr()}
              value={cpDob} 
              onChange={e => {
                const val = e.target.value;
                if (val && val > getMaxDobStr()) {
                  toast.error('Date of Birth indicates age must be at least 18 years.');
                  setCpDob('');
                } else {
                  setCpDob(val);
                }
              }} 
              className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea placeholder="Additional notes..." rows={3} value={cpNotes} onChange={e => setCpNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all resize-y min-h-[80px]" />
        </div>
      </Modal>

      {/* Channel Partner Profile Details Modal */}
      {selectedPartner && partnerDetails && (
        <Modal
          open={!!selectedPartner}
          onClose={() => setSelectedPartner(null)}
          title={`Partner Profile Dashboard — ${selectedPartner.name}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Partner Header Summary */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 rounded-lg p-5 border border-slate-200">
              <Avatar initials={getInitials(selectedPartner.name)} size="xl" bg={selectedPartner.avatarBg} />
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-lg font-bold text-slate-900">{selectedPartner.name}</h2>
                <p className="text-xs text-slate-500 font-semibold flex items-center justify-center sm:justify-start gap-1">
                  <Building2 size={12} /> {selectedPartner.companyName}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {selectedPartner.phone}</span>
                  <span className="flex items-center gap-1"><Mail size={12} className="text-slate-400" /> {selectedPartner.email}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} className="text-slate-400" /> {selectedPartner.city}</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">RERA Status</span>
                <span className="block text-xs font-bold text-brand-blue mt-1">
                  {selectedPartner.reraId ? selectedPartner.reraId : 'Unregistered'}
                </span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="border-b border-slate-200 flex gap-2">
              <button
                onClick={() => setModalTab('overview')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all px-4 ${
                  modalTab === 'overview' ? 'border-brand-green text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setModalTab('leads')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all px-4 ${
                  modalTab === 'leads' ? 'border-brand-green text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Referred Leads ({partnerDetails.stats.total})
              </button>
              <button
                onClick={() => setModalTab('timeline')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all px-4 ${
                  modalTab === 'timeline' ? 'border-brand-green text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Activity Timeline ({partnerDetails.logs.length})
              </button>
            </div>

            {/* Tab 1: Overview */}
            {modalTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Referred Leads</span>
                    <span className="text-2xl font-extrabold text-slate-800 mt-2 block">{partnerDetails.stats.total}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Booked</span>
                    <span className="text-2xl font-extrabold text-emerald-700 mt-2 block">{partnerDetails.stats.booked}</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-brand-blue font-bold uppercase tracking-wider block">Active Leads</span>
                    <span className="text-2xl font-extrabold text-blue-700 mt-2 block">{partnerDetails.stats.active}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Conversion Rate</span>
                    <span className="text-2xl font-extrabold text-brand-blue mt-2 block flex items-center gap-1">
                      <Percent size={18} /> {partnerDetails.stats.conversionRate}%
                    </span>
                  </div>
                </div>

                {/* Progress bar details */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Activity size={14} className="text-blue-500" /> Referral Performance Funnel
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>Total Referrals Submitted</span>
                        <span>{partnerDetails.stats.total} Leads</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>Booked</span>
                        <span>{partnerDetails.stats.booked} Booked ({partnerDetails.stats.conversionRate}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${partnerDetails.stats.conversionRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Referred Leads */}
            {modalTab === 'leads' && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col max-h-[380px] overflow-y-auto pr-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-left border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Name</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Location</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Interest</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Representative</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {partnerDetails.leads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No referred leads found for this channel partner.
                          </td>
                        </tr>
                      ) : (
                        partnerDetails.leads.map(lead => (
                          <tr key={lead.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-slate-800">{lead.customerName}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{lead.phone} • {lead.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">{lead.city}</td>
                            <td className="px-4 py-3 text-slate-600 font-semibold">{lead.propertyInterest}</td>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {lead.assignedToName ? (
                                <span className="inline-flex items-center gap-1 text-slate-800">
                                  <Avatar initials={getInitials(lead.assignedToName)} size="sm" bg={getAvatarColor(lead.assignedToName)} />
                                  {lead.assignedToName}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Not Assigned</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={lead.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Timeline */}
            {modalTab === 'timeline' && (
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm max-h-[380px] overflow-y-auto">
                {partnerDetails.logs.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">No historical activity logs found for this partner's leads.</p>
                ) : (
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5">
                    {partnerDetails.logs.map(log => (
                      <div key={log.id} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(log.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' })}</span>
                          <span className="text-[9px] font-mono">IP: {log.ipAddress}</span>
                        </div>
                        <p className="font-medium text-slate-800">{log.action}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Entity: {log.entityType} ({log.entityName}) • Action: {log.actionType} by {log.actorName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
