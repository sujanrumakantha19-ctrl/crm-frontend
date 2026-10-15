import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Calendar, MessageSquare, X, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/shared/Avatar';
import { Modal } from '@/components/shared/Modal';
import { NameTag } from '@/components/shared/NameTag';
import { SearchDropdown } from '@/components/shared/SearchDropdown';
import { useAuth } from '@/context/AuthContext';
import { taskAssigneeService } from '@/lib/taskAssignee';
import { CardSkeletonGrid, InfiniteScrollSpinner } from '@/components/shared/SkeletonLoader';
import { logActivity } from '@/lib/activityLogger';
import { useExportContext } from '@/context/ExportContext';
import { formatDate } from '@/lib/utils';
import { taskService, projectService, userService, leadService } from '@/services';
import type { Task, TaskStatus, TaskPriority, User, Project, Lead } from '@/types';

const columns: { key: TaskStatus; label: string; borderColor: string; tabColor: string; tabActiveClass: string }[] = [
  { key: 'To Do',      label: 'To Do',       borderColor: 'border-t-slate-400',   tabColor: 'text-slate-600',   tabActiveClass: 'border-slate-500 text-slate-800 bg-slate-50' },
  { key: 'In Progress',label: 'In Progress', borderColor: 'border-t-blue-500',    tabColor: 'text-brand-blue',    tabActiveClass: 'border-blue-500 text-blue-700 bg-blue-50' },
  { key: 'In Review',  label: 'In Review',   borderColor: 'border-t-amber-500',   tabColor: 'text-amber-600',  tabActiveClass: 'border-amber-500 text-amber-700 bg-amber-50' },
  { key: 'Done',       label: 'Done',        borderColor: 'border-t-emerald-500', tabColor: 'text-emerald-600', tabActiveClass: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
];

export default function AdminTasks() {
  const { role, userId, user } = useAuth();
  const location = useLocation();
  const { triggerDownload } = useExportContext();

  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filteringLoading, setFilteringLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [totalTasks, setTotalTasks] = useState(0);
  const taskPageRef = useRef(1);
  const isFirstMount = useRef(true);

  // --- Backend Filter States ---
  const [projectFilter, setProjectFilter] = useState('All');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');

  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({ 'To Do': 15, 'In Progress': 15, 'Done': 15 });

  // Create task modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [project, setProject] = useState('General');
  const [assignee, setAssignee] = useState(() => userId || '');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');

  const [taskModal, setTaskModal] = useState<Task | null>(null);
  const [comment, setComment] = useState('');

  // Fetch initial metadata (Projects, Leads & Staff)
  useEffect(() => {
    projectService.getAll({ limit: 100 })
      .then(res => setProjects(res.data || []))
      .catch(() => {});

    leadService.getAll({ limit: 500 })
      .then(res => setAllLeads(res.data || []))
      .catch(() => {});

    if (role === 'admin') {
      userService.getAll({ role: 'staff', limit: 100 })
        .then(res => setStaffUsers(res.data || []))
        .catch(() => {});
    }
  }, [role]);

  // --- Main Backend Fetch Handler ---
  const fetchTasks = useCallback(async () => {
    if (isFirstMount.current) {
      setInitialLoading(true);
    } else {
      setFilteringLoading(true);
    }
    taskPageRef.current = 1;
    try {
      const params: Record<string, any> = {
        page: 1,
        limit: 50,
      };
      if (projectFilter !== 'All') params.project = projectFilter;
      if (deadlineFilter) params.dueDate = deadlineFilter;
      if (staffFilter !== 'all') params.assignee = staffFilter;

      const tRes = await taskService.getAll(params);
      setTaskList(tRes.data || []);
      setTotalTasks(tRes.total ?? (tRes.pagination?.total || (tRes.data || []).length));
    } catch {
      // silent
    } finally {
      setInitialLoading(false);
      setFilteringLoading(false);
      isFirstMount.current = false;
    }
  }, [projectFilter, deadlineFilter, staffFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const hasMoreTasks = taskList.length < totalTasks;

  const handleLoadMoreTasks = async () => {
    if (loadingMore || !hasMoreTasks) return;
    setLoadingMore(true);
    const nextPage = taskPageRef.current + 1;
    try {
      const params: Record<string, any> = {
        page: nextPage,
        limit: 50,
      };
      if (projectFilter !== 'All') params.project = projectFilter;
      if (deadlineFilter) params.dueDate = deadlineFilter;
      if (staffFilter !== 'all') params.assignee = staffFilter;

      const tRes = await taskService.getAll(params);
      const newItems = tRes.data || [];
      if (newItems.length > 0) {
        taskPageRef.current = nextPage;
        setTaskList(prev => {
          const existingIds = new Set(prev.map(t => t.id || (t as any)._id));
          const filteredNew = newItems.filter((t: any) => !existingIds.has(t.id || t._id));
          return [...prev, ...filteredNew];
        });
      }
      setTotalTasks(tRes.total ?? (tRes.pagination?.total || totalTasks));
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (userId) setAssignee(userId);
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('taskId');
    if (taskId && taskList.length > 0) {
      const foundTask = taskList.find(t => (t.id || (t as any)._id) === taskId);
      if (foundTask) setTaskModal(foundTask);
    }
  }, [location.search, taskList]);

  const currentUserProfile = role === 'staff' ? (user || null) : null;

  const getProjectName = (projField: any): string => {
    if (!projField) return 'General';
    if (typeof projField === 'object') return projField.name || 'General';
    const idOrName = projField;
    const foundProj = projects.find(p => p.id === idOrName || p._id === idOrName || p.name === idOrName);
    return foundProj ? foundProj.name : idOrName;
  };

  const getProjectInfo = (projField: any): string => {
    if (!projField) return 'General';
    if (typeof projField === 'object') {
      const name = projField.name || 'General';
      const displayId = projField.displayId;
      return displayId ? `${name} [${displayId}]` : name;
    }
    const idOrName = projField;
    const foundProj = projects.find(p => p.id === idOrName || p._id === idOrName || p.name === idOrName);
    if (foundProj) {
      return foundProj.displayId ? `${foundProj.name} [${foundProj.displayId}]` : foundProj.name;
    }
    return idOrName;
  };

  const getCustomerInfo = (task: Task): string => {
    if (!task) return '—';
    const tAny = task as any;

    if (tAny.lead && typeof tAny.lead === 'object') {
      const name = tAny.lead.customerName || tAny.lead.name || '';
      const displayId = tAny.lead.displayId || tAny.lead.id || tAny.lead._id;
      if (name) return displayId ? `${name} [${displayId}]` : name;
    }
    if (tAny.customerName) {
      const name = tAny.customerName;
      const displayId = tAny.customerDisplayId || tAny.leadDisplayId;
      if (displayId) return `${name} [${displayId}]`;
      const matched = allLeads.find(l => l.customerName?.toLowerCase().trim() === name.toLowerCase().trim());
      if (matched) return matched.displayId ? `${matched.customerName} [${matched.displayId}]` : matched.customerName;
      return name;
    }

    const textToSearch = `${task.title || ''} ${task.description || ''}`;
    const match = textToSearch.match(/customer\s+([A-Za-z0-9\s]+?)(?=\s+of|\s+in|\s+for|\.|\,|$)/i);
    if (match && match[1]) {
      const custName = match[1].trim();
      const matched = allLeads.find(l => l.customerName?.toLowerCase().trim() === custName.toLowerCase().trim());
      if (matched) {
        return matched.displayId ? `${matched.customerName} [${matched.displayId}]` : matched.customerName;
      }
      return custName;
    }

    for (const l of allLeads) {
      if (l.customerName && l.customerName.length > 2 && textToSearch.toLowerCase().includes(l.customerName.toLowerCase())) {
        return l.displayId ? `${l.customerName} [${l.displayId}]` : l.customerName;
      }
    }

    return '—';
  };

  const getAssigneeName = (assigneeField: any): string => {
    if (!assigneeField) return '';
    if (typeof assigneeField === 'object') {
      const n = assigneeField.name || '';
      const d = assigneeField.displayId;
      return d ? `${n} [${d}]` : n;
    }
    const idStr = assigneeField;
    if (idStr === userId) {
      const n = user?.name || 'Admin User';
      const d = user?.displayId;
      return d ? `${n} [${d}]` : n;
    }
    const foundStaff = staffUsers.find(s => s.id === idStr || (s as any)._id === idStr || s.name === idStr);
    if (foundStaff) {
      const d = foundStaff.displayId;
      return d ? `${foundStaff.name} [${d}]` : foundStaff.name;
    }
    return idStr;
  };

  const getFormattedDateString = (dateVal: any): string => {
    if (!dateVal) return '';
    const formatted = formatDate(dateVal);
    return formatted === '—' ? '' : formatted;
  };

  // Sort tasks newest first
  const sortedTasks = [...taskList].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error('Task title is required.');
      return;
    }
    setCreating(true);

    const newTaskData: any = {
      title: title.trim(),
      description: description.trim(),
      status: 'To Do',
      priority,
      assignee: assignee || undefined,
      assigneeInitials: assignee === userId ? (user?.initials || 'AU') : (staffUsers.find(s => s.id === assignee)?.initials || 'ST'),
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      project: project === 'General' ? undefined : project,
      comments: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    try {
      const res = await taskService.create(newTaskData);
      const created = res.data as Task;
      setTaskList(prev => [created, ...prev]);

      // No client-side addNotification here: the backend createTask already
      // notifies the real assignee server-side (taskController.js). Calling
      // addNotification again produced a duplicate, mis-targeted alert (issue 32).

      setTitle(''); setDescription(''); setPriority('Medium');
      setProject('General'); setAssignee(userId || '');
      setDueDate(''); setDueTime('');
      setCreateModalOpen(false);
      toast.success('Task created!');
      logActivity({ id: userId!, name: user?.name || 'Admin', role: role || 'admin', initials: user?.initials }, `Created task "${title.trim()}"`, 'Created', 'Task', '', title.trim());
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally { setCreating(false); }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    const existing = taskList.find(t => (t.id || (t as any)._id) === taskId);
    if (existing && existing.status === 'Done' && role === 'staff') {
      toast.error('Completed (Done) tasks cannot be edited by staff.');
      return;
    }
    try {
      await taskService.update(taskId, { status: newStatus } as any);
      setTaskList(prev => prev.map(t => {
        if ((t.id || (t as any)._id) === taskId) {
          const updated = { ...t, status: newStatus };
          if (taskModal && (taskModal.id || (taskModal as any)._id) === taskId) setTaskModal(updated);
          return updated;
        }
        return t;
      }));
      toast.success(`Status updated to "${newStatus}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !taskModal) return;
    const authorName = role === 'admin' ? 'Admin User' : (currentUserProfile?.name || 'Staff User');
    const authorInitials = role === 'admin' ? 'AU' : (currentUserProfile?.initials || 'ST');
    const newComment = {
      id: `comment-${Date.now()}`,
      author: authorName,
      authorInitials,
      text: comment.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) + ' Today',
    };
    const updatedTask = { ...taskModal, comments: [...taskModal.comments, newComment] };
    const taskId = updatedTask.id || (updatedTask as any)._id;
    try {
      await taskService.update(taskId, { comments: updatedTask.comments } as any);
      setTaskList(prev => prev.map(t => (t.id || (t as any)._id) === taskId ? updatedTask : t));
      setTaskModal(updatedTask);
      setComment('');
      toast.success('Comment added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment');
    }
  };

  const [activeTab, setActiveTab] = useState<TaskStatus>('To Do');

  if (initialLoading) return <CardSkeletonGrid count={6} />;

  // Render Task Card
  const renderTaskCard = (task: Task, col: typeof columns[0]) => (
    <button
      key={task.id || (task as any)._id}
      onClick={() => setTaskModal(task)}
      className="w-full bg-white rounded-xl border border-slate-200 p-3 sm:p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <h4 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2">{task.title}</h4>
      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div className="flex items-center gap-2">
          <div title={`Assignee: ${getAssigneeName(task.assignee)}`}>
            <Avatar initials={task.assigneeInitials} size="sm" bg="bg-purple-500" />
          </div>
          <span className={`flex items-center gap-1 text-xs ${isOverdue(task.dueDate) && col.key !== 'Done' ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            <Calendar size={10} />
            {getFormattedDateString(task.dueDate)}{task.dueTime ? ` at ${task.dueTime}` : ''}
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <StatusBadge status={task.priority} size="sm" />
          <span className="text-[10px] bg-blue-50 text-brand-blue px-1.5 py-0.5 rounded font-medium">{getProjectName(task.project).slice(0, 12)}</span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] space-y-3">
      {/* ── Top Bar & Backend Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Tasks</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track project activities and follow-ups. {taskList.length} of {totalTasks} tasks loaded.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Backend Project Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <span className="text-slate-500 font-medium hidden sm:inline">Project:</span>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer"
            >
              <option value="All">All Projects</option>
              {projects.map(p => (
                <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Backend Deadline Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-slate-500 font-medium">Deadline:</span>
            <input
              type="date"
              value={deadlineFilter}
              onChange={e => setDeadlineFilter(e.target.value)}
              className="outline-none text-slate-700 font-semibold bg-transparent cursor-pointer"
            />
            {deadlineFilter && (
              <button onClick={() => setDeadlineFilter('')} className="p-0.5 text-slate-400 hover:text-red-500 rounded">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Admin Staff Filter */}
          {role === 'admin' && (
            <SearchDropdown
              options={[
                { value: 'all', label: 'All Staff' },
                { value: userId || '', label: `Admin User${user?.displayId ? ` [${user.displayId}]` : ''}` },
                ...staffUsers.map(s => ({ value: s.id || (s as any)._id, label: `${s.name}${s.displayId ? ` [${s.displayId}]` : ''}` }))
              ]}
              value={staffFilter}
              onChange={setStaffFilter}
              placeholder="Search Staff..."
            />
          )}

          {/* Clear Filters */}
          {(projectFilter !== 'All' || deadlineFilter || staffFilter !== 'all') && (
            <button
              onClick={() => { setProjectFilter('All'); setDeadlineFilter(''); setStaffFilter('all'); }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Clear Filters
            </button>
          )}

          <button
            onClick={triggerDownload}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all"
          >
            Export CSV
          </button>
          {(role === 'admin' || role === 'staff') && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-green text-white text-xs font-bold rounded-lg hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
            >
              <Plus size={15} /> Create Task
            </button>
          )}
        </div>
      </div>

      {(filteringLoading || loadingMore) && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-blue-50 border border-blue-100 rounded-lg shrink-0">
          <div className="w-3.5 h-3.5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-brand-blue">Updating tasks list...</span>
        </div>
      )}

      {/* ── MOBILE: Tab bar + single column ── */}
      <div className="sm:hidden flex-1 min-h-0 flex flex-col">
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden shrink-0">
          {columns.map(col => {
            const colTasks = sortedTasks.filter(t => t.status === col.key);
            const isActive = activeTab === col.key;
            return (
              <button
                key={col.key}
                onClick={() => setActiveTab(col.key)}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  isActive ? col.tabActiveClass : 'border-transparent text-slate-400'
                }`}
              >
                <span>{col.label}</span>
                <span className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/70' : 'bg-slate-100 text-slate-500'}`}>
                  {colTasks.length}
                </span>
              </button>
            );
          })}
        </div>

        {columns.filter(col => col.key === activeTab).map(col => {
          const colTasks = sortedTasks.filter(t => t.status === col.key);
          const visible = colTasks.slice(0, visibleCount[col.key] || 15);
          const colHasMoreLocal = colTasks.length > (visibleCount[col.key] || 15);
          return (
            <div
              key={col.key}
              className="bg-slate-50/60 rounded-b-xl border border-t-0 border-slate-200 p-2 space-y-2 flex-1 overflow-y-auto"
              onScroll={async e => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  if (colHasMoreLocal) {
                    setVisibleCount(prev => ({ ...prev, [col.key]: (prev[col.key] || 15) + 15 }));
                  } else if (hasMoreTasks && !loadingMore) {
                    await handleLoadMoreTasks();
                  }
                }
              }}
            >
              {(role === 'admin' || role === 'staff') && col.key === 'To Do' && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-400 hover:bg-white hover:border-blue-300 hover:text-blue-500 transition-all"
                >
                  <Plus size={13} /> Add task
                </button>
              )}
              {visible.map(task => renderTaskCard(task, col))}
              {colTasks.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 italic">No tasks here</div>
              )}
              {(colHasMoreLocal || hasMoreTasks) && (
                <InfiniteScrollSpinner text="Loading more tasks..." />
              )}
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP: Full Page Height Kanban ── */}
      <div className="hidden sm:flex gap-4 flex-1 min-h-0 overflow-hidden">
        {columns.map(col => {
          const colTasks = sortedTasks.filter(t => t.status === col.key);
          const visible = colTasks.slice(0, visibleCount[col.key] || 15);
          const colHasMoreLocal = colTasks.length > (visibleCount[col.key] || 15);
          return (
            <div key={col.key} className="flex-1 flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Column Header */}
              <div className={`bg-white border-t-4 ${col.borderColor} border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{col.label}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{colTasks.length}</span>
                </div>
                {(role === 'admin' || role === 'staff') && col.key === 'To Do' && (
                  <button onClick={() => setCreateModalOpen(true)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* Column Content - Infinite Scroll Container */}
              <div
                className="flex-1 overflow-y-auto p-3 space-y-2.5"
                onScroll={async e => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                    if (colHasMoreLocal) {
                      setVisibleCount(prev => ({ ...prev, [col.key]: (prev[col.key] || 15) + 15 }));
                    } else if (hasMoreTasks && !loadingMore) {
                      await handleLoadMoreTasks();
                    }
                  }
                }}
              >
                {visible.map(task => renderTaskCard(task, col))}
                {colTasks.length === 0 && (
                  <div className="text-center py-16 text-xs text-slate-400 italic">No tasks in this column</div>
                )}
                {(colHasMoreLocal || hasMoreTasks) && (
                  <div className="text-center py-3 text-xs text-slate-400 font-medium">Loading more tasks...</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      {taskModal && (
        <Modal open={!!taskModal} onClose={() => { setTaskModal(null); setComment(''); }} title={taskModal.title} size="lg">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left - Description & Comments */}
            <div className="flex-[3]">
              <p className="text-sm text-slate-600 mb-6">{taskModal.description}</p>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <MessageSquare size={16} /> Comments ({taskModal.comments.length})
                </h4>
                <div className="space-y-3 mb-4">
                  {taskModal.comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <Avatar initials={c.authorInitials} size="sm" bg="bg-emerald-500" />
                      <div className="bg-slate-50 rounded-lg p-3 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-800">{c.author}</span>
                          <span className="text-xs text-slate-400">{c.timestamp}</span>
                        </div>
                        <p className="text-sm text-slate-600">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none transition-all"
                    onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { handleAddComment(); } }}
                  />
                  <button onClick={handleAddComment} className="px-4 py-2 bg-brand-green text-white text-sm rounded-lg hover:bg-brand-darkgreen transition-colors font-medium">
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Right - Details */}
            <div className="flex-[2] bg-slate-50 rounded-xl p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase">Assignee</label>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar initials={taskModal.assigneeInitials} size="sm" bg="bg-purple-500" />
                  <span className="text-sm text-slate-800 font-medium">{getAssigneeName(taskModal.assignee)}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">Status</label>
                {taskModal.status === 'Done' ? (
                  <div className="mt-1 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-emerald-800 text-sm font-semibold">
                    <span>Done (Completed)</span>
                    {role === 'admin' ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(taskModal.id || (taskModal as any)._id, 'In Progress')}
                        className="text-xs bg-brand-green text-white px-2.5 py-1 rounded hover:bg-brand-darkgreen transition-colors font-medium"
                      >
                        Reopen Task
                      </button>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Locked</span>
                    )}
                  </div>
                ) : (
                  <select
                    value={taskModal.status}
                    onChange={e => handleUpdateStatus(taskModal.id || (taskModal as any)._id, e.target.value as TaskStatus)}
                    className="w-full mt-1 h-9 px-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all font-medium cursor-pointer"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    {role === 'admin' && <option value="Done">Done</option>}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Due Date</label>
                <p className={`text-sm mt-1 flex items-center gap-1.5 ${isOverdue(taskModal.dueDate) ? 'text-red-500 font-semibold' : 'text-slate-800'}`}>
                  <Calendar size={13} className="text-slate-400" />
                  {getFormattedDateString(taskModal.dueDate)}{taskModal.dueTime ? ` at ${taskModal.dueTime}` : ''}
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Priority</label>
                <div className="mt-1"><StatusBadge status={taskModal.priority} /></div>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">Customer</label>
                <div className="mt-1">
                  <span className="text-xs bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-1 rounded inline-block font-semibold">
                    {getCustomerInfo(taskModal)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">Project</label>
                <div className="mt-1">
                  <span className="text-xs bg-blue-50 text-brand-blue border border-blue-100 px-2 py-1 rounded inline-block font-semibold">
                    {getProjectInfo(taskModal.project)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Created</label>
                <p className="text-sm text-slate-600 mt-1">{getFormattedDateString(taskModal.createdAt)}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Task Modal */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New Task"
          size="md"
          footer={
            <>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creating}
                className="px-4 py-2 bg-brand-green text-white rounded-lg text-sm font-medium hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Task Title <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Follow up on site visit request"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide detailed instructions..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none transition-all resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Assignee <span className="text-red-500 font-bold">*</span>
                </label>
                <select
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value={userId || ''}>Myself ({user?.name}{user?.displayId ? ` [${user.displayId}]` : ''}{!user?.name ? 'Admin User' : ''})</option>
                  {staffUsers.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name}{staff.displayId ? ` [${staff.displayId}]` : ''} — {staff.designation}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Project</label>
                <select
                  value={project}
                  onChange={e => setProject(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value="General">General / Administrative</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none transition-all"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Deadline Date</label>
                <input
                  type="date"
                  value={dueDate}
                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time (Optional)</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function isOverdue(dateStr: string): boolean {
  if (!dateStr || dateStr === 'No deadline') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}
