import { api } from '@/lib/api';
import type { Project } from '@/types';

export interface ProjectQuery {
  page?: number;
  limit?: number;
  sort?: string;
  status?: string;
  select?: string;
  [key: string]: string | number | undefined;
}

export const projectService = {
  getAll(params?: ProjectQuery) {
    return api.get<Project[]>('/projects', params as Record<string, string | number | undefined>);
  },
  getById(id: string) {
    return api.get<Project>(`/projects/${id}`);
  },
  create(data: Partial<Project>) {
    return api.post<Project>('/projects', data);
  },
  update(id: string, data: Partial<Project>) {
    return api.put<Project>(`/projects/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/projects/${id}`);
  },
  getLocations() {
    return api.get<string[]>('/projects/locations');
  },
};
