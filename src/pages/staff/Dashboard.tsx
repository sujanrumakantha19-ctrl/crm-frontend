import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ListChecks, Phone, Sun, FileCheck, CreditCard } from 'lucide-react';
import { CardSkeletonGrid } from '@/components/shared/SkeletonLoader';
import { Timeline } from '@/components/shared/Timeline';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { plotService, leadService, taskService, activityLogService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { isTaskAssignedTo } from '@/lib/taskAssignee';
import type { Lead, Task, ActivityLog, Plot } from '@/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

function formatISTTime(dateVal?: string): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal;
    const day = d.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toLowerCase();
    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return dateVal;
  }
}

function formatDateString(dateVal?: string): string {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateVal;
  }
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { role, userId, user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);

  // Today's Follow-ups Infinite Scroll state (client-side pagination over fetched leads)
  const [visibleFollowUpsCount, setVisibleFollowUpsCount] = useState(10);

  // My Recent Activity Infinite Scroll state (server-side pagination)
  const [activityList, setActivityList] = useState<ActivityLog[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivity, setHasMoreActivity] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.allSettled([
      leadService.getAll({ assignedTo: userId, limit: 100 }).then(r => setLeads(r.data || [])).catch(() => {}),
      taskService.getAll({ limit: 100 }).then(r => setTasks(r.data || [])).catch(() => {}),
      plotService.getMyBookings({ limit: 1000 }).then(r => setPlots(r.data || [])).catch(() => {}),
      activityLogService.getAll({ actorId: userId, limit: 10, page: 1, sort: '-timestamp' }).then(r => {
        setActivityList(r.data || []);
        const pagination = (r as { pagination?: { next?: unknown } }).pagination;
        setHasMoreActivity(!!(pagination && pagination.next));
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [userId]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todaysRegistrationsCount = useMemo(() => {
    return plots.filter(p => {
      if (p.status !== 'Booked') return false;
      if (!p.expectedRegistrationDate) return false;
      const expDateStr = String(p.expectedRegistrationDate).split('T')[0];
      return expDateStr === todayStr;
    }).length;
  }, [plots, todayStr]);

  const pendingPaymentCustomersCount = useMemo(() => {
    return plots.filter(p => {
      if (p.status !== 'Registered') return false;
      const pStatus = p.bookedBy?.paymentStatus || (p as any).paymentStatus;
      return pStatus !== 'Fully Paid';
    }).length;
  }, [plots]);

  // Ensure newest activity is strictly on top
  const sortedActivityList = useMemo(() => {
    return [...activityList].sort((a, b) => {
      const dateA = new Date(a.timestamp || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.timestamp || (b as any).createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [activityList]);

  const currentUser = user || { name: 'Staff' };

  const pipelineData = useMemo(() => {
    const statusColors: Record<string, string> = { Open: '#3B82F6', Qualified: '#10B981', Customer: '#8B5CF6', Unqualified: '#EF4444' };
    return ['Open', 'Qualified', 'Customer', 'Unqualified'].map(stage => ({
      stage,
      count: leads.filter(l => l.status === stage).length,
      color: statusColors[stage],
    }));
  }, [leads]);

  const weeklyTasksData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const myTasks = tasks.filter(t => isTaskAssignedTo(t.assignee, userId, currentUser.name));
    const result: { name: string; Completed: number; Assigned: number }[] = [];

    for (let i = 0; i < 5; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dayStr = day.toISOString().split('T')[0];
      const dayTasks = myTasks.filter(t => t.dueDate?.startsWith(dayStr));
      result.push({
        name: days[day.getDay()],
        Completed: dayTasks.filter(t => t.status === 'Done').length,
        Assigned: dayTasks.length,
      });
    }
    return result;
  }, [tasks, currentUser.name, userId]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const assignedLeadsCount = leads.length;
  const pendingTasksCount = tasks.filter(t => isTaskAssignedTo(t.assignee, userId, currentUser.name) && t.status !== 'Done').length;
  const activeLeadsCount = leads.filter(l => l.status === 'Open').length;

  // Filter leads that are active (Open or Qualified) for follow-ups
  const filteredFollowUps = useMemo(() => {
    return leads.filter(l => l.status === 'Open' || l.status === 'Qualified');
  }, [leads]);

  const displayedFollowUps = useMemo(() => {
    return filteredFollowUps.slice(0, visibleFollowUpsCount);
  }, [filteredFollowUps, visibleFollowUpsCount]);

  const hasMoreFollowUps = filteredFollowUps.length > visibleFollowUpsCount;

  // Scroll listener for Today's Follow-ups (client-side reveal)
  const handleFollowUpsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMoreFollowUps) {
      setVisibleFollowUpsCount(prev => prev + 10);
    }
  };

  // Fetch next page of activity logs from backend
  const fetchNextActivityPage = async () => {
    if (!userId || activityLoading || !hasMoreActivity) return;
    setActivityLoading(true);
    const nextPage = activityPage + 1;
    try {
      const res = await activityLogService.getAll({
        actorId: userId,
        limit: 10,
        page: nextPage
      });
      const data = res.data || [];
      setActivityList(prev => [...prev, ...data]);
      setActivityPage(nextPage);
      const pagination = (res as { pagination?: { next?: unknown } }).pagination;
      setHasMoreActivity(!!(pagination && pagination.next));
    } catch {
      // ignore
    } finally {
      setActivityLoading(false);
    }
  };

  // Scroll listener for Recent Activity (server-side dynamic page load)
  const handleActivityScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMoreActivity && !activityLoading) {
      fetchNextActivityPage();
    }
  };

  if (loading) return <CardSkeletonGrid count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />;

  return (
    <div className="space-y-4">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-4 sm:p-6">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Sun size={20} className="text-amber-500 sm:hidden" />
              <Sun size={24} className="text-amber-500 hidden sm:block" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 leading-tight truncate" title={`Good morning, ${currentUser.name}`}>
                Good morning, {currentUser.name.split(' ')[0]}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Welcome back to your workspace</p>
            </div>
          </div>
          <span className="text-[10px] sm:text-sm text-slate-400 text-right leading-snug shrink-0 max-w-[90px] sm:max-w-none">
            {dateStr}
          </span>
        </div>
      </div>

      {/* Metric Cards — 2x3 compact grid on mobile, 5 columns on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        {/* Leads Assigned */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Leads Assigned</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Users size={14} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{assignedLeadsCount}</p>
        </div>

        {/* Tasks Pending */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Tasks Pending</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <ListChecks size={14} className="text-amber-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{pendingTasksCount}</p>
        </div>

        {/* Active Leads */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Active Leads</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <Phone size={14} className="text-red-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{activeLeadsCount}</p>
        </div>

        {/* Today's Registrations */}
        <button
          type="button"
          onClick={() => navigate(`/${role}/registrations?tab=upcoming&fromDate=${todayStr}&toDate=${todayStr}`)}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2 text-left hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight group-hover:text-purple-600 transition-colors">Today's Registrations</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <FileCheck size={14} className="text-purple-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{todaysRegistrationsCount}</p>
          <span className="text-[10px] text-purple-600 font-semibold group-hover:underline">View Upcoming &rarr;</span>
        </button>

        {/* Pending Payment Registrations */}
        <button
          type="button"
          onClick={() => navigate(`/${role}/registrations?tab=registered&paymentStatus=pending`)}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2 text-left hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group border-l-4 border-l-amber-500"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight group-hover:text-amber-600 transition-colors">Pending Payments</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <CreditCard size={14} className="text-amber-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{pendingPaymentCustomersCount}</p>
          <span className="text-[10px] text-amber-600 font-semibold group-hover:underline">View Registered &rarr;</span>
        </button>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline stage */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">Leads Pipeline Stage</h2>
          <p className="text-xs text-slate-400 mt-0.5">Total assigned leads at each stage</p>
          <div className="h-40 sm:h-52 w-full text-[10px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly tasks line chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">Weekly Tasks Performance</h2>
          <p className="text-xs text-slate-400 mt-0.5">Completed vs assigned tasks this week</p>
          <div className="h-40 sm:h-52 w-full text-[10px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTasksData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '5px' }} />
                <Line type="monotone" dataKey="Completed" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="Assigned" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Today's Follow-ups */}
        <div className="flex-[1] bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col max-h-[320px] sm:h-[420px]">
          <h2 className="text-sm sm:text-lg font-semibold text-slate-900 mb-3">Today's Follow-ups</h2>
          <div
            onScroll={handleFollowUpsScroll}
            className="flex-1 overflow-y-auto pr-1 space-y-0"
          >
            {displayedFollowUps.length === 0 && <p className="text-sm text-slate-400">No active leads</p>}
            {displayedFollowUps.map((f, i) => (
              <div key={f.id || i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{f.customerName}</p>
                  <p className="text-xs text-slate-400">{f.phone}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Added: {formatDateString(f.dateAdded || f.createdAt)}</p>
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
            {hasMoreFollowUps && (
              <p className="text-center text-[10px] text-slate-400 py-3 italic">Scroll down for more...</p>
            )}
            {!hasMoreFollowUps && displayedFollowUps.length > 0 && (
              <p className="text-center text-[10px] text-slate-400 py-3 italic">All follow-ups shown</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="flex-[1] bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col max-h-[320px] sm:h-[420px]">
          <h2 className="text-sm sm:text-lg font-semibold text-slate-900 mb-3">My Recent Activity</h2>
          <div
            onScroll={handleActivityScroll}
            className="flex-1 overflow-y-auto pr-1"
          >
            <Timeline items={sortedActivityList.map(a => ({ id: a.id || (a as unknown as {_id:string})._id, label: a.action, actor: a.actorName, date: formatISTTime(a.timestamp || (a as any).createdAt), color: 'bg-blue-500' }))} />
            {activityLoading && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMoreActivity && activityList.length > 0 && (
              <p className="text-center text-[10px] text-slate-400 py-3 italic">No more activities to load</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
