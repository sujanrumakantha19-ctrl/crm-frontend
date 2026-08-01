import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Cake, FileText, CheckCircle, ClipboardList, Clock, Home, MessageSquare } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onViewAll?: () => void;
}

const iconMap: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  birthday: { icon: Cake, color: 'text-amber-600', bg: 'bg-amber-100' },
  lead_status: { icon: FileText, color: 'text-brand-blue', bg: 'bg-blue-100' },
  new_lead: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  task_assigned: { icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-100' },
  task_comment: { icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-100' },
  attendance: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100' },
  booking: { icon: Home, color: 'text-green-600', bg: 'bg-green-100' },
};

export function NotificationPanel({ open, onClose, onViewAll }: NotificationPanelProps) {
  const { notifications, unreadCount, markAllRead, markRead, fetchMore, hasMore } = useNotifications();
  const { role } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(10);
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const handleScroll = useCallback(async () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      if (visibleCount < notifications.length) {
        setVisibleCount(prev => Math.min(prev + 10, notifications.length));
      } else if (hasMore && !loadingMore) {
        setLoadingMore(true);
        try {
          await fetchMore();
        } finally {
          setLoadingMore(false);
        }
      }
    }
  }, [notifications.length, visibleCount, hasMore, loadingMore, fetchMore]);

  if (!open) return null;

  // Navigate based on notification type
  const handleNotificationClick = (n: typeof notifications[0]) => {
    markRead(n.id);
    onClose();

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

  const visible = notifications.slice(0, visibleCount);
  const today = visible.filter(n => n.isToday);
  const earlier = visible.filter(n => !n.isToday);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-14 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-dropdown overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-medium text-brand-blue hover:text-brand-darkblue transition-colors">
            Mark all read
          </button>
        )}
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="max-h-80 overflow-y-auto">
        {today.length > 0 && (
          <div className="px-4 pt-2 pb-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Today</span>
          </div>
        )}
        {today.map(n => {
          const config = iconMap[n.type] || iconMap.attendance;
          const Icon = config.icon;
          return (
            <button
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                !n.isRead ? 'border-l-[3px] border-l-blue-600' : 'border-l-[3px] border-l-transparent'
              } ${n.type === 'birthday' ? 'bg-amber-50/50' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                <Icon size={14} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                {n.title && <p className="text-sm font-semibold text-slate-800">{n.title}</p>}
                <p className={`text-sm ${n.type === 'birthday' ? 'text-amber-800 font-medium' : 'text-slate-700'}`}>{n.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.timeAgo}</p>
              </div>
            </button>
          );
        })}
        {earlier.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Earlier</span>
          </div>
        )}
        {earlier.map(n => {
          const config = iconMap[n.type] || iconMap.attendance;
          const Icon = config.icon;
          return (
            <button
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                !n.isRead ? 'border-l-[3px] border-l-blue-600' : 'border-l-[3px] border-l-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                <Icon size={14} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                {n.title && <p className="text-sm font-semibold text-slate-800">{n.title}</p>}
                <p className="text-sm text-slate-700">{n.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.timeAgo}</p>
              </div>
            </button>
          );
        })}
        {loadingMore && (
          <div className="py-3 text-center">
            <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-slate-100 text-center">
        <button onClick={() => { if (onViewAll) onViewAll(); }} className="text-sm font-medium text-brand-blue hover:text-brand-darkblue transition-colors">
          View all notifications
        </button>
      </div>
    </div>
  );
}
