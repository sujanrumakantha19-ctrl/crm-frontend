import { api } from '@/lib/api';
import type { Task } from '@/types';

export const taskService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<Task[]>('/tasks', params);
  },
  getById(id: string) {
    return api.get<Task>(`/tasks/${id}`);
  },
  getByAssignee(assigneeId: string) {
    return api.get<Task[]>(`/tasks/assignee/${assigneeId}`);
  },
  getByStatus(status: string) {
    return api.get<Task[]>(`/tasks/status/${status}`);
  },
  getByProject(projectId: string) {
    return api.get<Task[]>(`/tasks/project/${projectId}`);
  },
  create(data: Partial<Task>) {
    return api.post<Task>('/tasks', data);
  },
  update(id: string, data: Partial<Task>) {
    return api.put<Task>(`/tasks/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/tasks/${id}`);
  },
};
