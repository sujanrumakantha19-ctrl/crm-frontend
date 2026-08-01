import { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, Menu, Cake, FileText, CheckCircle, ClipboardList, Clock, Home, Search, KeyRound, Camera, AlertCircle, FileDown, Loader2, Download, X, Inbox, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth';
import { toast } from 'sonner';
import { NotificationPanel } from './NotificationPanel';
import { UserDropdown } from './UserDropdown';
import { Avatar } from '@/components/shared/Avatar';
import { NameTag } from '@/components/shared/NameTag';
import type { UserRole, User } from '@/types';
import { getInitials, getAvatarColor } from '@/data/mockData';
import { Modal } from '@/components/shared/Modal';
import { getFileUrl } from '@/lib/api';
import { getYesterdayStr, cn } from '@/lib/utils';
import { useExportContext } from '@/context/ExportContext';

interface TopbarProps {
  role: UserRole;
  title?: string;
  onToggleSidebar?: () => void;
}

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/projects': 'Projects',
  '/admin/leads': 'Leads',
  '/admin/customers': 'Loans',
  '/admin/registrations': 'Registrations',
  '/admin/follow-ups': 'Follow Ups',
  '/admin/attendance': 'Attendance',
  '/admin/tasks': 'Tasks',
  '/admin/groups': 'Groups',
  '/admin/activity-logs': 'Activity Logs',
  '/admin/staff': 'Staff Management',
  '/admin/channel-partners': 'Channel Partners',
  '/admin/reports': 'Reports',
  '/admin/about': 'About',
  '/staff/dashboard': 'Dashboard',
  '/staff/my-leads': 'My Leads',
  '/staff/leads-pool': 'Open Leads Pool',
  '/staff/tasks': 'My Tasks',
  '/staff/attendance': 'Attendance',
  '/staff/profile': 'My Profile',
  '/partner/dashboard': 'Dashboard',
  '/partner/projects': 'Projects',
  '/partner/leads': 'My Leads',
  '/partner/add-lead': 'Add New Lead',
  '/partner/profile': 'My Profile',
};

export function Topbar({ role, title, onToggleSidebar }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, checkedIn, checkInTimestamp, user: authUser, updateUser } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const handleNotificationClick = (n: typeof notifications[0]) => {
    if (!n.isRead) {
      markRead(n.id);
    }
    setAllNotifOpen(false);

    const basePath = `/${role}`;
    // Prefer an explicit deep-link provided by the notifier (issue 39)
    if (n.link) {
      if (n.link.startsWith('/')) {
        navigate(n.link);
      } else {
        navigate(`${basePath}${n.link}`);
      }
      return;
    }
    if (n.entityId && n.entityType) {
      if (n.entityType === 'Project') {
        if (n.entityId.includes(':')) {
          const [projId, plotId] = n.entityId.split(':');
          navigate(`${basePath}/projects/${projId}?tab=plotmap&plotId=${plotId}`);
        } else {
          navigate(`${basePath}/projects/${n.entityId}`);
        }
      } else {
        switch (n.entityType) {
          case 'Lead': navigate(`${basePath}/leads/${n.entityId}`); break;
          case 'Task': navigate(`${basePath}/tasks?taskId=${n.entityId}`); break;
          case 'Plot': navigate(`${basePath}/projects`); break;
          default: break;
        }
      }
    } else {
      // Fallback navigation based on notification type
      switch (n.type) {
        case 'task_assigned': case 'task_comment': navigate(`${basePath}/tasks${n.entityId ? `?taskId=${n.entityId}` : ''}`); break;
        case 'new_lead': case 'lead_status': navigate(`${basePath}/leads`); break;
        case 'booking': navigate(`${basePath}/projects`); break;
        case 'attendance': navigate(`${basePath}/attendance`); break;
        default: break;
      }
    }
  };
  
  // All Notifications Modal States
  const [allNotifOpen, setAllNotifOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'earlier'>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Profile Modal States
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Profile Form Editable Inputs
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');

  const [workingTimeStr, setWorkingTimeStr] = useState<string>('');
  const { exportInfo, setExportInfo, hasPageOverride, downloadStatus, triggerDownload, progress, setProgress, popoverOpen, setPopoverOpen } = useExportContext();

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloaderRef.current && !downloaderRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen, setPopoverOpen]);

  useEffect(() => {
    if (!checkedIn || !checkInTimestamp) {
      setWorkingTimeStr('');
      return;
    }

    const updateTime = () => {
      const diffMs = Date.now() - checkInTimestamp;
      if (diffMs <= 0) {
        setWorkingTimeStr('0m');
        return;
      }
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      
      if (hrs > 0) {
        setWorkingTimeStr(`${hrs}h ${mins}m`);
      } else {
        setWorkingTimeStr(`${mins}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // update every minute
    return () => clearInterval(interval);
  }, [checkedIn, checkInTimestamp]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchesSearch = !searchFilter.trim() || n.message.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesType = typeFilter === 'all' || n.type === typeFilter;
      const matchesDate = dateFilter === 'all' 
        ? true 
        : dateFilter === 'today' 
        ? n.isToday 
        : !n.isToday;
      const matchesRead = readFilter === 'all'
        ? true
        : readFilter === 'read'
        ? n.isRead
        : !n.isRead;
      return matchesSearch && matchesType && matchesDate && matchesRead;
    });
  }, [notifications, searchFilter, typeFilter, dateFilter, readFilter]);

  const modalIconMap: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    birthday: { icon: Cake, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', label: 'Birthday' },
    lead_status: { icon: FileText, color: 'text-brand-blue', bg: 'bg-blue-50 border-blue-100', label: 'Lead Status' },
    new_lead: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-100', label: 'New Lead' },
    task_assigned: { icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', label: 'Task Assigned' },
    task_comment: { icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', label: 'Task Comment' },
    attendance: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-100', label: 'Attendance' },
    booking: { icon: Home, color: 'text-green-600', bg: 'bg-green-50 border-green-100', label: 'Plot Booking' },
  };

  // Resolve user from auth context
  const user = authUser || { id: '', name: 'User', initials: 'U', email: '', phone: '', designation: '', role: role, avatarBg: 'bg-blue-500', isActive: true };
  
  let pageTitle = title;
  if (!pageTitle) {
    const path = location.pathname;
    const cleanPath = path.toLowerCase().replace(/\/$/, '');
    
    if (cleanPath === '/admin/staff' || cleanPath.startsWith('/admin/staff/')) {
      pageTitle = 'Staff Management';
    } else if (cleanPath.includes('/projects')) {
      pageTitle = 'Projects';
    } else if (cleanPath === '/admin/leads' || cleanPath.startsWith('/admin/leads/')) {
      pageTitle = 'Leads';
    } else if (cleanPath === '/admin/channel-partners' || cleanPath.startsWith('/admin/channel-partners/')) {
      pageTitle = 'Channel Partners';
    } else if (cleanPath === '/admin/groups' || cleanPath.startsWith('/admin/groups/')) {
      pageTitle = 'Groups';
    } else if (cleanPath === '/admin/activity-logs' || cleanPath.startsWith('/admin/activity-logs/')) {
      pageTitle = 'Activity Logs';
    } else if (cleanPath === '/admin/follow-ups' || cleanPath.startsWith('/admin/follow-ups/')) {
      pageTitle = 'Follow Ups';
    } else if (cleanPath === '/admin/attendance' || cleanPath.startsWith('/admin/attendance/')) {
      pageTitle = 'Attendance';
    } else if (cleanPath === '/admin/tasks' || cleanPath.startsWith('/admin/tasks/')) {
      pageTitle = 'Tasks';
    } else if (cleanPath === '/admin/reports' || cleanPath.startsWith('/admin/reports/')) {
      pageTitle = 'Reports';
    } else {
      const matchingKey = Object.keys(pageTitles).find(k => {
        const cleanKey = k.toLowerCase().replace(/\/$/, '');
        return cleanPath === cleanKey || cleanPath.startsWith(cleanKey + '/');
      });
      pageTitle = matchingKey ? pageTitles[matchingKey] : 'Dashboard';
    }
  }

  const currentAvatarSrc = user?.avatar ? getFileUrl(user.avatar) : (profileImage || undefined);

  // Auto-map current route to export endpoint (pages can override via setExportInfo)
  useEffect(() => {
    const path = location.pathname;
    const rolePrefix = `/${role}`;

    type RouteExport = { endpoint: string; filename: string; params?: Record<string, string> };
    const routeMap: Record<string, RouteExport | ((p: string) => RouteExport | null)> = {
      [`${rolePrefix}/leads`]: { endpoint: '/export/leads', filename: 'leads' },
      [`${rolePrefix}/follow-ups`]: { endpoint: '/export/follow-ups', filename: 'followups' },
      [`${rolePrefix}/attendance`]: { endpoint: '/export/attendance', filename: 'attendance' },
      [`${rolePrefix}/tasks`]: { endpoint: '/export/tasks', filename: 'tasks' },
      [`${rolePrefix}/projects`]: { endpoint: '/export/projects', filename: 'projects' },
      [`${rolePrefix}/customers`]: { endpoint: '/export/leads', filename: 'customers', params: { status: 'Customer' } },
      [`${rolePrefix}/staff`]: { endpoint: '/export/users', filename: 'staff_members', params: { role: 'staff' } },
      [`${rolePrefix}/channel-partners`]: { endpoint: '/export/channel-partners', filename: 'channel_partners' },
      [`${rolePrefix}/reports`]: { endpoint: '/export/reports', filename: 'report' },
      [`/staff/my-leads`]: (p) => {
        let userData: Record<string, any> = {};
        try {
          const raw = localStorage.getItem('crm_user');
          if (raw) userData = JSON.parse(raw);
        } catch { /* ignore malformed JSON */ }
        return { endpoint: '/export/leads', filename: 'my_leads', params: { assignedTo: userData.id || '' } };
      },
      [`/staff/reports`]: { endpoint: '/export/reports', filename: 'staff-report' },
      [`/partner/leads`]: { endpoint: '/export/leads', filename: 'my_leads' },
    };

    const match = Object.entries(routeMap).find(([pattern]) =>
      path === pattern || path.startsWith(pattern + '/')
    );

    // A page (Leads/Reports/StaffReports) has already configured the export for
    // this route with its own filters — never clobber it with the route-map
    // default (the page effect runs before this one on mount).
    if (hasPageOverride(path)) {
      return;
    }

    if (match) {
      const [, configOrFn] = match;
      const resolved = typeof configOrFn === 'function' ? configOrFn(path) : configOrFn;
      if (resolved) {
        setExportInfo(resolved);
        return;
      }
    }
    // Default fallback so download button is always present on ALL pages (Dashboard, Profile, etc.)
    setExportInfo({ endpoint: '/export/leads', filename: 'backup_data' });
  }, [location.pathname, role, setExportInfo, hasPageOverride]);

  useEffect(() => {
    if (profileOpen) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditPhone(user.phone);
      const rawDob = (user as any)?.dob;
      const formattedDob = rawDob ? (typeof rawDob === 'string' && rawDob.includes('T') ? rawDob.split('T')[0] : new Date(rawDob).toISOString().split('T')[0]) : '';
      setEditDob(formattedDob);
      setPasswordSuccess(false);
      setProfileSuccess(false);
      setProfileError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (user?.avatar) {
        setProfileImage(getFileUrl(user.avatar));
      }
    }
  }, [profileOpen, user]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);

    if (!allowedTypes.includes(file.type) && !isAllowedExt) {
      const { toast } = await import('sonner');
      toast.error('Unsupported file format. Only JPEG, PNG, WebP, and GIF images are allowed.');
      e.target.value = '';
      return;
    }

    try {
      const { uploadService } = await import('@/services/uploads');
      const res = await uploadService.upload('profiles', [file]);
      const path = (res.data || [])[0]?.path;
      if (path) {
        setProfileImage(getFileUrl(path));
        const updateRes = await authService.updateProfile({ avatar: path });
        const updatedData = updateRes?.data ? {
          ...updateRes.data,
          id: (updateRes.data as unknown as { _id?: string })._id || updateRes.data.id || user.id,
          avatar: path
        } : { ...user, avatar: path };
        updateUser(updatedData as unknown as User);
        const { toast } = await import('sonner');
        toast.success('Profile picture updated successfully!');
      }
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err?.message || 'Failed to upload profile picture.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setProfileError('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setProfileError('New password must be at least 6 characters.');
      return;
    }
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setProfileError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to change password.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editEmail.trim() || !editPhone.trim()) {
      setProfileError('Profile name, email, and phone cannot be empty.');
      return;
    }

    // Email regex validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(editEmail.trim())) {
      setProfileError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    // 10-digit phone regex validation
    const phoneRegex = /^(?:\+91[\-\s]?)?[6-9]\d{2}[\-\s]?\d{3}[\-\s]?\d{4}$/;
    const digits = editPhone.trim().replace(/\D/g, '');
    const is10DigitValid = phoneRegex.test(editPhone.trim()) || (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) || (digits.length === 12 && digits.startsWith('91'));
    if (!is10DigitValid) {
      setProfileError('Please enter a valid 10-digit phone number (e.g. 9876543210 or +91 9876543210).');
      return;
    }

    if (editDob) {
      const selectedDate = new Date(editDob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate >= today) {
        setProfileError('Date of Birth cannot be today or a future date.');
        return;
      }
    }

    try {
      const res = await authService.updateProfile({ name: editName, email: editEmail, phone: editPhone, dob: editDob });
      const updatedData = res?.data ? {
        ...res.data,
        id: (res.data as unknown as { _id?: string })._id || res.data.id || user.id
      } : { name: editName, email: editEmail, phone: editPhone, dob: editDob };
      updateUser(updatedData as unknown as User);
      setProfileSuccess(true);
      setProfileError(null);
      setTimeout(() => {
        setProfileSuccess(false);
        setProfileOpen(false);
      }, 1500);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 md:pl-8 md:pr-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Working Time */}
          {role === 'staff' && checkedIn && workingTimeStr && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-xs font-semibold select-none shadow-sm animate-fadeIn">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <Clock size={13} className="text-emerald-600 shrink-0" />
              <span>{workingTimeStr}</span>
            </div>
          )}

          {/* Stream Downloader Button & Popover Modal matching reference images */}
          {exportInfo && (
            <div ref={downloaderRef} className="relative">
              {/* Circular Download Icon Button matching Reference Image 1 */}
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false);
                  setUserOpen(false);
                  setPopoverOpen(!popoverOpen);
                }}
                className={cn(
                  "w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[#2b3595] hover:bg-slate-50 transition-all shadow-sm relative active:scale-95 cursor-pointer",
                  progress.status === 'downloading' && "border-blue-400 bg-blue-50/60 text-blue-700"
                )}
                title="Live Backup Stream Downloader"
              >
                <Download size={16} className={cn(progress.status === 'downloading' && "animate-bounce text-blue-600")} />
                {progress.status === 'downloading' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                )}
              </button>

              {/* Live Backup Stream Downloader Popover Card matching Reference Image 2 */}
              {popoverOpen && (
                <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 z-50 animate-dropdown overflow-hidden">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2">
                      <Download size={17} className="text-blue-600 shrink-0" />
                      <h3 className="text-sm font-bold text-slate-800 tracking-tight">Live Backup Stream Downloader</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPopoverOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Close"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Body Info */}
                  {progress.status === 'downloading' || progress.status === 'completed' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 truncate max-w-[230px]" title={progress.filename}>
                          {progress.filename || `${exportInfo.filename}.csv`}
                        </span>
                        <span className="font-extrabold text-blue-600 ml-2">
                          {progress.percentage}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>

                      {/* Stat Box */}
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 mt-3 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">SPEED</div>
                            <div className="font-bold text-slate-800">{progress.speed}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ETA</div>
                            <div className="font-bold text-slate-800">{progress.eta}</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">SIZE TRANSFERRED</div>
                          <div className="font-bold text-slate-800 text-xs">
                            {formatBytes(progress.transferredBytes)} / {formatBytes(progress.totalBytes)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : progress.status === 'error' ? (
                    /* Error State matching the same popover card style */
                    <div className="py-6 px-4 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3 shadow-inner">
                        <AlertCircle size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-700 tracking-tight">Export Failed</h4>
                      <p className="text-xs text-red-500 max-w-[240px] mt-1 leading-relaxed">
                        {progress.errorMessage || 'Something went wrong while streaming the export.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setProgress({ ...progress, status: 'idle', errorMessage: undefined });
                          setPopoverOpen(false);
                        }}
                        className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    /* Clean Empty State matching Reference Image 2 */
                    <div className="py-6 px-4 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-3 shadow-inner">
                        <Inbox size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-700 tracking-tight">No Active Downloads</h4>
                      <p className="text-xs text-slate-400 max-w-[220px] mt-1 leading-relaxed">
                        Click Export on any page to start a streaming export.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notification Bell */}
          {role !== 'partner' && (
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }}
                className="relative p-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel 
                open={notifOpen} 
                onClose={() => setNotifOpen(false)} 
                onViewAll={() => {
                  setNotifOpen(false);
                  setAllNotifOpen(true);
                }}
              />
            </div>
          )}

          {/* User Avatar */}
          <div className="relative">
            <button
              onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 hover:bg-slate-50 rounded-full pr-2 transition-colors"
            >
              <Avatar initials={user.initials} size="md" bg={user.avatarBg} src={currentAvatarSrc} />
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.name.split(' ')[0]}</span>
            </button>
            <UserDropdown open={userOpen} onClose={() => setUserOpen(false)} onProfileClick={() => setProfileOpen(true)} />
          </div>
        </div>
      </header>

      {/* View All Notifications Modal */}
      <Modal
        open={allNotifOpen}
        onClose={() => setAllNotifOpen(false)}
        title="All Notifications"
        size="2xl"
        bodyClassName="overflow-hidden flex flex-col h-[75vh]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch flex-1 min-h-0 h-full">
          {/* Left Column: Filters (1/3 width) */}
          <div className="lg:col-span-1 space-y-5 bg-slate-50/50 p-4 border border-slate-100 rounded-xl overflow-y-auto h-full pr-2">
            {/* Search */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search notifications</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-brand-green bg-white"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Read Filter */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-white text-xs font-medium w-full">
                <button
                  onClick={() => setReadFilter('all')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors text-[11px] ${readFilter === 'all' ? 'bg-slate-900 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setReadFilter('unread')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors text-[11px] ${readFilter === 'unread' ? 'bg-slate-900 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setReadFilter('read')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors text-[11px] ${readFilter === 'read' ? 'bg-slate-900 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Read
                </button>
              </div>
            </div>

            {/* Date Filter */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</span>
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-white text-xs font-medium w-full">
                <button
                  onClick={() => setDateFilter('all')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors text-[11px] ${dateFilter === 'all' ? 'bg-slate-900 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Any Time
                </button>
                <button
                  onClick={() => setDateFilter('today')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors text-[11px] ${dateFilter === 'today' ? 'bg-slate-900 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDateFilter('earlier')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors text-[11px] ${dateFilter === 'earlier' ? 'bg-slate-900 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Earlier
                </button>
              </div>
            </div>

            {/* Category Type Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-brand-green border-brand-green text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Categories
                </button>
                {Object.entries(modalIconMap).map(([type, config]) => {
                  const Icon = config.icon;
                  const isSelected = typeFilter === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        isSelected
                          ? 'bg-brand-green border-brand-green text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={12} className={isSelected ? 'text-white' : config.color} />
                        <span>{config.label}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {notifications.filter(n => n.type === type).length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Notifications Feed (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col h-full min-h-0">
            {/* Header row inside list column */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0 mb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Notifications ({filteredNotifications.length})
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-brand-blue rounded-lg text-xs font-semibold transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Scrollable list */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
                    <Bell size={22} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">No notifications found</h3>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Try adjusting your filters or search terms.</p>
                  {(searchFilter || typeFilter !== 'all' || dateFilter !== 'all' || readFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchFilter('');
                        setTypeFilter('all');
                        setDateFilter('all');
                        setReadFilter('all');
                      }}
                      className="mt-4 text-[10px] font-bold text-brand-blue hover:text-brand-darkblue hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const config = modalIconMap[n.type] || modalIconMap.attendance;
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`group flex items-start gap-4 p-4 border rounded-xl transition-all cursor-pointer ${
                        !n.isRead
                          ? 'bg-blue-50/30 border-blue-100/60 hover:bg-blue-50/50 shadow-sm animate-fadeIn'
                          : 'bg-white border-slate-100 hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${config.bg}`}>
                        <Icon size={16} className={config.color} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            n.type === 'birthday' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            n.type === 'new_lead' ? 'bg-green-50 text-green-700 border border-green-100' :
                            n.type === 'lead_status' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            n.type === 'task_assigned' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                            n.type === 'task_comment' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                            n.type === 'booking' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            'bg-slate-50 text-slate-700 border border-slate-150'
                          }`}>
                            {config.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{n.timeAgo}</span>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse shrink-0" title="Unread" />
                          )}
                        </div>
                        {n.title && <p className="text-xs font-semibold text-slate-700 mt-1.5">{n.title}</p>}
                        <p className={`text-xs mt-1.5 leading-relaxed ${!n.isRead ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                          {n.message}
                        </p>
                      </div>

                      {/* Action */}
                      {!n.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          className="p-1 text-brand-blue hover:text-blue-800 hover:bg-blue-100/50 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0 focus:opacity-100"
                          title="Mark as read"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>
      {/* View/Edit Profile Modal */}
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="My Profile Settings"
        size="md"
        footer={
          <>
            <button 
              onClick={() => setProfileOpen(false)} 
              className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveProfile}
              className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
            >
              Save Profile Changes
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Alerts */}
          {profileSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle size={16} /> Profile changes saved successfully!
            </div>
          )}
          {passwordSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle size={16} /> Password reset successfully!
            </div>
          )}
          {profileError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} /> {profileError}
            </div>
          )}

          {/* Profile Image Upload section */}
          <div className="flex flex-col items-center gap-3 pb-6 border-b border-slate-100">
            <label htmlFor="profile-image-upload" className="relative cursor-pointer block group">
              <Avatar initials={user.initials} size="xl" bg={user.avatarBg} src={currentAvatarSrc} />
              
              {/* Hover highlight overlay */}
              <div className="absolute inset-0 rounded-full bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              
              {/* Floating Camera Button in Bottom Right */}
              <div 
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-green text-white border-2 border-white flex items-center justify-center shadow-lg group-hover:bg-brand-darkgreen group-hover:scale-105 active:scale-95 transition-all duration-200"
                title="Upload Profile Image"
              >
                <Camera size={14} />
              </div>
              
              <input 
                type="file" 
                id="profile-image-upload" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageChange} 
              />
            </label>
            <div className="text-center">
              <h4 className="text-sm font-bold text-slate-800">{user.name}</h4>
              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase mt-1">
                {role === 'partner' ? 'Channel Partner' : role}
              </span>
            </div>
          </div>

          {/* Details Form */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Details</h4>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">
                ID
              </label>
              <input 
                type="text" 
                value={(user as any).displayId || user.id || '—'}
                disabled
                readOnly
                className="w-full h-9 px-3 border border-slate-200 rounded text-xs bg-slate-100 text-slate-700 font-semibold cursor-not-allowed outline-none select-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">
                  Full Name <span className="text-red-500 font-bold">*</span>
                </label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">
                  Phone Number <span className="text-red-500 font-bold">*</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="Enter 10-digit phone number"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value.replace(/[^0-9+\s\-]/g, ''))}
                  maxLength={15}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">
                  Email Address <span className="text-red-500 font-bold">*</span>
                </label>
                <input 
                  type="email" 
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">Date of Birth</label>
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
                className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none" 
              />
            </div>
          </div>

          {/* Reset Password Form */}
          <form onSubmit={handleResetPassword} className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-1.5">
              <KeyRound size={16} className="text-slate-400" />
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reset Account Password</h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 font-bold text-slate-600">Confirm Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 border border-slate-200 rounded text-xs focus:border-brand-green outline-none"
                />
              </div>
            </div>
            
            <button 
              type="submit"
              className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold active:scale-[0.98] transition-all"
            >
              Update Password
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
