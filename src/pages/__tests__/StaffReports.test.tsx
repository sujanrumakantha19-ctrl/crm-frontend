import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockLeadService, mockTaskService, mockAttendanceService } = vi.hoisted(() => ({
  mockLeadService: { getAll: vi.fn() },
  mockTaskService: { getAll: vi.fn() },
  mockAttendanceService: { getByStaff: vi.fn(), getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('@/services', () => ({
  leadService: mockLeadService,
  taskService: mockTaskService,
  attendanceService: mockAttendanceService,
  projectService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  reportService: { getOperationsMetrics: vi.fn().mockResolvedValue({ data: null }) },
  userService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (v: any) => v,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    role: 'staff',
    userId: 'staff-1',
    user: { name: 'Priya Sharma', role: 'staff', initials: 'PS' },
  }),
}));

vi.mock('@/lib/taskAssignee', () => ({
  isTaskAssignedTo: vi.fn().mockReturnValue(false),
}));

vi.mock('@/components/shared/Avatar', () => ({
  Avatar: ({ initials }: { initials: string }) => <span data-testid="avatar">{initials}</span>,
}));

vi.mock('@/components/shared/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart">{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Cell: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
}));

import StaffReports from '@/pages/staff/StaffReports';
import { ExportProvider } from '@/context/ExportContext';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ExportProvider>
        {ui}
      </ExportProvider>
    </MemoryRouter>
  );
};

describe('StaffReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeadService.getAll.mockResolvedValue({ data: [], total: 0 });
    mockTaskService.getAll.mockResolvedValue({ data: [], total: 0 });
    mockAttendanceService.getByStaff.mockResolvedValue({ data: [], total: 0 });
  });

  it('renders the page title after loading', async () => {
    renderWithProviders(<StaffReports />);
    const title = await screen.findByText('My Reports', {}, { timeout: 5000 });
    expect(title).toBeInTheDocument();
  });

  it('renders summary cards after loading', async () => {
    renderWithProviders(<StaffReports />);
    await waitFor(() => {
      expect(screen.getAllByText('My Leads').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });
    expect(screen.getAllByText('Created Leads').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tasks Completed')).toBeInTheDocument();
    expect(screen.getAllByText('Days Present').length).toBeGreaterThanOrEqual(1);
  });

  it('renders tabs after loading', async () => {
    renderWithProviders(<StaffReports />);
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByText('My Tasks Report')).toBeInTheDocument();
    expect(screen.getByText('Attendance Report')).toBeInTheDocument();
  });

  it('renders export CSV button after loading', async () => {
    renderWithProviders(<StaffReports />);
    const btn = await screen.findByText('Export CSV', {}, { timeout: 5000 });
    expect(btn).toBeInTheDocument();
  });

  it('renders overview charts section after loading', async () => {
    renderWithProviders(<StaffReports />);
    await waitFor(() => {
      expect(screen.getByText('Leads Pipeline')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByText('Task Status Breakdown')).toBeInTheDocument();
  });
});
