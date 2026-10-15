import { api } from '@/lib/api';
import type { Plot, PlotApproval } from '@/types';

export const plotService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<Plot[]>('/plots', params);
  },
  getById(id: string) {
    return api.get<Plot>(`/plots/${id}`);
  },
  getPendingApproval(id: string) {
    return api.get<PlotApproval>(`/plots/${id}/pending-approval`);
  },
  getByProject(projectId: string, params?: { page?: number; limit?: number; search?: string; status?: string; all?: string }) {
    return api.get<Plot[]>(`/plots/project/${projectId}`, params);
  },
  getCustomerBookings(params: { leadId?: string; leadIds?: string; phone?: string; plotId?: string; status?: string }) {
    return api.get<Plot[]>('/plots/customer-bookings', params);
  },
  getByStatus(status: string, params?: Record<string, string | number | undefined>) {
    return api.get<Plot[]>(`/plots/status/${status}`, params);
  },
  create(data: Partial<Plot>) {
    return api.post<Plot>('/plots', data);
  },
  update(id: string, data: Partial<Plot>) {
    return api.put<Plot>(`/plots/${id}`, data);
  },
  bookPlot(id: string, data: { leadId?: string; customerName: string; phone: string; paymentStatus?: string; paymentMethod?: string; bank?: string; bankFollowerName?: string; bankFollowerPhone?: string; notes?: string; expectedRegistrationDate?: string }) {
    return api.put<Plot>(`/plots/${id}/book`, data);
  },
  approveBooking(id: string) {
    return api.put<Plot>(`/plots/${id}/approve`);
  },
  rejectBooking(id: string) {
    return api.put<Plot>(`/plots/${id}/reject`);
  },
  registerPlot(id: string, data?: { registrationDate?: string; paymentStatus?: string }) {
    return api.put<Plot>(`/plots/${id}/register`, data);
  },
  cancelBooking(id: string) {
    return api.put<Plot>(`/plots/${id}/cancel`);
  },
  getPendingApprovals() {
    return api.get<Plot[]>('/plots/pending-approvals');
  },
  getMyBookings(params?: Record<string, string | number | undefined>) {
    return api.get<Plot[]>('/plots/my-bookings', params);
  },
  getRegistrationOptions() {
    return api.get<{
      projects: { id: string; _id?: string; name: string; displayId?: string; location?: string; surveyNumber?: string }[];
      banks: string[];
      staff: { id: string; _id?: string; name: string; displayId?: string; role: string }[];
    }>('/plots/registration-options');
  },
  delete(id: string) {
    return api.delete(`/plots/${id}`);
  },
};
