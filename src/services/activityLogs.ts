import { api } from '@/lib/api';
import type { ActivityLog } from '@/types';

export const activityLogService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<ActivityLog[]>('/activity-logs', params);
  },
  getRecent(limit = 10) {
    return api.get<ActivityLog[]>('/activity-logs/recent', { limit });
  },
  getByEntity(entityType: string) {
    return api.get<ActivityLog[]>(`/activity-logs/entity/${entityType}`);
  },
  getByAction(actionType: string) {
    return api.get<ActivityLog[]>(`/activity-logs/action/${actionType}`);
  },
  create(data: Partial<ActivityLog>) {
    return api.post<ActivityLog>('/activity-logs', data);
  },
  delete(id: string) {
    return api.delete(`/activity-logs/${id}`);
  },
};
