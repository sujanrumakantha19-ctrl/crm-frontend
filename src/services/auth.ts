import { api } from '@/lib/api';
import type { User, UserRole } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  initials: string;
  role: string;
  designation?: string;
  email: string;
  phone: string;
  password: string;
  avatarBg?: string;
}

// Shape of the `data` payload returned by /auth/login and /auth/register.
// The backend wraps it as { success, token, data: AuthResponse }.
interface AuthResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  designation: string;
  phone: string;
  avatarBg: string;
  employeeId?: string;
}

export const authService = {
  async login(payload: LoginPayload) {
    const res = await api.post<AuthResponse>('/auth/login', payload);
    if (res.token) api.setToken(res.token);
    return res;
  },

  async register(payload: RegisterPayload) {
    const res = await api.post<AuthResponse>('/auth/register', payload);
    if (res.token) api.setToken(res.token);
    return res;
  },

  async getMe() {
    return api.get<User>('/auth/me');
  },

  async forgotPassword(email: string) {
    return api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string) {
    return api.post('/auth/reset-password', { token, newPassword });
  },

  async updateProfile(data: { name?: string; email?: string; phone?: string; dob?: string; avatar?: string }) {
    return api.put<User>('/auth/update-profile', data);
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await api.put<{ token?: string }>('/auth/change-password', { currentPassword, newPassword });
    if (res.token) api.setToken(res.token);
    return res;
  },

  async savePushToken(token: string, platform: string) {
    return api.put('/auth/push-token', { token, platform });
  },

  async removePushToken(token: string) {
    return api.delete('/auth/push-token', { token });
  },

  logout() {
    api.clearToken();
    localStorage.removeItem('crm_role');
    localStorage.removeItem('crm_user');
  },
};
