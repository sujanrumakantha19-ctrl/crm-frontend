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
  getActive() {
    return api.get<AttendanceRecord | null>('/attendance/active');
  },
  getTodayPresence(params?: Record<string, string | number | undefined>) {
    return params
      ? api.get<StaffPresenceToday[]>('/attendance/presence/today', params)
      : api.get<StaffPresenceToday[]>('/attendance/presence/today');
  },
  getDaily(params?: Record<string, string | number | undefined>) {
    return api.get<DailyAttendanceRecord[]>('/attendance/daily', params);
  },
  setOverride(data: { staffId: string; date: string; status: string; notes?: string; reason?: string; confirmActiveOverride?: boolean; acknowledgedSessionIds?: string[] }) {
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
