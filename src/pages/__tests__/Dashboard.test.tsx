import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminDashboard from '@/pages/admin/Dashboard'

// ─── Mock all services ────────────────────────────────────────────
vi.mock('@/services', () => ({
  projectService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  leadService: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    getCounts: vi.fn().mockResolvedValue({ data: { All: 0, Open: 0, Reserved: 0, Qualified: 0, Unqualified: 0, Customer: 0 } }),
  },
  plotService: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    getByStatus: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  },
  attendanceService: { getToday: vi.fn().mockResolvedValue({ data: [] }) },
  activityLogService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  userService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  reportService: {
    getSummary: vi.fn().mockResolvedValue({ data: { totalProjects: 0 } }),
    getOperationsMetrics: vi.fn().mockResolvedValue({
      data: {
        totalLoans: 0,
        registrationPending: 0,
        totalBookings: 0,
        todaysRegistrations: 0,
        pendingPaymentRegistrations: 0,
        bookingPayments: { notPaid: 0, partiallyPaid: 0, advancePaid: 0, advanceNotPaid: 0 },
      },
    }),
    getDashboardLeadCharts: vi.fn().mockResolvedValue({
      data: {
        monthlyTrend: [],
        sourceBreakdown: [
          { name: 'Channel Partners', value: 0, color: '#3B82F6', count: 0 },
          { name: 'Staff Added', value: 0, color: '#F59E0B', count: 0 },
          { name: 'Admin Added', value: 0, color: '#10B981', count: 0 },
          { name: 'Others', value: 0, color: '#8B5CF6', count: 0 },
        ],
        totalLeads: 0,
      },
    }),
  },
}))

// ─── Mock Recharts (doesn't render in jsdom) ──────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
}))

// ─── Mock shared components ───────────────────────────────────────
vi.mock('@/components/shared/Timeline', () => ({
  Timeline: ({ items }: any) => (
    <div data-testid="timeline">
      {items.map((item: any) => <div key={item.id}>{item.label}</div>)}
    </div>
  ),
}))

vi.mock('@/components/shared/Avatar', () => ({
  Avatar: ({ initials, size }: any) => (
    <div data-testid="avatar" data-size={size}>{initials}</div>
  ),
}))

vi.mock('@/components/shared/StatusBadge', () => ({
  StatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}))

// ─── Tests ────────────────────────────────────────────────────────
describe('Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading skeleton initially', () => {
    render(<AdminDashboard />)
    expect(document.querySelector('.animate-pulse') || document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should render metric cards after loading', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Leads')).toBeInTheDocument()
    expect(screen.getByText('Staff Present')).toBeInTheDocument()
    expect(screen.getByText('Plots Booked')).toBeInTheDocument()
  })

  it('should render chart sections after loading', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Leads & Bookings Trend')).toBeInTheDocument()
    })

    expect(screen.getByText('Lead Contributions')).toBeInTheDocument()
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText("Today's Staff Attendance")).toBeInTheDocument()
  })

  it('should show "No recent activity" when activity list is empty', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument()
    })
  })

  it('should show "No attendance records" when attendance is empty', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('No attendance records')).toBeInTheDocument()
    })
  })

  it('should display lead count values', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })

    // Default counts should be 0 since services return empty data
    const countElements = screen.getAllByText('0')
    expect(countElements.length).toBeGreaterThanOrEqual(1)
  })

  it('should display "Last 6 Months" badge', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Last 6 Months')).toBeInTheDocument()
    })
  })

  it('should show lead source breakdown labels', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Channel Partners')).toBeInTheDocument()
    })

    expect(screen.getByText('Admin Added')).toBeInTheDocument()
    expect(screen.getByText('Staff Added')).toBeInTheDocument()
    expect(screen.getByText('Others')).toBeInTheDocument()
  })

  it('should render location in attendance card when attendance data is available', async () => {
    const { attendanceService } = await import('@/services')
    vi.mocked(attendanceService.getToday).mockResolvedValueOnce({
      data: [
        {
          id: 'att-1',
          staffId: 's-1',
          staffName: 'John Doe',
          date: '2026-07-28',
          checkIn: '09:00 AM',
          status: 'Present',
          role: 'Staff',
          location: 'Site Hyderabad',
        },
      ],
    } as any)

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    expect(screen.getByText('Site Hyderabad')).toBeInTheDocument()
    expect(screen.getByText('09:00 AM')).toBeInTheDocument()
  })
})
