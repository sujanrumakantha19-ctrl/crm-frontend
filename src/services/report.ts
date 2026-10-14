import { api } from '@/lib/api';

export interface ReportFilterParams {
  page?: number;
  limit?: number;
  month?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: string;
  reportView?: string;
}

export interface OperationsMetricsData {
  totalLoans: number;
  totalCustomers?: number;
  registrationPending: number;
  totalBookings: number;
  todaysRegistrations?: number;
  pendingPaymentRegistrations?: number;
  unknownBookingDateCount?: number;
  bookingPayments: {
    notPaid: number;
    partiallyPaid: number;
    advancePaid: number;
    advanceNotPaid: number;
    fullyPaid?: number;
  };
}

export interface DashboardLeadChartsData {
  monthlyTrend: { name: string; Leads: number; Bookings: number }[];
  sourceBreakdown: { name: string; count: number; value: number; color: string }[];
  totalLeads: number;
}

export interface ReportSummaryData {
  totalProjects: number;
  totalLeads: number;
  totalCustomers: number;
  totalPlotsBooked: number;
  conversionRate: number;
  loanCustomers?: number;
  cashCustomers?: number;
  funnelOpen?: number;
  funnelQualified?: number;
  funnelCustomer?: number;
}

export interface ProjectReportRow {
  _id: string;
  name: string;
  displayId?: string;
  totalPlots: number;
  available: number;
  booked: number;
  registered: number;
  loanBookings: number;
  cashBookings: number;
  leadCount: number;
  totalRevenue: number;
}

export interface StaffReportRow {
  _id: string;
  name: string;
  displayId?: string;
  email: string;
  role: string;
  assignedLeads: number;
  converted: number;
  conversionRate: number;
  totalPlotsSold: number;
  totalRevenue: number;
  plotsBooked?: number;
  plotsRegistered?: number;
}

export interface AttendanceReportRow {
  _id: string;
  date: string;
  staffId: string;
  staffName: string;
  staffDisplayId?: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  project?: string;
  projectName?: string;
}

export interface LeadsTrendRow {
  _id: string;
  period: string;
  totalLeads: number;
  openLeads: number;
  qualifiedLeads: number;
  unqualifiedLeads: number;
  convertedCustomers: number;
  conversionRate: number;
}

export interface LeadContributionRow {
  _id: string;
  source: string;
  totalLeads: number;
  convertedCustomers: number;
  conversionRate: number;
  percentage: number;
}

export interface ChannelPartnerPerformanceRow {
  _id: string;
  name: string;
  phone?: string;
  totalLeads: number;
  convertedCustomers: number;
  conversionRate: number;
  plotsBooked: number;
  plotsRegistered: number;
  totalRevenue: number;
  commission?: number;
}

export const reportService = {
  getOperationsMetrics(params?: ReportFilterParams) {
    return api.get<OperationsMetricsData>('/reports/operations-metrics', params as Record<string, string | number | undefined>);
  },
  getDashboardLeadCharts() {
    return api.get<DashboardLeadChartsData>('/reports/dashboard-charts');
  },
  getSummary(params?: ReportFilterParams) {
    return api.get<ReportSummaryData>('/reports/summary', params as Record<string, string | number | undefined>);
  },
  getProjects(params?: ReportFilterParams) {
    return api.get<ProjectReportRow[]>('/reports/projects', params as Record<string, string | number | undefined>);
  },
  getStaff(params?: ReportFilterParams) {
    return api.get<StaffReportRow[]>('/reports/staff', params as Record<string, string | number | undefined>);
  },
  getAttendance(params?: ReportFilterParams) {
    return api.get<AttendanceReportRow[]>('/reports/attendance', params as Record<string, string | number | undefined>);
  },
  getLeadsTrend(params?: ReportFilterParams) {
    return api.get<LeadsTrendRow[]>('/reports/leads-trend', params as Record<string, string | number | undefined>);
  },
  getLeadContribution(params?: ReportFilterParams) {
    return api.get<LeadContributionRow[]>('/reports/lead-contribution', params as Record<string, string | number | undefined>);
  },
  getChannelPartnerPerformance(params?: ReportFilterParams) {
    return api.get<ChannelPartnerPerformanceRow[]>('/reports/channel-partner-performance', params as Record<string, string | number | undefined>);
  },
};

