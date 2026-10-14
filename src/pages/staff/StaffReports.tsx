import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Users, ListChecks, Phone, Calendar, Search, Building2, X, ChevronLeft, ChevronRight, Filter, UserPlus, RotateCcw } from 'lucide-react';
import { leadService, taskService, attendanceService, projectService, reportService } from '@/services';
import type { OperationsMetricsData } from '@/services/report';
import { OperationsMetricsCards } from '@/components/shared/OperationsMetricsCards';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/shared/Avatar';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { useExportContext } from '@/context/ExportContext';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { isTaskAssignedTo } from '@/lib/taskAssignee';
import type { Lead, Task, AttendanceRecord } from '@/types';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

type TabType = 'overview' | 'operations' | 'leads' | 'tasks' | 'attendance';

const MONTH_OPTIONS = [
  { value: 'All', label: 'All Months' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = ['All', '2024', '2025', '2026', '2027'];

/* ─── Helpers ─── */
const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0];
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr.split('T')[0];
  }
};

export default function StaffReports() {
  const navigate = useNavigate();
  const { setExportInfo, triggerDownload } = useExportContext();
  const { userId, user, role } = useAuth();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  /* ── Month & Year Filters State (specifically for Overview tab) ── */
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');

  const [opsFilters, setOpsFilters] = useState({ month: '', year: '', dateFrom: '', dateTo: '' });
  const [opsMetrics, setOpsMetrics] = useState<OperationsMetricsData | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  /* ── Master summary stats ── */
  const [summaryLeads, setSummaryLeads] = useState<Lead[]>([]);
  const [summaryCreatedLeads, setSummaryCreatedLeads] = useState<Lead[]>([]);
  const [summaryTasks, setSummaryTasks] = useState<Task[]>([]);
  const [summaryAttendance, setSummaryAttendance] = useState<AttendanceRecord[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  /* ── Projects list for filter ── */
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);

  /* ── Tab Data + Pagination (12 rows per page) ── */
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 12;
  const [totalCount, setTotalCount] = useState(0);

  // Tab 2: Leads data
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatus, setLeadStatus] = useState('All');
  const [leadProject, setLeadProject] = useState('All');
  const [leadDateFrom, setLeadDateFrom] = useState('');
  const [leadDateTo, setLeadDateTo] = useState('');
  const debouncedLeadSearch = useDebounce(leadSearch, 500); // 500ms debounce

  // Tab 3: Tasks data
  const [tasksData, setTasksData] = useState<Task[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatus, setTaskStatus] = useState('All');
  const [taskPriority, setTaskPriority] = useState('All');
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');
  const debouncedTaskSearch = useDebounce(taskSearch, 500);

  // Tab 4: Attendance data
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [attStatus, setAttStatus] = useState('All');
  const [attActivity, setAttActivity] = useState('All');
  const [attDateFrom, setAttDateFrom] = useState('');
  const [attDateTo, setAttDateTo] = useState('');

  /* ── Compute date range bounds from Overview Month & Year selection ── */
  const dateRange = useMemo(() => {
    if (selectedYear === 'All' && selectedMonth === 'All') {
      return { from: undefined, to: undefined };
    }
    const currentYr = new Date().getFullYear();
    const yr = selectedYear !== 'All' ? parseInt(selectedYear) : currentYr;

    if (selectedYear !== 'All' && selectedMonth === 'All') {
      return {
        from: `${selectedYear}-01-01`,
        to: `${selectedYear}-12-31`,
      };
    }
    if (selectedMonth !== 'All') {
      const m = parseInt(selectedMonth);
      const from = `${yr}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(yr, m, 0).getDate();
      const to = `${yr}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    }
    return { from: undefined, to: undefined };
  }, [selectedYear, selectedMonth]);

  /* ── Load initial summary stats + project list ── */
  const fetchSummaryStats = useCallback(async () => {
    if (!userId) { setSummaryLoading(false); return; }
    setSummaryLoading(true);

    const leadParams: Record<string, any> = { assignedTo: userId, limit: 500 };
    const createdParams: Record<string, any> = { sourceType: 'Staff', limit: 500 };
    const taskParams: Record<string, any> = { limit: 500 };
    const attParams: Record<string, any> = { staffId: userId, limit: 500 };

    if (dateRange.from) {
      leadParams['createdAt[gte]'] = `${dateRange.from}T00:00:00.000Z`;
      createdParams['createdAt[gte]'] = `${dateRange.from}T00:00:00.000Z`;
      attParams['date[gte]'] = dateRange.from;
    }
    if (dateRange.to) {
      leadParams['createdAt[lte]'] = `${dateRange.to}T23:59:59.999Z`;
      createdParams['createdAt[lte]'] = `${dateRange.to}T23:59:59.999Z`;
      attParams['date[lte]'] = dateRange.to;
    }

    try {
      const [lRes, cRes, tRes, aRes, pRes] = await Promise.allSettled([
        leadService.getAll(leadParams),
        leadService.getAll(createdParams),
        taskService.getAll(taskParams),
        attendanceService.getAll(attParams),
        projectService.getAll({ limit: 100 }),
      ]);

      if (lRes.status === 'fulfilled') setSummaryLeads(lRes.value.data || []);
      if (cRes.status === 'fulfilled') setSummaryCreatedLeads(cRes.value.data || []);
      if (tRes.status === 'fulfilled') setSummaryTasks(tRes.value.data || []);
      if (aRes.status === 'fulfilled') setSummaryAttendance(aRes.value.data || []);
      if (pRes.status === 'fulfilled') setProjectsList((pRes.value.data || []).map((p: any) => ({ id: p.id || p._id, name: p.name })));
    } catch { /* ignore */ }
    setSummaryLoading(false);
  }, [userId, dateRange]);

  const fetchOperationsMetrics = useCallback(async () => {
    setOpsLoading(true);
    try {
      const res = await reportService.getOperationsMetrics({
        month: opsFilters.month || undefined,
        year: opsFilters.year || undefined,
        dateFrom: opsFilters.dateFrom || undefined,
        dateTo: opsFilters.dateTo || undefined,
      });
      setOpsMetrics(res.data || (res as unknown as OperationsMetricsData));
    } catch {
      setOpsMetrics(null);
    } finally {
      setOpsLoading(false);
    }
  }, [opsFilters]);

  useEffect(() => {
    fetchSummaryStats();
  }, [fetchSummaryStats]);

  useEffect(() => {
    if (activeTab === 'operations') {
      fetchOperationsMetrics();
    }
  }, [activeTab, fetchOperationsMetrics]);

  useEffect(() => {
    if (role !== 'admin') return;
    setExportInfo({
      endpoint: '/export/reports',
      filename: 'staff-report',
      params: { tab: activeTab },
    });
  }, [activeTab, setExportInfo, role]);

  /* ── Tab Switch Handler ── */
  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  /* ── Fetch Tab Specific Data ── */
  const fetchTabData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (activeTab === 'leads') {
        const params: Record<string, any> = {
          assignedTo: userId,
          page,
          limit,
        };
        if (debouncedLeadSearch) params.search = debouncedLeadSearch;
        if (leadStatus !== 'All') params.status = leadStatus;
        if (leadProject !== 'All') params.projectId = leadProject;
        if (leadDateFrom) params['createdAt[gte]'] = `${leadDateFrom}T00:00:00.000Z`;
        if (leadDateTo) params['createdAt[lte]'] = `${leadDateTo}T23:59:59.999Z`;

        const res = await leadService.getAll(params);
        let fetchedLeads: Lead[] = res.data || [];

        if (leadDateFrom) {
          const fromTs = new Date(`${leadDateFrom}T00:00:00.000Z`).getTime();
          fetchedLeads = fetchedLeads.filter(l => {
            const d = l.dateAdded || (l as any).createdAt;
            return d ? new Date(d).getTime() >= fromTs : true;
          });
        }
        if (leadDateTo) {
          const toTs = new Date(`${leadDateTo}T23:59:59.999Z`).getTime();
          fetchedLeads = fetchedLeads.filter(l => {
            const d = l.dateAdded || (l as any).createdAt;
            return d ? new Date(d).getTime() <= toTs : true;
          });
        }

        setLeadsData(fetchedLeads);
        setTotalCount(res.total ?? fetchedLeads.length);
      } else if (activeTab === 'tasks') {
        const res = await taskService.getAll({ page: 1, limit: 200 });
        let list: Task[] = (res.data || []).filter((t: Task) =>
          isTaskAssignedTo(t.assignee, userId, user?.name)
        );

        if (debouncedTaskSearch) {
          const q = debouncedTaskSearch.toLowerCase();
          list = list.filter(t => t.title?.toLowerCase().includes(q));
        }
        if (taskStatus !== 'All') {
          list = list.filter(t => t.status === taskStatus);
        }
        if (taskPriority !== 'All') {
          list = list.filter(t => t.priority === taskPriority);
        }
        if (taskDateFrom) {
          const fromTime = new Date(`${taskDateFrom}T00:00:00.000Z`).getTime();
          list = list.filter(t => t.dueDate && new Date(t.dueDate).getTime() >= fromTime);
        }
        if (taskDateTo) {
          const toTime = new Date(`${taskDateTo}T23:59:59.999Z`).getTime();
          list = list.filter(t => t.dueDate && new Date(t.dueDate).getTime() <= toTime);
        }

        setTotalCount(list.length);
        const startIndex = (page - 1) * limit;
        setTasksData(list.slice(startIndex, startIndex + limit));
      } else if (activeTab === 'attendance') {
        const params: Record<string, any> = {
          staffId: userId,
          page,
          limit,
        };
        if (attStatus !== 'All') params.status = attStatus;
        if (attActivity !== 'All') params.activityType = attActivity;
        if (attDateFrom) params['date[gte]'] = attDateFrom;
        if (attDateTo) params['date[lte]'] = attDateTo;

        const res = await attendanceService.getAll(params);
        let list: AttendanceRecord[] = res.data || [];

        if (attDateFrom) {
          list = list.filter(a => a.date >= attDateFrom);
        }
        if (attDateTo) {
          list = list.filter(a => a.date <= attDateTo);
        }

        setAttendanceData(list);
        setTotalCount(res.total ?? list.length);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [
    userId, user?.name, activeTab, page, limit,
    debouncedLeadSearch, leadStatus, leadProject, leadDateFrom, leadDateTo,
    debouncedTaskSearch, taskStatus, taskPriority, taskDateFrom, taskDateTo,
    attStatus, attActivity, attDateFrom, attDateTo,
  ]);

  useEffect(() => {
    if (activeTab !== 'overview') {
      fetchTabData();
    }
  }, [activeTab, fetchTabData]);

  /* ── Filter Reset Helpers ── */
  const clearLeadFilters = () => {
    setLeadSearch('');
    setLeadStatus('All');
    setLeadProject('All');
    setLeadDateFrom('');
    setLeadDateTo('');
    setPage(1);
  };

  const clearTaskFilters = () => {
    setTaskSearch('');
    setTaskStatus('All');
    setTaskPriority('All');
    setTaskDateFrom('');
    setTaskDateTo('');
    setPage(1);
  };

  const clearAttFilters = () => {
    setAttStatus('All');
    setAttActivity('All');
    setAttDateFrom('');
    setAttDateTo('');
    setPage(1);
  };

  /* ── Overview Summary Calculations ── */
  const myTasksSummary = useMemo(() =>
    summaryTasks.filter(t => isTaskAssignedTo(t.assignee, userId, user?.name)),
    [summaryTasks, userId, user?.name]
  );

  const totalLeads = summaryLeads.length;
  const openLeads = summaryLeads.filter(l => l.status === 'Open').length;
  const qualifiedLeads = summaryLeads.filter(l => l.status === 'Qualified').length;
  const customerLeads = summaryLeads.filter(l => l.status === 'Customer').length;

  // Created Leads count: leads created by this staff member
  const createdLeadsCount = useMemo(() => {
    const map = new Map<string, Lead>();
    summaryLeads.forEach(l => {
      if ((l.sourceType === 'Staff' && l.source === user?.name) || (l as any).createdBy === userId) {
        map.set(l.id || (l as any)._id, l);
      }
    });
    summaryCreatedLeads.forEach(l => {
      if ((l.sourceType === 'Staff' && l.source === user?.name) || l.assignedTo === userId || (l as any).createdBy === userId) {
        map.set(l.id || (l as any)._id, l);
      }
    });
    return map.size;
  }, [summaryLeads, summaryCreatedLeads, user?.name, userId]);

  const totalTasks = myTasksSummary.length;
  const completedTasks = myTasksSummary.filter(t => t.status === 'Done').length;

  const totalPresent = summaryAttendance.filter(a => a.status === 'Present').length;

  const plotsBookedCount = useMemo(() => summaryLeads.filter(l => l.plotId).length, [summaryLeads]);

  const pipelineData = useMemo(() => {
    const statusColors: Record<string, string> = { Open: '#3B82F6', Qualified: '#10B981', Customer: '#8B5CF6', Unqualified: '#EF4444' };
    return ['Open', 'Qualified', 'Customer', 'Unqualified'].map(stage => ({
      stage,
      count: summaryLeads.filter(l => l.status === stage).length,
      color: statusColors[stage],
    }));
  }, [summaryLeads]);

  const taskStatusData = useMemo(() => {
    const statuses = ['To Do', 'In Progress', 'In Review', 'Done'];
    const colors = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];
    return statuses.map((status, i) => ({
      name: status,
      value: myTasksSummary.filter(t => t.status === status).length,
      color: colors[i],
    })).filter(d => d.value > 0);
  }, [myTasksSummary]);

  /* ── Export CSV on Currently Active Tab & Filters ── */
  const exportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filenameTab = activeTab;

    if (activeTab === 'overview' || activeTab === 'leads') {
      headers = ['Customer Name', 'Phone', 'Status', 'Project', 'Source', 'Date Added'];
      const dataToExport = activeTab === 'overview' ? summaryLeads : leadsData;
      rows = dataToExport.map(l => [
        l.customerName,
        l.phone,
        l.status,
        (l as any).projectId?.name || '—',
        l.source || '—',
        formatDate(l.dateAdded || (l as any).createdAt),
      ]);
      filenameTab = 'leads';
    } else if (activeTab === 'tasks') {
      headers = ['Task Title', 'Status', 'Priority', 'Due Date'];
      rows = tasksData.map(t => [
        t.title,
        t.status,
        t.priority,
        formatDate(t.dueDate || ''),
      ]);
    } else if (activeTab === 'attendance') {
      headers = ['Date', 'Status', 'Activity Type', 'Project', 'Check In', 'Check Out', 'Duration'];
      rows = attendanceData.map(a => [
        a.date,
        a.status,
        a.activityType || '—',
        (a as any).projectName || '—',
        a.checkIn || '—',
        a.checkOut || '—',
        a.duration || '—',
      ]);
    }

    if (rows.length === 0) {
      toast.error('No records available to export for the selected filters.');
      return;
    }

    const csvContent = [headers, ...rows]
      .map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff-report-${filenameTab}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} ${filenameTab} records to CSV`);
  };

  /* ── Pagination controls calculation ── */
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Your personal performance & activity overview</p>
        </div>

        {role === 'admin' && (
          <button onClick={triggerDownload} className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all self-start sm:self-auto">
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'operations' as const, label: 'Bookings & Loans' },
            { key: 'leads' as const, label: 'My Leads Report' },
            { key: 'tasks' as const, label: 'My Tasks Report' },
            { key: 'attendance' as const, label: 'Attendance Report' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabSwitch(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.key ? 'border-brand-green text-brand-green' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Month & Year Filter Bar for Overview Tab */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar size={15} className="text-brand-green" />
              <span>Overview Filter Period:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Year Filter */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Year:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {MONTH_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {(selectedYear !== 'All' || selectedMonth !== 'All') && (
                <button
                  onClick={() => { setSelectedYear('All'); setSelectedMonth('All'); }}
                  className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-semibold border border-red-200 transition-colors"
                >
                  Reset Period Filter
                </button>
              )}
            </div>
          </div>

          {summaryLoading ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">

          {/* Overview Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><Users size={20} className="text-brand-blue" /></div>
                <div><p className="text-2xl font-bold text-slate-900">{totalLeads}</p><p className="text-xs text-slate-500">My Leads</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center"><UserPlus size={20} className="text-teal-600" /></div>
                <div><p className="text-2xl font-bold text-slate-900">{createdLeadsCount}</p><p className="text-xs text-slate-500">Created Leads</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center"><ListChecks size={20} className="text-amber-600" /></div>
                <div><p className="text-2xl font-bold text-slate-900">{completedTasks}/{totalTasks}</p><p className="text-xs text-slate-500">Tasks Completed</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center"><Calendar size={20} className="text-rose-600" /></div>
                <div><p className="text-2xl font-bold text-slate-900">{totalPresent}</p><p className="text-xs text-slate-500">Days Present</p></div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Leads Pipeline</h3>
              <p className="text-xs text-slate-400 mb-4">Your lead status distribution</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Task Status Breakdown</h3>
              <p className="text-xs text-slate-400 mb-4">Your task completion status</p>
              <div className="h-52 flex items-center justify-center">
                {taskStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                        {taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-400">No tasks assigned</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {taskStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600">{d.name}: <span className="font-semibold text-slate-800">{d.value}</span></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <p className="text-2xl font-bold text-blue-700">{openLeads}</p>
                  <p className="text-xs text-blue-600 mt-0.5 font-medium">Open Leads</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <p className="text-2xl font-bold text-emerald-700">{qualifiedLeads}</p>
                  <p className="text-xs text-emerald-600 mt-0.5 font-medium">Qualified</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <p className="text-2xl font-bold text-purple-700">{customerLeads}</p>
                  <p className="text-xs text-purple-600 mt-0.5 font-medium">Customers</p>
                </div>
                <div className="text-center p-3 bg-teal-50 rounded-xl">
                  <p className="text-2xl font-bold text-teal-700">{createdLeadsCount}</p>
                  <p className="text-xs text-teal-600 mt-0.5 font-medium">Created Leads</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <p className="text-2xl font-bold text-amber-700">{plotsBookedCount}</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">Plots Booked</p>
                </div>
                <div className="text-center p-3 bg-rose-50 rounded-xl">
                  <p className="text-2xl font-bold text-rose-700">{totalPresent}</p>
                  <p className="text-xs text-rose-600 mt-0.5 font-medium">Days Present</p>
                </div>
              </div>
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bookings & Loans Tab ── */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Filter size={16} className="text-brand-blue" />
                <span>Date Filters for Bookings &amp; Loans</span>
              </div>
              {(opsFilters.month || opsFilters.year || opsFilters.dateFrom || opsFilters.dateTo) && (
                <button
                  type="button"
                  onClick={() => setOpsFilters({ month: '', year: '', dateFrom: '', dateTo: '' })}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                >
                  <RotateCcw size={12} /> Clear Filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Month</label>
                <select
                  value={opsFilters.month}
                  onChange={e => {
                    const month = e.target.value;
                    setOpsFilters(prev => {
                      const next = { ...prev, month };
                      if (month && prev.year) {
                        const mNum = parseInt(month, 10);
                        const yNum = parseInt(prev.year, 10);
                        const lastDay = new Date(yNum, mNum, 0).getDate();
                        next.dateFrom = `${yNum}-${String(mNum).padStart(2, '0')}-01`;
                        next.dateTo = `${yNum}-${String(mNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                      }
                      return next;
                    });
                  }}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium"
                >
                  <option value="">All Months</option>
                  {MONTH_OPTIONS.filter(m => m.value !== 'All').map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Year</label>
                <select
                  value={opsFilters.year}
                  onChange={e => {
                    const year = e.target.value;
                    setOpsFilters(prev => {
                      const next = { ...prev, year };
                      if (prev.month && year) {
                        const mNum = parseInt(prev.month, 10);
                        const yNum = parseInt(year, 10);
                        const lastDay = new Date(yNum, mNum, 0).getDate();
                        next.dateFrom = `${yNum}-${String(mNum).padStart(2, '0')}-01`;
                        next.dateTo = `${yNum}-${String(mNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                      }
                      return next;
                    });
                  }}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium"
                >
                  <option value="">All Years</option>
                  {YEAR_OPTIONS.filter(y => y !== 'All').map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">From Date</label>
                <input
                  type="date"
                  value={opsFilters.dateFrom}
                  onChange={e => setOpsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">To Date</label>
                <input
                  type="date"
                  value={opsFilters.dateTo}
                  onChange={e => setOpsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium"
                />
              </div>
            </div>
          </div>

          <OperationsMetricsCards
            metrics={opsMetrics}
            loading={opsLoading}
            role={role}
            onNavigate={navigate}
          />
        </div>
      )}

      {/* ── 2. My Leads Report Tab ── */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* Leads Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone..."
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setPage(1); }}
                  className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
                />
                {leadSearch && (
                  <button onClick={() => setLeadSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={leadStatus}
                  onChange={e => { setLeadStatus(e.target.value); setPage(1); }}
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none w-full sm:w-auto"
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Customer">Customer</option>
                  <option value="Unqualified">Unqualified</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
              <select
                value={leadProject}
                onChange={e => { setLeadProject(e.target.value); setPage(1); }}
                className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
              >
                <option value="All">All Projects</option>
                {projectsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">From:</span>
                <input
                  type="date"
                  value={leadDateFrom}
                  onChange={e => { setLeadDateFrom(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">To:</span>
                <input
                  type="date"
                  value={leadDateTo}
                  onChange={e => { setLeadDateTo(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {(leadSearch || leadStatus !== 'All' || leadProject !== 'All' || leadDateFrom || leadDateTo) && (
                <button onClick={clearLeadFilters} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors">
                  <X size={13} /> Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Leads Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Customer</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Project</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Source</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leadsData.map(l => (
                      <tr key={l.id || (l as any)._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={getInitials(l.customerName)} size="sm" bg={getAvatarColor(l.customerName)} />
                            <span className="font-semibold text-slate-900">{l.customerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600"><Phone size={12} className="inline mr-1 text-slate-400" />{l.phone}</td>
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{(l as any).projectId?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{l.source || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(l.dateAdded || (l as any).createdAt)}</td>
                      </tr>
                    ))}
                    {leadsData.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">
                          No leads match your selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. My Tasks Report Tab ── */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Tasks Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search task title..."
                  value={taskSearch}
                  onChange={e => { setTaskSearch(e.target.value); setPage(1); }}
                  className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none"
                />
                {taskSearch && (
                  <button onClick={() => setTaskSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={taskStatus}
                  onChange={e => { setTaskStatus(e.target.value); setPage(1); }}
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none w-full sm:w-auto"
                >
                  <option value="All">All Statuses</option>
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="In Review">In Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
              <select
                value={taskPriority}
                onChange={e => { setTaskPriority(e.target.value); setPage(1); }}
                className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:border-brand-green outline-none"
              >
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">Due From:</span>
                <input
                  type="date"
                  value={taskDateFrom}
                  onChange={e => { setTaskDateFrom(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">Due To:</span>
                <input
                  type="date"
                  value={taskDateTo}
                  onChange={e => { setTaskDateTo(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {(taskSearch || taskStatus !== 'All' || taskPriority !== 'All' || taskDateFrom || taskDateTo) && (
                <button onClick={clearTaskFilters} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors">
                  <X size={13} /> Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Tasks Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Task Title</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Priority</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasksData.map(t => (
                      <tr key={t.id || (t as any)._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{t.title}</td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${t.priority === 'High' ? 'bg-red-50 text-red-700 border border-red-200' : t.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(t.dueDate || '')}</td>
                      </tr>
                    ))}
                    {tasksData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">
                          No tasks match your selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Attendance Report Tab ── */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Attendance Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={attStatus}
                  onChange={e => { setAttStatus(e.target.value); setPage(1); }}
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={attActivity}
                  onChange={e => { setAttActivity(e.target.value); setPage(1); }}
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green outline-none"
                >
                  <option value="All">All Activity Types</option>
                  <option value="On Duty">On Duty</option>
                  <option value="Projects">Projects</option>
                  <option value="Bank">Bank</option>
                  <option value="Outside Work">Outside Work</option>
                  <option value="Office">Office</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">From:</span>
                <input
                  type="date"
                  value={attDateFrom}
                  onChange={e => { setAttDateFrom(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-400">To:</span>
                <input
                  type="date"
                  value={attDateTo}
                  onChange={e => { setAttDateTo(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {(attStatus !== 'All' || attActivity !== 'All' || attDateFrom || attDateTo) && (
                <button onClick={clearAttFilters} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors">
                  <X size={13} /> Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Attendance Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Activity</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Project</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Check In</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Check Out</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceData.map(a => (
                      <tr key={a.id || (a as any)._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-900 font-semibold">{a.date}</td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{a.activityType || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{(a as any).projectName || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.checkIn || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.checkOut || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{a.duration || '—'}</td>
                      </tr>
                    ))}
                    {attendanceData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400 font-medium">
                          No attendance records match your selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. Server-Driven React Pagination (12 items per page) ── */}
      {activeTab !== 'overview' && activeTab !== 'operations' && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm mt-4">
          <p className="text-xs text-slate-500 font-medium">
            Showing <span className="font-semibold text-slate-800">{(page - 1) * limit + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(page * limit, totalCount)}</span> of <span className="font-semibold text-slate-800">{totalCount}</span> records
          </p>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {pageNumbers.map((p, idx) => p === '...' ? (
              <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-slate-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                className={`min-w-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${page === p ? 'bg-brand-green text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-700'}`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
