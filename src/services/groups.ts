import { api } from '@/lib/api';
import type { Group } from '@/types';

export const groupService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<Group[]>('/groups', params);
  },
  getPerformance(params?: { year?: string; month?: string }) {
    return api.get<{
      performance: any[];
      summary: {
        totalLeadsHandled: number;
        conversionsClosed: number;
        qualifiedLeads: number;
        topGroupId: string | null;
      };
    }>('/groups/performance', params);
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
  addMember(groupId: string, userId: string, options?: { expectedCurrentGroupId?: string | null } | string | null) {
    let expectedCurrentGroupId: string | null | undefined = undefined;
    if (options !== undefined) {
      if (typeof options === 'object' && options !== null) {
        expectedCurrentGroupId = options.expectedCurrentGroupId;
      } else {
        expectedCurrentGroupId = options;
      }
    }
    return api.post(`/groups/${groupId}/members`, { userId, expectedCurrentGroupId });
  },
  removeMember(groupId: string, userId: string) {
    return api.delete(`/groups/${groupId}/members/${userId}`);
  },
};
