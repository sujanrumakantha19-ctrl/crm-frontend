import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Phone, Mail, Calendar, Search, Award, Activity, ListTodo, Briefcase, Percent, Clock, AlertCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal } from '@/components/shared/Modal';
import { Avatar } from '@/components/shared/Avatar';
import { NameTag } from '@/components/shared/NameTag';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { userService, groupService, leadService, taskService, activityLogService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { isTaskAssignedTo } from '@/lib/taskAssignee';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { useExportContext } from '@/context/ExportContext';
import { getYesterdayStr } from '@/lib/utils';
import type { User, Group, Lead, Task } from '@/types';

export default function AdminStaff() {
  const navigate = useNavigate();
  const { userId, user, role } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { triggerDownload } = useExportContext();
  const [staffList, setStaffList] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      userService.getAll({ role: 'staff', limit: 100 }).then(r => setStaffList(r.data || [])).catch(() => {}),
      groupService.getAll({ limit: 50 }).then(r => setGroups(r.data || [])).catch(() => {}),
      leadService.getAll({ limit: 100 }).then(r => setLeads(r.data || [])).catch(() => {}),
      taskService.getAll({ limit: 100 }).then(r => setTasks(r.data || [])).catch(() => {}),
      activityLogService.getAll({ limit: 100 }).then(r => setActivityLogs(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Filter states
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Profile Modal State
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'leads' | 'timeline'>('overview');

  // Add Staff form states
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDesignation, setAddDesignation] = useState('');
  const [addDob, setAddDob] = useState('');
  const [addGender, setAddGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [addRole, setAddRole] = useState<'staff' | 'admin'>('staff');
  const [addGroupId, setAddGroupId] = useState('');
  const [addError, setAddError] = useState('');

  // Edit Staff form states
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editGroupId, setEditGroupId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleOpenEdit = (staff: User) => {
    setEditingStaff(staff);
    setEditName(staff.name || '');
    setEditPhone(staff.phone || '');
    setEditEmail(staff.email || '');
    setEditDesignation(staff.designation || '');
    setEditDob(staff.dob ? new Date(staff.dob).toISOString().split('T')[0] : '');
    setEditGender(staff.gender || 'Male');
    const sGroup = groups.find(g => (g.members || []).includes(staff.id || (staff as any)._id));
    setEditGroupId(sGroup ? sGroup.id : '');
    setEditIsActive(staff.isActive ?? true);
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEditStaff = async () => {
    if (!editingStaff) return;
    if (!editName.trim() || !editPhone.trim()) {
      setEditError('Full Name and Phone Number are required.');
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
    const sid = editingStaff.id || (editingStaff as any)._id;
    try {
      const updatedData = {
        name: editName.trim(),
        phone: cleanPhone,
        email: editEmail.trim() || undefined,
        designation: editDesignation.trim() || 'Staff Member',
        dob: editDob || undefined,
        gender: editGender,
        groupId: editGroupId || undefined,
        isActive: editIsActive,
        initials: editName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      };
      const res = await userService.update(sid, updatedData);
      setStaffList(prev => prev.map(s => (s.id === sid || (s as any)._id === sid) ? { ...s, ...res.data } : s));
      setEditOpen(false);
      setEditingStaff(null);
      const { toast } = await import('sonner');
      toast.success('Staff member updated successfully!');
      logActivity({ id: userId!, name: user!.name, role: role!, initials: user!.initials }, `Updated staff member "${editName}"`, 'Updated', 'Staff', sid, editName);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update staff member');
    } finally {
      setSavingEdit(false);
    }
  };

  // Compute staff performance dynamically based on leads dataset
  const staffPerformance = useMemo(() => {
    return staffList.map(staff => {
      const staffLeads = leads.filter(l => l.assignedTo === staff.id);
      const totalLeads = staffLeads.length;
      const booked = staffLeads.filter(l => l.status === 'Customer').length;
      const conversionRate = totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0;
      
      return {
        staff,
        totalLeads,
        booked,
        conversionRate,
      };
    }).sort((a, b) => b.booked - a.booked);
  }, [staffList, leads]);

  // Search by Name, Email, or Phone number, and filter by Group or Status
  const filtered = useMemo(() => {
    return staffList.filter(s => {
      // 1. Search matching
      const matchesSearch = !debouncedSearch ||
        s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (s.displayId && s.displayId.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        s.phone.includes(debouncedSearch) ||
        s.email.toLowerCase().includes(debouncedSearch.toLowerCase());

      // 2. Group Filter
      const sGroup = groups.find(g => g.members.includes(s.id));
      const matchesGroup = groupFilter === 'all' ||
        (groupFilter === 'unassigned' && !sGroup) ||
        (sGroup?.id === groupFilter);

      // 3. Status Filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && s.isActive) ||
        (statusFilter === 'inactive' && !s.isActive);

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [staffList, debouncedSearch, groupFilter, statusFilter]);

  const toggleStatus = async (id: string) => {
    const staff = staffList.find(s => s.id === id);
    if (!staff) return;
    try {
      await userService.update(id, { isActive: !staff.isActive });
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
      const { toast } = await import('sonner');
      toast.success(`Staff member ${!staff.isActive ? 'activated' : 'deactivated'}`);
      logActivity({ id: userId!, name: user!.name, role: role!, initials: user!.initials }, `${staff.isActive ? 'Deactivated' : 'Activated'} staff ${staff.name}`, 'Updated', 'Staff', id, staff.name);
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Resolve detailed data for modal
  const staffDetails = useMemo(() => {
    if (!selectedStaff) return null;
    const staffLeads = leads.filter(l => l.assignedTo === selectedStaff.id);
    const staffTasks = tasks.filter(t => isTaskAssignedTo(t.assignee, selectedStaff.id, selectedStaff.name));
    const staffLogs = activityLogs.filter(log => log.actorId === selectedStaff.id || log.actorName === selectedStaff.name);
    
    const total = staffLeads.length;
    const booked = staffLeads.filter(l => l.status === 'Customer').length;
    const active = staffLeads.filter(l => l.status === 'Open' || l.status === 'Qualified').length;
    const unqualified = staffLeads.filter(l => l.status === 'Unqualified').length;
    const conversionRate = total > 0 ? Math.round((booked / total) * 100) : 0;

    const totalTasks = staffTasks.length;
    const pendingTasks = staffTasks.filter(t => t.status !== 'Done').length;

    return {
      leads: staffLeads,
      tasks: staffTasks,
      logs: staffLogs,
      stats: {
        total,
        booked,
        active,
        unqualified,
        conversionRate,
        totalTasks,
        pendingTasks,
      }
    };
  }, [selectedStaff, leads, tasks, activityLogs]);

  const handleAddStaff = async () => {
    if (!addName.trim() || !addPhone.trim() || !addGender) {
      setAddError('Full Name, Phone Number, and Gender are required fields.');
      return;
    }

    const cleanPhone = addPhone.trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setAddError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (addDob) {
      const selectedDate = new Date(addDob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate >= today) {
        setAddError('Date of Birth cannot be today or a future date.');
        return;
      }
    }

    setAddError('');

    try {
      const res = await userService.create({
        name: addName.trim(),
        phone: cleanPhone,
        email: addEmail.trim() || undefined,
        designation: 'Staff Member',
        dob: addDob || undefined,
        gender: addGender,
        groupId: addGroupId || undefined,
        role: 'staff',
        initials: addName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        password: '12345678',
        isActive: true,
      });
      setStaffList(prev => [...prev, res.data]);
      setAddName('');
      setAddPhone('');
      setAddEmail('');
      setAddDesignation('');
      setAddDob('');
      setAddGroupId('');
      setAddOpen(false);
      const { toast } = await import('sonner');
      toast.success('Staff member added successfully!');
      logActivity({ id: userId!, name: user!.name, role: role!, initials: user!.initials }, `Added staff member "${addName}"`, 'Created', 'Staff', '', addName);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add staff member');
      toast.error(err.message || 'Failed to add staff member');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Search and Dropdown Filters */}
      <div className="flex items-center gap-2 mb-1">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, phone..."
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
        <button 
          onClick={() => { setAddError(''); setAddOpen(true); }} 
          className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-brand-green text-white text-sm font-medium rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all shrink-0"
        >
          <UserPlus size={16} /><span className="hidden sm:inline ml-1.5">Add Staff</span>
        </button>
      </div>
      <div className="flex items-center gap-2 mb-4">
          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none flex-1"
          >
            <option value="all">All Groups</option>
            <option value="unassigned">Unassigned</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none flex-1"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
      </div>

      {/* Top Performers Leaderboard */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 pt-5 pb-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Award className="text-white" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Sales Performers</h2>
              <p className="text-[11px] text-slate-500 font-medium">Ranked by number of bookings closed</p>
            </div>
          </div>

          <div className="px-6 pb-5 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {staffPerformance.slice(0, 3).map((item, index) => {
                const rankColors = [
                  { border: 'border-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-400 text-amber-900', label: '1st Place' },
                  { border: 'border-slate-300', bg: 'bg-slate-50', badge: 'bg-slate-300 text-slate-800', label: '2nd Place' },
                  { border: 'border-orange-300', bg: 'bg-orange-50', badge: 'bg-orange-300 text-orange-900', label: '3rd Place' },
                ][index];

                return (
                  <div key={item.staff.id} className={`relative rounded-lg border-l-4 ${rankColors.border} ${rankColors.bg} p-4 flex flex-col justify-between hover:shadow-md transition-all`}>
                    <span className={`absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded ${rankColors.badge}`}>
                      {rankColors.label}
                    </span>

                    <div className="flex items-center gap-3 mb-4">
                      <Avatar initials={getInitials(item.staff.name)} name={item.staff.name} size="md" bg={item.staff.avatarBg} src={(item.staff as any).avatar} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{item.staff.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{item.staff.designation}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">Booked:</span>
                        <span className="font-bold text-emerald-700">{item.booked} Booked</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">Total Leads Handled:</span>
                        <span className="font-semibold text-slate-700">{item.totalLeads} Leads</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Staff Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full animate-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded animate-shimmer w-1/2" />
                  <div className="h-3 bg-slate-200 rounded animate-shimmer w-1/3" />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-slate-200 rounded animate-shimmer w-3/4" />
                <div className="h-3 bg-slate-200 rounded animate-shimmer w-2/3" />
                <div className="h-3 bg-slate-200 rounded animate-shimmer w-1/4" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="h-5 bg-slate-200 rounded animate-shimmer w-16" />
                <div className="h-3 bg-slate-200 rounded animate-shimmer w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(staff => {
            const group = groups.find(g => g.members.includes(staff.id));
            const perf = staffPerformance.find(p => p.staff.id === staff.id);
            return (
              <div 
                key={staff.id} 
                className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar initials={getInitials(staff.name)} name={staff.name} size="lg" bg={getAvatarColor(staff.name)} src={(staff as any).avatar} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">{staff.name}</h3>
                        <p className="text-xs text-slate-500">{staff.designation}</p>
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
                      <Phone size={13} className="text-slate-400" /> {staff.phone}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                      {staff.displayId || (staff as any).employeeId || `STAFF-${idx + 1}`}
                    </div>
                    <div className="flex items-center gap-2">
                      {group && (
                        <span className="text-xs bg-blue-50 text-brand-blue px-2 py-0.5 rounded font-semibold">{group.name}</span>
                      )}
                    </div>
                    {staff.dob && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar size={12} /> {new Date(staff.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => toggleStatus(staff.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      staff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {staff.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => handleOpenEdit(staff)}
                      className="text-xs text-slate-600 font-bold hover:text-brand-blue flex items-center gap-1"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button 
                      onClick={() => navigate(`/admin/staff/${staff.id || (staff as any)._id}`)}
                      className="text-xs text-brand-blue font-bold hover:underline"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full bg-white rounded-lg border border-slate-200 py-16 text-center text-slate-400">
              No staff members found matching the selected search or filters.
            </div>
          )}
        </div>
      )}

      {/* Add Staff Modal with Red Asterisks and form state validation */}
      {addOpen && (
        <Modal 
          open={addOpen} 
          onClose={() => setAddOpen(false)} 
          title="Add Staff Member" 
          size="md" 
          footer={
            <>
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleAddStaff} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm hover:bg-brand-darkgreen active:scale-[0.98] transition-all">Save Staff</button>
            </>
          }
        >
          {addError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{addError}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name <span className="text-red-500 font-bold">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Enter full name" 
                value={addName}
                onChange={e => setAddName(e.target.value)}
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
                value={addPhone}
                onChange={e => setAddPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input 
                type="email" 
                placeholder="email@example.com" 
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
              <input 
                type="date" 
                max={getYesterdayStr()}
                value={addDob}
                onChange={e => {
                  const val = e.target.value;
                  if (val && val > getYesterdayStr()) {
                    toast.error('Date of Birth cannot be today or a future date.');
                    setAddDob('');
                  } else {
                    setAddDob(val);
                  }
                }}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Gender <span className="text-red-500 font-bold">*</span>
              </label>
              <select
                value={addGender}
                onChange={e => setAddGender(e.target.value as 'Male' | 'Female' | 'Other')}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all cursor-pointer"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to Group</label>
              <select 
                value={addGroupId}
                onChange={e => setAddGroupId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all"
              >
                <option value="">None (Optional)</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Profile Photo</label>
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center hover:border-blue-400 cursor-pointer transition-colors">
              <UserPlus size={20} className="text-slate-300" />
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Staff Modal */}
      {editOpen && (
        <Modal 
          open={editOpen} 
          onClose={() => { if (!savingEdit) setEditOpen(false); }} 
          title={`Edit Staff — ${editingStaff?.name}`} 
          size="md" 
          footer={
            <>
              <button onClick={() => setEditOpen(false)} disabled={savingEdit} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveEditStaff} disabled={savingEdit} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
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
                placeholder="Enter full name" 
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to Group</label>
              <select 
                value={editGroupId}
                onChange={e => setEditGroupId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all"
              >
                <option value="">None (Unassigned)</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
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

      {/* Staff Profile Details Modal Dashboard */}
      {selectedStaff && staffDetails && (
        <Modal
          open={!!selectedStaff}
          onClose={() => setSelectedStaff(null)}
          title={`Staff Dashboard — ${selectedStaff.name}${selectedStaff.displayId ? ` [${selectedStaff.displayId}]` : ''}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Staff Card Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 rounded-lg p-5 border border-slate-200">
              <Avatar initials={getInitials(selectedStaff.name)} size="xl" bg={getAvatarColor(selectedStaff.name)} />
              <div className="text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-lg font-bold text-slate-900"><NameTag name={selectedStaff.name} displayId={selectedStaff.displayId} /></h2>
                  {groups.find(g => g.members.includes(selectedStaff.id)) ? (
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-bold px-2 py-0.5 rounded-full">
                      👥 {groups.find(g => g.members.includes(selectedStaff.id))?.name}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 font-semibold px-2 py-0.5 rounded-full">
                      No Group
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium">{selectedStaff.designation}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {selectedStaff.phone}</span>
                  <span className="flex items-center gap-1"><Mail size={12} className="text-slate-400" /> {selectedStaff.email}</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-1 ${
                  selectedStaff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedStaff.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Tabs control inside Modal */}
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
                Leads & Tasks ({staffDetails.stats.total} / {staffDetails.stats.totalTasks})
              </button>
              <button
                onClick={() => setModalTab('timeline')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all px-4 ${
                  modalTab === 'timeline' ? 'border-brand-green text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Activity Log ({staffDetails.logs.length})
              </button>
            </div>

            {/* Tab: Overview */}
            {modalTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Leads</span>
                    <span className="text-2xl font-extrabold text-slate-800 mt-2 block">{staffDetails.stats.total}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Booked</span>
                    <span className="text-2xl font-extrabold text-emerald-700 mt-2 block">{staffDetails.stats.booked}</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-brand-blue font-bold uppercase tracking-wider block">Active Leads</span>
                    <span className="text-2xl font-extrabold text-blue-700 mt-2 block">{staffDetails.stats.active}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Conversion Rate</span>
                    <span className="text-2xl font-extrabold text-brand-blue mt-2 block flex items-center gap-1">
                      <Percent size={18} /> {staffDetails.stats.conversionRate}%
                    </span>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Pending Tasks</span>
                    <span className="text-2xl font-extrabold text-amber-700 mt-2 block">{staffDetails.stats.pendingTasks}</span>
                  </div>
                </div>

                {/* Funnel and Group details row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Progress Visualizer */}
                  <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Activity size={14} className="text-blue-500" /> Sales Funnel Conversion
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                          <span>Leads Assigned</span>
                          <span>{staffDetails.stats.total} Total</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                          <span>Booked</span>
                          <span>{staffDetails.stats.booked} Booked ({staffDetails.stats.conversionRate}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${staffDetails.stats.conversionRate}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group Details Card */}
                  <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                        👥 Group Assignment
                      </h4>
                      {groups.find(g => g.members.includes(selectedStaff.id)) ? (
                        (() => {
                          const group = groups.find(g => g.members.includes(selectedStaff.id))!;
                          return (
                            <div>
                              <p className="text-sm font-bold text-slate-800">{group.name}</p>
                              <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                              <div className="mt-4 flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-medium">Members:</span>
                                <div className="flex -space-x-1.5 overflow-hidden">
                                  {staffList.filter(s => group.members.includes(s.id)).map(s => (
                                    <div key={s.id} title={s.name}>
                                      <Avatar initials={getInitials(s.name)} size="sm" bg={s.avatarBg} />
                                    </div>
                                  ))}
                                </div>
                                <span className="text-xs text-slate-500">({group.members.length} members)</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-xs text-slate-400 italic">This staff member is not currently assigned to any group.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Leads & Tasks */}
            {modalTab === 'leads' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Leads Log */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col max-h-[360px]">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Briefcase size={14} className="text-blue-500" /> Handling Leads ({staffDetails.leads.length})
                    </h4>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                    {staffDetails.leads.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">No leads currently assigned.</p>
                    ) : (
                      staffDetails.leads.map(lead => (
                        <div key={lead.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-800"><NameTag name={lead.customerName} displayId={lead.displayId} /></p>
                            <p className="text-[10px] text-slate-400">{lead.city} • Interest: {lead.propertyInterest}</p>
                          </div>
                          <StatusBadge status={lead.status} />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Tasks Log */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col max-h-[360px]">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <ListTodo size={14} className="text-blue-500" /> Assigned Tasks ({staffDetails.tasks.length})
                    </h4>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                    {staffDetails.tasks.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">No tasks currently assigned.</p>
                    ) : (
                      staffDetails.tasks.map(task => (
                        <div key={task.id} className="p-3 hover:bg-slate-50 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{task.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">Project: {task.project} • Due: {task.dueDate}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <StatusBadge status={task.priority} size="sm" />
                            <StatusBadge status={task.status} size="sm" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Timeline Activity Logs with IP Address removed */}
            {modalTab === 'timeline' && (
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm max-h-[380px] overflow-y-auto">
                {staffDetails.logs.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">No logged actions recorded for this staff member.</p>
                ) : (
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5">
                    {staffDetails.logs.map(log => (
                      <div key={log.id} className="relative text-xs">
                        {/* Dot indicator */}
                        <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="flex items-center gap-1 font-semibold"><Clock size={10} /> {new Date(log.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p className="font-medium text-slate-800">{log.action}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Entity: {log.entityType} ({log.entityName}) • Action: {log.actionType}</p>
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
