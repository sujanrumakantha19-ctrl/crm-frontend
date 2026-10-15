import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Calendar, User, AlertCircle } from 'lucide-react';
import { useCalendar } from '@/hooks/useCalendar';
import { Avatar } from '@/components/shared/Avatar';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { NameTag } from '@/components/shared/NameTag';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SearchDropdown } from '@/components/shared/SearchDropdown';
import { userService, attendanceService } from '@/services';
import type { User as UserType } from '@/types';
import { useExportContext } from '@/context/ExportContext';
import { useAuth } from '@/context/AuthContext';
import { TableSkeletonRows } from '@/components/shared/SkeletonLoader';
import { toast } from 'sonner';
import { parseDurationHours, matchesStatusFilter } from '@/utils/attendanceFilters';

export default function AdminAttendance() {
  const [staffUsers, setStaffUsers] = useState<UserType[]>([]);
  const [apiRecords, setApiRecords] = useState<any[]>([]);
  const [empApiRecords, setEmpApiRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [activeTab, setActiveTab] = useState<'date' | 'employee'>('date');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [dailyModalDate, setDailyModalDate] = useState<string | null>(null);
  const { exportInfo, setExportInfo, triggerDownload } = useExportContext();

  // Fetch staff users list once on mount
  useEffect(() => {
    userService.getAll({ role: 'staff', limit: 200 })
      .then(r => {
        const staff = r.data || [];
        setStaffUsers(staff);
        if (staff.length > 0) {
          setSelectedStaffId(prev => prev || String(staff[0].id || (staff[0] as any)._id));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch employee-specific records across all months when selectedStaffId changes
  useEffect(() => {
    if (!selectedStaffId) return;
    let isMounted = true;
    attendanceService.getByStaff(selectedStaffId, { limit: 1000 })
      .then(r => {
        if (isMounted) setEmpApiRecords(r.data || []);
      })
      .catch(() => {
        if (isMounted) setEmpApiRecords([]);
      });
    return () => { isMounted = false; };
  }, [selectedStaffId]);

  // Fetch month-specific attendance records from backend whenever month or year changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    attendanceService.getAll({ month: monthStr })
      .then(r => {
        if (isMounted) setApiRecords(r.data || []);
      })
      .catch(() => {
        if (isMounted) setApiRecords([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [month, year]);

  // Daily Details Modal Filter & Pagination states
  const [modalStaffFilter, setModalStaffFilter] = useState('all');
  const [modalPage, setModalPage] = useState(1);
  const modalPerPage = 8;

  // Employee-wise tab pagination state
  const [empPage, setEmpPage] = useState(1);
  const empPerPage = 12;

  // Employee-wise filter states
  const [empMonthFilter, setEmpMonthFilter] = useState<'all' | number>('all');
  const [empYearFilter, setEmpYearFilter] = useState<number>(today.getFullYear());
  const [empStatusFilter, setEmpStatusFilter] = useState<string>('All');

  const calendarDays = useCalendar(year, month);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Combine Real Backend Database Records with Default Fallback for Unlogged Days
  const allRecords = useMemo(() => {
    const records: any[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const realToday = new Date();
    realToday.setHours(23, 59, 59, 999);

    // Map existing backend API records by staffId and date
    const apiMap = new Map<string, any[]>();
    apiRecords.forEach(r => {
      const sId = String(r.staffId || r.userId || (r.user?.id || r.user));
      const key = `${sId}-${r.date}`;
      if (!apiMap.has(key)) apiMap.set(key, []);
      apiMap.get(key)!.push({
        ...r,
        id: r.id || r._id,
        staffId: sId,
        staffName: r.staffName || r.user?.name || 'Staff User',
        role: r.role || r.designation || 'Sales Executive',
      });
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      const isFuture = dateObj > realToday;

      staffUsers.forEach(staff => {
        const sId = String(staff.id || (staff as any)._id);
        const key = `${sId}-${dateStr}`;
        const joiningDateStr = (staff as any).joiningDate
          ? new Date((staff as any).joiningDate).toISOString().split('T')[0]
          : null;

        // 1. If real MongoDB attendance records exist for this staff + date, use ALL real DB records!
        if (apiMap.has(key) && apiMap.get(key)!.length > 0) {
          apiMap.get(key)!.forEach(realRec => {
            records.push({
              ...realRec,
              staffName: staff.name || realRec.staffName,
              role: staff.designation || realRec.role || 'Sales Executive',
            });
          });
          return;
        }

        // 2. If date is before staff joined the company -> Not Joined
        if (joiningDateStr && dateStr < joiningDateStr) {
          records.push({
            id: `notjoined-${sId}-${dateStr}`,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
            date: dateStr,
            status: 'Not Joined',
            location: '—',
            project: '—',
            checkIn: '—',
            checkOut: '—',
            duration: '—',
            activityType: '—',
          });
          return;
        }

        // 3. Otherwise: Sunday is Weekly Off
        if (dayOfWeek === 0) {
          records.push({
            id: `off-${sId}-${dateStr}`,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
            date: dateStr,
            status: 'Weekly Off',
            location: '-',
            project: '-',
            checkIn: '-',
            checkOut: '-',
            duration: '-',
            activityType: '-',
          });
          return;
        }

        // 4. Future dates are Scheduled
        if (isFuture) {
          records.push({
            id: `future-${sId}-${dateStr}`,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
            date: dateStr,
            status: 'Scheduled',
            location: '-',
            project: '-',
            checkIn: '-',
            checkOut: '-',
            duration: '-',
            activityType: '-',
          });
          return;
        }

        // 5. Past / Current working dates with NO DB record -> ABSENT
        records.push({
          id: `absent-${sId}-${dateStr}`,
          staffId: sId,
          staffName: staff.name,
          role: staff.designation || 'Sales Executive',
          date: dateStr,
          status: 'Absent',
          location: '-',
          project: '-',
          checkIn: '-',
          checkOut: '-',
          duration: '-',
          activityType: '-',
        });
      });
    }

    return records;
  }, [year, month, staffUsers, apiRecords]);

  // Employee-wise attendance records (100% backend driven with Absent / Off / Scheduled defaults)
  const generatedRecordsForEmployee = useMemo(() => {
    if (activeTab !== 'employee' || !selectedStaffId) return [];

    const staff = staffUsers.find(s => String(s.id || (s as any)._id) === String(selectedStaffId));
    if (!staff) return [];

    const sId = String(staff.id || (staff as any)._id);
    const records: any[] = [];
    const monthsToGenerate = empMonthFilter === 'all' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [empMonthFilter];
    const realToday = new Date();
    realToday.setHours(23, 59, 59, 999);

    // Map real API records for this employee (combining calendar month records and employee-specific records)
    const apiMap = new Map<string, any[]>();
    const combinedRecords = [...apiRecords, ...empApiRecords];
    combinedRecords.forEach(r => {
      const recStaffId = String(r.staffId || r.userId || (r.user?.id || r.user));
      if (recStaffId === sId) {
        if (!apiMap.has(r.date)) apiMap.set(r.date, []);
        const existing = apiMap.get(r.date)!;
        const recId = String(r.id || r._id);
        if (!existing.some(e => String(e.id || e._id) === recId)) {
          existing.push({
            ...r,
            id: recId,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
          });
        }
      }
    });

    const joiningDateStr = (staff as any).joiningDate
      ? new Date((staff as any).joiningDate).toISOString().split('T')[0]
      : null;

    monthsToGenerate.forEach(m => {
      const daysInMonth = new Date(empYearFilter, m, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${empYearFilter}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(empYearFilter, m - 1, day);
        const dayOfWeek = dateObj.getDay();
        const isFuture = dateObj > realToday;

        if (apiMap.has(dateStr) && apiMap.get(dateStr)!.length > 0) {
          apiMap.get(dateStr)!.forEach(realRec => records.push(realRec));
          continue;
        }

        // If date is before staff joined the company -> Not Joined
        if (joiningDateStr && dateStr < joiningDateStr) {
          records.push({
            id: `notjoined-${sId}-${dateStr}`,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
            date: dateStr,
            status: 'Not Joined',
            location: '—',
            project: '—',
            checkIn: '—',
            checkOut: '—',
            duration: '—',
            activityType: '—',
          });
          continue;
        }

        if (dayOfWeek === 0) {
          records.push({
            id: `off-${sId}-${dateStr}`,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
            date: dateStr,
            status: 'Weekly Off',
            location: '-',
            project: '-',
            checkIn: '-',
            checkOut: '-',
            duration: '-',
            activityType: '-',
          });
          continue;
        }

        if (isFuture) {
          records.push({
            id: `future-${sId}-${dateStr}`,
            staffId: sId,
            staffName: staff.name,
            role: staff.designation || 'Sales Executive',
            date: dateStr,
            status: 'Scheduled',
            location: '-',
            project: '-',
            checkIn: '-',
            checkOut: '-',
            duration: '-',
            activityType: '-',
          });
          continue;
        }

        records.push({
          id: `absent-${sId}-${dateStr}`,
          staffId: sId,
          staffName: staff.name,
          role: staff.designation || 'Sales Executive',
          date: dateStr,
          status: 'Absent',
          location: '-',
          project: '-',
          checkIn: '-',
          checkOut: '-',
          duration: '-',
          activityType: '-',
        });
      }
    });

    return records;
  }, [activeTab, selectedStaffId, empMonthFilter, empYearFilter, staffUsers, apiRecords, empApiRecords]);

  useEffect(() => {
    setEmpPage(1);
  }, [selectedStaffId, empMonthFilter, empYearFilter, empStatusFilter]);

  const filteredEmployeeRecords = useMemo(() => {
    return generatedRecordsForEmployee
      .filter(r => r.status !== 'Scheduled')
      .filter(r => matchesStatusFilter(r.status, r.duration, empStatusFilter));
  }, [generatedRecordsForEmployee, empStatusFilter]);

  const empTotalPages = Math.ceil(filteredEmployeeRecords.length / empPerPage) || 1;
  const paginatedEmployeeRecords = useMemo(() => {
    const start = (empPage - 1) * empPerPage;
    return filteredEmployeeRecords.slice(start, start + empPerPage);
  }, [filteredEmployeeRecords, empPage, empPerPage]);

  const modalRecords = useMemo(() => {
    if (!dailyModalDate) return [];
    const filtered = allRecords.filter(r => r.date === dailyModalDate);
    return filtered.length > 0 ? filtered : apiRecords.filter(r => r.date === dailyModalDate);
  }, [allRecords, apiRecords, dailyModalDate]);

  useEffect(() => {
    setModalStaffFilter('all');
    setModalPage(1);
  }, [dailyModalDate]);

  const filteredModalRecords = useMemo(() => {
    if (!modalRecords) return [];
    return modalRecords.filter(r => {
      if (modalStaffFilter !== 'all' && r.staffId !== modalStaffFilter) return false;
      return true;
    });
  }, [modalRecords, modalStaffFilter]);

  const modalTotalPages = Math.ceil(filteredModalRecords.length / modalPerPage) || 1;
  const paginatedModalRecords = useMemo(() => {
    const start = (modalPage - 1) * modalPerPage;
    return filteredModalRecords.slice(start, start + modalPerPage);
  }, [filteredModalRecords, modalPage, modalPerPage]);

  // Calculate stats for the selected employee based on custom month/year generator
  const employeeStats = useMemo(() => {
    if (!selectedStaffId) return null;
    
    // Filter actual recorded days (exclude Scheduled, Weekly Off, and Not Joined)
    const validRecs = generatedRecordsForEmployee.filter(r => r.status !== 'Scheduled' && r.status !== 'Weekly Off' && r.status !== 'Not Joined');
    const totalWorking = validRecs.length;
    const present = validRecs.filter(r => r.status === 'Present').length;
    const absent = validRecs.filter(r => r.status === 'Absent').length;
    const late = validRecs.filter(r => r.isLate).length;

    let totalMinutes = 0;
    validRecs.forEach(r => {
      if (r.duration) {
        const match = r.duration.match(/(\d+)h\s*(\d*)m?/);
        if (match) {
          const hrs = parseInt(match[1]);
          const mins = match[2] ? parseInt(match[2]) : 0;
          totalMinutes += (hrs * 60) + mins;
        }
      }
    });

    const totalHrs = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    return {
      totalWorking,
      present,
      absent,
      late,
      totalHoursStr: `${totalHrs}h ${totalMins}m`,
    };
  }, [generatedRecordsForEmployee, selectedStaffId]);

  const [modalLoading, setModalLoading] = useState(false);

  const handleDayClick = (dayKey: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    setDailyModalDate(dayKey);
    setModalLoading(true);
    attendanceService.getByDate(dayKey)
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setApiRecords(prev => {
            const existingIds = new Set(prev.map(r => r._id || r.id));
            const newRecords = res.data.filter((r: any) => !existingIds.has(r._id || r.id));
            return [...prev, ...newRecords];
          });
        }
      })
      .catch(() => {})
      .finally(() => setModalLoading(false));
  };

  // Allow admins to persist Absent / Half Day / Present for a staff member on a date (issue 28).
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [activeOverrideConfirm, setActiveOverrideConfirm] = useState<{ rec: any; newStatus: string } | null>(null);

  const handleStatusChange = async (rec: any, newStatus: string, confirmed = false) => {
    if (!newStatus || newStatus === rec.status) return;

    const isCheckedIn = (rec.checkIn && rec.checkIn !== '-') && (!rec.checkOut || rec.checkOut === '-');
    if (newStatus === 'Absent' && isCheckedIn && !confirmed) {
      setActiveOverrideConfirm({ rec, newStatus });
      return;
    }

    setSavingStatusId(rec.id);
    try {
      if (isCheckedIn && confirmed) {
        // Daily override only — do not corrupt running punch session
        await attendanceService.setOverride({
          staffId: rec.staffId,
          date: rec.date,
          status: newStatus,
          confirmActiveOverride: true,
          notes: `Admin manually overrode active checked-in staff to ${newStatus}`,
        });
      } else {
        const isSynthetic = String(rec.id).startsWith('absent-') || String(rec.id).startsWith('off-') || String(rec.id).startsWith('future-');
        if (isSynthetic) {
          // Fabricated absent/off/future row -> create a real persisted record.
          await attendanceService.create({
            staffId: rec.staffId,
            staffName: rec.staffName,
            date: rec.date,
            status: newStatus,
            checkIn: '-',
            checkOut: '-',
            duration: '-',
            activityType: 'Office',
            role: rec.role || 'Sales Executive',
          });
        } else {
          await attendanceService.update(rec.id, { status: newStatus });
        }

        // Also persist daily override audit record so daily engine and exports respect it
        await attendanceService.setOverride({
          staffId: rec.staffId,
          date: rec.date,
          status: newStatus,
          notes: `Admin manually set status to ${newStatus}`,
        }).catch(() => {});
      }

      toast.success(`${rec.staffName} marked as ${newStatus} for ${formatDateStr(rec.date)}`);

      // Refresh backend records for this date so the synthetic fallback is replaced.
      const res = await attendanceService.getByDate(rec.date);
      if (res.data && Array.isArray(res.data)) {
        setApiRecords(prev => {
          const others = prev.filter(r => (r.date !== rec.date) || (r.staffId !== rec.staffId));
          return [...others, ...res.data.filter((r: any) => String(r.staffId || r.userId || r.user?.id) === rec.staffId)];
        });
      }
    } catch {
      toast.error(`Failed to update ${rec.staffName}'s status`);
    } finally {
      setSavingStatusId(null);
    }
  };

  function formatDateStr(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function getAvatarBg(name: string): string {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  if (loading) return <TableSkeletonRows rows={6} cols={5} />;

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab('date')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'date' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar size={14} /> Date-wise (Calendar)
          </button>
          <button
            onClick={() => setActiveTab('employee')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'employee' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={14} /> Employee-wise Log
          </button>
        </div>

        {/* Calendar Nav & Export (Visible when activeTab is date) */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'date' && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <button
                onClick={prevMonth}
                title="Previous Month"
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                aria-label="Select Month"
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer py-1 px-1.5 hover:bg-slate-50 rounded"
              >
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
              <select
                aria-label="Select Year"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer py-1 px-1.5 hover:bg-slate-50 rounded"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
                <option value={2028}>2028</option>
              </select>
              <button
                onClick={nextMonth}
                title="Next Month"
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                aria-label="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          {role === 'admin' && activeTab === 'date' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setExportInfo({
                    endpoint: '/export/attendance',
                    filename: `attendance-${year}-${String(month).padStart(2, '0')}`,
                    params: { tab: 'main', month: `${year}-${String(month).padStart(2, '0')}` },
                  });
                  setTimeout(() => triggerDownload(), 50);
                }}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                title={`Export full attendance for ${monthName}`}
              >
                <Download size={13} /> Export Month
              </button>
              <button
                onClick={() => {
                  setExportInfo({
                    endpoint: '/export/attendance',
                    filename: `attendance-${year}`,
                    params: { tab: 'main', year: String(year) },
                  });
                  setTimeout(() => triggerDownload(), 50);
                }}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                title={`Export full attendance for year ${year}`}
              >
                <Download size={13} /> Export Year
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Date-wise Tab */}
      {activeTab === 'date' && (
        <div className="space-y-6">
          {/* Calendar Grid */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
              {dayNames.map(d => (
                <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>
            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarDays.map((day) => {
                const dayRecs = allRecords.filter(r => r.date === day.key);
                const activeRecs = dayRecs.filter(r => r.status === 'Present' || r.status === 'Half Day');
                const presentCount = activeRecs.length;
                const absentCount = dayRecs.filter(r => r.status === 'Absent').length;
                const isAllOff = dayRecs.length > 0 && dayRecs.every(r => r.status === 'Weekly Off' || r.status === 'Not Joined');
                const isAllFuture = dayRecs.length > 0 && dayRecs.every(r => r.status === 'Scheduled' || r.status === 'Weekly Off' || r.status === 'Not Joined');

                return (
                  <button
                    key={day.key}
                    onClick={() => handleDayClick(day.key, day.isCurrentMonth)}
                    className={`min-h-[110px] p-3 text-left transition-colors flex flex-col justify-between items-start outline-none ${
                      day.isCurrentMonth 
                        ? 'bg-white hover:bg-slate-50/70 cursor-pointer' 
                        : 'bg-slate-50/50 cursor-not-allowed text-slate-300'
                    } ${day.isToday ? 'bg-blue-50/30 ring-2 ring-inset ring-blue-600 z-10' : ''}`}
                  >
                    <span className={`text-xs font-bold ${
                      day.isToday 
                        ? 'text-brand-blue bg-blue-100 px-1.5 py-0.5 rounded-full' 
                        : day.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                    }`}>
                      {day.dayOfMonth}
                    </span>

                    {day.isCurrentMonth && (
                      <div className="w-full mt-2 flex flex-col gap-1.5">
                        {presentCount > 0 ? (
                          <>
                            {/* Avatars */}
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {activeRecs.slice(0, 3).map(rec => {
                                const initials = rec.staffName.split(' ').map((w: string) => w[0]).join('').slice(0, 2);
                                return (
                                  <div 
                                    key={rec.id} 
                                    className="ring-2 ring-white rounded-full overflow-hidden"
                                    title={rec.staffName}
                                  >
                                    <Avatar
                                      initials={initials}
                                      size="sm"
                                      bg={getAvatarBg(rec.staffName)}
                                    />
                                  </div>
                                );
                              })}
                              {activeRecs.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] text-slate-500 font-bold border-2 border-white shrink-0">
                                  +{activeRecs.length - 3}
                                </div>
                              )}
                            </div>
                            
                            {/* Present & Absent Badges */}
                            <div className="flex items-center justify-between w-full text-[9px] font-bold mt-1 text-slate-500">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-extrabold border border-emerald-200/80">
                                  {presentCount} Present
                                </span>
                                {absentCount > 0 && (
                                  <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-extrabold border border-rose-200/80">
                                    {absentCount} Absent
                                  </span>
                                )}
                              </div>
                              {dayRecs.some(r => r.isLate) && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Late entries present" />
                              )}
                            </div>
                          </>
                        ) : isAllOff ? (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded self-start">
                            Weekly Off
                          </span>
                        ) : isAllFuture ? (
                          <span className="text-[10px] font-medium text-slate-400 italic">
                            Scheduled
                          </span>
                        ) : dayRecs.length > 0 ? (
                          <div className="flex items-center justify-between w-full text-[9px] font-bold mt-1 text-slate-500">
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-extrabold border border-rose-200/80">
                              {absentCount} Absent
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Info Tip */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <AlertCircle size={14} className="text-slate-400" />
            <span>Click on any active calendar day to view the full detailed check-in and check-out logs of all employees for that day.</span>
          </div>
        </div>
      )}

      {/* Employee-wise Tab */}
      {activeTab === 'employee' && (
        <div className="space-y-6">
          {/* Search Dropdown Panel with Month/Year filters */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full max-w-sm">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Staff Member</label>
              <SearchDropdown
                options={[{ value: '', label: 'Choose an employee...' }, ...staffUsers.map(staff => ({ value: staff.id || (staff as unknown as {_id:string})._id, label: `${staff.name}${staff.displayId ? ` [${staff.displayId}]` : ''} — ${staff.designation}` }))]}
                value={selectedStaffId}
                onChange={setSelectedStaffId}
                placeholder="Search employee..."
              />
            </div>

            {/* Month Dropdown */}
            <div className="w-full md:w-44">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Month</label>
              <select
                value={empMonthFilter}
                onChange={e => setEmpMonthFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all animate-none"
              >
                <option value="all">All Months</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="w-full md:w-48">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status Filter</label>
              <select
                value={empStatusFilter}
                onChange={e => setEmpStatusFilter(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all cursor-pointer font-medium text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Present">Present (&gt; 8 hrs)</option>
                <option value="Half Day">Half Day (4 to 8 hrs)</option>
                <option value="Below 4 Hours">Below 4 Hours (&lt; 4 hrs)</option>
                <option value="Absent">Absent</option>
                <option value="In Progress">In Progress</option>
                <option value="Needs Review">Needs Review</option>
                <option value="Weekly Off">Weekly Off</option>
                <option value="Not Joined">Not Joined</option>
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="w-full md:w-32">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Year</label>
              <select
                value={empYearFilter}
                onChange={e => setEmpYearFilter(Number(e.target.value))}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none transition-all animate-none"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>

            {/* Export Employee Log Button */}
            {role === 'admin' && selectedStaffId && (
              <button
                onClick={() => {
                  const staffObj = staffUsers.find(s => String(s.id || (s as any)._id) === String(selectedStaffId));
                  const staffNameClean = (staffObj?.name || 'employee').replace(/[^a-zA-Z0-9]/g, '_');
                  const params: Record<string, string> = {
                    tab: 'main',
                    staffId: selectedStaffId,
                    year: String(empYearFilter),
                  };
                  let filename = `attendance-${staffNameClean}-${empYearFilter}`;
                  if (empMonthFilter !== 'all') {
                    const mStr = `${empYearFilter}-${String(empMonthFilter).padStart(2, '0')}`;
                    params.month = mStr;
                    filename = `attendance-${staffNameClean}-${mStr}`;
                  }
                  setExportInfo({
                    endpoint: '/export/attendance',
                    filename,
                    params,
                  });
                  setTimeout(() => triggerDownload(), 50);
                }}
                className="w-full md:w-auto h-10 px-4 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                title="Export this employee's attendance log"
              >
                <Download size={14} /> Export Log
              </button>
            )}
          </div>

          {/* If No Employee Selected */}
          {!selectedStaffId ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm py-16 text-center">
              <User size={40} className="text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700">No Employee Selected</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Select an employee and filter options above to view their date-wise log and metrics.</p>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              {employeeStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Working Days</span>
                    <span className="text-2xl font-bold text-slate-800">{employeeStats.totalWorking}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm border-l-4 border-l-emerald-500">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Days Present</span>
                    <span className="text-2xl font-bold text-emerald-600">{employeeStats.present}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm border-l-4 border-l-rose-500">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Days Absent</span>
                    <span className="text-2xl font-bold text-rose-500">{employeeStats.absent}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm border-l-4 border-l-blue-600">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hours Worked</span>
                    <span className="text-2xl font-bold text-brand-blue">{employeeStats.totalHoursStr}</span>
                  </div>
                </div>
              )}

              {/* Date-wise Detailed Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Attendance Log</h3>
                  {employeeStats && employeeStats.late > 0 && (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertCircle size={10} /> {employeeStats.late} Late check-ins recorded
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-left border-b border-slate-200">
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Type</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Location</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Project</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Check-in (Start)</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Check-out (End)</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hours Worked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedEmployeeRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 text-sm font-semibold text-slate-800">
                            {formatDateStr(rec.date)}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={rec.status} />
                          </td>
                          <td className="px-5 py-3 text-xs">
                            {rec.status === 'Absent' || rec.status === 'Weekly Off' || rec.status === 'Scheduled' || !rec.activityType || rec.activityType === '-' ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {rec.activityType}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">{rec.location || '-'}</td>
                          <td className="px-5 py-3 text-sm text-slate-600">{rec.project || rec.projectName || '-'}</td>
                          <td className="px-5 py-3 text-sm text-slate-600 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{rec.checkIn || '-'}</span>
                              {rec.isLate && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                  Late
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600 font-medium">
                            {rec.checkOut || '-'}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-700 font-bold">
                            {rec.duration || '-'}
                          </td>
                        </tr>
                      ))}
                      {filteredEmployeeRecords.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                            No attendance records match the selected status / month / year filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Employee Tab React Pagination */}
                <PaginationControls
                  currentPage={empPage}
                  totalPages={empTotalPages}
                  onPageChange={setEmpPage}
                  totalCount={filteredEmployeeRecords.length}
                  perPage={empPerPage}
                  itemName="attendance logs"
                  className="border-t border-slate-100 rounded-none bg-slate-50/50"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Big Modal - Daily Details showing stats, employee filter, Export CSV, and pagination */}
      {dailyModalDate && (
        <Modal
          open={!!dailyModalDate}
          onClose={() => setDailyModalDate(null)}
          title={`Attendance Details — ${formatDateStr(dailyModalDate)}`}
          size="2xl"
        >
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            {/* Modal Loading Indicator */}
            {modalLoading && (
              <div className="flex items-center justify-center py-2 px-3 bg-blue-50 border border-blue-100 rounded-lg text-brand-blue gap-2">
                <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-blue-700">Syncing latest database records for {dailyModalDate}...</span>
              </div>
            )}

            {/* Modal Controls Bar: Filter & Export */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Employee:</span>
                <SearchDropdown
                  options={[{ value: 'all', label: 'All Employees' }, ...staffUsers.map(s => ({ value: s.id, label: `${s.name}${s.displayId ? ` [${s.displayId}]` : ''}` }))]}
                  value={modalStaffFilter}
                  onChange={val => {
                    setModalStaffFilter(val);
                    setModalPage(1);
                  }}
                  placeholder="Filter Employee..."
                />
              </div>
              {role === 'admin' && (
                <button
                  onClick={() => { setExportInfo({ endpoint: '/export/attendance', filename: 'attendance-details', params: { tab: 'details', month: `${year}-${String(month).padStart(2, '0')}`, ...(dailyModalDate ? { date: dailyModalDate } : {}) } }); setTimeout(() => triggerDownload(), 50); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all"
                >
                  <Download size={14} /> Export CSV
                </button>
              )}
            </div>

            {/* Modal Stats Row showing Present and Absent */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex flex-col justify-center text-center">
                <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Present Count</span>
                <span className="text-3xl font-extrabold text-emerald-800 mt-1">
                  {new Set(filteredModalRecords.filter(r => r.status === 'Present' || r.status === 'Half Day').map(r => r.staffId || r.staffName)).size}
                </span>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-100 flex flex-col justify-center text-center">
                <span className="text-xs text-rose-600 font-bold uppercase tracking-wider">Absent Count</span>
                <span className="text-3xl font-extrabold text-rose-800 mt-1">
                  {new Set(filteredModalRecords.filter(r => r.status === 'Absent').map(r => r.staffId || r.staffName)).size}
                </span>
              </div>
            </div>

            {/* List Table inside Modal */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Type</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Project</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Check-in</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Check-out</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hours Worked</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredModalRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No records match the selected employee filter.
                      </td>
                    </tr>
                  ) : filteredModalRecords.every(r => r.status === 'Scheduled' || r.status === 'Not Joined') ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400 font-medium bg-slate-50/30">
                        Scheduled / Future Date — No attendance recorded yet.
                      </td>
                    </tr>
                  ) : filteredModalRecords.every(r => r.status === 'Weekly Off' || r.status === 'Not Joined') ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 font-semibold bg-slate-50/50">
                        Weekly Off (Sunday) — No attendance log recorded.
                      </td>
                    </tr>
                  ) : (
                    paginatedModalRecords.map(rec => {
                      const initials = rec.staffName ? rec.staffName.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : 'ST';
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar initials={initials} size="sm" bg={getAvatarBg(rec.staffName)} />
                              <span className="text-sm font-semibold text-slate-800">{rec.staffName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-500">{rec.role || '-'}</td>
                          <td className="px-4 py-3 text-xs">
                            {rec.status === 'Absent' || rec.status === 'Weekly Off' || rec.status === 'Scheduled' || !rec.activityType || rec.activityType === '-' ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {rec.activityType}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{rec.location || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{rec.project || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <span>{rec.checkIn || '-'}</span>
                              {rec.isLate && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                  Late
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{rec.checkOut || '-'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-700">{rec.duration || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={rec.status} />
                              <select
                                value=""
                                disabled={savingStatusId === rec.id}
                                onChange={e => handleStatusChange(rec, e.target.value)}
                                className="text-[10px] font-semibold border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 hover:border-brand-blue outline-none transition-colors cursor-pointer disabled:opacity-50"
                                title="Change status"
                              >
                                <option value="" disabled>Set…</option>
                                <option value="Present">Present</option>
                                <option value="Half Day">Half Day</option>
                                <option value="Absent">Absent</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal React Pagination Controls */}
            {modalTotalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-800">{(modalPage - 1) * modalPerPage + 1}</span> to <span className="font-bold text-slate-800">{Math.min(modalPage * modalPerPage, filteredModalRecords.length)}</span> of <span className="font-bold text-slate-800">{filteredModalRecords.length}</span> employees
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModalPage(p => Math.max(1, p - 1))}
                    disabled={modalPage === 1}
                    className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft size={13} /> Previous
                  </button>
                  {Array.from({ length: modalTotalPages }, (_, i) => i + 1).map(pNum => (
                    <button
                      key={pNum}
                      onClick={() => setModalPage(pNum)}
                      className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                        modalPage === pNum
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setModalPage(p => Math.min(modalTotalPages, p + 1))}
                    disabled={modalPage === modalTotalPages}
                    className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {activeOverrideConfirm && (
        <ConfirmDialog
          open={!!activeOverrideConfirm}
          onClose={() => setActiveOverrideConfirm(null)}
          onConfirm={async () => {
            const { rec, newStatus } = activeOverrideConfirm;
            await handleStatusChange(rec, newStatus, true);
          }}
          title="Staff Member Is Currently Checked In"
          message={`This staff member is currently checked in (Check-in time: ${activeOverrideConfirm.rec.checkIn}). Marking this day Absent will override their daily attendance record without checking them out. They will still be able to check out normally. Continue?`}
          confirmLabel="Mark Absent"
          variant="warning"
        />
      )}
    </div>
  );
}
