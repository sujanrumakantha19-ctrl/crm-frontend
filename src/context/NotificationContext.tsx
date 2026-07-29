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

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) return;
    pageRef.current = 1;
    notificationService.getAll({ limit: LIMIT, sort: '-createdAt' })
      .then(r => {
        const items = (r.data || []).map(formatNotif);
        setNotifications(items);
        setHasMore((r.data?.length ?? 0) >= LIMIT);
      })
      .catch(err => console.warn('Failed to load notifications:', err));
  }, []);

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
      setNotifications(prev => [...prev, ...items]);
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
