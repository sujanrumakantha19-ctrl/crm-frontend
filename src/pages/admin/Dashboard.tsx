import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, UserCheck, Home, Cake, FileCheck, CreditCard, MapPin } from 'lucide-react';

import { Timeline } from '@/components/shared/Timeline';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CardSkeletonGrid } from '@/components/shared/SkeletonLoader';
import { leadService, attendanceService, activityLogService, userService, reportService } from '@/services';
import type { OperationsMetricsData, DashboardLeadChartsData } from '@/services/report';
import { OperationsMetricsCards } from '@/components/shared/OperationsMetricsCards';
import { useAuth } from '@/context/AuthContext';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import type { AttendanceRecord, ActivityLog, User, StaffPresenceToday, TodayPresenceSummary } from '@/types';
import { getInitials, getAvatarColor } from '@/data/mockData';

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

function isTodayIST(dateVal?: string): boolean {
  if (!dateVal) return false;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const itemStr = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    return todayStr === itemStr;
  } catch {
    return false;
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [projects, setProjects] = useState(0);
  const [leadCounts, setLeadCounts] = useState({ All: 0, Open: 0, Reserved: 0, Qualified: 0, Unqualified: 0, Customer: 0 });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [presenceRoster, setPresenceRoster] = useState<StaffPresenceToday[]>([]);
  const [presenceSummary, setPresenceSummary] = useState<TodayPresenceSummary | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opsMetrics, setOpsMetrics] = useState<OperationsMetricsData | null>(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [chartData, setChartData] = useState<DashboardLeadChartsData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Recent Activity Infinite Scroll states (server-side)
  const [activityList, setActivityList] = useState<ActivityLog[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivity, setHasMoreActivity] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);

  // Staff Attendance Today Infinite Scroll states (client-side reveal)
  const [visibleAttendanceCount, setVisibleAttendanceCount] = useState(10);

  const fetchPresenceRoster = useCallback(() => {
    attendanceService.getTodayPresence().then(r => {
      const payload = (r as any)?.data;
      if (Array.isArray(payload)) {
        setPresenceRoster(payload);
      } else if (payload?.data && Array.isArray(payload.data)) {
        setPresenceRoster(payload.data);
        if (payload.summary) setPresenceSummary(payload.summary);
      }
      if ((r as any)?.summary) setPresenceSummary((r as any).summary);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchPresenceRoster();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPresenceRoster();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchPresenceRoster]);

  useEffect(() => {
    Promise.allSettled([
      reportService.getSummary().then(r => {
        const data = r.data || (r as unknown as { totalProjects?: number });
        setProjects(data.totalProjects ?? 0);
      }).catch(() => {}),
      leadService.getCounts().then(r => {
        const data = r.data || (r as unknown as typeof leadCounts);
        setLeadCounts({
          All: data.All ?? 0,
          Open: data.Open ?? 0,
          Reserved: data.Reserved ?? 0,
          Qualified: data.Qualified ?? 0,
          Unqualified: data.Unqualified ?? 0,
          Customer: data.Customer ?? 0,
        });
      }).catch(() => {}),
      attendanceService.getToday().then(r => setAttendance(r.data || [])).catch(() => {}),
      activityLogService.getAll({ limit: 10, page: 1, sort: '-timestamp' }).then(r => {
        setActivityList(r.data || []);
        const pagination = (r as any).pagination;
        setHasMoreActivity(!!(pagination && pagination.next));
      }).catch(() => {}),
      userService.getAll({ role: 'staff', limit: 100 }).then(r => setStaff(r.data || [])).catch(() => {}),
      reportService.getOperationsMetrics().then(r => {
        setOpsMetrics(r.data || (r as unknown as OperationsMetricsData));
      }).catch(() => {}),
      reportService.getDashboardLeadCharts().then(r => {
        setChartData(r.data || (r as unknown as DashboardLeadChartsData));
      }).catch(() => {}),
    ]).finally(() => {
      setLoading(false);
      setOpsLoading(false);
      setChartsLoading(false);
    });
  }, []);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), []);

  const todaysRegistrationsCount = opsMetrics?.todaysRegistrations ?? 0;
  const pendingPaymentCustomersCount = opsMetrics?.pendingPaymentRegistrations ?? 0;

  const sortedActivityList = useMemo(() => {
    return [...activityList].sort((a, b) => {
      const dateA = new Date(a.timestamp || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.timestamp || (b as any).createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [activityList]);

  const totalProjects = projects;
  const totalLeads = leadCounts.All;
  const plotsBooked = opsMetrics?.registrationPending ?? 0;

  // Real-time Staff Presence Today (independent of worked hours)
  const staffPresent = presenceSummary?.presentCount ?? (
    presenceRoster.length > 0
      ? presenceRoster.filter(p => p.presence === 'Present').length
      : new Set(
          attendance
            .filter(a => a.status === 'Present')
            .map(a => String((a as any).staffId?._id || (a as any).staffId || a.staffName || ''))
            .filter(Boolean)
        ).size
  );
  const staffTotal = presenceSummary?.totalStaff ?? (staff.length || presenceRoster.length);

  const leadTrendsData = chartData?.monthlyTrend ?? [];
  const leadSourceData = chartData?.sourceBreakdown ?? [];
  const chartTotalLeads = chartData?.totalLeads ?? totalLeads;

  // Group and sort attendance: Present staff first, followed by Half Day and Absent
  const sortedAttendance = useMemo(() => {
    const order: Record<string, number> = { Present: 1, 'Half Day': 2, Absent: 3 };
    return [...attendance].sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99));
  }, [attendance]);

  const displayedAttendance = useMemo(() => {
    if (presenceRoster.length > 0) {
      return presenceRoster.slice(0, visibleAttendanceCount);
    }
    return sortedAttendance.slice(0, visibleAttendanceCount);
  }, [presenceRoster, sortedAttendance, visibleAttendanceCount]);

  const hasMoreAttendance = (presenceRoster.length > 0 ? presenceRoster.length : sortedAttendance.length) > visibleAttendanceCount;

  // Scroll listener for Staff Attendance (client-side reveal)
  const handleAttendanceScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMoreAttendance) {
      setVisibleAttendanceCount(prev => prev + 10);
    }
  };

  // Fetch next page of activity logs from backend
  const fetchNextActivityPage = async () => {
    if (activityLoading || !hasMoreActivity) return;
    setActivityLoading(true);
    const nextPage = activityPage + 1;
    try {
      const res = await activityLogService.getAll({
        limit: 10,
        page: nextPage
      });
      const data = res.data || [];
      setActivityList(prev => [...prev, ...data]);
      setActivityPage(nextPage);
      const pagination = (res as any).pagination;
      setHasMoreActivity(!!(pagination && pagination.next));
    } catch {
      // ignore
    } finally {
      setActivityLoading(false);
    }
  };

  // Scroll listener for Recent Activity (server-side load)
  const handleActivityScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMoreActivity && !activityLoading) {
      fetchNextActivityPage();
    }
  };

  // Upcoming birthdays from staff strictly within the next 30 days (BUG-11)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const upcomingBirthdays = staff
    .filter(s => s.dob)
    .map(s => {
      const dob = new Date(s.dob!);
      let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      next.setHours(0, 0, 0, 0);
      if (next < today) {
        next.setFullYear(next.getFullYear() + 1);
      }
      return { ...s, nextBirthday: next, dateStr: next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    })
    .filter(s => s.nextBirthday >= today && s.nextBirthday <= thirtyDaysLater)
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
    .slice(0, 4);

  if (loading) return <CardSkeletonGrid count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />;

  return (
    <div className="space-y-4">

      {/* Metric Cards — 2x3 compact grid on mobile, 6 columns on xl */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-4">
        {/* Total Projects */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Total Projects</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 size={14} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{totalProjects}</p>
        </div>

        {/* Total Leads */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Total Leads</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Users size={14} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{totalLeads}</p>
        </div>

        {/* Staff Present */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Staff Present</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <UserCheck size={14} className="text-teal-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{staffPresent}<span className="text-sm font-medium text-slate-400">/{staffTotal}</span></p>
        </div>

        {/* Plots Booked */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Plots Booked</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Home size={14} className="text-amber-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{plotsBooked}</p>
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

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-800">Operations Overview</h2>
        <OperationsMetricsCards
          metrics={opsMetrics}
          loading={opsLoading}
          role={role}
          onNavigate={navigate}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">Leads &amp; Customers Trend</h2>
              <p className="text-xs text-slate-400">Monthly breakdown</p>
            </div>
            <span className="text-[11px] font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded">Last 6 Months</span>
          </div>
          <div className="h-40 sm:h-56 w-full text-[10px]">
            {chartsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={leadTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '5px' }} />
                <Area type="monotone" dataKey="Leads" stroke="#3B82F6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="Bookings" name="Customers" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBookings)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart — horizontal layout on mobile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">Lead Contributions</h2>
          <p className="text-xs text-slate-400 mt-0.5">By channel type</p>
          <div className="flex flex-row lg:flex-col items-center gap-4 mt-3">
            <div className="h-28 w-28 sm:h-36 sm:w-36 lg:h-32 lg:w-full relative shrink-0">
              {chartsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={36} outerRadius={50} paddingAngle={3} dataKey="value">
                    {leadSourceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Share']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              )}
              {!chartsLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-slate-800">{chartTotalLeads}</span>
                <span className="text-[9px] uppercase font-semibold text-slate-400">Leads</span>
              </div>
              )}
            </div>
            <div className="flex-1 w-full space-y-2">
              {!chartsLoading && leadSourceData.map(src => (
                <div key={src.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                    <span className="truncate">{src.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800 shrink-0">{src.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity & Attendance */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Recent Activity */}
        <div className="flex-[3] bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col max-h-[320px] sm:h-[420px]">
          <h2 className="text-sm sm:text-lg font-semibold text-slate-900 mb-3">Recent Activity</h2>
          <div onScroll={handleActivityScroll} className="flex-1 overflow-y-auto pr-1">
            {sortedActivityList.length > 0 ? (
              <Timeline items={sortedActivityList.map(a => {
                const isProjectActivity = a.entityType?.toLowerCase() === 'project' || a.action?.toLowerCase().includes('project');
                const projectName = isProjectActivity ? (a.entityName || (a as any).projectName) : undefined;
                const timestampVal = a.timestamp || (a as any).createdAt;
                return {
                  id: a.id || (a as unknown as { _id: string })._id,
                  label: a.action,
                  actor: a.actorName,
                  date: formatISTTime(timestampVal),
                  color: a.actionType === 'Created' ? 'bg-emerald-500' : a.actionType === 'Deleted' ? 'bg-red-500' : 'bg-blue-500',
                  actionType: a.actionType,
                  entityType: a.entityType,
                  projectName: projectName,
                  isToday: isTodayIST(timestampVal),
                };
              })} />
            ) : (
              <p className="text-sm text-slate-400">No recent activity</p>
            )}
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

        {/* Staff Attendance Today */}
        <div className="flex-[2] bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col max-h-[320px] sm:h-[420px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-lg font-semibold text-slate-900">Today's Staff Attendance</h2>
            {presenceSummary && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {presenceSummary.presentCount} / {presenceSummary.totalStaff} Present
              </span>
            )}
          </div>
          <div onScroll={handleAttendanceScroll} className="flex-1 overflow-y-auto pr-1 space-y-0">
            {presenceRoster.length > 0 ? (
              displayedAttendance.map((item: any) => {
                const s = item as StaffPresenceToday;
                const isPresent = s.presence === 'Present';
                const locStr = s.currentLocation || s.currentActivity;

                return (
                  <div key={s.staffId} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="relative shrink-0">
                        <Avatar
                          initials={s.initials || getInitials(s.name)}
                          size="sm"
                          bg={!isPresent ? 'bg-slate-300' : (s.avatarBg || getAvatarColor(s.name))}
                        />
                        {s.hasActiveSession && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse"
                            title="Currently on duty"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          {s.hasActiveSession && (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                              On Duty
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400">
                          {s.firstCheckIn && isPresent ? (
                            <span className="text-slate-600 font-medium">In: {s.firstCheckIn}</span>
                          ) : (
                            <span>{s.designation || 'Sales Executive'}</span>
                          )}
                          {s.lastCheckOut && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>Out: {s.lastCheckOut}</span>
                            </>
                          )}
                          {locStr && isPresent && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium truncate max-w-[130px] sm:max-w-[170px]" title={locStr}>
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate">{locStr}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                        isPresent
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {s.presence}
                    </span>
                  </div>
                );
              })
            ) : displayedAttendance.length > 0 ? (
              displayedAttendance.map((s: any) => {
                const locStr = s.location && s.location !== '-'
                  ? s.location
                  : s.projectName && s.projectName !== '-'
                  ? s.projectName
                  : (s as any).projectId && typeof (s as any).projectId === 'object' && (s as any).projectId.location
                  ? (s as any).projectId.location
                  : s.activityType && s.activityType !== '-'
                  ? s.activityType
                  : undefined;

                return (
                  <div key={s.id || s._id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <Avatar initials={getInitials(s.staffName)} size="sm" bg={s.status === 'Absent' ? 'bg-slate-300' : getAvatarColor(s.staffName)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.staffName}</p>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400">
                          {s.checkIn && s.status !== 'Absent' && <span>{s.checkIn}</span>}
                          {s.checkIn && s.status !== 'Absent' && locStr && <span className="text-slate-300">•</span>}
                          {locStr && s.status !== 'Absent' && (
                            <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium truncate max-w-[130px] sm:max-w-[170px]" title={locStr}>
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{locStr}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400 py-6 text-center">No attendance records</p>
            )}
            {hasMoreAttendance && (
              <p className="text-center text-[10px] text-slate-400 py-3 italic">Scroll down for more...</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm sm:text-lg font-semibold text-slate-900 mb-3">Upcoming Birthdays</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {upcomingBirthdays.map(person => (
              <div key={person.id || (person as unknown as { _id: string })._id} className="flex items-center gap-2.5 bg-amber-50 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3">
                <Avatar initials={person.initials || getInitials(person.name)} size="md" bg={person.avatarBg || getAvatarColor(person.name)} />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{person.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[11px] text-slate-500">{person.dateStr}</p>
                    <Cake size={12} className="text-amber-500 shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
