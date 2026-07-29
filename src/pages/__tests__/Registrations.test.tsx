import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockPlotService, mockProjectService, mockUseAuth } = vi.hoisted(() => ({
  mockPlotService: {
    getAll: vi.fn(),
    getByStatus: vi.fn(),
    getMyBookings: vi.fn(),
    update: vi.fn(),
  },
  mockProjectService: { getAll: vi.fn() },
  mockUseAuth: vi.fn(),
}));

vi.mock('@/services', () => ({
  plotService: mockPlotService,
  projectService: mockProjectService,
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (v: any) => v,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import AdminRegistrations from '@/pages/admin/Registrations';

describe('AdminRegistrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      role: 'admin',
      userId: 'user-1',
      user: { name: 'Admin', role: 'admin' },
    });
    mockPlotService.getAll.mockResolvedValue({ data: [], total: 0 });
    mockPlotService.getByStatus.mockResolvedValue({ data: [], total: 0 });
    mockPlotService.getMyBookings.mockResolvedValue({ data: [], total: 0 });
    mockProjectService.getAll.mockResolvedValue({ data: [] });
  });

  it('renders the page title for admin', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    const title = await screen.findByText('Registrations', {}, { timeout: 5000 });
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
        <AdminRegistrations />
      </MemoryRouter>
    );
    const title = await screen.findByText('My Registrations', {}, { timeout: 5000 });
    expect(title).toBeInTheDocument();
  });

  it('displays sort dropdown', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    const sortEl = await screen.findByText('Newest First', {}, { timeout: 5000 });
    expect(sortEl).toBeInTheDocument();
  });

  it('shows tabs for admin role', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Registered')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('does not show tabs for staff role', async () => {
    mockUseAuth.mockReturnValue({
      role: 'staff',
      userId: 'staff-1',
      user: { name: 'Staff', role: 'staff' },
    });
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('staff role calls getMyBookings instead of getAll', async () => {
    mockUseAuth.mockReturnValue({
      role: 'staff',
      userId: 'staff-1',
      user: { name: 'Staff', role: 'staff' },
    });
    mockPlotService.getMyBookings.mockResolvedValue({ data: [], total: 0 });

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockPlotService.getMyBookings).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('renders empty state when no plots found', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    const emptyState = await screen.findByText('No registered plots found', {}, { timeout: 5000 });
    expect(emptyState).toBeInTheDocument();
  });

  it('displays filter bar with project dropdown and date inputs', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('All Projects')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows total count', async () => {
    mockPlotService.getAll.mockResolvedValue({ data: [], total: 3 });
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('3 total plots')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders survey number when data has it', async () => {
    const mockData = {
      data: [{
        id: 'p1',
        plotNumber: 42,
        projectId: { name: 'Green Valley', location: 'Hyderabad', surveyNumber: 'SV-100' },
        bookedBy: { name: 'Raj Kumar', phone: '9876543210', paymentStatus: 'Fully Paid' },
        registrationDate: '2025-02-01',
      }],
      total: 1,
    };
    mockPlotService.getAll.mockResolvedValue(mockData);

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('SV-100').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });
  });

  it('renders days passed from booking date in Upcoming tab', async () => {
    const mockData = {
      data: [{
        id: 'p2',
        plotNumber: 55,
        projectId: { name: 'Sunset Ridge', location: 'Hyderabad' },
        bookedBy: { name: 'Priya Sharma', phone: '9876500000', paymentStatus: 'Advance Paid', bookingDate: '2026-07-20' },
        expectedRegistrationDate: '2026-08-15',
      }],
      total: 1,
    };
    mockPlotService.getAll.mockResolvedValue(mockData);

    render(
      <MemoryRouter initialEntries={['/admin/registrations?tab=upcoming']}>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/passed/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
