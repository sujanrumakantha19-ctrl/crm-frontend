import { api } from '@/lib/api';
import type { Lead } from '@/types';

export interface LeadQuery {
  page?: number;
  limit?: number;
  sort?: string;
  status?: string;
  assignedTo?: string;
  projectId?: string;
  [key: string]: string | number | undefined;
}

export interface FollowUpQuery {
  page?: number;
  limit?: number;
  assignedTo?: string;
  search?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  outcome?: string;
}

export interface FollowUpItem {
  id: string;
  followUpId: string;
  leadId: string;
  leadName: string;
  phone: string;
  city?: string;
  status: string;
  staffId?: string;
  staffName?: string;
  projectId?: string;
  date: string;
  nextFollowUpDate?: string;
  outcome: string;
  notes?: string;
  nextAction?: string;
}

export interface FollowUpResponse {
  success: boolean;
  data: FollowUpItem[];
  total: number;
  page: number;
  pages: number;
  stats: {
    totalCount: number;
    positiveCount: number;
    negativeCount: number;
  };
}

export interface CheckPhoneLead {
  id: string;
  displayId?: string;
  customerName: string;
  phone: string;
  status: string;
  assignedToName?: string;
  assignedToDisplayId?: string | null;
}

export interface CheckPhoneResult {
  success: boolean;
  exists: boolean;
  lead?: CheckPhoneLead;
  duplicatesCount?: number;
}

export const leadService = {
  getAll(params?: LeadQuery) {
    return api.get<Lead[]>('/leads', params as Record<string, string | number | undefined>);
  },
  getCounts(params?: { assignedTo?: string; sourceId?: string; search?: string }) {
    return api.get<{
      All: number;
      Open: number;
      Reserved: number;
      Qualified: number;
      Unqualified: number;
      Customer: number;
    }>('/leads/counts', params);
  },
  getById(id: string) {
    return api.get<Lead>(`/leads/${id}`);
  },
  getFollowUps(params?: FollowUpQuery) {
    return api.get<FollowUpItem[]>('/leads/follow-ups', params as Record<string, string | number | undefined>);
  },
  getByStatus(status: string) {
    return api.get<Lead[]>(`/leads/status/${status}`);
  },
  getByUser(userId: string) {
    return api.get<Lead[]>(`/leads/user/${userId}`);
  },
  getByProject(projectId: string) {
    return api.get<Lead[]>(`/leads/project/${projectId}`);
  },
  checkPhone(phone: string) {
    // /leads/check-phone returns a flat payload (success/exists/lead), not
    // wrapped in a `data` key, so cast the ApiResponse wrapper to that shape.
    return api.get<CheckPhoneResult>(`/leads/check-phone/${encodeURIComponent(phone)}`) as unknown as Promise<CheckPhoneResult>;
  },
  create(data: Partial<Lead>) {
    return api.post<Lead>('/leads', data);
  },
  update(id: string, data: Partial<Lead>) {
    return api.put<Lead>(`/leads/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/leads/${id}`);
  },
};
