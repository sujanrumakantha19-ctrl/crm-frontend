import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useExportContext } from '@/context/ExportContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ChevronRight, ChevronLeft, Search, X, Power, Check, Info, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { attendanceService, projectService } from '@/services';
import { Modal } from '@/components/shared/Modal';
import { toast } from 'sonner';
import type { AttendanceStatus } from '@/types';

const ACTIVITY_OPTIONS = ['On Duty', 'Projects', 'Bank', 'Outside Work', 'Office'];

interface DisplayRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  duration: string;
  status: AttendanceStatus;
  activityType?: string;
  projectId?: string;
  projectName?: string;
  createdAt?: string;
  sessions?: any[];
  isOverridden?: boolean;
  overrideReason?: string;
}

export default function StaffAttendance() {
  const {
    userId,
    user,
    checkedIn: authCheckedIn,
    checkInTime: authCheckInTime,
    checkInTimestamp: authCheckInTs,
    checkIn: authCheckIn,
    checkOut: authCheckOut,
  } = useAuth();

  // --- Dropdown state ---
  const [activityType, setActivityType] = useState('');
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);

  // --- Active session state ---
  const [checkedIn, setCheckedIn] = useState<boolean>(() => authCheckedIn || localStorage.getItem('crm_checkedin') === 'true');
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [activeCheckInTime, setActiveCheckInTime] = useState<string | null>(() => authCheckInTime || localStorage.getItem('crm_checkintime'));
  const [activeCheckInTs, setActiveCheckInTs] = useState<number | null>(() => authCheckInTs || (localStorage.getItem('crm_checkints') ? parseInt(localStorage.getItem('crm_checkints')!, 10) : null));
  const [activeActivityType, setActiveActivityType] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

  // --- Backend-driven Records & Pagination State ---
  const [monthlyRecords, setMonthlyRecords] = useState<DisplayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // Exactly 12 rows per page
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // --- Info Modal state ---
  const [showInfoModal, setShowInfoModal] = useState(false);
  const { setExportInfo } = useExportContext();

  // --- Backend & Frontend Filters ---
  const [monthFilter, setMonthFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Synchronize topbar export configuration with current filters
  useEffect(() => {
    const params: Record<string, string> = {};
    if (monthFilter) params.month = monthFilter;
    if (dateFilter) params.date = dateFilter;
    if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
    setExportInfo({
      endpoint: '/export/attendance',
      filename: `attendance${monthFilter ? `-${monthFilter}` : dateFilter ? `-${dateFilter}` : ''}`,
      params,
    });
  }, [monthFilter, dateFilter, statusFilter, setExportInfo]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const todayDateStr = today.toISOString().split('T')[0];

  // --- Close dropdowns on outside click ---
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (activityRef.current && !activityRef.current.contains(e.target as Node))
        setShowActivityDropdown(false);
      if (projectRef.current && !projectRef.current.contains(e.target as Node))
        setShowProjectDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // --- Fetch projects once ---
  useEffect(() => {
    projectService.getAll({ limit: 100 })
      .then(res => setProjects(res.data || []))
      .catch(() => {});
  }, []);

  // --- Fetch attendance (Backend-driven pagination & filtering) ---
  const fetchAttendance = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params: Record<string, any> = {
        staffId: userId,
        page: currentPage,
        limit: itemsPerPage,
      };
      if (monthFilter) params.month = monthFilter;
      if (dateFilter) params.date = dateFilter;
      if (statusFilter && statusFilter !== 'All') params.status = statusFilter;

      const res = await attendanceService.getDaily(params);
      const records: DisplayRecord[] = (res.data || []).map((r: any) => ({
        id: r.id || r._id || `daily-${r.date}`,
        date: r.date,
        checkIn: r.firstCheckIn || r.checkIn || '—',
        checkOut: r.lastCheckOut || r.checkOut || '—',
        duration: r.formattedDuration || r.duration || '—',
        status: (r.status as AttendanceStatus) || 'Present',
        activityType: r.currentActivity || r.activityType || 'Office',
        projectId: r.projectId,
        projectName: r.currentLocation || r.projectName || '—',
        createdAt: r.createdAt || r.date,
        sessions: r.sessions || [],
        isOverridden: r.isOverridden,
        overrideReason: r.overrideReason || r.overrideNotes,
      }));

      setMonthlyRecords(records);
      const total = (res as any).total ?? ((res as any).pagination?.total || records.length);
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / itemsPerPage)));

      // Detect genuine active check-in session from dedicated backend endpoint
      try {
        const activeRes = await attendanceService.getActive();
        const activeRecord = (activeRes as any)?.data !== undefined ? (activeRes as any).data : activeRes;

        if (activeRecord && (activeRecord.id || activeRecord._id) && activeRecord.isActive && activeRecord.checkIn && activeRecord.checkIn !== '—' && activeRecord.checkIn !== '-') {
          const recId = activeRecord.id || activeRecord._id;
          setCheckedIn(true);
          setActiveRecordId(recId);
          const cInTime = activeRecord.checkIn;
          const ts = activeRecord.createdAt ? new Date(activeRecord.createdAt).getTime() : Date.now();
          setActiveCheckInTime(cInTime);
          setActiveCheckInTs(ts);
          setActiveActivityType(activeRecord.activityType || 'On Duty');
          const pId = typeof activeRecord.projectId === 'object' && activeRecord.projectId !== null ? (activeRecord.projectId as any)._id || (activeRecord.projectId as any).id : activeRecord.projectId || '';
          const pName = typeof activeRecord.projectId === 'object' && activeRecord.projectId !== null ? (activeRecord.projectId as any).name : activeRecord.projectName || '';
          setActiveProjectId(pId);
          setActiveProjectName(pName);
          setActivityType(activeRecord.activityType || 'On Duty');
          setSelectedProjectId(pId);
          setSelectedProjectName(pName);
          authCheckIn(cInTime || new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), ts);
        } else {
          setCheckedIn(false);
          setActiveRecordId(null);
          authCheckOut();
        }
      } catch {
        setCheckedIn(false);
        setActiveRecordId(null);
        authCheckOut();
      }
    } catch {
      // silent catch
    } finally {
      setLoading(false);
    }
  }, [userId, todayDateStr, currentPage, itemsPerPage, monthFilter, dateFilter, statusFilter, authCheckIn, authCheckOut]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // --- Helpers: update record in local state ---
  const updateRecordInList = (id: string, updates: Partial<DisplayRecord>) => {
    setMonthlyRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const addRecordToList = (record: DisplayRecord) => {
    setMonthlyRecords(prev => [record, ...prev]);
  };

  // --- Main toggle handler ---
  const handleToggle = async () => {
    const now = Date.now();
    const nowDate = new Date();
    const timeStr = nowDate.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
    // Use the local calendar date so the record is attributed to the user's business day,
    // not the UTC date (avoids near-midnight misattribution).
    const todayDate = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;

    if (!checkedIn) {
      /* ---------- CHECK IN ---------- */
      if (!activityType) {
        toast.error('Please select an activity type');
        return;
      }
      if (activityType === 'Projects' && !selectedProjectId) {
        toast.error('Please select a project');
        return;
      }

      /* --- Each check-in creates a brand new attendance record.
             The old 10-minute "session resume" merge is removed (issue 29). --- */
      try {
        const res = await attendanceService.create({
          staffId: userId!,
          staffName: user!.name,
          date: todayDate,
          checkIn: timeStr,
          status: 'Present',
          role: user!.designation,
          activityType,
          projectId: selectedProjectId || undefined,
          projectName: selectedProjectName || undefined,
        });

        const record = (res as any).data || res;
        const id = record.id || record._id;

        setCheckedIn(true);
        setActiveRecordId(id);
        setActiveCheckInTime(timeStr);
        setActiveCheckInTs(now);
        setActiveActivityType(activityType);
        setActiveProjectId(selectedProjectId);
        setActiveProjectName(selectedProjectName);

        authCheckIn(timeStr, now);

        addRecordToList({
          id,
          date: todayDate,
          checkIn: timeStr,
          checkOut: '—',
          duration: '—',
          status: 'Present',
          activityType,
          projectId: selectedProjectId || undefined,
          projectName: selectedProjectName || undefined,
          createdAt: nowDate.toISOString(),
        });

        toast.success('Checked in successfully');
      } catch {
        toast.error('Failed to record check-in');
      }
    } else {
      /* ---------- CHECKED IN: ALWAYS CHECK OUT ---------- */
      if (!activeRecordId) return;

      const checkInTs = activeCheckInTs || now;
      const diffMs = now - checkInTs;
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

      try {
        await attendanceService.update(activeRecordId, {
          checkOut: timeStr,
          duration,
          activityType,
          projectId: selectedProjectId || undefined,
          projectName: selectedProjectName || undefined,
        });

        updateRecordInList(activeRecordId, {
          checkOut: timeStr,
          duration,
          activityType,
          projectId: selectedProjectId || undefined,
          projectName: selectedProjectName || undefined,
        });

        setCheckedIn(false);
        setActiveRecordId(null);
        setActiveCheckInTime(null);
        setActiveCheckInTs(null);
        setActiveActivityType(null);
        setActiveProjectId(null);
        setActiveProjectName(null);

        authCheckOut();

        toast.success('Checked out successfully');
      } catch {
        toast.error('Failed to record check-out');
      }
    }
  };

  // --- Determine contextual label for toggle ---
  const getToggleLabel = () => {
    if (!checkedIn) return 'TAP TO CHECK IN';
    return 'TAP TO CHECK OUT';
  };

  // --- Filtered projects for search ---
  const filteredProjects = projects.filter((p: any) =>
    p.name?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // --- Page numbers for pagination ---
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* ── Activity / Check-in Card ── */}
      <div className="max-w-md mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center flex flex-col items-center gap-4 relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 text-center pl-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Today</p>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{dateStr}</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowInfoModal(true)}
            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors shrink-0"
            title="Attendance Rules & Help"
          >
            <Info size={20} />
          </button>
        </div>

        {/* Activity Type Dropdown */}
        <div ref={activityRef} className="relative w-full">
          <label className="block text-xs font-semibold text-slate-400 mb-1 text-left">
            Activity Type
          </label>
          <button
            type="button"
            onClick={() => {
              if (checkedIn) {
                toast.warning('Checkout first to change activity type');
                return;
              }
              setShowActivityDropdown(v => !v);
              setShowProjectDropdown(false);
            }}
            className={`w-full px-3 py-2.5 text-sm text-left border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
              checkedIn ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : (activityType ? 'bg-white border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-400')
            }`}
          >
            {activityType || 'Select activity type'}
          </button>

          {showActivityDropdown && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {ACTIVITY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setActivityType(opt);
                    setShowActivityDropdown(false);
                    if (opt !== 'Projects') {
                      setSelectedProjectId('');
                      setSelectedProjectName('');
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-amber-50 transition-colors flex items-center justify-between ${
                    activityType === opt ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-slate-700'
                  }`}
                >
                  {opt}
                  {activityType === opt && <Check size={14} className="text-amber-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Project Search Dropdown (only when Projects selected) */}
        {activityType === 'Projects' && (
          <div ref={projectRef} className="relative w-full">
            <label className="block text-xs font-semibold text-slate-400 mb-1 text-left">
              Project
            </label>
            <button
              type="button"
              onClick={() => {
                if (checkedIn) {
                  toast.warning('Checkout first to change activity type');
                  return;
                }
                setShowProjectDropdown(v => !v);
              }}
              className={`w-full px-3 py-2.5 text-sm text-left border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                checkedIn ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed' : (selectedProjectName ? 'bg-white border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-400')
              }`}
            >
              {selectedProjectName || 'Search project...'}
            </button>

            {showProjectDropdown && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full text-sm bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400"
                  />
                  {projectSearch && (
                    <button onClick={() => setProjectSearch('')}>
                      <X size={14} className="text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-slate-400">No projects found</p>
                  ) : (
                    filteredProjects.map((p: any) => (
                      <button
                        key={p.id || p._id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(p.id || p._id);
                          setSelectedProjectName(p.name);
                          setShowProjectDropdown(false);
                          setProjectSearch('');
                        }}
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-amber-50 transition-colors flex items-center justify-between ${
                          selectedProjectId === (p.id || p._id)
                            ? 'bg-amber-50 text-amber-700 font-semibold'
                            : 'text-slate-700'
                        }`}
                      >
                        {p.name}
                        {selectedProjectId === (p.id || p._id) && (
                          <Check size={14} className="text-amber-500" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Session Info */}
        {checkedIn && (
          <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-800 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="font-semibold">{activeActivityType}</span>
            <span className="text-emerald-600">|</span>
            <span>Checked in at <strong>{activeCheckInTime}</strong></span>
            {activeProjectName && (
              <>
                <span className="text-emerald-600">|</span>
                <span>{activeProjectName}</span>
              </>
            )}
          </div>
        )}

        {/* Slide Toggle */}
        <div
          onClick={handleToggle}
          className={`w-64 h-12 rounded-full relative flex items-center justify-between px-2 cursor-pointer border select-none transition-all duration-300 shadow-inner overflow-hidden ${
            checkedIn
              ? 'bg-emerald-500 border-emerald-600 shadow-emerald-600/10'
              : 'bg-slate-100 border-slate-200 hover:bg-slate-200/50'
          }`}
        >
          <span
            className={`w-full text-center text-xs font-extrabold tracking-wider transition-colors duration-300 ${
              checkedIn ? 'text-white' : 'text-slate-500'
            }`}
          >
            {getToggleLabel()}
          </span>

          <div
            className={`absolute top-1 left-1 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all duration-300 ease-in-out ${
              checkedIn
                ? 'translate-x-[208px] bg-white text-emerald-600'
                : 'translate-x-0 bg-white text-slate-400'
            }`}
          >
            {checkedIn ? (
              <Power size={16} className="animate-pulse" />
            ) : (
              <ChevronRight size={18} />
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {checkedIn
            ? `Your attendance is currently active. Checked in at ${activeCheckInTime}.`
            : 'Select an activity type and toggle to register check-in.'}
        </p>
      </div>

      {/* ── Attendance Records Table & Backend Filters ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">Attendance Records</h3>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-brand-green outline-none cursor-pointer font-medium"
              >
                <option value="All">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Half Day">Half Day (4 to 8 hrs)</option>
                <option value="Below 4 Hours">Below 4 Hours</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Month:</span>
              <input
                type="month"
                value={monthFilter}
                disabled={!!dateFilter}
                onChange={e => { setMonthFilter(e.target.value); setDateFilter(''); setCurrentPage(1); }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-brand-green outline-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Date:</span>
              <input
                type="date"
                value={dateFilter}
                disabled={!!monthFilter}
                onChange={e => { setDateFilter(e.target.value); setMonthFilter(''); setCurrentPage(1); }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-brand-green outline-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            {(monthFilter || dateFilter || statusFilter !== 'All') && (
              <button
                onClick={() => { setMonthFilter(''); setDateFilter(''); setStatusFilter('All'); setCurrentPage(1); }}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
              >
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : monthlyRecords.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12 font-medium">No attendance records found.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                    {['Date', 'Check-in', 'Check-out', 'Duration', 'Activity', 'Project', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyRecords.map((row, i) => (
                    <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-900 font-semibold whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.checkIn}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.checkOut}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{row.duration}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {row.status === 'Absent' || row.status === 'Weekly Off' || row.status === 'Scheduled' || !row.activityType || row.activityType === '-' ? '—' : row.activityType}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {row.projectName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={row.status} />
                          {row.isOverridden && (
                            <span
                              title={row.overrideReason ? `Admin override: ${row.overrideReason}` : 'Admin override'}
                              className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded cursor-help"
                            >
                              Override
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Server-driven React Pagination (12 rows per page) ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 font-medium">
                  Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold text-slate-800">{totalCount}</span> records
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageNumbers.map((p, idx) => p === '...' ? (
                    <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-slate-400">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`min-w-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentPage === p ? 'bg-amber-500 text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Attendance Information Modal ── */}
      <Modal
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Attendance & Session Rules"
        size="md"
      >
        <div className="space-y-4 text-sm text-slate-600">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
            <RefreshCw size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Each check-in creates a new session</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Every time you tap <strong>Check In</strong>, a brand new attendance entry is created for today. No previous record is ever overwritten or merged.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">1</div>
              <div>
                <p className="font-semibold text-slate-800">Check-In Requirements</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your <strong>Activity Type</strong> (On Duty, Projects, Bank, Outside Work, Office). If you choose <em>Projects</em>, select the specific project before tapping to Check In.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold">2</div>
              <div>
                <p className="font-semibold text-slate-800">New Session Threshold</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tapping <strong>Check In</strong> always starts a new attendance entry for today, regardless of when your previous entry was created.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold">3</div>
              <div>
                <p className="font-semibold text-slate-800">Check-Out & Duration</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tapping <strong>TAP TO CHECK OUT</strong> stops your active session timer, records your checkout timestamp, and calculates your total work duration.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 font-bold">4</div>
              <div>
                <p className="font-semibold text-slate-800">Lunch & Permission Breaks</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  If you are going for <strong>Lunch</strong> or stepping out for personal work (even if you have taken permission), you <strong>must Check Out</strong> before leaving and <strong>Check In again</strong> upon returning.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setShowInfoModal(false)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-xs transition-colors shadow-sm"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
