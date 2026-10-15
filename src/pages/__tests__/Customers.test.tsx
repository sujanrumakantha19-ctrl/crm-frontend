import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockLeadService, mockProjectService, mockPlotService, mockUserService, mockUseAuth } = vi.hoisted(() => ({
  mockLeadService: { getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }), update: vi.fn().mockResolvedValue({ data: {} }) },
  mockProjectService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  mockPlotService: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    getCustomerBookings: vi.fn().mockResolvedValue({ data: [] }),
  },
  mockUserService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  mockUseAuth: vi.fn().mockReturnValue({
    role: 'admin',
    userId: 'user-1',
    user: { name: 'Admin', role: 'admin' },
  }),
}));

vi.mock('@/services', () => ({
  leadService: mockLeadService,
  projectService: mockProjectService,
  plotService: mockPlotService,
  userService: mockUserService,
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (v: any) => v,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/context/ExportContext', () => ({
  useExportContext: () => ({ isExporting: false, exportCsv: vi.fn(), startExport: vi.fn(), cancelExport: vi.fn(), setExportInfo: vi.fn() }),
  ExportProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/shared/Avatar', () => ({
  Avatar: ({ initials }: { initials: string }) => <span data-testid="avatar">{initials}</span>,
}));

vi.mock('@/components/shared/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('@/components/shared/Modal', () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock('@/components/modals/WhatsAppChatModal', () => ({
  WhatsAppChatModal: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import AdminCustomers from '@/pages/admin/Customers';

describe('AdminCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      role: 'admin',
      userId: 'user-1',
      user: { name: 'Admin', role: 'admin' },
    });
    mockLeadService.getAll.mockResolvedValue({ data: [], total: 0 });
    mockProjectService.getAll.mockResolvedValue({ data: [] });
    mockPlotService.getAll.mockResolvedValue({ data: [] });
    mockPlotService.getCustomerBookings.mockResolvedValue({ data: [] });
  });

  it('renders the page title for admin', async () => {
    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );
    const title = await screen.findByText('Loans', {}, { timeout: 5000 });
    expect(title).toBeInTheDocument();
  });

  it('renders the page title for staff', async () => {
    mockUseAuth.mockReturnValue({
      role: 'staff',
      userId: 'staff-1',
      user: { name: 'Staff', role: 'staff' },
    });
    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );
    const title = await screen.findByText('Loans', {}, { timeout: 5000 });
    expect(title).toBeInTheDocument();
  });

  it('displays skeleton loader while loading', () => {
    mockLeadService.getAll.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no customers found', async () => {
    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );
    const emptyState = await screen.findByText('No loaned customers found', {}, { timeout: 5000 });
    expect(emptyState).toBeInTheDocument();
  });

  it('displays sort dropdown', async () => {
    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );
    const sortEl = await screen.findByText('Newest First', {}, { timeout: 5000 });
    expect(sortEl).toBeInTheDocument();
  });

  it('displays filter bar with project and bank dropdowns', async () => {
    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('All Projects')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByText('All Banks')).toBeInTheDocument();
  });

  it('renders customer data when API returns results', async () => {
    const mockData = {
      data: [{
        id: '1',
        customerName: 'Raj Kumar',
        phone: '9876543210',
        status: 'Customer',
        paymentMethod: 'LOAN',
        paymentStatus: 'Fully Paid',
        projectId: { name: 'Green Valley', location: 'Hyderabad', surveyNumber: 'SN-001' },
        plotId: { plotNumber: 5 },
        assignedToName: 'Priya Sharma',
        dateAdded: '2025-01-15',
        city: 'Hyderabad',
        bank: 'HDFC',
      }],
      total: 1,
    };
    mockLeadService.getAll.mockResolvedValue(mockData);

    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Raj Kumar').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });
    expect(screen.getAllByText('Green Valley').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SN-001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('9876543210').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 total customers')).toBeInTheDocument();
  });

  it('shows total count in header', async () => {
    mockLeadService.getAll.mockResolvedValue({ data: [], total: 5 });

    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('5 total customers')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('staff role sends assignedTo param in API call', async () => {
    mockUseAuth.mockReturnValue({
      role: 'staff',
      userId: 'staff-1',
      user: { name: 'Staff', role: 'staff' },
    });
    mockLeadService.getAll.mockResolvedValue({ data: [], total: 0 });

    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockLeadService.getAll).toHaveBeenCalled();
    }, { timeout: 5000 });

    const params = mockLeadService.getAll.mock.calls[0][0];
    expect(params.assignedTo).toBe('staff-1');
  });

  it('renders retry button on error', async () => {
    mockLeadService.getAll.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
