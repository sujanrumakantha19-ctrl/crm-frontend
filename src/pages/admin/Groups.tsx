import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, Trash2, Award, TrendingUp, CheckSquare, Target, Percent, Eye, X, Search } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Avatar } from '@/components/shared/Avatar';
import { NameTag } from '@/components/shared/NameTag';
import { groupService, userService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { CardSkeletonGrid } from '@/components/shared/SkeletonLoader';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { useDebounce } from '@/hooks/useDebounce';
import type { Group, User } from '@/types';

const MONTH_OPTIONS = [
  { value: 'All', label: 'All Months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = [
  { value: 'All', label: 'All Years' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
];

const isMemberOfGroup = (members?: any[], target?: any): boolean => {
  if (!target || !Array.isArray(members) || members.length === 0) return false;
  const targetId = typeof target === 'string' ? target : (target.id || target._id || '');
  if (!targetId) return false;
  return members.some(m => String(m) === String(targetId) || String((m as any)?.id || (m as any)?._id) === String(targetId));
};

export default function AdminGroups() {
  const { userId, user, role } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'performance'>('all');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<any | null>(null);
  const [viewGroup, setViewGroup] = useState<any | null>(null);
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deleteTargetGroup, setDeleteTargetGroup] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Open Pool Staff Assignment Modal state
  const [assignModalStaff, setAssignModalStaff] = useState<User | null>(null);
  const [assignTargetGroupId, setAssignTargetGroupId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Month & Year Filter state for group reports
  const [reportYear, setReportYear] = useState<string>('All');
  const [reportMonth, setReportMonth] = useState<string>('All');

  // Performance data state from server-side aggregation
  const [performanceData, setPerformanceData] = useState<{
    performance: any[];
    summary: {
      totalLeadsHandled: number;
      conversionsClosed: number;
      qualifiedLeads: number;
      topGroupId: string | null;
    };
  }>({
    performance: [],
    summary: {
      totalLeadsHandled: 0,
      conversionsClosed: 0,
      qualifiedLeads: 0,
      topGroupId: null,
    },
  });
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Modal Search & Infinite Scroll States
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedMemberSearch = useDebounce(memberSearch, 500);
  const [memberVisibleCount, setMemberVisibleCount] = useState(10);

  useEffect(() => {
    setMemberSearch('');
    setMemberVisibleCount(10);
  }, [selectedGroupMembers, viewGroup]);

  useEffect(() => {
    Promise.allSettled([
      groupService.getAll({ limit: 50 }).then(r => setGroupsList(r.data || [])).catch(() => {}),
      userService.getAll({ role: 'staff', limit: 100 }).then(r => setStaffUsers(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPerformanceLoading(true);
    groupService.getPerformance({ year: reportYear, month: reportMonth })
      .then(res => {
        if (res.data) {
          setPerformanceData(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setPerformanceLoading(false));
  }, [reportYear, reportMonth]);

  // Filter only active staff who are not assigned to any group
  const unassignedStaff = useMemo(() => {
    return staffUsers.filter(s => {
      const sId = String(s.id || (s as any)._id);
      return s.isActive !== false && !groupsList.some(g => isMemberOfGroup(g.members, sId));
    });
  }, [staffUsers, groupsList]);

  // When creating: show active unassigned staff
  // When editing: show active members of the current group PLUS active unassigned staff
  const selectableStaffForModal = useMemo(() => {
    return staffUsers.filter(s => {
      const sId = String(s.id || (s as any)._id);
      if (s.isActive === false) return false;
      if (editingGroup && isMemberOfGroup(editingGroup.members, sId)) return true;
      return !groupsList.some(g => isMemberOfGroup(g.members, sId));
    });
  }, [staffUsers, groupsList, editingGroup]);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupMembers([]);
    setCreateOpen(true);
  };

  const handleOpenEdit = (group: Group) => {
    setEditingGroup(group);
    setNewGroupName(group.name || '');
    setNewGroupDesc(group.description || '');
    const currentMemberIds = (group.members || []).map((m: any) => typeof m === 'string' ? m : (m?.id || m?._id || ''));
    setNewGroupMembers(currentMemberIds);
    setCreateOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) {
      const { toast } = await import('sonner');
      toast.error('Group Name is required.');
      return;
    }

    try {
      const { toast } = await import('sonner');
      if (editingGroup) {
        const groupId = editingGroup.id || (editingGroup as any)._id;
        const res = await groupService.update(groupId, {
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          members: newGroupMembers,
        });
        const updatedGroup = res.data;
        setGroupsList(prev => prev.map(g => (g.id === groupId || (g as any)._id === groupId ? updatedGroup : g)));
        setCreateOpen(false);
        setEditingGroup(null);
        toast.success(`Group "${newGroupName.trim()}" updated successfully!`);
        logActivity(
          { id: userId!, name: user!.name, role: role!, initials: user!.initials },
          `Updated group "${newGroupName.trim()}"`,
          'Updated',
          'Group',
          '',
          newGroupName.trim()
        );
      } else {
        const res = await groupService.create({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          members: newGroupMembers,
        });
        setGroupsList(prev => [...prev, res.data]);
        setCreateOpen(false);
        toast.success(`Group "${newGroupName.trim()}" created successfully!`);
        logActivity(
          { id: userId!, name: user!.name, role: role!, initials: user!.initials },
          `Created group "${newGroupName.trim()}"`,
          'Created',
          'Group',
          '',
          newGroupName.trim()
        );
      }
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupMembers([]);
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to save group');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetGroup) return;
    const target = deleteTargetGroup;
    const targetId = target.id || (target as any)._id;
    setIsDeleting(true);
    try {
      await groupService.delete(targetId);
      setGroupsList(prev => prev.filter(g => (g.id !== targetId && (g as any)._id !== targetId)));
      setStaffUsers(prev => prev.map(s => {
        if (s.groupId === targetId) {
          return { ...s, groupId: undefined };
        }
        return s;
      }));
      setDeleteTargetGroup(null);
      const { toast } = await import('sonner');
      toast.success(`Group "${target.name}" deleted successfully!`);
      logActivity(
        { id: userId!, name: user!.name, role: role!, initials: user!.initials },
        `Deleted group "${target.name}"`,
        'Deleted',
        'Group',
        '',
        target.name
      );
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to delete group');
    } finally {
      setIsDeleting(false);
    }
  };

  // Server-aggregated performance data
  const computedGroupsPerformance = useMemo(() => {
    return performanceData.performance || [];
  }, [performanceData]);

  const topGroupId = performanceData.summary?.topGroupId || null;

  const currentGroupPerf = useMemo(() => {
    if (!selectedGroupMembers) return null;
    const targetId = String(selectedGroupMembers.id || (selectedGroupMembers as any)._id);
    return (performanceData.performance || []).find(
      (p: any) => String(p.group?.id || p.group?._id) === targetId
    );
  }, [selectedGroupMembers, performanceData]);

  const viewGroupPerformance = useMemo(() => {
    if (!viewGroup) return null;
    const targetId = String(viewGroup.id || (viewGroup as any)._id);
    return (performanceData.performance || []).find(
      (p: any) => String(p.group?.id || p.group?._id || p.groupId) === targetId
    );
  }, [viewGroup, performanceData]);

  const handleChangeGroup = async (staffId: string, targetGroupId: string) => {
    const oldGroup = groupsList.find(g => isMemberOfGroup(g.members, staffId));
    try {
      if (targetGroupId === 'none') {
        if (oldGroup) {
          await groupService.removeMember(oldGroup.id, staffId);
        }
      } else {
        await groupService.addMember(targetGroupId, staffId, {
          expectedCurrentGroupId: oldGroup ? oldGroup.id : null,
        });
      }

      setGroupsList((prev: any[]) => prev.map((g: any) => {
        let nextMembers = (g.members || []).filter((m: any) => {
          const mId = typeof m === 'string' ? m : (m.id || m._id);
          return String(mId) !== String(staffId);
        });
        if (g.id === targetGroupId) {
          nextMembers = [...nextMembers, staffId];
        }
        return { ...g, members: nextMembers };
      }));

      setViewGroup((prev: any | null) => {
        if (!prev) return null;
        if (targetGroupId !== prev.id) {
          return {
            ...prev,
            members: (prev.members || []).filter((m: any) => {
              const mId = typeof m === 'string' ? m : (m.id || m._id);
              return String(mId) !== String(staffId);
            })
          };
        }
        return prev;
      });

      // Refresh performance data in background
      groupService.getPerformance({ year: reportYear, month: reportMonth })
        .then(res => { if (res.data) setPerformanceData(res.data); })
        .catch(() => {});

      const { toast } = await import('sonner');
      toast.success(targetGroupId === 'none' ? 'Member removed from group' : 'Member moved successfully');
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to update group membership');
      throw err;
    }
  };

  const handleRemoveMember = (staffId: string) => {
    handleChangeGroup(staffId, 'none');
  };

  if (loading) return <CardSkeletonGrid count={4} cols="grid-cols-1 md:grid-cols-2" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{role === 'staff' ? 'Groups (View Only)' : 'Groups'}</h1>
        {role !== 'staff' && (
          <button onClick={handleOpenCreate} className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all">
            <Plus size={16} /> Create Group
          </button>
        )}
      </div>

      {/* Tab Selectors */}
      <div className="border-b border-slate-200 flex gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all px-4 ${
            activeTab === 'all' ? 'border-brand-green text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          All Groups & Management
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all px-4 ${
            activeTab === 'performance' ? 'border-brand-green text-brand-blue' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Group Performance Reports
        </button>
      </div>

      {activeTab === 'all' ? (
        <div className="space-y-6">
          {/* Groups Table */}
          <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Group Name', 'Description', 'Member Count', 'Created Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {groupsList.map(group => (
                  <tr
                    key={group.id}
                    onClick={() => setViewGroup(group)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-brand-blue hover:underline">{group.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{group.description}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 font-medium">{(group.members || []).length} members</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{group.createdAt}</td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewGroup(group)}
                          className="p-1.5 rounded hover:bg-slate-100 text-brand-blue hover:text-blue-800 transition-colors"
                          title="View Group Members"
                        >
                          <Eye size={15} />
                        </button>
                        {role !== 'staff' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(group)}
                              className="p-1.5 rounded hover:bg-slate-100 text-amber-600 hover:text-amber-800 transition-colors"
                              title="Edit Group"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteTargetGroup(group)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                              title="Delete Group"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View for Groups */}
          <div className="md:hidden space-y-3">
            {groupsList.map(group => (
              <div
                key={group.id}
                onClick={() => setViewGroup(group)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-brand-blue hover:underline truncate">{group.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{group.description || 'No description'}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {(group.members || []).length} members
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-50 pt-2">
                  <span>Created: {group.createdAt}</span>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setViewGroup(group)}
                      className="text-brand-green font-semibold hover:underline"
                    >
                      View
                    </button>
                    {role !== 'staff' && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(group)}
                          className="text-amber-600 font-semibold hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTargetGroup(group)}
                          className="text-red-600 font-semibold hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Unassigned Staff - only visible to admin */}
          {role !== 'staff' && (
          <div className="bg-white rounded-lg border-l-[3px] border-l-amber-400 border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-semibold text-slate-900">Staff not assigned to any group</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{unassignedStaff.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {unassignedStaff.map(staff => (
                <div key={staff.id} className="flex items-center gap-2 bg-slate-50 rounded-full pl-1 pr-3 py-1 group">
                  <Avatar initials={getInitials(staff.name)} size="sm" bg={getAvatarColor(staff.name)} />
                  <NameTag name={staff.name} displayId={staff.displayId} className="text-sm text-slate-700" />
                  <button
                    onClick={() => { setAssignModalStaff(staff); setAssignTargetGroupId(''); }}
                    className="text-xs bg-brand-green text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1 font-medium cursor-pointer"
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Month & Year Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Filter Performance Period</h3>
              <p className="text-xs text-slate-500 mt-0.5">Filter group performance & member reports by Month and Year</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Month Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">Month:</span>
                <select
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
                >
                  {MONTH_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Year Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">Year:</span>
                <select
                  value={reportYear}
                  onChange={e => setReportYear(e.target.value)}
                  className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:border-brand-green outline-none cursor-pointer"
                >
                  {YEAR_OPTIONS.map(y => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
              </div>

              {(reportMonth !== 'All' || reportYear !== 'All') && (
                <button
                  onClick={() => { setReportMonth('All'); setReportYear('All'); }}
                  className="text-xs text-brand-blue hover:underline font-bold px-1 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-brand-blue shrink-0">
                <Target size={20} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Leads Handled</span>
                <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">
                  {performanceData.summary?.totalLeadsHandled ?? 0} Leads
                </span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Conversions Closed</span>
                <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">
                  {performanceData.summary?.conversionsClosed ?? 0} Customers
                </span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <CheckSquare size={20} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Qualified Leads</span>
                <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">
                  {performanceData.summary?.qualifiedLeads ?? 0} Qualified
                </span>
              </div>
            </div>
            {topGroupId && (() => {
              const topGroup = groupsList.find(g => g && (g.id === topGroupId || (g as any)._id === topGroupId));
              if (!topGroup) return null;
              return (
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-5 rounded-lg text-white shadow-sm flex items-center gap-4 border border-amber-400">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                    <Award size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-950/80 font-bold uppercase tracking-wider block">🏆 Top Group Performer</span>
                    <span className="text-sm font-bold text-amber-950 mt-0.5 block truncate">
                      {topGroup.name}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Group Performance Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {computedGroupsPerformance.map(({ group, totalLeads, bookingsCount, convertedCustomers, qualifiedLeads, activeLeads, conversionRate, totalFollowUps }) => {
              const groupId = group?.id || (group as any)?._id;
              const isTop = !!topGroupId && groupId === topGroupId;
              
              return (
                <div 
                  key={groupId || Math.random()} 
                  onClick={() => setSelectedGroupMembers(group)}
                  className={`bg-white rounded-xl border p-6 relative transition-all hover:shadow-md cursor-pointer flex flex-col justify-between ${
                    isTop 
                      ? 'border-amber-400 shadow-sm shadow-amber-500/5 bg-amber-50/5' 
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  {isTop && (
                    <span className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[9px] font-bold px-3 py-1 rounded-full border border-amber-400 flex items-center gap-1 shadow-sm">
                      🏆 Rank #1 Top Performer
                    </span>
                  )}

                  <div>
                    {/* Group Header */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          {group.name}
                          {isTop && <span className="text-amber-500 text-sm">⭐</span>}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                      </div>
                      
                      <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded text-center shrink-0">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Members count</span>
                        <span className="text-sm font-bold text-slate-700">{(group.members || []).length} Active</span>
                      </div>
                    </div>

                    {/* Team Members Avatars */}
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">Team Members:</span>
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {staffUsers.filter(s => s && isMemberOfGroup(group.members, s.id || (s as any)._id)).map(s => (
                            <div key={s.id || (s as any)._id} title={`${s.name}${s.displayId ? ` [${s.displayId}]` : ''} (${s.designation || ''})`} className="cursor-help">
                              <Avatar initials={getInitials(s.name)} size="sm" bg={s.avatarBg} />
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">
                          ({staffUsers.filter(s => s && isMemberOfGroup(group.members, s.id || (s as any)._id)).map(s => `${s.name}${s.displayId ? ` [${s.displayId}]` : ''}`).join(', ')})
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedGroupMembers(group)}
                        className="text-xs text-brand-blue hover:text-brand-darkblue font-bold hover:underline shrink-0"
                      >
                        View Team Members
                      </button>
                    </div>

                    {/* KPI Section - 4 Key Group Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-center">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Leads Handled</span>
                        <span className="text-lg font-bold text-slate-800 mt-1 block">{totalLeads} Leads</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-3 text-center">
                        <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider block">Bookings</span>
                        <span className="text-lg font-bold text-emerald-800 mt-1 block">{bookingsCount} Booked</span>
                      </div>
                      <div className="bg-purple-50 border border-purple-200/80 rounded-lg p-3 text-center">
                        <span className="text-[9px] text-purple-700 font-bold uppercase tracking-wider block">Follow-up Logs</span>
                        <span className="text-lg font-bold text-purple-800 mt-1 block">{totalFollowUps} Logs</span>
                      </div>
                      <div className="bg-blue-50 border border-blue-200/80 rounded-lg p-3 text-center">
                        <span className="text-[9px] text-blue-700 font-bold uppercase tracking-wider block">Qualified</span>
                        <span className="text-lg font-bold text-blue-800 mt-1 block">{qualifiedLeads} Qualified</span>
                      </div>
                    </div>

                    {/* Progress visualizer */}
                    <div className="mt-5 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-medium text-slate-500">
                        <span>Lead Conversion Goal Progress</span>
                        <span>{conversionRate}% Rate</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isTop ? 'bg-amber-500' : 'bg-brand-green'}`}
                          style={{ width: `${conversionRate}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Qualified leads footer summary */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CheckSquare size={13} className="text-brand-blue" />
                      Qualified Leads: <strong className="text-slate-700">{qualifiedLeads}</strong>
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      Active: {activeLeads} leads in funnel
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Group Modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditingGroup(null); }}
        title={editingGroup ? `Edit Group — ${editingGroup.name}` : 'Create Group'}
        size="md"
        footer={
          <>
            <button
              onClick={() => { setCreateOpen(false); setEditingGroup(null); }}
              className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveGroup}
              className="px-4 py-2 bg-brand-green text-white rounded-md text-sm hover:bg-brand-darkgreen active:scale-[0.98] transition-all font-medium"
            >
              {editingGroup ? 'Update Group' : 'Save Group'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Group Name <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Sales Team C"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              placeholder="Describe the group..."
              rows={3}
              value={newGroupDesc}
              onChange={e => setNewGroupDesc(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-y min-h-[80px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Members</label>
            <div className="border border-slate-200 rounded-md max-h-[240px] overflow-y-auto divide-y divide-slate-50">
              {selectableStaffForModal.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400 italic">
                  {editingGroup ? 'No active members available.' : 'All active staff members are currently assigned to groups.'}
                </p>
              ) : (
                selectableStaffForModal.map(staff => {
                  const sId = String(staff.id || (staff as any)._id);
                  return (
                    <label key={sId} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={newGroupMembers.includes(sId)}
                        onChange={e => setNewGroupMembers(prev => e.target.checked ? [...prev, sId] : prev.filter(id => id !== sId))}
                        className="rounded border-slate-300 text-brand-blue focus:ring-blue-500"
                      />
                      <Avatar initials={getInitials(staff.name)} size="sm" bg={getAvatarColor(staff.name)} />
                      <div>
                        <p className="text-sm text-slate-800"><NameTag name={staff.name} displayId={staff.displayId} /></p>
                        <p className="text-xs text-slate-400">{staff.designation}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Group Confirmation Modal */}
      <Modal
        open={!!deleteTargetGroup}
        onClose={() => !isDeleting && setDeleteTargetGroup(null)}
        title="Confirm Delete Group"
        size="sm"
        footer={
          <>
            <button
              disabled={isDeleting}
              onClick={() => setDeleteTargetGroup(null)}
              className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              {isDeleting ? 'Deleting...' : 'Delete Group'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            <p className="font-bold">Warning: This action cannot be undone.</p>
            <p className="mt-1">
              Are you sure you want to delete group <strong>"{deleteTargetGroup?.name}"</strong>?
            </p>
          </div>
          <p className="text-xs text-slate-500">
            All staff members ({(deleteTargetGroup?.members || []).length} members) will be automatically unassigned from this group and moved back to unassigned staff.
          </p>
        </div>
      </Modal>

      {/* Team Members Contributions Modal */}
      {selectedGroupMembers && (() => {
        const groupStaff = staffUsers.filter(s => s && isMemberOfGroup(selectedGroupMembers.members, s.id || (s as any)._id));
        const filteredGroupStaff = groupStaff.filter(s => {
          if (!debouncedMemberSearch.trim()) return true;
          const q = debouncedMemberSearch.toLowerCase().trim();
          return (s.name || '').toLowerCase().includes(q) || (s.designation || '').toLowerCase().includes(q);
        });
        const visibleStaff = filteredGroupStaff.slice(0, memberVisibleCount);
        const hasMoreMembers = filteredGroupStaff.length > memberVisibleCount;

        return (
          <Modal
            open={!!selectedGroupMembers}
            onClose={() => setSelectedGroupMembers(null)}
            title={`Team Member Contributions — ${selectedGroupMembers.name}`}
            size="2xl"
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Individual breakdown for members of <strong>{selectedGroupMembers.name}</strong> ({filteredGroupStaff.length} members).
                </p>

                {/* Debounced Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff member..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-md bg-white focus:border-brand-green outline-none"
                  />
                </div>
              </div>
              
              {/* Fixed Height Scrollable Table with Infinite Scroll */}
              <div
                className="max-h-[60vh] overflow-y-auto pr-1 border border-slate-200 rounded-lg bg-white shadow-sm"
                onScroll={e => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
                    if (hasMoreMembers) {
                      setMemberVisibleCount(prev => prev + 10);
                    }
                  }
                }}
              >
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Member</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Leads Handled</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Bookings</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Follow-up Logs</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Qualified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {visibleStaff.map(staff => {
                      const staffId = String(staff.id || (staff as any)._id);
                      const mStat = (currentGroupPerf?.memberStats || []).find(
                        (ms: any) => String(ms.id) === staffId || String(ms._id) === staffId
                      );
                      const totalLeads = mStat ? mStat.totalLeads : 0;
                      const memberBookings = mStat ? mStat.memberBookings : 0;
                      const totalFollowUps = mStat ? mStat.totalFollowUps : 0;
                      const staffQualified = mStat ? mStat.staffQualified : 0;

                      return (
                        <tr key={staff.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar initials={getInitials(staff.name)} size="sm" bg={staff.avatarBg} />
                              <div>
                                <p className="font-semibold text-slate-800"><NameTag name={staff.name} displayId={staff.displayId} /></p>
                                <p className="text-[10px] text-slate-400">{staff.designation}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-semibold">{totalLeads} Leads</td>
                          <td className="px-4 py-3 font-bold text-emerald-700">{memberBookings} Bookings</td>
                          <td className="px-4 py-3 font-semibold text-purple-700">{totalFollowUps} Logs</td>
                          <td className="px-4 py-3 font-semibold text-blue-700">{staffQualified} Qualified</td>
                        </tr>
                      );
                    })}
                    {filteredGroupStaff.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-slate-400 italic">
                          No staff members match "{debouncedMemberSearch}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {hasMoreMembers && (
                  <div className="text-center py-2 text-xs text-slate-400 font-medium bg-slate-50 border-t border-slate-100">
                    Scroll down to load more members...
                  </div>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* View/Manage Group Members Modal */}
      {viewGroup && (() => {
        const groupStaff = staffUsers.filter(s => s && isMemberOfGroup(viewGroup.members, s.id || (s as any)._id));
        const filteredGroupStaff = groupStaff.filter(s => {
          if (!debouncedMemberSearch.trim()) return true;
          const q = debouncedMemberSearch.toLowerCase().trim();
          return (s.name || '').toLowerCase().includes(q) || (s.designation || '').toLowerCase().includes(q);
        });
        const visibleStaff = filteredGroupStaff.slice(0, memberVisibleCount);
        const hasMoreMembers = filteredGroupStaff.length > memberVisibleCount;

        return (
          <Modal
            open={!!viewGroup}
            onClose={() => setViewGroup(null)}
            title={role === 'staff' ? `View Members — ${viewGroup.name}` : `Manage Members — ${viewGroup.name}`}
            size="lg"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-700">Group Description</p>
                  <p className="text-xs text-slate-500 mt-0.5">{viewGroup.description || 'No description provided.'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Members</span>
                  <span className="text-sm font-bold text-slate-700">{viewGroup.members.length} Representatives</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Active Staff Members</h4>
                  {/* Debounced Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search member by name..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-md bg-white focus:border-brand-green outline-none"
                    />
                  </div>
                </div>

                {/* Fixed Height Container with Infinite Scroll */}
                <div
                  className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[55vh] overflow-y-auto bg-white"
                  onScroll={e => {
                    const el = e.currentTarget;
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
                      if (hasMoreMembers) {
                        setMemberVisibleCount(prev => prev + 10);
                      }
                    }
                  }}
                >
                  {filteredGroupStaff.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400 italic">No staff members match the search.</p>
                  ) : (
                    visibleStaff.map(staff => {
                      const staffId = String(staff.id || (staff as any)._id);
                      const mStats = (viewGroupPerformance?.memberStats || []).find(
                        (m: any) => String(m.id || m._id || m.staffId) === staffId
                      );
                      const totalLeads = mStats?.totalLeads ?? 0;
                      const memberBookings = mStats?.memberBookings ?? 0;
                      const totalFollowUps = mStats?.totalFollowUps ?? 0;
                      const staffQualified = mStats?.staffQualified ?? 0;

                      return (
                        <div key={staff.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar initials={getInitials(staff.name)} size="sm" bg={staff.avatarBg} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate"><NameTag name={staff.name} displayId={staff.displayId} /></p>
                              <p className="text-[10px] text-slate-400 truncate">{staff.designation}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">Leads: {totalLeads}</span>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-bold">Bookings: {memberBookings}</span>
                            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded font-semibold">Follow-ups: {totalFollowUps}</span>
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-semibold">Qualified: {staffQualified}</span>
                          </div>

                          {role !== 'staff' ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={viewGroup.id}
                                onChange={(e) => handleChangeGroup(staff.id, e.target.value)}
                                className="h-8 px-2 border border-slate-200 rounded text-xs bg-white focus:border-brand-green outline-none transition-all"
                              >
                                <option value={viewGroup.id}>{viewGroup.name} (Current)</option>
                                {groupsList.filter(g => g.id !== viewGroup.id).map(g => (
                                  <option key={g.id} value={g.id}>Move to {g.name}</option>
                                ))}
                                <option value="none">Remove from Group</option>
                              </select>

                            <button
                              onClick={() => handleRemoveMember(staff.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                              title="Remove from group"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Member</span>
                        )}
                      </div>
                    );
                  })
                )}
                  {hasMoreMembers && (
                    <div className="text-center py-2 text-xs text-slate-400 font-medium bg-slate-50">
                      Scroll down to load more members...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Assign Open Pool Staff Modal */}
      {assignModalStaff && (
        <Modal
          open={!!assignModalStaff}
          onClose={() => { if (!isAssigning) setAssignModalStaff(null); }}
          title="Assign Staff to Group"
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setAssignModalStaff(null)}
                disabled={isAssigning}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!assignTargetGroupId || isAssigning}
                onClick={async () => {
                  if (!assignTargetGroupId || !assignModalStaff) return;
                  setIsAssigning(true);
                  try {
                    await handleChangeGroup(assignModalStaff.id, assignTargetGroupId);
                    setAssignModalStaff(null);
                  } finally {
                    setIsAssigning(false);
                  }
                }}
                className="px-4 py-2 bg-brand-green text-white rounded-lg text-sm font-medium hover:bg-brand-darkgreen transition-all disabled:opacity-50"
              >
                {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Avatar initials={getInitials(assignModalStaff.name)} size="md" bg={getAvatarColor(assignModalStaff.name)} />
              <div>
                <p className="text-sm font-bold text-slate-900"><NameTag name={assignModalStaff.name} displayId={assignModalStaff.displayId} /></p>
                <p className="text-xs text-slate-500">{assignModalStaff.designation || 'Staff Member'}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                Select Group <span className="text-red-500">*</span>
              </label>
              {groupsList.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No groups currently exist. Please create a group first.
                </div>
              ) : (
                <select
                  value={assignTargetGroupId}
                  onChange={e => setAssignTargetGroupId(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all cursor-pointer font-medium"
                >
                  <option value="">-- Choose a group --</option>
                  {groupsList.map(g => (
                    <option key={g.id || (g as any)._id} value={g.id || (g as any)._id}>
                      {g.name} ({(g.members || []).length} members)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
