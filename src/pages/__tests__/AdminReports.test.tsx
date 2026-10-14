import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockReportService } = vi.hoisted(() => ({
  mockReportService: {
    getSummary: vi.fn(),
    getProjects: vi.fn(),
    getStaff: vi.fn(),
    getAttendance: vi.fn(),
    getChannelPartnerPerformance: vi.fn(),
    getLeadsTrend: vi.fn(),
    getLeadContribution: vi.fn(),
  },
}));

vi.mock('@/services', () => ({
  reportService: mockReportService,
}));

import { ExportProvider } from '@/context/ExportContext';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    role: 'admin',
    user: { name: 'Admin', role: 'admin' },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import AdminReports from '@/pages/admin/Reports';

describe('AdminReports - Total Sq Ft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportService.getSummary.mockResolvedValue({
      totalProjects: 2,
      totalLeads: 10,
      totalCustomers: 4,
      totalPlotsBooked: 4,
      loanCustomers: 2,
      cashCustomers: 2,
      funnelOpen: 3,
      funnelQualified: 3,
      funnelCustomer: 4,
      conversionRate: 40,
    });
    mockReportService.getProjects.mockResolvedValue({
      data: [
        {
          _id: 'p1',
          name: 'Green Valley',
          location: 'Hyderabad',
          status: 'Active',
          plotCount: 50,
          totalSqFt: 435600,
          booked: 10,
          registered: 5,
          available: 35,
          leadCount: 20,
          loanBookings: 6,
          cashBookings: 4,
        },
      ],
      total: 1,
      pages: 1,
    });
  });

  it('renders Total Sq. Ft. column header and formatted sq ft value in project summary tab', async () => {
    render(
      <MemoryRouter>
        <ExportProvider>
          <AdminReports />
        </ExportProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockReportService.getProjects).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Green Valley').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Total Sq. Ft.').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4,?35,?600\s*sq\s*ft/i).length).toBeGreaterThan(0);
  });

  it('clears summary cards and displays dashes when getSummary fails', async () => {
    mockReportService.getSummary.mockRejectedValue(new Error('Summary fetch failed'));
    render(
      <MemoryRouter>
        <ExportProvider>
          <AdminReports />
        </ExportProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockReportService.getSummary).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load summary: Summary fetch failed/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
