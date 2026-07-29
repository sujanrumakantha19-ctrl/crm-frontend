import { api } from '@/lib/api';
import type { User } from '@/types';

export const userService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<User[]>('/users', params);
  },
  getById(id: string) {
    return api.get<User>(`/users/${id}`);
  },
  create(data: Partial<User> & { password: string }) {
    return api.post<User>('/users', data);
  },
  update(id: string, data: Partial<User>) {
    return api.put<User>(`/users/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/users/${id}`);
  },
};
