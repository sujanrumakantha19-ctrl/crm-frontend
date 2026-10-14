/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Building2, Users, Home, TrendingUp, Filter, RotateCcw } from 'lucide-react';
import { useExportContext } from '@/context/ExportContext';
import { reportService } from '@/services';
import type {
  OperationsMetricsData,
  ReportSummaryData,
  ProjectReportRow,
  StaffReportRow,
  AttendanceReportRow,
  LeadsTrendRow,
  LeadContributionRow,
  ChannelPartnerPerformanceRow,
} from '@/services/report';
import { OperationsMetricsCards } from '@/components/shared/OperationsMetricsCards';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { Avatar } from '@/components/shared/Avatar';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';

const PER_PAGE = 12;

const MONTHS = [
  { value: '', label: 'All Months' },
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

const YEARS = ['', '2024', '2025', '2026', '2027'];

interface FilterState {
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
}

const initialFilters: FilterState = {
  month: '',
  year: '',
  dateFrom: '',
  dateTo: '',
};

type TabType = 'projects' | 'staff' | 'attendance' | 'channel-partner-performance' | 'leads-trend' | 'lead-contribution' | 'operations';

type ReportRow = ProjectReportRow &
  StaffReportRow &
  AttendanceReportRow &
  LeadsTrendRow &
  LeadContributionRow &
  ChannelPartnerPerformanceRow & {
    id?: string;
    createdAt?: string;
    totalSqFt?: number;
    plotCount?: number;
    initials?: string;
    designation?: string;
    loanConversions?: number;
    cashConversions?: number;
    open?: number;
    date?: string;
    sourceType?: string;
    latestDate?: string;
    company?: string;
    location?: string;
    checkIn?: string;
    checkOut?: string;
    duration?: string;
  };

export default function AdminReports() {
  const navigate = useNavigate();
  const { setExportInfo, triggerDownload } = useExportContext();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Request generation trackers to prevent stale race conditions
  const tabReqIdRef = useRef(0);
  const summaryReqIdRef = useRef(0);
  const opsReqIdRef = useRef(0);

  // Tab-wise filter states
  const [filters, setFilters] = useState<Record<TabType, FilterState>>({
    projects: { ...initialFilters },
    staff: { ...initialFilters },
    attendance: { ...initialFilters },
    'channel-partner-performance': { ...initialFilters },
    'leads-trend': { ...initialFilters },
    'lead-contribution': { ...initialFilters },
    operations: { ...initialFilters },
  });

  const currentFilter = filters[activeTab];

  // Summary cards
  const [summary, setSummary] = useState<ReportSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [opsMetrics, setOpsMetrics] = useState<OperationsMetricsData | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);

  // Tab data (only current page)
  const [tabData, setTabData] = useState<ReportRow[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  // Fetch summary when active tab's filter changes
  const fetchSummary = useCallback(async (f: FilterState) => {
    const reqId = ++summaryReqIdRef.current;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await reportService.getSummary({
        reportView: 'admin',
        month: f.month || undefined,
        year: f.year || undefined,
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
      });
      if (reqId === summaryReqIdRef.current) {
        setSummary(res.data);
      }
    } catch (err: unknown) {
      if (reqId === summaryReqIdRef.current) {
        setSummary(null);
        setSummaryError(err instanceof Error ? err.message : 'Failed to load summary');
      }
    } finally {
      if (reqId === summaryReqIdRef.current) {
        setSummaryLoading(false);
      }
    }
  }, []);

  const fetchOperationsMetrics = useCallback(async (f: FilterState) => {
    const reqId = ++opsReqIdRef.current;
    setOpsLoading(true);
    setOpsError(null);
    try {
      const res = await reportService.getOperationsMetrics({
        reportView: 'admin',
        month: f.month || undefined,
        year: f.year || undefined,
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
      });
      if (reqId === opsReqIdRef.current) {
        setOpsMetrics(res.data);
      }
    } catch (err: unknown) {
      if (reqId === opsReqIdRef.current) {
        setOpsMetrics(null);
        setOpsError(err instanceof Error ? err.message : 'Failed to load operations metrics');
      }
    } finally {
      if (reqId === opsReqIdRef.current) {
        setOpsLoading(false);
      }
    }
  }, []);

  // Fetch tab data whenever tab, page, or filters change
  const fetchTabData = useCallback(async (tab: TabType, p: number, f: FilterState) => {
    const reqId = ++tabReqIdRef.current;
    setTabLoading(true);
    setTabError(null);
    try {
      const query = {
        reportView: 'admin',
        page: p,
        limit: PER_PAGE,
        month: f.month || undefined,
        year: f.year || undefined,
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
      };

      let resData: unknown[] = [];
      let resTotal = 0;

      if (tab === 'projects') {
        const res = await reportService.getProjects(query);
        resData = res.data || [];
        resTotal = res.total ?? 0;
      } else if (tab === 'staff') {
        const res = await reportService.getStaff(query);
        resData = res.data || [];
        resTotal = res.total ?? 0;
      } else if (tab === 'attendance') {
        const res = await reportService.getAttendance(query);
        resData = res.data || [];
        resTotal = res.total ?? 0;
      } else if (tab === 'channel-partner-performance') {
        const res = await reportService.getChannelPartnerPerformance(query);
        resData = res.data || [];
        resTotal = res.total ?? 0;
      } else if (tab === 'leads-trend') {
        const res = await reportService.getLeadsTrend(query);
        resData = res.data || [];
        resTotal = res.total ?? 0;
      } else if (tab === 'lead-contribution') {
        const res = await reportService.getLeadContribution(query);
        resData = res.data || [];
        resTotal = res.total ?? 0;
      }

      if (reqId === tabReqIdRef.current) {
        setTabData(resData as ReportRow[]);
        setTotal(resTotal);
        const calculatedTotalPages = Math.max(1, Math.ceil(resTotal / PER_PAGE));
        setTotalPages(calculatedTotalPages);
        if (p > calculatedTotalPages) {
          setPage(calculatedTotalPages);
        }
      }
    } catch (err: unknown) {
      if (reqId === tabReqIdRef.current) {
        setTabData([]);
        setTotalPages(1);
        setTabError(err instanceof Error ? err.message : 'Failed to load report data');
      }
    } finally {
      if (reqId === tabReqIdRef.current) {
        setTabLoading(false);
      }
    }
  }, []);

  // Summary only refetches when filters change or activeTab changes away from operations
  useEffect(() => {
    if (activeTab === 'operations') return;
    fetchSummary(currentFilter);
  }, [activeTab, currentFilter, fetchSummary]);

  // Operations metrics refetch when on operations tab and filters change
  useEffect(() => {
    if (activeTab !== 'operations') return;
    fetchOperationsMetrics(currentFilter);
  }, [activeTab, currentFilter, fetchOperationsMetrics]);

  // Paginated tab data refetches when activeTab, page, or currentFilter changes
  useEffect(() => {
    if (activeTab === 'operations') return;
    fetchTabData(activeTab, page, currentFilter);
  }, [activeTab, page, currentFilter, fetchTabData]);

  useEffect(() => {
    const f = filters[activeTab];
    const params: Record<string, string> = { tab: activeTab, reportView: 'admin' };
    if (f.month) params.month = f.month;
    if (f.year) params.year = f.year;
    if (f.dateFrom) params.dateFrom = f.dateFrom;
    if (f.dateTo) params.dateTo = f.dateTo;
    setExportInfo({
      endpoint: '/export/reports',
      filename: `report-${activeTab}`,
      params,
    });
  }, [activeTab, filters, setExportInfo]);

  const updateCurrentFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => {
      const updated = { ...prev[activeTab], [key]: value };

      // Mutual clearing between month/year and custom dateFrom/dateTo
      if (key === 'month' || key === 'year') {
        const m = key === 'month' ? value : updated.month;
        const y = key === 'year' ? value : updated.year;
        if (m && y) {
          const mNum = parseInt(m, 10);
          const yNum = parseInt(y, 10);
          const lastDay = new Date(yNum, mNum, 0).getDate();
          updated.dateFrom = `${yNum}-${String(mNum).padStart(2, '0')}-01`;
          updated.dateTo = `${yNum}-${String(mNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else {
          updated.dateFrom = '';
          updated.dateTo = '';
        }
      } else if (key === 'dateFrom' || key === 'dateTo') {
        updated.month = '';
        updated.year = '';
      }

      return {
        ...prev,
        [activeTab]: updated,
      };
    });
    setPage(1);
  };

  const resetFilter = () => {
    setFilters(prev => ({
      ...prev,
      [activeTab]: { ...initialFilters },
    }));
    setPage(1);
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setTabData([]);
    setTabError(null);
  };

  const s = summary || ({} as Partial<ReportSummaryData>);
  const isFiltered = !!(currentFilter.month || currentFilter.year || currentFilter.dateFrom || currentFilter.dateTo);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'projects':
        return 'Project Summary';
      case 'staff':
        return 'Staff Performance';
      case 'attendance':
        return 'Attendance';
      case 'channel-partner-performance':
        return 'Channel Partner Performance';
      case 'leads-trend':
        return 'Leads & Booking Trend';
      case 'lead-contribution':
        return 'Lead Contribution';
      case 'operations':
        return 'Bookings & Loans';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        {role === 'admin' && (
          <button onClick={triggerDownload} className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Summary Error Banner */}
      {activeTab !== 'operations' && summaryError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-center justify-between text-xs">
          <span>Failed to load summary: {summaryError}</span>
          <button
            onClick={() => fetchSummary(currentFilter)}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {activeTab !== 'operations' && (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { icon: <Building2 size={20} className="text-brand-blue" />, bg: 'bg-blue-50', value: s.totalProjects ?? '—', label: 'Projects' },
          { icon: <Users size={20} className="text-green-600" />, bg: 'bg-green-50', value: s.totalLeads ?? '—', label: 'Total Leads' },
          { icon: <TrendingUp size={20} className="text-emerald-600" />, bg: 'bg-emerald-50', value: s.totalCustomers ?? '—', label: `Customers (${s.conversionRate ?? 0}%)` },
          { icon: <Home size={20} className="text-amber-600" />, bg: 'bg-amber-50', value: s.totalPlotsBooked ?? '—', label: 'Plots Booked' },
          { icon: <Users size={20} className="text-indigo-600" />, bg: 'bg-indigo-50', value: s.loanCustomers ?? '—', label: 'Loan Customers' },
          { icon: <Users size={20} className="text-cyan-600" />, bg: 'bg-cyan-50', value: s.cashCustomers ?? '—', label: 'Cash Customers' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>{card.icon}</div>
              <div>
                {summaryLoading ? (
                  <div className="w-10 h-6 bg-slate-100 animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                )}
                <p className="text-xs text-slate-500">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Conversion Funnel */}
      {activeTab !== 'operations' && (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Lead Conversion Funnel</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{summaryLoading ? '…' : s.funnelOpen ?? 0}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Open</p>
          </div>
          <div className="text-slate-300 text-lg font-bold">→</div>
          <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{summaryLoading ? '…' : s.funnelQualified ?? 0}</p>
            <p className="text-[10px] text-blue-500 uppercase font-semibold">Qualified</p>
          </div>
          <div className="text-slate-300 text-lg font-bold">→</div>
          <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{summaryLoading ? '…' : s.funnelCustomer ?? 0}</p>
            <p className="text-[10px] text-emerald-500 uppercase font-semibold">Customer (Booked)</p>
          </div>
        </div>
      </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {[
            { key: 'projects' as const, label: 'Project Summary' },
            { key: 'staff' as const, label: 'Staff Performance' },
            { key: 'attendance' as const, label: 'Attendance' },
            { key: 'channel-partner-performance' as const, label: 'Channel Partner Performance' },
            { key: 'leads-trend' as const, label: 'Leads & Booking Trend' },
            { key: 'lead-contribution' as const, label: 'Lead Contribution' },
            { key: 'operations' as const, label: 'Bookings & Loans' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'border-brand-green text-brand-blue font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab-wise Date Filter Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter size={16} className="text-brand-blue" />
            <span>
              Date Filters for <span className="capitalize text-brand-green">{getTabTitle()}</span>
            </span>
          </div>
          {isFiltered && (
            <button onClick={resetFilter} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
              <RotateCcw size={12} /> Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Month Selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Month</label>
            <select
              value={currentFilter.month}
              onChange={e => updateCurrentFilter('month', e.target.value)}
              className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Year</label>
            <select
              value={currentFilter.year}
              onChange={e => updateCurrentFilter('year', e.target.value)}
              className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              <option value="">All Years</option>
              {YEARS.filter(Boolean).map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">From Date</label>
            <div className="relative">
              <input
                type="date"
                value={currentFilter.dateFrom}
                onChange={e => updateCurrentFilter('dateFrom', e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">To Date</label>
            <div className="relative">
              <input
                type="date"
                value={currentFilter.dateTo}
                onChange={e => updateCurrentFilter('dateTo', e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'operations' && (
        opsError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Failed to load operations metrics</p>
              <p className="text-xs text-red-600 mt-0.5">{opsError}</p>
            </div>
            <button
              onClick={() => fetchOperationsMetrics(currentFilter)}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Boolean(opsMetrics?.unknownBookingDateCount) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs flex items-center justify-between">
                <span>
                  <strong>Note:</strong> {opsMetrics?.unknownBookingDateCount} historical booking(s) do not have a verifiable booking date and are excluded from date-filtered metrics.
                </span>
              </div>
            )}
            <OperationsMetricsCards
              metrics={opsMetrics}
              loading={opsLoading}
              role={role || 'admin'}
              onNavigate={navigate}
            />
          </div>
        )
      )}

      {/* Table */}
      {activeTab !== 'operations' && (tabLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tabError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Failed to load report data</p>
            <p className="text-xs text-red-600 mt-0.5">{tabError}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetFilter}
              className="px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-700 rounded text-xs font-medium"
            >
              Reset Filters
            </button>
            <button
              onClick={() => fetchTabData(activeTab, page, currentFilter)}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  {activeTab === 'projects' && (
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Project</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Created Date</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right">Total Sq. Ft.</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Total Plots</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Booked</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Registered</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Available</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Loan</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cash</th>
                    </tr>
                  )}
                  {activeTab === 'attendance' && (
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Staff</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Location</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Project</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Check In</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Check Out</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Duration</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Role</th>
                    </tr>
                  )}
                  {activeTab === 'staff' && (
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Staff</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Designation</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Assigned Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Converted</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Loan</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cash</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Open</th>
                    </tr>
                  )}
                  {activeTab === 'leads-trend' && (
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Total Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Open Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Qualified Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Plots Booked</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Loan Bookings</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cash Bookings</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Conversion %</th>
                    </tr>
                  )}
                  {activeTab === 'lead-contribution' && (
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Source / Channel</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Recent Lead Date</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Total Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Converted</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Plots Booked</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Loan</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cash</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Conversion %</th>
                    </tr>
                  )}
                  {activeTab === 'channel-partner-performance' && (
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Channel Partner</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Phone</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Company</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Total Leads</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Converted</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Plots Booked</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Loan</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cash</th>
                      <th className="px-4 py-3 font-semibold text-slate-600 text-center">Conversion %</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'projects' &&
                    tabData.map(p => (
                      <tr key={p._id || p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <NameTag name={p.name} displayId={p.displayId} />
                          <span className="text-xs text-slate-400 ml-2">{p.location}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {p.totalSqFt ? `${Math.round(p.totalSqFt).toLocaleString()} sq ft` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">{p.plotCount ?? 0}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-semibold">{p.booked ?? 0}</td>
                        <td className="px-4 py-3 text-center text-blue-700 font-semibold">{p.registered ?? 0}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{p.available ?? 0}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{p.leadCount ?? 0}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 font-semibold">{p.loanBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-cyan-600 font-semibold">{p.cashBookings ?? 0}</td>
                      </tr>
                    ))}
                  {activeTab === 'attendance' &&
                    tabData.map(a => (
                      <tr key={a._id || a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar initials={getInitials(a.staffName)} size="sm" bg={getAvatarColor(a.staffName)} />
                            <span className="font-medium text-slate-900">{a.staffName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{a.date}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.location || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.projectName || a.project || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.checkIn || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.checkOut || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.duration || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.role || '-'}</td>
                      </tr>
                    ))}
                  {activeTab === 'staff' &&
                    tabData.map(s => (
                      <tr key={s._id || s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar initials={s.initials || getInitials(s.name)} size="sm" bg={getAvatarColor(s.name)} />
                            <span className="font-medium text-slate-900">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{s.designation || '-'}</td>
                        <td className="px-4 py-3 text-center font-semibold">{s.assignedLeads ?? 0}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-semibold">{s.converted ?? 0}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 font-semibold">{s.loanConversions ?? 0}</td>
                        <td className="px-4 py-3 text-center text-cyan-600 font-semibold">{s.cashConversions ?? 0}</td>
                        <td className="px-4 py-3 text-center text-brand-blue font-semibold">{s.open ?? 0}</td>
                      </tr>
                    ))}
                  {activeTab === 'leads-trend' &&
                    tabData.map(t => (
                      <tr key={t.date} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 text-xs">{t.date}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{t.totalLeads ?? 0}</td>
                        <td className="px-4 py-3 text-center text-amber-600 font-semibold">{t.openLeads ?? 0}</td>
                        <td className="px-4 py-3 text-center text-blue-600 font-semibold">{t.qualifiedLeads ?? 0}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-semibold">{t.plotsBooked ?? 0}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 font-semibold">{t.loanBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-cyan-600 font-semibold">{t.cashBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-bold">{t.conversionRate ?? 0}%</td>
                      </tr>
                    ))}
                  {activeTab === 'lead-contribution' &&
                    tabData.map(c => (
                      <tr key={c.sourceType} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.sourceType}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{c.latestDate}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{c.totalLeads ?? 0}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-semibold">{c.converted ?? 0}</td>
                        <td className="px-4 py-3 text-center text-amber-600 font-semibold">{c.plotsBooked ?? 0}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 font-semibold">{c.loanBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-cyan-600 font-semibold">{c.cashBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-bold">{c.conversionRate ?? 0}%</td>
                      </tr>
                    ))}
                  {activeTab === 'channel-partner-performance' &&
                    tabData.map(cp => (
                      <tr key={cp._id || cp.id || cp.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar initials={getInitials(cp.name)} size="sm" bg={getAvatarColor(cp.name)} />
                            <span className="font-medium text-slate-900">{cp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{cp.phone || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{cp.company || '-'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{cp.totalLeads ?? 0}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-semibold">{cp.converted ?? 0}</td>
                        <td className="px-4 py-3 text-center text-amber-600 font-semibold">{cp.plotsBooked ?? 0}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 font-semibold">{cp.loanBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-cyan-600 font-semibold">{cp.cashBookings ?? 0}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-bold">{cp.conversionRate ?? 0}%</td>
                      </tr>
                    ))}
                  {tabData.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">
                        No data available for the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {activeTab === 'projects' &&
              tabData.map(p => (
                <div key={p._id || p.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900">
                      <NameTag name={p.name} displayId={p.displayId} />
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {p.location} • Created: {p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '-'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Total Sq. Ft.:</span> <span className="font-semibold text-slate-700">{p.totalSqFt ? `${Math.round(p.totalSqFt).toLocaleString()} sq ft` : '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Plots:</span> <span className="font-semibold">{p.plotCount ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Booked:</span> <span className="font-semibold text-green-700">{p.booked ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Registered:</span> <span className="font-semibold text-blue-700">{p.registered ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Available:</span> <span className="font-semibold">{p.available ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Loan:</span> <span className="font-semibold text-indigo-600">{p.loanBookings ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Cash:</span> <span className="font-semibold text-cyan-600">{p.cashBookings ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            {activeTab === 'attendance' &&
              tabData.map(a => (
                <div key={a._id || a.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar initials={getInitials(a.staffName)} size="sm" bg={getAvatarColor(a.staffName)} />
                      <span className="text-sm font-semibold text-slate-900">{a.staffName}</span>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                    <div>
                      <span className="text-slate-400">Date:</span> {a.date}
                    </div>
                    <div>
                      <span className="text-slate-400">Location:</span> {a.location || '-'}
                    </div>
                    <div>
                      <span className="text-slate-400">Project:</span> {a.projectName || a.project || '-'}
                    </div>
                    <div>
                      <span className="text-slate-400">Check In:</span> {a.checkIn || '-'}
                    </div>
                    <div>
                      <span className="text-slate-400">Check Out:</span> {a.checkOut || '-'}
                    </div>
                    <div>
                      <span className="text-slate-400">Duration:</span> {a.duration || '-'}
                    </div>
                  </div>
                </div>
              ))}
            {activeTab === 'staff' &&
              tabData.map(s => (
                <div key={s._id || s.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar initials={s.initials || getInitials(s.name)} size="sm" bg={getAvatarColor(s.name)} />
                    <span className="text-sm font-bold text-slate-900">{s.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{s.designation}</p>
                  <div className="grid grid-cols-5 gap-2 text-xs text-center">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="font-bold text-blue-700">{s.assignedLeads ?? 0}</p>
                      <p className="text-[10px] text-brand-blue">Assign</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="font-bold text-green-700">{s.converted ?? 0}</p>
                      <p className="text-[10px] text-green-600">Total</p>
                    </div>
                    <div className="bg-indigo-50 rounded p-2">
                      <p className="font-bold text-indigo-700">{s.loanConversions ?? 0}</p>
                      <p className="text-[10px] text-indigo-500">Loan</p>
                    </div>
                    <div className="bg-cyan-50 rounded p-2">
                      <p className="font-bold text-cyan-700">{s.cashConversions ?? 0}</p>
                      <p className="text-[10px] text-cyan-500">Cash</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <p className="font-bold text-slate-700">{s.open ?? 0}</p>
                      <p className="text-[10px] text-slate-500">Open</p>
                    </div>
                  </div>
                </div>
              ))}
            {activeTab === 'leads-trend' &&
              tabData.map(t => (
                <div key={t.date} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900">Date: {t.date}</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{t.conversionRate ?? 0}% Conv.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Total Leads:</span> <span className="font-semibold text-slate-900">{t.totalLeads ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Plots Booked:</span> <span className="font-semibold text-green-700">{t.plotsBooked ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Open Leads:</span> <span className="font-semibold text-amber-600">{t.openLeads ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Qualified:</span> <span className="font-semibold text-blue-600">{t.qualifiedLeads ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Loan:</span> <span className="font-semibold text-indigo-600">{t.loanBookings ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Cash:</span> <span className="font-semibold text-cyan-600">{t.cashBookings ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            {activeTab === 'lead-contribution' &&
              tabData.map(c => (
                <div key={c.sourceType} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-900">{c.sourceType}</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{c.conversionRate ?? 0}% Conv.</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">Recent Lead Date: {c.latestDate}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Total Leads:</span> <span className="font-semibold text-slate-900">{c.totalLeads ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Converted:</span> <span className="font-semibold text-green-700">{c.converted ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Plots Booked:</span> <span className="font-semibold text-amber-600">{c.plotsBooked ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Loan:</span> <span className="font-semibold text-indigo-600">{c.loanBookings ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Cash:</span> <span className="font-semibold text-cyan-600">{c.cashBookings ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            {activeTab === 'channel-partner-performance' &&
              tabData.map(cp => (
                <div key={cp._id || cp.id || cp.name} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar initials={getInitials(cp.name)} size="sm" bg={getAvatarColor(cp.name)} />
                    <span className="text-sm font-bold text-slate-900">{cp.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{cp.phone || '-'} {cp.company ? `• ${cp.company}` : ''}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-center">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="font-bold text-blue-700">{cp.totalLeads ?? 0}</p>
                      <p className="text-[10px] text-brand-blue">Total Leads</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="font-bold text-green-700">{cp.converted ?? 0}</p>
                      <p className="text-[10px] text-green-600">Converted</p>
                    </div>
                    <div className="bg-amber-50 rounded p-2">
                      <p className="font-bold text-amber-700">{cp.plotsBooked ?? 0}</p>
                      <p className="text-[10px] text-amber-500">Plots Booked</p>
                    </div>
                    <div className="bg-emerald-50 rounded p-2">
                      <p className="font-bold text-emerald-700">{cp.conversionRate ?? 0}%</p>
                      <p className="text-[10px] text-emerald-500">Conversion</p>
                    </div>
                    <div className="bg-indigo-50 rounded p-2">
                      <p className="font-bold text-indigo-700">{cp.loanBookings ?? 0}</p>
                      <p className="text-[10px] text-indigo-500">Loan</p>
                    </div>
                    <div className="bg-cyan-50 rounded p-2">
                      <p className="font-bold text-cyan-700">{cp.cashBookings ?? 0}</p>
                      <p className="text-[10px] text-cyan-500">Cash</p>
                    </div>
                  </div>
                </div>
              ))}
            {tabData.length === 0 && <div className="text-center py-8 text-sm text-slate-400">No data available for the selected filters</div>}
          </div>
        </>
      ))}

      {/* Backend-driven React Pagination Controls */}
      {activeTab !== 'operations' && totalPages > 1 && (
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalCount={total}
          perPage={PER_PAGE}
          itemName={
            activeTab === 'projects'
              ? 'projects'
              : activeTab === 'staff'
              ? 'staff members'
              : activeTab === 'attendance'
              ? 'attendance records'
              : activeTab === 'channel-partner-performance'
              ? 'partners'
              : activeTab === 'leads-trend'
              ? 'trend entries'
              : activeTab === 'lead-contribution'
              ? 'sources'
              : 'records'
          }
        />
      )}
    </div>
  );
}
