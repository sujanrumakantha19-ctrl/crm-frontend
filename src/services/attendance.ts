import { api } from '@/lib/api';
import type { AttendanceRecord, StaffPresenceToday, TodayPresenceSummary, DailyAttendanceRecord } from '@/types';

export const attendanceService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<AttendanceRecord[]>('/attendance', params);
  },
  getById(id: string) {
    return api.get<AttendanceRecord>(`/attendance/${id}`);
  },
  getByStaff(staffId: string, params?: Record<string, string | number | undefined>) {
    return api.get<AttendanceRecord[]>(`/attendance/staff/${staffId}`, params);
  },
  getByDate(date: string) {
    return api.get<AttendanceRecord[]>(`/attendance/date/${date}`);
  },
  getToday() {
    return api.get<AttendanceRecord[]>('/attendance/today');
  },
  getTodayPresence(params?: Record<string, string | number | undefined>) {
    return params
      ? api.get<StaffPresenceToday[]>('/attendance/presence/today', params)
      : api.get<StaffPresenceToday[]>('/attendance/presence/today');
  },
  getDaily(params?: Record<string, string | number | undefined>) {
    return api.get<{ data: DailyAttendanceRecord[]; summary: any; pagination: any }>('/attendance/daily', params);
  },
  setOverride(data: { staffId: string; date: string; status: string; notes?: string }) {
    return api.post('/attendance/override', data);
  },
  create(data: Partial<AttendanceRecord>) {
    return api.post<AttendanceRecord>('/attendance', data);
  },
  update(id: string, data: Partial<AttendanceRecord>) {
    return api.put<AttendanceRecord>(`/attendance/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/attendance/${id}`);
  },
};
