import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Mail, Phone, Users, Calendar, TrendingUp, UserCheck, ChevronLeft, ChevronRight, User as UserIcon, Pencil, AlertCircle } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { NameTag } from '@/components/shared/NameTag';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Timeline } from '@/components/shared/Timeline';
import { Modal } from '@/components/shared/Modal';
import { getAvatarColor, getInitials } from '@/data/mockData';
import { DetailSkeletonPage } from '@/components/shared/SkeletonLoader';
import { userService, groupService, leadService, taskService, activityLogService, attendanceService } from '@/services';
import type { ActivityLog, User, Group, Lead, Task, AttendanceRecord } from '@/types';
import { toast } from 'sonner';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminStaffDetail() {
  const { id } = useParams<{ id: string }>();
  const [staff, setStaff] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'tasks' | 'activity'>('overview');

  // Tab Data & Lazy Loading States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksPage, setTasksPage] = useState(1);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [totalActivityLogs, setTotalActivityLogs] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);

  // Overview Active Leads
  const [activeLeadsList, setActiveLeadsList] = useState<Lead[]>([]);
  const [totalActiveLeads, setTotalActiveLeads] = useState(0);
  const [activeLeadsPage, setActiveLeadsPage] = useState(1);
  const [activeLeadsLoading, setActiveLeadsLoading] = useState(false);

  // Metrics summary counts
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalLeadsCount: 0,
    openLeads: 0,
    qualifiedLeads: 0,
    customers: 0,
    unqualified: 0,
    pendingTasks: 0,
    completedTasks: 0,
  });

  const itemsPerPage = 10;

  // Initial Mount: Fetch Staff Profile, Group, Attendance & Overview Metrics
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [sRes, gRes, attRes, lOverviewRes, tOverviewRes] = await Promise.allSettled([
        userService.getById(id),
        groupService.getAll({ limit: 100 }),
        attendanceService.getByStaff(id),
        leadService.getAll({ assignedTo: id, limit: 200 }),
        taskService.getAll({ assignee: id, limit: 200 }),
      ]);

      let staffMember: any = null;
      if (sRes.status === 'fulfilled') {
        staffMember = sRes.value.data as any;
        if (staffMember && !staffMember.id) staffMember.id = staffMember._id;
        setStaff(staffMember);
      }
      if (gRes.status === 'fulfilled') setGroups(gRes.value.data || []);
      if (attRes.status === 'fulfilled') setAttendance(attRes.value.data || []);

      let allL: Lead[] = [];
      let allT: Task[] = [];
      if (lOverviewRes.status === 'fulfilled') allL = lOverviewRes.value.data || [];
      if (tOverviewRes.status === 'fulfilled') allT = tOverviewRes.value.data || [];

      setSummaryMetrics({
        totalLeadsCount: lOverviewRes.status === 'fulfilled' ? (lOverviewRes.value.total ?? allL.length) : 0,
        openLeads: allL.filter(l => l.status === 'Open').length,
        qualifiedLeads: allL.filter(l => l.status === 'Qualified').length,
        customers: allL.filter(l => l.status === 'Customer').length,
        unqualified: allL.filter(l => l.status === 'Unqualified').length,
        pendingTasks: allT.filter(t => t.status !== 'Done').length,
        completedTasks: allT.filter(t => t.status === 'Done').length,
      });

      setLoading(false);
    })();
  }, [id]);

  // Lazy Load Overview Active Leads
  const fetchActiveLeads = useCallback(async () => {
    if (!id) return;
    setActiveLeadsLoading(true);
    try {
      const res = await leadService.getAll({ assignedTo: id, page: activeLeadsPage, limit: itemsPerPage });
      const items = res.data || [];
      setActiveLeadsList(items.filter(l => l.status === 'Open' || l.status === 'Qualified'));
      setTotalActiveLeads(res.total ?? items.length);
    } catch {
      // silent
    } finally {
      setActiveLeadsLoading(false);
    }
  }, [id, activeLeadsPage]);

  useEffect(() => {
    if (activeTab === 'overview') fetchActiveLeads();
  }, [activeTab, fetchActiveLeads]);

  // Lazy Load Leads Tab
  const fetchLeadsTab = useCallback(async () => {
    if (!id) return;
    setLeadsLoading(true);
    try {
      const res = await leadService.getAll({ assignedTo: id, page: leadsPage, limit: itemsPerPage });
      setLeads(res.data || []);
      setTotalLeads(res.total ?? (res.pagination?.total || (res.data || []).length));
    } catch {
      // silent
    } finally {
      setLeadsLoading(false);
    }
  }, [id, leadsPage]);

  useEffect(() => {
    if (activeTab === 'leads') fetchLeadsTab();
  }, [activeTab, fetchLeadsTab]);

  // Lazy Load Tasks Tab
  const fetchTasksTab = useCallback(async () => {
    if (!id) return;
    setTasksLoading(true);
    try {
      const res = await taskService.getAll({ assignee: id, page: tasksPage, limit: itemsPerPage });
      setTasks(res.data || []);
      setTotalTasks(res.total ?? (res.pagination?.total || (res.data || []).length));
    } catch {
      // silent
    } finally {
      setTasksLoading(false);
    }
  }, [id, tasksPage]);

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasksTab();
  }, [activeTab, fetchTasksTab]);

  // Lazy Load Activity Logs Tab
  const fetchActivityTab = useCallback(async () => {
    if (!id) return;
    setActivityLoading(true);
    try {
      const res = await activityLogService.getAll({ actorId: id, page: activityPage, limit: itemsPerPage });
      setActivityLogs(res.data || []);
      setTotalActivityLogs(res.total ?? (res.pagination?.total || (res.data || []).length));
    } catch {
      // silent
    } finally {
      setActivityLoading(false);
    }
  }, [id, activityPage]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityTab();
  }, [activeTab, fetchActivityTab]);

  const group = useMemo(() => groups.find(g => (g.members || []).includes(staff?.id || '')), [groups, staff]);

  const totalLeadsPages = Math.ceil(totalLeads / itemsPerPage) || 1;
  const totalTasksPages = Math.ceil(totalTasks / itemsPerPage) || 1;
  const totalActivityPages = Math.ceil(totalActivityLogs / itemsPerPage) || 1;
  const totalActiveLeadsPages = Math.ceil(totalActiveLeads / itemsPerPage) || 1;

  const presentDays = attendance.filter(a => a.status === 'Present').length;
  const absentDays = attendance.filter(a => a.status === 'Absent').length;

  // Edit Modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editGroupId, setEditGroupId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const handleOpenEdit = () => {
    if (!staff) return;
    setEditName(staff.name || '');
    setEditPhone(staff.phone || '');
    setEditEmail(staff.email || '');
    setEditDob(staff.dob ? new Date(staff.dob).toISOString().split('T')[0] : '');
    setEditGender(staff.gender || 'Male');
    setEditGroupId(group?.id || '');
    setEditIsActive(staff.isActive ?? true);
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!staff) return;
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
    const sid = staff.id || (staff as any)._id;
    try {
      const updatedData = {
        name: editName.trim(),
        phone: cleanPhone,
        email: editEmail.trim() || undefined,
        designation: 'Staff Member',
        dob: editDob || undefined,
        gender: editGender,
        groupId: editGroupId || undefined,
        isActive: editIsActive,
        initials: editName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      };
      const res = await userService.update(sid, updatedData);
      setStaff(prev => prev ? { ...prev, ...res.data } : null);
      setEditOpen(false);
      const { toast } = await import('sonner');
      toast.success('Staff member updated successfully!');
    } catch (err: any) {
      setEditError(err.message || 'Failed to update staff member');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <DetailSkeletonPage />;

  if (!staff) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <p className="text-slate-500">Staff member not found.</p>
        <Link to="/admin/staff" className="text-brand-blue text-sm font-semibold mt-2 inline-block">Back to Staff</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/staff" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft size={15} /> Back to Staff
      </Link>

      {/* Profile Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar initials={staff.initials || getInitials(staff.name)} bg={staff.avatarBg || getAvatarColor(staff.name)} size="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900"><NameTag name={staff.name} displayId={staff.displayId} /></h1>
                <StatusBadge status={staff.isActive ? 'Active' : 'Inactive'} />
              </div>
              <p className="text-sm text-slate-500 mt-1">{staff.designation}</p>
              <p className="text-xs text-slate-400 mt-0.5">{(staff as any).employeeId || ''}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{staff.phone}</span>
                <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{staff.email}</span>
                <span className="inline-flex items-center gap-1.5"><UserIcon size={14} className="text-slate-400" />Gender: {staff.gender || 'Male'}</span>
                {group && <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-slate-400" />{group.name}</span>}
                {staff.dob && <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" />DOB: {new Date(staff.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 bg-white text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all shadow-xs shrink-0 self-start lg:self-auto"
          >
            <Pencil size={14} className="text-slate-500" /> Edit Staff
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Leads" value={summaryMetrics.totalLeadsCount} color="blue" />
        <StatCard label="Open" value={summaryMetrics.openLeads} color="slate" />
        <StatCard label="Qualified" value={summaryMetrics.qualifiedLeads} color="emerald" />
        <StatCard label="Customers" value={summaryMetrics.customers} color="green" />
        <StatCard label="Tasks Pending" value={summaryMetrics.pendingTasks} color="amber" />
        <StatCard label="Tasks Done" value={summaryMetrics.completedTasks} color="teal" />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'leads' as const, label: `Leads (${summaryMetrics.totalLeadsCount})` },
            { key: 'tasks' as const, label: `Tasks (${summaryMetrics.pendingTasks + summaryMetrics.completedTasks})` },
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Summary */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><UserCheck size={16} className="text-brand-blue" /> Attendance Summary</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-xl font-bold text-green-700">{presentDays}</p><p className="text-[10px] text-green-600 font-medium">Present</p></div>
              <div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-xl font-bold text-red-700">{absentDays}</p><p className="text-[10px] text-red-600 font-medium">Absent</p></div>
              <div className="text-center p-3 bg-slate-50 rounded-lg"><p className="text-xl font-bold text-slate-700">{attendance.length}</p><p className="text-[10px] text-slate-500 font-medium">Total Days</p></div>
            </div>
          </div>

          {/* Lead Pipeline */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-brand-blue" /> Lead Pipeline</h3>
            <div className="space-y-3">
              <PipelineBar label="Open" count={summaryMetrics.openLeads} total={summaryMetrics.totalLeadsCount} color="bg-blue-500" />
              <PipelineBar label="Qualified" count={summaryMetrics.qualifiedLeads} total={summaryMetrics.totalLeadsCount} color="bg-emerald-500" />
              <PipelineBar label="Customer" count={summaryMetrics.customers} total={summaryMetrics.totalLeadsCount} color="bg-green-600" />
              <PipelineBar label="Unqualified" count={summaryMetrics.unqualified} total={summaryMetrics.totalLeadsCount} color="bg-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
          {leadsLoading ? (
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
                      <th className="px-4 py-3 font-semibold text-slate-600">Source</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Date Added</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Follow-ups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map(lead => {
                      const lid = lead.id || (lead as any)._id;
                      return (
                        <tr key={lid} className="hover:bg-slate-50">
                          <td className="px-4 py-3"><Link to={`/admin/leads/${lid}`} className="font-medium text-slate-900 hover:text-brand-blue"><NameTag name={lead.customerName} displayId={lead.displayId} /></Link></td>
                          <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                          <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                          <td className="px-4 py-3 text-slate-600">{lead.source || '-'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(lead.dateAdded)}</td>
                          <td className="px-4 py-3 text-slate-600">{(lead.followUps || []).length}</td>
                        </tr>
                      );
                    })}
                    {leads.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No leads assigned</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {leads.map(lead => {
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
              {totalLeadsPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-800">{(leadsPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-semibold text-slate-800">{Math.min(leadsPage * itemsPerPage, totalLeads)}</span> of{' '}
                    <span className="font-semibold text-slate-800">{totalLeads}</span> leads
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={leadsPage === 1}
                      onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      disabled={leadsPage === totalLeadsPages}
                      onClick={() => setLeadsPage(p => Math.min(totalLeadsPages, p + 1))}
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

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {tasks.map(task => {
                  const tid = task.id || (task as any)._id;
                  return (
                    <div key={tid} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Due: {formatDate(task.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <StatusBadge status={task.priority} size="sm" />
                        <StatusBadge status={task.status} size="sm" />
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 && <p className="text-center py-8 text-sm text-slate-400">No tasks assigned</p>}
              </div>

              {/* Pagination */}
              {totalTasksPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-800">{(tasksPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-semibold text-slate-800">{Math.min(tasksPage * itemsPerPage, totalTasks)}</span> of{' '}
                    <span className="font-semibold text-slate-800">{totalTasks}</span> tasks
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={tasksPage === 1}
                      onClick={() => setTasksPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      disabled={tasksPage === totalTasksPages}
                      onClick={() => setTasksPage(p => Math.min(totalTasksPages, p + 1))}
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

      {/* Edit Staff Modal */}
      {editOpen && (
        <Modal 
          open={editOpen} 
          onClose={() => { if (!savingEdit) setEditOpen(false); }} 
          title={`Edit Staff — ${staff?.name}`} 
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
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
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
