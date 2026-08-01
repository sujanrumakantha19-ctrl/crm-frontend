import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { notificationService } from '@/services';
import type { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  addNotification: (n: Omit<Notification, 'id' | 'timeAgo' | 'isRead' | 'isToday'> & { userId?: string }) => void;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
  addNotification: () => {},
  fetchMore: async () => {},
  hasMore: false,
});

const formatNotif = (n: any) => {
  const createdAt = n.createdAt ? new Date(n.createdAt) : new Date();
  const today = new Date();
  const isToday = createdAt.toDateString() === today.toDateString();
  const diffMins = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60));
  let timeAgo = 'Just now';
  if (diffMins >= 1440) {
    timeAgo = createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } else if (diffMins >= 60) {
    timeAgo = `${Math.floor(diffMins / 60)}h ago`;
  } else if (diffMins > 0) {
    timeAgo = `${diffMins}m ago`;
  }
  return {
    ...n,
    id: n.id || n._id,
    isToday,
    timeAgo: n.timeAgo || timeAgo,
  };
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const LIMIT = 50;

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('crm_token');
    if (!token) return;
    try {
      const r = await notificationService.getAll({ limit: LIMIT, sort: '-createdAt' });
      const items = (r.data || []).map(formatNotif);
      setNotifications(prev => {
        // Merge: keep optimistic `notif-` entries only until their server-persisted
        // twin arrives (matched by content), then drop them to avoid duplicates.
        const serverIds = new Set(items.map(n => n.id));
        const serverByContent = items.map(s => ({ type: s.type, message: s.message, entityId: s.entityId }));
        const matchesServer = (n: any) =>
          serverIds.has(n.id) ||
          serverByContent.some(s => s.type === n.type && s.message === n.message && s.entityId === n.entityId);
        const stale = prev.filter(n => n.id.startsWith('notif-') && !matchesServer(n));
        return [...stale, ...items];
      });
      setHasMore((r.data?.length ?? 0) >= LIMIT);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    }
  }, []);

  // Initial load + live polling so the badge stays fresh during a session (issue 34).
  useEffect(() => {
    pageRef.current = 1;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = useCallback(() => {
    notificationService.markAllAsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    notificationService.markAsRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => (n.id === id || (n as unknown as {_id:string})._id === id) ? { ...n, isRead: true } : n));
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timeAgo' | 'isRead' | 'isToday'> & { userId?: string }) => {
    const newNotif = { ...n, id: `notif-${Date.now()}`, timeAgo: 'Just now', isRead: false, isToday: true };
    setNotifications(prev => [newNotif, ...prev]);
    notificationService.create(newNotif).catch(() => {});
  }, []);

  const fetchMore = useCallback(async () => {
    const nextPage = pageRef.current + 1;
    try {
      const r = await notificationService.getAll({ limit: LIMIT, sort: '-createdAt', page: nextPage });
      const items = (r.data || []).map(formatNotif);
      if (items.length === 0) { setHasMore(false); return; }
      setNotifications(prev => {
        const existing = new Set(prev.map(n => n.id));
        return [...prev, ...items.filter(n => !existing.has(n.id))];
      });
      pageRef.current = nextPage;
      setHasMore(items.length >= LIMIT);
    } catch { setHasMore(false); }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, addNotification, fetchMore, hasMore }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
