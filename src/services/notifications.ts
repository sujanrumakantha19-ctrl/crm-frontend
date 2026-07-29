import { api } from '@/lib/api';
import type { Notification } from '@/types';

export const notificationService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<Notification[]>('/notifications', params);
  },
  getUnread() {
    return api.get<Notification[]>('/notifications/unread');
  },
  markAsRead(id: string) {
    return api.put<Notification>(`/notifications/${id}/read`);
  },
  markAllAsRead() {
    return api.put('/notifications/read/all');
  },
  create(data: Partial<Notification>) {
    return api.post<Notification>('/notifications', data);
  },
  delete(id: string) {
    return api.delete(`/notifications/${id}`);
  },
};
