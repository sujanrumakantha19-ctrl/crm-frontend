import { api } from '@/lib/api';
import type { Group } from '@/types';

export const groupService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<Group[]>('/groups', params);
  },
  getById(id: string) {
    return api.get<Group>(`/groups/${id}`);
  },
  create(data: Partial<Group>) {
    return api.post<Group>('/groups', data);
  },
  update(id: string, data: Partial<Group>) {
    return api.put<Group>(`/groups/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/groups/${id}`);
  },
  addMember(groupId: string, userId: string) {
    return api.post(`/groups/${groupId}/members`, { userId });
  },
  removeMember(groupId: string, userId: string) {
    return api.delete(`/groups/${groupId}/members/${userId}`);
  },
};
