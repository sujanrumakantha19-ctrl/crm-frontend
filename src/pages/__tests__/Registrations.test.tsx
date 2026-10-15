import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';

const { mockPlotService, mockProjectService, mockLeadService, mockUserService, mockTaskService, mockUseAuth } = vi.hoisted(() => ({
  mockPlotService: {
    getAll: vi.fn(),
    getByStatus: vi.fn(),
    getMyBookings: vi.fn(),
    getRegistrationOptions: vi.fn(),
    update: vi.fn(),
  },
  mockProjectService: { getAll: vi.fn() },
  mockLeadService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  mockUserService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  mockTaskService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  mockUseAuth: vi.fn(),
}));

vi.mock('@/services', () => ({
  plotService: mockPlotService,
  projectService: mockProjectService,
  leadService: mockLeadService,
  userService: mockUserService,
  taskService: mockTaskService,
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
  Modal: ({ open, children, title }: { open: boolean; children: React.ReactNode; title?: React.ReactNode }) =>
    open ? (
      <div data-testid="modal">
        {title && <div>{title}</div>}
        {children}
      </div>
    ) : null,
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
    mockPlotService.getRegistrationOptions.mockResolvedValue({ data: { projects: [], banks: [], staff: [] } });
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

  it('shows total count and plots count', async () => {
    mockPlotService.getAll.mockResolvedValue({ data: [], total: 3, totalPlots: 5 });
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('3 customers (5 plots)')).toBeInTheDocument();
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
      expect(screen.getAllByText(/passed/i).length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });
  });

  it('calls getRegistrationOptions and populates project and staff dropdowns', async () => {
    mockPlotService.getRegistrationOptions.mockResolvedValue({
      data: {
        projects: [{ id: 'proj-1', name: 'Sunrise Orchards', displayId: 'P-10' }],
        banks: ['HDFC Bank', 'SBI'],
        staff: [{ id: 'staff-1', name: 'John Doe', displayId: 'ST-1', role: 'staff' }],
      },
    });

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockPlotService.getRegistrationOptions).toHaveBeenCalled();
      expect(screen.getByText('Sunrise Orchards [P-10]')).toBeInTheDocument();
      expect(screen.getByText('John Doe (ST-1)')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('sends groupBy=customer to backend plot service query', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockPlotService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          groupBy: 'customer',
          status: 'Registered',
        })
      );
    }, { timeout: 5000 });
  });

  it('debounces search input by 500ms before dispatching search request', async () => {
    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter>
          <AdminRegistrations />
        </MemoryRouter>
      );

      expect(mockPlotService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10, groupBy: 'customer' })
      );
      mockPlotService.getAll.mockClear();

      const searchInput = screen.getByPlaceholderText(/Search by customer name/i);

      // Character-by-character typing: ld-2477
      const chars = ['l', 'd', '-', '2', '4', '7', '7'];
      let currentVal = '';
      for (const char of chars) {
        currentVal += char;
        fireEvent.change(searchInput, { target: { value: currentVal } });
      }

      // Fast forward by 400ms: should not have called getAll with search
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(mockPlotService.getAll).not.toHaveBeenCalled();

      // Fast forward by remaining 100ms (total 500ms)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockPlotService.getAll).toHaveBeenCalledTimes(1);
      expect(mockPlotService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'ld-2477',
          page: 1,
          limit: 10,
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards stale response when older search query resolves after a newer one', async () => {
    let resolveEarlySearch: (val: any) => void = () => {};
    let resolveLateSearch: (val: any) => void = () => {};

    const promise1 = new Promise((resolve) => {
      resolveEarlySearch = resolve;
    });
    const promise2 = new Promise((resolve) => {
      resolveLateSearch = resolve;
    });

    // Mount call resolves immediately
    mockPlotService.getAll.mockResolvedValueOnce({ data: [], total: 0 });

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    const searchInput = await screen.findByPlaceholderText(/Search by customer name/i);

    // First search: 'ld-247'
    mockPlotService.getAll.mockImplementationOnce(() => promise1);
    fireEvent.change(searchInput, { target: { value: 'ld-247' } });

    await waitFor(() => {
      expect(mockPlotService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ld-247' })
      );
    });

    // Second search: 'ld-2477'
    mockPlotService.getAll.mockImplementationOnce(() => promise2);
    fireEvent.change(searchInput, { target: { value: 'ld-2477' } });

    await waitFor(() => {
      expect(mockPlotService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ld-2477' })
      );
    });

    // Resolve second request FIRST (newer search ld-2477)
    await act(async () => {
      resolveLateSearch({
        data: [{
          id: 'plot-2477',
          plotNumber: 2477,
          bookedBy: { name: 'Customer 2477', phone: '9999992477' },
        }],
        total: 1,
      });
    });

    const cust2477Elements = await screen.findAllByText('Customer 2477');
    expect(cust2477Elements.length).toBeGreaterThanOrEqual(1);

    // Now resolve first request LATER (stale search ld-247)
    await act(async () => {
      resolveEarlySearch({
        data: [{
          id: 'plot-247',
          plotNumber: 247,
          bookedBy: { name: 'Customer 247', phone: '9999992470' },
        }],
        total: 1,
      });
    });

    // Customer 247 must NOT overwrite Customer 2477
    await waitFor(() => {
      expect(screen.queryByText('Customer 247')).not.toBeInTheDocument();
      expect(screen.getAllByText('Customer 2477').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders effectivePaymentStatus instead of default placeholder paymentStatus', async () => {
    mockPlotService.getAll.mockResolvedValue({
      data: [{
        id: 'plot-eff-1',
        plotNumber: 101,
        projectId: { name: 'Royal Palms' },
        bookedBy: {
          name: 'Priya Sharma',
          phone: '9876500001',
          paymentStatus: 'Not Paid',
          loanStage: 'Not Applied',
        },
        effectivePaymentStatus: 'Advance Paid',
        effectiveLoanStage: 'Documentation Pending',
      }],
      total: 1,
    });

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      const badges = screen.getAllByTestId('status-badge');
      const badgeTexts = badges.map(b => b.textContent);
      expect(badgeTexts).toContain('Advance Paid');
      expect(badgeTexts).not.toContain('Not Paid');
    });
  });

  it('displays retryable options error banner and recovers when Retry Options is clicked', async () => {
    mockPlotService.getRegistrationOptions.mockRejectedValueOnce(new Error('Failed to load filter options'));

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    expect(await screen.findByText('Failed to load filter options')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Retry Options/i });
    expect(retryBtn).toBeInTheDocument();

    mockPlotService.getRegistrationOptions.mockResolvedValueOnce({
      data: {
        projects: [{ id: 'proj-retry', name: 'Retry Project', displayId: 'P-99' }],
        banks: ['Axis Bank'],
        staff: [],
      },
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByText('Failed to load filter options')).not.toBeInTheDocument();
      expect(screen.getByText('Retry Project [P-99]')).toBeInTheDocument();
    });
  });

  it('validates date range pre-request and alerts user if from date is after to date', async () => {
    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    const inputs = document.querySelectorAll('input[type="date"]');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const dateFromInput = inputs[0];
    const dateToInput = inputs[1];

    mockPlotService.getAll.mockClear();

    // Set dateTo = 2026-05-01
    fireEvent.change(dateToInput, { target: { value: '2026-05-01' } });
    // Set dateFrom = 2026-05-10 (later than dateTo)
    fireEvent.change(dateFromInput, { target: { value: '2026-05-10' } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Start date (2026-05-10) cannot be after end date (2026-05-01)')
      );
      expect(screen.getByText(/Invalid date range: Start date/i)).toBeInTheDocument();
    });

    // Backend query should not be called with this invalid range
    expect(mockPlotService.getAll).not.toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-01',
      })
    );
  });

  it('displays retained results note when a subsequent fetch fails', async () => {
    mockPlotService.getAll.mockImplementation(async (params?: any) => {
      if (params?.search === 'Something New') {
        throw new Error('Network disconnected');
      }
      return {
        data: [
          {
            id: 'plot-10',
            plotNumber: 'P-10',
            projectId: { name: 'Lotus Park' },
            status: 'Registered',
            registrationDate: '2026-01-01',
            bookedBy: { name: 'Initial Customer', phone: '9999988888', paymentStatus: 'Fully Paid' },
            effectivePaymentStatus: 'Fully Paid',
          },
        ],
        total: 1,
      };
    });

    render(
      <MemoryRouter>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Initial Customer').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });

    const searchInput = screen.getByPlaceholderText(/Search by customer name/i);
    fireEvent.change(searchInput, { target: { value: 'Something New' } });

    // Fast-forward debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 650));
    });

    await waitFor(() => {
      expect(screen.getByText(/Showing retained results from the previous successful search/i)).toBeInTheDocument();
      // Retained row is still visible
      expect(screen.getAllByText('Initial Customer').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });
  });

  it('checks effectivePaymentStatus in the Confirm Register modal warning', async () => {
    mockPlotService.getAll.mockResolvedValue({
      data: [
        {
          id: 'plot-warn-1',
          plotNumber: 'P-WARN-1',
          projectId: { name: 'Lotus Park' },
          status: 'Booked',
          expectedRegistrationDate: '2026-10-20',
          bookedBy: {
            name: 'Unpaid Buyer',
            phone: '9876543210',
            paymentStatus: '', // raw is empty
          },
          effectivePaymentStatus: 'Not Paid', // effective is Not Paid
        },
      ],
      total: 1,
    });

    render(
      <MemoryRouter initialEntries={['/admin/registrations?tab=upcoming']}>
        <AdminRegistrations />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Unpaid Buyer').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });

    // Find and click the Confirm Register button (desktop or mobile)
    const confirmButtons = screen.getAllByRole('button', { name: /Confirm Register/i });
    fireEvent.click(confirmButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Confirm Registration — Plot #P-WARN-1/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Payment status for this plot is currently/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText('Not Paid').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });
  });
});
