import { api } from '@/lib/api';

export interface ReportFilterParams {
  page?: number;
  limit?: number;
  month?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const reportService = {
  getSummary(params?: ReportFilterParams) {
    return api.get<any>('/reports/summary', params as Record<string, string | number | undefined>);
  },
  getProjects(params?: ReportFilterParams) {
    return api.get<any[]>('/reports/projects', params as Record<string, string | number | undefined>);
  },
  getStaff(params?: ReportFilterParams) {
    return api.get<any[]>('/reports/staff', params as Record<string, string | number | undefined>);
  },
  getAttendance(params?: ReportFilterParams) {
    return api.get<any[]>('/reports/attendance', params as Record<string, string | number | undefined>);
  },
  getLeadsTrend(params?: ReportFilterParams) {
    return api.get<any[]>('/reports/leads-trend', params as Record<string, string | number | undefined>);
  },
  getLeadContribution(params?: ReportFilterParams) {
    return api.get<any[]>('/reports/lead-contribution', params as Record<string, string | number | undefined>);
  },
  getChannelPartnerPerformance(params?: ReportFilterParams) {
    return api.get<any[]>('/reports/channel-partner-performance', params as Record<string, string | number | undefined>);
  },
};

