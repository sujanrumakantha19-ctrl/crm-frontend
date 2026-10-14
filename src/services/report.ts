import { api } from '@/lib/api';

export interface ReportFilterParams {
  page?: number;
  limit?: number;
  month?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: string;
}

export interface OperationsMetricsData {
  totalLoans: number;
  totalCustomers?: number;
  registrationPending: number;
  totalBookings: number;
  todaysRegistrations?: number;
  pendingPaymentRegistrations?: number;
  bookingPayments: {
    notPaid: number;
    partiallyPaid: number;
    advancePaid: number;
    advanceNotPaid: number;
  };
}

export interface DashboardLeadChartsData {
  monthlyTrend: { name: string; Leads: number; Bookings: number }[];
  sourceBreakdown: { name: string; count: number; value: number; color: string }[];
  totalLeads: number;
}

export const reportService = {
  getOperationsMetrics(params?: ReportFilterParams) {
    return api.get<OperationsMetricsData>('/reports/operations-metrics', params as Record<string, string | number | undefined>);
  },
  getDashboardLeadCharts() {
    return api.get<DashboardLeadChartsData>('/reports/dashboard-charts');
  },
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

